import { randomUUID } from 'node:crypto';
import { AuthorizedPostgresBackend, type AuthorizedPostgresPorts } from './authorized-postgres.ts';
import { ParentProfileSaveRuntime, RuntimeError, hash, type VerifiedCaller, type RuntimeAuthorization } from './runtime.ts';
import { PreviewStore, PreviewConfirmationStore, randomRef } from './preview-store.ts';
import { isolatedBrowserBindings } from './isolated-adapters.ts';
import { CurrentGrants } from './current-grant.ts';
import { SourceChannel, TEST_PROFILE, TEST_SLUG, exactTestProfile } from './source-channel.ts';
import { ASK_PREVIEW, MOVE_PREVIEW, API_PATH, GRANT_API_PATH, isolatedConfig, opaque, type Env } from './isolated-config.ts';
import { verifyAssertion, boundedBody, type AssertionKey } from './service-assertion.ts';
import type { BrowserBindings, BrowserParent, SourceSnapshot } from './browser.ts';
import type { TransactionPool } from './postgres-backend.ts';
import type { P13Proof } from './p12-p13.ts';
import type { TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import { isGuestStageInput, manifestDigest, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { Operation } from './interface.ts';
import { PRIVATE_HEADERS } from './http.ts';

type Link = { browser: string; transferRef: string; manifestDigest: string; expiresAt: number };
type StageLink = Link & { manifest: GuestStageInput };
type Exchange = { parent: BrowserParent; proof: P13Proof; expiresAt: number };
type Project = { ref: string; id: string; label: string };
type ProjectList = { items: Project[] };
const equal = (a: BrowserParent | null, b: BrowserParent) => a?.subject === b.subject && a.session === b.session;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).sort().join() === keys.sort().join();

/** Production assembly. Dependencies are verified infrastructure ports, never
 * a request-supplied subject or fallback persistence implementation. */
export class PreviewAssembly {
  readonly store: PreviewStore;
  readonly grants: CurrentGrants;
  readonly config: NonNullable<ReturnType<typeof isolatedConfig>>;
  readonly env: Env; readonly pool: TransactionPool; readonly source: SourceChannel;
  readonly moveKey: AssertionKey; readonly parent: BrowserBindings['parent'];
  constructor(env: Env, pool: TransactionPool, source: SourceChannel,
    moveKey: AssertionKey, parent: BrowserBindings['parent']) {
    this.env = env; this.pool = pool; this.source = source; this.moveKey = moveKey; this.parent = parent;
    const c = isolatedConfig(env); if (!c) throw new RuntimeError('unavailable');
    this.config = c; this.store = new PreviewStore(pool); this.grants = new CurrentGrants(this.store, parent);
  }
  async binding(db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']>> {
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const r = await d.query<{ id: string; network_entity_id: string; binding_status: 'accepted' }>('select * from v23_private.preview_move_binding()', []);
      if (r.rows.length !== 1 || r.rows[0].binding_status !== 'accepted') throw new RuntimeError('unavailable');
      return { id: r.rows[0].id, networkEntityId: r.rows[0].network_entity_id, status: r.rows[0].binding_status };
    };
    return db ? query(db) : this.store.authorized(query);
  }
  async projects(parent: BrowserParent): Promise<Project[]> {
    if (!await this.store.live(parent.subject, parent.session)) throw new RuntimeError('unauthorized');
    const rows = await this.store.authorized(async db => (await db.query<{ project_id: string; name: string }>('select * from v23_private.preview_projects($1,$2)', [parent.subject, parent.session])).rows);
    const key = 'projects:' + hash(parent.subject + ':' + parent.session);
    return await this.store.record<ProjectList>(key, async prior => {
      const items = rows.map(r => ({ ref: prior?.items.find(p => p.id === r.project_id)?.ref ?? randomRef(), id: r.project_id, label: r.name }));
      return { value: { items }, expiresAt: Date.now() + 600000, result: items };
    }) as Project[];
  }
  private async exchange(ref: string, a: RuntimeAuthorization): Promise<P13Proof | null> {
    const p = a.caller.parent;
    if (!p || a.caller.exchange !== ref || a.caller.confirmedAccountContextRef !== ref || !a.caller.selectionConfirmed) return null;
    return this.store.authorized(async db => {
      const key = hash('exchange:' + ref);
      await db.query("select set_config('v23.transport_key',$1,true)", [key]);
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['v23-preview:' + key]);
      const prior = (await db.query<{ payload: Exchange }>('select payload from v23_private.preview_transport_records where key_hash=$1', [key])).rows[0]?.payload;
      if (prior) {
        if (prior.parent.subject !== p.subject || prior.parent.session !== p.sessionBinding || prior.expiresAt <= Date.now()) throw new RuntimeError('expired');
        return prior.proof;
      }
      const proof = { code: randomRef(), state: randomRef(), nonce: randomRef(), intent: randomRef(), creationKey: randomUUID(), targetOrigin: ASK_PREVIEW, rateBucket: hash(p.subject + ':' + p.sessionBinding) };
      const issued = await db.query<{ issued: boolean }>('select v23_private.preview_issue_context($1,$2,$3) as issued', [JSON.stringify(proof), p.subject, p.sessionBinding]);
      if (!issued.rows[0]?.issued) throw new RuntimeError('unavailable');
      const value: Exchange = { parent: { subject: p.subject, session: p.sessionBinding, label: '' }, proof, expiresAt: Date.now() + 85000 };
      await db.query('insert into v23_private.preview_transport_records(key_hash,payload,expires_at) values($1,$2,to_timestamp($3/1000.0))', [key, JSON.stringify(value), value.expiresAt]);
      return proof;
    });
  }
  private ports(verify: AuthorizedPostgresPorts['verify'], browser: string): AuthorizedPostgresPorts {
    return { pool: this.pool, verify,
      profile: async (identity, db) => {
        if (!exactTestProfile(identity)) return null;
        await this.source.publication(browser);
        return { ...TEST_PROFILE, published: true, supportedClass: true, binding: await this.binding(db) };
      },
      returnTask: async identity => exactTestProfile(identity) ? { kind: 'profile', hub: 'move', profile: TEST_PROFILE, canonicalSlug: TEST_SLUG, returnPath: `/companies/${TEST_SLUG}` } : null,
      project: async (ref, a) => {
        const p = a.caller.parent; if (!p) return null;
        const items = await this.projects({ subject: p.subject, session: p.sessionBinding, label: '' });
        return items.find(p => p.ref === ref)?.id ?? null;
      }, exchange: (ref, a) => this.exchange(ref, a) };
  }
  async browserBindings(request: Request): Promise<BrowserBindings | null> {
    if (new URL(request.url).origin !== ASK_PREVIEW) return null;
    // Caller-specific backend is constructed only on explicit confirmation.
    const binding = isolatedBrowserBindings(this.env, { approvedParentOrigin: ASK_PREVIEW, registry: this.config.registry,
      sessionAffinity: 'dedicated', postgres: this.ports(async () => false, randomRef()),
      parent: this.parent, projects: p => this.projects(p), store: new PreviewConfirmationStore(this.pool),
      source: async (r, ref) => {
        if (r.headers.get('origin') !== MOVE_PREVIEW) return null;
        const link = await this.store.read<Link>('continuation:' + ref);
        if (!link || link.expiresAt <= Date.now()) return null;
        const s = await this.source.call({ action: 'source', continuationRef: ref }, 'source:read', link.browser) as SourceSnapshot;
        if (!s || s.browserProof !== link.browser || s.transferRef !== link.transferRef || s.manifestDigest !== link.manifestDigest ||
          s.expiresAt > link.expiresAt || !isGuestStageInput(s.manifest) || manifestDigest(s.manifest) !== link.manifestDigest ||
          s.manifest.selected.some(i => !exactTestProfile(i.profile))) return null;
        return s;
      },
      acknowledge: async (s, receipts, p) => {
        if (!equal(await this.parent(request), p)) throw new RuntimeError('unauthorized');
        await this.source.call({ action: 'acknowledge', continuationRef: s.continuationRef, receipts }, 'source:ack', s.browserProof, hash(p.session));
      }, authenticate: async () => null });
    if (!binding) return null;
    binding.confirmed = (c, p) => this.grants.remember(c, p);
    binding.runtime = async (r, c, p) => {
      if (!c.contextCandidateRef || !equal(await this.parent(r), p) || !equal(c.parent ?? null, p)) throw new RuntimeError('unauthorized');
      const who: VerifiedCaller = { hub: 'move', browserBinding: c.source.browserProof, environment: 'isolated', scopes: ['saved:write', 'receipt:verify'],
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
    const claims = await verifyAssertion(request, bytes, this.moveKey, 'move', stage ? 'transfer:stage' : 'receipt:verify', this.store);
    let who: VerifiedCaller = { hub: 'move', browserBinding: claims.browser, environment: 'isolated', scopes: ['transfer:stage'] };
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
      if (operation === 'prepareGuestProfileTransfer' && (!isGuestStageInput(input) || input.selected.some(i => !exactTestProfile(i.profile)))) throw new RuntimeError('invalid');
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
    const c = await verifyAssertion(request, bytes, this.moveKey, 'move', binding ? 'transfer:stage' : 'receipt:verify', this.store);
    if (c.session !== null || c.grant !== null) throw new RuntimeError('invalid');
    let result: unknown;
    if (binding && exact(body, ['action'])) {
      await this.source.publication(c.browser); result = { profile: TEST_PROFILE, binding: await this.binding() };
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
