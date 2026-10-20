import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { accountRuntime } from '../account-policy.ts';
import { PRODUCTION_ORIGINS } from '../contracts/v2-3-profile-transfer.ts';
import { fixtureEnv } from './final-wiring.test.ts';
import { ASK_PREVIEW, ISOLATED_PROJECT, ISOLATED_TARGET, MOVE_PREVIEW, PARENT_LOGIN, PRODUCTION_PROJECT, PRODUCTION_TARGET, RETAINED_PARE_ASK_ORIGIN, deploymentConfig, exactIsolatedLenderOrigin, isolatedConfig, isolatedLenderPilotConfig, previewDeploymentPinMatches, type Env } from './isolated-config.ts';
import { ASSERTION_HEADER, signLenderAssertion, verifyLenderAssertion } from './lender-assertion.ts';

/** Hardcoded origins. These assertions do not follow a renamed constant. */
const B4 = 'https://conumers-trust-hub-git-b4-lender-ask-710157-savitz25-s-projects.vercel.app';
const PARE = 'https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app';
const MOVE = 'https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app';
const PRODUCTION_ASK = 'https://www.asktrusthub.com';
const LENDER = 'https://lender-pilot.preview.example';
const browser = 'b'.repeat(43);
const now = 1_700_000_000_000;

const PRODUCTION_ENV: Env = {
  VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
  MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: PRODUCTION_ASK,
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: `https://${PRODUCTION_PROJECT}.supabase.co`,
  MY_TRUSTHUB_V23_PARENT_ORIGIN: PRODUCTION_ASK, MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com',
  MY_TRUSTHUB_V23_PRODUCTION_PROJECT: PRODUCTION_PROJECT, MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated',
};

function completeEnv(parent = B4): Env {
  return {
    ...fixtureEnv,
    NEXT_PUBLIC_SITE_URL: parent,
    MY_TRUSTHUB_TEST_ORIGIN: parent,
    MY_TRUSTHUB_V23_PARENT_ORIGIN: parent,
    MY_TRUSTHUB_V23_MOVE_ORIGIN: MOVE,
  };
}

function claimsOf(token: string): { aud: string; ask_origin: string; lender_origin: string; iss: string } {
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));
}

test('the complete isolated origin combination is the B4 Ask parent and the existing Move origin', () => {
  assert.equal(ASK_PREVIEW, B4);
  assert.equal(RETAINED_PARE_ASK_ORIGIN, PARE);
  assert.equal(MOVE_PREVIEW, MOVE);
  assert.equal(ISOLATED_TARGET.parentOrigin, B4);
  assert.equal(ISOLATED_TARGET.moveOrigin, MOVE);
  assert.equal(ISOLATED_TARGET.project, ISOLATED_PROJECT);
  assert.equal(ISOLATED_TARGET.login, PARENT_LOGIN);
  assert.equal(ISOLATED_TARGET.sqlPrefix, 'preview');
  assert.equal(ISOLATED_TARGET.assertionEnvironment, 'isolated');
  const opened = isolatedConfig(completeEnv());
  assert.equal(opened?.parentOrigin, B4);
  assert.equal(opened?.moveOrigin, MOVE);
  assert.equal(opened?.registry.origins.move, MOVE);
  assert.equal(opened?.registry.origins.lender, '');
  assert.equal(accountRuntime(completeEnv())?.origin, B4);
  assert.equal(accountRuntime(completeEnv())?.origin, opened?.parentOrigin);
  assert.equal(accountRuntime(completeEnv())?.backend, `https://${ISOLATED_PROJECT}.supabase.co`);
});

test('mixed retained pare and B4 origins stay closed', () => {
  assert.equal(isolatedConfig({ ...completeEnv(), MY_TRUSTHUB_V23_PARENT_ORIGIN: PARE }), null);
  assert.equal(isolatedConfig({ ...completeEnv(), NEXT_PUBLIC_SITE_URL: PARE, MY_TRUSTHUB_TEST_ORIGIN: PARE }), null);
  assert.equal(accountRuntime({ ...completeEnv(), NEXT_PUBLIC_SITE_URL: PARE, MY_TRUSTHUB_TEST_ORIGIN: PARE })?.origin, PARE);
  assert.equal(isolatedConfig({ ...completeEnv(), NEXT_PUBLIC_SITE_URL: B4, MY_TRUSTHUB_TEST_ORIGIN: PARE }), null);
  assert.equal(accountRuntime({ ...completeEnv(), NEXT_PUBLIC_SITE_URL: B4, MY_TRUSTHUB_TEST_ORIGIN: PARE }), null);
  assert.equal(isolatedConfig({ ...completeEnv(), MY_TRUSTHUB_V23_MOVE_ORIGIN: PARE }), null);
  assert.equal(isolatedConfig({ ...completeEnv(), MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com' }), null);
  const pin = { project_ref: ISOLATED_PROJECT, version: 'v23-parent-wiring/1', ask_origin: B4, move_origin: MOVE };
  const config = { target: ISOLATED_TARGET, parentOrigin: B4, moveOrigin: MOVE };
  assert.equal(previewDeploymentPinMatches(pin, config), true);
  assert.equal(previewDeploymentPinMatches({ ...pin, ask_origin: PARE }, config), false);
  assert.equal(previewDeploymentPinMatches({ ...pin, move_origin: PARE }, config), false);
});

test('browser account origin and server parent origin agree only on the B4 alias', () => {
  const agreed = completeEnv(B4);
  assert.equal(accountRuntime(agreed)?.origin, agreed.MY_TRUSTHUB_V23_PARENT_ORIGIN);
  assert.equal(isolatedConfig(agreed)?.parentOrigin, B4);
  const browserPare = { ...agreed, NEXT_PUBLIC_SITE_URL: PARE, MY_TRUSTHUB_TEST_ORIGIN: PARE };
  assert.equal(accountRuntime(browserPare)?.origin, PARE);
  assert.equal(isolatedConfig(browserPare), null);
  assert.notEqual(accountRuntime(browserPare)?.origin, B4);
  const serverPare = { ...agreed, MY_TRUSTHUB_V23_PARENT_ORIGIN: PARE };
  assert.equal(accountRuntime(serverPare)?.origin, B4);
  assert.equal(isolatedConfig(serverPare), null);
});

test('the B4 host, the retained pare host, the Move preview host, and production hosts are rejected as Lender destinations', () => {
  assert.equal(exactIsolatedLenderOrigin(LENDER), LENDER);
  for (const rejected of [
    B4, PARE, MOVE, PRODUCTION_ASK, 'https://asktrusthub.com',
    'https://www.consumerstrusthub.com', 'https://consumerstrusthub.com',
    PRODUCTION_ORIGINS.lender, PRODUCTION_ORIGINS.move, 'https://movetrusthub.com',
    'https://lendertrusthub.com', 'https://www.insurancetrusthub.com', 'https://insurancetrusthub.com',
    'https://www.contractortrusthub.com', 'https://contractortrusthub.com',
    'https://www.seniortrusthub.com', 'https://seniortrusthub.com',
    'https://www.investortrusthub.com', 'https://investortrusthub.com',
    LENDER + '/lenders/freedom-mortgage', LENDER + '?next=/',
  ]) assert.equal(exactIsolatedLenderOrigin(rejected), null, String(rejected));
  assert.equal(isolatedLenderPilotConfig({ ...completeEnv(), MY_TRUSTHUB_V23_LENDER_ORIGIN: B4 }), null);
  assert.equal(isolatedLenderPilotConfig({ ...completeEnv(), MY_TRUSTHUB_V23_LENDER_ORIGIN: PARE }), null);
  assert.equal(isolatedLenderPilotConfig({ ...completeEnv(), MY_TRUSTHUB_V23_LENDER_ORIGIN: MOVE }), null);
  const pilot = deploymentConfig({ ...completeEnv(), MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER });
  assert.equal(pilot?.parentOrigin, B4);
  assert.equal(pilot?.registry.origins.lender, LENDER);
  assert.equal(pilot?.registry.origins.move, MOVE);
});

test('the signed Lender audience uses the B4 origin', async () => {
  const pair = generateKeyPairSync('ed25519');
  const privateKey = { kid: 'lender-pilot-fixture', pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
  const publicKey = { kid: 'lender-pilot-fixture', pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  const pins = { parentOrigin: B4, lenderOrigin: LENDER, project: ISOLATED_PROJECT, assertionEnvironment: 'isolated' as const };
  const body = Buffer.from(JSON.stringify({ action: 'resolve' }));
  const target = B4 + '/api/my-trusthub/profile-save';
  const token = signLenderAssertion(privateKey, 'lender', target, 'transfer:stage', body, browser, null, null, now, pins);
  assert.equal(claimsOf(token).aud, target);
  assert.equal(claimsOf(token).ask_origin, B4);
  assert.equal(claimsOf(token).lender_origin, LENDER);
  assert.equal(claimsOf(token).iss, `urn:trusthub:v23:${ISOLATED_PROJECT}:lender`);
  const claims = await verifyLenderAssertion(new Request(target, { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body }), body, publicKey, 'lender', 'transfer:stage', { claim: async () => true }, now, pins);
  assert.equal(claims.ask_origin, B4);
  await assert.rejects(verifyLenderAssertion(new Request(PARE + '/api/my-trusthub/profile-save', { method: 'POST', headers: { [ASSERTION_HEADER]: token }, body }), body, publicKey, 'lender', 'transfer:stage', { claim: async () => true }, now, pins));
  assert.throws(() => signLenderAssertion(privateKey, 'lender', PARE + '/api/my-trusthub/profile-save', 'transfer:stage', body, browser, null, null, now, pins));
});

test('production admission stays on www.asktrusthub.com', () => {
  assert.equal(PRODUCTION_TARGET.parentOrigin, PRODUCTION_ASK);
  assert.equal(PRODUCTION_TARGET.project, PRODUCTION_PROJECT);
  assert.equal(PRODUCTION_TARGET.moveOrigin, PRODUCTION_ORIGINS.move);
  const production = deploymentConfig(PRODUCTION_ENV);
  assert.equal(production?.target, PRODUCTION_TARGET);
  assert.equal(production?.parentOrigin, PRODUCTION_ASK);
  assert.equal(production?.registry.origins.lender, PRODUCTION_ORIGINS.lender);
  assert.equal(deploymentConfig({ ...PRODUCTION_ENV, MY_TRUSTHUB_V23_PARENT_ORIGIN: B4 }), null);
  assert.equal(deploymentConfig({ ...PRODUCTION_ENV, MY_TRUSTHUB_V23_PARENT_ORIGIN: PARE }), null);
  assert.equal(deploymentConfig({ ...PRODUCTION_ENV, NEXT_PUBLIC_SITE_URL: B4 }), null);
  assert.equal(deploymentConfig({ ...PRODUCTION_ENV, MY_TRUSTHUB_V23_LENDER_ORIGIN: LENDER })?.parentOrigin, PRODUCTION_ASK);
  assert.equal(isolatedConfig(PRODUCTION_ENV), null);
});
