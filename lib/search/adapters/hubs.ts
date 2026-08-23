/**
 * Per-Hub Universal Search adapters (ASK-SEARCH-004).
 * Path choices mirror existing journey-links deep-link conventions where available.
 */

import { CANONICAL_ORIGINS, NETWORK_PUBLIC_NAMES } from '../../network/registry';
import { MOVE_CITY_HUBS, normalizeState } from '../../orchestration/journey-links';
import {
  analyticsFromContext,
  buildSearchBackLabel,
  intentToHandoffContext,
  serializeHandoffContext,
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
    analytics: analyticsFromContext(hub, handoffType, ctx, maturity),
    ...extra,
  };
}

/**
 * Option A: canonical specialist entity URL + src=ask + structured search context.
 * Does not implement specialist-side back button — only supplies backLabel metadata.
 */
function entityResult(
  hub: SearchHubId,
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent,
  fallbackPath: string,
  maturity: HubSearchAdapter['maturity']
): HubEntityHandoffResult {
  const ctx = intentToHandoffContext(intent);
  const { profilePath, canonicalProfileUrl, url } = appendContextToCanonicalUrl(
    hub,
    entity.canonical_profile_url,
    fallbackPath,
    ctx
  );
  return {
    destinationHub: hub,
    handoffType: 'entity',
    path: profilePath.includes('?') ? profilePath : withHandoffParams(profilePath, ctx),
    url,
    context: ctx,
    backLabel: buildSearchBackLabel(intent),
    maturity,
    analytics: analyticsFromContext(hub, 'entity', ctx, maturity),
    networkEntityId: entity.network_entity_id,
    profilePath: profilePath.split('?')[0],
    canonicalProfileUrl,
  };
}

function appendContextToCanonicalUrl(
  hub: SearchHubId,
  canonical: string,
  fallbackPath: string,
  ctx: SearchHandoffContext
): { profilePath: string; canonicalProfileUrl: string; url: string } {
  const q = serializeHandoffContext(ctx);
  try {
    if (canonical.startsWith('http')) {
      const u = new URL(canonical);
      const params = new URLSearchParams(u.search);
      // Merge allowlisted context; never copy arbitrary existing PII-like keys in
      for (const [k, v] of new URLSearchParams(q).entries()) {
        params.set(k, v);
      }
      u.search = params.toString();
      return {
        profilePath: u.pathname + (u.search ? `?${u.searchParams.toString()}` : ''),
        canonicalProfileUrl: canonical.split('?')[0],
        url: u.toString(),
      };
    }
    if (canonical.startsWith('/')) {
      const pathWithQ = withHandoffParams(canonical, ctx);
      return {
        profilePath: pathWithQ,
        canonicalProfileUrl: `${originOf(hub)}${canonical.split('?')[0]}`,
        url: absolute(hub, pathWithQ),
      };
    }
  } catch {
    /* fall through */
  }
  const pathWithQ = withHandoffParams(fallbackPath, ctx);
  return {
    profilePath: pathWithQ,
    canonicalProfileUrl: absolute(hub, fallbackPath),
    url: absolute(hub, pathWithQ),
  };
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
    return entityResult('move', entity, intent, fallback, 'ready');
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
    const path =
      intent.entityType === 'auto_loan_company' ? '/auto-loan-companies' : '/from-ask';
    return result('lender', 'view_more', path, ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/lenders/${entity.source_entity_id}`;
    return entityResult('lender', entity, intent, fallback, 'ready');
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
    return result('insurance', 'view_more', '/from-ask', ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    const fallback =
      entity.entity_type === 'insurance_carrier'
        ? `/carriers/${entity.source_entity_id}`
        : `/providers/${entity.source_entity_id}`;
    return entityResult('insurance', entity, intent, fallback, 'ready');
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

    const path = '/from-ask';
    const ready =
      stateSlug === 'florida' && category && flTrade[category]
        ? 'Florida bounded READY category — specialist /from-ask owns routing'
        : 'Structured context attached; Hub-wide Contractor remains soft_handoff';

    return result('contractor', 'view_more', path, ctx, 'soft_handoff', intent, {
      notes: ready,
    });
  },
  buildEntityHandoff(entity, intent) {
    const fallback = `/contractors/${entity.source_entity_id}`;
    return entityResult('contractor', entity, intent, fallback, 'soft_handoff');
  },
};

/** Senior — nursing/SNF READY via SENIOR-002 /from-ask. AL/memory/home care fail closed upstream. */
export const seniorAdapter: HubSearchAdapter = {
  hub: 'senior',
  displayName: NETWORK_PUBLIC_NAMES.senior,
  origin: CANONICAL_ORIGINS.senior,
  supportedEntityTypes: ['nursing_facility'],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'ready',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'senior_care' });
    return result('senior', 'view_more', '/from-ask', ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    // Canonical CMS facility URLs preferred; CCN slug fallback
    const ccn = entity.source_entity_id.replace(/^ccn-/, '');
    const fallback = `/facility/cms/${ccn}`;
    return entityResult('senior', entity, intent, fallback, 'ready');
  },
};

/** Investor — RIA/ERA READY via INVESTOR-002 /from-ask. Products fail closed upstream. */
export const investorAdapter: HubSearchAdapter = {
  hub: 'investor',
  displayName: NETWORK_PUBLIC_NAMES.investor,
  origin: CANONICAL_ORIGINS.investor,
  supportedEntityTypes: ['ria', 'era', 'advisory_firm', 'investment_adviser'],
  geography: { state: true, county: true, city: true, zip: true, radius: false },
  maturity: 'ready',
  buildSearchHandoff(intent) {
    const ctx = intentToHandoffContext(intent, { journey: 'investing' });
    return result('investor', 'view_more', '/from-ask', ctx, 'ready', intent);
  },
  buildEntityHandoff(entity, intent) {
    // Canonical SEC CRD firm URLs preferred
    const crd = entity.source_entity_id.replace(/^crd-/, '');
    const fallback = `/firm/sec-crd-${crd}`;
    return entityResult('investor', entity, intent, fallback, 'ready');
  },
};
