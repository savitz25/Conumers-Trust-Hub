/**
 * ATH-CLAIM-V2-FLNJ-001 — Ask accepts FL + NJ Contractor V2 handoffs; everything else fails closed.
 * Real store on PGlite with the real migrations. No production connection. No real customer data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform, ClaimError, monitoringSourceSupported } from './store.ts';
import { MonitoringError } from './monitoring.ts';
import { HandoffError, mintHandoffToken, mutateHandoffToken, parseAndAuthenticateHandoff } from './handoff.ts';
import { validateContractorAdapter, validateCustomerProfile } from './adapter.ts';
import { selectCthCredential, type CthCredentialRow } from './cth-credential-select.ts';
import { CONTRACTOR_CLAIMABLE_CREDENTIALS, contractorClaimState, contractorCredentialPairAllowed } from './types.ts';
import { evaluateClaimPolicy } from '../control-plane/claim-policy.ts';
import { buildMyTrustHubHome } from './my-trust-hub.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';
import type { SqlClient } from './sql.ts';
import type { MailMessage } from './mail.ts';

const SECRET = 'ath-claim-v2-flnj-001-ask-secret-at-least-32-chars';
const FL: CustomerProfileRecord = { id: '11111111-1111-4111-8111-111111111111', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc015082-acme-roofing', displayName: 'Acme Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC015082', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc015082-acme-roofing' };
// Shapes mirror real Contractor production rows (2026-09-24 inventory).
const NJ_HIC: CustomerProfileRecord = { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1', hubId: 'contractor', entityClass: 'contractor', slug: 'nj-nj-hic-13vh00000001-example-improvements-llc', displayName: 'Example Improvements LLC', isThin: false, publicationEligible: true, homeState: 'NJ', licenseState: 'NJ', externalKey: 'NJ-HIC:13VH00000001', sourceSystem: 'nj_dca', canonicalUrl: 'https://www.contractortrusthub.com/contractors/nj-nj-hic-13vh00000001-example-improvements-llc' };
const NJ_ELE: CustomerProfileRecord = { ...NJ_HIC, id: 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaa2', slug: 'nj-nj-ele-34eb00000002-example-electric-llc', displayName: 'Example Electric LLC', externalKey: 'NJ-ELE:34EB00000002', canonicalUrl: 'https://www.contractortrusthub.com/contractors/nj-nj-ele-34eb00000002-example-electric-llc' };
const NJ_THIN: CustomerProfileRecord = { ...NJ_HIC, id: 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaa3', slug: 'nj-thin', isThin: true, publicationEligible: false, externalKey: 'NJ-HIC:13VH00000003', canonicalUrl: 'https://www.contractortrusthub.com/contractors/nj-thin' };
const PROFILES = [FL, NJ_HIC, NJ_ELE, NJ_THIN];
const directory: CustomerProfileDirectory = { async getExact(p) { return PROFILES.find((x) => x.hubId === p.hub_id && x.id === p.native_profile_id) ?? null; } };

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: new Date('2026-09-24T14:00:00Z') };
  const mailbox: MailMessage[] = [];
  const platform = new CustomerPlatform({ sql, cth: directory, mailer: async (m) => { mailbox.push(m); return { sent: true, preview: m.text }; }, handoffSecret: SECRET, staffEmails: ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  return { db, sql, platform, clock, mailbox };
}
const mint = (p: CustomerProfileRecord, o: Partial<Parameters<typeof mintHandoffToken>[1]> = {}) => mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: p.id, slug: p.slug, externalKey: p.externalKey, sourceSystem: p.sourceSystem, homeState: p.homeState, identifierNamespace: 'credential', entityClass: 'contractor', canonicalProfileUrl: p.canonicalUrl, displayName: p.displayName, version: 2, now: new Date('2026-09-24T13:59:00Z'), ...o });
const receipt = () => `receipt-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }
const intents = async (sql: SqlClient) => Number((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_intents`)).rows[0].n);
const governed = { evidenceCodes: ['CORPORATE_OFFICER_MATCH', 'VERIFIED_PUBLIC_CALLBACK'] as const, evidenceNote: 'NJ business entity officer match confirmed independently; callback completed on a pre-existing public number.', internalRationale: 'Independent authority plus independently validated control satisfies the Contractor standard for a New Jersey registrant.', claimantMessage: 'Ask Trust Hub verified authority through independent business records and contact verification.', reasonCategory: 'AUTHORITY_VERIFIED' as const };

test('allow-list: FL:fl_dbpr and NJ:nj_dca only; research-only and out-of-state sources map to no claim state', () => {
  assert.deepEqual(CONTRACTOR_CLAIMABLE_CREDENTIALS, { FL: ['fl_dbpr'], NJ: ['nj_dca'] });
  for (const s of ['nj_sos', 'nj_enforcement', 'nj_dca_construction_permits', 'ct_dcp', 'va_dpor', 'ca_cslb', 'pa_ag', 'oh_dcp', 'tx_tdlr', '', null, undefined]) assert.equal(contractorClaimState(s), null, String(s));
  assert.equal(contractorCredentialPairAllowed('nj_dca', 'NJ'), true); assert.equal(contractorCredentialPairAllowed('nj_dca', 'FL'), false); assert.equal(contractorCredentialPairAllowed('fl_dbpr', 'NJ'), false);
  assert.equal(monitoringSourceSupported('contractor', 'fl_dbpr'), true); assert.equal(monitoringSourceSupported('contractor', 'nj_dca'), false); assert.equal(monitoringSourceSupported('move', 'fmcsa'), true);
});

test('handoff completeness: NJ (nj_dca, NJ) and FL tokens authenticate; any other pair or state is malformed', () => {
  for (const p of [FL, NJ_HIC, NJ_ELE]) assert.equal(parseAndAuthenticateHandoff(SECRET, mint(p).token, new Date('2026-09-24T14:00:00Z')).external_key, p.externalKey);
  for (const [name, o] of [['nj_dca+FL', { sourceSystem: 'nj_dca', homeState: 'FL' }], ['fl_dbpr+NJ', { sourceSystem: 'fl_dbpr', homeState: 'NJ' }], ['TX', { sourceSystem: 'tx_tdlr', homeState: 'TX' }], ['nj_dca+TX', { sourceSystem: 'nj_dca', homeState: 'TX' }], ['ct_dcp+NJ', { sourceSystem: 'ct_dcp', homeState: 'NJ' }]] as Array<[string, Partial<Parameters<typeof mintHandoffToken>[1]>]>) {
    assert.throws(() => parseAndAuthenticateHandoff(SECRET, mint(NJ_HIC, o).token, new Date('2026-09-24T14:00:00Z')), (e: unknown) => e instanceof HandoffError && e.code === 'malformed', name);
  }
});

test('exact-identity validation: NJ accepted; wrong source / credential / UUID / cross-state substitution / unsupported state / thin all fail closed', () => {
  const ok = validateCustomerProfile(mint(NJ_HIC).payload, NJ_HIC); assert.equal(ok.ok, true);
  const cases: Array<[string, HandoffPayload, CustomerProfileRecord | null, string]> = [
    ['NJ wrong source', mint(NJ_HIC, { sourceSystem: 'fl_dbpr', homeState: 'FL' }).payload, NJ_HIC, 'unsupported_source'],
    ['NJ wrong credential', mint(NJ_HIC, { externalKey: 'NJ-HIC:13VH99999999' }).payload, NJ_HIC, 'credential_mismatch'],
    ['NJ wrong UUID', mint({ ...NJ_HIC, id: '99999999-9999-4999-8999-999999999999' }).payload, null, 'missing_profile'],
    ['NJ token presented for the FL profile (NJ->FL substitution)', mint({ ...FL, sourceSystem: 'nj_dca', homeState: 'NJ' }).payload, FL, 'unsupported_source'],
    ['FL token presented for the NJ profile (FL->NJ substitution)', mint({ ...NJ_HIC, sourceSystem: 'fl_dbpr', homeState: 'FL' }).payload, NJ_HIC, 'unsupported_source'],
    ['NJ credential on a profile recorded outside NJ', mint(NJ_HIC).payload, { ...NJ_HIC, homeState: 'PA', licenseState: 'PA' }, 'unsupported_state'],
    ['thin / research-only', mint(NJ_THIN).payload, NJ_THIN, 'thin_profile'],
    ['wrong slug', mint({ ...NJ_HIC, slug: 'nj-other' }).payload, NJ_HIC, 'slug_mismatch'],
  ];
  for (const [name, payload, profile, code] of cases) { const r = validateCustomerProfile(payload, profile); assert.equal(r.ok, false, name); if (!r.ok) assert.equal(r.code, code, name); }
  // Legacy bare-directory adapter keeps the same rules.
  const legacy = { id: NJ_HIC.id, slug: NJ_HIC.slug, displayName: NJ_HIC.displayName, isThin: false, homeState: 'NJ', licenseState: 'NJ', externalKey: NJ_HIC.externalKey, sourceSystem: 'nj_dca' };
  assert.equal(validateContractorAdapter(mint(NJ_HIC).payload, legacy).ok, true);
  const bad = validateContractorAdapter(mint(NJ_HIC, { homeState: 'FL' }).payload, legacy); assert.equal(bad.ok, false); if (!bad.ok) assert.equal(bad.code, 'unsupported_state');
  const tx = validateContractorAdapter(mint(NJ_HIC, { sourceSystem: 'tx_tdlr', homeState: 'TX' }).payload, legacy); assert.equal(tx.ok, false); if (!tx.ok) assert.equal(tx.code, 'unsupported_source');
});

test('CTH re-read: the credential named in the handoff is selected exactly; FL rule unchanged; NJ only when FL does not apply; query is allow-listed and read-only', () => {
  const row = (o: Partial<CthCredentialRow>): CthCredentialRow => ({ id: NJ_HIC.id, slug: NJ_HIC.slug, display_name: NJ_HIC.displayName, is_thin_profile: false, home_state: 'NJ', license_state: 'NJ', external_key: NJ_HIC.externalKey, source_system: 'nj_dca', ...o });
  const rows = [row({ external_key: 'CBC000001', source_system: 'fl_dbpr', license_state: 'NJ' }), row({}), row({ external_key: 'NJ-ELE:34EB00000002' })];
  assert.equal(selectCthCredential(rows, { sourceSystem: 'nj_dca', externalKey: 'NJ-ELE:34EB00000002' })?.external_key, 'NJ-ELE:34EB00000002', 'named credential wins');
  assert.equal(selectCthCredential(rows)?.external_key, NJ_HIC.externalKey, 'no hint: best FL row fails the FL rule -> NJ');
  assert.equal(selectCthCredential(rows, { sourceSystem: 'nj_dca', externalKey: 'NJ-HIC:13VH99999999' })?.external_key, NJ_HIC.externalKey, 'unknown credential -> deterministic default, adapter then reports the mismatch');
  assert.equal(selectCthCredential([row({ id: FL.id, home_state: 'FL', external_key: 'CBC015082', source_system: 'fl_dbpr', license_state: 'FL' }), row({ id: FL.id, home_state: 'FL' })])?.external_key, 'CBC015082', 'FL first');
  assert.equal(selectCthCredential([]), null);
  const cthRead = readFileSync('lib/customer/cth-read.ts', 'utf8');
  const sql = cthRead.match(/const PROFILE_SQL = `([\s\S]*?)`;/)?.[1] ?? '';
  assert.match(sql, /l\.source_system IN \('fl_dbpr', 'nj_dca'\)/); assert.doesNotMatch(sql, /nj_sos|nj_enforcement|ct_dcp|INSERT|UPDATE|DELETE/);
  assert.match(cthRead, /assertReadOnlyCthSql\(PROFILE_SQL\)/);
  assert.match(readFileSync('lib/customer/specialist-read.ts', 'utf8'), /getById\(p\.native_profile_id,\{sourceSystem:p\.source_system,externalKey:p\.external_key\}\)/);
});

test('NJ claim flow: passive receipt = 0 intents; Continue = exactly 1; submit lands in the manual human queue; weak evidence cannot approve', async () => {
  const { db, sql, platform } = await boot();
  const { token } = mint(NJ_HIC, { nonce: 'nj-flow-nonce' });
  for (let i = 0; i < 25; i += 1) { const r = await platform.receiveHandoff(token); assert.equal(r.payload.home_state, 'NJ'); assert.equal(r.payload.source_system, 'nj_dca'); }
  assert.equal(await intents(sql), 0);
  const rid = receipt();
  const c1 = await platform.confirmClaimIntent({ token, receiptId: rid, acquisitionSource: 'organic' });
  const c2 = await platform.confirmClaimIntent({ token, receiptId: rid, acquisitionSource: 'organic' });
  assert.equal(c1.created, true); assert.equal(c2.created, false); assert.equal(await intents(sql), 1);
  const owner = await signup(platform, 'owner@example-improvements.example');
  await assert.rejects(() => platform.submitClaim({ sessionToken: owner.sessionToken, intentId: c1.intentId, relationshipType: 'owner', credentialAttestation: 'NJ-HIC:13VH00000009', authorized: true }), (e: unknown) => e instanceof ClaimError && e.code === 'credential_mismatch', 'attestation must equal the NJ credential');
  const claim = await platform.submitClaim({ sessionToken: owner.sessionToken, intentId: c1.intentId, relationshipType: 'owner', credentialAttestation: 'nj-hic:13vh00000001', authorized: true });
  assert.equal(claim.status, 'submitted');
  const hub = (await sql.query<{ native_source_system: string; home_state: string; native_credential_key: string }>(`SELECT native_source_system, home_state, native_credential_key FROM ath_hub_profiles WHERE native_profile_id=$1`, [NJ_HIC.id])).rows[0];
  assert.deepEqual(hub, { native_source_system: 'nj_dca', home_state: 'NJ', native_credential_key: NJ_HIC.externalKey }, 'no migration needed: generic source/state persisted');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_review_queue WHERE object_id=$1 AND status='open'`, [claim.claimId])).rows[0].n, '1', 'manual human queue');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_management_grants`)).rows[0].n, '0', 'no auto approval');
  const staff = await signup(platform, 'staff@asktrusthub.com');
  await assert.rejects(() => platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', evidenceCodes: ['COMPANY_DOMAIN_CONTROL', 'CREDENTIAL_KNOWLEDGE'], evidenceNote: 'Only company-domain email and knowledge of the NJ registration number were available.', internalRationale: 'Governance must block approval on weak-only evidence for New Jersey too.', claimantMessage: 'Additional verification is required before access can be granted.', reasonCategory: 'AUTHORITY_VERIFIED' }), (e: unknown) => e instanceof ClaimError && e.code === 'authority_standard_not_met');
  // Control-plane policy engine finds a cell for NJ (jurisdiction wildcard) and needs strong + control evidence.
  assert.equal(evaluateClaimPolicy({ hub: 'contractor', profileClass: 'contractor', jurisdiction: 'NJ', relationship: 'owner', evidence: ['COMPANY_DOMAIN_CONTROL', 'CREDENTIAL_KNOWLEDGE'], competingClaims: 0, activeGrant: false, identityRevalidated: true }).result, 'AMBER');
  assert.equal(evaluateClaimPolicy({ hub: 'contractor', profileClass: 'contractor', jurisdiction: 'NJ', relationship: 'owner', evidence: [...governed.evidenceCodes], competingClaims: 0, activeGrant: false, identityRevalidated: true }).result, 'GREEN');
  await db.close();
});

test('synthetic NJ: human approval -> grant -> owner saves website/hours -> public business layer; official evidence untouched; monitoring unavailable', async () => {
  const { db, sql, platform } = await boot();
  const c = await platform.confirmClaimIntent({ token: mint(NJ_ELE, { nonce: 'nj-ele-nonce' }).token, receiptId: receipt(), acquisitionSource: 'organic' });
  const owner = await signup(platform, 'owner@example-electric.example');
  const claim = await platform.submitClaim({ sessionToken: owner.sessionToken, intentId: c.intentId, relationshipType: 'owner', credentialAttestation: NJ_ELE.externalKey, authorized: true });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  await platform.startReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId, evidenceReady: true });
  await platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', ...governed, evidenceCodes: [...governed.evidenceCodes] });
  const grant = (await sql.query<{ id: string; status: string }>(`SELECT id, status FROM ath_management_grants`)).rows;
  assert.equal(grant.length, 1); assert.equal(grant[0].status, 'active');
  // Owner experience: My Trust Hub, business-supplied fields, publication.
  const home = await platform.managedHome(owner.sessionToken); assert.equal(home.length, 1);
  const saved = await platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: NJ_ELE.id, body: { version: 0, fields: { website: 'https://example-electric.example', public_phone: '(201) 555-0100' }, services: ['Electrical'], serviceAreas: ['Bergen County'], languages: ['English'], hours: [{ weekday: 1, closed: false, opensAt: '07:00', closesAt: '16:00' }] } });
  assert.equal(saved.version, 1);
  const pub = await platform.publicBusinessProfile('contractor', NJ_ELE.id);
  assert.ok(pub, 'business-supplied layer projected under the active grant');
  assert.equal((await platform.publicBusinessReplies('contractor', NJ_ELE.id)).replies.length, 0);
  // Official evidence: Ask never writes to the specialist directory and stores no NJ credential state beyond the exact identity snapshot.
  assert.equal(JSON.stringify(await directory.getExact(mint(NJ_ELE).payload)), JSON.stringify(NJ_ELE));
  // Monitoring honesty: cannot be enabled for an NJ DCA profile; My Trust Hub reports it unavailable.
  await assert.rejects(() => platform.saveMonitoring({ sessionToken: owner.sessionToken, nativeProfileId: NJ_ELE.id, body: { version: 0, enabled: true, emailEnabled: true, inAppEnabled: true } }), (e: unknown) => e instanceof MonitoringError && e.code === 'forbidden');
  const built = buildMyTrustHubHome({ profiles: [{ hub_id: 'contractor', native_profile_id: NJ_ELE.id, org_id: claim.orgId, display_name_snapshot: NJ_ELE.displayName, native_source_system: 'nj_dca', monitoring_enabled: false, business_field_count: 2, business_item_category_count: 2, business_hours_present: true, last_confirmed_at: null, role: 'owner' }], claims: [], organizations: [], activity: [], now: new Date('2026-09-24T15:00:00Z') });
  assert.equal(built.profiles[0].monitoringStatus, 'UNAVAILABLE');
  assert.equal(built.attentionItems.some((a) => a.type === 'MONITORING_DISABLED'), false, 'no "turn on monitoring" nudge for NJ');
  const fl = buildMyTrustHubHome({ profiles: [{ hub_id: 'contractor', native_profile_id: FL.id, org_id: claim.orgId, display_name_snapshot: FL.displayName, native_source_system: 'fl_dbpr', monitoring_enabled: false, business_field_count: 0, business_item_category_count: 0, business_hours_present: false, last_confirmed_at: null, role: 'owner' }], claims: [], organizations: [], activity: [] });
  assert.equal(fl.profiles[0].monitoringStatus, 'OFF', 'FL unchanged');
  await db.close();
});

test('FL flow unchanged end to end (regression guard for the state-aware refactor)', async () => {
  const { db, sql, platform } = await boot();
  const { token } = mint(FL, { nonce: 'fl-regression-nonce' });
  await platform.receiveHandoff(token); assert.equal(await intents(sql), 0);
  const c = await platform.confirmClaimIntent({ token, receiptId: receipt(), acquisitionSource: 'organic' }); assert.equal(await intents(sql), 1);
  const owner = await signup(platform, 'owner@acme-roofing.example');
  const claim = await platform.submitClaim({ sessionToken: owner.sessionToken, intentId: c.intentId, relationshipType: 'owner', credentialAttestation: 'CBC015082', authorized: true });
  const hub = (await sql.query<{ native_source_system: string; home_state: string }>(`SELECT native_source_system, home_state FROM ath_hub_profiles WHERE native_profile_id=$1`, [FL.id])).rows[0];
  assert.deepEqual(hub, { native_source_system: 'fl_dbpr', home_state: 'FL' });
  assert.equal(claim.status, 'submitted');
  // v1 legacy tokens remain FL-only.
  const v1 = mutateHandoffToken(mint(FL, { version: 1 }).token, (p) => ({ ...p, home_state: 'NJ' }), SECRET);
  await assert.rejects(() => platform.receiveHandoff(v1), (e: unknown) => e instanceof HandoffError && e.code === 'unsupported_state');
  await db.close();
});

test('staff surfaces: NJ manual-review callout and unavailable-monitoring card are wired; FL wording is not forced onto NJ', () => {
  const admin = readFileSync('app/admin/operations/claims/[claimId]/page.tsx', 'utf8');
  assert.match(admin, /New Jersey credential — MANUAL AUTHORITY REVIEW/); assert.match(admin, /native_source_system\) === "nj_dca"/);
  const manage = readFileSync('app/manage/[profileId]/page.tsx', 'utf8');
  assert.match(manage, /monitoringSourceSupported\(model\.access\.hub_id/); assert.match(manage, /covers Florida DBPR records only/);
  assert.match(readFileSync('lib/customer/copy.ts', 'utf8'), /'nj_dca'\?'New Jersey DCA'/);
});
