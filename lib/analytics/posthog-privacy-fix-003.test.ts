import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareOutboundCapture, sanitizeAnalyticsUrl, sanitizeCaptureEnvelope } from './privacy.ts';
import { sanitizeAnalyticsRequestBody } from './sdk-guard.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const allowed = new Set<string>(Object.values(TRUSTHUB_EVENTS));
const marker = 'C3PrivatePath739201';
const email = 'c3-private-739201@example.invalid';
const credential = 'phc_synthetic_project_credential';
const encodedMarker = '%43%33%50%72%69%76%61%74%65%50%61%74%68%37%33%39%32%30%31';
const doubleEncodedMarker = encodedMarker.replace(/%/g, '%25');
const urlFields = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$session_entry_url',
  '$entry_current_url',
  '$initial_referrer',
  '$session_entry_referrer',
  '$prev_pageview_url',
] as const;

const variants = [
  marker,
  `/${marker}`,
  `https://qa.invalid/account/${marker}`,
  `https://user:${marker}@qa.invalid/safe`,
  `https://qa.invalid/${encodedMarker}`,
  `https://qa.invalid/${doubleEncodedMarker}`,
  `https://qa.invalid/ask?next=/${marker}`,
  `https://qa.invalid/search/../account/${marker}`,
  `https://qa.invalid/not-a-public-page`,
  `https://qa.invalid/account/user-123`,
  `https://qa.invalid/business/${marker}`,
  `https://qa.invalid/profile/${email}`,
  `https://qa.invalid/my/projects/${marker}`,
  `https://qa.invalid/ask?q=${marker}`,
  `https://qa.invalid/?next=%E0%A4%A`,
];

function leaked(value: unknown): boolean {
  const text = JSON.stringify(value) ?? '';
  return text.includes(marker) || text.toLowerCase().includes(encodedMarker.toLowerCase()) || text.includes(email) || text.includes(doubleEncodedMarker);
}

test('pathname policy rejects C3 R3 path fixtures in the serialized envelope', () => {
  assert.equal(urlFields.length, 8);
  for (const value of variants) {
    const properties: Record<string, unknown> = { token: credential, hub: 'ask', $pathname: value };
    for (const field of urlFields) properties[field] = value;
    const encoded = sanitizeAnalyticsRequestBody(JSON.stringify({
      api_key: credential,
      token: credential,
      batch: [{ event: 'search_submitted', distinct_id: marker, properties }],
    }));
    assert.ok(encoded, value);
    const body = JSON.parse(encoded);
    assert.equal(leaked(body), false, value);
    assert.equal(body.api_key, credential);
    assert.equal(body.token, credential);
    assert.equal(body.batch[0].properties.token, credential);
    assert.equal(body.batch[0].distinct_id, undefined);
    assert.equal(body.batch[0].properties.$pathname, '/');
  }
});

test('absolute public routes stay, and relative or dynamic paths cannot re-enter the body', () => {
  assert.equal(sanitizeAnalyticsUrl(marker), undefined);
  assert.equal(sanitizeAnalyticsUrl(`/${marker}`), undefined);
  assert.equal(sanitizeAnalyticsUrl('not a url at all'), undefined);
  assert.equal(sanitizeAnalyticsUrl(`https://qa.invalid/account/${marker}`), 'https://qa.invalid/');
  assert.equal(sanitizeAnalyticsUrl(`https://qa.invalid/${encodedMarker}`), 'https://qa.invalid/');
  assert.equal(sanitizeAnalyticsUrl(`https://qa.invalid/${doubleEncodedMarker}`), 'https://qa.invalid/');
  assert.equal(sanitizeAnalyticsUrl('https://qa.invalid/not-a-public-page'), 'https://qa.invalid/');
  assert.equal(sanitizeAnalyticsUrl('https://www.asktrusthub.com/ask?q=who%20owns%20this%20house'), 'https://www.asktrusthub.com/ask');
  assert.equal(sanitizeAnalyticsUrl(`https://user:${marker}@qa.invalid/ask`), undefined);

  const event = prepareOutboundCapture({
    event: 'search_submitted',
    properties: {
      token: credential,
      hub: 'ask',
      $pathname: `/account/${marker}`,
      $current_url: `https://qa.invalid/business/${marker}`,
      $referrer: `https://qa.invalid/people/${email}`,
    },
  }, allowed);
  assert.ok(event);
  assert.equal(leaked(event), false);
  assert.equal(event.properties?.$pathname, '/');
  assert.equal(event.properties?.$current_url, 'https://qa.invalid/');
  assert.equal(event.properties?.token, credential);

  const direct = sanitizeCaptureEnvelope({
    api_key: credential,
    batch: [{
      event: 'search_submitted',
      properties: {
        token: credential,
        $pathname: `/${marker}`,
        $prev_pageview_url: `https://qa.invalid/profile/${marker}?next=/account/${marker}`,
      },
    }],
  }, allowed);
  assert.equal(leaked(direct), false);
  assert.equal((direct as { api_key: string }).api_key, credential);
});
