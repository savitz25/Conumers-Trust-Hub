import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mintHandoffToken, mutateHandoffToken, parseAndAuthenticateHandoff, HandoffError } from './handoff.ts';
import { HANDOFF_AUDIENCE } from './types.ts';

const SECRET = 'ath-handoff-secret-for-tests-32chars-min';
const PROFILE = {
  nativeProfileId: '11111111-1111-4111-8111-111111111111',
  slug: 'cbc015082-acme-roofing',
  externalKey: 'CBC015082',
};

test('valid token accepted', () => {
  const { token, payload } = mintHandoffToken(SECRET, PROFILE);
  const out = parseAndAuthenticateHandoff(SECRET, token);
  assert.equal(out.native_profile_id, PROFILE.nativeProfileId);
  assert.equal(out.aud, HANDOFF_AUDIENCE);
  assert.equal(out.nonce, payload.nonce);
});

test('tampered token rejected', () => {
  const { token } = mintHandoffToken(SECRET, PROFILE);
  const [body] = token.split('.');
  assert.throws(() => parseAndAuthenticateHandoff(SECRET, `${body}.aaaaaaaa`), HandoffError);
});

test('expired token rejected', () => {
  const { token } = mintHandoffToken(SECRET, { ...PROFILE, ttlSeconds: 1, now: new Date('2020-01-01') });
  assert.throws(() => parseAndAuthenticateHandoff(SECRET, token, new Date()), (e: unknown) => {
    return e instanceof HandoffError && e.code === 'expired';
  });
});

test('wrong audience rejected', () => {
  const { token } = mintHandoffToken(SECRET, PROFILE);
  const bad = mutateHandoffToken(token, (p) => ({ ...p, aud: 'contractortrusthub' as typeof p.aud }), SECRET);
  assert.throws(() => parseAndAuthenticateHandoff(SECRET, bad), (e: unknown) => {
    return e instanceof HandoffError && e.code === 'wrong_audience';
  });
});
