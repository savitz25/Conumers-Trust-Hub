import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyticsConsent, shouldEnablePosthog } from './environment.ts';
import {
  ABSENT_ANALYTICS_HOSTS,
  ENFORCED_CSP_HEADER,
  FIRST_PARTY_ANALYTICS_PATHS,
  buildAnalyticsContentSecurityPolicy,
  enforcedDocumentContentSecurityPolicy,
  posthogAssetOrigins,
} from './network-policy.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function closedPolicy(): string {
  return buildAnalyticsContentSecurityPolicy({
    posthogOpen: false,
    posthogHost: 'https://us.i.posthog.com',
    googleAnalyticsOpen: false,
    includeTurnstile: true,
    includeGoogleIdentity: false,
    includeJsdelivr: false,
    formActionOrigins: ['https://www.contractortrusthub.com'],
  });
}

test('the enforced policy is a blocking CSP and omits analytics hosts', () => {
  assert.equal(ENFORCED_CSP_HEADER, 'Content-Security-Policy');
  assert.equal(analyticsConsent(), 'unresolved');
  assert.equal(shouldEnablePosthog(), false);
  const policy = enforcedDocumentContentSecurityPolicy();
  assert.equal(policy, closedPolicy());
  assert.match(policy, /connect-src [^;]*'self'/);
  assert.match(policy, /https:\/\/\*\.supabase\.co/);
  assert.match(policy, /wss:\/\/\*\.supabase\.co/);
  assert.match(policy, /https:\/\/\*\.sentry\.io/);
  assert.match(policy, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(policy, /script-src [^;]*'self'/);
  assert.match(policy, /https:\/\/va\.vercel-scripts\.com/);
  assert.match(policy, /https:\/\/challenges\.cloudflare\.com/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(policy, /Report-Only/);
  for (const host of ABSENT_ANALYTICS_HOSTS) assert.equal(policy.includes(host), false, host);
  assert.deepEqual(posthogAssetOrigins('http://us.i.posthog.com'), []);
  assert.deepEqual(posthogAssetOrigins('not a url'), []);
});

test('an open PostHog gate adds only the configured https collector', () => {
  const policy = buildAnalyticsContentSecurityPolicy({
    posthogOpen: true,
    posthogHost: 'https://eu.i.posthog.com',
    googleAnalyticsOpen: false,
    includeTurnstile: true,
    includeGoogleIdentity: false,
    includeJsdelivr: false,
  });
  assert.match(policy, /https:\/\/eu\.i\.posthog\.com/);
  assert.match(policy, /https:\/\/eu-assets\.i\.posthog\.com/);
  assert.doesNotMatch(policy, /us\.i\.posthog\.com/);
  assert.doesNotMatch(policy, /googletagmanager\.com/);
  const custom = buildAnalyticsContentSecurityPolicy({
    posthogOpen: true,
    posthogHost: 'https://collect.example.com',
    googleAnalyticsOpen: true,
    includeTurnstile: true,
    includeGoogleIdentity: false,
    includeJsdelivr: false,
  });
  assert.match(custom, /https:\/\/collect\.example\.com/);
  assert.match(custom, /https:\/\/www\.googletagmanager\.com/);
  assert.doesNotMatch(custom, /posthog\.com/);
});

test('the SDK module is isolated and the response header is enforced', () => {
  const browser = readFileSync(join(root, 'lib/analytics/posthog-browser.ts'), 'utf8');
  const sdk = readFileSync(join(root, 'lib/analytics/posthog-sdk.ts'), 'utf8');
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
  const config = readFileSync(join(root, 'next.config.ts'), 'utf8');
  const load = browser.slice(browser.indexOf('async function loadPosthog'), browser.indexOf('const gate'));
  assert.ok(load.indexOf('if (!shouldEnablePosthog()) return null;') < load.indexOf("import('./posthog-sdk')"));
  assert.doesNotMatch(browser, /import\('posthog-js'\)/);
  assert.match(browser, /import type \{ PostHog \} from 'posthog-js'/);
  assert.equal((browser.match(/from 'posthog-js'/g) ?? []).length, 1);
  assert.match(sdk, /import\('posthog-js'\)/);
  assert.match(sdk, /trusthub-posthog-sdk-isolated/);
  assert.match(layout, /analyticsTransportBlockScript/);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /enforcedDocumentContentSecurityPolicy\(\)/);
  assert.doesNotMatch(config, /Content-Security-Policy-Report-Only/);
  assert.match(config, /X-Content-Type-Options/);
  assert.equal(FIRST_PARTY_ANALYTICS_PATHS[0], '/api/analytics/identity');
  for (const path of ['app/ingest/route.ts', 'app/ph/route.ts', 'app/api/posthog/route.ts', 'app/api/ingest/route.ts']) {
    assert.equal(existsSync(join(root, path)), false, path);
  }
  assert.doesNotMatch(config, /posthog\.com/);
});
