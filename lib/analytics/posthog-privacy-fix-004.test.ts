import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareOutboundCapture, sanitizeAnalyticsUrl, sanitizeCaptureEnvelope } from './privacy.ts';
import { sanitizeAnalyticsRequestBody } from './sdk-guard.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const allowed = new Set<string>(Object.values(TRUSTHUB_EVENTS));
const credential = 'phc_synthetic_project_credential';
const markers = ['C3PrivatePath739201', 'C3PRIVATEPATH739201'] as const;
const email = 'c3-private-739201@example.invalid';
const secrets = {
  search: 'C3PrivateSearch739201',
  auth: 'C3Auth739201',
  token: 'C3Token739201',
  password: 'C3Password739201',
};
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
const queryKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'page',
  'sort',
  'ref',
  'next',
  'view',
  'form',
] as const;
const safePaths = ['/', '/ask', '/search', '/claim', '/privacy', '/privacy-policy', '/verify-dot', '/companies'];

function leaked(value: unknown): boolean {
  const text = JSON.stringify(value) ?? '';
  return (
    markers.some((marker) => text.includes(marker) || text.includes(encodeURIComponent(marker)))
    || Object.values(secrets).some((secret) => text.includes(secret))
    || text.includes(email)
  );
}

function bodyFor(properties: Record<string, unknown>): string | null {
  return sanitizeAnalyticsRequestBody(JSON.stringify({
    api_key: credential,
    token: credential,
    batch: [{ event: 'search_submitted', distinct_id: markers[0], properties }],
  }));
}

test('C3 R4 query keys are absent from every approved URL field in the serialized body', () => {
  assert.equal(urlFields.length, 8);
  assert.equal(queryKeys.length, 12);
  for (const key of queryKeys) {
    for (const marker of markers) {
      for (const field of urlFields) {
        const variants = [
          `https://qa.invalid/search?${key}=${marker}`,
          `https://qa.invalid/search?${key.toUpperCase()}=${encodeURIComponent(marker)}`,
          `https://qa.invalid/search?${key}=${encodeURIComponent(encodeURIComponent(marker))}`,
          `https://qa.invalid/search?${key}=${encodeURIComponent(`https://nested.invalid/account/${marker}`)}`,
        ];
        for (const raw of variants) {
          const direct = sanitizeAnalyticsUrl(raw);
          assert.equal(direct, 'https://qa.invalid/search', raw);
          assert.equal(direct?.includes('?'), false, raw);
          const encoded = bodyFor({ token: credential, hub: 'ask', [field]: raw, $pathname: `/account/${marker}` });
          assert.ok(encoded, raw);
          const envelope = JSON.parse(encoded);
          assert.equal(leaked(envelope), false, raw);
          assert.equal(envelope.batch[0].properties[field], 'https://qa.invalid/search', raw);
          assert.equal(JSON.stringify(envelope.batch[0].properties[field]).includes('?'), false, raw);
          assert.equal(envelope.batch[0].properties.$pathname, '/');
          assert.equal(envelope.api_key, credential);
          assert.equal(envelope.token, credential);
          assert.equal(envelope.batch[0].properties.token, credential);
          assert.equal(envelope.batch[0].distinct_id, undefined);
        }
      }
    }
  }

  const properties: Record<string, unknown> = { token: credential, hub: 'ask' };
  urlFields.forEach((field, index) => {
    properties[field] = `https://qa.invalid/search?${queryKeys[index]}=${markers[1]}`;
  });
  const encoded = bodyFor(properties);
  assert.ok(encoded);
  const envelope = JSON.parse(encoded);
  assert.equal(leaked(envelope), false);
  for (const field of urlFields) {
    assert.equal(envelope.batch[0].properties[field], 'https://qa.invalid/search');
    assert.equal(String(envelope.batch[0].properties[field]).includes('?'), false);
  }
  assert.equal(envelope.api_key, credential);
  assert.equal(envelope.batch[0].properties.token, credential);
});

test('malformed, relative, and pathname fixtures stay out of the serialized body', () => {
  for (const key of queryKeys) {
    assert.equal(sanitizeAnalyticsUrl(`https://qa.invalid/search?${key}=%E0%A4%A`), undefined);
    assert.equal(sanitizeAnalyticsUrl(`https://qa.invalid/search?${key}=%ZZ`), undefined);
    const encoded = bodyFor({
      token: credential,
      hub: 'ask',
      $current_url: `https://qa.invalid/search?${key}=${markers[1]}&next=%E0%A4%A`,
    });
    assert.ok(encoded);
    assert.equal(leaked(JSON.parse(encoded)), false);
    assert.equal(JSON.parse(encoded).batch[0].properties.$current_url, undefined);
  }

  for (const field of urlFields) {
    for (const raw of [markers[0], `/${markers[0]}`]) {
      const capture = prepareOutboundCapture({ event: 'search_submitted', properties: { token: credential, hub: 'ask', [field]: raw } }, allowed);
      assert.equal(capture?.properties?.[field], undefined);
    }
    for (const raw of [
      `https://qa.invalid/private/${markers[0]}`,
      `https://qa.invalid/${encodeURIComponent(markers[0])}`,
      `https://qa.invalid/${encodeURIComponent(encodeURIComponent(markers[0]))}`,
      `https://qa.invalid/%43%33%50%72%69%76%61%74%65%50%61%74%68%37%33%39%32%30%31`,
      `https://user:${markers[0]}@qa.invalid/search`,
    ]) {
      const capture = prepareOutboundCapture({ event: 'search_submitted', properties: { token: credential, hub: 'ask', [field]: raw } }, allowed);
      const value = capture?.properties?.[field];
      assert.equal(leaked(value), false, raw);
      if (typeof value === 'string') assert.equal(new URL(value).pathname, '/');
    }
  }

  for (const safePath of safePaths) {
    assert.equal(sanitizeAnalyticsUrl(`https://qa.invalid${safePath}`), `https://qa.invalid${safePath}`);
    const capture = prepareOutboundCapture({ event: 'search_submitted', properties: { token: credential, hub: 'ask', $pathname: safePath } }, allowed);
    assert.equal(capture?.properties?.$pathname, safePath);
  }
  for (const unsafePath of [`/account/${markers[0]}`, `/companies/${markers[0]}`, `/search/${markers[0]}`, '/dynamic/123']) {
    assert.equal(new URL(sanitizeAnalyticsUrl(`https://qa.invalid${unsafePath}`)!).pathname, '/');
  }
});

test('R2 property leakage stays out of the final envelope', () => {
  const event = prepareOutboundCapture({
    event: 'search_submitted',
    properties: {
      token: credential,
      hub: 'ask',
      email: email,
      password: secrets.password,
      query: secrets.search,
      searchTerm: secrets.search,
      accountId: secrets.auth,
      distinct_id: secrets.auth,
      $device_id: secrets.auth,
      $user_id: secrets.auth,
      $custom_context: secrets.password,
      $feature_flag_payloads: [secrets.token],
      nested: { note: secrets.password },
      $set: { hub: 'ask', $user_id: secrets.auth, token: 'phc_person', capability: secrets.search },
      $current_url: `https://qa.invalid/search?utm_source=${secrets.search}&next=${encodeURIComponent(`https://nested.invalid/?token=${secrets.token}`)}`,
    },
  }, allowed);
  const envelope = sanitizeCaptureEnvelope({
    api_key: credential,
    token: credential,
    batch: [event],
    distinct_id: secrets.auth,
  }, allowed);
  assert.equal(leaked(envelope), false);
  const encoded = sanitizeAnalyticsRequestBody(JSON.stringify({
    api_key: credential,
    token: credential,
    distinct_id: secrets.auth,
    batch: [{
      event: 'search_submitted',
      properties: {
        token: credential,
        hub: 'ask',
        email,
        password: secrets.password,
        query: secrets.search,
        $current_url: `https://qa.invalid/search?form=${secrets.password}`,
        $referrer: `https://qa.invalid/ask?utm_id=${encodeURIComponent(email)}`,
      },
    }],
  }));
  assert.ok(encoded);
  assert.equal(leaked(encoded), false);
  assert.equal(encoded.includes('?'), false);
  assert.equal(JSON.parse(encoded).api_key, credential);
  assert.equal(JSON.parse(encoded).batch[0].properties.token, credential);
  assert.equal(JSON.parse(encoded).batch[0].properties.$current_url, 'https://qa.invalid/search');
  assert.equal(JSON.parse(encoded).batch[0].properties.$referrer, 'https://qa.invalid/ask');
});
