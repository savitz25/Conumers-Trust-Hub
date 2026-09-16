import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOpaqueTrustHubId,
  sanitizeAnalyticsUrl,
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

test('opaque Trust Hub ids must be UUIDs, not emails or licenses', () => {
  assert.equal(isOpaqueTrustHubId('2f1c0b5a-3c4d-4e5f-8a9b-0c1d2e3f4a5b'), true);
  assert.equal(isOpaqueTrustHubId('person@example.com'), false);
  assert.equal(isOpaqueTrustHubId('USDOT 3244649'), false);
  assert.equal(isOpaqueTrustHubId('NMLS 123456'), false);
});
