import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { profileCapability } from '../contracts/v2-3-profile-save.ts';
import { APPROVED_PROFILE_CLASS, PRODUCTION_ORIGINS, isGuestStageInputV3, v3ReturnPath } from '../contracts/v2-3-profile-transfer.ts';
import { resolveExactProfile } from './identity.ts';
import {
  SENIOR_BINDING_SQL, SENIOR_CANARY, SENIOR_CCN_NAMESPACE, SENIOR_JURISDICTION, SENIOR_PARENT_SYNC,
  SENIOR_PROFILE_CLASS, SENIOR_SPECIALIST_ENTITY_ID_FORMAT, classifySeniorRows,
  parseSeniorNativeId, seniorCanaryEnabled, seniorParentSyncEnabled, seniorProfileRefCcn, seniorReturnAgrees,
  type SeniorBindingRow,
} from './senior-binding.ts';
import { isSeniorIdentity, isSeniorStage } from './senior-channel.ts';
import { SENIOR_CONTEXT_HUB, isSeniorContextCaller, seniorAccountContextSql, seniorAccountContextValues } from './senior-context-seam.ts';
import { PRODUCTION_TARGET, productionConfig } from './isolated-config.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';

// The locked contract, checked against Ask's own contract code before anything else.
assert.equal(APPROVED_PROFILE_CLASS.senior, 'cms_facility');
assert.equal(PRODUCTION_ORIGINS.senior, 'https://www.seniortrusthub.com');
assert.equal(v3ReturnPath('senior', 'burns-nursing-home-inc', '015009'), '/facility/cms/015009/burns-nursing-home-inc');
assert.equal(SENIOR_PARENT_SYNC, 'OFF');
assert.equal(SENIOR_CANARY, 'OFF');
assert.equal(seniorParentSyncEnabled(), false);
assert.equal(seniorCanaryEnabled(), false);
assert.equal(SENIOR_PROFILE_CLASS, 'cms_facility');
assert.equal(SENIOR_CCN_NAMESPACE, 'cms.ccn');
assert.equal(SENIOR_JURISDICTION, 'US');
assert.equal(SENIOR_SPECIALIST_ENTITY_ID_FORMAT, '<CMS CCN: six letters or digits>');

const CANARIES = [
  { ccn: '015009', slug: 'burns-nursing-home-inc', name: 'BURNS NURSING HOME, INC.' },
  { ccn: '055223', slug: 'san-jacinto-valley-post-acute', name: 'SAN JACINTO VALLEY POST ACUTE' },
  { ccn: '155805', slug: 'addison-pointe-health-and-rehabilitation-center', name: 'ADDISON POINTE HEALTH & REHABILITATION CENTER' },
] as const;
const UUID = '11111111-1111-4111-8111-111111111111';

function row(patch: Partial<SeniorBindingRow> = {}): SeniorBindingRow {
  return {
    id: 'binding-1', network_entity_id: 'entity-1', binding_status: 'accepted',
    specialist_entity_type: 'cms_facility', specialist_entity_id: '015009',
    identifier_namespace: 'cms.ccn', source_identifier: '015009', jurisdiction: 'US',
    entity_status: 'active', canonical_public_profile_ref: '/facility/cms/015009/burns-nursing-home-inc', ...patch,
  };
}
function denied(nativeId: string, rows: SeniorBindingRow[]) {
  const decision = classifySeniorRows(nativeId, rows);
  assert.equal(decision.outcome, 'denied');
  if (decision.outcome !== 'denied') throw new Error('expected a denial');
  return decision.reason;
}
function stage(nativeId: string, slug: string, profileClass = 'cms_facility', returnPath = `/facility/cms/${nativeId}/${slug}`) {
  const profile = { hub: 'senior' as const, nativeId, profileClass };
  return {
    version: 'v2-3/selected-profiles/3' as const, sourceHub: 'senior' as const, audience: 'ask' as const,
    selected: [{ localItemId: nativeId, revision: '1', digest: 'a'.repeat(64), profile }],
    returnTask: { kind: 'profile' as const, hub: 'senior' as const, canonicalSlug: slug, profile, returnPath },
  };
}

test('A exact CMS nursing-home CCNs are accepted; the slug and name are not the identity', () => {
  for (const canary of CANARIES) {
    assert.deepEqual(parseSeniorNativeId(canary.ccn), { ccn: canary.ccn });
    const ref = `/facility/cms/${canary.ccn}/${canary.slug}`;
    const decision = classifySeniorRows(canary.ccn, [row({ specialist_entity_id: canary.ccn, source_identifier: canary.ccn, canonical_public_profile_ref: ref })]);
    assert.equal(decision.outcome, 'eligible');
    assert.equal(seniorReturnAgrees(decision, ref), true);
    assert.equal(seniorReturnAgrees(decision, `/facility/cms/${canary.ccn}/another-name`), false);
    assert.equal(seniorProfileRefCcn(ref), canary.ccn);
    assert.equal(isSeniorStage(stage(canary.ccn, canary.slug)), true);
    assert.equal(isGuestStageInputV3(stage(canary.ccn, canary.slug)), true);
    assert.equal(isSeniorIdentity({ hub: 'senior', nativeId: canary.ccn, profileClass: 'cms_facility' }), true);
    assert.equal(parseSeniorNativeId(canary.slug), null);
    assert.equal(parseSeniorNativeId(canary.name), null);
  }
});

test('B C D wrong CCN, wrong namespace and wrong class are denied', () => {
  // B. another CCN's row answering for this CCN, in either identifier column or the profile ref.
  assert.equal(denied('015009', [row({ source_identifier: '055223' })]), 'identity_disagreement');
  assert.equal(denied('015009', [row({ specialist_entity_id: '055223' })]), 'identity_disagreement');
  assert.equal(denied('015009', [row({ canonical_public_profile_ref: '/facility/cms/055223/burns-nursing-home-inc' })]), 'identity_disagreement');
  for (const bad of ['15009', '0150090', '01500g', 'cms.ccn:015009', '', UUID, 'burns-nursing-home-inc']) assert.equal(denied(bad, [row()]), 'identity_disagreement', bad);
  // C. a state or other namespace carrying the same digits.
  for (const namespace of ['fl.ahca.license', 'tx.hhsc.facility', 'nmls', 'cms.npi', '']) assert.equal(denied('015009', [row({ identifier_namespace: namespace })]), 'identity_disagreement', namespace);
  assert.equal(denied('015009', [row({ jurisdiction: 'AL' })]), 'identity_disagreement');
  // D. any class other than cms_facility.
  for (const type of ['nursing_home', 'home_health', 'hospice', 'assisted_living', 'provider', 'organization', 'person']) assert.equal(denied('015009', [row({ specialist_entity_type: type })]), 'wrong_class', type);
  for (const profileClass of ['nursing_home', 'home_health', 'hospice', 'assisted_living', 'administrator', 'official_firm']) {
    assert.equal(isSeniorIdentity({ hub: 'senior', nativeId: '015009', profileClass }), false, profileClass);
    assert.equal(isSeniorStage(stage('015009', 'burns-nursing-home-inc', profileClass)), false, profileClass);
  }
  assert.equal(isSeniorIdentity({ hub: 'lender', nativeId: '015009', profileClass: 'cms_facility' } as never), false);
});

test('E F G H home health, hospice, assisted-living/state-class and synthetic identities are denied', async () => {
  // E/F. An agency CCN is six characters too. It is refused by class, by route and by the absence of a nursing-home binding.
  for (const [ccn, route] of [['017000', '/home-health/cms/017000/some-home-health-agency'], ['011500', '/hospice/cms/011500/some-hospice']] as const) {
    assert.equal(isSeniorStage(stage(ccn, 'agency', 'cms_facility', route)), false, route);
    assert.equal(seniorProfileRefCcn(route), null);
    assert.equal(denied(ccn, [row({ specialist_entity_id: ccn, source_identifier: ccn, canonical_public_profile_ref: route })]), 'identity_disagreement');
    assert.equal(denied(ccn, [row({ specialist_entity_id: ccn, source_identifier: ccn, specialist_entity_type: route.startsWith('/home') ? 'home_health' : 'hospice' })]), 'wrong_class');
    assert.equal(denied(ccn, []), 'missing');
  }
  // G. State-licensed classes carry state identifiers, never a bare CCN.
  for (const nativeId of ['AL12345', 'fl.ahca:11965042', 'FL-ALF-12345', 'tx.hhsc:104529', 'assisted-living/fl/9f2c', 'state-license:FL:L106287']) {
    assert.equal(parseSeniorNativeId(nativeId), null, nativeId);
    assert.equal(isSeniorIdentity({ hub: 'senior', nativeId, profileClass: 'cms_facility' }), false, nativeId);
    assert.equal(isSeniorStage(stage(nativeId, 'some-facility')), false, nativeId);
  }
  for (const route of ['/assisted-living/fl/123456/some-al', '/florida/alf/123456/some-al', '/texas/regulated-locations/alf/123456', '/facility/some-slug', '/providers/015009'])
    assert.equal(isSeniorStage(stage('015009', 'burns-nursing-home-inc', 'cms_facility', route)), false, route);
  // H. Synthetic fixtures: well-formed ids with no accepted nursing-home binding, and fixture-shaped ids.
  for (const nativeId of ['fixture-facility', 'p14-senior', 'P14-CCN', 'demo-0001', 'TEST01 ']) assert.equal(parseSeniorNativeId(nativeId), null, nativeId);
  assert.equal(denied('TEST01', []), 'missing');
  let queried = 0;
  const sql: FoundationSql = { async query<T>() { queried++; return { rows: [] as T[] }; } };
  const synthetic = { hub: 'senior' as const, nativeId: 'TEST01', profileClass: 'cms_facility' };
  const unbound = await resolveExactProfile(synthetic, { resolve: async () => ({ identity: synthetic, published: true, supportedClass: true }) }, sql);
  assert.equal(unbound?.binding, null);
  assert.equal(unbound ? profileCapability(unbound) : '', 'SAVE_LOCAL_ONLY');
  assert.equal(queried, 1);
});

test('I J K L M missing, multiple, review_required, inactive and profile-ref disagreement are denied', () => {
  assert.equal(denied('015009', []), 'missing');
  assert.equal(denied('015009', [row(), row({ id: 'binding-2', network_entity_id: 'entity-2' })]), 'ambiguous');
  assert.equal(denied('015009', [row(), row(), row()]), 'ambiguous');
  assert.equal(denied('015009', [row({ binding_status: 'review_required' })]), 'review_required');
  for (const status of ['retired', 'merged', 'inactive', '']) assert.equal(denied('015009', [row({ entity_status: status })]), 'inactive', status);
  for (const ref of ['/facility/cms/055223/san-jacinto-valley-post-acute', '/home-health/cms/015009/burns-nursing-home-inc', '/hospice/cms/015009/burns-nursing-home-inc',
    '/facility/burns-nursing-home-inc', '/providers/burns-nursing-home-inc', '/facility/cms/015009', '/facility/cms/015009/Burns Home', 'https://www.seniortrusthub.com/facility/cms/015009/burns-nursing-home-inc', ''])
    assert.equal(denied('015009', [row({ canonical_public_profile_ref: ref })]), 'identity_disagreement', ref);
  for (const status of ['pending', 'rejected', 'invalid', '']) assert.equal(denied('015009', [row({ binding_status: status })]), 'identity_disagreement', status);
});

test('a browser network UUID, a slug, a name and the wrong class are refused before any query', async () => {
  let queried = false;
  const sql: FoundationSql = { async query() { queried = true; return { rows: [] }; } };
  for (const identity of [
    { hub: 'senior' as const, nativeId: UUID, profileClass: 'cms_facility' },
    { hub: 'senior' as const, nativeId: 'burns-nursing-home-inc', profileClass: 'cms_facility' },
    { hub: 'senior' as const, nativeId: 'BURNS NURSING HOME, INC.', profileClass: 'cms_facility' },
    { hub: 'senior' as const, nativeId: '015009', profileClass: 'home_health' },
    { hub: 'senior' as const, nativeId: '015009', profileClass: 'hospice' },
  ]) {
    const profile = await resolveExactProfile(identity, { resolve: async () => ({ identity, published: true, supportedClass: true }) }, sql);
    assert.equal(profile, null);
  }
  assert.equal(queried, false);
  // A stage carrying anything beyond the closed shape, or two CCNs, is not a Senior stage.
  assert.equal(isSeniorStage({ ...stage('015009', 'burns-nursing-home-inc'), networkEntityId: UUID }), false);
  const disagreed = stage('015009', 'burns-nursing-home-inc');
  disagreed.selected[0]!.profile = { ...disagreed.selected[0]!.profile, nativeId: '055223' };
  assert.equal(isSeniorStage(disagreed), false);
  const wrongItem = stage('015009', 'burns-nursing-home-inc');
  wrongItem.selected[0]!.localItemId = 'burns-nursing-home-inc';
  assert.equal(isSeniorStage(wrongItem), false);
  const two = stage('015009', 'burns-nursing-home-inc');
  two.selected.push({ ...two.selected[0]!, localItemId: '055223', profile: { hub: 'senior', nativeId: '055223', profileClass: 'cms_facility' } });
  assert.equal(isSeniorStage(two), false);
  assert.equal(isSeniorStage({ ...stage('015009', 'burns-nursing-home-inc'), sourceHub: 'lender' }), false);
  assert.equal(isSeniorStage({ ...stage('015009', 'burns-nursing-home-inc'), version: 'v2-3/selected-profiles/2' }), false);
});

test('resolution uses the CCN function, fails closed on several rows, and does not save review_required', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const identity = { hub: 'senior' as const, nativeId: '015009', profileClass: 'cms_facility' as const };
  const registry = { resolve: async () => ({ identity, published: true, supportedClass: true }) };
  const ambiguous: FoundationSql = { async query<T>(text: string, values: unknown[]) { calls.push({ text, values }); return { rows: [row(), row({ id: 'binding-2' })] as T[] }; } };
  await assert.rejects(() => resolveExactProfile(identity, registry, ambiguous), (error: unknown) => error instanceof RuntimeError && error.code === 'conflict');
  assert.equal(calls[0]?.text, SENIOR_BINDING_SQL);
  assert.equal(String(calls[0]?.text).includes('prod_senior_ccn_binding_for'), true);
  assert.deepEqual(calls[0]?.values, ['015009']);
  const one = (r: SeniorBindingRow[]): FoundationSql => ({ async query<T>() { return { rows: r as T[] }; } });
  const accepted = await resolveExactProfile(identity, registry, one([row()]));
  assert.deepEqual(accepted?.binding, { id: 'binding-1', networkEntityId: 'entity-1', status: 'accepted' });
  assert.equal(accepted ? profileCapability(accepted) : '', 'SAVE_SUPPORTED');
  const review = await resolveExactProfile(identity, registry, one([row({ binding_status: 'review_required' })]));
  assert.equal(review?.binding?.status, 'review_required');
  assert.equal(review ? profileCapability(review) : '', 'IDENTITY_REVIEW_REQUIRED');
  for (const bad of [[], [row({ entity_status: 'retired' })], [row({ canonical_public_profile_ref: '/hospice/cms/015009/x' })], [row({ source_identifier: '055223' })], [row({ specialist_entity_type: 'hospice' })]]) {
    const profile = await resolveExactProfile(identity, registry, one(bad));
    assert.equal(profile?.binding, null);
    assert.equal(profile ? profileCapability(profile) : '', 'SAVE_LOCAL_ONLY');
  }
  // Not published by Senior: no binding is even read.
  let read = false;
  const unpublished = await resolveExactProfile(identity, { resolve: async () => ({ identity, published: false, supportedClass: true }) }, { async query() { read = true; return { rows: [] }; } });
  assert.equal(unpublished?.binding, null);
  assert.equal(read, false);
});

test('the Senior account context goes through the shared per-hub issuer, never the Move issuer', () => {
  assert.equal(SENIOR_CONTEXT_HUB, 'senior');
  assert.equal(seniorAccountContextSql(PRODUCTION_TARGET), 'select v23_private.prod_hub_issue_context($1,$2,$3,$4) as issued');
  assert.deepEqual(seniorAccountContextValues({ code: 'c' }, 'subject', 'session'), ['{"code":"c"}', 'subject', 'session', 'senior']);
  for (const hub of ['move', 'lender', 'insurance', 'contractor', 'investor', 'Senior', '']) assert.equal(isSeniorContextCaller(hub), false, hub);
  assert.equal(isSeniorContextCaller('senior'), true);
  const assembly = readFileSync(new URL('./preview-assembly.ts', import.meta.url), 'utf8');
  const seam = readFileSync(new URL('./senior-context-seam.ts', import.meta.url), 'utf8');
  assert.match(assembly, /isSeniorContextCaller\(a\.caller\.hub\)\s*\? await db\.query<\{ issued: boolean \}>\(seniorAccountContextSql\(this\.target\), seniorAccountContextValues\(proof, p\.subject, p\.sessionBinding\)\)/);
  // Every other hub still uses the unchanged three-argument issuer.
  assert.equal(assembly.includes("`select ${sqlName(this.target, 'issue_context')}($1,$2,$3) as issued`"), true);
  for (const text of [assembly, seam]) assert.equal(/prod_senior_issue_context|senior_issue_context|prod_investor/.test(text), false);
  assert.equal(assembly.split('hub_issue_context').length - 1, 0, 'the shared issuer is named only in the seam');
  const config = productionConfig({ VERCEL_ENV: 'production' });
  assert.equal(config, null, 'production hand-off stays gated by its own explicit flags');
});

test('packet 17 is prepared only: preflight, binding forward/rollback, authority forward/rollback', () => {
  const read = (name: string) => readFileSync(new URL('../../../docs/my-trusthub/v2/production/' + name, import.meta.url), 'utf8');
  const preflight = read('17-ask-prod-senior-ccn-preflight.sql');
  const forward = read('17-ask-prod-senior-ccn-binding-forward.sql');
  const rollback = read('17-ask-prod-senior-ccn-binding-rollback.sql');
  const authority = read('17-ask-prod-senior-authority-forward.sql');
  const authorityRollback = read('17-ask-prod-senior-authority-rollback.sql');
  for (const canary of CANARIES) {
    for (const text of [preflight, forward, rollback]) {
      assert.equal(text.includes(`'${canary.ccn}'`), true, canary.ccn);
      assert.equal(text.includes(`/facility/cms/${canary.ccn}/${canary.slug}`), true, canary.slug);
    }
    assert.equal(forward.includes(canary.name.replace("'", "''")), true);
  }
  // Preflight is read only and covers every hold.
  assert.equal(/\b(insert|update|delete|create|alter|drop|grant|revoke)\b/i.test(preflight.replace(/^--.*$/gm, '')), false);
  assert.match(preflight, /identifier_namespace is distinct from 'cms\.ccn'/);
  assert.equal(preflight.includes('canonical_public_profile_ref'), true);
  assert.equal(preflight.includes('having count(*) > 1'), true);
  assert.equal(preflight.includes("binding_status = 'review_required'"), true);
  assert.equal(preflight.includes("binding_status = 'accepted'"), true);
  assert.equal(preflight.includes('v23_private.authority()'), true);
  // Forward: exactly three receipts, exact identity, resolver created, nothing fuzzy.
  for (const text of [forward, authority, authorityRollback, rollback]) assert.equal(text.includes("'qvvxvbcdmbjzrgvwjatw'"), true);
  assert.equal(forward.includes('NOT APPLIED'), true);
  assert.equal(forward.includes('n <> 3'), true);
  assert.equal(forward.includes('prod_senior_ccn_binding_for'), true);
  assert.equal(forward.includes("'senior', 'cms_facility'"), true);
  assert.equal(forward.includes("'cms.ccn'"), true);
  assert.equal(/ilike|similarity|levenshtein|lower\(canonical_name\)|canonical_name\s*=/.test(forward), false);
  assert.match(forward, /select ccn, binding_id, network_entity_id, canonical_public_profile_ref/);
  // Binding rollback: one receipt row, closes the window, never deletes, leaves Saved research.
  assert.equal(/\bdelete\b/i.test(rollback.replace(/^--.*$/gm, '')), false);
  assert.equal(rollback.includes('valid_to = clock_timestamp()'), true);
  assert.equal(rollback.includes('affected <> 1'), true);
  assert.equal(rollback.includes('consumer.consumer_saved_entities'), true);
  // Authority: one token added and removed, no shared account-context SQL.
  assert.equal(authority.includes("'senior'"), true);
  assert.equal(authorityRollback.includes("'senior'"), true);
  for (const text of [preflight, forward, rollback, authority, authorityRollback]) {
    assert.equal(/issue_context|consume_context|create_consumer_auth_handoff/.test(text.replace(/^--.*$/gm, '')), false, 'no account-context SQL in packet 17');
    assert.equal(/home_health|hospice|assisted/.test(text.replace(/^--.*$/gm, '')), false);
  }
});
