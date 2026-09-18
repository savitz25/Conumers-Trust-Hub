/**
 * TH-SEARCH-R1-019A: the ONE coverage interpretation. The orchestrator, the page heading/view and
 * telemetry all read this -- they can never disagree about whether a search was complete.
 * Pure (no network, no env) so the client component can recompute it after "View more".
 */
import type { HubNameSearchOutcome, NameCandidateCoverage } from './contract.ts';

/** A truncated page with nothing admissible is NOT a completed search of that hub: more rows exist there. */
export const isTruncatedEmpty = (h: HubNameSearchOutcome): boolean => h.state === 'PARTIAL_TRUNCATED' && h.candidates.length === 0;
export const isCompleted = (h: HubNameSearchOutcome): boolean => (h.state === 'COMPLETED_WITH_CANDIDATES' || h.state === 'COMPLETED_NO_CANDIDATES' || h.state === 'PARTIAL_TRUNCATED') && !isTruncatedEmpty(h);

export function summarizeCoverage(hubs: HubNameSearchOutcome[]): NameCandidateCoverage {
  const inScope = hubs.filter((h) => h.state !== 'NOT_SEARCHED_OUT_OF_SCOPE');
  const completed = inScope.filter(isCompleted);
  const unsupported = inScope.filter((h) => h.state === 'UNSUPPORTED_OPERATION');
  const restricted = inScope.filter((h) => h.state === 'POLICY_RESTRICTED');
  const ambiguous = inScope.filter((h) => h.state === 'AMBIGUOUS_NO_CANDIDATES');
  const incomplete = inScope.filter((h) => h.state === 'TECHNICAL_FAILURE' || isTruncatedEmpty(h));
  const anyCandidates = hubs.some((h) => h.candidates.length > 0);
  const everythingCompleted = inScope.length > 0 && completed.length === inScope.length;
  return {
    searchedHubs: inScope.filter((h) => h.calls > 0).map((h) => h.hub),
    completedHubs: completed.map((h) => h.hub),
    incompleteHubs: incomplete.map((h) => h.hub),
    unsupportedHubs: unsupported.map((h) => h.hub),
    policyRestrictedHubs: restricted.map((h) => h.hub),
    ambiguousHubs: ambiguous.map((h) => h.hub),
    allInScopeCompleted: everythingCompleted,
    completedHubsMiss: !anyCandidates && completed.length > 0 && incomplete.length === 0 && ambiguous.length === 0,
    genuineNetworkMiss: !anyCandidates && everythingCompleted,
  };
}
