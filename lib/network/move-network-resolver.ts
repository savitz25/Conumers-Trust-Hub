import type { IdentityResolutionClass } from './result-contract.ts';

export const MOVE_NETWORK_RESOLVER_VERSION = 'move-network-resolver-v1' as const;
export const MOVE_NETWORK_SCHEMA_FINGERPRINT = '4d6c3da40d59cb795bfb6a8bc155298f15ba1144c41f6478c3fc2c736965f284' as const;
export const MOVE_NETWORK_CONTRACT_FINGERPRINT = '72bbf42f66073afd945f8ff3ad5813a0a98e8e787ebff8bf8d69bb552eb1c42c' as const;
export const MOVE_NETWORK_RESOLVER_URL = process.env.MOVE_NETWORK_RESOLVER_URL?.trim() || 'https://www.movetrusthub.com/api/network/identity-resolver';

export type MoveNetworkIdentity = {
  publicDisplayName: string;
  legalName: string | null;
  canonicalSlug: string;
  canonicalUrl: string;
  usdot: string | null;
  mc: string | null;
  role: 'Carrier' | 'Broker' | 'Carrier/Broker' | 'Unknown';
  authorityState: string | null;
  recordedHq: { raw: string | null; city: string | null; state: string | null; locationMeaning: 'RECORDED_HQ' };
  sourceLastChecked: string | null;
  matchClass: string;
  matchReason: string;
};

export type MoveNetworkResolverPayload = {
  contractVersion: typeof MOVE_NETWORK_RESOLVER_VERSION;
  contractFingerprint: typeof MOVE_NETWORK_CONTRACT_FINGERPRINT;
  schemaFingerprint: typeof MOVE_NETWORK_SCHEMA_FINGERPRINT;
  query: string;
  normalizedQuery: string;
  resolutionClass: IdentityResolutionClass;
  results: MoveNetworkIdentity[];
  returnedResultCount: number;
  totalMatchingIdentityCount: number;
  duplicateNameCount: number;
  sourceClock: { kind: string; latestObserved: string | null; meaning: string };
  limitations: string[];
  trace: { sourceContract: string; resolverLatencyMs: number; fallbackPath: string; requestId?: string };
};

export type MoveNetworkResolverOutcome =
  | { ok: true; payload: MoveNetworkResolverPayload; latencyMs: number }
  | { ok: false; kind: 'invalid_query' | 'unavailable' | 'timeout' | 'contract_mismatch'; message: string; latencyMs: number };

function validPayload(value: unknown): value is MoveNetworkResolverPayload {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<MoveNetworkResolverPayload>;
  return row.contractVersion === MOVE_NETWORK_RESOLVER_VERSION &&
    row.schemaFingerprint === MOVE_NETWORK_SCHEMA_FINGERPRINT &&
    row.contractFingerprint === MOVE_NETWORK_CONTRACT_FINGERPRINT &&
    typeof row.resolutionClass === 'string' && Array.isArray(row.results) &&
    typeof row.returnedResultCount === 'number';
}

export async function fetchMoveNetworkIdentity(
  query: string,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<MoveNetworkResolverOutcome> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const url = new URL(MOVE_NETWORK_RESOLVER_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('contract_version', MOVE_NETWORK_RESOLVER_VERSION);
    url.searchParams.set('intent', /\b(?:usdot|dot|mc)\b/i.test(query) ? 'identifier' : 'company_name');
    url.searchParams.set('limit', '8');
    const response = await (options.fetcher ?? fetch)(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
    } as RequestInit);
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      const code = body?.error?.code;
      if (response.status === 400 || code === 'INVALID_QUERY') return { ok: false, kind: 'invalid_query', message: body?.error?.message ?? 'Invalid mover identity query.', latencyMs };
      if (response.status === 504 || code === 'TIMEOUT') return { ok: false, kind: 'timeout', message: 'Move identity research timed out.', latencyMs };
      if (response.status === 409 || code === 'CONTRACT_VERSION_ERROR') return { ok: false, kind: 'contract_mismatch', message: 'Move identity contract is incompatible.', latencyMs };
      return { ok: false, kind: 'unavailable', message: 'Move identity research is temporarily unavailable.', latencyMs };
    }
    if (!validPayload(body)) return { ok: false, kind: 'contract_mismatch', message: 'Move identity contract validation failed.', latencyMs };
    return { ok: true, payload: body, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return error instanceof DOMException && error.name === 'AbortError'
      ? { ok: false, kind: 'timeout', message: 'Move identity research timed out.', latencyMs }
      : { ok: false, kind: 'unavailable', message: 'Move identity research is temporarily unavailable.', latencyMs };
  } finally {
    clearTimeout(timer);
  }
}
