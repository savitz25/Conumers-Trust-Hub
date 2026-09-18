/**
 * TH-SEARCH-R1-019A: privacy-safe outcome classification for NAME_CANDIDATES searches.
 * Carries NO query text, names, identifiers or URLs -- only outcome classes and buckets. Routing
 * permission is never reported as successful retrieval: RESULTS requires real admitted candidates.
 */
import type { NameCandidateResponse } from './contract.ts';

export type NameCandidateTelemetry = {
  terminalOutcome: 'RESULTS' | 'FAIL_CLOSED_WITH_ACTION' | 'ERROR';
  reason: 'none' | 'partial_source_coverage' | 'completed_miss' | 'completed_miss_partial_scope' | 'partial_source_coverage_no_candidates' | 'all_sources_failed';
  hubScope: string;
  candidateCount: number;
  completedHubCount: number;
  incompleteHubCount: number;
  durationMs: number;
};

export function nameCandidateTelemetry(response: NameCandidateResponse): NameCandidateTelemetry {
  const { coverage, candidateCount } = response;
  const base = { hubScope: response.request.hubScope, candidateCount, completedHubCount: coverage.completedHubs.length, incompleteHubCount: coverage.incompleteHubs.length, durationMs: Math.max(0, Math.min(300_000, response.timing.totalMs)) };
  if (candidateCount > 0) return { ...base, terminalOutcome: 'RESULTS', reason: coverage.incompleteHubs.length ? 'partial_source_coverage' : 'none' };
  if (!coverage.completedHubs.length) return { ...base, terminalOutcome: 'ERROR', reason: 'all_sources_failed' };
  if (coverage.incompleteHubs.length) return { ...base, terminalOutcome: 'FAIL_CLOSED_WITH_ACTION', reason: 'partial_source_coverage_no_candidates' };
  return { ...base, terminalOutcome: 'FAIL_CLOSED_WITH_ACTION', reason: coverage.genuineNetworkMiss ? 'completed_miss' : 'completed_miss_partial_scope' };
}
