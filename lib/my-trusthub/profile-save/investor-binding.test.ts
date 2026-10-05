import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { profileCapability } from '../contracts/v2-3-profile-save.ts';
import { APPROVED_PROFILE_CLASS, PRODUCTION_ORIGINS, TRANSFER_VERSION_V3, isGuestStageInput, manifestDigest, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import { resolveExactProfile } from './identity.ts';
import {
  INVESTOR_BINDING_SQL, INVESTOR_CRD_NAMESPACE, INVESTOR_PROFILE_CLASS, classifyInvestorRows, investorNativeId,
  investorReturnPath, parseInvestorNativeId, type InvestorBindingRow,
} from './investor-binding.ts';
import { INVESTOR_SOURCE_PATH, InvestorSourceChannel, investorPinsFor, isInvestorOfficialFirmIdentity, isInvestorOfficialFirmStage } from './investor-channel.ts';
import { ASSERTION_HEADER, INVESTOR_PRODUCTION_PINS, signInvestorAssertion, verifyInvestorAssertion } from './investor-assertion.ts';
import { signLenderAssertion } from './lender-assertion.ts';
import { ISOLATED_TARGET, PRODUCTION_TARGET, productionConfig } from './isolated-config.ts';
import { signAssertion } from './service-assertion.ts';
import type { FoundationSql } from './p12-p13.ts';

const CANARIES = [
  { crd: '106176', slug: 'sec-crd-106176' },
  { crd: '104571', slug: 'sec-crd-104571' },
  { crd: '110441', slug: 'sec-crd-110441' },
] as const;
const browser = 'b'.repeat(43);

function row(patch: Partial<InvestorBindingRow> = {}): InvestorBindingRow {
  return {
    id: 'binding-1',
    network_entity_id: 'entity-1',
    binding_status: 'accepted',
    specialist_entity_type: 'official_firm',
    specialist_entity_id: 'crd-106176',
    identifier_namespace: 'sec.crd',
    source_identifier: '106176',
    jurisdiction: 'US',
    entity_status: 'active',
    canonical_public_profile_ref: '/firm/sec-crd-106176',
    ...patch,
  };
}
function stage(crd: string, patch: (m: GuestStageInput) => void = () => {}): GuestStageInput {
  const profile = { hub: 'investor' as const, nativeId: `crd-${crd}`, profileClass: 'official_firm' };
  const slug = `sec-crd-${crd}`;
  const manifest: GuestStageInput = { version: TRANSFER_VERSION_V3, sourceHub: 'investor', audience: 'ask',
    selected: [{ localItemId: slug, revision: '1', digest: 'a'.repeat(64), profile }],
    returnTask: { kind: 'profile', hub: 'investor', canonicalSlug: slug, profile, returnPath: `/firm/${slug}` } };
  patch(manifest);
  return manifest;
}
function keys(kid = 'investor-test') {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: { kid, pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid, pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
}
function nonces() {
  const seen = new Set<string>();
  return { claim: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; } };
}
function deniedReason(nativeId: string, rows: InvestorBindingRow[]) {
  const decision = classifyInvestorRows(nativeId, rows);
  assert.equal(decision.outcome, 'denied');
  if (decision.outcome !== 'denied') throw new Error('expected a denial');
  return decision.reason;
}

test('locked identity contract: official_firm / sec.crd / crd-<CRD> / US / /firm/sec-crd-<CRD>', () => {
  assert.equal(INVESTOR_PROFILE_CLASS, 'official_firm');
  assert.equal(APPROVED_PROFILE_CLASS.investor, INVESTOR_PROFILE_CLASS);
  assert.equal(INVESTOR_CRD_NAMESPACE, 'sec.crd');
  assert.equal(PRODUCTION_ORIGINS.investor, 'https://www.investortrusthub.com');
  for (const c of CANARIES) {
    assert.equal(investorNativeId(c.crd), `crd-${c.crd}`);
    assert.equal(parseInvestorNativeId(`crd-${c.crd}`), c.crd);
    assert.equal(investorReturnPath(c.crd), `/firm/${c.slug}`);
  }
  for (const bad of ['', '0', '0123', '12a', '12345678901', ' 106176']) assert.equal(investorNativeId(bad), null, bad);
  for (const bad of ['106176', 'crd-0', 'crd-0106176', 'crd:106176', 'CRD-106176', 'sec-crd-106176', 'crd-106176 ', 'nmls:106176', 'usdot-106176',
    '11111111-1111-4111-8111-111111111111', 'WEINBERGER ASSET MANAGEMENT, INC']) assert.equal(parseInvestorNativeId(bad), null, bad);
});

test('exact accepted firm CRD binding is eligible and a repeated read is the same row', () => {
  for (const c of CANARIES) {
    const exact = row({ specialist_entity_id: `crd-${c.crd}`, source_identifier: c.crd, canonical_public_profile_ref: `/firm/${c.slug}` });
    const once = classifyInvestorRows(`crd-${c.crd}`, [exact]);
    const twice = classifyInvestorRows(`crd-${c.crd}`, [exact]);
    assert.deepEqual(once, { outcome: 'eligible', id: 'binding-1', networkEntityId: 'entity-1' });
    assert.deepEqual(twice, once);
  }
});

test('missing, ambiguous, review_required, wrong class, inactive and every disagreement are denied', () => {
  assert.equal(deniedReason('crd-106176', []), 'missing');
  assert.equal(deniedReason('crd-106176', [row(), row({ id: 'binding-2' })]), 'ambiguous');
  assert.equal(deniedReason('crd-106176', [row({ binding_status: 'review_required' })]), 'review_required');
  assert.equal(deniedReason('crd-106176', [row({ entity_status: 'retired' })]), 'inactive');
  assert.equal(deniedReason('crd-106176', [row({ entity_status: 'review_required' })]), 'inactive');
  // Not the firm grain: an individual adviser, a branch, a state observation.
  for (const type of ['representative', 'individual_adviser', 'branch_office', 'state_adviser_firm', 'organization']) {
    assert.equal(deniedReason('crd-106176', [row({ specialist_entity_type: type })]), 'wrong_class', type);
  }
  for (const patch of [
    { source_identifier: '104571' }, { specialist_entity_id: 'crd-104571' }, { identifier_namespace: 'CRD' }, { identifier_namespace: 'nmls' },
    { identifier_namespace: 'finra.crd' }, { jurisdiction: 'CA' }, { jurisdiction: '' }, { binding_status: 'superseded' }, { binding_status: 'invalid' },
    { canonical_public_profile_ref: '/firm/sec-crd-104571' }, { canonical_public_profile_ref: '/firm/weinberger-asset-management' }, { canonical_public_profile_ref: null },
    // A firms-row UUID is never the native id.
    { specialist_entity_id: '11111111-1111-4111-8111-111111111111' },
  ] as Partial<InvestorBindingRow>[]) assert.equal(deniedReason('crd-106176', [row(patch)]), 'identity_disagreement', JSON.stringify(patch));
  for (const bad of ['sec-crd-106176', '106176', 'crd-0', '11111111-1111-4111-8111-111111111111']) assert.equal(deniedReason(bad, [row()]), 'identity_disagreement', bad);
});

test('investor resolution uses the CRD function only; review_required is not a Save; several rows are a conflict', async () => {
  const identity = { hub: 'investor' as const, nativeId: 'crd-106176', profileClass: 'official_firm' };
  const publication = { resolve: async () => ({ identity, published: true, supportedClass: true }) };
  const sqlFor = (rows: InvestorBindingRow[], calls: Array<{ text: string; values: unknown[] }> = []): FoundationSql & { calls: typeof calls } => ({
    calls, async query<T>(text: string, values: unknown[]) { calls.push({ text, values }); return { rows: rows as T[] }; } });
  const accepted = sqlFor([row()]);
  const profile = await resolveExactProfile(identity, publication, accepted);
  assert.equal(accepted.calls.length, 1);
  assert.equal(accepted.calls[0]!.text, INVESTOR_BINDING_SQL);
  assert.deepEqual(accepted.calls[0]!.values, ['crd-106176']);
  assert.deepEqual(profile?.binding, { id: 'binding-1', networkEntityId: 'entity-1', status: 'accepted' });
  assert.equal(profile ? profileCapability(profile) : '', 'SAVE_SUPPORTED');
  const review = await resolveExactProfile(identity, publication, sqlFor([row({ binding_status: 'review_required' })]));
  assert.equal(review?.binding?.status, 'review_required');
  assert.equal(review ? profileCapability(review) : '', 'IDENTITY_REVIEW_REQUIRED');
  for (const rows of [[], [row({ source_identifier: '104571' })], [row({ specialist_entity_type: 'representative' })], [row({ canonical_public_profile_ref: '/firm/other' })]]) {
    const denied = await resolveExactProfile(identity, publication, sqlFor(rows));
    assert.equal(denied?.binding, null);
    assert.notEqual(denied ? profileCapability(denied) : '', 'SAVE_SUPPORTED');
  }
  await assert.rejects(() => resolveExactProfile(identity, publication, sqlFor([row(), row({ id: 'binding-2' })])), /conflict/);
  // Unpublished or unsupported: no binding read at all.
  const unpublished = sqlFor([row()]);
  const hidden = await resolveExactProfile(identity, { resolve: async () => ({ identity, published: false, supportedClass: true }) }, unpublished);
  assert.equal(unpublished.calls.length, 0);
  assert.equal(hidden?.binding, null);
  // Another Investor class, or a malformed native id, never reaches the generic table query.
  for (const other of [{ ...identity, profileClass: 'representative' }, { ...identity, nativeId: 'sec-crd-106176' }, { ...identity, nativeId: '11111111-1111-4111-8111-111111111111' }]) {
    const probe = sqlFor([row()]);
    assert.equal(await resolveExactProfile(other, { resolve: async () => ({ identity: other, published: true, supportedClass: true }) }, probe), null);
    assert.equal(probe.calls.length, 0);
  }
});

test('Move and Lender resolution are unchanged', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const sql: FoundationSql = { async query<T>(text: string, values: unknown[]) { calls.push({ text, values });
    return { rows: [{ id: 'binding', network_entity_id: 'canonical', binding_status: 'accepted' }] as T[] }; } };
  const move = { hub: 'move' as const, nativeId: 'usdot-1002530', profileClass: 'mover' };
  const profile = await resolveExactProfile(move, { resolve: async () => ({ identity: move, published: true, supportedClass: true }) }, sql);
  assert.deepEqual(calls[0]!.values, ['move', 'usdot-1002530', 'mover']);
  assert.equal(profile?.binding?.status, 'accepted');
  const lender = { hub: 'lender' as const, nativeId: 'nmls:1984721', profileClass: 'marketplace_company' };
  await resolveExactProfile(lender, { resolve: async () => ({ identity: lender, published: true, supportedClass: true }) }, sql);
  assert.match(calls[1]!.text, /prod_lender_nmls_binding_for/);
});

test('only the exact official-firm manifest for a CRD is an Investor stage', () => {
  for (const c of CANARIES) {
    const manifest = stage(c.crd);
    assert.equal(isGuestStageInput(manifest), true);
    assert.equal(isInvestorOfficialFirmStage(manifest), true);
    assert.match(manifestDigest(manifest), /^[a-f0-9]{64}$/);
  }
  const tampered: Array<(m: GuestStageInput) => void> = [
    m => { m.returnTask.canonicalSlug = 'sec-crd-104571'; }, // slug of another firm
    m => { (m.returnTask as { returnPath: string }).returnPath = '/firm/sec-crd-104571'; },
    m => { m.returnTask.canonicalSlug = 'weinberger-asset-management'; (m.returnTask as { returnPath: string }).returnPath = '/firm/weinberger-asset-management'; m.selected[0]!.localItemId = 'weinberger-asset-management'; },
    m => { m.returnTask.profile = { ...m.returnTask.profile, nativeId: 'crd-104571' }; },
    m => { m.selected[0]!.profile = { ...m.selected[0]!.profile, nativeId: 'crd-104571' }; },
    m => { m.returnTask.profile = { ...m.returnTask.profile, profileClass: 'representative' }; m.selected[0]!.profile = { ...m.selected[0]!.profile, profileClass: 'representative' }; },
    m => { m.returnTask.profile = { ...m.returnTask.profile, nativeId: '11111111-1111-4111-8111-111111111111' }; m.selected[0]!.profile = { ...m.returnTask.profile }; },
    m => { m.selected.push({ ...m.selected[0]!, localItemId: 'second' }); },
    m => { m.selected[0]!.localItemId = 'other'; },
    m => { (m as { sourceHub: string }).sourceHub = 'lender'; },
    m => { (m as { version: string }).version = 'v2-3/selected-profiles/2'; },
  ];
  for (const [index, patch] of tampered.entries()) assert.equal(isInvestorOfficialFirmStage(stage('106176', patch)), false, 'case ' + index);
  assert.equal(isInvestorOfficialFirmIdentity({ hub: 'investor', nativeId: 'crd-106176', profileClass: 'official_firm' }), true);
  assert.equal(isInvestorOfficialFirmIdentity({ hub: 'lender', nativeId: 'crd-106176', profileClass: 'official_firm' }), false);
});

test('investor assertion round-trips; unsigned, tampered, replayed, Move and Lender tokens are refused', async () => {
  const now = 1_700_000_000_000;
  const pair = keys();
  const target = INVESTOR_PRODUCTION_PINS.parentOrigin + '/api/my-trusthub/profile-save';
  const body = Buffer.from(JSON.stringify({ nativeId: 'crd-106176', returnPath: '/firm/sec-crd-106176' }));
  const token = signInvestorAssertion(pair.privateKey, 'investor', target, 'transfer:stage', body, browser, null, null, now);
  const request = (b = body, headers: Record<string, string> = { [ASSERTION_HEADER]: token }) => new Request(target, { method: 'POST', headers, body: b });
  const store = nonces();
  const claims = await verifyInvestorAssertion(request(), body, pair.publicKey, 'investor', 'transfer:stage', store, now);
  assert.equal(claims.investor_origin, 'https://www.investortrusthub.com');
  assert.equal(claims.ask_origin, 'https://www.asktrusthub.com');
  assert.equal(claims.iss, 'urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:investor');
  assert.equal(claims.sub, 'svc:trusthub:investor:v23:production');
  assert.equal(claims.exp - claims.iat, 30);
  await assert.rejects(() => verifyInvestorAssertion(request(), body, pair.publicKey, 'investor', 'transfer:stage', store, now)); // replay
  const tampered = Buffer.from(JSON.stringify({ nativeId: 'crd-104571', returnPath: '/firm/sec-crd-106176' }));
  await assert.rejects(() => verifyInvestorAssertion(request(tampered), tampered, pair.publicKey, 'investor', 'transfer:stage', nonces(), now));
  await assert.rejects(() => verifyInvestorAssertion(request(body, {}), body, pair.publicKey, 'investor', 'transfer:stage', nonces(), now));
  await assert.rejects(() => verifyInvestorAssertion(request(), body, keys().publicKey, 'investor', 'transfer:stage', nonces(), now));
  await assert.rejects(() => verifyInvestorAssertion(request(), body, pair.publicKey, 'investor', 'receipt:verify', nonces(), now));
  await assert.rejects(() => verifyInvestorAssertion(request(), body, pair.publicKey, 'investor', 'transfer:stage', nonces(), now + 31_000));
  // The same key cannot pass a Lender or Move token off as Investor.
  const lenderToken = signLenderAssertion(pair.privateKey, 'lender', target, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifyInvestorAssertion(request(body, { [ASSERTION_HEADER]: lenderToken }), body, pair.publicKey, 'investor', 'transfer:stage', nonces(), now));
  const isolated = ISOLATED_TARGET.parentOrigin + '/api/my-trusthub/profile-save';
  const moveToken = signAssertion(pair.privateKey, 'move', isolated, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifyInvestorAssertion(new Request(isolated, { method: 'POST', headers: { [ASSERTION_HEADER]: moveToken }, body }), body, pair.publicKey, 'investor', 'transfer:stage', nonces(), now));
  // Ask only signs toward the pinned Investor origin.
  assert.throws(() => signInvestorAssertion(pair.privateKey, 'ask', 'https://evil.example' + INVESTOR_SOURCE_PATH, 'source:read', body, browser));
});

test('Ask re-proves publication with Investor over a signed call and accepts only the exact canonical profile', async () => {
  const ask = keys('ask-test');
  const identity = { hub: 'investor' as const, nativeId: 'crd-106176', profileClass: 'official_firm' };
  const good = { identity, canonicalSlug: 'sec-crd-106176', publicationState: 'PUBLISHABLE', reviewedClass: 'official_firm' };
  const seen: Array<{ url: string; body: unknown; verified: boolean }> = [];
  const channelFor = (answer: () => unknown, status = 200) => new InvestorSourceChannel(ask.privateKey, (async (url: string, init: RequestInit) => {
    const bytes = Buffer.from(init.body as Uint8Array);
    let verified = true;
    try { await verifyInvestorAssertion(new Request(url, { method: 'POST', headers: init.headers as Record<string, string>, body: bytes }), bytes, ask.publicKey, 'ask', 'source:read', nonces()); } catch { verified = false; }
    seen.push({ url, body: JSON.parse(bytes.toString('utf8')), verified });
    return Response.json({ ok: true, result: answer() }, { status });
  }) as typeof fetch);
  const proof = await channelFor(() => ({ ...good, checkedAt: Date.now() })).publication(browser, identity);
  assert.equal(proof.canonicalSlug, 'sec-crd-106176');
  assert.deepEqual(seen[0], { url: 'https://www.investortrusthub.com/api/my-trusthub/profile-save/source', body: { action: 'resolve', profile: identity }, verified: true });
  for (const bad of [
    { ...good, canonicalSlug: 'sec-crd-104571' }, { ...good, canonicalSlug: 'weinberger-asset-management' },
    { ...good, identity: { ...identity, nativeId: 'crd-104571' } }, { ...good, identity: { ...identity, profileClass: 'representative' } },
    { ...good, publicationState: 'INGESTED' }, { ...good, reviewedClass: 'state_adviser_firm' },
  ]) await assert.rejects(() => channelFor(() => ({ ...bad, checkedAt: Date.now() })).publication(browser, identity), /unavailable/);
  await assert.rejects(() => channelFor(() => ({ ...good, checkedAt: Date.now() - 60_000 })).publication(browser, identity), /unavailable/);
  await assert.rejects(() => channelFor(() => ({ ...good, checkedAt: Date.now() }), 503).publication(browser, identity), /unavailable/);
  // A non-firm identity is refused before any call is made.
  const before = seen.length;
  await assert.rejects(() => channelFor(() => good).publication(browser, { ...identity, nativeId: 'sec-crd-106176' }), /unavailable/);
  await assert.rejects(() => channelFor(() => good).publication(browser, { ...identity, profileClass: 'representative' }), /unavailable/);
  assert.equal(seen.length, before);
});

test('production only: the Investor origin is in the production registry and pins never apply to a preview target', () => {
  assert.equal(investorPinsFor(ISOLATED_TARGET), null);
  assert.deepEqual(investorPinsFor(PRODUCTION_TARGET), INVESTOR_PRODUCTION_PINS);
  const production = productionConfig({ VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
    MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
    MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: 'https://www.asktrusthub.com',
    NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://qvvxvbcdmbjzrgvwjatw.supabase.co',
    MY_TRUSTHUB_V23_PARENT_ORIGIN: 'https://www.asktrusthub.com', MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com',
    MY_TRUSTHUB_V23_PRODUCTION_PROJECT: 'qvvxvbcdmbjzrgvwjatw', MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated' });
  assert.ok(production);
  assert.equal(production.registry.origins.investor, 'https://www.investortrusthub.com');
  assert.equal(production.registry.origins.contractor, 'https://www.contractortrusthub.com');
  assert.equal(production.registry.origins.senior, '');
});
