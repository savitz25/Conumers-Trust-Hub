/**
 * Server-only Universal Search runner. Real 006B.1 index. No specialist network I/O.
 */

import { parseUniversalSearchQuery } from '../parser';
import {
  buildEntityHandoff,
  resolveViewMoreDestination,
} from '../adapters';
import { createRealDiscoveryIndex } from '../feeds';
import { humanMatchReason } from './match-copy';
import { entityLabel, hubPublicName, placeLine, researchCta } from './labels';
import type { TrustHubSearchIntent } from '../types';
import type { DiscoverySearchResult } from '../discovery/types';

export type SearchCardModel = {
  id: string;
  displayName: string;
  entityLabel: string;
  placeLine?: string;
  reasonLine?: string;
  regulatory?: string;
  hubId: string;
  hubLabel: string;
  profileUrl: string;
  researchCta: string;
};

export type ClarificationChoice = { label: string; href: string };

export type UniversalSearchModel = {
  q: string;
  status: 'idle' | 'ok' | 'empty' | 'unsupported' | 'needs_clarification' | 'error';
  hub?: string;
  hubLabel?: string;
  total: number;
  topMatches: SearchCardModel[];
  viewMore?: { href: string; label: string };
  clarification?: { prompt: string; choices: ClarificationChoice[] };
  message?: string;
  errorSafe?: string;
};

let cached: ReturnType<typeof createRealDiscoveryIndex> | null = null;
let cacheError: string | null = null;

export function getCachedRealIndex() {
  if (cacheError) throw new Error(cacheError);
  if (!cached) {
    try {
      cached = createRealDiscoveryIndex();
    } catch (err) {
      cacheError = 'Discovery index unavailable';
      throw err;
    }
  }
  return cached;
}

function encodeQuery(q: string): string {
  return `/search?q=${encodeURIComponent(q)}`;
}

function geoTail(intent: TrustHubSearchIntent): string {
  const loc = intent.location;
  if (loc?.cityName && loc.stateCode) return `${loc.cityName} ${loc.stateCode}`;
  if (loc?.countySlug && loc.stateCode) return `${loc.countySlug.replace(/-/g, ' ')} County ${loc.stateCode}`;
  if (loc?.stateName) return loc.stateName;
  if (loc?.stateCode) return loc.stateCode;
  return '';
}

function clarification(intent: TrustHubSearchIntent, q: string): UniversalSearchModel['clarification'] {
  const geo = geoTail(intent);
  const nearMe = intent.location?.precision === 'near_me' || /\bnear me\b/i.test(q);
  const insuranceAmbiguous =
    intent.hub === 'insurance' ||
    intent.hubCandidates?.[0] === 'insurance' ||
    /\binsurance company\b/i.test(q);

  const choices: ClarificationChoice[] = [];
  if (nearMe) {
    choices.push(
      { label: 'Miami, FL', href: encodeQuery(rewriteNearMe(q, 'Miami FL')) },
      { label: 'Dallas, TX', href: encodeQuery(rewriteNearMe(q, 'Dallas TX')) },
      { label: 'Tampa, FL', href: encodeQuery(rewriteNearMe(q, 'Tampa FL')) }
    );
  }
  if (insuranceAmbiguous && (intent.entityType == null || intent.requiresClarification)) {
    const loc = geo || 'Texas';
    choices.unshift(
      { label: 'Insurance agencies', href: encodeQuery(`insurance agencies ${loc}`) },
      { label: 'Insurance carriers', href: encodeQuery(`insurance carriers ${loc}`) }
    );
  }
  if (!choices.length) return undefined;
  return {
    prompt: insuranceAmbiguous
      ? 'What kind of insurance company are you looking for?'
      : 'Add a city or state — Ask cannot use device location.',
    choices,
  };
}

function rewriteNearMe(q: string, place: string): string {
  return q.replace(/\bnear me\b/gi, place).replace(/\s+/g, ' ').trim();
}

function unsupportedMessage(intent: TrustHubSearchIntent, reason?: string): string {
  if (intent.entityType === 'medicare_agent' || intent.category === 'medicare') {
    return 'Medicare agent search is not part of Ask Universal Search yet. We did not convert this into insurance agencies or carriers.';
  }
  if (intent.entityType === 'loan_officer') {
    return 'Loan officers are not listed in Universal Search. We did not substitute mortgage companies.';
  }
  if (intent.category === 'refinance') {
    return 'Refinance is not a source-backed lender category in this index.';
  }
  if (intent.category === 'electrical' || reason?.includes('contractor_trade')) {
    return 'That contractor trade is not in the current Florida-ready Ask index. We did not widen it to general contractors.';
  }
  if (reason?.includes('contractor_nj')) {
    return 'New Jersey contractor browse is not activated in Universal Search yet.';
  }
  if (intent.entityType === 'home_inspector' || /home inspector/i.test(reason || '')) {
    return 'Home inspectors are not a supported Ask contractor category.';
  }
  if (
    intent.entityType === 'assisted_living' ||
    intent.entityType === 'memory_care' ||
    intent.entityType === 'home_care' ||
    intent.entityType === 'home_health' ||
    reason?.includes('senior_care_type') ||
    reason?.includes('memory_care')
  ) {
    return 'That senior care type is not in the current Ask nursing/SNF index. We did not substitute nursing facilities.';
  }
  if (
    intent.hub === 'investor' &&
    (reason?.includes('funds_not_live') ||
      reason?.includes('investor_product') ||
      intent.category === 'etf' ||
      intent.category === 'mutual_fund')
  ) {
    return 'Investment products are not searchable in Ask Universal Search. We did not substitute investment advisers.';
  }
  return 'This search is not supported in the current Trust Hub discovery index.';
}

export function runUniversalSearch(rawQuery: string): UniversalSearchModel {
  const q = rawQuery.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 300);
  if (!q) {
    return { q: '', status: 'idle', total: 0, topMatches: [] };
  }

  let index;
  try {
    index = getCachedRealIndex();
  } catch {
    return {
      q,
      status: 'error',
      total: 0,
      topMatches: [],
      errorSafe: 'Universal Search is temporarily unavailable. Please try again.',
    };
  }

  try {
    const intent = parseUniversalSearchQuery(q);
    const res: DiscoverySearchResult = index.search(intent);
    const hub = (intent.hub || intent.primaryHub || res.topMatches[0]?.entity.hub) as
      | 'move'
      | 'lender'
      | 'insurance'
      | 'contractor'
      | 'senior'
      | 'investor'
      | undefined;

    if (res.status === 'needs_clarification') {
      return {
        q,
        status: 'needs_clarification',
        hub,
        hubLabel: hub ? hubPublicName(hub) : undefined,
        total: 0,
        topMatches: [],
        clarification: clarification(intent, q),
        message: res.reason,
      };
    }

    if (res.status === 'unsupported' || res.supported === false) {
      return {
        q,
        status: 'unsupported',
        hub,
        hubLabel: hub ? hubPublicName(hub) : undefined,
        total: 0,
        topMatches: [],
        message: unsupportedMessage(intent, res.reason),
      };
    }

    const topMatches: SearchCardModel[] = res.topMatches.map((m) => {
      const handoff = buildEntityHandoff(m.entity, intent);
      const cat = (m.entity.categories || [])[0] || intent.category;
      return {
        id: m.entity.network_entity_id,
        displayName: m.entity.display_name,
        entityLabel: entityLabel(m.entity.entity_type, cat),
        placeLine: placeLine({
          city: m.entity.city,
          county: m.entity.county,
          state: m.entity.state,
        }),
        reasonLine: humanMatchReason(m, intent),
        regulatory: m.entity.regulatory_status_summary,
        hubId: m.entity.hub,
        hubLabel: hubPublicName(m.entity.hub),
        profileUrl: handoff.url,
        researchCta: researchCta(m.entity.hub),
      };
    });

    const vm = resolveViewMoreDestination(intent);
    const viewMore =
      vm.status === 'ok'
        ? { href: vm.handoff.url, label: 'View More Results' }
        : undefined;

    if (topMatches.length === 0) {
      return {
        q,
        status: 'empty',
        hub,
        hubLabel: hub ? hubPublicName(hub) : undefined,
        total: 0,
        topMatches: [],
        viewMore,
        message:
          "We couldn't find a verified match in the current Trust Hub discovery index for this search.",
      };
    }

    return {
      q,
      status: 'ok',
      hub,
      hubLabel: hub ? hubPublicName(hub) : undefined,
      total: res.total,
      topMatches,
      viewMore,
    };
  } catch {
    return {
      q,
      status: 'error',
      total: 0,
      topMatches: [],
      errorSafe: 'Something went wrong running this search. Please try again.',
    };
  }
}
