import assert from 'node:assert/strict';
import test from 'node:test';
import { sentryProbeAuthorized, sentryProbeEnabled } from './probe.ts';

test('ATH-REL-001A: probe stays off unless SENTRY_PROBE_ENABLED=true', () => {
  assert.equal(sentryProbeEnabled({}), false);
  assert.equal(sentryProbeEnabled({ SENTRY_PROBE_ENABLED: 'false' }), false);
  assert.equal(sentryProbeEnabled({ SENTRY_PROBE_ENABLED: 'true' }), true);
});

test('ATH-REL-001A: probe requires a long bearer secret', () => {
  const env = { SENTRY_PROBE_SECRET: 'sixteen-char-key' };
  assert.equal(sentryProbeAuthorized(null, env), false);
  assert.equal(sentryProbeAuthorized('Bearer nope', env), false);
  assert.equal(sentryProbeAuthorized('Bearer sixteen-char-key', env), true);
  assert.equal(sentryProbeAuthorized('Bearer short', { SENTRY_PROBE_SECRET: 'short' }), false);
});
