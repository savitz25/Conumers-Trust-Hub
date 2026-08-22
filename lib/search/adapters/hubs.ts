/**
 * Per-Hub Universal Search adapters (ASK-SEARCH-004).
 * Path choices mirror existing journey-links deep-link conventions where available.
 */

import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from '../../network/registry';
import {
  INSURANCE_DESTINATION_SLUGS,
  MOVE_CITY_HUBS,
  normalizeState,
} from '../../orchestration/journey-links';
import {
  buildSearchBackLabel,
  intentToHandoffContext,
  withHandoffParams,
  type HubEntityHandoffResult,
  type HubSearchHandoffResult,
  type SearchHandoffContext,
} from '../handoff';
import type { SearchHubId, TrustHubSearchIntent } from '../types';
import type { HubSearchAdapter, NetworkDiscoveryEntity } from './types';

function originOf(hub: SearchHubId): string {
  return CANONICAL_ORIGINS[hub];
}

function absolute(hub: SearchHubId, pathWithQuery: string): string {
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `${originOf(hub)}${path}`;
}

function stateSlugFromIntent(intent: TrustHubSearchIntent): string | undefined {
  const loc = intent.location;
  if (loc?.stateSlug) return loc.stateSlug;
  if (loc?.stateCode) return normalizeState(loc.stateCode)?.stateSlug;
  return undefined;
}

function citySlugFromIntent(intent: TrustHubSearchIntent): string | undefined {
  const loc = intent.location;
  return loc?.citySlug || loc?.cityName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function result(
  hub: SearchHubId,
  handoffType: 'view_more' | 'entity',
  path: string,
  ctx: SearchHandoffContext,
  maturity: HubSearchAdapter['maturity'],
  intent: TrustHubSearchIntent,
  extra?: Partial<HubSearchHandoffResult>
): HubSearchHandoffResult {
  const pathWithQ = withHandoffParams(path, ctx);
  return {
    destinationHub: hub,
    handoffType,
    path: pathWithQ,
    url: absolute(hub, pathWithQ),
    context: ctx,
    backLabel: buildSearchBackLabel(intent),
    maturity,
    ...extra,
  };
}

function entityResult(
  hub: SearchHubId,
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent,
  profilePath: string,
  maturity: HubSearchAdapter['maturity']
): HubEntityHandoffResult {
  const ctx = intentToHandoffContext(intent);
  const pathWithQ = withHandoffParams(profilePath, ctx);
  return {
    destinationHub: hub,
    handoffType: 'entity',
    path: pathWithQ,
    url: absolute(hub, pathWithQ),
    context: ctx,
    backLabel: buildSearchBackLabel(intent),
    maturity,
    networkEntityId: entity.network_entity_id,
    profilePath,
  };
}

function profilePathFromEntity(entity: NetworkDiscoveryEntity, fallbackPath: string): string {
  try {
    if (entity.canonical_profile_url.startsWith('http')) {
      const u = new URL(entity.canonical_profile_url);
      return u.pathname || fallbackPath;
    }
    if (entity.canonical_profile_url.startsWith('/')) return entity.canonical_profile_url;
  } catch {
    /* fall through */
  }
  return fallbackPath;
}

/** Move — strongest deep-link maturity. */
export const moveAdapter: HubSearchAdapter = {
  hub: 'move',
  displayName: NETWORK_PUBLIC_NAMES.move,
  origin: CANONICAL_ORIGINS.move,
  supportedEntityTypes: [
    'mover',
    'interstate_mover',
    'intrastate_mover',
    'moving_broker',
    'auto_transporter',
  ],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'ready',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'directory' });
    const stateSlug = stateSlugFromIntent(intent);
    const citySlug = citySlugFromIntent(intent);
    const county = intent.location?.countySlug;

    let path = '/';
    if (intent.entityType === 'auto_transporter') {
      path = '/auto-transport';
    } else if (intent.consumerIntent === 'verify') {
      path = '/verify-dot';
    } else if (citySlug) {
      const known = MOVE_CITY_HUBS.find((c) => c.citySlug === citySlug);
      if (known?.stateCode === 'FL' && known.citySlug === 'fort-lauderdale') {
        path = `/moving-to/florida/${known.citySlug}`;
      } else if (known) {
        path = `/moving-to/${known.citySlug}`;
      } else if (stateSlug && county) {
        path = `/local-movers/${stateSlug}/${county}`;
      } else if (stateSlug) {
        path = `/local-movers/${stateSlug}`;
      } else {
        path = '/';
      }
    } else if (stateSlug && county) {
      path = `/local-movers/${stateSlug}/${county}`;
    } else if (stateSlug) {
      path = `/local-movers/${stateSlug}`;
    }

    return result('move', 'view_more', path, ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/movers/${entity.source_entity_id}`;
    return entityResult('move', entity, intent, profilePathFromEntity(entity, fallback), 'ready');
  },
};

/** Lender */
export const lenderAdapter: HubSearchAdapter = {
  hub: 'lender',
  displayName: NETWORK_PUBLIC_NAMES.lender,
  origin: CANONICAL_ORIGINS.lender,
  supportedEntityTypes: [
    'mortgage_company',
    'mortgage_broker',
    'bank',
    'auto_loan_company',
    'loan_officer',
  ],
  supportedCategories: ['fha', 'va', 'conventional', 'usda', 'jumbo', 'arm', 'refinance'],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'ready',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'directory' });
    const stateSlug = stateSlugFromIntent(intent);
    const county = intent.location?.countySlug;

    let path = '/local-lenders';
    if (intent.entityType === 'bank') path = '/fdic-insured-banks';
    else if (intent.entityType === 'auto_loan_company') path = '/auto-loan-companies';
    else if (intent.consumerIntent === 'verify') path = '/local-lenders';

    if (intent.entityType !== 'bank' && intent.entityType !== 'auto_loan_company') {
      if (stateSlug && county) path = `/local-lenders/${stateSlug}/${county}`;
      else if (stateSlug) path = `/local-lenders/${stateSlug}`;
    } else if (stateSlug) {
      path = `${path}/${stateSlug}`;
    }

    return result('lender', 'view_more', path, ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/lenders/${entity.source_entity_id}`;
    return entityResult('lender', entity, intent, profilePathFromEntity(entity, fallback), 'ready');
  },
};

/** Insurance */
export const insuranceAdapter: HubSearchAdapter = {
  hub: 'insurance',
  displayName: NETWORK_PUBLIC_NAMES.insurance,
  origin: CANONICAL_ORIGINS.insurance,
  supportedEntityTypes: [
    'insurance_agency',
    'insurance_agent',
    'insurance_brokerage',
    'insurance_carrier',
    'medicare_agent',
  ],
  supportedCategories: [
    'homeowners',
    'auto',
    'health',
    'medicare',
    'life',
    'renters',
    'flood',
    'umbrella',
  ],
  geography: { state: true, county: false, city: true, zip: true, radius: false },
  maturity: 'ready',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'directory' });
    const stateSlug = stateSlugFromIntent(intent);

    let path = '/destinations';
    if (intent.entityType === 'insurance_carrier') path = '/carriers';
    else if (intent.entityType === 'medicare_agent' || intent.category === 'medicare') {
      path = '/tools/medicare-plan-finder';
    } else if (stateSlug && INSURANCE_DESTINATION_SLUGS.has(stateSlug)) {
      path = `/destinations/${stateSlug}`;
    } else if (stateSlug) {
      path = '/destinations';
    }

    return result('insurance', 'view_more', path, ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    const fallback =
      entity.entity_type === 'insurance_carrier'
        ? `/carriers/${entity.source_entity_id}`
        : `/providers/${entity.source_entity_id}`;
    return entityResult(
      'insurance',
      entity,
      intent,
      profilePathFromEntity(entity, fallback),
      'ready'
    );
  },
};

/** Contractor — soft until deep search URLs mature; still emits structured context. */
export const contractorAdapter: HubSearchAdapter = {
  hub: 'contractor',
  displayName: NETWORK_PUBLIC_NAMES.contractor,
  origin: CANONICAL_ORIGINS.contractor,
  supportedEntityTypes: ['contractor'],
  supportedCategories: [
    'roofing',
    'plumbing',
    'hvac',
    'electrical',
    'general_contractor',
    'kitchen_remodel',
    'bathroom_remodel',
    'pool',
    'painting',
    'flooring',
    'solar',
  ],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'soft_handoff',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'contractor' });
    const stateSlug = stateSlugFromIntent(intent);
    const category = intent.category;

    // Prefer Florida trade discovery when category maps cleanly
    const flTrade: Record<string, string> = {
      roofing: 'roofers',
      plumbing: 'plumbing',
      hvac: 'air-conditioning',
      pool: 'pool-spa',
      general_contractor: 'general-contractors',
    };

    let path = '/';
    if (stateSlug === 'florida' && category && flTrade[category]) {
      path = `/florida/${flTrade[category]}`;
    } else if (stateSlug === 'florida') {
      path = '/florida';
    } else if (stateSlug === 'arizona') {
      path = '/arizona';
    } else if (intent.consumerIntent === 'verify') {
      path = '/verify';
    }

    return result('contractor', 'view_more', path, ctx, 'soft_handoff', intent, {
      notes: 'Structured context attached; Hub may soft-seed until deep SERP routes exist',
    });
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/contractors/${entity.source_entity_id}`;
    return entityResult(
      'contractor',
      entity,
      intent,
      profilePathFromEntity(entity, fallback),
      'soft_handoff'
    );
  },
};

/** Senior */
export const seniorAdapter: HubSearchAdapter = {
  hub: 'senior',
  displayName: NETWORK_PUBLIC_NAMES.senior,
  origin: CANONICAL_ORIGINS.senior,
  supportedEntityTypes: ['nursing_facility', 'assisted_living', 'memory_care'],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'soft_handoff',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'senior_care' });
    // Soft root with structured params until deep SERP paths are confirmed network-wide
    const path = '/';
    return result('senior', 'view_more', path, ctx, 'soft_handoff', intent, {
      notes:
        intent.entityType === 'memory_care'
          ? 'Memory care national directory unsupported — soft Hub entry with context only'
          : 'Structured senior search context attached for Hub seeding',
    });
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/facilities/${entity.source_entity_id}`;
    return entityResult(
      'senior',
      entity,
      intent,
      profilePathFromEntity(entity, fallback),
      'soft_handoff'
    );
  },
};

/** Investor */
export const investorAdapter: HubSearchAdapter = {
  hub: 'investor',
  displayName: NETWORK_PUBLIC_NAMES.investor,
  origin: CANONICAL_ORIGINS.investor,
  supportedEntityTypes: ['ria', 'era', 'advisory_firm', 'investment_adviser'],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'soft_handoff',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'investing' });
    const path = '/';
    return result('investor', 'view_more', path, ctx, 'soft_handoff', intent, {
      notes: 'Firm research entry with structured RIA/ERA context',
    });
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/firm/${entity.source_entity_id}`;
    return entityResult(
      'investor',
      entity,
      intent,
      profilePathFromEntity(entity, fallback),
      'soft_handoff'
    );
  },
};
