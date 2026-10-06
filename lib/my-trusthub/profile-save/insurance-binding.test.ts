import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { profileCapability } from '../contracts/v2-3-profile-save.ts';
import { manifestDigest } from '../contracts/v2-3-profile-transfer.ts';
import { handleProfileSave } from './http.ts';
import { resolveExactProfile } from './identity.ts';
import { signInsuranceAssertion, verifyInsuranceAssertion } from './insurance-assertion.ts';
import {
  INSURANCE_BINDING_SQL, INSURANCE_CANARY, INSURANCE_PARENT_SYNC, INSURANCE_SPECIALIST_ENTITY_ID_FORMAT,
  classifyInsuranceRows, insuranceCanaryEnabled, insuranceParentSyncEnabled, insuranceSpecialistEntityId,
  parseInsuranceSpecialistEntityId, type InsuranceBindingRow,
} from './insurance-binding.ts';
import {
  guestStageFromInsuranceManifest, insuranceProfileDigest, isClosedInsuranceManifest, isInsuranceProviderStage,
} from './insurance-manifest.ts';
import { ASSERTION_HEADER } from './service-assertion.ts';
import type { FoundationSql } from './p12-p13.ts';

assert.equal(INSURANCE_PARENT_SYNC, 'OFF');
assert.equal(INSURANCE_CANARY, 'OFF');
assert.equal(insuranceParentSyncEnabled(), false);
assert.equal(insuranceCanaryEnabled(), false);
assert.equal(INSURANCE_SPECIALIST_ENTITY_ID_FORMAT, 'state-license:<STATE>:<COMPACT_LICENSE>');

const CANARIES = [
  { jurisdiction: 'FL', license: 'L106287', slug: 'asfin-llc-l106287' },
  { jurisdiction: 'TX', license: '1365714', slug: 'imt-services-llc-1365714' },
  { jurisdiction: 'TX', license: '9982', slug: 'bailey-insurance-risk-management-inc-9982' },
] as const;

function manifestFor(jurisdiction: string, license: string, slug: string) {
  const profile = {
    hub: 'insurance' as const,
    profileClass: 'insurance_provider' as const,
    identifierNamespace: 'insurance.state_license' as const,
    sourceIdentifier: license,
    jurisdiction,
    canonicalReturnPath: `/providers/${slug}` as const,
  };
  return {
    version: 'v2-3/selected-profiles/3' as const,
    sourceHub: 'insurance' as const,
    audience: 'ask' as const,
    selected: [{ localItemId: slug, revision: '1' as const, digest: insuranceProfileDigest(profile), profile }],
    returnTask: { kind: 'profile' as const, hub: 'insurance' as const, canonicalSlug: slug, profile, canonicalReturnPath: profile.canonicalReturnPath },
  };
}

function row(patch: Partial<InsuranceBindingRow> = {}): InsuranceBindingRow {
  return {
    id: 'binding-1', network_entity_id: 'entity-1', binding_status: 'accepted',
    specialist_entity_type: 'insurance_provider', specialist_entity_id: 'state-license:FL:L106287',
    identifier_namespace: 'insurance.state_license', source_identifier: 'L106287', jurisdiction: 'FL',
    entity_status: 'active', canonical_public_profile_ref: '/providers/asfin-llc-l106287', ...patch,
  };
}

function denied(nativeId: string, rows: InsuranceBindingRow[]) {
  const decision = classifyInsuranceRows(nativeId, rows);
  assert.equal(decision.outcome, 'denied');
  if (decision.outcome !== 'denied') throw new Error('expected a denial');
  return decision.reason;
}

test('FL, TX, and OH exact state licenses are accepted', () => {
  for (const canary of CANARIES) {
    const nativeId = insuranceSpecialistEntityId(canary.jurisdiction, canary.license);
    assert.equal(nativeId, `state-license:${canary.jurisdiction}:${canary.license}`);
    const decision = classifyInsuranceRows(nativeId!, [row({
      specialist_entity_id: nativeId!, source_identifier: canary.license, jurisdiction: canary.jurisdiction,
      canonical_public_profile_ref: `/providers/${canary.slug}`,
    })]);
    assert.equal(decision.outcome, 'eligible');
  }
});

test('wrong state, wrong license, a second row, review, namespace, UUID, and slug are denied', () => {
  assert.equal(denied('state-license:TX:L106287', []), 'missing');
  assert.equal(denied('state-license:FL:L000999', []), 'missing');
  assert.equal(denied('state-license:FL:L106287', [row(), row({ id: 'binding-2' })]), 'ambiguous');
  assert.equal(denied('state-license:FL:L106287', [row({ binding_status: 'review_required' })]), 'review_required');
  assert.equal(denied('state-license:FL:L106287', [row({ identifier_namespace: 'naic' })]), 'identity_disagreement');
  assert.equal(denied('state-license:FL:L106287', [row({ jurisdiction: 'TX' })]), 'identity_disagreement');
  assert.equal(denied('state-license:FL:L106287', [row({ source_identifier: '999' })]), 'identity_disagreement');
  assert.equal(denied('state-license:FL:L106287', [row({ specialist_entity_type: 'legal_insurer' })]), 'wrong_class');
  assert.equal(denied('state-license:FL:L106287', [row({ entity_status: 'retired' })]), 'inactive');
  assert.equal(denied('11111111-1111-4111-8111-111111111111', [row()]), 'identity_disagreement');
  assert.equal(denied('asfin-llc-l106287', [row()]), 'identity_disagreement');
  assert.equal(parseInsuranceSpecialistEntityId('asfin-llc-l106287'), null);
  assert.equal(parseInsuranceSpecialistEntityId('11111111-1111-4111-8111-111111111111'), null);
});

test('insurance resolution uses the state-license function and does not save review_required', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const sql: FoundationSql = {
    async query<T>(text: string, values: unknown[]) {
      calls.push({ text, values });
      return { rows: [row({ binding_status: 'review_required' })] as T[] };
    },
  };
  const identity = { hub: 'insurance' as const, nativeId: 'state-license:FL:L106287', profileClass: 'insurance_provider' };
  const profile = await resolveExactProfile(identity, {
    resolve: async () => ({ identity, published: true, supportedClass: true }),
  }, sql);
  assert.equal(calls[0]?.text, INSURANCE_BINDING_SQL);
  assert.deepEqual(calls[0]?.values, ['state-license:FL:L106287']);
  assert.equal(profile?.binding?.status, 'review_required');
  assert.equal(profile ? profileCapability(profile) : '', 'IDENTITY_REVIEW_REQUIRED');
});

test('legal_insurer / NAIC stays on the original binding query', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const sql: FoundationSql = {
    async query<T>(text: string, values: unknown[]) {
      calls.push({ text, values });
      return { rows: [{ id: 'naic-binding', network_entity_id: 'naic-entity', binding_status: 'accepted' }] as T[] };
    },
  };
  const identity = { hub: 'insurance' as const, nativeId: 'naic:10064', profileClass: 'legal_insurer' };
  const profile = await resolveExactProfile(identity, {
    resolve: async () => ({ identity, published: true, supportedClass: true }),
  }, sql);
  assert.equal(calls.length, 1);
  assert.equal(String(calls[0]?.text).includes('prod_insurance_state_license_binding_for'), false);
  assert.deepEqual(calls[0]?.values, ['insurance', 'naic:10064', 'legal_insurer']);
  assert.equal(profile?.binding?.status, 'accepted');
  assert.equal(profile ? profileCapability(profile) : '', 'SAVE_SUPPORTED');
});

test('a provider UUID is not queried and a slug is not an identity', async () => {
  let queried = false;
  const sql: FoundationSql = { async query() { queried = true; return { rows: [] }; } };
  for (const nativeId of ['11111111-1111-4111-8111-111111111111', 'asfin-llc-l106287']) {
    const identity = { hub: 'insurance' as const, nativeId, profileClass: 'insurance_provider' };
    const profile = await resolveExactProfile(identity, {
      resolve: async () => ({ identity, published: true, supportedClass: true }),
    }, sql);
    assert.equal(profile, null);
  }
  assert.equal(queried, false);
});

test('the signed closed manifest derives the state license and rejects tamper, UUID, and slug identity', async () => {
  const pair = generateKeyPairSync('ed25519');
  const key = {
    privateKey: { kid: 'insurance-test', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'insurance-test', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
  const browser = 'b'.repeat(43);
  const now = Date.now();
  const seen = new Set<string>();
  const nonces = { claim: async (ref: string) => { if (seen.has(ref)) return false; seen.add(ref); return true; } };
  const body = Buffer.from(JSON.stringify(manifestFor('FL', 'L106287', 'asfin-llc-l106287')));
  const target = 'https://www.asktrusthub.com/api/my-trusthub/profile-save';
  const token = signInsuranceAssertion(key.privateKey, 'insurance', target, 'transfer:stage', body, browser, null, null, now);
  const request = new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token } });
  const claims = await verifyInsuranceAssertion(request, body, key.publicKey, 'insurance', 'transfer:stage', nonces, now);
  assert.equal(claims.iss, 'urn:trusthub:v23:insurance:insurance');
  assert.equal(claims.insurance_origin, 'https://www.insurancetrusthub.com');
  const manifest = JSON.parse(body.toString('utf8'));
  assert.equal(isClosedInsuranceManifest(manifest), true);
  if (!isClosedInsuranceManifest(manifest)) return;
  const stage = guestStageFromInsuranceManifest(manifest);
  assert.equal(stage.returnTask.profile.nativeId, 'state-license:FL:L106287');
  assert.equal(isInsuranceProviderStage(stage), true);
  assert.equal(manifestDigest(stage).length, 64);
  const tampered = Buffer.from(body.toString('utf8').replace('L106287', 'L106288'));
  await assert.rejects(verifyInsuranceAssertion(request, tampered, key.publicKey, 'insurance', 'transfer:stage', nonces, now));
  const withUuid = { ...manifest, providerId: '11111111-1111-4111-8111-111111111111' };
  assert.equal(isClosedInsuranceManifest(withUuid), false);
  assert.equal(isClosedInsuranceManifest(manifestFor('FL', 'asfin-llc-l106287', 'asfin-llc-l106287')), false);
  assert.equal(isInsuranceProviderStage({ ...stage, selected: [{ ...stage.selected[0], profile: { hub: 'insurance', nativeId: 'asfin-llc-l106287', profileClass: 'insurance_provider' } }] }), false);
  const ack = signInsuranceAssertion(key.privateKey, 'ask', 'https://www.insurancetrusthub.com/api/my-trusthub/profile-save/source', 'source:ack', Buffer.from('{"action":"acknowledge"}'), browser, null, null, now);
  const ackRequest = new Request('https://www.insurancetrusthub.com/api/my-trusthub/profile-save/source', { method: 'POST', headers: { [ASSERTION_HEADER]: ack } });
  const acked = await verifyInsuranceAssertion(ackRequest, Buffer.from('{"action":"acknowledge"}'), key.publicKey, 'ask', 'source:ack', nonces, now);
  assert.equal(acked.scope, 'source:ack');
});

test('the profile-save endpoint accepts only a verified closed insurance manifest', async () => {
  const manifest = manifestFor('TX', '9982', 'bailey-insurance-risk-management-inc-9982');
  const request = (body: unknown) => new Request('https://www.asktrusthub.com/api/my-trusthub/profile-save', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const accepted = await handleProfileSave(request(manifest), {
    enabled: true,
    runtimeForRequest: async () => { throw new Error('runtime must not see the closed manifest'); },
    acceptInsuranceManifest: async () => ({ transferRef: 't'.repeat(43), manifestDigest: 'a'.repeat(64), continuationRef: 'c'.repeat(43), expiresAt: 1 }),
  });
  assert.equal(accepted.status, 200);
  const payload = await accepted.json() as { ok: boolean; operation: string; result: { continuationRef: string } };
  assert.equal(payload.ok, true);
  assert.equal(payload.operation, 'prepareGuestProfileTransfer');
  assert.equal(payload.result.continuationRef, 'c'.repeat(43));
  const refused = await handleProfileSave(request(manifest), {
    enabled: true,
    runtimeForRequest: async () => null,
  });
  assert.equal(refused.status, 400);
});
