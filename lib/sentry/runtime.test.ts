import assert from 'node:assert/strict';
import test from 'node:test';
import { sentryRelease, sentryTracesSampleRate, shouldDropSentryTransaction } from './runtime.ts';

test('ATH-REL-001A: production trace sample rate is not 100%', () => {
  assert.equal(sentryTracesSampleRate('production'), 0.1);
  assert.ok(sentryTracesSampleRate('production') < 1);
  assert.equal(sentryTracesSampleRate('preview'), 0.25);
  assert.equal(sentryTracesSampleRate('development'), 1);
});

test('ATH-REL-001A: release prefers VERCEL_GIT_COMMIT_SHA', () => {
  const previousSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const previousPublic = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const previousRelease = process.env.SENTRY_RELEASE;
  process.env.VERCEL_GIT_COMMIT_SHA = 'abc123deadbeef';
  delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  delete process.env.SENTRY_RELEASE;
  assert.equal(sentryRelease(), 'abc123deadbeef');
  if (previousSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
  else process.env.VERCEL_GIT_COMMIT_SHA = previousSha;
  if (previousPublic === undefined) delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  else process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = previousPublic;
  if (previousRelease === undefined) delete process.env.SENTRY_RELEASE;
  else process.env.SENTRY_RELEASE = previousRelease;
});

test('ATH-REL-001A: tunnel and cron transactions are not sampled', () => {
  assert.equal(shouldDropSentryTransaction('POST /sentry-tunnel'), true);
  assert.equal(shouldDropSentryTransaction('GET /api/cron/search-canaries'), true);
  assert.equal(shouldDropSentryTransaction('GET /ask'), false);
});
