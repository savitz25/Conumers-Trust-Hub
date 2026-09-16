import assert from 'node:assert/strict';
import test from 'node:test';
import { captureTrustEvent, identifyTrustHubUser } from './trusthub.ts';
// Node tests must not initialize the browser SDK.

test('captureTrustEvent never throws when PostHog is unavailable', () => {
  assert.doesNotThrow(() => captureTrustEvent('search_submitted', { query: 'secret question', email: 'a@b.c' }));
});

test('identifyTrustHubUser ignores email and names', () => {
  assert.doesNotThrow(() => identifyTrustHubUser('person@example.com'));
  assert.doesNotThrow(() => identifyTrustHubUser('Jane Doe'));
  assert.doesNotThrow(() => identifyTrustHubUser('USDOT 3244649'));
});
