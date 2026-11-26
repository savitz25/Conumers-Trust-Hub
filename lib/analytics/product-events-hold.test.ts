import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { clientProductEventsAllowed } from './product-events-hold.ts';
import { trackEvent } from './track.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const recordPath = '/claim/11111111-1111-4111-8111-111111111111';

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('client product events stay held and are not opened by the PostHog latch', () => {
  assert.equal(clientProductEventsAllowed(), false);
  const hold = read('lib/analytics/product-events-hold.ts');
  assert.equal(hold.includes('process.env'), false);
  assert.equal(hold.includes('NEXT_PUBLIC_'), false);
  assert.match(hold, /return false/);
  const track = read('lib/analytics/track.ts');
  const gate = track.indexOf('clientProductEventsAllowed()');
  const fetchAt = track.indexOf('fetch(');
  assert.ok(gate >= 0 && fetchAt > gate);
  assert.match(track, /FIRST_PARTY_EVENTS/);
  assert.doesNotMatch(track, /customer\/db|control-plane\/product-events|service.role|DATABASE_URL/i);
  assert.doesNotMatch(track, /@vercel\/analytics/);
  assert.doesNotMatch(track, /track\(name, cleaned\)/);
  assert.match(track, /\.catch\(\(\) => undefined\)/);
  assert.equal(track.includes('globalPrivacyControl'), false);
  assert.equal(track.includes('doNotTrack'), false);
  assert.equal(track.includes('process.env'), false);
  const route = read('app/api/product-events/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));
  const refusal = handler.indexOf('if (!clientProductEventsAllowed())');
  const before = handler.slice(0, refusal);
  assert.equal(before.includes('await '), false);
  for (const marker of [
    'request.json',
    'searchParams',
    'readSessionToken(',
    'withPlatform(',
    'x-forwarded-for',
    'x-real-ip',
    'acceptClientProductEvent(',
    'rateIdentity',
  ]) {
    assert.ok(handler.indexOf(marker) > refusal, marker);
  }
  assert.match(route, /acceptClientProductEvent/);
  assert.equal(read('lib/control-plane/product-events.ts').includes('export async function recordSearchObservation'), true);
  assert.equal(route.includes('recordSearchObservation'), false);
  assert.equal(route.includes('recordGuidedSearch'), false);
});

test('trackEvent sends no product-events request while the hold is closed', () => {
  const calls: string[] = [];
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousFetch = globalThis.fetch;
  const browser = {
    location: { pathname: `${recordPath}?utm_campaign=secret-campaign&utm_source=email` },
    navigator: { doNotTrack: '1', globalPrivacyControl: true, cookieEnabled: false },
  };
  (globalThis as { window?: unknown }).window = browser;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    calls.push(String(input));
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;
  try {
    assert.equal(clientProductEventsAllowed(), false);
    trackEvent('claim_started', {
      campaign_id: 'camp-secret',
      profile_id: '11111111-1111-4111-8111-111111111111',
      source: 'email_campaign',
    });
    trackEvent('claim_completed', { consent: 'withdrawn' });
    browser.navigator = { doNotTrack: '0', globalPrivacyControl: false, cookieEnabled: true };
    trackEvent('my_trust_hub_viewed', { campaign_id: 'camp-open' });
    assert.deepEqual(calls, []);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test('trackEvent still returns without throwing when no browser is present', () => {
  assert.equal(trackEvent('claim_started', { profile_id: 'local-only' }), undefined);
  assert.equal(trackEvent('not_a_product_event', { campaign_id: 'ignored' }), undefined);
});
