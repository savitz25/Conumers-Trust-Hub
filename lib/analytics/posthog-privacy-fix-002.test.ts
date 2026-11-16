import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { prepareOutboundCapture, privacyDiagnostics, sanitizeAnalyticsUrl, sanitizeCaptureEnvelope } from './privacy.ts';
import { sanitizeAnalyticsRequestBody } from './sdk-guard.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const allowed = new Set<string>(Object.values(TRUSTHUB_EVENTS));
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const secrets = {
  search: 'C3PrivateSearch739201',
  auth: 'C3Auth739201',
  token: 'C3Token739201',
  password: 'C3Password739201',
};
const credential = 'phc_synthetic_project_credential';

function leaked(value: unknown): boolean {
  const text = JSON.stringify(value);
  return Object.values(secrets).some((secret) => text.includes(secret));
}

const urlInputs = [
  `https://qa.invalid/?%2571=${secrets.search}`,
  `https://qa.invalid/?%252571=${secrets.search}`,
  `https://qa.invalid/?%25252571=${secrets.search}`,
  `https://qa.invalid/?searchTerm=${secrets.search}`,
  `https://qa.invalid/?SeArCh-TeRm=${secrets.search}`,
  `https://qa.invalid/?AUTH_CODE=${secrets.auth}&id_token=${secrets.token}`,
  `https://qa.invalid/?next=${encodeURIComponent(`https://nested.invalid/?password=${secrets.password}`)}`,
  `https://qa.invalid/?next=${encodeURIComponent(`https://nested.invalid/?next=${encodeURIComponent(`https://deep.invalid/?token=${secrets.token}`)}`)}`,
  `https://qa.invalid/?next=%E0%A4%A&utm_source=safe`,
  `https://qa.invalid/?next=${'https%253A%252F%252Fn.invalid%252F%253Fauth_code%253D' + secrets.auth}`,
  'https://qa.invalid/?utm_source=one&utm_source=two',
  'https://qa.invalid/?utm-source=newsletter&utm_source=newsletter',
  'https://qa.invalid/?utm_source=ok&next=%ZZ',
  'https://qa.invalid/?utm_source=a%2Fsafe',
];

test('malformed percent encoding is rejected before URL normalization', () => {
  const malformed = sanitizeAnalyticsUrl(urlInputs[8]);
  assert.equal(malformed, undefined);
  assert.equal(String(malformed).includes('%EF%BF%BD'), false);
  assert.equal(sanitizeAnalyticsUrl('https://qa.invalid/?utm_source=ok&q=%E0%A4%A'), undefined);
  assert.equal(sanitizeAnalyticsUrl('https://qa.invalid/?utm_source=safe%'), undefined);
  assert.equal(sanitizeAnalyticsUrl(urlInputs[12]), undefined);
  const repeated = urlInputs.slice(0, 8).map((input) => sanitizeAnalyticsUrl(input));
  assert.equal(leaked(repeated), false);
  const same = sanitizeAnalyticsUrl(urlInputs[11]);
  assert.match(same ?? '', /utm_source=newsletter/);
  assert.equal((same ?? '').split('utm_source=').length, 2);
  const ambiguous = sanitizeAnalyticsUrl(urlInputs[10]);
  assert.equal(ambiguous?.includes('utm_source'), false);
  assert.equal(privacyDiagnostics().malformed_url > 0, true);
});

test('approved properties reject sensitive values, arbitrary dollar keys, objects, and arrays', () => {
  const event = prepareOutboundCapture(
    {
      event: 'search_submitted',
      properties: {
        token: credential,
        hub: 'ask',
        surface: 'search',
        success: true,
        capability: secrets.search,
        capability_state: 'SUPPORTED_RESULTS',
        $custom_context: secrets.password,
        $feature_flag_payloads: [secrets.token],
        $lib: 'web',
        nested: { capability: secrets.search, note: secrets.password },
        $set: { hub: 'ask', $user_id: secrets.auth, capability: secrets.search, token: 'phc_person' },
        $current_url: urlInputs[0],
        $referrer: urlInputs[5],
        distinct_id: secrets.auth,
        $device_id: secrets.auth,
        $user_id: secrets.auth,
      },
    },
    allowed,
  );
  assert.equal(leaked(event), false);
  assert.equal(event?.properties?.token, credential);
  assert.equal(event?.properties?.hub, 'ask');
  assert.equal(event?.properties?.capability, undefined);
  assert.equal(event?.properties?.capability_state, 'SUPPORTED_RESULTS');
  assert.equal(event?.properties?.$custom_context, undefined);
  assert.equal(event?.properties?.$feature_flag_payloads, undefined);
  assert.equal(event?.properties?.nested, undefined);
  const set = event?.properties?.$set as Record<string, unknown>;
  assert.equal(set.hub, 'ask');
  assert.equal(set.capability, undefined);
  assert.equal(set.token, undefined);
  assert.equal(set.$user_id, undefined);
  const safe = prepareOutboundCapture(
    { event: 'search_submitted', properties: { token: 'phc_test', hub: 'ask', capability: 'HOW_TO', success: true } },
    allowed,
  );
  assert.equal(safe?.properties?.capability, 'HOW_TO');
});

test('the serialized transport body keeps only the project credential in transport slots', () => {
  const encoded = sanitizeAnalyticsRequestBody(
    JSON.stringify({
      api_key: credential,
      batch: [
        {
          event: 'search_submitted',
          distinct_id: secrets.auth,
          properties: {
            token: credential,
            distinct_id: secrets.auth,
            $device_id: secrets.auth,
            $user_id: secrets.auth,
            capability: secrets.search,
            $custom_context: secrets.password,
            $feature_flag_payloads: [secrets.token],
            $current_url: urlInputs[0],
            $referrer: urlInputs[5],
            $set: { capability: secrets.search, token: 'phc_person' },
          },
        },
      ],
    }),
  );
  assert.ok(encoded);
  const transport = JSON.parse(encoded);
  assert.equal(leaked(transport), false);
  assert.equal(transport.api_key, credential);
  assert.equal(transport.batch[0].properties.token, credential);
  assert.equal(transport.batch[0].distinct_id, undefined);
  assert.equal(JSON.stringify(transport).includes('phc_person'), false);
  assert.equal(transport.batch[0].properties.$feature_flag_payloads, undefined);
  const direct = sanitizeCaptureEnvelope(
    {
      api_key: credential,
      event: 'search_submitted',
      properties: { hub: 'ask', $custom_context: secrets.password, items: [secrets.token] },
    },
    allowed,
  );
  assert.equal(leaked(direct), false);
  assert.equal((direct as { api_key?: string }).api_key, credential);
});

test('the transport block is the first head script in the layout source', () => {
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
  const head = layout.indexOf('<head>');
  const body = layout.indexOf('<body');
  const call = layout.indexOf('analyticsTransportBlockScript(posthogHost())', head);
  const headHtml = layout.slice(head, body);
  assert.ok(head > 0);
  assert.ok(call > head);
  assert.ok(body > call);
  assert.equal(headHtml.match(/<script/g)?.length, 1);
});
