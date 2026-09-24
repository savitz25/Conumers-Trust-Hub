/**
 * Cheap public existence gate for contractor Ask state.
 * Unknown IDs never touch Neon once the existence set is warm.
 *
 * Layers (ATH-CLAIM-V2-001R4):
 *  - Neon is protected by the shared Next data cache (tag-expired by every publication-affecting write,
 *    SHARED_REVALIDATE_S as the backstop if an invalidation is ever lost).
 *  - This in-process layer is a short memo over the shared cache. Writes on another instance cannot reach it,
 *    so its TTL is the cross-instance staleness bound; it is NOT the Neon guard.
 *  - Unknown IDs are answered from the in-memory existence set and are never stored per-ID, so a first approval
 *    is never shadowed by a cached "none" payload and random UUIDs cannot grow memory.
 */

export const PUBLIC_READ_S_MAXAGE = 60;
export const PUBLIC_READ_SWR = 60;
export const SHARED_REVALIDATE_S = 3600;
export const EXISTENCE_TTL_MS = 30_000;
export const PAYLOAD_TTL_MS = 30_000;
/** Worst-case publish/withdraw visibility at the Ask edge: in-process memo + CDN max-age + SWR. */
export const PUBLIC_VISIBILITY_WORST_CASE_S = EXISTENCE_TTL_MS / 1000 + PUBLIC_READ_S_MAXAGE + PUBLIC_READ_SWR;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicReadSource = 'invalid' | 'existence_miss' | 'payload_hit' | 'neon_load';

export type PublicContractorTrustState = {
  contractVersion: 1;
  hub: 'contractor';
  contractorId: string;
  hasPublicBusinessProfile: boolean;
  hasPublicReply: boolean;
  profile: unknown | null;
  replies: { contractVersion: 1 | 2; hub: string; nativeProfileId: string; replies: unknown[] } | null;
};

export type PublicReadResult = {
  state: PublicContractorTrustState;
  source: PublicReadSource;
  neonQueries: number;
};

export function emptyPublicContractorState(contractorId: string): PublicContractorTrustState {
  return {
    contractVersion: 1,
    hub: 'contractor',
    contractorId,
    hasPublicBusinessProfile: false,
    hasPublicReply: false,
    profile: null,
    replies: { contractVersion: 1, hub: 'contractor', nativeProfileId: contractorId, replies: [] },
  };
}

export function isPublicContractorId(value: string): boolean {
  return UUID.test(value);
}

export function createPublicContractorReadLayer(deps: {
  listPublicIds: () => Promise<string[]>;
  loadPublishedState: (id: string) => Promise<{ profile: unknown | null; replies: unknown[] }>;
  now?: () => number;
  existenceTtlMs?: number;
  payloadTtlMs?: number;
}) {
  const now = deps.now ?? Date.now;
  const existenceTtl = deps.existenceTtlMs ?? EXISTENCE_TTL_MS;
  const payloadTtl = deps.payloadTtlMs ?? PAYLOAD_TTL_MS;
  let existence:
    | { ids: Set<string>; expiresAt: number }
    | null = null;
  const payloads = new Map<string, { state: PublicContractorTrustState; expiresAt: number }>();
  let inflight: Promise<Set<string>> | null = null;
  let generation = 0;
  let listCalls = 0;
  let loadCalls = 0;

  async function existenceSet(): Promise<Set<string>> {
    if (existence && existence.expiresAt > now()) return existence.ids;
    // Single-flight: a burst of cold reads shares one list call instead of each touching the shared cache/Neon.
    if (inflight) return inflight;
    const started = generation;
    listCalls += 1;
    inflight = (async () => {
      try {
        const ids = new Set(await deps.listPublicIds());
        // An invalidation that raced this refresh wins; don't pin the pre-write set.
        if (started === generation) existence = { ids, expiresAt: now() + existenceTtl };
        return ids;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  async function read(contractorId: string): Promise<PublicReadResult> {
    if (!isPublicContractorId(contractorId)) {
      return { state: emptyPublicContractorState(contractorId), source: 'invalid', neonQueries: 0 };
    }
    const beforeList = listCalls;
    const ids = await existenceSet();
    if (!ids.has(contractorId)) {
      // Negative answers live only in the existence set (never per-ID), so they expire with it.
      payloads.delete(contractorId);
      return {
        state: emptyPublicContractorState(contractorId),
        source: 'existence_miss',
        neonQueries: listCalls - beforeList,
      };
    }
    const cached = payloads.get(contractorId);
    if (cached && cached.expiresAt > now()) {
      return { state: cached.state, source: 'payload_hit', neonQueries: listCalls - beforeList };
    }
    loadCalls += 1;
    const loaded = await deps.loadPublishedState(contractorId);
    const replies = Array.isArray(loaded.replies) ? loaded.replies : [];
    const state: PublicContractorTrustState = {
      contractVersion: 1,
      hub: 'contractor',
      contractorId,
      hasPublicBusinessProfile: Boolean(loaded.profile),
      hasPublicReply: replies.length > 0,
      profile: loaded.profile,
      replies: { contractVersion: 1, hub: 'contractor', nativeProfileId: contractorId, replies },
    };
    payloads.set(contractorId, { state, expiresAt: now() + payloadTtl });
    return {
      state,
      source: 'neon_load',
      neonQueries: listCalls - beforeList + 1,
    };
  }

  /**
   * R4: incremental. `granted`/`revoked` patch this instance's existence set for the one profile (no global
   * flush); `content` only drops that profile's payload. No `change` = full local reset (tests/tools).
   */
  function invalidate(contractorId?: string, change?: 'granted' | 'revoked' | 'content') {
    if (!contractorId || !change) {
      generation += 1;
      existence = null;
      if (contractorId) payloads.delete(contractorId);
      else payloads.clear();
      return;
    }
    payloads.delete(contractorId);
    if (change === 'content') return;
    generation += 1; // an in-flight refresh started before this change must not overwrite the patched set
    if (existence) {
      if (change === 'granted') existence.ids.add(contractorId);
      else existence.ids.delete(contractorId);
    }
  }

  function stats() {
    return { listCalls, loadCalls, cachedPayloads: payloads.size, existenceCached: Boolean(existence) };
  }

  function resetStats() {
    listCalls = 0;
    loadCalls = 0;
  }

  return { read, invalidate, stats, resetStats, existenceSet };
}

export const PUBLIC_CACHE_CONTROL = `public, max-age=0, s-maxage=${PUBLIC_READ_S_MAXAGE}, stale-while-revalidate=${PUBLIC_READ_SWR}`;
