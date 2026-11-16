import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  AUTOMATIC_IDENTITY_COLLECTION,
  AUTOMATIC_PAGEVIEW_CAPTURE,
  analyticsBrowserOptOut,
  analyticsConsent,
  shouldEnablePosthog,
} from './environment.ts';
import { prepareOutboundCapture } from './privacy.ts';
import {
  installAnalyticsTransportGuard,
  isPosthogAnalyticsDestination,
  sanitizeAnalyticsRequestBody,
} from './sdk-guard.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const allowed = new Set<string>(Object.values(TRUSTHUB_EVENTS));
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function saveEnv() {
  return {
    token: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    vercel: process.env.NEXT_PUBLIC_VERCEL_ENV,
    activation: process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION,
  };
}

function restoreEnv(saved: ReturnType<typeof saveEnv>) {
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: saved.token,
    NEXT_PUBLIC_POSTHOG_HOST: saved.host,
    NEXT_PUBLIC_VERCEL_ENV: saved.vercel,
    NEXT_PUBLIC_POSTHOG_ACTIVATION: saved.activation,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function grantProduction() {
  process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_test';
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
  process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION = 'enabled';
}

test('missing, disabled, and malformed activation switches fail closed', () => {
  const saved = saveEnv();
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { doNotTrack: null, cookieEnabled: true, globalPrivacyControl: false },
  });
  try {
    grantProduction();
    assert.equal(shouldEnablePosthog('granted'), true);
    delete process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION;
    assert.equal(shouldEnablePosthog('granted'), false);
    for (const activation of ['', 'disabled', '0', 'false', 'ENABLED', 'Enabled', ' enabled', 'enabled ', 'true']) {
      process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION = activation;
      assert.equal(shouldEnablePosthog('granted'), false, JSON.stringify(activation));
    }
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
    restoreEnv(saved);
  }
});

test('a missing project key fails closed', () => {
  const saved = saveEnv();
  try {
    grantProduction();
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    assert.equal(shouldEnablePosthog('granted'), false);
  } finally {
    restoreEnv(saved);
  }
});

test('Do Not Track and Global Privacy Control fail closed', () => {
  const saved = saveEnv();
  const previousNavigator = globalThis.navigator;
  grantProduction();
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { doNotTrack: '1', cookieEnabled: true, globalPrivacyControl: false },
    });
    assert.equal(analyticsBrowserOptOut(), true);
    assert.equal(shouldEnablePosthog('granted'), false);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { doNotTrack: 'yes', cookieEnabled: true, globalPrivacyControl: false },
    });
    assert.equal(shouldEnablePosthog('granted'), false);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { doNotTrack: null, cookieEnabled: true, globalPrivacyControl: true },
    });
    assert.equal(shouldEnablePosthog('granted'), false);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
    restoreEnv(saved);
  }
});

test('unresolved and denied consent fail closed and a missing banner is not consent', () => {
  const saved = saveEnv();
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { doNotTrack: null, cookieEnabled: true, globalPrivacyControl: false },
  });
  try {
    grantProduction();
    assert.equal(analyticsConsent(), 'unresolved');
    assert.equal(shouldEnablePosthog(), false);
    assert.equal(shouldEnablePosthog('unresolved'), false);
    assert.equal(shouldEnablePosthog('denied'), false);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
    restoreEnv(saved);
  }
});

test('sensitive event properties and unknown events are removed', () => {
  const event = prepareOutboundCapture(
    {
      event: 'search_submitted',
      properties: {
        token: 'phc_test',
        distinct_id: 'abc',
        hub: 'ask',
        surface: 'ask_form',
        success: true,
        email: 'person@example.com',
        name: 'Jane Doe',
        phone: '555-0100',
        address: '1 Main St',
        query: 'who owns this house',
        q: 'who owns this house',
        password: 'secret',
        accountId: 'user-1',
        $current_url: 'https://www.asktrusthub.com/ask?q=secret&email=person@example.com',
        $ip: '203.0.113.10',
        $set: { email: 'person@example.com', token: 'phc_nested', hub: 'ask' },
      },
    },
    allowed,
  );
  assert.equal(event?.properties?.email, undefined);
  assert.equal(event?.properties?.name, undefined);
  assert.equal(event?.properties?.phone, undefined);
  assert.equal(event?.properties?.address, undefined);
  assert.equal(event?.properties?.query, undefined);
  assert.equal(event?.properties?.password, undefined);
  assert.equal(event?.properties?.accountId, undefined);
  assert.equal(event?.properties?.token, 'phc_test');
  assert.equal(event?.properties?.distinct_id, undefined);
  assert.equal(event?.properties?.hub, 'ask');
  assert.equal(event?.properties?.$ip, undefined);
  assert.equal((event?.properties as { $geoip_disable?: boolean } | undefined)?.$geoip_disable, true);
  assert.equal(event?.properties?.$current_url, 'https://www.asktrusthub.com/ask');
  const set = event?.properties?.$set as Record<string, unknown>;
  assert.equal(set.email, undefined);
  assert.equal(set.token, undefined);
  assert.equal(set.hub, 'ask');
  assert.equal(prepareOutboundCapture({ event: '$autocapture', properties: { hub: 'ask' } }, allowed), null);
  assert.equal(prepareOutboundCapture({ event: '$exception', properties: { hub: 'ask' } }, allowed), null);
  assert.equal(prepareOutboundCapture({ event: '$snapshot', properties: { hub: 'ask' } }, allowed), null);
});

test('server rendering does not enable PostHog and automatic capture stays off', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(shouldEnablePosthog('granted'), false);
  assert.equal(AUTOMATIC_PAGEVIEW_CAPTURE, false);
  assert.equal(AUTOMATIC_IDENTITY_COLLECTION, false);
  const browser = readFileSync(join(root, 'lib/analytics/posthog-browser.ts'), 'utf8');
  const rootSource = readFileSync(join(root, 'components/analytics/posthog-root.tsx'), 'utf8');
  assert.match(browser, /if \(typeof window === 'undefined'\) return null/);
  assert.match(browser, /autocapture: false/);
  assert.match(browser, /disable_session_recording: true/);
  assert.match(browser, /capture_exceptions: false/);
  assert.match(browser, /capture_pageview: false/);
  assert.match(rootSource, /AUTOMATIC_PAGEVIEW_CAPTURE/);
  assert.match(rootSource, /AUTOMATIC_IDENTITY_COLLECTION/);
  assert.doesNotMatch(rootSource.slice(rootSource.indexOf('function PosthogPageviews'), rootSource.indexOf('function PosthogIdentity')), /cancelled/);
});

test('an inactive transport guard drops PostHog calls and leaves other hosts alone', async () => {
  const saved = saveEnv();
  delete process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION;
  const calls: string[] = [];
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousFetch = globalThis.fetch;
  const fakeFetch = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response('forwarded', { status: 200 });
  };
  Object.assign(globalThis, { window: globalThis, fetch: fakeFetch });
  try {
    installAnalyticsTransportGuard();
    assert.equal(isPosthogAnalyticsDestination('https://us.i.posthog.com/e'), true);
    assert.equal(isPosthogAnalyticsDestination('https://example.com/e'), false);
    const blocked = await fetch('https://us.i.posthog.com/e', { method: 'POST', body: '{"email":"a@b.c"}' });
    assert.equal(await blocked.text(), '{}');
    assert.deepEqual(calls, []);
    const other = await fetch('https://example.com/capture');
    assert.equal(await other.text(), 'forwarded');
    assert.deepEqual(calls, ['https://example.com/capture']);
    const sanitized = sanitizeAnalyticsRequestBody(
      JSON.stringify({
        token: 'phc_test',
        event: 'search_submitted',
        properties: { email: 'a@b.c', query: 'secret', hub: 'ask' },
        $set: { token: 'phc_person', name: 'Jane' },
      }),
    );
    assert.ok(sanitized);
    assert.match(sanitized, /phc_test/);
    assert.doesNotMatch(sanitized, /a@b\.c/);
    assert.doesNotMatch(sanitized, /secret/);
    assert.doesNotMatch(sanitized, /Jane/);
    assert.equal(sanitizeAnalyticsRequestBody('{'), null);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previousWindow;
    globalThis.fetch = previousFetch;
    restoreEnv(saved);
  }
});
