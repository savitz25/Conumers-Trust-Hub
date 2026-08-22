/**
 * ASK-SEARCH-003 — Universal Search intent types (deterministic parser).
 * Aligns with docs/ask-universal-search-v1-architecture.md + lexicon.
 */

export type SearchHubId =
  | 'move'
  | 'lender'
  | 'insurance'
  | 'contractor'
  | 'senior'
  | 'investor';

export type SearchParseMethod =
  | 'deterministic'
  | 'taxonomy'
  | 'geo_resolver'
  | 'llm_assist'
  | 'fallback_keyword'
  | 'mixed';

export type SearchConfidence = 'high' | 'medium' | 'low';

export type GeoPrecision =
  | 'zip'
  | 'city'
  | 'county'
  | 'state'
  | 'metro'
  | 'radius'
  | 'near_me'
  | 'unknown';

export type ConsumerSearchIntent =
  | 'find_provider'
  | 'compare'
  | 'verify'
  | 'research'
  | 'calculate'
  | 'analyze_document'
  | 'life_event';

export type SupportStatus =
  | true
  | false
  | 'soft'
  | 'partial'
  | 'special'
  | 'planner_bridge'
  | null;

export type SearchEntityType =
  | 'mover'
  | 'interstate_mover'
  | 'intrastate_mover'
  | 'moving_broker'
  | 'auto_transporter'
  | 'mortgage_company'
  | 'mortgage_broker'
  | 'bank'
  | 'auto_loan_company'
  | 'loan_officer'
  | 'insurance_agency'
  | 'insurance_agent'
  | 'insurance_brokerage'
  | 'insurance_carrier'
  | 'medicare_agent'
  | 'contractor'
  | 'nursing_facility'
  | 'assisted_living'
  | 'memory_care'
  | 'ria'
  | 'era'
  | 'advisory_firm'
  | 'investment_adviser'
  | 'unknown'
  | (string & {});

export type TrustHubSearchLocation = {
  raw?: string;
  stateCode?: string;
  stateSlug?: string;
  stateName?: string;
  countySlug?: string;
  citySlug?: string;
  cityName?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  precision: GeoPrecision;
};

export type SearchFilters = {
  regulatoryEligibleOnly?: boolean;
  trustReportAvailable?: boolean;
  mortgageType?: string;
  coverageType?: string;
  trade?: string;
  facilityType?: string;
  serviceAreaRequired?: boolean;
  hubExtras?: Record<string, string | number | boolean>;
};

export type SearchAmbiguity =
  | { type: 'hub'; options: SearchHubId[] }
  | { type: 'location'; options: TrustHubSearchLocation[] }
  | { type: 'entity_type'; options: SearchEntityType[] }
  | { type: 'category'; options: string[] };

/**
 * Structured Universal Search intent — providers are never invented here.
 */
export type TrustHubSearchIntent = {
  version: 1;
  query: string;
  normalizedQuery: string;

  hub?: SearchHubId;
  hubCandidates?: SearchHubId[];
  primaryHub?: SearchHubId;
  relatedHubs?: SearchHubId[];

  journeyKind?: string;
  situationIdHint?: string;
  consumerIntent?: ConsumerSearchIntent;

  entityType?: SearchEntityType | null;
  category?: string;
  categoryLabels?: string[];

  location?: TrustHubSearchLocation;
  origin?: TrustHubSearchLocation;
  destination?: TrustHubSearchLocation;

  filters?: SearchFilters;

  parseMethod: SearchParseMethod;
  confidence: SearchConfidence;
  /** Optional explainable 0–1 score (not shown to consumers). */
  confidenceScore?: number;
  ambiguities?: SearchAmbiguity[];

  requiresClarification: boolean;
  requiresAI: boolean;
  requiresLocation?: boolean;

  supported?: SupportStatus;
  unsupportedReason?: string;

  notes?: string;
};
