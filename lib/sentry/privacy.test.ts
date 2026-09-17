import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPrivateSentryPath,
  isSensitiveSentryKey,
  redactSecretText,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from './privacy.ts';

test('ATH-REL-001A: private My TrustHub and claim paths are identified', () => {
  assert.equal(isPrivateSentryPath('/my/notes'), true);
  assert.equal(isPrivateSentryPath('/auth/callback'), true);
  assert.equal(isPrivateSentryPath('/claim/continue'), true);
  assert.equal(isPrivateSentryPath('/api/customer/claim/submit'), true);
  assert.equal(isPrivateSentryPath('/ask'), false);
});

test('ATH-REL-001A: beforeSend strips Ask query, auth headers, and bodies', () => {
  const event = scrubSentryEvent({
    request: {
      url: 'https://www.asktrusthub.com/ask?q=who%20owns%20this%20house&utm_source=x',
      query_string: 'q=who+owns+this+house&utm_source=x',
      headers: {
        Authorization: 'Bearer super-secret',
        cookie: 'session=abc',
        'content-type': 'application/json',
      },
      cookies: { session: 'abc' },
      data: { question: 'who owns this house', password: 'hunter2' },
    },
    user: { id: 'person@example.com', email: 'person@example.com', ip_address: '1.2.3.4' },
    extra: { query: 'who owns this house', hub: 'ask', notes: 'private note' },
    tags: { authorization: 'Bearer x', hub: 'ask' },
    exception: { values: [{ type: 'Error', value: 'failed Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb' }] },
  });

  assert.equal(event.request?.url, 'https://www.asktrusthub.com/ask?utm_source=x');
  assert.doesNotMatch(String(event.request?.query_string), /who/);
  assert.equal(event.request?.headers?.Authorization, '[Filtered]');
  assert.equal(event.request?.headers?.cookie, '[Filtered]');
  assert.equal(event.request?.data, undefined);
  assert.equal(event.request?.cookies, undefined);
  assert.equal(event.user, null);
  assert.equal(event.extra?.query, undefined);
  assert.equal(event.extra?.notes, undefined);
  assert.equal(event.extra?.hub, 'ask');
  assert.equal(event.tags?.authorization, undefined);
  assert.equal(event.tags?.hub, 'ask');
  assert.equal(event.exception?.values?.[0]?.value?.includes('Bearer [Filtered]'), true);
});

test('ATH-REL-001A: opaque UUID user ids may be kept', () => {
  const event = scrubSentryEvent({
    user: { id: '2f1c0b5a-3c4d-4e5f-8a9b-0c1d2e3f4a5b', email: 'person@example.com' },
  });
  assert.deepEqual(event.user, { id: '2f1c0b5a-3c4d-4e5f-8a9b-0c1d2e3f4a5b' });
});

test('ATH-REL-001A: password field breadcrumbs are dropped', () => {
  assert.equal(scrubSentryBreadcrumb({ category: 'ui.input', message: 'typed in password' }), null);
  const http = scrubSentryBreadcrumb({
    category: 'http',
    data: { url: 'https://www.asktrusthub.com/ask?q=secret+question', method: 'GET' },
  });
  assert.ok(http?.data);
  assert.equal(http?.data?.url, 'https://www.asktrusthub.com/ask');
});

test('ATH-REL-001A: sensitive keys match privacy.ts plus secrets', () => {
  assert.equal(isSensitiveSentryKey('password'), true);
  assert.equal(isSensitiveSentryKey('authorization'), true);
  assert.equal(isSensitiveSentryKey('notes'), true);
  assert.equal(isSensitiveSentryKey('hub'), false);
  assert.match(redactSecretText('Authorization: Bearer abc.def'), /\[Filtered\]/);
});
