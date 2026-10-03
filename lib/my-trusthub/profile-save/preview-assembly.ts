import { randomUUID } from 'node:crypto';
import { AuthorizedPostgresBackend, type AuthorizedPostgresPorts } from './authorized-postgres.ts';
import { ParentProfileSaveRuntime, RuntimeError, hash, type VerifiedCaller, type RuntimeAuthorization } from './runtime.ts';
import { PreviewStore, PreviewConfirmationStore, randomRef } from './preview-store.ts';
import { isolatedBrowserBindings } from './isolated-adapters.ts';
import { CurrentGrants } from './current-grant.ts';
import { SourceChannel, moveSourceIdentifier, supportedMoveProfile, type Publication } from './source-channel.ts';
import { API_PATH, GRANT_API_PATH, deploymentConfig, opaque, sqlName, type DeploymentConfig, type DeploymentTarget, type Env } from './isolated-config.ts';
import { verifyAssertion, boundedBody, type AssertionKey } from './service-assertion.ts';
import { verifyLenderAssertion } from './lender-assertion.ts';
import { LenderSourceChannel, isLenderMarketplaceIdentity, isLenderMarketplaceStage, lenderPinsFor } from './lender-channel.ts';
import { LENDER_BINDING_SQL, classifyLenderRows, type LenderBindingRow } from './lender-binding.ts';
import { PRODUCTION_ORIGINS } from '../contracts/v2-3-profile-transfer.ts';
import type { BrowserBindings, BrowserParent, SourceSnapshot } from './browser.ts';
import type { TransactionPool } from './postgres-backend.ts';
import type { P13Proof } from './p12-p13.ts';
import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import { isGuestStageInput, manifestDigest, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { Operation } from './interface.ts';
import { PRIVATE_HEADERS } from './http.ts';

type Link = { browser: string; transferRef: string; manifestDigest: string; expiresAt: number };
type StageLink = Link & { manifest: GuestStageInput };
type Exchange = { parent: BrowserParent; proof: P13Proof; expiresAt: number };
type Project = { ref: string; id: string; label: string };
type ProjectList = { items: Project[] };
/** Removes the verified parent's own Saved row for one network entity through
 * that user's session. Returns false when the account holds no such row,
 * 'in_project' when the row is filed in a Project (left untouched), and throws
 * when a row exists but could not be removed. */
export type RemoveSaved = (parent: BrowserParent, networkEntityId: string) => Promise<boolean | 'in_project'>;
const equal = (a: BrowserParent | null, b: BrowserParent) => a?.subject === b.subject && a.session === b.session;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).sort().join() === keys.sort().join();
type ExchangeStage = 'authorize' | 'bind_transport_key' | 'lock_transport' | 'read_transport' | 'issue_context' | 'write_transport';
const diagnosticCode = (error: unknown): string => {
  if (error instanceof RuntimeError) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(code)) return code;
  }
  return 'unknown';
};

/** Production assembly. Dependencies are verified infrastructure ports, never
 * a request-supplied subject or fallback persistence implementation. */
export class PreviewAssembly {
  readonly store: PreviewStore;
  readonly grants: CurrentGrants;
  readonly config: DeploymentConfig; readonly target: DeploymentTarget;
  readonly env: Env; readonly pool: TransactionPool; readonly source: SourceChannel;
  readonly moveKey: AssertionKey; readonly parent: BrowserBindings['parent'];
  readonly removeSaved?: RemoveSaved;
  lenderKey: AssertionKey | null = null;
  lenderSource: LenderSourceChannel | null = null;
  constructor(env: Env, pool: TransactionPool, source: SourceChannel,
    moveKey: AssertionKey, parent: BrowserBindings['parent'], removeSaved?: RemoveSaved) {
    this.env = env; this.pool = pool; this.source = source; this.moveKey = moveKey; this.parent = parent; this.removeSaved = removeSaved;
    const c = deploymentConfig(env); if (!c) throw new RuntimeError('unavailable');
    this.config = c; this.target = c.target; this.store = new PreviewStore(pool, c.target); this.grants = new CurrentGrants(this.store, parent);
  }
  /** Exact mover binding for one verified Move identity. The resolver returns
   * every current accepted or review_required binding that claims this USDOT
   * identity (at most three); eligibility is exactly one, accepted, on an
   * active entity, agreeing with the identity on both the native id and the
   * source identifier. Zero, several, review_required or any disagreement is
   * not eligible. The identity never comes from a browser. */
  async binding(profile: ProfileIdentity, db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']>> {
    if (!supportedMoveProfile(profile)) throw new RuntimeError('unavailable');
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const r = await d.query<{ id: string; network_entity_id: string; binding_status: string; specialist_entity_id: string; source_identifier: string; entity_status: string }>(
        `select * from ${sqlName(this.target, 'move_binding_for')}($1)`, [profile.nativeId]);
      const b = r.rows[0];
      if (r.rows.length !== 1 || b.binding_status !== 'accepted' || b.entity_status !== 'active' ||
        b.specialist_entity_id !== profile.nativeId || b.source_identifier !== moveSourceIdentifier(profile)) throw new RuntimeError('unavailable');
      return { id: b.id, networkEntityId: b.network_entity_id, status: 'accepted' as const };
    };
    return db ? query(db) : this.store.authorized(query);
  }
  /** Exact marketplace binding. Zero, several, review_required, or any
   * disagreement is not eligible. The NMLS comes from the signed manifest. */
  async lenderBinding(profile: ProfileIdentity, db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']>> {
    if (!isLenderMarketplaceIdentity(profile)) throw new RuntimeError('unavailable');
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const found = await d.query<LenderBindingRow>(LENDER_BINDING_SQL, [profile.nativeId]);
      const decision = classifyLenderRows(profile.nativeId, found.rows);
      if (decision.outcome !== 'eligible') throw new RuntimeError('unavailable');
      return { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' as const };
    };
    return db ? query(db) : this.store.authorized(query);
  }
  /** One publication proof per profile per request. */
  private readonly publications = new Map<string, Promise<Publication>>();
  private publication(browser: string, profile: ProfileIdentity): Promise<Publication> {
    const key = browser + ':' + profile.nativeId;
    let proof = this.publications.get(key);
    if (!proof) { proof = this.source.publication(browser, profile); this.publications.set(key, proof); proof.catch(() => this.publications.delete(key)); }
    return proof;
  }
  async projects(parent: BrowserParent): Promise<Project[]> {
    if (!await this.store.live(parent.subject, parent.session)) throw new RuntimeError('unauthorized');
    const rows = await this.store.authorized(async db => (await db.query<{ project_id: string; name: string }>(`select * from ${sqlName(this.target, 'projects')}($1,$2)`, [parent.subject, parent.session])).rows);
    const key = 'projects:' + hash(parent.subject + ':' + parent.session);
    return await this.store.record<ProjectList>(key, async prior => {
      const items = rows.map(r => ({ ref: prior?.items.find(p => p.id === r.project_id)?.ref ?? randomRef(), id: r.project_id, label: r.name }));
      return { value: { items }, expiresAt: Date.now() + 600000, result: items };
    }) as Project[];
  }
  private async exchange(ref: string, a: RuntimeAuthorization): Promise<P13Proof | null> {
    let stage: ExchangeStage = 'authorize';
    try {
      const p = a.caller.parent;
      if (!p || a.caller.exchange !== ref || a.caller.confirmedAccountContextRef !== ref || !a.caller.selectionConfirmed) return null;
      return await this.store.authorized(async db => {
        stage = 'bind_transport_key';
        const key = hash('exchange:' + ref);
        await db.query("select set_config('v23.transport_key',$1,true)", [key]);
        stage = 'lock_transport';
        await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['v23-preview:' + key]);
        stage = 'read_transport';
        const transport = sqlName(this.target, 'transport_records');
        const prior = (await db.query<{ payload: Exchange }>(`select payload from ${transport} where key_hash=$1`, [key])).rows[0]?.payload;
        if (prior) {
          if (prior.parent.subject !== p.subject || prior.parent.session !== p.sessionBinding || prior.expiresAt <= Date.now()) throw new RuntimeError('expired');
          return prior.proof;
        }
        stage = 'issue_context';
        const proof = { code: randomRef(), state: randomRef(), nonce: randomRef(), intent: randomRef(), creationKey: randomUUID(), targetOrigin: this.target.parentOrigin, rateBucket: hash(p.subject + ':' + p.sessionBinding) };
        const issued = await db.query<{ issued: boolean }>(`select ${sqlName(this.target, 'issue_context')}($1,$2,$3) as issued`, [JSON.stringify(proof), p.subject, p.sessionBinding]);
        if (!issued.rows[0]?.issued) throw new RuntimeError('unavailable');
        stage = 'write_transport';
        const value: Exchange = { parent: { subject: p.subject, session: p.sessionBinding, label: '' }, proof, expiresAt: Date.now() + 85000 };
        await db.query(`insert into ${transport}(key_hash,payload,expires_at) values($1,$2,to_timestamp($3/1000.0))`, [key, JSON.stringify(value), value.expiresAt]);
        return proof;
      });
    } catch (error) {
      console.warn(JSON.stringify({ event: 'my_trusthub_v23_exchange_failure', stage, code: diagnosticCode(error) }));
      throw error;
    }
  }
  private ports(verify: AuthorizedPostgresPorts['verify'], browser: string): AuthorizedPostgresPorts {
    return { pool: this.pool, verify,
      profile: async (identity, db) => {
        if (identity.hub === 'move') {
          if (!supportedMoveProfile(identity)) return null;
          await this.publication(browser, identity);
          return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding: await this.binding(identity, db) };
        }
        if (identity.hub !== 'lender' || !isLenderMarketplaceIdentity(identity) || !this.lenderSource) return null;
        await this.lenderSource.publication(browser, identity);
        return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding: await this.lenderBinding(identity, db) };
      },
      // The return path is the specialist's canonical profile for this identity.
      returnTask: async identity => {
        if (identity.hub === 'move') {
          if (!supportedMoveProfile(identity)) return null;
          const slug = (await this.publication(browser, identity)).canonicalSlug;
          return { kind: 'profile', hub: 'move', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: `/companies/${slug}` };
        }
        if (identity.hub !== 'lender' || !isLenderMarketplaceIdentity(identity) || !this.lenderSource) return null;
        const slug = (await this.lenderSource.publication(browser, identity)).canonicalSlug;
        return { kind: 'profile', hub: 'lender', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: `/lenders/${slug}` };
      },
      project: async (ref, a) => {
        const p = a.caller.parent; if (!p) return null;
        const items = await this.projects({ subject: p.subject, session: p.sessionBinding, label: '' });
        return items.find(p => p.ref === ref)?.id ?? null;
      }, exchange: (ref, a) => this.exchange(ref, a) };
  }
  async browserBindings(request: Request): Promise<BrowserBindings | null> {
    if (new URL(request.url).origin !== this.target.parentOrigin) return null;
    // Caller-specific backend is constructed only on explicit confirmation.
    const binding = isolatedBrowserBindings(this.env, { approvedParentOrigin: this.target.parentOrigin, target: this.target, registry: this.config.registry,
      sessionAffinity: 'dedicated', postgres: this.ports(async () => false, randomRef()),
      parent: this.parent, projects: p => this.projects(p), store: new PreviewConfirmationStore(this.pool, this.target),
      source: async (r, ref) => {
        const origin = r.headers.get('origin');
        const move = origin === this.target.moveOrigin;
        const lender = Boolean(this.lenderSource) && origin === PRODUCTION_ORIGINS.lender;
        if (!move && !lender) return null;
        const link = await this.store.read<StageLink>('continuation:' + ref);
        if (!link || link.expiresAt <= Date.now()) return null;
        const channel = lender ? this.lenderSource! : this.source;
        const sourceBody = lender && link.manifest
          ? { action: 'source', continuationRef: ref, transferRef: link.transferRef, manifest: link.manifest, manifestDigest: link.manifestDigest, expiresAt: link.expiresAt }
          : { action: 'source', continuationRef: ref };
        const s = await channel.call(sourceBody, 'source:read', link.browser) as SourceSnapshot;
        if (!s || s.browserProof !== link.browser || s.transferRef !== link.transferRef || s.manifestDigest !== link.manifestDigest ||
          s.expiresAt > link.expiresAt || !isGuestStageInput(s.manifest) || manifestDigest(s.manifest) !== link.manifestDigest) return null;
        if (move && s.manifest.selected.some(i => !supportedMoveProfile(i.profile))) return null;
        if (lender && !isLenderMarketplaceStage(s.manifest)) return null;
        return s;
      },
      acknowledge: async (s, receipts, p) => {
        if (!equal(await this.parent(request), p)) throw new RuntimeError('unauthorized');
        const channel = s.manifest.sourceHub === 'lender' ? this.lenderSource : this.source;
        if (!channel) throw new RuntimeError('unavailable');
        await channel.call({ action: 'acknowledge', continuationRef: s.continuationRef, receipts }, 'source:ack', s.browserProof, hash(p.session));
      }, authenticate: async () => null });
    if (!binding) return null;
    binding.confirmed = (c, p) => this.grants.remember(c, p);
    // One-click Unsave: the exact reviewed profile, the accepted binding's
    // network entity and the live verified session. Never a posted identifier.
    binding.unsave = async (r, c, p) => {
      const selected = c.source.manifest.selected;
      const profile = selected[0]?.profile;
      const moveProfile = !!profile && supportedMoveProfile(profile);
      const lenderProfile = !!profile && isLenderMarketplaceIdentity(profile);
      if (!this.removeSaved || selected.length !== 1 || (!moveProfile && !lenderProfile) ||
        !equal(await this.parent(r), p) || !await this.store.live(p.subject, p.session)) throw new RuntimeError('unauthorized');
      const networkEntityId = moveProfile ? (await this.binding(profile)).networkEntityId : (await this.lenderBinding(profile!)).networkEntityId;
      const outcome = await this.removeSaved(p, networkEntityId);
      return outcome === 'in_project' ? 'in_project' : outcome ? 'removed' : 'not_saved';
    };
    binding.runtime = async (r, c, p) => {
      if (!c.contextCandidateRef || !equal(await this.parent(r), p) || !equal(c.parent ?? null, p)) throw new RuntimeError('unauthorized');
      const sourceHub = c.source.manifest.sourceHub;
      if (sourceHub !== 'move' && sourceHub !== 'lender') throw new RuntimeError('unauthorized');
      const who: VerifiedCaller = { hub: sourceHub, browserBinding: c.source.browserProof, environment: this.target.kind, scopes: ['saved:write', 'receipt:verify'],
        parent: { subject: p.subject, sessionBinding: p.session, admitted: true }, exchange: c.contextCandidateRef,
        selectionConfirmed: true, confirmedTransferRef: c.source.transferRef, confirmedAccountContextRef: c.contextCandidateRef };
      const verify = async (a: RuntimeAuthorization) => JSON.stringify(a.caller) === JSON.stringify(who) && equal(await this.parent(r), p);
      return new ParentProfileSaveRuntime({ enabled: true, registry: this.config.registry,
        backend: new AuthorizedPostgresBackend(this.ports(verify, who.browserBinding)), authenticate: async () => equal(await this.parent(r), p) ? who : null });
    };
    return binding;
  }
  async serviceRuntime(request: Request): Promise<ParentProfileSaveRuntime | null> {
    if (new URL(request.url).pathname !== API_PATH || request.headers.has('origin')) throw new RuntimeError('unauthorized');
    const bytes = await boundedBody(request, 65536), e = JSON.parse(bytes.toString('utf8'));
    const stage = ['prepareGuestProfileTransfer', 'prepareProfileSaveContinuation'].includes(e?.operation);
    if (!stage && !['getProfileSaveReceipt', 'verifyProfileSaveReceipt'].includes(e?.operation)) throw new RuntimeError('unauthorized');
    let claims;
    let serviceHub: 'move' | 'lender' = 'move';
    try {
      claims = await verifyAssertion(request, bytes, this.moveKey, 'move', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), this.target);
    } catch (moveError) {
      if (!this.lenderKey || !lenderPinsFor(this.target)) throw moveError;
      claims = await verifyLenderAssertion(request, bytes, this.lenderKey, 'lender', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), lenderPinsFor(this.target)!);
      serviceHub = 'lender';
    }
    let who: VerifiedCaller = { hub: serviceHub, browserBinding: claims.browser, environment: this.target.kind, scopes: ['transfer:stage'] };
    const valid = async () => {
      if (Date.now() >= claims.exp * 1000) return false;
      if (stage) return claims.session === null && claims.grant === null;
      const current = await this.grants.resolve(claims.grant ?? '', claims.browser);
      return current.proof.subject === who.parent?.subject && current.proof.session === who.parent?.sessionBinding &&
        claims.session === hash(current.proof.session) && current.grant.accountContextRef === e.input?.accountContextRef &&
        typeof e.input?.requestKey === 'string' && new RegExp('^' + current.grant.requestPrefix + ':\\d{1,2}$').test(e.input.requestKey);
    };
    if (!stage) {
      const current = await this.grants.resolve(claims.grant ?? '', claims.browser);
      who = { ...who, scopes: ['saved:write', 'receipt:verify'], parent: { subject: current.proof.subject, sessionBinding: current.proof.session, admitted: true },
        receiptRecovery: { accountContextRef: current.grant.accountContextRef, requestKey: e.input?.requestKey, verifiedAt: current.proof.verifiedAt } };
    }
    if (!await valid()) throw new RuntimeError('unauthorized');
    const rt = new ParentProfileSaveRuntime({ enabled: true, registry: this.config.registry,
      backend: new AuthorizedPostgresBackend(this.ports(async a => JSON.stringify(a.caller) === JSON.stringify(who) && await valid(), claims.browser)),
      authenticate: async () => await valid() ? who : null });
    const execute = rt.execute.bind(rt);
    rt.execute = async (operation: Operation, input: unknown) => {
      if (operation !== e.operation || JSON.stringify(input) !== JSON.stringify(e.input)) throw new RuntimeError('unauthorized');
      if (operation === 'prepareGuestProfileTransfer') {
        if (!isGuestStageInput(input)) throw new RuntimeError('invalid');
        if (serviceHub === 'move' && (input.sourceHub !== 'move' || input.selected.some(i => !supportedMoveProfile(i.profile)))) throw new RuntimeError('invalid');
        if (serviceHub === 'lender' && !isLenderMarketplaceStage(input)) throw new RuntimeError('invalid');
      }
      const result = await execute(operation, input);
      if (operation === 'prepareGuestProfileTransfer') {
        const link = { ...(result as Link), browser: claims.browser, manifest: input as GuestStageInput };
        await this.store.put('stage:' + link.transferRef, link, link.expiresAt, true);
      }
      if (operation === 'prepareProfileSaveContinuation') {
        const v = input as { transferRef: string; manifestDigest: string }, link = await this.store.read<StageLink>('stage:' + v.transferRef);
        if (!link || link.browser !== claims.browser || link.manifestDigest !== v.manifestDigest) throw new RuntimeError('unauthorized');
        const cont = result as { continuationRef: string; expiresAt: number };
        await this.store.put('continuation:' + cont.continuationRef, link, cont.expiresAt, true);
      }
      return result;
    };
    return rt;
  }
  async grantService(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== GRANT_API_PATH || request.headers.has('origin') || request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new RuntimeError('invalid');
    const bytes = await boundedBody(request, 4096), body: unknown = JSON.parse(bytes.toString('utf8'));
    if (!object(body)) throw new RuntimeError('invalid');
    const binding = body.action === 'binding';
    const c = await verifyAssertion(request, bytes, this.moveKey, 'move', binding ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), this.target);
    if (c.session !== null || c.grant !== null) throw new RuntimeError('invalid');
    let result: unknown;
    if (binding && exact(body, ['action', 'profile']) && supportedMoveProfile(body.profile)) {
      // Move asks for one exact identity it has signed for; publication is re-proved with Move.
      const profile = body.profile;
      await this.publication(c.browser, profile);
      result = { profile: { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass }, binding: await this.binding(profile) };
    } else if (body.action === 'challenge' && exact(body, ['action', 'continuationRef']) && opaque(body.continuationRef)) {
      result = await this.grants.challenge(body.continuationRef, c.browser);
    } else if (body.action === 'resolve' && exact(body, ['action', 'continuationRef', 'proofRef']) && opaque(body.continuationRef) && opaque(body.proofRef)) {
      const current = await this.grants.resolve(body.proofRef, c.browser, body.continuationRef);
      result = { accountContextRef: current.grant.accountContextRef, selectionConfirmed: true, sessionBinding: hash(current.proof.session),
        expiresAt: current.proof.expiresAt, ...(current.grant.projectRef ? { projectRef: current.grant.projectRef } : {}) };
    } else throw new RuntimeError('invalid');
    return Response.json({ ok: true, result }, { headers: PRIVATE_HEADERS });
  }
}
