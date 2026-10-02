import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  createPublicContractorReadLayer,
  emptyPublicContractorState,
  PUBLIC_CACHE_CONTROL,
} from './public-read-layer.ts';

function layer(publicIds: string[], profiles: Record<string, { profile: unknown | null; replies: unknown[] }>) {
  let listCalls = 0;
  let loadCalls = 0;
  const ids = [...publicIds];
  const api = createPublicContractorReadLayer({
    listPublicIds: async () => {
      listCalls += 1;
      return ids;
    },
    loadPublishedState: async (id) => {
      loadCalls += 1;
      return profiles[id] ?? { profile: null, replies: [] };
    },
    existenceTtlMs: 60_000,
    payloadTtlMs: 60_000,
  });
  return {
    api,
    addId(id: string, payload: { profile: unknown | null; replies: unknown[] }) {
      ids.push(id);
      profiles[id] = payload;
    },
    counts: () => ({ listCalls, loadCalls }),
  };
}

test('unknown UUID is answered from the existence set and does not load Neon payload', async () => {
  const unknown = randomUUID();
  const { api, counts } = layer([], {});
  const first = await api.read(unknown);
  assert.equal(first.source, 'existence_miss');
  assert.equal(first.state.hasPublicBusinessProfile, false);
  assert.equal(first.state.hasPublicReply, false);
  assert.equal(counts().loadCalls, 0);
  assert.equal(counts().listCalls, 1);
  const second = await api.read(unknown);
  // R4: negatives are never stored per-ID; the warm existence set answers again with zero Neon work.
  assert.equal(second.source, 'existence_miss');
  assert.equal(second.neonQueries, 0);
  assert.equal(counts().listCalls, 1);
  assert.equal(counts().loadCalls, 0);
  assert.equal(api.stats().cachedPayloads, 0);
});

test('1,000 distinct unknown contractor IDs do not become 1,000 Neon payload queries', async () => {
  const { api, counts } = layer([], {});
  let neonTouches = 0;
  for (let i = 0; i < 1000; i += 1) {
    const result = await api.read(randomUUID());
    neonTouches += result.neonQueries;
    assert.equal(result.state.hasPublicBusinessProfile, false);
  }
  assert.equal(counts().loadCalls, 0);
  assert.equal(counts().listCalls, 1);
  assert.equal(neonTouches, 1);
});

test('claimed contractor loads once then repeats from cache', async () => {
  const id = randomUUID();
  const { api, counts } = layer([id], {
    [id]: { profile: { nativeProfileId: id, website: 'https://example.com' }, replies: [{ id: 'r1' }] },
  });
  const first = await api.read(id);
  assert.equal(first.source, 'neon_load');
  assert.equal(first.state.hasPublicBusinessProfile, true);
  assert.equal(first.state.hasPublicReply, true);
  const second = await api.read(id);
  assert.equal(second.source, 'payload_hit');
  assert.equal(counts().loadCalls, 1);
});

test('negative cache invalidates when a contractor becomes public', async () => {
  const id = randomUUID();
  const harness = layer([], {});
  const none = await harness.api.read(id);
  assert.equal(none.source, 'existence_miss');
  harness.addId(id, { profile: { nativeProfileId: id }, replies: [] });
  harness.api.invalidate(id);
  const claimed = await harness.api.read(id);
  assert.equal(claimed.source, 'neon_load');
  assert.equal(claimed.state.hasPublicBusinessProfile, true);
});

test('cache keys are contractor-scoped (no cross-profile bleed)', async () => {
  const a = randomUUID();
  const b = randomUUID();
  const { api } = layer([a, b], {
    [a]: { profile: { nativeProfileId: a, site: 'a' }, replies: [] },
    [b]: { profile: { nativeProfileId: b, site: 'b' }, replies: [{ id: 'rb' }] },
  });
  const ra = await api.read(a);
  const rb = await api.read(b);
  assert.equal((ra.state.profile as { site: string }).site, 'a');
  assert.equal((rb.state.profile as { site: string }).site, 'b');
  assert.equal(ra.state.hasPublicReply, false);
  assert.equal(rb.state.hasPublicReply, true);
});

test('public edge cache is a short bounded window; Neon protection lives in the data layer, not the CDN', () => {
  // ATH-CLAIM-V2-001R4 replaced the 6h edge window: it made a first approval invisible for hours. The Neon guard
  // is the existence set + shared data cache (see the 1,000-unknown-ID test), so a short edge TTL costs no Neon work.
  assert.match(PUBLIC_CACHE_CONTROL, /s-maxage=60(,|$)/);
  assert.match(PUBLIC_CACHE_CONTROL, /stale-while-revalidate=60(,|$)/);
  assert.doesNotMatch(PUBLIC_CACHE_CONTROL, /s-maxage=21600/);
});

test('empty public state contains no private claim fields', () => {
  const state = emptyPublicContractorState(randomUUID());
  const blob = JSON.stringify(state);
  for (const key of ['claimId', 'orgId', 'userId', 'claimantEmail', 'session', 'internalNote']) {
    assert.equal(blob.includes(key), false);
  }
});
