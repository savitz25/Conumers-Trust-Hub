/**
 * TH-SEARCH-R1-019A: bounded cross-hub NAME_CANDIDATES orchestration.
 *
 * Time budget (documented from bounded live smoke observations on 2026-09-18, NOT a p95):
 * single name calls measured 0.36s-3.5s (Insurance slowest at 2.4-3.5s; Move 0.7-1.7s; Senior,
 * Investor, Lender under 1.3s). Existing per-hub specialist timeouts in this repo are 5-8s and the
 * Ask page already awaits specialist calls server-side. Per-hub 7s / overall 9s keeps a slow hub
 * from discarding the others while staying inside the platform function limit.
 *
 * Requests per search: one call per in-scope ENABLED hub (max 5 today), plus at most ONE retry in
 * total-budget for a hub whose failure was a transient read failure. Valid misses, unsupported
 * operations, policy restrictions and contract mismatches are never retried.
 */
import { SPECIALIST_HUB_IDS, type SpecialistHubId } from '../registry.ts';
import { NAME_ADAPTERS, type HubNameAdapter } from './adapters.ts';
import {
  MAX_PAGE, NAME_CANDIDATES_VERSION, methodRank, validateSuppliedName,
  type HubNameSearchOutcome, type NameCandidateCoverage, type NameCandidateRequest, type NameCandidateResponse,
} from './contract.ts';

export const PER_HUB_TIMEOUT_MS = 7_000;
export const OVERALL_DEADLINE_MS = 9_000;
const RETRY_MIN_REMAINING_MS = 2_500;

export type OrchestratorOptions = {
  adapters?: Record<SpecialistHubId, HubNameAdapter>;
  fetcher?: typeof fetch;
  perHubTimeoutMs?: number;
  overallDeadlineMs?: number;
};

function notSearched(adapter: HubNameAdapter, page: number): HubNameSearchOutcome {
  return { hub: adapter.hub, state: 'NOT_SEARCHED_OUT_OF_SCOPE', nameFilterApplied: false, searchedScope: adapter.searchedScope, matchBreadth: adapter.matchBreadth, candidates: [], returnedCount: 0, hubReportedTotal: null, page, hasMore: false, truncatedWithoutCursor: false, continuation: null, message: null, latencyMs: 0, calls: 0 };
}

async function searchHub(adapter: HubNameAdapter, name: string, page: number, fetcher: typeof fetch, perHubMs: number, deadlineAt: number): Promise<HubNameSearchOutcome> {
  const attempt = async (): Promise<HubNameSearchOutcome> => {
    const budget = Math.min(perHubMs, deadlineAt - Date.now());
    if (budget <= 50) return { ...notSearched(adapter, page), state: 'TECHNICAL_FAILURE', failureKind: 'deadline_exceeded' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);
    try { return await adapter.search(name, page, { fetcher, signal: controller.signal }); }
    catch { return { ...notSearched(adapter, page), state: 'TECHNICAL_FAILURE', failureKind: 'unavailable', calls: 1 }; }
    finally { clearTimeout(timer); }
  };
  const first = await attempt();
  const transient = first.state === 'TECHNICAL_FAILURE' && (first.failureKind === 'unavailable' || first.failureKind === 'timeout');
  if (!transient || deadlineAt - Date.now() < RETRY_MIN_REMAINING_MS) return first;
  const second = await attempt();
  return { ...second, calls: first.calls + second.calls, latencyMs: first.latencyMs + second.latencyMs };
}

export function sortCandidates<T extends { matchMethod: Parameters<typeof methodRank>[0]; displayName: string; stableKey: string }>(rows: T[]): T[] {
  // Strong name matches before weaker suggestions; then neutral name order. Never a quality ranking.
  return [...rows].sort((a, b) => methodRank(a.matchMethod) - methodRank(b.matchMethod) || a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' }) || a.stableKey.localeCompare(b.stableKey));
}

export function summarizeCoverage(hubs: HubNameSearchOutcome[]): NameCandidateCoverage {
  const inScope = hubs.filter((h) => h.state !== 'NOT_SEARCHED_OUT_OF_SCOPE');
  // A truncated page with nothing admissible is NOT a completed search of that hub: more rows exist there.
  const truncatedEmpty = (h: HubNameSearchOutcome) => h.state === 'PARTIAL_TRUNCATED' && h.candidates.length === 0;
  const completed = inScope.filter((h) => (h.state === 'COMPLETED_WITH_CANDIDATES' || h.state === 'COMPLETED_NO_CANDIDATES' || h.state === 'PARTIAL_TRUNCATED') && !truncatedEmpty(h));
  const unsupported = inScope.filter((h) => h.state === 'UNSUPPORTED_OPERATION' || h.state === 'POLICY_RESTRICTED');
  const incomplete = inScope.filter((h) => h.state === 'TECHNICAL_FAILURE' || truncatedEmpty(h));
  const anyCandidates = hubs.some((h) => h.candidates.length > 0);
  return {
    searchedHubs: inScope.filter((h) => h.calls > 0).map((h) => h.hub),
    completedHubs: completed.map((h) => h.hub),
    incompleteHubs: incomplete.map((h) => h.hub),
    unsupportedHubs: unsupported.map((h) => h.hub),
    allInScopeCompleted: inScope.length > 0 && incomplete.length === 0 && unsupported.length === 0,
    completedHubsMiss: !anyCandidates && completed.length > 0 && incomplete.length === 0,
    genuineNetworkMiss: !anyCandidates && inScope.length > 0 && incomplete.length === 0 && unsupported.length === 0,
  };
}

export async function searchNameCandidates(input: Pick<NameCandidateRequest, 'name' | 'hubScope'> & Partial<NameCandidateRequest>, options: OrchestratorOptions = {}): Promise<NameCandidateResponse> {
  const started = Date.now();
  const name = validateSuppliedName(input.name);
  const adapters = options.adapters ?? NAME_ADAPTERS;
  const fetcher = options.fetcher ?? fetch;
  const overall = options.overallDeadlineMs ?? OVERALL_DEADLINE_MS;
  const deadlineAt = started + overall;
  const hubScope = input.hubScope === 'all' || SPECIALIST_HUB_IDS.includes(input.hubScope) ? input.hubScope : 'all';
  const priority = (input.priorityHubs ?? []).filter((hub) => SPECIALIST_HUB_IDS.includes(hub));
  const pages = input.pages ?? {};
  // Every eligible hub is always searched. The industry hint only changes display ORDER.
  const order = [...priority, ...SPECIALIST_HUB_IDS.filter((hub) => !priority.includes(hub))];

  const hubs = await Promise.all(order.map((hub) => {
    const adapter = adapters[hub];
    const page = Math.min(Math.max(Math.trunc(Number(pages[hub] ?? 1)) || 1, 1), MAX_PAGE);
    if (hubScope !== 'all' && hubScope !== hub) return Promise.resolve(notSearched(adapter, page));
    return searchHub(adapter, name, page, fetcher, options.perHubTimeoutMs ?? PER_HUB_TIMEOUT_MS, deadlineAt);
  }));
  const ordered = hubs.map((hub) => ({ ...hub, candidates: sortCandidates(hub.candidates) }));

  return {
    version: NAME_CANDIDATES_VERSION,
    request: { originalInput: input.originalInput ?? name, name, hubScope, priorityHubs: priority, pages, revision: Number.isSafeInteger(input.revision) ? input.revision! : 0, unresolvedConditions: input.unresolvedConditions ?? [] },
    hubs: ordered,
    candidateCount: ordered.reduce((n, hub) => n + hub.candidates.length, 0),
    coverage: summarizeCoverage(ordered),
    timing: { totalMs: Date.now() - started, overallDeadlineMs: overall, calls: ordered.reduce((n, hub) => n + hub.calls, 0) },
  };
}
