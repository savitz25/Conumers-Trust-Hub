import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOpaqueTrustHubId,
  sanitizeAnalyticsUrl,
  sanitizeCapturedNetworkRequest,
  sanitizeCaptureResult,
  sanitizePageviewProperties,
  stripForbiddenProperties,
} from './privacy.ts';

test('sanitizeAnalyticsUrl strips Ask search and auth query keys', () => {
  const url = sanitizeAnalyticsUrl(
    'https://www.asktrusthub.com/ask?q=who%20owns%20this%20house&utm_source=x',
  );
  assert.equal(url, 'https://www.asktrusthub.com/ask?utm_source=x');
  const auth = sanitizeAnalyticsUrl('https://www.asktrusthub.com/auth/callback?code=secret&next=/my');
  assert.ok(auth);
  assert.doesNotMatch(auth, /secret/);
  assert.doesNotMatch(auth, /code=/);
});

test('stripForbiddenProperties drops raw search and identity fields', () => {
  const cleaned = stripForbiddenProperties({
    hub: 'ask',
    query: 'Find USDOT 3244649',
    email: 'person@example.com',
    usdot: '3244649',
    result_count: 3,
    success: true,
  });
  assert.deepEqual(cleaned, { hub: 'ask', result_count: 3, success: true });
});

test('Ask pageview titles do not keep raw search text', () => {
  const props = sanitizePageviewProperties({
    $pathname: '/ask',
    $title: 'Research: who owns this house | Ask Trust Hub',
    $current_url: 'https://www.asktrusthub.com/ask?q=who%20owns%20this%20house',
  });
  assert.equal(props.$title, 'Ask Trust Hub');
  assert.equal(props.$current_url, 'https://www.asktrusthub.com/ask');
});

test('opaque Trust Hub ids must be UUIDs, not emails or licenses', () => {
  assert.equal(isOpaqueTrustHubId('2f1c0b5a-3c4d-4e5f-8a9b-0c1d2e3f4a5b'), true);
  assert.equal(isOpaqueTrustHubId('person@example.com'), false);
  assert.equal(isOpaqueTrustHubId('USDOT 3244649'), false);
  assert.equal(isOpaqueTrustHubId('NMLS 123456'), false);
});

test('before_send sanitizer keeps PostHog token and distinct_id', () => {
  const event = sanitizeCaptureResult({
    event: '$pageview',
    properties: {
      token: 'phc_test_token',
      distinct_id: 'anon-1',
      $current_url: 'https://www.asktrusthub.com/ask?q=secret+question',
      $pathname: '/ask',
      $title: 'Research: secret question | Ask Trust Hub',
      query: 'secret question',
      email: 'person@example.com',
      hub: 'ask',
    },
  });
  assert.equal(event?.properties?.token, 'phc_test_token');
  assert.equal(event?.properties?.distinct_id, 'anon-1');
  assert.equal(event?.properties?.$current_url, 'https://www.asktrusthub.com/ask');
  assert.equal(event?.properties?.$title, 'Ask Trust Hub');
  assert.equal(event?.properties?.query, undefined);
  assert.equal(event?.properties?.email, undefined);
  assert.equal(event?.properties?.hub, 'ask');
  assert.ok(event);
});

test('before_send never returns undefined for a valid capture payload', () => {
  const result = sanitizeCaptureResult({
    event: 'search_submitted',
    properties: { token: 'phc_test_token', hub: 'ask' },
  });
  assert.equal(result == null, false);
  assert.equal(result?.event, 'search_submitted');
  assert.equal(result?.properties?.token, 'phc_test_token');
});

test('recording start_url analogue strips Ask q via network mask helper', () => {
  const request = sanitizeCapturedNetworkRequest({
    name: 'https://www.asktrusthub.com/ask?q=licensed+electrician+in+fort+lauderdale',
  });
  assert.equal(request.name, 'https://www.asktrusthub.com/ask');
});

