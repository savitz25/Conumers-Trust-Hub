/**
 * ASK-SEARCH-004 — Hub adapter contract.
 * Ask owns descriptors + URL generation; specialists remain authoritative for data/UI.
 */

import type {
  SearchEntityType,
  SearchHubId,
  TrustHubSearchIntent,
} from '../types';
import type { HubEntityHandoffResult, HubSearchHandoffResult } from '../handoff';

/**
 * Lightweight discovery entity shape for Option A handoffs.
 * Full discovery index arrives in later tasks — this is the Ask-side contract stub.
 */
export type NetworkDiscoveryEntity = {
  network_entity_id: string;
  hub: SearchHubId;
  source_entity_id: string;
  entity_type: SearchEntityType;
  display_name: string;
  /** Absolute or path-absolute specialist profile URL when known */
  canonical_profile_url: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  categories?: string[];
  trust_report_available?: boolean;
};

export type HubGeoCapabilities = {
  state: boolean;
  county: boolean;
  city: boolean;
  zip: boolean;
  radius: boolean;
};

export type HubAdapterMaturity = 'ready' | 'soft_handoff' | 'disabled';

export type HubSearchAdapter = {
  hub: SearchHubId;
  displayName: string;
  origin: string;
  supportedEntityTypes: SearchEntityType[];
  supportedCategories?: string[];
  geography: HubGeoCapabilities;
  maturity: HubAdapterMaturity;
  /** Option B — View More Results */
  buildSearchHandoff: (intent: TrustHubSearchIntent) => HubSearchHandoffResult;
  /** Option A — entity / Trust Report */
  buildEntityHandoff: (
    entity: NetworkDiscoveryEntity,
    intent: TrustHubSearchIntent
  ) => HubEntityHandoffResult;
};
