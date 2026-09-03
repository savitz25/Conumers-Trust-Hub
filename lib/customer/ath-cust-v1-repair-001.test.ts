import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateCustomerProfile } from './adapter.ts';
import { mintHandoffToken, mutateHandoffToken, parseAndAuthenticateHandoff, HandoffError } from './handoff.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';

const secret = 'ask-contractor-v2-repair-secret-is-long-enough';
const profile: CustomerProfileRecord = {
  id: '0001ac38-0c96-4e2f-8bf6-9ab243f7b79b', slug: 'ccc1332036-infinite-construction-services-llc',
  displayName: 'Infinite Construction Services LLC', isThin: false, homeState: 'FL', licenseState: 'FL',
  externalKey: 'CCC1332036', sourceSystem: 'fl_dbpr', hubId: 'contractor', publicationEligible: true,
  entityClass: 'contractor', canonicalUrl: 'https://www.contractortrusthub.com/contractors/ccc1332036-infinite-construction-services-llc',
};

function mint(overrides: Parameters<typeof mintHandoffToken>[1] = {
  hubId: 'contractor', nativeProfileId: profile.id, slug: profile.slug, externalKey: profile.externalKey,
  sourceSystem: 'fl_dbpr', homeState: 'FL', identifierNamespace: 'credential', entityClass: 'contractor',
  canonicalProfileUrl: profile.canonicalUrl, displayName: profile.displayName,
}) { return mintHandoffToken(secret, overrides); }

test('complete Contractor v2 authenticates and exact profile validation succeeds', () => {
  const minted = mint();
  assert.equal(minted.payload.v, 2);
  assert.equal(parseAndAuthenticateHandoff(secret, minted.token).v, 2);
  assert.deepEqual(validateCustomerProfile(minted.payload, profile), { ok: true, profile });
});

test('partial or malformed Contractor v2 fields fail closed', () => {
  for (const change of [
    { identifier_namespace: undefined }, { identifier_namespace: 'NMLS' }, { entity_class: undefined },
    { entity_class: 'institution' }, { source_system: 'fmcsa' }, { home_state: 'NJ' },
    { canonical_profile_url: undefined }, { display_name: undefined },
  ] as Partial<HandoffPayload>[]) {
    const token = mutateHandoffToken(mint().token, (payload) => ({ ...payload, ...change }), secret);
    assert.throws(() => parseAndAuthenticateHandoff(secret, token), HandoffError);
  }
});

test('exact canonical destination is independently validated', () => {
  const payload = mint().payload;
  assert.equal(validateCustomerProfile({ ...payload, canonical_profile_url: `${profile.canonicalUrl}-wrong` }, profile).ok, false);
  assert.equal(validateCustomerProfile({ ...payload, native_profile_id: '00000000-0000-4000-8000-000000000000' }, profile).ok, false);
  assert.equal(validateCustomerProfile({ ...payload, external_key: 'CCC0000000' }, profile).ok, false);
  assert.equal(validateCustomerProfile({ ...payload, slug: 'wrong' }, profile).ok, false);
});

test('legacy valid Contractor v1 remains transition-compatible while new mint defaults to v2', () => {
  const legacy = mintHandoffToken(secret, { hubId: 'contractor', nativeProfileId: profile.id, slug: profile.slug,
    externalKey: profile.externalKey, sourceSystem: 'fl_dbpr', homeState: 'FL', version: 1 });
  assert.equal(parseAndAuthenticateHandoff(secret, legacy.token).v, 1);
  assert.equal(mint().payload.v, 2);
});

test('other hub mint contracts remain v2', () => {
  for (const [hubId, identifierNamespace, entityClass, sourceSystem] of [
    ['move','USDOT','mover','fmcsa'], ['lender','NMLS','institution','nmls'], ['senior','CMS_CCN','nursing_home','cms'],
    ['investor','CRD','firm','sec_iard'], ['insurance','NAIC','legal_insurer','naic'],
  ] as const) {
    assert.equal(mintHandoffToken(secret, { hubId, nativeProfileId: profile.id, slug: profile.slug, externalKey: '1',
      sourceSystem, homeState: null, identifierNamespace, entityClass }).payload.v, 2);
  }
});

test('Ask internal Contractor mint and footer accessibility use repaired contracts', () => {
  const route = readFileSync('app/api/internal/handoff/mint/route.ts', 'utf8');
  const footer = readFileSync('components/footer.tsx', 'utf8');
  assert.match(route, /v:2/);
  assert.doesNotMatch(route, /hubId==='contractor'\?1:2/);
  assert.match(footer, /text-xs text-slate-400/);
  assert.doesNotMatch(footer, /text-xs text-slate-500/);
});
