import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { ASK_PREVIEW, MOVE_PREVIEW, ISOLATED_PROJECT, isolatedConfig, admittedPreviewUser, API_PATH, SOURCE_PATH, type Env } from './isolated-config.ts';
import { accountRuntime, accountFormAvailable } from '../account-policy.ts';
import { runAccountOperation, type AuthApi } from '../account-service.ts';
import { ASSERTION_HEADER, signAssertion, verifyAssertion, type Scope } from './service-assertion.ts';
import { verifiedParent } from './verified-parent.ts';
import { SourceChannel, TEST_PROFILE, TEST_SLUG } from './source-channel.ts';

export const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
export const fixtureEnv: Env = { VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: ASK_PREVIEW, MY_TRUSTHUB_TEST_ORIGIN: ASK_PREVIEW,
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: `https://${ISOLATED_PROJECT}.supabase.co`, MY_TRUSTHUB_TEST_SUPABASE_URL: `https://${ISOLATED_PROJECT}.supabase.co`,
  MY_TRUSTHUB_NONPRODUCTION_APPROVED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true',
  MY_TRUSTHUB_V23_PARENT_ORIGIN: ASK_PREVIEW, MY_TRUSTHUB_V23_MOVE_ORIGIN: MOVE_PREVIEW,
  MY_TRUSTHUB_V23_ISOLATED_PROJECT: ISOLATED_PROJECT, MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated', MY_TRUSTHUB_ACCESS_MODE: 'invitation',
  MY_TRUSTHUB_SIGNUP_ENABLED: 'false', MY_TRUSTHUB_EMAIL_ENABLED: 'false', MY_TRUSTHUB_WATCH_ENABLED: 'false',
  MY_TRUSTHUB_ALERTS_ENABLED: 'false', MY_TRUSTHUB_SOURCE_MONITORING_ENABLED: 'false', MY_TRUSTHUB_INVITED_USER_IDS: A + ',' + B };
export function keys() { const pair = generateKeyPairSync('ed25519'); return {
  privateKey: { kid: 'fixture-only', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
  publicKey: { kid: 'fixture-only', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }; }

test('F01 exact stable branch origin, A/B-only admission, production and unsafe flags denied', () => {
  assert.ok(isolatedConfig(fixtureEnv)); assert.equal(accountRuntime(fixtureEnv)?.origin, ASK_PREVIEW);
  assert.equal(MOVE_PREVIEW, 'https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app');
  for (const id of [A, B]) assert.ok(admittedPreviewUser({ id, email_confirmed_at: '2026-09-01' }, fixtureEnv));
  assert.equal(admittedPreviewUser({ id: '33333333-3333-4333-8333-333333333333', email_confirmed_at: '2026-09-01' }, fixtureEnv), false);
  assert.equal(admittedPreviewUser({ id: A }, fixtureEnv), false);
  for (const patch of [{ VERCEL_ENV: 'production' }, { MY_TRUSTHUB_ACCESS_MODE: 'public' }, { MY_TRUSTHUB_INVITED_USER_IDS: A },
    { MY_TRUSTHUB_INVITED_USER_IDS: A + ',' + A }, { MY_TRUSTHUB_INVITED_EMAILS: 'not-an-authority@example.invalid' },
    { NEXT_PUBLIC_SITE_URL: ASK_PREVIEW + '.evil.test' }, { NEXT_PUBLIC_SITE_URL: 'https://conumers-trust-jsymd6uxa-savitz25-s-projects.vercel.app' },
    { MY_TRUSTHUB_TEST_ORIGIN: 'https://other-preview.vercel.app' }, { MY_TRUSTHUB_V23_SESSION_AFFINITY: 'transaction' },
    ...['MY_TRUSTHUB_SIGNUP_ENABLED','MY_TRUSTHUB_EMAIL_ENABLED','MY_TRUSTHUB_WATCH_ENABLED','MY_TRUSTHUB_ALERTS_ENABLED','MY_TRUSTHUB_SOURCE_MONITORING_ENABLED'].map(k => ({ [k]: 'true' }))]) {
    assert.equal(isolatedConfig({ ...fixtureEnv, ...patch }), null);
  }
  const prod = { ...fixtureEnv, VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.asktrusthub.com', NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://qvvxvbcdmbjzrgvwjatw.supabase.co' };
  assert.equal(accountRuntime(prod)?.origin, 'https://www.asktrusthub.com'); assert.equal(isolatedConfig(prod), null);
});

test('F02 Ed25519 assertion binds bytes, method, path, origin pair, service, scope, time and durable nonce contract', async () => {
  const key = keys(), browser = 'b'.repeat(43), bytes = Buffer.from('{"action":"source"}'), now = Date.now(), seen = new Set<string>();
  const nonces = { claim: async (ref: string) => { if (seen.has(ref)) return false; seen.add(ref); return true; } }; // unit fixture only
  const target = MOVE_PREVIEW + SOURCE_PATH;
  const assertion = signAssertion(key.privateKey, 'ask', target, 'source:read', bytes, browser, null, null, now);
  const request = (token = assertion, url = target, method = 'POST') => new Request(url, { method, headers: { [ASSERTION_HEADER]: token } });
  for (const scope of ['source:ack','receipt:verify'] as Scope[]) await assert.rejects(verifyAssertion(request(), bytes, key.publicKey, 'ask', scope, nonces, now));
  await assert.rejects(verifyAssertion(request(), Buffer.from('{"action":"acknowledge"}'), key.publicKey, 'ask', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(assertion, target + '/other'), bytes, key.publicKey, 'ask', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(assertion, target + '?same=1'), bytes, key.publicKey, 'ask', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(assertion, ASK_PREVIEW + SOURCE_PATH), bytes, key.publicKey, 'ask', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(assertion, target, 'GET'), bytes, key.publicKey, 'ask', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(), bytes, keys().publicKey, 'ask', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(), bytes, key.publicKey, 'move', 'source:read', nonces, now));
  await assert.rejects(verifyAssertion(request(), bytes, key.publicKey, 'ask', 'source:read', nonces, now + 31000));
  await assert.rejects(verifyAssertion(request(), bytes, key.publicKey, 'ask', 'source:read', nonces, now - 4000));
  assert.equal((await verifyAssertion(request(), bytes, key.publicKey, 'ask', 'source:read', nonces, now)).browser, browser);
  await assert.rejects(verifyAssertion(request(), bytes, key.publicKey, 'ask', 'source:read', nonces, now));
  assert.equal(seen.size, 1, 'bad signatures/bindings cannot consume nonce storage');
  const pieces = assertion.split('.'); pieces[0] = Buffer.from(JSON.stringify({ alg: 'none', typ: 'trusthub-v23+jws', kid: 'fixture-only' })).toString('base64url');
  await assert.rejects(verifyAssertion(request(pieces.join('.')), bytes, key.publicKey, 'ask', 'source:read', nonces, now));
  const fresh = signAssertion(key.privateKey, 'ask', target, 'source:read', bytes, browser);
  const results = await Promise.allSettled([verifyAssertion(request(fresh), bytes, key.publicKey, 'ask', 'source:read', nonces), verifyAssertion(request(fresh), bytes, key.publicKey, 'ask', 'source:read', nonces)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  await assert.rejects(verifyAssertion(request(signAssertion(key.privateKey, 'ask', target, 'source:read', bytes, browser)), bytes, key.publicKey, 'ask', 'source:read', { claim: async () => { throw Error('DB unavailable'); } }));
});

test('F03 verified parent requires server Auth, matching verified claims, admitted subject and live same session', async () => {
  const sid = '99999999-9999-4999-8999-999999999999';
  const user = { id: A, email_confirmed_at: '2026-09-01', email: 'fixture@example.invalid' };
  const claims = { sub: A, session_id: sid, exp: Date.now() / 1000 + 60, iss: `https://${ISOLATED_PROJECT}.supabase.co/auth/v1` };
  const auth = (patch = {}) => ({ getUser: async () => ({ data: { user }, error: null }), getClaims: async () => ({ data: { claims: { ...claims, ...patch } }, error: null }) });
  const req = new Request(ASK_PREVIEW + '/my/profile-save');
  assert.equal((await verifiedParent(req, fixtureEnv, auth(), async (s, id) => s === A && id === sid))?.subject, A);
  for (const patch of [{ sub: B }, { iss: 'https://example.invalid/auth/v1' }, { session_id: 'browser-uuid' }, { exp: 1 }]) assert.equal(await verifiedParent(req, fixtureEnv, auth(patch), async () => true), null);
  assert.equal(await verifiedParent(req, fixtureEnv, auth(), async () => false), null);
  assert.equal(await verifiedParent(new Request(MOVE_PREVIEW + API_PATH), fixtureEnv, auth(), async () => true), null);
  assert.equal(await verifiedParent(req, fixtureEnv, { ...auth(), getUser: async () => ({ data: { user: null }, error: Error('revoked') }) }, async () => true), null);
});

test('F04 source callback pins network target and rejects stale/unpublished/mismatched source data', async () => {
  const k = keys(); let patch = {};
  const source = new SourceChannel(k.privateKey, undefined, async (target, init) => {
    assert.equal(target, MOVE_PREVIEW + SOURCE_PATH); assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store'); assert.equal(new Headers(init?.headers).has('cookie'), false);
    return Response.json({ ok: true, result: { identity: TEST_PROFILE, canonicalSlug: TEST_SLUG, publicationState: 'PUBLISHABLE', reviewedClass: 'mover', checkedAt: Date.now(), ...patch } });
  });
  assert.equal((await source.publication('b'.repeat(43))).publicationState, 'PUBLISHABLE');
  for (patch of [{ publicationState: 'INDEXABLE' }, { checkedAt: Date.now() - 6000 }, { canonicalSlug: 'different' }, { identity: { ...TEST_PROFILE, nativeId: 'different' } }]) await assert.rejects(source.publication('b'.repeat(43)));
});

test('F05 Save master never opens isolated signup, email, recovery or credential changes', async () => {
  let calls = 0;
  const auth = new Proxy({}, { get() { calls++; throw Error('Auth operation must remain unreachable'); } }) as AuthApi;
  for (const operation of ['signup', 'link', 'recovery', 'password'] as const) {
    assert.equal(accountFormAvailable(operation, fixtureEnv), false);
    assert.ok((await runAccountOperation(operation, new FormData(), auth, fixtureEnv, () => {})).error);
  }
  assert.equal(calls, 0); assert.equal(accountFormAvailable('login', fixtureEnv), true);
});
