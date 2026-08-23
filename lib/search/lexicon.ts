/**
 * Curated phrase lexicon for ASK-SEARCH-003 (from ASK-SEARCH-002).
 * Longest-match lists — order matters (more specific first).
 */

import type { SearchEntityType, SearchHubId, SupportStatus } from './types';

export type LexMatch = {
  phrase: string;
  hub?: SearchHubId;
  hubCandidates?: SearchHubId[];
  entityType?: SearchEntityType | null;
  category?: string;
  consumerIntent?: string;
  supported?: SupportStatus;
  unsupportedReason?: string;
  soft?: boolean;
  /** Remove phrase from remainder after match */
  consume?: boolean;
};

/** Exclusion / special compounds — evaluated before normal entity match. */
export const EXCLUSION_RULES: Array<{
  test: RegExp;
  apply: () => Partial<LexMatch> & {
    hub?: SearchHubId;
    hubCandidates?: SearchHubId[];
    notes?: string;
    requiresClarification?: boolean;
    confidenceHint?: 'high' | 'medium' | 'low';
    supported?: SupportStatus;
    unsupportedReason?: string;
    entityType?: SearchEntityType | null;
    category?: string;
    consumerIntent?: string;
    situationIdHint?: string;
    primaryHub?: SearchHubId;
    relatedHubs?: SearchHubId[];
  };
}> = [
  {
    test: /\binvestment property mortgage\b/,
    apply: () => ({
      hub: 'lender',
      entityType: 'mortgage_company',
      supported: true,
      confidenceHint: 'high',
      notes: 'exclusion: not investor',
    }),
  },
  {
    test: /\bsenior moving (company|companies|service)\b/,
    apply: () => ({
      hub: 'move',
      entityType: 'mover',
      supported: true,
      confidenceHint: 'high',
      notes: 'not senior hub',
    }),
  },
  {
    test: /\bmoving insurance\b/,
    apply: () => ({
      hubCandidates: ['move', 'insurance'],
      supported: 'special',
      requiresClarification: true,
      confidenceHint: 'medium',
      notes: 'exclusion compound',
    }),
  },
  {
    test: /\bcredit repair\b/,
    apply: () => ({
      hub: 'lender',
      entityType: null,
      supported: false,
      unsupportedReason: 'credit_repair_not_live',
      confidenceHint: 'medium',
    }),
  },
  {
    test: /\bmca companies\b|\bmerchant cash advance\b/,
    apply: () => ({
      hub: 'lender',
      supported: false,
      unsupportedReason: 'mca_not_live',
      confidenceHint: 'medium',
    }),
  },
  {
    test: /\bmutual funds?\b|\betf\b|\bapple stock\b/,
    apply: () => ({
      hub: 'investor',
      supported: false,
      unsupportedReason: 'funds_not_live_search',
      confidenceHint: 'medium',
    }),
  },
  {
    test: /\bhome inspectors?\b/,
    apply: () => ({
      hub: 'contractor',
      supported: false,
      unsupportedReason: 'trade_not_in_controlled_taxonomy',
      confidenceHint: 'medium',
    }),
  },
  {
    test: /\bmemory care\b/,
    apply: () => ({
      hub: 'senior',
      entityType: 'memory_care',
      supported: false,
      unsupportedReason: 'memory_care_national_directory_not_built',
      confidenceHint: 'medium',
    }),
  },
];

/** Multi-word entity/category phrases (longest first). */
export const PHRASE_RULES: LexMatch[] = [
  // Investor regulatory
  { phrase: 'registered investment adviser', hub: 'investor', entityType: 'ria', supported: true },
  { phrase: 'registered investment advisor', hub: 'investor', entityType: 'ria', supported: true },
  { phrase: 'exempt reporting adviser', hub: 'investor', entityType: 'era', supported: true },
  { phrase: 'exempt reporting advisor', hub: 'investor', entityType: 'era', supported: true },
  { phrase: 'investment advisers', hub: 'investor', entityType: 'ria', supported: true },
  { phrase: 'investment adviser', hub: 'investor', entityType: 'ria', supported: true },
  { phrase: 'advisory firm', hub: 'investor', entityType: 'advisory_firm', supported: true, soft: true },
  { phrase: 'investment firm', hub: 'investor', entityType: 'advisory_firm', supported: 'soft', soft: true },
  { phrase: 'wealth manager', hub: 'investor', entityType: 'advisory_firm', supported: 'soft', soft: true },
  { phrase: 'financial adviser', hub: 'investor', entityType: 'advisory_firm', supported: 'soft', soft: true },
  { phrase: 'financial advisor', hub: 'investor', entityType: 'advisory_firm', supported: 'soft', soft: true },

  // Senior
  { phrase: 'skilled nursing facility', hub: 'senior', entityType: 'nursing_facility', supported: true },
  { phrase: 'long term care facility', hub: 'senior', entityType: 'nursing_facility', supported: true, soft: true },
  { phrase: 'long-term care facility', hub: 'senior', entityType: 'nursing_facility', supported: true, soft: true },
  { phrase: 'nursing homes', hub: 'senior', entityType: 'nursing_facility', supported: true },
  { phrase: 'nursing home', hub: 'senior', entityType: 'nursing_facility', supported: true },
  { phrase: 'nursing facility', hub: 'senior', entityType: 'nursing_facility', supported: true },
  { phrase: 'assisted living', hub: 'senior', entityType: 'assisted_living', supported: 'soft', soft: true },
  { phrase: 'care home', hub: 'senior', entityType: 'assisted_living', supported: 'soft', soft: true },
  { phrase: 'senior care', hub: 'senior', entityType: null, supported: 'partial', soft: true },
  { phrase: 'senior facility', hub: 'senior', entityType: null, supported: 'partial', soft: true },

  // Move
  { phrase: 'household goods broker', hub: 'move', entityType: 'moving_broker', supported: true },
  { phrase: 'moving broker', hub: 'move', entityType: 'moving_broker', supported: true },
  { phrase: 'hhg broker', hub: 'move', entityType: 'moving_broker', supported: true },
  { phrase: 'long distance mover', hub: 'move', entityType: 'interstate_mover', supported: true },
  { phrase: 'long-distance mover', hub: 'move', entityType: 'interstate_mover', supported: true },
  { phrase: 'cross-country movers', hub: 'move', entityType: 'interstate_mover', supported: true },
  { phrase: 'cross country movers', hub: 'move', entityType: 'interstate_mover', supported: true },
  { phrase: 'interstate moving company', hub: 'move', entityType: 'interstate_mover', supported: true },
  { phrase: 'interstate movers', hub: 'move', entityType: 'interstate_mover', supported: true },
  { phrase: 'intrastate movers', hub: 'move', entityType: 'intrastate_mover', supported: true },
  { phrase: 'local movers', hub: 'move', entityType: 'intrastate_mover', supported: true },
  { phrase: 'moving companies', hub: 'move', entityType: 'mover', supported: true },
  { phrase: 'moving company', hub: 'move', entityType: 'mover', supported: true },
  { phrase: 'moving service', hub: 'move', entityType: 'mover', supported: true },
  { phrase: 'hhg mover', hub: 'move', entityType: 'mover', supported: true },
  { phrase: 'auto transport', hub: 'move', entityType: 'auto_transporter', supported: true },
  { phrase: 'car shipping company', hub: 'move', entityType: 'auto_transporter', supported: true },
  { phrase: 'car shipping', hub: 'move', entityType: 'auto_transporter', supported: true },
  { phrase: 'vehicle shipping', hub: 'move', entityType: 'auto_transporter', supported: true },

  // Lender
  { phrase: 'auto loan companies', hub: 'lender', entityType: 'auto_loan_company', supported: true },
  { phrase: 'mortgage companies', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'mortgage company', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'mortgage brokers', hub: 'lender', entityType: 'mortgage_broker', supported: true },
  { phrase: 'mortgage broker', hub: 'lender', entityType: 'mortgage_broker', supported: true },
  { phrase: 'mortgage lenders', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'mortgage lender', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'home loan company', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'refinance company', hub: 'lender', entityType: 'mortgage_company', category: 'refinance', supported: true },
  { phrase: 'loan officer', hub: 'lender', entityType: 'loan_officer', supported: 'soft', soft: true },
  { phrase: 'fdic banks', hub: 'lender', entityType: 'bank', supported: true },
  { phrase: 'jumbo mortgage lenders', hub: 'lender', entityType: 'mortgage_company', category: 'jumbo', supported: true },
  { phrase: 'conventional lenders', hub: 'lender', entityType: 'mortgage_company', category: 'conventional', supported: true },
  { phrase: 'usda loan lenders', hub: 'lender', entityType: 'mortgage_company', category: 'usda', supported: true },
  { phrase: 'fha lenders', hub: 'lender', entityType: 'mortgage_company', category: 'fha', supported: true },
  { phrase: 'va mortgage company', hub: 'lender', entityType: 'mortgage_company', category: 'va', supported: true },
  { phrase: 'refi lender', hub: 'lender', entityType: 'mortgage_company', category: 'refinance', supported: true },

  // Insurance
  { phrase: 'medicare agents', hub: 'insurance', entityType: 'medicare_agent', supported: true },
  { phrase: 'medicare agent', hub: 'insurance', entityType: 'medicare_agent', supported: true },
  { phrase: 'home insurance companies', hub: 'insurance', entityType: 'insurance_agency', category: 'homeowners', supported: true, soft: true },
  { phrase: 'homeowners insurance', hub: 'insurance', entityType: 'insurance_agency', category: 'homeowners', supported: true, soft: true },
  { phrase: 'home insurance', hub: 'insurance', entityType: 'insurance_agency', category: 'homeowners', supported: true, soft: true },
  { phrase: 'life insurance agent', hub: 'insurance', entityType: 'insurance_agent', category: 'life', supported: true },
  { phrase: 'health insurance agency', hub: 'insurance', entityType: 'insurance_agency', category: 'health', supported: true },
  { phrase: 'auto insurance agencies', hub: 'insurance', entityType: 'insurance_agency', category: 'auto', supported: true },
  { phrase: 'auto insurance agents', hub: 'insurance', entityType: 'insurance_agent', category: 'auto', supported: true },
  { phrase: 'insurance agencies', hub: 'insurance', entityType: 'insurance_agency', supported: true },
  { phrase: 'insurance company', hub: 'insurance', entityType: null, supported: 'soft', soft: true },
  { phrase: 'insurance companies', hub: 'insurance', entityType: null, supported: 'soft', soft: true },
  { phrase: 'insurance brokerage', hub: 'insurance', entityType: 'insurance_brokerage', supported: true },
  { phrase: 'insurance carriers', hub: 'insurance', entityType: 'insurance_carrier', supported: true },
  { phrase: 'insurance carrier', hub: 'insurance', entityType: 'insurance_carrier', supported: true },
  { phrase: 'insurance agents', hub: 'insurance', entityType: 'insurance_agent', supported: true },
  { phrase: 'insurance agent', hub: 'insurance', entityType: 'insurance_agent', supported: true },
  { phrase: 'insurance agency', hub: 'insurance', entityType: 'insurance_agency', supported: true },
  { phrase: 'flood insurance', hub: 'insurance', entityType: 'insurance_agency', category: 'flood', supported: true, soft: true },
  { phrase: 'umbrella insurance agency', hub: 'insurance', entityType: 'insurance_agency', category: 'umbrella', supported: true },

  // Contractor trades
  { phrase: 'air conditioning contractors', hub: 'contractor', entityType: 'contractor', category: 'hvac', supported: true },
  { phrase: 'air conditioning', hub: 'contractor', entityType: 'contractor', category: 'hvac', supported: true },
  { phrase: 'kitchen remodeler', hub: 'contractor', entityType: 'contractor', category: 'kitchen_remodel', supported: true },
  { phrase: 'bathroom renovation company', hub: 'contractor', entityType: 'contractor', category: 'bathroom_remodel', supported: true },
  { phrase: 'roof replacement company', hub: 'contractor', entityType: 'contractor', category: 'roofing', supported: true },
  { phrase: 'roofing contractor', hub: 'contractor', entityType: 'contractor', category: 'roofing', supported: true },
  { phrase: 'general contractor', hub: 'contractor', entityType: 'contractor', category: 'general_contractor', supported: true },
  { phrase: 'pool contractor', hub: 'contractor', entityType: 'contractor', category: 'pool', supported: true },
  { phrase: 'hvac contractors', hub: 'contractor', entityType: 'contractor', category: 'hvac', supported: true },
  { phrase: 'hvac contractor', hub: 'contractor', entityType: 'contractor', category: 'hvac', supported: true },
  { phrase: 'general contractors', hub: 'contractor', entityType: 'contractor', category: 'general_contractor', supported: true },
  { phrase: 'flooring installer', hub: 'contractor', entityType: 'contractor', category: 'flooring', supported: 'soft', soft: true },
  { phrase: 'solar installer', hub: 'contractor', entityType: 'contractor', category: 'solar', supported: 'soft', soft: true },
  { phrase: 'redo my kitchen', hub: 'contractor', entityType: 'contractor', category: 'kitchen_remodel', supported: 'soft', soft: true },
  { phrase: 'fix my roof', hub: 'contractor', entityType: 'contractor', category: 'roofing', supported: true },
];

export const SINGLE_TOKEN_RULES: LexMatch[] = [
  { phrase: 'ria', hub: 'investor', entityType: 'ria', supported: true },
  { phrase: 'era', hub: 'investor', entityType: 'era', supported: true },
  { phrase: 'snf', hub: 'senior', entityType: 'nursing_facility', supported: true },
  { phrase: 'roofers', hub: 'contractor', entityType: 'contractor', category: 'roofing', supported: true },
  { phrase: 'roofer', hub: 'contractor', entityType: 'contractor', category: 'roofing', supported: true },
  { phrase: 'plumbers', hub: 'contractor', entityType: 'contractor', category: 'plumbing', supported: true },
  { phrase: 'plumber', hub: 'contractor', entityType: 'contractor', category: 'plumbing', supported: true },
  { phrase: 'electricians', hub: 'contractor', entityType: 'contractor', category: 'electrical', supported: 'soft', soft: true },
  { phrase: 'electrician', hub: 'contractor', entityType: 'contractor', category: 'electrical', supported: 'soft', soft: true },
  { phrase: 'painter', hub: 'contractor', entityType: 'contractor', category: 'painting', supported: true },
  { phrase: 'painters', hub: 'contractor', entityType: 'contractor', category: 'painting', supported: true },
  { phrase: 'contractors', hub: 'contractor', entityType: 'contractor', supported: true },
  { phrase: 'contractor', hub: 'contractor', entityType: 'contractor', supported: true },
  { phrase: 'movers', hub: 'move', entityType: 'mover', supported: true },
  { phrase: 'mover', hub: 'move', entityType: 'mover', supported: true },
  { phrase: 'lenders', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'lender', hub: 'lender', entityType: 'mortgage_company', supported: true },
  { phrase: 'refinance', hub: 'lender', entityType: 'mortgage_company', category: 'refinance', supported: true },
  { phrase: 'refi', hub: 'lender', entityType: 'mortgage_company', category: 'refinance', supported: true },
];

export function matchPhrases(q: string): { match: LexMatch; index: number } | null {
  const rules = [...PHRASE_RULES].sort((a, b) => b.phrase.length - a.phrase.length);
  for (const rule of rules) {
    const re = new RegExp(`\\b${escapeRe(rule.phrase)}\\b`);
    const m = q.match(re);
    if (m && m.index !== undefined) return { match: rule, index: m.index };
  }
  return null;
}

export function matchSingleTokens(q: string): LexMatch | null {
  for (const rule of SINGLE_TOKEN_RULES) {
    const re = new RegExp(`\\b${escapeRe(rule.phrase)}\\b`);
    if (re.test(q)) return rule;
  }
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
