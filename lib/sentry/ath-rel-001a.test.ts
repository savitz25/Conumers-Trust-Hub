import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('ATH-REL-001A: Sentry Session Replay stays off', () => {
  const client = read('instrumentation-client.ts');
  assert.doesNotMatch(client, /replayIntegration/);
  assert.doesNotMatch(client, /replaysSessionSampleRate/);
  assert.doesNotMatch(client, /replaysOnErrorSampleRate/);
  const nextConfig = read('next.config.ts');
  assert.match(nextConfig, /excludeReplayWorker:\s*true/);
});

test('ATH-REL-001A: DSN/org/project come from env only', () => {
  const client = read('instrumentation-client.ts');
  const server = read('sentry.server.config.ts');
  const edge = read('sentry.edge.config.ts');
  const nextConfig = read('next.config.ts');
  assert.doesNotMatch(client, /ingest\.(sentry|us\.sentry)\.io/);
  assert.doesNotMatch(server, /ingest\.(sentry|us\.sentry)\.io/);
  assert.doesNotMatch(edge, /ingest\.(sentry|us\.sentry)\.io/);
  assert.match(nextConfig, /process\.env\.SENTRY_ORG/);
  assert.match(nextConfig, /process\.env\.SENTRY_PROJECT/);
  assert.match(nextConfig, /process\.env\.SENTRY_AUTH_TOKEN/);
  assert.doesNotMatch(nextConfig, /ask-trust-hub/);
  assert.doesNotMatch(nextConfig, /javascript-nextjs/);
});

test('ATH-REL-001A: privacy and environment reuse analytics helpers', () => {
  const privacy = read('lib/sentry/privacy.ts');
  const options = read('lib/sentry/options.ts');
  const runtime = read('lib/sentry/runtime.ts');
  assert.match(privacy, /from '\.\.\/analytics\/privacy\.ts'/);
  assert.match(runtime, /from '\.\.\/analytics\/environment\.ts'/);
  assert.match(options, /sendDefaultPii:\s*false/);
  assert.match(options, /userInfo:\s*false/);
  assert.match(options, /httpBodies:\s*\[\]/);
});

test('ATH-REL-001A: PostHog client init is unchanged', () => {
  const init = read('lib/analytics/posthog-browser.ts');
  assert.doesNotMatch(init, /@sentry/);
  assert.match(init, /maskTextSelector:\s*'input, textarea, \[contenteditable\], \[data-ph-mask\], \.myth-form, \.myth-auth-card'/);
  assert.match(init, /before_send: \(event\) => sanitizeEvent\(event\)/);
  const rootLayout = read('app/layout.tsx');
  assert.match(rootLayout, /PosthogRoot/);
  assert.match(rootLayout, /@vercel\/analytics\/react/);
  assert.doesNotMatch(rootLayout, /@sentry\/nextjs/);
});

test('ATH-REL-001A: probe route is gated and three runtimes are registered', () => {
  const probe = read('app/api/internal/sentry-probe/route.ts');
  const probeHelper = read('lib/sentry/probe.ts');
  const instrumentation = read('instrumentation.ts');
  assert.match(probe, /sentryProbeEnabled/);
  assert.match(probe, /sentryProbeAuthorized/);
  assert.match(probe, /createSentryProbeError/);
  assert.match(probeHelper, /ATH-REL-001A controlled Sentry probe/);
  assert.match(instrumentation, /sentry\.server\.config/);
  assert.match(instrumentation, /sentry\.edge\.config/);
  assert.match(instrumentation, /onRequestError = Sentry\.captureRequestError/);
});
