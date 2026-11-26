import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('./product-events-route-loader.mjs', import.meta.url);

const recordPath = '/claim/11111111-1111-4111-8111-111111111111';

test('a direct product-events POST records nothing while the hold is closed', async () => {
  const state = globalThis as { __askProductEventCalls?: string[] };
  state.__askProductEventCalls = [];
  const { POST } = await import('../../app/api/product-events/route.ts');
  const response = await POST(new Request(
    `http://127.0.0.1/api/product-events?route=${encodeURIComponent(recordPath)}&utm_campaign=secret-campaign`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '180',
        'x-forwarded-for': '203.0.113.50',
        'x-real-ip': '203.0.113.51',
      },
      body: JSON.stringify({
        eventName: 'claim_started',
        properties: {
          campaign_id: 'camp-secret',
          profile_id: '11111111-1111-4111-8111-111111111111',
          source: 'email_campaign',
        },
      }),
    },
  ));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: false, held: true });
  assert.deepEqual(state.__askProductEventCalls, []);
  const text = JSON.stringify({ status: response.status, calls: state.__askProductEventCalls });
  assert.equal(text.includes('203.0.113'), false);
  assert.equal(text.includes(recordPath), false);
  assert.equal(text.includes('camp-secret'), false);
});
