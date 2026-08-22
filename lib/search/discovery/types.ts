/**
 * ASK-SEARCH-005 — Network Discovery Entity contract.
 * Ask stores enough to FIND; specialists store enough to RESEARCH.
 */

import type { SearchEntityType, SearchHubId } from '../types';

/** How an entity participates in Ask Universal Search discovery (≠ Google SEO). */
export type DiscoveryStatus = 'active' | 'held' | 'disabled';

/**
 * Service-area descriptors — Hub semantics differ; do not force one model.
 */
export type DiscoveryServiceArea =
  | { kind: 'city'; city: string; state: string }
  | { kind: 'county'; county: string; state: string }
  | { kind: 'state'; state: string }
  | { kind: 'zip'; zip: string }
  | { kind: 'interstate'; label?: string }
  | { kind: 'nationwide'; label?: string };

/**
 * Normalized lightweight discovery record for Ask FIND.
 * Does not hold Trust Report payloads, complaints, docs, PII, or ranking pay signals.
 */
export type NetworkDiscoveryEntity = {
  network_entity_id: string;
  hub: SearchHubId;
  source_entity_id: string;

  entity_type: SearchEntityType;

  display_name: string;
  legal_name?: string;

  city?: string;
  county?: string;
  state?: string; // USPS preferred
  zip?: string;

  categories?: string[];
  service_areas?: DiscoveryServiceArea[];

  /** Short Hub-authored line — not a Trust Score */
  regulatory_status_summary?: string;

  trust_report_available?: boolean;

  /** Absolute https specialist profile URL */
  canonical_profile_url: string;
  canonical_search_url?: string;

  search_terms?: string[];

  /** Ask discovery eligibility (product/data readiness — not Google indexability). Default active when omitted. */
  discovery_status?: DiscoveryStatus;

  source_version?: string;
  updated_at?: string;

  /** Fixture/test provenance only */
  fixture_provenance?: 'synthetic_test' | 'synthetic_representative';
};

export type DiscoveryMatchReason =
  | 'hub_match'
  | 'entity_match'
  | 'category_match'
  | 'city_match'
  | 'zip_match'
  | 'county_match'
  | 'state_match'
  | 'service_area_match'
  | 'name_match'
  | 'search_term_match';

export type DiscoverySearchMatch = {
  entity: NetworkDiscoveryEntity;
  score: number;
  reasons: DiscoveryMatchReason[];
};

export type DiscoverySearchResult = {
  /** Ranked matches (may exceed preview cap) */
  matches: DiscoverySearchMatch[];
  total: number;
  /** False when intent cannot be searched (ambiguous / unsupported) */
  supported: boolean;
  status: 'ok' | 'needs_clarification' | 'unsupported' | 'empty';
  reason?: string;
  /** Preview-compatible slice — max 7 */
  topMatches: DiscoverySearchMatch[];
};
