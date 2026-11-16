import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyticsIdentityForSession, INACTIVE_ANALYTICS_IDENTITY } from './identity-gate.ts';
import { enforcedDocumentContentSecurityPolicy } from './network-policy.ts';
import { CLASSIFICATION_ENUMS, prepareOutboundCapture } from './privacy.ts';
import { sanitizeAnalyticsRequestBody } from './sdk-guard.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const allowed = new Set<string>(Object.values(TRUSTHUB_EVENTS));
const credential = 'phc_synthetic_project_credential';
const fixtureId = '11111111-1111-4111-8111-111111111111';
const rejected = ['AUTHCODE739201', 'ELDERCARE_QUERY', 'CARE_FOR_MOTHER'];
const approved = {
  capability: 'HOW_TO',
  capability_state: 'SUPPORTED_RESULTS',
  profile_type: 'BUSINESS',
  provider_class: 'LICENSED',
  profile_class: 'VERIFIED',
};

function directive(policy: string, name: string): string {
  const part = policy.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name} `));
  assert.ok(part, name);
  return part;
}

test('the closed policy names every resource class and omits analytics hosts', () => {
  const policy = enforcedDocumentContentSecurityPolicy();
  assert.match(directive(policy, 'default-src'), /'none'/);
  assert.match(directive(policy, 'object-src'), /'none'/);
  assert.match(directive(policy, 'base-uri'), /'self'/);
  assert.match(directive(policy, 'form-action'), /'self'/);
  assert.match(directive(policy, 'form-action'), /https:\/\/www\.contractortrusthub\.com/);
  assert.match(directive(policy, 'img-src'), /'self'/);
  assert.match(directive(policy, 'frame-src'), /'self'/);
  assert.match(directive(policy, 'frame-src'), /https:\/\/challenges\.cloudflare\.com/);
  assert.match(directive(policy, 'child-src'), /'self'/);
  assert.match(directive(policy, 'worker-src'), /blob:/);
  assert.equal(directive(policy, 'script-src-elem').slice('script-src-elem '.length), directive(policy, 'script-src').slice('script-src '.length));
  assert.match(directive(policy, 'style-src'), /'unsafe-inline'/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  for (const host of ['posthog.com', 'i.posthog.com', 'google-analytics.com', 'googletagmanager.com', 'doubleclick.net']) {
    assert.equal(policy.includes(host), false, host);
  }
});

test('a closed identity gate ignores a synthetic authenticated session', () => {
  const body = analyticsIdentityForSession(false, { id: fixtureId });
  assert.deepEqual(body, INACTIVE_ANALYTICS_IDENTITY);
  assert.equal(JSON.stringify(body).includes(fixtureId), false);
  assert.equal(analyticsIdentityForSession(true, { id: fixtureId }).distinctId, fixtureId);
  assert.equal(analyticsIdentityForSession(true, { id: 'AUTHCODE739201' }).distinctId, null);
  assert.equal(analyticsIdentityForSession(true, { id: null }).distinctId, null);
  const route = readFileSync(join(root, 'app/api/analytics/identity/route.ts'), 'utf8');
  const handler = route.slice(route.indexOf('export async function GET'));
  const gate = handler.indexOf('if (!shouldEnablePosthog())');
  assert.ok(gate >= 0);
  assert.ok(gate < handler.indexOf('readSessionToken()'));
  assert.ok(gate < handler.indexOf('.getUser()'));
  assert.match(route, /INACTIVE_ANALYTICS_IDENTITY/);
});

test('unknown classification codes are dropped in properties and the serialized envelope', () => {
  for (const [key, value] of Object.entries(approved)) {
    assert.equal(CLASSIFICATION_ENUMS[key].has(value), true, key);
  }
  for (const code of rejected) {
    for (const key of Object.keys(CLASSIFICATION_ENUMS)) {
      assert.equal(CLASSIFICATION_ENUMS[key].has(code), false, code);
    }
  }
  const properties: Record<string, unknown> = {
    token: credential,
    hub: 'ask',
    ...approved,
    $set: { ...approved, capability: rejected[0] },
    $set_once: { profile_class: rejected[1], provider_class: 'LICENSED' },
  };
  for (const [key, code] of [
    ['capability', rejected[0]],
    ['capability_state', rejected[1]],
    ['profile_type', rejected[2]],
  ] as const) {
    properties[key] = code;
  }
  const event = prepareOutboundCapture({ event: 'search_submitted', properties }, allowed);
  assert.equal(event?.properties?.capability, undefined);
  assert.equal(event?.properties?.capability_state, undefined);
  assert.equal(event?.properties?.profile_type, undefined);
  assert.equal(event?.properties?.provider_class, 'LICENSED');
  assert.equal(event?.properties?.profile_class, 'VERIFIED');
  const set = event?.properties?.$set as Record<string, unknown>;
  assert.equal(set.capability, undefined);
  assert.equal(set.profile_type, 'BUSINESS');
  const once = event?.properties?.$set_once as Record<string, unknown>;
  assert.equal(once.profile_class, undefined);
  assert.equal(once.provider_class, 'LICENSED');
  assert.equal(JSON.stringify(event).includes(rejected[0]), false);

  const safe = prepareOutboundCapture(
    { event: 'search_submitted', properties: { token: credential, hub: 'ask', ...approved } },
    allowed,
  );
  const safeProperties = safe?.properties as Record<string, unknown> | undefined;
  for (const [key, value] of Object.entries(approved)) assert.equal(safeProperties?.[key], value);

  const encoded = sanitizeAnalyticsRequestBody(JSON.stringify({
    api_key: credential,
    batch: [{
      event: 'search_submitted',
      properties: {
        token: credential,
        hub: 'ask',
        capability: rejected[0],
        capability_state: rejected[1],
        profile_type: rejected[2],
        provider_class: 'LICENSED',
        profile_class: 'VERIFIED',
        $set: { capability: rejected[0] },
        $set_once: { profile_class: rejected[2] },
      },
    }],
  }));
  assert.ok(encoded);
  const envelope = JSON.parse(encoded);
  const packed = JSON.stringify(envelope);
  for (const code of rejected) assert.equal(packed.includes(code), false, code);
  assert.equal(envelope.batch[0].properties.provider_class, 'LICENSED');
  assert.equal(envelope.batch[0].properties.profile_class, 'VERIFIED');
  assert.equal(envelope.batch[0].properties.capability, undefined);
});
