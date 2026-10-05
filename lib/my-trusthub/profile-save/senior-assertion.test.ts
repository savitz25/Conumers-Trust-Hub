import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { SENIOR_PRODUCTION_PINS, signSeniorAssertion, verifySeniorAssertion } from './senior-assertion.ts';
import { seniorPinsFor } from './senior-channel.ts';
import { ASSERTION_HEADER } from './service-assertion.ts';
import { signLenderAssertion } from './lender-assertion.ts';
import { signInsuranceAssertion } from './insurance-assertion.ts';
import { PRODUCTION_TARGET } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';

const browser = 'b'.repeat(43);
const now = 1_700_000_000_000;
function keys(kid = 'senior-test') {
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
const unauthorized = (error: unknown) => error instanceof RuntimeError && error.code === 'unauthorized';
const target = SENIOR_PRODUCTION_PINS.parentOrigin + '/api/my-trusthub/profile-save';
const body = Buffer.from(JSON.stringify({ version: 'v2-3/parent-runtime/1', operation: 'prepareGuestProfileTransfer', input: { nativeId: '015009' } }));
const request = (token: string | null, bytes: Buffer = body, url = target) =>
  new Request(url, { method: 'POST', headers: token === null ? {} : { [ASSERTION_HEADER]: token } as Record<string, string>, body: new Uint8Array(bytes) });

test('the Senior assertion is the shared v23 shape with a signed senior_origin', async () => {
  const pair = keys();
  const token = signSeniorAssertion(pair.privateKey, 'senior', target, 'transfer:stage', body, browser, null, null, now);
  const claims = await verifySeniorAssertion(request(token), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now);
  assert.equal(claims.iss, 'urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:senior');
  assert.equal(claims.sub, 'svc:trusthub:senior:v23:production');
  assert.equal(claims.senior_origin, 'https://www.seniortrusthub.com');
  assert.equal(claims.ask_origin, 'https://www.asktrusthub.com');
  assert.equal(claims.aud, target);
  assert.equal(claims.exp - claims.iat, 30);
  assert.equal(Object.keys(claims).sort().join(), 'ask_origin,aud,body_sha256,browser,exp,grant,iat,iss,jti,method,path,scope,senior_origin,session,sub,v');
  for (const other of ['lender_origin', 'move_origin', 'insurance_origin', 'contractor_origin']) assert.equal(Object.hasOwn(claims, other), false);
  assert.deepEqual(SENIOR_PRODUCTION_PINS, { parentOrigin: 'https://www.asktrusthub.com', seniorOrigin: 'https://www.seniortrusthub.com', project: 'qvvxvbcdmbjzrgvwjatw', assertionEnvironment: 'production' });
  // Pins exist for the production target only.
  assert.deepEqual(seniorPinsFor(PRODUCTION_TARGET), SENIOR_PRODUCTION_PINS);
  assert.equal(seniorPinsFor({ ...PRODUCTION_TARGET, kind: 'isolated' } as never), null);
  assert.equal(seniorPinsFor({ ...PRODUCTION_TARGET, parentOrigin: 'https://preview.example' } as never), null);
});

test('N O P Q unsigned, tampered, foreign-signed, expired and replayed assertions are denied', async () => {
  const pair = keys();
  const fresh = () => signSeniorAssertion(pair.privateKey, 'senior', target, 'transfer:stage', body, browser, null, null, now);
  // Unsigned.
  await assert.rejects(() => verifySeniorAssertion(request(null), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  await assert.rejects(() => verifySeniorAssertion(request('not.a.token'), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  // N. tampered body (another CCN), tampered claims, flipped signature.
  const tampered = Buffer.from(body.toString('utf8').replace('015009', '055223'));
  await assert.rejects(() => verifySeniorAssertion(request(fresh(), tampered), tampered, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  const parts = fresh().split('.');
  const claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
  const reclaim = (patch: Record<string, unknown>) => [parts[0], Buffer.from(JSON.stringify({ ...claims, ...patch })).toString('base64url'), parts[2]].join('.');
  for (const patch of [{ senior_origin: 'https://evil.example' }, { aud: target + '/source' }, { scope: 'saved:write' }, { exp: (claims.exp as number) + 600 }, { browser: 'x'.repeat(43) }])
    await assert.rejects(() => verifySeniorAssertion(request(reclaim(patch)), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized, JSON.stringify(patch));
  const flipped = Buffer.from(parts[2]!, 'base64url'); flipped[3] = flipped[3]! ^ 0x40;
  await assert.rejects(() => verifySeniorAssertion(request([parts[0], parts[1], flipped.toString('base64url')].join('.')), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  // O. foreign signature: another key under the same kid, another kid, and other hubs' tokens signed by this very key.
  await assert.rejects(() => verifySeniorAssertion(request(fresh()), body, keys().publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  await assert.rejects(() => verifySeniorAssertion(request(fresh()), body, { ...pair.publicKey, kid: 'someone-else' }, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  const lenderToken = signLenderAssertion(pair.privateKey, 'lender', target, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifySeniorAssertion(request(lenderToken), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  const insuranceToken = signInsuranceAssertion(pair.privateKey, 'insurance', target, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifySeniorAssertion(request(insuranceToken), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  // A correctly signed token whose hub claim is named for another hub, or whose signed Senior origin is wrong.
  for (const [name, value] of [['contractor_origin', 'https://www.seniortrusthub.com'], ['move_origin', 'https://www.seniortrusthub.com']] as const) {
    const forgedClaims: Record<string, unknown> = { ...claims, [name]: value }; delete forgedClaims.senior_origin;
    const unsigned = parts[0] + '.' + Buffer.from(JSON.stringify(forgedClaims)).toString('base64url');
    const forged = unsigned + '.' + sign(null, Buffer.from(unsigned), createPrivateKey(pair.privateKey.pem)).toString('base64url');
    await assert.rejects(() => verifySeniorAssertion(request(forged), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized, name);
  }
  const wrongOrigin = parts[0] + '.' + Buffer.from(JSON.stringify({ ...claims, senior_origin: 'https://www.lendertrusthub.com' })).toString('base64url');
  const resigned = wrongOrigin + '.' + sign(null, Buffer.from(wrongOrigin), createPrivateKey(pair.privateKey.pem)).toString('base64url');
  await assert.rejects(() => verifySeniorAssertion(request(resigned), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  // Wrong audience, wrong scope, wrong service.
  await assert.rejects(() => verifySeniorAssertion(request(fresh(), body, target + '/source'), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now), unauthorized);
  await assert.rejects(() => verifySeniorAssertion(request(fresh()), body, pair.publicKey, 'senior', 'receipt:verify', nonces(), now), unauthorized);
  await assert.rejects(() => verifySeniorAssertion(request(fresh()), body, pair.publicKey, 'ask', 'transfer:stage', nonces(), now), unauthorized);
  assert.throws(() => signSeniorAssertion(pair.privateKey, 'senior', 'https://evil.example/api/my-trusthub/profile-save', 'transfer:stage', body, browser, null, null, now),
    (error: unknown) => error instanceof RuntimeError && error.code === 'unavailable');
  // P. expired, and issued in the future.
  await assert.rejects(() => verifySeniorAssertion(request(fresh()), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now + 31_000), unauthorized);
  await assert.rejects(() => verifySeniorAssertion(request(fresh()), body, pair.publicKey, 'senior', 'transfer:stage', nonces(), now - 10_000), unauthorized);
  // Q. replay: the same token is accepted once.
  const store = nonces(), once = fresh();
  await verifySeniorAssertion(request(once), body, pair.publicKey, 'senior', 'transfer:stage', store, now);
  await assert.rejects(() => verifySeniorAssertion(request(once), body, pair.publicKey, 'senior', 'transfer:stage', store, now), unauthorized);
});
