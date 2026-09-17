/**
 * Cheap public existence gate for contractor Ask state.
 * Unknown IDs never touch Neon once the existence set is warm.
 */

export const PUBLIC_READ_S_MAXAGE = 21600;
export const PUBLIC_READ_SWR = 86400;
export const EXISTENCE_TTL_MS = PUBLIC_READ_S_MAXAGE * 1000;
export const PAYLOAD_TTL_MS = PUBLIC_READ_S_MAXAGE * 1000;

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
  let listCalls = 0;
  let loadCalls = 0;

  async function existenceSet(): Promise<Set<string>> {
    if (existence && existence.expiresAt > now()) return existence.ids;
    listCalls += 1;
    const ids = new Set(await deps.listPublicIds());
    existence = { ids, expiresAt: now() + existenceTtl };
    return ids;
  }

  async function read(contractorId: string): Promise<PublicReadResult> {
    if (!isPublicContractorId(contractorId)) {
      return { state: emptyPublicContractorState(contractorId), source: 'invalid', neonQueries: 0 };
    }
    const cached = payloads.get(contractorId);
    if (cached && cached.expiresAt > now()) {
      return { state: cached.state, source: 'payload_hit', neonQueries: 0 };
    }
    const beforeList = listCalls;
    const ids = await existenceSet();
    if (!ids.has(contractorId)) {
      const state = emptyPublicContractorState(contractorId);
      payloads.set(contractorId, { state, expiresAt: now() + payloadTtl });
      return {
        state,
        source: 'existence_miss',
        neonQueries: listCalls - beforeList,
      };
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

  function invalidate(contractorId?: string) {
    existence = null;
    if (contractorId) payloads.delete(contractorId);
    else payloads.clear();
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
