import assert from 'node:assert/strict';
import test from 'node:test';
import { ASK_PREVIEW, ISOLATED_PROJECT, MOVE_PREVIEW } from './isolated-config.ts';
import { fixtureEnv, A, B, keys } from './final-wiring.test.ts';
import { verifiedParent } from './verified-parent.ts';
import { sessionAttestationExpiry, sessionMac, sessionMacKey, sessionMacMessage, SESSION_ATTESTATION_TTL_SECONDS } from './session-authority.ts';

const sid = '99999999-9999-4999-8999-999999999999';
const other = '88888888-8888-4888-8888-888888888888';
const user = { id: A, email_confirmed_at: '2026-09-01', email: 'fixture@example.invalid' };
const claims = () => ({ sub: A, session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600, iss: `https://${ISOLATED_PROJECT}.supabase.co/auth/v1` });
const auth = (patch: Record<string, unknown> = {}, fail: 'user' | 'claims' | null = null) => ({
  getUser: async () => fail === 'user' ? { data: { user: null }, error: Error('revoked') } : { data: { user }, error: null },
  getClaims: async () => fail === 'claims' ? { data: null, error: Error('claims') } : { data: { claims: { ...claims(), ...patch } }, error: null },
});
function port(live: (s: string, id: string) => boolean) {
  const bound: Array<{ s: string; id: string; exp: number }> = [];
  return { bound, authority: {
    bind: async (s: string, id: string, exp: number) => { bound.push({ s, id, exp }); return live(s, id); },
    live: async (s: string, id: string) => live(s, id),
  } };
}
const req = () => new Request(ASK_PREVIEW + '/my/profile-save', { method: 'POST', body: JSON.stringify({ subject: B, session: other }) });

test('verified User A and User B sessions pass only for their own pair', async () => {
  const a = port((s, id) => s === A && id === sid);
  assert.equal((await verifiedParent(req(), fixtureEnv, auth(), a.authority))?.subject, A);
  assert.equal(a.bound[0]?.s, A);
  assert.equal(a.bound[0]?.id, sid);
  assert.ok(a.bound[0]!.exp <= Math.floor(Date.now() / 1000) + SESSION_ATTESTATION_TTL_SECONDS);
  const bUser = { ...user, id: B };
  const b = port((s, id) => s === B && id === other);
  const bAuth = { getUser: async () => ({ data: { user: bUser }, error: null }),
    getClaims: async () => ({ data: { claims: { ...claims(), sub: B, session_id: other } }, error: null }) };
  assert.equal((await verifiedParent(req(), fixtureEnv, bAuth, b.authority))?.subject, B);
});

test('wrong issuer, expiry, Auth failures, missing and malformed session fail closed', async () => {
  for (const patch of [{ iss: 'https://example.invalid/auth/v1' }, { exp: 1 }, { session_id: 'not-a-uuid' }, { session_id: undefined }, { sub: B }]) {
    const attempt = port(() => true);
    assert.equal(await verifiedParent(req(), fixtureEnv, auth(patch), attempt.authority), null);
    assert.equal(attempt.bound.length, 0);
  }
  for (const fail of ['user', 'claims'] as const) {
    const attempt = port(() => true);
    assert.equal(await verifiedParent(req(), fixtureEnv, auth({}, fail), attempt.authority), null);
    assert.equal(attempt.bound.length, 0);
  }
});

test('subject and session mismatch and account switch fail closed', async () => {
  assert.equal(await verifiedParent(req(), fixtureEnv, auth(), port((s, id) => s === A && id === other).authority), null);
  assert.equal(await verifiedParent(req(), fixtureEnv, auth({ session_id: other }), port((s, id) => !(s === A && id === other)).authority), null);
  const switched = { getUser: async () => ({ data: { user: { ...user, id: B } }, error: null }),
    getClaims: async () => ({ data: { claims: { ...claims(), sub: A, session_id: sid } }, error: null }) };
  const attempt = port(() => true);
  assert.equal(await verifiedParent(req(), fixtureEnv, switched, attempt.authority), null);
  assert.equal(attempt.bound.length, 0);
});

test('browser-posted subject and session are not authority', async () => {
  const seen = port((s, id) => s === A && id === sid);
  const parent = await verifiedParent(req(), fixtureEnv, auth(), seen.authority);
  assert.equal(parent?.subject, A);
  assert.equal(parent?.session, sid);
  assert.equal(seen.bound.some(row => row.s === B || row.id === other), false);
});

test('session MAC binds the isolated project, subject, session and expiry', () => {
  const pem = keys().privateKey.pem;
  const exp = sessionAttestationExpiry(Math.floor(Date.now() / 1000) + 3600);
  const mac = sessionMac(pem, A, sid, exp);
  assert.equal(mac.length, 32);
  assert.equal(sessionMac(pem, A, sid, exp).equals(mac), true);
  assert.equal(sessionMac(pem, B, sid, exp).equals(mac), false);
  assert.equal(sessionMac(pem, A, other, exp).equals(mac), false);
  assert.equal(sessionMacMessage(A, sid, exp).startsWith('v23-session/1|' + ISOLATED_PROJECT + '|'), true);
  assert.equal(sessionMacKey(pem).equals(sessionMacKey(pem)), true);
  assert.equal(sessionMacKey('other').equals(sessionMacKey(pem)), false);
  assert.equal(MOVE_PREVIEW.includes('movetrusthub.com'), false);
});
