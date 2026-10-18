import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { fixtureEnv, A } from './final-wiring.test.ts';
import { accountRuntime } from '../account-policy.ts';
import { ASK_PREVIEW, ISOLATED_PROJECT, ISOLATED_TARGET, MOVE_PREVIEW, PRODUCTION_TARGET, admittedPreviewUser, deploymentConfig, exactIsolatedLenderOrigin, isolatedConfig, isolatedLenderPilotConfig, previewDeploymentPinMatches } from './isolated-config.ts';
import { ASSERTION_HEADER, LENDER_PRODUCTION_PINS, signLenderAssertion, verifyLenderAssertion } from './lender-assertion.ts';
import { LenderSourceChannel, isolatedLenderPins, lenderPinsFor } from './lender-channel.ts';
import { PRODUCTION_ORIGINS } from '../contracts/v2-3-profile-transfer.ts';

const LENDER = 'https://lender-pilot.preview.example';
const OLDER_MOVE = 'https://move-trust-hub-git-mth-v2-3-move-par-71a0b3-savitz25-s-projects.vercel.app';
const browser = 'b'.repeat(43);
const now = 1_700_000_000_000;
const PRODUCTION_ENV = {
  VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
  MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: 'https://www.asktrusthub.com',
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://qvvxvbcdmbjzrgvwjatw.supabase.co',
  MY_TRUSTHUB_V23_PARENT_ORIGIN: 'https://www.asktrusthub.com', MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com',
  MY_TRUSTHUB_V23_PRODUCTION_PROJECT: 'qvvxvbcdmbjzrgvwjatw', MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated',
};

function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKey: { kid: 'lender-pilot-fixture', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid: 'lender-pilot-fixture', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  };
}
function nonces() {
  const seen = new Set<string>();
  return { claim: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; } };
}
const pin = {
  project_ref: ISOLATED_PROJECT, version: 'v23-parent-wiring/1', ask_origin: ASK_PREVIEW, move_origin: MOVE_PREVIEW,
};

test('the Move target stays closed and production ignores an isolated lender origin', () => {
  const closed = deploymentConfig(fixtureEnv);
  assert.ok(closed);
  assert.equal(closed.registry.origins.lender, '');
  assert.equal(closed.parentOrigin, ASK_PREVIEW);
  assert.equal(closed.moveOrigin, MOVE_PREVIEW);
  assert.equal(closed.target, ISOLATED_TARGET);
  assert.equal(accountRuntime(fixtureEnv)?.origin, ASK_PREVIEW);
  assert.equal(accountRuntime(fixtureEnv)?.backend, `https://${ISOLATED_PROJECT}.supabase.co`);
  assert.equal(lenderPinsFor(ISOLATED_TARGET), null);
  assert.equal(isolatedLenderPins(closed), null);
  assert.equal(isolatedConfig({ ...fixtureEnv, MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER })?.registry.origins.lender, '');
  const production = deploymentConfig({ ...PRODUCTION_ENV, MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER });
  assert.equal(production?.target, PRODUCTION_TARGET);
  assert.equal(production?.registry.origins.lender, PRODUCTION_ORIGINS.lender);
  assert.equal(lenderPinsFor(PRODUCTION_TARGET), LENDER_PRODUCTION_PINS);
  assert.equal(production ? isolatedLenderPins(production) : 'missing', null);
});

test('one exact lender origin fills only the isolated registry and leaves admission unchanged', () => {
  assert.equal(exactIsolatedLenderOrigin(LENDER), LENDER);
  for (const rejected of [
    undefined, '', ' ' + LENDER, LENDER + ' ', '*', 'https://*.preview.example',
    LENDER + '/lenders/freedom-mortgage', LENDER + '?next=/', LENDER + '#fragment',
    'http://lender-pilot.preview.example', 'https://lender-pilot.preview.example.',
    'https://user:secret@lender-pilot.preview.example',
    ASK_PREVIEW, MOVE_PREVIEW, PRODUCTION_ORIGINS.lender, PRODUCTION_ORIGINS.move, 'https://www.asktrusthub.com',
  ]) assert.equal(exactIsolatedLenderOrigin(rejected), null, String(rejected));
  assert.equal(isolatedLenderPilotConfig(fixtureEnv), null);
  const pilot = deploymentConfig({ ...fixtureEnv, MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER });
  assert.ok(pilot);
  assert.equal(pilot.target, ISOLATED_TARGET);
  assert.equal(pilot.parentOrigin, ASK_PREVIEW);
  assert.equal(pilot.moveOrigin, MOVE_PREVIEW);
  assert.equal(pilot.project, ISOLATED_PROJECT);
  assert.equal(pilot.registry.environment, 'isolated');
  assert.equal(pilot.registry.origins.move, MOVE_PREVIEW);
  assert.equal(pilot.registry.origins.lender, LENDER);
  assert.equal(pilot.registry.origins.insurance, '');
  assert.deepEqual(isolatedLenderPins(pilot), {
    parentOrigin: ASK_PREVIEW, lenderOrigin: LENDER, project: ISOLATED_PROJECT, assertionEnvironment: 'isolated',
  });
  assert.equal(admittedPreviewUser({ id: A, email_confirmed_at: '2026-09-01' }, { ...fixtureEnv, MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER }), true);
  assert.equal(admittedPreviewUser({ id: '33333333-3333-4333-8333-333333333333', email_confirmed_at: '2026-09-01' }, { ...fixtureEnv, MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER }), false);
});

test('the stored preview pin still compares only the Ask and Move pair', () => {
  const config = { target: ISOLATED_TARGET, parentOrigin: ASK_PREVIEW, moveOrigin: MOVE_PREVIEW };
  assert.equal(previewDeploymentPinMatches(pin, config), true);
  assert.equal(previewDeploymentPinMatches({ ...pin, lender_origin: LENDER }, config), true);
  assert.equal(previewDeploymentPinMatches({ ...pin, move_origin: OLDER_MOVE }, config), false);
  assert.equal(previewDeploymentPinMatches({ ...pin, ask_origin: LENDER }, config), false);
  assert.equal(previewDeploymentPinMatches({ ...pin, project_ref: 'qvvxvbcdmbjzrgvwjatw' }, config), false);
  assert.equal(previewDeploymentPinMatches(null, config), false);
});

test('isolated lender assertions and the source call use the explicit origin', async () => {
  const pair = keys();
  const pins = { parentOrigin: ASK_PREVIEW, lenderOrigin: LENDER, project: ISOLATED_PROJECT, assertionEnvironment: 'isolated' as const };
  const body = Buffer.from(JSON.stringify({ action: 'resolve' }));
  const target = ASK_PREVIEW + '/api/my-trusthub/profile-save';
  const token = signLenderAssertion(pair.privateKey, 'lender', target, 'transfer:stage', body, browser, null, null, now, pins);
  const claims = await verifyLenderAssertion(new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body }), body, pair.publicKey, 'lender', 'transfer:stage', nonces(), now, pins);
  assert.equal(claims.sub, 'svc:trusthub:lender:v23:isolated');
  assert.equal(claims.iss, `urn:trusthub:v23:${ISOLATED_PROJECT}:lender`);
  assert.equal(claims.ask_origin, ASK_PREVIEW);
  assert.equal(claims.lender_origin, LENDER);
  const productionTarget = LENDER_PRODUCTION_PINS.parentOrigin + '/api/my-trusthub/profile-save';
  const productionToken = signLenderAssertion(pair.privateKey, 'lender', productionTarget, 'transfer:stage', body, browser, null, null, now);
  await assert.rejects(() => verifyLenderAssertion(new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: productionToken }, body }), body, pair.publicKey, 'lender', 'transfer:stage', nonces(), now, pins));
  await assert.rejects(() => verifyLenderAssertion(new Request(productionTarget, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body }), body, pair.publicKey, 'lender', 'transfer:stage', nonces(), now));
  let seen = '';
  const channel = new LenderSourceChannel(pair.privateKey, async input => {
    seen = String(input);
    return new Response(JSON.stringify({ ok: true, result: { posted: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }, pins);
  assert.deepEqual(await channel.call({ action: 'resolve' }, 'source:read', browser), { posted: true });
  assert.equal(seen, LENDER + '/api/my-trusthub/profile-save/source');
});
