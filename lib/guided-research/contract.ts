import type { UniversalQueryType } from '../network/query-classification.ts';
import type { AskResearchPlan } from '../network/research-planner.ts';
import type { AskExecutionScope } from '../network/research-scope.ts';
import type { GuidedNextAction } from '../network/guided-next-actions.ts';

export const GUIDED_SESSION_VERSION = 'ask-guided-research-session-v4' as const;
export const GUIDED_SESSION_TTL_MS = 30 * 60 * 1000;
export const GUIDED_PILOT_HUBS = ['senior', 'contractor', 'move', 'investor', 'insurance', 'lender'] as const;
export type GuidedPilotHub = (typeof GUIDED_PILOT_HUBS)[number];
export const GUIDED_PHASES = ['UNDERSTAND', 'CLARIFY', 'COLLECT', 'EXECUTE', 'REFINE', 'DEEP_LINK', 'ERROR_RECOVERY'] as const;
export type GuidedPhase = (typeof GUIDED_PHASES)[number];
export const GUIDED_RESULT_STATES = ['SUPPORTED_RESULTS', 'ZERO_MATCHING_ROWS', 'CLARIFICATION_REQUIRED', 'INVALID_GEOGRAPHY', 'UNSUPPORTED_STATE_CAPABILITY', 'UNSUPPORTED_TRADE_CAPABILITY', 'PUBLICATION_RESTRICTED', 'EXACT_IDENTITY', 'NO_CONFIDENT_MATCH', 'AMBIGUOUS_IDENTITIES', 'IDENTITY_COLLISION', 'UNSUPPORTED_CAPABILITY', 'INVALID_QUERY', 'BACKEND_UNAVAILABLE', 'TIMEOUT'] as const;
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

export type GuidedResearchSession = {
  phase: GuidedPhase;
  hub?: GuidedPilotHub;
  entityClass?: string;
  providerClass?: 'nursing_home' | 'home_health' | 'hospice';
  trade?: string;
  moveMode?: 'mover' | 'auto_transport' | 'identity_name' | 'identifier';
  regulatoryRole?: 'Carrier' | 'Broker' | 'Carrier/Broker';
  investorResearchMode?: 'firm_cohort' | 'identity_name' | 'identifier';
  investorFirmClass?: 'ria' | 'era' | 'ria_and_era' | 'individual_representative';
  minimumRaum?: number;
  maximumRaum?: number;
  compensationMethod?: string;
  insuranceEntityClass?: 'agency' | 'producer' | 'legal_insurer';
  insuranceResearchMode?: 'cohort' | 'identity_name' | 'identifier' | 'complaints';
  insuranceLineOfAuthority?: string;
  lenderResearchMode?: 'property_market' | 'identity_name' | 'identifier' | 'complaints' | 'unsupported_person_branch';
  hmdaAction?: 'application' | 'origination' | 'denial';
  loanType?: 'Conventional' | 'FHA' | 'VA' | 'USDA' | 'Other';
  geography?: GuidedGeography;
  confirmStatewide?: boolean;
  selectedFilters: Record<string, string>;
  version: typeof GUIDED_SESSION_VERSION;
  sessionId: string;
  originalQuestion: string;
  researchPlan: AskResearchPlan;
  executionScope: AskExecutionScope;
  queryType: UniversalQueryType;
  identifier?: { type: string; value: string };
  identityName?: string;
  requestedEvidence: string[];
  missingFields: string[];
  availableChoices: GuidedChoice[];
  availableRefinements: GuidedRefinement[];
  lastExecution?: {
    source: 'specialist';
    resultState: GuidedResultState;
    errorCode?: string;
    resultBearing: true;
    choicesBearing: boolean;
    executedAt: string;
  };
  resultCount?: number;
  nextAction?: string;
  nextActions: GuidedNextAction[];
  createdAt: string;
  updatedAt: string;
  history: GuidedSessionSnapshot[];
};

export type GuidedSessionSnapshot = Omit<GuidedResearchSession,
  'version' | 'sessionId' | 'originalQuestion' | 'createdAt' | 'updatedAt' | 'history'>;

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
  destination?: { type: 'PROFILE' | 'DIRECTORY' | 'VERIFY' | 'STATE_RESEARCH' | 'COUNTY_RESEARCH' | 'OFFICIAL_SOURCE' | 'RESEARCH_IDENTITY'; href: string; label: string };
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
  choices?: GuidedChoice[];
  provenance: Record<string, string>;
  limitations: string[];
  destinations: Array<{ type: NonNullable<GuidedResultRow['destination']>['type']; href: string; label: string }>;
  error?: { code: string; retryable: boolean };
  latencyMs: number;
  firstUsefulResult: boolean;
  nextActions?: GuidedNextAction[];
};

export type GuidedAction =
  | { type: 'START'; question: string }
  | { type: 'SELECT_CHOICE'; value: string }
  | { type: 'SET_GEOGRAPHY'; value: string }
  | { type: 'SET_FILTER'; field: string; value: string }
  | { type: 'CLEAR_FILTER'; field: string }
  | { type: 'CLEAR_ALL_FILTERS' }
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
