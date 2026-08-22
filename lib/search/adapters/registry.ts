/**
 * Central Hub adapter registry — ASK-SEARCH-004.
 * Adding Hub N = register adapter here (+ Network registry), not rewrite Ask core.
 */

import type { SearchHubId, TrustHubSearchIntent } from '../types';
import type { HubEntityHandoffResult, HubSearchHandoffResult } from '../handoff';
import type { HubSearchAdapter, NetworkDiscoveryEntity } from './types';
import {
  contractorAdapter,
  insuranceAdapter,
  investorAdapter,
  lenderAdapter,
  moveAdapter,
  seniorAdapter,
} from './hubs';

export const HUB_SEARCH_ADAPTERS: Record<SearchHubId, HubSearchAdapter> = {
  move: moveAdapter,
  lender: lenderAdapter,
  insurance: insuranceAdapter,
  contractor: contractorAdapter,
  senior: seniorAdapter,
  investor: investorAdapter,
};

export function getHubSearchAdapter(hub: SearchHubId): HubSearchAdapter {
  const adapter = HUB_SEARCH_ADAPTERS[hub];
  if (!adapter) {
    throw new Error(`No Universal Search adapter registered for hub: ${hub}`);
  }
  return adapter;
}

export function listHubSearchAdapters(): HubSearchAdapter[] {
  return Object.values(HUB_SEARCH_ADAPTERS);
}

function resolveHub(intent: TrustHubSearchIntent): SearchHubId | null {
  if (intent.hub) return intent.hub;
  if (intent.primaryHub) return intent.primaryHub;
  if (intent.hubCandidates?.length === 1) return intent.hubCandidates[0];
  return null;
}

/**
 * Option B — View More Results destination from parsed intent.
 * Returns null when Hub cannot be uniquely resolved (clarification required).
 */
export function buildViewMoreHandoff(intent: TrustHubSearchIntent): HubSearchHandoffResult | null {
  const hub = resolveHub(intent);
  if (!hub) return null;
  if (intent.requiresClarification && intent.hubCandidates && intent.hubCandidates.length > 1) {
    return null;
  }
  const adapter = getHubSearchAdapter(hub);
  if (adapter.maturity === 'disabled') return null;
  return adapter.buildSearchHandoff(intent);
}

/**
 * Option A — entity / Trust Report handoff.
 * Entity hub must match intent hub when intent has a hub; otherwise entity.hub wins.
 */
export function buildEntityHandoff(
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent
): HubEntityHandoffResult {
  const hub = entity.hub;
  const adapter = getHubSearchAdapter(hub);
  // Preserve search context from intent even if entity supplies profile URL
  const merged: TrustHubSearchIntent = {
    ...intent,
    hub: intent.hub || hub,
    entityType: intent.entityType || entity.entity_type,
    location: intent.location || {
      precision: entity.city ? 'city' : entity.state ? 'state' : 'unknown',
      cityName: entity.city,
      stateCode: entity.state,
      countySlug: entity.county,
      zip: entity.zip,
    },
  };
  return adapter.buildEntityHandoff(entity, merged);
}
