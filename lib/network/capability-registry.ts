import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES, type SpecialistHubId } from './registry.ts';

/**
 * Canonical Prompt 2 capability registry.
 * Routing uses this file, not marketing copy or branch-only work.
 * Audit date: 2026-08-29 production homepages.
 */

export type FederatedExecutionKind = 'execute' | 'handoff' | 'unsupported';
export type HubAskStatus = 'live' | 'partial' | 'planned' | 'unsupported';

export type HubCapabilityRecord = {
  hubId: SpecialistHubId;
  name: string;
  origin: string;
  askStatus: HubAskStatus;
  /** Parent may construct a structured specialist Ask URL. Does not scrape or query specialist DBs. */
  federatedExecution: FederatedExecutionKind;
  structuredAskUrl?: string;
  structuredAskApiUrl?: string;
  askContract?: string;
  supportedAskModes?: string[];
  entityQuery: HubAskStatus;
  identifierLookup: HubAskStatus;
  marketAggregate: HubAskStatus;
  stateCoverage: HubAskStatus;
  countyCoverage: HubAskStatus;
  evidenceLookup: HubAskStatus;
  comparison: HubAskStatus;
  nameSearch: HubAskStatus;
  saveSupport: 'handoff' | 'unsupported';
  publicSearchUrl?: string;
  verifyUrl?: string;
  notes: string[];
};

export const HUB_CAPABILITY_REGISTRY: Record<SpecialistHubId, HubCapabilityRecord> = {
  move: {
    hubId: 'move',
    name: NETWORK_PUBLIC_NAMES.move,
    origin: CANONICAL_ORIGINS.move,
    askStatus: 'live',
    federatedExecution: 'execute',
    structuredAskUrl: 'https://www.movetrusthub.com/ask',
    structuredAskApiUrl: 'https://www.movetrusthub.com/api/ask',
    askContract: 'move-ask-v1',
    supportedAskModes: ['entity', 'identifier', 'count', 'aggregate', 'comparison', 'evidence', 'definition', 'fail_closed'],
    entityQuery: 'live',
    identifierLookup: 'live',
    marketAggregate: 'partial',
    stateCoverage: 'partial',
    countyCoverage: 'unsupported',
    evidenceLookup: 'partial',
    comparison: 'live',
    nameSearch: 'partial',
    saveSupport: 'handoff',
    publicSearchUrl: 'https://www.movetrusthub.com/?q=',
    verifyUrl: 'https://www.movetrusthub.com/verify-dot',
    notes: [
      'Production structured Ask is live at /ask (move-ask-v1). Public JSON: GET /api/ask?q=. Parent constructs the Ask URL and may read that public contract; it does not query the Move database.',
      'Carrier, broker, and Carrier/Broker stay separate. Dual role is disclosed, not double-counted as two companies.',
      'Labeled USDOT and labeled MC. Bare digits fail closed. USDOT is identity, not an endorsement. MC is a docket, not a ranking.',
      'Executable geography is recorded headquarters/address — not service territory. Florida IM registration is FDACS, not FMCSA interstate authority.',
      'A broker is not the transporting carrier. Active authority is not a recommendation. Complaint observations are not confirmed wrongdoing.',
    ],
  },
  lender: {
    hubId: 'lender',
    name: NETWORK_PUBLIC_NAMES.lender,
    origin: CANONICAL_ORIGINS.lender,
    askStatus: 'planned',
    federatedExecution: 'handoff',
    entityQuery: 'partial',
    identifierLookup: 'partial',
    marketAggregate: 'partial',
    stateCoverage: 'partial',
    countyCoverage: 'planned',
    evidenceLookup: 'partial',
    comparison: 'partial',
    nameSearch: 'partial',
    saveSupport: 'handoff',
    publicSearchUrl: 'https://www.lendertrusthub.com/lender',
    notes: [
      'No production /ask route. Do not treat Lender Ask as live.',
      'Controlled public corpus: 181 national-searchable + 130 Florida-public profiles.',
      'Florida /florida is enhanced state intelligence. County market intelligence pages are not published on the intelligence page.',
      'NMLS lookup is a specialist search / NMLS Consumer Access handoff, not a live federated graph query.',
    ],
  },
  insurance: {
    hubId: 'insurance',
    name: NETWORK_PUBLIC_NAMES.insurance,
    origin: CANONICAL_ORIGINS.insurance,
    askStatus: 'live',
    federatedExecution: 'execute',
    structuredAskUrl: 'https://www.insurancetrusthub.com/ask',
    structuredAskApiUrl: 'https://www.insurancetrusthub.com/api/ask',
    askContract: 'insurance-ask-v1',
    supportedAskModes: ['entity', 'identifier', 'count', 'aggregate', 'comparison', 'evidence', 'definition', 'fail_closed'],
    entityQuery: 'live',
    identifierLookup: 'live',
    marketAggregate: 'partial',
    stateCoverage: 'partial',
    countyCoverage: 'unsupported',
    evidenceLookup: 'partial',
    comparison: 'live',
    nameSearch: 'partial',
    saveSupport: 'handoff',
    publicSearchUrl: 'https://www.insurancetrusthub.com/directory',
    notes: [
      'Production structured Ask is live at /ask (insurance-ask-v1). Public JSON: GET /api/ask?q=. Parent constructs the Ask URL and may read that public contract; it does not query the Insurance database.',
      'Person, agency, and legal insurer stay separate. Counts are never one “insurance providers” total.',
      'Labeled NPN and labeled NAIC company code. Bare digits fail closed. NPN is not automatically a person.',
      'Executable geography is primarily credential jurisdiction — not office location, domicile, or service territory.',
      'Official LOA observations are source-limited (TX/MA/VT). Florida agency-level official LOA rows are absent; empty P&C results are a data limitation, not “no P&C authority.” LOA is not appointment. Marketplace evidence is not certification.',
      'Public people pages = 0. Public graph-agency profiles = 0. Directory ZIP listings are a separate surface.',
    ],
  },
  contractor: {
    hubId: 'contractor',
    name: NETWORK_PUBLIC_NAMES.contractor,
    origin: CANONICAL_ORIGINS.contractor,
    askStatus: 'live',
    federatedExecution: 'execute',
    structuredAskUrl: 'https://www.contractortrusthub.com/ask',
    entityQuery: 'live',
    identifierLookup: 'live',
    marketAggregate: 'live',
    stateCoverage: 'partial',
    countyCoverage: 'partial',
    evidenceLookup: 'partial',
    comparison: 'live',
    nameSearch: 'live',
    saveSupport: 'handoff',
    publicSearchUrl: 'https://www.contractortrusthub.com/verify?q=',
    verifyUrl: 'https://www.contractortrusthub.com/verify',
    notes: [
      'Production structured Ask is live at /ask. Parent constructs the Ask URL with interpreted filters; it does not query the contractor database.',
      'Live researched states: FL, TX, NJ, OR, WA, CA, AZ, LA, MS, KY.',
      'Enhanced county intelligence currently published for Broward and Palm Beach, Florida.',
    ],
  },
  senior: {
    hubId: 'senior',
    name: NETWORK_PUBLIC_NAMES.senior,
    origin: CANONICAL_ORIGINS.senior,
    askStatus: 'live',
    federatedExecution: 'execute',
    structuredAskUrl: 'https://www.seniortrusthub.com/ask',
    structuredAskApiUrl: 'https://www.seniortrusthub.com/api/ask',
    askContract: 'senior-ask-v1',
    supportedAskModes: ['entity', 'identifier', 'count', 'aggregate', 'comparison', 'evidence', 'definition', 'fail_closed'],
    entityQuery: 'live',
    identifierLookup: 'live',
    marketAggregate: 'live',
    stateCoverage: 'live',
    countyCoverage: 'partial',
    evidenceLookup: 'live',
    comparison: 'live',
    nameSearch: 'live',
    saveSupport: 'handoff',
    publicSearchUrl: 'https://www.seniortrusthub.com/search',
    notes: [
      'Production structured Ask is live at /ask (senior-ask-v1). Public JSON: GET /api/ask?q=. Parent constructs the Ask URL and may read that public contract; it does not query the Senior database.',
      'Supported classes: Nursing Home, Home Health, Hospice. Counts stay separate — never one “senior providers” total.',
      'Labeled CMS CCN only. Bare six-digit numbers fail closed.',
      'Nursing Home: state + address-county. Home Health: state/city/ZIP; county unsupported. Hospice: state + office-county. Address/office geography is not service area.',
      'CHOW is Nursing Home only. Overall CMS star is Nursing Home only. Home Health uses Quality of Patient Care stars. Hospice has no overall CMS star. CMS ratings are not TrustHub recommendations.',
    ],
  },
  investor: {
    hubId: 'investor',
    name: NETWORK_PUBLIC_NAMES.investor,
    origin: CANONICAL_ORIGINS.investor,
    askStatus: 'live',
    federatedExecution: 'execute',
    structuredAskUrl: 'https://www.investortrusthub.com/ask',
    structuredAskApiUrl: 'https://www.investortrusthub.com/api/ask',
    askContract: 'investor-ask-v1',
    supportedAskModes: ['entity', 'identifier', 'count', 'aggregate', 'comparison', 'evidence', 'definition', 'fail_closed'],
    entityQuery: 'live',
    identifierLookup: 'live',
    marketAggregate: 'live',
    stateCoverage: 'live',
    countyCoverage: 'unsupported',
    evidenceLookup: 'partial',
    comparison: 'live',
    nameSearch: 'live',
    saveSupport: 'unsupported',
    publicSearchUrl: 'https://www.investortrusthub.com/firms',
    notes: [
      'Production structured Ask is live at /ask (investor-ask-v1). Public JSON: GET /api/ask?q=. Parent constructs the Ask URL and may read that public contract; it does not query the Investor database.',
      'RIA and ERA stay separate. Counts are firm facts, not Form ADV observation totals.',
      'Labeled CRD only. Bare digits fail closed.',
      'Geography is principal office on the SEC/IARD roster — not client geography, service territory, or notice-filing.',
      'RAUM is Form ADV Item 5F(2)(c) USD, RIA only — not performance. Item 5.E is compensation methods, not fee amounts. Ownership is confidence-gated. Disclosures are not an enforcement census.',
    ],
  },
};

export function capabilityFor(hubId: SpecialistHubId): HubCapabilityRecord {
  return HUB_CAPABILITY_REGISTRY[hubId];
}
