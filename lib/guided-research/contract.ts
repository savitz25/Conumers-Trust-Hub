import type { UniversalQueryType } from '../network/query-classification.ts';

export const GUIDED_SESSION_VERSION = 'ask-guided-research-session-v1' as const;
export const GUIDED_SESSION_TTL_MS = 30 * 60 * 1000;
export const GUIDED_PILOT_HUBS = ['senior', 'contractor', 'move'] as const;
export type GuidedPilotHub = (typeof GUIDED_PILOT_HUBS)[number];
export const GUIDED_PHASES = ['UNDERSTAND', 'CLARIFY', 'COLLECT', 'EXECUTE', 'REFINE', 'DEEP_LINK', 'ERROR_RECOVERY'] as const;
export type GuidedPhase = (typeof GUIDED_PHASES)[number];
export const GUIDED_RESULT_STATES = ['SUPPORTED_RESULTS', 'ZERO_MATCHING_ROWS', 'UNSUPPORTED_CAPABILITY', 'INVALID_QUERY', 'BACKEND_UNAVAILABLE', 'TIMEOUT'] as const;
export type GuidedResultState = (typeof GUIDED_RESULT_STATES)[number];

export type GuidedChoice = {
  id: string;
  label: string;
  action: 'SELECT_CHOICE' | 'EXECUTE' | 'RESET';
  value: string;
  description?: string;
};

export type GuidedGeography = {
  type: 'state' | 'county' | 'city' | 'zip';
  value: string;
  stateCode?: string;
  stateName?: string;
  county?: string;
  city?: string;
  meaning?: string;
};

export type GuidedSessionSnapshot = {
  phase: GuidedPhase;
  hub?: GuidedPilotHub;
  entityClass?: string;
  providerClass?: 'nursing_home' | 'home_health' | 'hospice';
  trade?: string;
  moveMode?: 'mover' | 'auto_transport' | 'identity_name' | 'identifier';
  regulatoryRole?: 'Carrier' | 'Broker' | 'Carrier/Broker';
  geography?: GuidedGeography;
  selectedFilters: Record<string, string>;
};

export type GuidedResearchSession = GuidedSessionSnapshot & {
  version: typeof GUIDED_SESSION_VERSION;
  sessionId: string;
  originalQuestion: string;
  queryType: UniversalQueryType;
  identifier?: { type: string; value: string };
  identityName?: string;
  requestedEvidence: string[];
  missingFields: string[];
  availableChoices: GuidedChoice[];
  availableRefinements: GuidedRefinement[];
  resultCount?: number;
  nextAction?: string;
  createdAt: string;
  updatedAt: string;
  history: GuidedSessionSnapshot[];
};

export type GuidedRefinement = {
  id: string;
  label: string;
  values: Array<{ value: string; label: string }>;
  meaning?: string;
};

export type GuidedResultRow = {
  name: string;
  hub: GuidedPilotHub;
  identifier?: { label: string; value: string };
  classLabel?: string;
  recordedLocation?: string;
  status?: string;
  sourceDate?: string;
  whyShown: string;
  destination: { type: 'PROFILE' | 'DIRECTORY' | 'VERIFY' | 'STATE_RESEARCH' | 'COUNTY_RESEARCH'; href: string; label: string };
  facts: Array<{ label: string; value: string }>;
};

export type GuidedExecutionResult = {
  specialist: GuidedPilotHub;
  resultState: GuidedResultState;
  consumerHeading: string;
  consumerMessage: string;
  interpretation: Array<{ label: string; value: string }>;
  rows: GuidedResultRow[];
  total: number;
  pagination?: { page: number; limit: number; hasMore: boolean };
  refinements: GuidedRefinement[];
  provenance: Record<string, string>;
  limitations: string[];
  destinations: Array<{ type: GuidedResultRow['destination']['type']; href: string; label: string }>;
  error?: { code: string; retryable: boolean };
  latencyMs: number;
  firstUsefulResult: boolean;
};

export type GuidedAction =
  | { type: 'START'; question: string }
  | { type: 'SELECT_CHOICE'; value: string }
  | { type: 'SET_GEOGRAPHY'; value: string }
  | { type: 'SET_FILTER'; field: string; value: string }
  | { type: 'CLEAR_FILTER'; field: string }
  | { type: 'BACK' }
  | { type: 'RESET' }
  | { type: 'RESUME' }
  | { type: 'EXECUTE' };

export type GuidedApiRequest = { session?: GuidedResearchSession; action: GuidedAction };
export type GuidedApiResponse = {
  session: GuidedResearchSession;
  result?: GuidedExecutionResult;
  diagnostics: {
    requestId: string;
    hub?: GuidedPilotHub;
    phase: GuidedPhase;
    resultState?: GuidedResultState;
    latencyMs: number;
    resultCount: number;
    specialistCalls: number;
  };
};
