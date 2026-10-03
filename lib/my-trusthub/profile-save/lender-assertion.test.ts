import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { ASSERTION_HEADER, LENDER_PRODUCTION_PINS, signLenderAssertion, verifyLenderAssertion } from './lender-assertion.ts';
import { ISOLATED_TARGET } from './isolated-config.ts';
import { signAssertion } from './service-assertion.ts';

const browser = 'b'.repeat(43);
const now = 1_700_000_000_000;
function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: { kid: 'lender-test', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'lender-test', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
}
function nonces() {
  const seen = new Set<string>();
  return { claim: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; } };
}

test('lender assertion round-trips and rejects an unsigned, tampered, or Move token', async () => {
  const pair = keys();
  const target = LENDER_PRODUCTION_PINS.parentOrigin + '/api/my-trusthub/profile-save';
  const body = Buffer.from(JSON.stringify({ nativeId: 'nmls:1984721', returnPath: '/lenders/pacific-trust-mortgage' }));
  const token = signLenderAssertion(pair.privateKey, 'lender', target, 'transfer:stage', body, browser, null, null, now);
  const request = new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body });
  const claims = await verifyLenderAssertion(request, body, pair.publicKey, 'lender', 'transfer:stage', nonces(), now);
  assert.equal(claims.lender_origin, LENDER_PRODUCTION_PINS.lenderOrigin);
  assert.equal(claims.ask_origin, LENDER_PRODUCTION_PINS.parentOrigin);
  const tampered = Buffer.from(JSON.stringify({ nativeId: 'nmls:3030', returnPath: '/lenders/pacific-trust-mortgage' }));
  await assert.rejects(() => verifyLenderAssertion(new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body: tampered }), tampered, pair.publicKey, 'lender', 'transfer:stage', nonces(), now));
  await assert.rejects(() => verifyLenderAssertion(new Request(target, { method: 'POST', body }), body, pair.publicKey, 'lender', 'transfer:stage', nonces(), now));
  const isolated = ISOLATED_TARGET.parentOrigin + '/api/my-trusthub/profile-save';
  const moveToken = signAssertion(pair.privateKey, 'move', isolated, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifyLenderAssertion(new Request(isolated, { method: 'POST', headers: { [ASSERTION_HEADER]: moveToken }, body }), body, pair.publicKey, 'lender', 'transfer:stage', nonces(), now));
});
