import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { deploymentBindings } from './deployment.ts';
import { deploymentConfig, deploymentEnabled, isolatedConfig, productionConfig, productionHandoffEnabled,
  ISOLATED_TARGET, PRODUCTION_TARGET, sqlName } from './isolated-config.ts';
import { databaseConnectionConfig } from './database-config.ts';
import { sessionMacMessage } from './session-authority.ts';
import { signAssertion, verifyAssertion } from './service-assertion.ts';
import { trustedRegistry } from './runtime.ts';

const PRODUCTION_ENV = {
  VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
  MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: 'https://www.asktrusthub.com',
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://qvvxvbcdmbjzrgvwjatw.supabase.co',
  MY_TRUSTHUB_V23_PARENT_ORIGIN: 'https://www.asktrusthub.com', MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com',
  MY_TRUSTHUB_V23_PRODUCTION_PROJECT: 'qvvxvbcdmbjzrgvwjatw', MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated',
};

test('P01 production stays denied without the explicit handoff flag and exact pins', () => {
  const withoutFlag = Object.fromEntries(Object.entries(PRODUCTION_ENV).filter(([name]) => name !== 'MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED'));
  assert.equal(productionHandoffEnabled(withoutFlag), false);
  assert.equal(deploymentEnabled(withoutFlag), false);
  assert.equal(deploymentBindings(withoutFlag).enabled, false);
  for (const patch of [
    { NEXT_PUBLIC_SITE_URL: 'https://asktrusthub.com' },
    { MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app' },
    { MY_TRUSTHUB_V23_PRODUCTION_PROJECT: 'xkkiicsassizmakcvxml' },
    { NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://xkkiicsassizmakcvxml.supabase.co' },
    { MY_TRUSTHUB_V23_ISOLATED_PROJECT: 'xkkiicsassizmakcvxml' },
    { MY_TRUSTHUB_NONPRODUCTION_APPROVED: 'true' },
    { VERCEL_ENV: 'preview' },
    { MY_TRUSTHUB_V23_SESSION_AFFINITY: 'pooled' },
  ]) {
    assert.equal(productionHandoffEnabled({ ...PRODUCTION_ENV, ...patch }), false, JSON.stringify(patch));
    assert.equal(productionConfig({ ...PRODUCTION_ENV, ...patch }), null, JSON.stringify(patch));
  }
});

test('P02 exact production pins resolve the production target and never the isolated one', () => {
  assert.equal(productionHandoffEnabled(PRODUCTION_ENV), true);
  const c = deploymentConfig(PRODUCTION_ENV);
  assert.ok(c);
  assert.equal(c.target.kind, 'production');
  assert.equal(c.target, PRODUCTION_TARGET);
  assert.equal(c.registry.environment, 'production');
  assert.equal(c.registry.isolatedBackendVerified, false);
  assert.equal(c.registry.origins.move, 'https://www.movetrusthub.com');
  assert.equal(isolatedConfig(PRODUCTION_ENV), null);
  assert.equal(sqlName(PRODUCTION_TARGET, 'ports_ready'), 'v23_private.prod_ports_ready');
  assert.equal(sqlName(ISOLATED_TARGET, 'ports_ready'), 'v23_private.preview_ports_ready');
  assert.equal(trustedRegistry(c.registry), true);
  assert.equal(trustedRegistry({ environment: 'production', isolatedBackendVerified: true }), false);
  assert.equal(trustedRegistry({ environment: 'isolated', isolatedBackendVerified: false }), false);
});

test('P03 production database endpoint requires the production login and project', () => {
  const base = { MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE: 'SUPAVISOR_SESSION', MY_TRUSTHUB_V23_DATABASE_CA_PEM: 'ca',
    MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST: 'aws-0-us-east-1.pooler.supabase.com' };
  const good = { ...base, MY_TRUSTHUB_V23_PARENT_DATABASE_URL: 'postgresql://myth_v23_parent_prod.qvvxvbcdmbjzrgvwjatw:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres' };
  assert.equal(databaseConnectionConfig(good, PRODUCTION_TARGET)?.user, 'myth_v23_parent_prod.qvvxvbcdmbjzrgvwjatw');
  assert.equal(databaseConnectionConfig(good, ISOLATED_TARGET), null);
  const preview = { ...base, MY_TRUSTHUB_V23_PARENT_DATABASE_URL: 'postgresql://myth_v23_parent_preview.xkkiicsassizmakcvxml:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres' };
  assert.equal(databaseConnectionConfig(preview, PRODUCTION_TARGET), null);
  assert.equal(databaseConnectionConfig(preview, ISOLATED_TARGET)?.user, 'myth_v23_parent_preview.xkkiicsassizmakcvxml');
  const direct = { ...base, MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE: 'DIRECT', MY_TRUSTHUB_V23_PARENT_DATABASE_URL: 'postgresql://myth_v23_parent_prod:pw@db.qvvxvbcdmbjzrgvwjatw.supabase.co:5432/postgres' };
  assert.equal(databaseConnectionConfig(direct, PRODUCTION_TARGET)?.host, 'db.qvvxvbcdmbjzrgvwjatw.supabase.co');
});

test('P04 session MAC message and service assertions are pinned per target', async () => {
  assert.notEqual(sessionMacMessage('S', 'T', 1, 'qvvxvbcdmbjzrgvwjatw'), sessionMacMessage('S', 'T', 1));
  assert.match(sessionMacMessage('S', 'T', 1, 'qvvxvbcdmbjzrgvwjatw'), /\|qvvxvbcdmbjzrgvwjatw\|/);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const key = { kid: 'k', pem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
  const pub = { kid: 'k', pem: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  const browser = 'A'.repeat(43), body = Buffer.from('{"a":1}');
  const target = 'https://www.asktrusthub.com/api/my-trusthub/profile-save';
  const assertion = signAssertion(key, 'move', target, 'transfer:stage', body, browser, null, null, Date.now(), PRODUCTION_TARGET);
  const nonces = { claim: async () => true };
  const request = new Request(target, { method: 'POST', headers: { 'x-trusthub-v23-assertion': assertion } });
  const claims = await verifyAssertion(request, body, pub, 'move', 'transfer:stage', nonces, Date.now(), PRODUCTION_TARGET);
  assert.equal(claims.iss, 'urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:move');
  assert.equal(claims.sub, 'svc:trusthub:move:v23:production');
  await assert.rejects(verifyAssertion(request, body, pub, 'move', 'transfer:stage', nonces, Date.now(), ISOLATED_TARGET));
  assert.throws(() => signAssertion(key, 'move', target, 'transfer:stage', body, browser, null, null, Date.now(), ISOLATED_TARGET));
});
