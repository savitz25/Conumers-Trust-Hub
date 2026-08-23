/**
 * Central Hub adapter registry — ASK-SEARCH-004.
 * Adding Hub N = register adapter here (+ Network registry), not rewrite Ask core.
 */

import type { SearchHubId, TrustHubSearchIntent } from '../types';
import type {
  HubEntityHandoffResult,
  HubSearchHandoffResult,
  SearchDestinationOutcome,
} from '../handoff';
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
 * Fail-closed gate before building destinations.
 * Conservative handling for unsupported / soft / ambiguous cases.
 */
export function evaluateSearchDestination(
  intent: TrustHubSearchIntent
): SearchDestinationOutcome | { status: 'proceed'; hub: SearchHubId } {
  if (intent.requiresClarification && intent.hubCandidates && intent.hubCandidates.length > 1) {
    return {
      status: 'needs_clarification',
      reason: 'Multiple Hub candidates — do not guess destination',
      analytics: { source: 'ask', handoffType: 'view_more' },
    };
  }
  if (intent.requiresClarification && !intent.hub && !intent.primaryHub) {
    return {
      status: 'needs_clarification',
      reason: 'Clarification required before handoff',
      analytics: { source: 'ask', handoffType: 'view_more' },
    };
  }

  // Explicit unsupported from parser
  if (intent.supported === false) {
    return {
      status: 'unsupported',
      reason: intent.unsupportedReason || 'Entity/category not supported for discovery handoff',
      hub: intent.hub,
      maturity: 'disabled',
      analytics: {
        source: 'ask',
        destinationHub: intent.hub,
        handoffType: 'view_more',
        entityType: intent.entityType || undefined,
        category: intent.category,
        state: intent.location?.stateCode,
        maturity: 'disabled',
      },
    };
  }

  // Senior care types that are not nursing/SNF — never invent nursing-home SERP
  if (
    intent.entityType === 'memory_care' ||
    intent.entityType === 'assisted_living' ||
    intent.entityType === 'home_care' ||
    intent.entityType === 'home_health' ||
    intent.category === 'memory_care' ||
    intent.category === 'assisted_living' ||
    intent.category === 'home_care' ||
    intent.category === 'home_health'
  ) {
    const et = intent.entityType || intent.category || 'senior_care';
    return {
      status: 'unsupported',
      reason:
        et === 'memory_care'
          ? 'memory_care_national_directory_not_built'
          : `senior_care_type_not_ready:${et}`,
      hub: 'senior',
      maturity: 'disabled',
      analytics: {
        source: 'ask',
        destinationHub: 'senior',
        handoffType: 'view_more',
        entityType: intent.entityType || undefined,
        category: intent.category,
        state: intent.location?.stateCode,
        city: intent.location?.citySlug,
        maturity: 'disabled',
      },
    };
  }

  // Investor products — never substitute advisers
  if (
    intent.category === 'etf' ||
    intent.category === 'mutual_fund' ||
    intent.category === 'stock' ||
    intent.category === 'crypto' ||
    intent.category === 'hedge_fund' ||
    intent.entityType === 'etf' ||
    intent.entityType === 'mutual_fund'
  ) {
    return {
      status: 'unsupported',
      reason: `investor_product_unsupported:${intent.entityType || intent.category}`,
      hub: 'investor',
      maturity: 'disabled',
      analytics: {
        source: 'ask',
        destinationHub: 'investor',
        handoffType: 'view_more',
        entityType: intent.entityType || undefined,
        category: intent.category,
        maturity: 'disabled',
      },
    };
  }

  // Ambiguous insurance company without entity
  if (
    intent.hub === 'insurance' &&
    (intent.entityType === null || intent.entityType === undefined) &&
    intent.requiresClarification
  ) {
    return {
      status: 'needs_clarification',
      reason: 'insurance_company_ambiguous_agency_vs_carrier',
      hub: 'insurance',
      analytics: { source: 'ask', destinationHub: 'insurance', handoffType: 'view_more' },
    };
  }

  // Loan officer — soft only
  if (intent.entityType === 'loan_officer') {
    return {
      status: 'soft_handoff',
      reason: 'loan_officer_not_first_class_directory_entity',
      hub: 'lender',
      maturity: 'soft_handoff',
    };
  }

  const hub = resolveHub(intent);
  if (!hub) {
    return {
      status: 'needs_clarification',
      reason: 'Hub not uniquely resolved',
      analytics: { source: 'ask', handoffType: 'view_more' },
    };
  }

  const adapter = getHubSearchAdapter(hub);
  if (adapter.maturity === 'disabled') {
    return { status: 'disabled', reason: `Adapter disabled for ${hub}`, hub, maturity: 'disabled' };
  }

  return { status: 'proceed', hub };
}

/**
 * Option B — View More Results with fail-closed evaluation.
 */
export function resolveViewMoreDestination(intent: TrustHubSearchIntent): SearchDestinationOutcome {
  const gate = evaluateSearchDestination(intent);
  if (gate.status !== 'proceed') {
    // loan_officer soft: still emit lender company search as soft_handoff URL
    if (gate.status === 'soft_handoff' && gate.hub === 'lender' && intent.entityType === 'loan_officer') {
      const adapter = getHubSearchAdapter('lender');
      const softened: TrustHubSearchIntent = {
        ...intent,
        entityType: 'mortgage_company',
        notes: 'soft: loan officer → mortgage company directory',
      };
      const handoff = adapter.buildSearchHandoff(softened);
      return { status: 'ok', handoff: { ...handoff, maturity: 'soft_handoff', notes: gate.reason } };
    }
    return gate;
  }
  const adapter = getHubSearchAdapter(gate.hub);
  const handoff = adapter.buildSearchHandoff(intent);
  if (adapter.maturity === 'soft_handoff') {
    return {
      status: 'ok',
      handoff: {
        ...handoff,
        maturity: 'soft_handoff',
        notes: handoff.notes,
      },
    };
  }
  return { status: 'ok', handoff };
}

/**
 * Option B convenience — returns handoff or null (clarification / unsupported).
 * Prefer resolveViewMoreDestination for explicit status.
 */
export function buildViewMoreHandoff(intent: TrustHubSearchIntent): HubSearchHandoffResult | null {
  const out = resolveViewMoreDestination(intent);
  return out.status === 'ok' ? out.handoff : null;
}

/**
 * Option A — entity / Trust Report handoff.
 * canonical specialist URL + source=ask + normalized search context + handoffType=entity
 */
export function buildEntityHandoff(
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent
): HubEntityHandoffResult {
  const hub = entity.hub;
  const adapter = getHubSearchAdapter(hub);
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

export function resolveEntityDestination(
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent
): SearchDestinationOutcome {
  if (
    entity.entity_type === 'memory_care' ||
    entity.entity_type === 'assisted_living' ||
    entity.entity_type === 'home_care' ||
    intent.entityType === 'memory_care' ||
    intent.entityType === 'assisted_living' ||
    intent.entityType === 'home_care'
  ) {
    return {
      status: 'unsupported',
      reason:
        entity.entity_type === 'memory_care' || intent.entityType === 'memory_care'
          ? 'memory_care_national_directory_not_built'
          : `senior_care_type_not_ready:${entity.entity_type || intent.entityType}`,
      hub: 'senior',
      maturity: 'disabled',
    };
  }
  const handoff = buildEntityHandoff(entity, intent);
  return { status: 'ok', handoff };
}
