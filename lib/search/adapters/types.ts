/**
 * ASK-SEARCH-004 — Hub adapter contract.
 * Ask owns descriptors + URL generation; specialists remain authoritative for data/UI.
 */

import type { SearchEntityType, SearchHubId, TrustHubSearchIntent } from '../types';
import type { HubEntityHandoffResult, HubSearchHandoffResult } from '../handoff';
import type { NetworkDiscoveryEntity } from '../discovery/types';

export type { NetworkDiscoveryEntity } from '../discovery/types';

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
