import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { CONTRACTOR_PRODUCTION_PINS, signContractorAssertion, verifyContractorAssertion } from './contractor-assertion.ts';
import { ASSERTION_HEADER } from './service-assertion.ts';
import { signLenderAssertion } from './lender-assertion.ts';
import { RuntimeError } from './runtime.ts';

const browser = 'b'.repeat(43);
const now = 1_700_000_000_000;
function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: { kid: 'contractor-test', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'contractor-test', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
}
function nonces() {
  const seen = new Set<string>();
  return { claim: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; } };
}

test('H contractor assertion round-trips and rejects unsigned, tampered, expired, foreign, and wrong-audience tokens', async () => {
  const pair = keys();
  const target = CONTRACTOR_PRODUCTION_PINS.parentOrigin + '/api/my-trusthub/profile-save';
  const body = Buffer.from(JSON.stringify({
    version: 'v2-3/parent-runtime/1', operation: 'prepareGuestProfileTransfer',
    input: { slug: 'ccc057187-a-r-roofing-inc', intent: 'save' },
  }));
  const token = signContractorAssertion(pair.privateKey, 'contractor', target, 'transfer:stage', body, browser, null, null, now);
  const request = new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body });
  const claims = await verifyContractorAssertion(request, body, pair.publicKey, 'contractor', 'transfer:stage', nonces(), now);
  assert.equal(claims.iss, 'urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:contractor');
  assert.equal(claims.sub, 'svc:trusthub:contractor:v23:production');
  assert.equal(claims.contractor_origin, 'https://www.contractortrusthub.com');
  assert.equal(claims.ask_origin, 'https://www.asktrusthub.com');
  assert.equal(Object.hasOwn(claims, 'lender_origin'), false);
  assert.equal(Object.hasOwn(claims, 'move_origin'), false);

  const tampered = Buffer.from(body.toString('utf8').replace('ccc057187-a-r-roofing-inc', 'cfc1427249-a-sunny-plumbing-company'));
  await assert.rejects(() => verifyContractorAssertion(new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body: tampered }), tampered, pair.publicKey, 'contractor', 'transfer:stage', nonces(), now),
    (error: unknown) => error instanceof RuntimeError && error.code === 'unauthorized');
  await assert.rejects(() => verifyContractorAssertion(new Request(target, { method: 'POST', body }), body, pair.publicKey, 'contractor', 'transfer:stage', nonces(), now));
  await assert.rejects(() => verifyContractorAssertion(request, body, pair.publicKey, 'contractor', 'transfer:stage', nonces(), now + 31_000));
  const otherAudience = CONTRACTOR_PRODUCTION_PINS.parentOrigin + '/api/my-trusthub/profile-save/source';
  await assert.rejects(() => verifyContractorAssertion(new Request(otherAudience, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body }), body, pair.publicKey, 'contractor', 'transfer:stage', nonces(), now));
  assert.throws(() => signContractorAssertion(pair.privateKey, 'contractor', 'https://evil.example/api/my-trusthub/profile-save', 'transfer:stage', body, browser, null, null, now),
    (error: unknown) => error instanceof RuntimeError && error.code === 'unavailable');
  const lenderToken = signLenderAssertion(pair.privateKey, 'lender', target, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifyContractorAssertion(new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: lenderToken }, body }), body, pair.publicKey, 'contractor', 'transfer:stage', nonces(), now));
});
