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
import { verifyInsuranceAssertion, insurancePinsFor } from './insurance-assertion.ts';
import { INSURANCE_BINDING_SQL, classifyInsuranceRows, parseInsuranceSpecialistEntityId, type InsuranceBindingRow } from './insurance-binding.ts';
import { guestStageFromInsuranceManifest, isClosedInsuranceManifest, isInsuranceProviderStage } from './insurance-manifest.ts';
import type { InsuranceAckChannel } from './insurance-channel.ts';
import { verifyInvestorAssertion } from './investor-assertion.ts';
import { InvestorSourceChannel, isInvestorOfficialFirmIdentity, isInvestorOfficialFirmStage, investorPinsFor } from './investor-channel.ts';
import { INVESTOR_BINDING_SQL, classifyInvestorRows, investorCanonicalSlug, investorReturnPath, parseInvestorNativeId, type InvestorBindingRow } from './investor-binding.ts';
import { verifySeniorAssertion } from './senior-assertion.ts';
import { SeniorSourceChannel, seniorPinsFor, isSeniorIdentity, isSeniorStage } from './senior-channel.ts';
import { SENIOR_BINDING_SQL, classifySeniorRows, parseSeniorNativeId, type SeniorBindingRow } from './senior-binding.ts';
import { verifyContractorAssertion } from './contractor-assertion.ts';
import { ContractorSourceChannel, contractorPinsFor, isContractorIdentity, isContractorStage } from './contractor-channel.ts';
import { CONTRACTOR_BINDING_SQL, classifyContractorRows, parseContractorNativeId, type ContractorBindingRow } from './contractor-binding.ts';
import { PRODUCTION_ORIGINS } from '../contracts/v2-3-profile-transfer.ts';
import type { BrowserBindings, BrowserParent, SourceSnapshot } from './browser.ts';
import type { TransactionPool } from './postgres-backend.ts';
import type { P13Proof } from './p12-p13.ts';
import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import { isGuestStageInput, manifestDigest, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import type { Operation } from './interface.ts';
import { PRIVATE_HEADERS } from './http.ts';
import { accountContextIssueQuery } from './hub-account-context.ts';

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
  insuranceKey: AssertionKey | null = null;
  insuranceSource: InsuranceAckChannel | null = null;
  investorKey: AssertionKey | null = null;
  investorSource: InvestorSourceChannel | null = null;
  seniorKey: AssertionKey | null = null;
  seniorSource: SeniorSourceChannel | null = null;
  contractorKey: AssertionKey | null = null;
  contractorSource: ContractorSourceChannel | null = null;
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
  /** Exact state-license binding. Zero, several, review_required, or any
   * disagreement is not eligible. The license comes from the signed manifest. */
  async insuranceBinding(profile: ProfileIdentity, db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']> & { canonicalPublicProfileRef: string }> {
    if (!parseInsuranceSpecialistEntityId(profile.nativeId) || profile.hub !== 'insurance') throw new RuntimeError('unavailable');
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const found = await d.query<InsuranceBindingRow>(INSURANCE_BINDING_SQL, [profile.nativeId]);
      const decision = classifyInsuranceRows(profile.nativeId, found.rows);
      if (decision.outcome !== 'eligible') throw new RuntimeError('unavailable');
      return { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' as const, canonicalPublicProfileRef: decision.canonicalPublicProfileRef };
    };
    return db ? query(db) : this.store.authorized(query);
  }
  /** Exact official-firm binding. Zero, several, review_required, or any
   * disagreement is not eligible. The CRD comes from the signed manifest. */
  async investorBinding(profile: ProfileIdentity, db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']>> {
    if (!isInvestorOfficialFirmIdentity(profile)) throw new RuntimeError('unavailable');
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const found = await d.query<InvestorBindingRow>(INVESTOR_BINDING_SQL, [profile.nativeId]);
      const decision = classifyInvestorRows(profile.nativeId, found.rows);
      if (decision.outcome !== 'eligible') throw new RuntimeError('unavailable');
      return { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' as const };
    };
    return db ? query(db) : this.store.authorized(query);
  }
  /** Exact CMS CCN binding for one nursing-home profile. Zero, several,
   * review_required, inactive, or any disagreement is not eligible. The CCN
   * comes from the signed manifest, never from the browser. */
  async seniorBinding(profile: ProfileIdentity, db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']> & { canonicalPublicProfileRef: string }> {
    if (!parseSeniorNativeId(profile.nativeId) || profile.hub !== 'senior' || profile.profileClass !== 'cms_facility') throw new RuntimeError('unavailable');
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const found = await d.query<SeniorBindingRow>(SENIOR_BINDING_SQL, [profile.nativeId]);
      const decision = classifySeniorRows(profile.nativeId, found.rows);
      if (decision.outcome !== 'eligible') throw new RuntimeError('unavailable');
      return { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' as const, canonicalPublicProfileRef: decision.canonicalPublicProfileRef };
    };
    return db ? query(db) : this.store.authorized(query);
  }
  /** Exact Florida DBPR binding. Zero, several, review_required, inactive, or
   * any disagreement is not eligible. The license comes from the signed manifest. */
  async contractorBinding(profile: ProfileIdentity, db?: Awaited<ReturnType<TransactionPool['connect']>>): Promise<NonNullable<TrustedProfile['binding']> & { canonicalPublicProfileRef: string }> {
    if (!parseContractorNativeId(profile.nativeId) || profile.hub !== 'contractor' || profile.profileClass !== 'contractor_profile') throw new RuntimeError('unavailable');
    const query = async (d: Pick<NonNullable<typeof db>, 'query'>) => {
      const found = await d.query<ContractorBindingRow>(CONTRACTOR_BINDING_SQL, [profile.nativeId]);
      const decision = classifyContractorRows(profile.nativeId, found.rows);
      if (decision.outcome !== 'eligible') throw new RuntimeError('unavailable');
      return { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' as const, canonicalPublicProfileRef: decision.canonicalPublicProfileRef };
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
        // The context is consumed as the verified caller's hub, so it is issued for
        // that hub. The hub is a.caller.hub, which the server set from the verified
        // specialist assertion and the stored stage. It is never a browser field
        // and never a key of this proof. Move keeps issue_context. Investor keeps
        // investor_issue_context. Lender, Insurance, Contractor, and Senior use
        // hub_issue_context. Packet 18 admits senior. Any other hub fails closed
        // before a statement is sent.
        const hub = a.caller.hub;
        const issue = accountContextIssueQuery(this.target, hub);
        const issued = await db.query<{ issued: boolean }>(issue.text, issue.hubArgument
          ? [JSON.stringify(proof), p.subject, p.sessionBinding, hub]
          : [JSON.stringify(proof), p.subject, p.sessionBinding]);
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
        if (identity.hub === 'lender') {
          if (!isLenderMarketplaceIdentity(identity) || !this.lenderSource) return null;
          await this.lenderSource.publication(browser, identity);
          return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding: await this.lenderBinding(identity, db) };
        }
        if (identity.hub === 'investor') {
          if (!isInvestorOfficialFirmIdentity(identity) || !this.investorSource) return null;
          await this.investorSource.publication(browser, identity);
          return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding: await this.investorBinding(identity, db) };
        }
        if (identity.hub === 'senior') {
          if (!isSeniorIdentity(identity) || !this.seniorSource) return null;
          const proof = await this.seniorSource.publication(browser, identity);
          const binding = await this.seniorBinding(identity, db);
          // The stored profile ref, Senior's fresh proof and the CCN must name one route.
          if (binding.canonicalPublicProfileRef !== `/facility/cms/${identity.nativeId}/${proof.canonicalSlug}`) throw new RuntimeError('unavailable');
          return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding };
        }
        if (identity.hub === 'contractor') {
          if (!isContractorIdentity(identity) || !this.contractorSource) return null;
          const proof = await this.contractorSource.publication(browser, identity);
          const binding = await this.contractorBinding(identity, db);
          if (binding.canonicalPublicProfileRef !== `/contractors/${proof.canonicalSlug}`) throw new RuntimeError('unavailable');
          return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding };
        }
        if (identity.hub !== 'insurance' || !parseInsuranceSpecialistEntityId(identity.nativeId) || identity.profileClass !== 'insurance_provider') return null;
        const binding = await this.insuranceBinding(identity, db);
        return { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass, published: true, supportedClass: true, binding };
      },
      // The return path is the specialist's canonical profile for this identity.
      returnTask: async (identity, db) => {
        if (identity.hub === 'move') {
          if (!supportedMoveProfile(identity)) return null;
          const slug = (await this.publication(browser, identity)).canonicalSlug;
          return { kind: 'profile', hub: 'move', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: `/companies/${slug}` };
        }
        if (identity.hub === 'lender') {
          if (!isLenderMarketplaceIdentity(identity) || !this.lenderSource) return null;
          const slug = (await this.lenderSource.publication(browser, identity)).canonicalSlug;
          return { kind: 'profile', hub: 'lender', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: `/lenders/${slug}` };
        }
        if (identity.hub === 'investor') {
          if (!isInvestorOfficialFirmIdentity(identity) || !this.investorSource) return null;
          // The return path is fixed by the CRD; Investor must agree on the slug.
          const crd = parseInvestorNativeId(identity.nativeId)!;
          const slug = (await this.investorSource.publication(browser, identity)).canonicalSlug;
          if (slug !== investorCanonicalSlug(crd)) return null;
          return { kind: 'profile', hub: 'investor', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: investorReturnPath(crd) };
        }
        if (identity.hub === 'senior') {
          if (!isSeniorIdentity(identity) || !this.seniorSource) return null;
          // The return path is built from Senior's fresh proof for this exact CCN.
          // The binding's stored profile ref is checked against the same proof in
          // profile() above, inside the stage and commit transaction, so no second
          // pooled connection is opened here.
          const proof = await this.seniorSource.publication(browser, identity);
          const slug = proof.canonicalSlug;
          const ref = `/facility/cms/${identity.nativeId}/${slug}`;
          return { kind: 'profile', hub: 'senior', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: ref };
        }
        if (identity.hub === 'contractor') {
          if (!isContractorIdentity(identity) || !this.contractorSource) return null;
          const proof = await this.contractorSource.publication(browser, identity);
          const ref = (await this.contractorBinding(identity, db)).canonicalPublicProfileRef;
          if (ref !== `/contractors/${proof.canonicalSlug}`) throw new RuntimeError('unavailable');
          const slug = ref.slice('/contractors/'.length);
          return { kind: 'profile', hub: 'contractor', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: ref };
        }
        if (identity.hub !== 'insurance' || !parseInsuranceSpecialistEntityId(identity.nativeId)) return null;
        const ref = (await this.insuranceBinding(identity, db)).canonicalPublicProfileRef;
        const slug = ref.slice('/providers/'.length);
        return { kind: 'profile', hub: 'insurance', profile: { hub: identity.hub, nativeId: identity.nativeId, profileClass: identity.profileClass }, canonicalSlug: slug, returnPath: ref };
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
        const insurance = origin === PRODUCTION_ORIGINS.insurance;
        const investor = Boolean(this.investorSource) && origin === PRODUCTION_ORIGINS.investor;
        const senior = Boolean(this.seniorSource) && origin === PRODUCTION_ORIGINS.senior;
        const contractor = Boolean(this.contractorSource) && origin === PRODUCTION_ORIGINS.contractor;
        if (!move && !lender && !insurance && !investor && !senior && !contractor) return null;
        const link = await this.store.read<StageLink & { requestPrefix?: string }>('continuation:' + ref);
        // A continuation is read only for the hub that staged it. One arriving from
        // another hub's origin is refused here, before any specialist is called, so
        // no hub ever receives another hub's continuation or manifest.
        const arriving = move ? 'move' : lender ? 'lender' : insurance ? 'insurance' : investor ? 'investor' : senior ? 'senior' : 'contractor';
        if (link?.manifest && link.manifest.sourceHub !== arriving) return null;
        if (insurance) {
          if (!link || link.expiresAt <= Date.now() || !link.manifest || !isInsuranceProviderStage(link.manifest)) return null;
          if (!link.requestPrefix || !opaque(link.requestPrefix) || manifestDigest(link.manifest) !== link.manifestDigest) return null;
          return { continuationRef: ref, transferRef: link.transferRef, manifest: link.manifest, manifestDigest: link.manifestDigest,
            browserProof: link.browser, expiresAt: link.expiresAt, requestPrefix: link.requestPrefix };
        }
        if (!link || link.expiresAt <= Date.now()) return null;
        // A Senior hand-off is accepted only from the Senior origin, and the Senior
        // origin carries only Senior hand-offs. No other hub is contacted for it.
        if ((link.manifest?.sourceHub === 'senior') !== senior) return null;
        const channel = senior ? this.seniorSource! : lender ? this.lenderSource! : investor ? this.investorSource! : contractor ? this.contractorSource! : this.source;
        const sourceBody = (lender || investor || senior || contractor) && link.manifest
          ? { action: 'source', continuationRef: ref, transferRef: link.transferRef, manifest: link.manifest, manifestDigest: link.manifestDigest, expiresAt: link.expiresAt }
          : { action: 'source', continuationRef: ref };
        const s = await channel.call(sourceBody, 'source:read', link.browser) as SourceSnapshot;
        if (!s || s.browserProof !== link.browser || s.transferRef !== link.transferRef || s.manifestDigest !== link.manifestDigest ||
          s.expiresAt > link.expiresAt || !isGuestStageInput(s.manifest) || manifestDigest(s.manifest) !== link.manifestDigest) return null;
        if (move && s.manifest.selected.some(i => !supportedMoveProfile(i.profile))) return null;
        if (lender && !isLenderMarketplaceStage(s.manifest)) return null;
        if (investor && !isInvestorOfficialFirmStage(s.manifest)) return null;
        if (senior && (!isSeniorStage(s.manifest) || !s.requestPrefix || s.requestPrefix !== s.browserProof)) return null;
        if (contractor && (!isContractorStage(s.manifest) || !s.requestPrefix || s.requestPrefix !== s.browserProof)) return null;
        return s;
      },
      acknowledge: async (s, receipts, p) => {
        if (!equal(await this.parent(request), p)) throw new RuntimeError('unauthorized');
        if (s.manifest.sourceHub === 'insurance') {
          // Insurance reports an account outcome only on this signed call.
          if (!this.insuranceSource) throw new RuntimeError('unavailable');
          await this.insuranceSource.acknowledge(s.continuationRef, receipts, s.browserProof, hash(p.session));
          return;
        }
        const channel = s.manifest.sourceHub === 'lender' ? this.lenderSource : s.manifest.sourceHub === 'investor' ? this.investorSource : s.manifest.sourceHub === 'senior' ? this.seniorSource : s.manifest.sourceHub === 'contractor' ? this.contractorSource : this.source;
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
      const insuranceProfile = !!profile && profile.hub === 'insurance' && parseInsuranceSpecialistEntityId(profile.nativeId) !== null;
      const investorProfile = !!profile && isInvestorOfficialFirmIdentity(profile);
      const seniorProfile = !!profile && isSeniorIdentity(profile);
      const contractorProfile = !!profile && isContractorIdentity(profile);
      if (!this.removeSaved || selected.length !== 1 || (!moveProfile && !lenderProfile && !insuranceProfile && !investorProfile && !seniorProfile && !contractorProfile) ||
        !equal(await this.parent(r), p) || !await this.store.live(p.subject, p.session)) throw new RuntimeError('unauthorized');
      const networkEntityId = moveProfile ? (await this.binding(profile)).networkEntityId
        : lenderProfile ? (await this.lenderBinding(profile!)).networkEntityId
        : investorProfile ? (await this.investorBinding(profile!)).networkEntityId
        : seniorProfile ? (await this.seniorBinding(profile!)).networkEntityId
        : contractorProfile ? (await this.contractorBinding(profile!)).networkEntityId
        : (await this.insuranceBinding(profile!)).networkEntityId;
      const outcome = await this.removeSaved(p, networkEntityId);
      return outcome === 'in_project' ? 'in_project' : outcome ? 'removed' : 'not_saved';
    };
    binding.runtime = async (r, c, p) => {
      if (!c.contextCandidateRef || !equal(await this.parent(r), p) || !equal(c.parent ?? null, p)) throw new RuntimeError('unauthorized');
      const sourceHub = c.source.manifest.sourceHub;
      if (sourceHub !== 'move' && sourceHub !== 'lender' && sourceHub !== 'insurance' && sourceHub !== 'investor' && sourceHub !== 'contractor' && sourceHub !== 'senior') throw new RuntimeError('unauthorized');
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
    let serviceHub: 'move' | 'lender' | 'insurance' | 'investor' | 'contractor' | 'senior' = 'move';
    try {
      claims = await verifyAssertion(request, bytes, this.moveKey, 'move', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), this.target);
    } catch (moveError) {
      try {
        if (!this.lenderKey || !lenderPinsFor(this.target)) throw moveError;
        claims = await verifyLenderAssertion(request, bytes, this.lenderKey, 'lender', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), lenderPinsFor(this.target)!);
        serviceHub = 'lender';
      } catch (lenderError) {
        try {
          if (!this.insuranceKey || !insurancePinsFor(this.target)) throw lenderError;
          claims = await verifyInsuranceAssertion(request, bytes, this.insuranceKey, 'insurance', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), insurancePinsFor(this.target)!);
          serviceHub = 'insurance';
        } catch (insuranceError) {
          try {
            if (!this.contractorKey || !contractorPinsFor(this.target)) throw insuranceError;
            claims = await verifyContractorAssertion(request, bytes, this.contractorKey, 'contractor', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), contractorPinsFor(this.target)!);
            serviceHub = 'contractor';
          } catch (contractorError) {
            try {
              // Investor keeps its own verifier. Senior follows it and uses only its own key.
              if (!this.investorKey || !this.investorSource || !investorPinsFor(this.target)) throw contractorError;
              claims = await verifyInvestorAssertion(request, bytes, this.investorKey, 'investor', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), investorPinsFor(this.target)!);
              serviceHub = 'investor';
            } catch (investorError) {
              if (!this.seniorKey || !seniorPinsFor(this.target)) throw investorError;
              claims = await verifySeniorAssertion(request, bytes, this.seniorKey, 'senior', stage ? 'transfer:stage' : 'receipt:verify', this.store, Date.now(), seniorPinsFor(this.target)!);
              serviceHub = 'senior';
            }
          }
        }
      }
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
        if (serviceHub === 'insurance' && !isInsuranceProviderStage(input)) throw new RuntimeError('invalid');
        if (serviceHub === 'investor' && !isInvestorOfficialFirmStage(input)) throw new RuntimeError('invalid');
        if (serviceHub === 'contractor' && !isContractorStage(input)) throw new RuntimeError('invalid');
        if (serviceHub === 'senior' && !isSeniorStage(input)) throw new RuntimeError('invalid');
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
        const stored = serviceHub === 'insurance' ? { ...link, requestPrefix: link.browser } : link;
        await this.store.put('continuation:' + cont.continuationRef, stored, cont.expiresAt, true);
      }
      return result;
    };
    return rt;
  }
  /** One signed Insurance manifest becomes the existing guest stage. The browser
   * does not choose the state, the license, or the network entity. Parent sync
   * stays off, so this does not call Insurance. */
  async acceptInsuranceManifest(request: Request): Promise<{ transferRef: string; manifestDigest: string; continuationRef: string; expiresAt: number } | null> {
    const pins = insurancePinsFor(this.target);
    if (!this.insuranceKey || !pins) return null;
    if (new URL(request.url).pathname !== API_PATH || request.headers.has('origin')) throw new RuntimeError('unauthorized');
    const bytes = await boundedBody(request, 65536);
    let manifest: unknown;
    try { manifest = JSON.parse(bytes.toString('utf8')); } catch { throw new RuntimeError('invalid'); }
    if (!isClosedInsuranceManifest(manifest)) throw new RuntimeError('invalid');
    const claims = await verifyInsuranceAssertion(request, bytes, this.insuranceKey, 'insurance', 'transfer:stage', this.store, Date.now(), pins);
    if (claims.session !== null || claims.grant !== null) throw new RuntimeError('unauthorized');
    const stageInput = guestStageFromInsuranceManifest(manifest);
    if (!isInsuranceProviderStage(stageInput)) throw new RuntimeError('invalid');
    const who: VerifiedCaller = { hub: 'insurance', browserBinding: claims.browser, environment: this.target.kind, scopes: ['transfer:stage'] };
    const rt = new ParentProfileSaveRuntime({ enabled: true, registry: this.config.registry,
      backend: new AuthorizedPostgresBackend(this.ports(async a => JSON.stringify(a.caller) === JSON.stringify(who), claims.browser)),
      authenticate: async () => who });
    const prepared = await rt.execute('prepareGuestProfileTransfer', stageInput) as Link;
    // Request keys start with the browser proof Insurance signed, so Insurance can
    // tie the acknowledgement to the handoff it staged (same rule as Lender).
    const link = { ...prepared, browser: claims.browser, manifest: stageInput, requestPrefix: claims.browser };
    await this.store.put('stage:' + link.transferRef, link, link.expiresAt, true);
    const cont = await rt.execute('prepareProfileSaveContinuation', {
      sourceHub: 'insurance', audience: 'ask', transferRef: prepared.transferRef, manifestDigest: prepared.manifestDigest,
    }) as { continuationRef: string; expiresAt: number };
    await this.store.put('continuation:' + cont.continuationRef, link, cont.expiresAt, true);
    return { transferRef: prepared.transferRef, manifestDigest: prepared.manifestDigest, continuationRef: cont.continuationRef, expiresAt: cont.expiresAt };
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
