/**
 * TH-SEARCH-R1-019A: common cross-hub NAME_CANDIDATES contract.
 *
 * Matching is owned by each specialist hub. Ask validates contributions, maps them into this
 * shape, groups/orders hub-reported match methods, and deduplicates exact stable keys. Ask never
 * reproduces legal-name matching, invents aliases, or filters an unfiltered cohort into "matches".
 *
 * A displayed candidate is a relevant public record -- never a confirmed regulatory identity.
 */
import type { SpecialistHubId } from '../registry.ts';

export const NAME_CANDIDATES_VERSION = 'ask-name-candidates-v1' as const;

/** Input bounds. Validated BEFORE any truncation that could change meaning (never truncated). */
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
/** Cards shown per hub before "View more". */
export const INITIAL_CARDS_PER_HUB = 5;
/** Rows requested from a hub per call. */
export const HUB_PAGE_SIZE = 10;
/** Hard cap on cards ever held per hub in one response. */
export const MAX_CARDS_PER_HUB = 50;
export const MAX_PAGE = 20;

export type NameHubScope = 'all' | SpecialistHubId;

/**
 * How the HUB says the record's name relates to the supplied name. Values come from the hub's own
 * match vocabulary; HUB_NAME_MATCH is used when a hub asserts a name match without a finer class.
 * Ordered strongest -> weakest for display ordering only. None of these is an identity finding.
 */
export const MATCH_METHODS = [
  'EXACT_SOURCE_NAME',
  'NORMALIZED_NAME',
  'DOCUMENTED_ALIAS',
  'PREFIX_OR_TOKEN',
  'NAME_CONTAINS',
  'HUB_NAME_MATCH',
  'SIMILAR_SPELLING',
] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

export const MATCH_METHOD_LABEL: Record<MatchMethod, string> = {
  EXACT_SOURCE_NAME: 'Source name matches what you entered',
  NORMALIZED_NAME: 'Source name matches after punctuation/case normalization',
  DOCUMENTED_ALIAS: 'Documented alias in the source',
  PREFIX_OR_TOKEN: 'Source name starts with or contains these words',
  NAME_CONTAINS: 'Source name contains what you entered',
  HUB_NAME_MATCH: 'Name match reported by the specialist source',
  SIMILAR_SPELLING: 'Similar spelling -- a suggestion, not a match',
};

export type CandidateAction = {
  type: 'PROFILE' | 'RESEARCH' | 'VERIFY' | 'OFFICIAL_SOURCE';
  href: string;
  label: string;
};

export type NameCandidate = {
  hub: SpecialistHubId;
  /** Source namespace/grain, e.g. "FMCSA public mover identity". */
  sourceGrain: string;
  /** `${hub}:${namespace}:${key}` -- stable public record key. Dedup happens on this only. */
  stableKey: string;
  displayName: string;
  /** Source-backed entity type as reported by the hub (never inferred from the name). */
  entityType: string | null;
  /** The actual source name the hub matched, and which field it came from. */
  matchedName: string;
  matchedField: string;
  matchMethod: MatchMethod;
  /** The hub's own words for why the record matched, when supplied. */
  hubMatchExplanation: string | null;
  identifiers: Array<{ label: string; value: string }>;
  recordedLocation: string | null;
  /** Meaning of the recorded location per the hub (never service territory). */
  locationMeaning: string | null;
  sourceAsOf: string | null;
  /** Hub-reported publication/projection state; null = hub did not supply one. */
  publicationState: string | null;
  /** Canonical profile URL or supported research action from the hub. Never fabricated. */
  action: CandidateAction | null;
};

/**
 * Per-hub outcomes are kept distinct. A hub that failed, was not searched, or does not support
 * the operation is NEVER reported as a completed miss.
 */
export type HubOutcomeState =
  | 'COMPLETED_WITH_CANDIDATES'
  | 'COMPLETED_NO_CANDIDATES'
  | 'PARTIAL_TRUNCATED'
  | 'UNSUPPORTED_OPERATION'
  | 'POLICY_RESTRICTED'
  | 'TECHNICAL_FAILURE'
  | 'NOT_SEARCHED_OUT_OF_SCOPE';

export type HubNameSearchOutcome = {
  hub: SpecialistHubId;
  state: HubOutcomeState;
  /** True only when the hub's response proves the supplied name was applied before row limits. */
  nameFilterApplied: boolean;
  /** What the hub actually searched, in the hub's terms. */
  searchedScope: string;
  /** Truthful description of the hub's matching breadth (e.g. exact-name-only). */
  matchBreadth: string;
  candidates: NameCandidate[];
  returnedCount: number;
  /** Hub-reported total of matching identities, when the hub asserts one. Never a corpus size. */
  hubReportedTotal: number | null;
  page: number;
  hasMore: boolean;
  /** Set when the hub capped results without a usable cursor. */
  truncatedWithoutCursor: boolean;
  /** A verified, scoped specialist continuation for more results, when one exists. */
  continuation: CandidateAction | null;
  message: string | null;
  failureKind?: 'timeout' | 'unavailable' | 'contract_mismatch' | 'invalid_response' | 'name_filter_not_proven' | 'deadline_exceeded';
  latencyMs: number;
  calls: number;
};

export type NameCandidateRequest = {
  /** Exactly what the user typed. */
  originalInput: string;
  /** The supplied name (kept separate from interpretations). */
  name: string;
  hubScope: NameHubScope;
  /** Industry hint from the planner. Prioritization only -- never a filter. */
  priorityHubs: SpecialistHubId[];
  /** Per-hub page cursors (1-based). */
  pages: Partial<Record<SpecialistHubId, number>>;
  /** Monotonic client revision for stale-response exclusion. */
  revision: number;
  /** Conditions the user expressed that this operation does not apply. Disclosed, never dropped. */
  unresolvedConditions: string[];
};

export type NameCandidateCoverage = {
  searchedHubs: SpecialistHubId[];
  completedHubs: SpecialistHubId[];
  incompleteHubs: SpecialistHubId[];
  unsupportedHubs: SpecialistHubId[];
  /** True only if EVERY in-scope hub completed a real name search (none failed, none unsupported). */
  allInScopeCompleted: boolean;
  /** No candidates among the hubs that completed, and no in-scope hub had a technical failure. */
  completedHubsMiss: boolean;
  /**
   * A miss across the whole requested scope. Requires allInScopeCompleted -- a hub that failed,
   * was not searchable by name, or could not confirm it searched this name is never counted as a miss.
   */
  genuineNetworkMiss: boolean;
};

export type NameCandidateResponse = {
  version: typeof NAME_CANDIDATES_VERSION;
  request: NameCandidateRequest;
  hubs: HubNameSearchOutcome[];
  candidateCount: number;
  coverage: NameCandidateCoverage;
  timing: { totalMs: number; overallDeadlineMs: number; calls: number };
};

export function validateSuppliedName(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('invalid_name');
  if ([...raw].some((ch) => { const code = ch.charCodeAt(0); return code < 32 || code === 127 || ch === '<' || ch === '>'; })) throw new Error('invalid_name');
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) throw new Error('invalid_name');
  if (!/[\p{L}\p{N}]/u.test(name)) throw new Error('invalid_name');
  return name;
}

export function methodRank(method: MatchMethod): number {
  return MATCH_METHODS.indexOf(method);
}
