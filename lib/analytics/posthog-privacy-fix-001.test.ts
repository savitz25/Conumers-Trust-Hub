import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import { analyticsTransportBlockScript } from './early-transport.ts';
import { prepareOutboundCapture, sanitizeAnalyticsUrl } from './privacy.ts';
import { sanitizeAnalyticsRequestBody } from './sdk-guard.ts';
import { TRUSTHUB_EVENTS } from './trusthub-events.ts';

const allowed = new Set<string>(Object.values(TRUSTHUB_EVENTS));
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const markers = ['C3PrivateSearch739201', 'C3Auth739201', 'tester@example.invalid', 'SyntheticPassword739201'];
const urls = [
  'https://qa.invalid/search?%2571=C3PrivateSearch739201',
  'https://qa.invalid/search?redirect_uri=https%3A%2F%2Ftarget.invalid%2F%3Fauth_code%3DC3Auth739201',
  'https://qa.invalid/search?searchTerm=C3PrivateSearch739201',
  'https://qa.invalid/search?email=tester%40example.invalid&password=SyntheticPassword739201',
  'https://qa.invalid/search?%252571=C3PrivateSearch739201',
  'https://qa.invalid/search?AUTH_CODE=C3Auth739201&access_token=C3Auth739201&id_token=C3Auth739201&code=C3Auth739201',
  'https://qa.invalid/search?next=https%3A%2F%2Ftarget.invalid%2F%3Fauth_code%3DC3Auth739201&utm_source=newsletter',
  'https://qa.invalid/search?utm_campaign=' + encodeURIComponent('https://target.invalid/?token=C3Auth739201'),
  'https://qa.invalid/search?q=%2525ZZ%2525invalid&utm_source=ok',
];

function leaked(value: unknown): boolean {
  const text = JSON.stringify(value);
  return markers.some((marker) => text.includes(marker));
}

test('C3 sanitizer probes and nested encodings do not forward sensitive values', () => {
  const urlResults = urls.map((input) => ({ input, output: sanitizeAnalyticsUrl(input) }));
  const event = prepareOutboundCapture(
    {
      event: 'search_submitted',
      properties: {
        token: 'phc_test',
        hub: 'ask',
        surface: 'search',
        success: true,
        email: 'tester@example.invalid',
        password: 'SyntheticPassword739201',
        query: 'C3PrivateSearch739201',
        searchTerm: 'C3PrivateSearch739201',
        accountId: 'C3Auth739201',
        distinct_id: 'C3Auth739201',
        $device_id: 'C3Auth739201',
        $user_id: 'C3Auth739201',
        $set: { distinct_id: 'C3Auth739201', hub: 'ask', token: 'phc_person' },
        $current_url: 'https://qa.invalid/search?%2571=C3PrivateSearch739201',
      },
    },
    allowed,
  );
  assert.equal(leaked({ outputs: urlResults.map((row) => row.output), event }), false);
  assert.equal(event?.properties?.token, 'phc_test');
  assert.equal(event?.properties?.hub, 'ask');
  assert.equal(event?.properties?.distinct_id, undefined);
  assert.equal(event?.properties?.$device_id, undefined);
  const set = event?.properties?.$set as Record<string, unknown>;
  assert.equal(set.distinct_id, undefined);
  assert.equal(set.token, undefined);
  assert.equal(set.hub, 'ask');
  const nested = sanitizeAnalyticsUrl(urls[6]);
  assert.equal(nested, 'https://qa.invalid/search');
  assert.equal(nested?.includes('?'), false);
  assert.doesNotMatch(nested ?? '', /auth_code|C3Auth739201/i);
  assert.equal(sanitizeAnalyticsUrl('https://qa.invalid/' + 'a'.repeat(2100)), undefined);
  assert.doesNotThrow(() => sanitizeAnalyticsUrl('not a url at all'));
  assert.equal(sanitizeAnalyticsUrl('http://[not-a-valid-ipv6'), undefined);
});

test('transport body cannot reinsert caller identity or a sensitive URL', () => {
  const encoded = sanitizeAnalyticsRequestBody(
    JSON.stringify({
      token: 'phc_test',
      distinct_id: 'C3Auth739201',
      event: 'search_submitted',
      properties: {
        hub: 'ask',
        $device_id: 'C3Auth739201',
        $current_url: 'https://qa.invalid/search?searchTerm=C3PrivateSearch739201',
      },
    }),
  );
  assert.ok(encoded);
  assert.match(encoded, /phc_test/);
  assert.equal(leaked(encoded), false);
  assert.doesNotMatch(encoded, /distinct_id/);
});

test('the layout installs the transport block outside Suspense', () => {
  const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
  const scriptAt = layout.indexOf('analyticsTransportBlockScript');
  const suspenseAt = layout.indexOf('<Suspense');
  assert.ok(scriptAt > 0);
  assert.ok(suspenseAt > scriptAt);
  const instrumentation = readFileSync(join(root, 'instrumentation-client.ts'), 'utf8');
  assert.match(instrumentation, /installAnalyticsTransportGuard/);
});

test('the early transport block drops fetch, xhr, and beacon before the module guard', async () => {
  const calls: string[] = [];
  class XHR {
    __trusthubUrl = '';
    open() {}
    send() {
      calls.push('send');
    }
    dispatchEvent(event: Event) {
      const xhr = this as XHR & { onloadend?: () => void };
      if (event.type === 'loadend' && xhr.onloadend) xhr.onloadend();
    }
  }
  const windowObj: Record<string, unknown> = {
    location: { href: 'https://www.asktrusthub.com/' },
    fetch(input: RequestInfo | URL) {
      calls.push('fetch:' + String(input));
      return Promise.resolve(new Response('forwarded'));
    },
  };
  const sandbox: Record<string, unknown> = {
    URL,
    Request,
    Response,
    Promise,
    Event,
    Object,
    String,
    XMLHttpRequest: XHR,
    window: windowObj,
    navigator: {
      sendBeacon(url: string) {
        calls.push('beacon:' + url);
        return true;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(analyticsTransportBlockScript('https://collector.invalid'), sandbox);
  vm.runInContext(analyticsTransportBlockScript('not a url'), sandbox);
  const blocked = await vm.runInContext(
    `window.fetch(new Request('https://collector.invalid/flags/?v=2', { method: 'POST', body: '{}' }))`,
    sandbox,
  );
  assert.equal(blocked.status, 200);
  assert.equal(await blocked.text(), '{}');
  const beacon = vm.runInContext(`navigator.sendBeacon('https://collector.invalid/e/', '{}')`, sandbox);
  assert.equal(beacon, true);
  const xhrStatus = await vm.runInContext(
    `new Promise((resolve) => { const xhr = new XMLHttpRequest(); xhr.open('POST', 'https://collector.invalid/capture/'); xhr.onloadend = () => resolve(xhr.status); xhr.send('{}'); })`,
    sandbox,
  );
  assert.equal(xhrStatus, 200);
  await vm.runInContext(`window.fetch('https://example.com/capture')`, sandbox);
  await vm.runInContext(`window.fetch('https://us.i.posthog.com/batch/')`, sandbox);
  assert.deepEqual(calls, ['fetch:https://example.com/capture']);
  assert.equal(vm.runInContext('window.__TRUSTHUB_ANALYTICS_GATE', sandbox), 'closed');
  const hostile = analyticsTransportBlockScript('https://collector.invalid";alert(1)');
  let alerted = false;
  const hostileSandbox = {
    alert() {
      alerted = true;
    },
    URL,
    Response,
    Promise,
    Event,
    Object,
    String,
    XMLHttpRequest: XHR,
    window: { location: { href: 'https://www.asktrusthub.com/' }, fetch() { return Promise.resolve(new Response('x')); } },
    navigator: { sendBeacon() { return true; } },
  };
  vm.createContext(hostileSandbox);
  assert.doesNotThrow(() => vm.runInContext(hostile, hostileSandbox));
  assert.equal(alerted, false);
  assert.equal(hostile.includes('</script>'), false);
});
