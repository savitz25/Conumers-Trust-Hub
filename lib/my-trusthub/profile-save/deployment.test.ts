import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentBindings } from './deployment.ts';
import { handleProfileSave } from './http.ts';

test('D01 default OFF and unconditional production deny even when every feature flag is on', async () => {
  assert.equal(deploymentBindings({}).enabled, false);
  const env = { VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true',
    MY_TRUSTHUB_SAVED_ENABLED: 'true', MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true' };
  assert.equal(deploymentBindings(env).enabled, false);
  const response = await handleProfileSave(new Request('https://www.asktrusthub.com/api/my-trusthub/profile-save', { method: 'POST' }), deploymentBindings(env));
  assert.equal(response.status, 404);
});
test('D02 isolated configuration without reviewed adapters remains unavailable; no credential fallback', async () => {
  const env = { VERCEL_ENV: 'preview', MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true',
    MY_TRUSTHUB_SAVED_ENABLED: 'true', MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', MY_TRUSTHUB_NONPRODUCTION_APPROVED: 'true',
    NEXT_PUBLIC_SITE_URL: 'https://fixture.invalid', MY_TRUSTHUB_TEST_ORIGIN: 'https://fixture.invalid',
    NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: 'https://isolated-fixture.invalid', MY_TRUSTHUB_TEST_SUPABASE_URL: 'https://isolated-fixture.invalid' };
  const bindings = deploymentBindings(env);
  assert.equal(bindings.enabled, true);
  const response = await handleProfileSave(new Request('https://fixture.invalid/api/my-trusthub/profile-save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), bindings);
  assert.equal(response.status, 503);
});
