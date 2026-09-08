import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PUBLIC_BUSINESS_FIELD_KEYS } from './public-profile.ts';

const profileRoute = readFileSync('app/api/public/contractor-profiles/[profileId]/route.ts', 'utf8');
const replyRoute = readFileSync('app/api/public/contractor-profiles/[profileId]/replies/route.ts', 'utf8');
const store = readFileSync('lib/customer/store.ts', 'utf8');
const fixture = JSON.parse(readFileSync('fixtures/customer-publication/contractor-business-profile-v1.json', 'utf8')) as Record<string, unknown>;

test('Contractor V1 profile projection is explicit, public-only, and drift-protected', () => {
  assert.deepEqual(PUBLIC_BUSINESS_FIELD_KEYS, ['description','website','public_phone','public_email','founded_year','emergency_service']);
  assert.equal((fixture.fields as Record<string, unknown>).contact_context, undefined);
  for (const privateKey of ['claimId','grantId','orgId','userId','claimantEmail','authorityEvidence','internalRationale']) assert.equal(JSON.stringify(fixture).includes(privateKey), false);
  assert.match(profileRoute, /publicBusinessProfile\(profileId\)/);
  assert.match(replyRoute, /publicBusinessReplies\(profileId\)/);
  assert.match(profileRoute, /s-maxage=60/); assert.match(profileRoute, /noindex/);
});

test('active authority gates both profile and response publication', () => {
  const profileStart = store.indexOf('async publicBusinessProfile(');
  const replyStart = store.indexOf('async publicBusinessReplies(');
  const profileProjection = store.slice(profileStart, store.indexOf('\n  async ', profileStart + 10));
  const replyProjection = store.slice(replyStart, store.indexOf('\n  async ', replyStart + 10));
  for (const projection of [profileProjection, replyProjection]) {
    assert.match(projection, /ath_management_grants/); assert.match(projection, /g\.status='active'/);
    assert.match(projection, /ath_organizations/); assert.match(projection, /o\.status='active'/);
    assert.match(projection, /ath_memberships/); assert.match(projection, /m\.status='active'/);
  }
});

test('field matrix and operational publication documents remain checked in', () => {
  const matrix = readFileSync('docs/claim-publication/contractor-field-matrix.md', 'utf8');
  for (const field of ['description','website','public_phone','public_email','founded_year','emergency_service','contact_context','services','serviceAreas','languages','hours']) assert.match(matrix, new RegExp(`\\b${field}\\b`));
  assert.match(matrix, /contact_context \| PRIVATE_V1/);
  for (const name of ['contractor-publication-audit.md','contract-version.md','cache-latency.md','revocation-publication.md','end-to-end-proof.md']) assert.ok(readFileSync(`docs/claim-publication/${name}`, 'utf8').length > 200);
});
