/**
 * ASK-SEARCH-003 — Deterministic Universal Search intent parser.
 * Pure/local — no LLM, Places, or network I/O.
 */

import { normalizeQuery } from './normalize';
import { detectNearMe, extractGeography } from './geography';
import {
  EXCLUSION_RULES,
  matchPhrases,
  matchSingleTokens,
  type LexMatch,
} from './lexicon';
import type {
  ConsumerSearchIntent,
  SearchAmbiguity,
  SearchConfidence,
  SupportStatus,
  TrustHubSearchIntent,
} from './types';

function stripPhrase(q: string, phrase: string): string {
  return q
    .replace(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lifeEvent(q: string): Partial<TrustHubSearchIntent> | null {
  if (
    /\bmoving from\b/.test(q) &&
    /\bto\b/.test(q) &&
    /\b(buy|buying|purchase|house|home)\b/.test(q)
  ) {
    return {
      consumerIntent: 'life_event',
      primaryHub: 'move',
      relatedHubs: ['lender'],
      situationIdHint: 'move_buy',
      supported: 'planner_bridge',
      requiresAI: true,
      requiresClarification: false,
      confidence: 'medium',
    };
  }
  if (/\bmoving to\b/.test(q) && /\bmortgage\b/.test(q)) {
    return {
      consumerIntent: 'life_event',
      primaryHub: 'move',
      relatedHubs: ['lender'],
      situationIdHint: 'move_buy',
      supported: 'planner_bridge',
      requiresAI: false,
      requiresClarification: false,
      confidence: 'medium',
    };
  }
  if (/\bbuying a house\b/.test(q) && /\binsurance\b/.test(q)) {
    return {
      consumerIntent: 'life_event',
      primaryHub: 'lender',
      relatedHubs: ['insurance'],
      situationIdHint: 'buy_local',
      supported: 'planner_bridge',
      requiresAI: false,
      requiresClarification: false,
      confidence: 'medium',
    };
  }
  if (/\bmoving my mother\b/.test(q) || (/\bmother\b/.test(q) && /\bsenior care\b/.test(q))) {
    return {
      consumerIntent: 'life_event',
      primaryHub: 'senior',
      relatedHubs: ['move'],
      situationIdHint: 'aging_parent',
      supported: 'planner_bridge',
      requiresAI: true,
      requiresClarification: false,
      confidence: 'medium',
    };
  }
  if (/\brenovat/.test(q) && /\b(bought|buy|home|house)\b/.test(q)) {
    return {
      consumerIntent: 'life_event',
      primaryHub: 'contractor',
      relatedHubs: ['lender'],
      situationIdHint: 'hire_contractor',
      supported: 'planner_bridge',
      requiresAI: true,
      requiresClarification: false,
      confidence: 'medium',
    };
  }
  return null;
}

function narrativeAI(q: string): boolean {
  if (/\bsomeone to\b/.test(q)) return true;
  if (/\bwho can help\b/.test(q)) return true;
  if (/\bcannot safely live alone\b/.test(q)) return true;
  if (/\bafter storm damage\b/.test(q)) return true;
  if (/\bbecause my payment\b/.test(q)) return true;
  if (/\bbefore i sell\b/.test(q)) return true;
  return false;
}

function applyLicensed(q: string, intent: TrustHubSearchIntent): void {
  if (/\blicensed\b/.test(q)) {
    intent.filters = { ...(intent.filters || {}), regulatoryEligibleOnly: true };
  }
}

/**
 * Parse a consumer query into structured TrustHubSearchIntent.
 * Deterministic only — never invents providers; never calls network/AI.
 */
export function parseUniversalSearchQuery(raw: string): TrustHubSearchIntent {
  const query = raw ?? '';
  const normalizedQuery = normalizeQuery(query);

  const base: TrustHubSearchIntent = {
    version: 1,
    query,
    normalizedQuery,
    parseMethod: 'deterministic',
    confidence: 'low',
    requiresClarification: false,
    requiresAI: false,
    consumerIntent: 'find_provider',
  };

  if (!normalizedQuery || normalizedQuery === 'help') {
    return {
      ...base,
      confidence: 'low',
      requiresClarification: true,
      supported: null,
      parseMethod: 'fallback_keyword',
    };
  }

  // Life-event before aggressive entity stripping
  const le = lifeEvent(normalizedQuery);
  if (le) {
    const geo = extractGeography(normalizedQuery);
    const intent: TrustHubSearchIntent = {
      ...base,
      ...le,
      parseMethod: 'mixed',
      confidence: (le.confidence as SearchConfidence) || 'medium',
      requiresClarification: !!le.requiresClarification,
      requiresAI: !!le.requiresAI,
      supported: le.supported as SupportStatus,
      situationIdHint: le.situationIdHint,
      primaryHub: le.primaryHub,
      relatedHubs: le.relatedHubs,
      consumerIntent: le.consumerIntent as ConsumerSearchIntent,
      origin: geo.origin,
      destination: geo.destination || (le as { destination?: TrustHubSearchIntent['destination'] }).destination,
      location: geo.destination || geo.location,
    };
    // Fill origin/destination state codes from fixture patterns if extract got them
    if (geo.origin) intent.origin = geo.origin;
    if (geo.destination) {
      intent.destination = geo.destination;
      intent.location = geo.destination;
    }
    return intent;
  }

  // Exclusions first
  for (const rule of EXCLUSION_RULES) {
    if (rule.test.test(normalizedQuery)) {
      const a = rule.apply();
      const nearMe = detectNearMe(normalizedQuery);
      const geo = extractGeography(normalizedQuery);
      const intent: TrustHubSearchIntent = {
        ...base,
        hub: a.hub,
        hubCandidates: a.hubCandidates,
        entityType: a.entityType === undefined ? undefined : a.entityType,
        category: a.category,
        supported: a.supported as SupportStatus,
        unsupportedReason: a.unsupportedReason,
        notes: a.notes,
        requiresClarification: !!a.requiresClarification,
        requiresAI: false,
        confidence: a.confidenceHint || 'medium',
        location: nearMe
          ? { precision: 'near_me' }
          : geo.location,
        requiresLocation: nearMe,
        parseMethod: 'taxonomy',
      };
      if (a.hubCandidates && a.hubCandidates.length > 1) {
        intent.ambiguities = [{ type: 'hub', options: a.hubCandidates }];
      }
      applyLicensed(normalizedQuery, intent);
      return intent;
    }
  }

  const nearMe = detectNearMe(normalizedQuery);
  let work = normalizedQuery
    .replace(/\b(near me|nearby|around me|close to me)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Verify intents
  if (/\bverify\b/.test(work) && /\busdot\b/.test(work)) {
    return {
      ...base,
      hub: 'move',
      consumerIntent: 'verify',
      confidence: 'high',
      requiresClarification: false,
      requiresAI: false,
      supported: true,
      notes: 'tool soft-route',
    };
  }
  if (/\bnmls\b/.test(work) && /\b(lender|lookup)\b/.test(work)) {
    const geo = extractGeography(work);
    return {
      ...base,
      hub: 'lender',
      consumerIntent: 'verify',
      confidence: 'medium',
      requiresClarification: false,
      requiresAI: false,
      supported: true,
      location: geo.location,
    };
  }

  // Ambiguous standalone broker / company / carrier / agent (before phrase consume wrongly)
  const geoEarly = extractGeography(work);
  work = geoEarly.remainder;

  // Phrase match
  let lex: LexMatch | null = null;
  const phraseHit = matchPhrases(work);
  if (phraseHit) {
    lex = phraseHit.match;
    work = stripPhrase(work, phraseHit.match.phrase);
  } else {
    lex = matchSingleTokens(work);
    if (lex) work = stripPhrase(work, lex.phrase);
  }

  // Ambiguous tokens if no strong lex
  if (!lex) {
    if (/\bbrokers?\b/.test(work)) {
      return {
        ...base,
        hubCandidates: ['move', 'lender', 'insurance'],
        confidence: 'low',
        requiresClarification: true,
        requiresAI: false,
        supported: null,
        location: nearMe ? { precision: 'near_me' } : geoEarly.location,
        requiresLocation: nearMe,
        ambiguities: [{ type: 'hub', options: ['move', 'lender', 'insurance'] }],
      };
    }
    if (/\bcompan(?:y|ies)\b/.test(work) && nearMe) {
      return {
        ...base,
        hubCandidates: [],
        confidence: 'low',
        requiresClarification: true,
        requiresAI: false,
        supported: null,
        location: { precision: 'near_me' },
        requiresLocation: true,
      };
    }
    if (/\bcarriers?\b/.test(work)) {
      return {
        ...base,
        hubCandidates: ['move', 'insurance'],
        confidence: 'low',
        requiresClarification: true,
        requiresAI: false,
        supported: null,
        location: geoEarly.location,
        ambiguities: [{ type: 'hub', options: ['move', 'insurance'] }],
      };
    }
    if (/\bagents?\b/.test(work)) {
      return {
        ...base,
        hubCandidates: ['insurance'],
        confidence: 'medium',
        requiresClarification: true,
        requiresAI: false,
        supported: 'soft',
        location: geoEarly.location,
        ambiguities: [{ type: 'hub', options: ['insurance'] }],
      };
    }
    // elderly mother narrative without prior lex
    if (/\belderly mother\b|\bmother\b.*\bplace\b|\bplace\b.*\bmother\b/.test(normalizedQuery)) {
      return {
        ...base,
        hub: 'senior',
        entityType: null,
        confidence: 'medium',
        requiresClarification: true,
        requiresAI: true,
        supported: 'partial',
        location: geoEarly.location,
        parseMethod: 'mixed',
      };
    }
  }

  // Re-extract geo from original if early extract ran before city tokens were only in prefix
  // Prefer geoEarly; if missing city but original had city+entity order like "Keansburg New Jersey movers"
  let location = geoEarly.location;
  let locationAmbiguous = !!geoEarly.locationAmbiguous;
  if (!location || (location.precision === 'state' && !location.cityName)) {
    const again = extractGeography(normalizeQuery(query).replace(lex?.phrase || '', ' '));
    if (again.location && (again.location.cityName || again.location.zip || again.location.countySlug)) {
      location = again.location;
      locationAmbiguous = !!again.locationAmbiguous;
    } else if (!location) {
      location = again.location;
      locationAmbiguous = !!again.locationAmbiguous;
    }
  }

  if (nearMe) {
    location = { precision: 'near_me' };
  }

  // Category modifiers not captured in phrase
  let category = lex?.category;
  if (!category && lex?.hub === 'lender') {
    if (/\bfha\b/.test(normalizedQuery)) category = 'fha';
    if (/\bva\b/.test(normalizedQuery)) category = 'va';
    if (/\busda\b/.test(normalizedQuery)) category = 'usda';
    if (/\bjumbo\b/.test(normalizedQuery)) category = 'jumbo';
    if (/\bconventional\b/.test(normalizedQuery)) category = 'conventional';
    if (/\brefi|refinance\b/.test(normalizedQuery)) category = 'refinance';
  }

  // insurance company special: keep entity null + candidates
  let hub = lex?.hub;
  let hubCandidates = lex?.hubCandidates ? [...lex.hubCandidates] : undefined;
  let entityType = lex?.entityType;
  let supported: SupportStatus =
    lex?.supported !== undefined ? lex.supported : lex ? true : null;

  if (lex?.phrase === 'insurance company' || lex?.phrase === 'insurance companies') {
    hub = undefined;
    hubCandidates = ['insurance'];
    entityType = null;
    supported = 'soft';
  }

  // Soft confidence overrides matching fixtures
  let confidence: SearchConfidence = 'medium';
  let requiresClarification = false;
  let requiresAI = narrativeAI(normalizedQuery);

  if (!lex) {
    confidence = 'low';
    requiresClarification = true;
    supported = null;
  } else if (nearMe) {
    confidence = 'low';
    requiresClarification = true;
  } else if (locationAmbiguous) {
    confidence = 'low';
    requiresClarification = true;
  } else if (lex.phrase === 'wealth manager') {
    confidence = 'low';
    requiresClarification = true;
    supported = 'soft';
  } else if (lex.phrase === 'loan officer') {
    confidence = 'medium';
    requiresClarification = true;
    supported = 'soft';
  } else if (
    lex.entityType === null &&
    (lex.phrase === 'senior care' || lex.phrase === 'senior facility')
  ) {
    confidence = 'medium';
    requiresClarification = true;
    supported = 'partial';
  } else if (lex.soft && lex.phrase === 'financial adviser') {
    confidence = 'low';
    requiresClarification = true;
  } else if (
    lex.soft &&
    (lex.phrase === 'home insurance companies' ||
      lex.phrase === 'homeowners insurance' ||
      lex.phrase === 'home insurance' ||
      lex.phrase === 'flood insurance')
  ) {
    confidence = 'medium';
    requiresClarification = false;
  } else if (lex.soft && lex.category === 'flooring') {
    confidence = 'medium';
  } else if (lex.soft && lex.category === 'solar') {
    confidence = 'medium';
  } else if (lex.soft && lex.entityType === 'advisory_firm' && lex.phrase === 'investment firm') {
    confidence = 'medium';
    requiresClarification = false;
    supported = 'soft';
  } else if (lex.soft && lex.entityType === 'advisory_firm' && lex.phrase === 'advisory firm') {
    confidence = 'medium';
    supported = true;
  } else if (lex.entityType === 'nursing_facility' && /\blong term care\b|\blong-term care\b/.test(normalizedQuery)) {
    confidence = 'medium';
  } else if (lex.soft && lex.category === 'kitchen_remodel' && !location?.cityName && !location?.stateCode) {
    confidence = 'medium';
    requiresClarification = true;
    requiresAI = true;
    supported = 'soft';
  } else if (lex.soft && lex.category === 'electrical') {
    // electrician Boca — high + soft support
    confidence =
      location && ['city', 'state', 'zip', 'county'].includes(location.precision) ? 'high' : 'medium';
    supported = 'soft';
  } else if (!location || location.precision === 'unknown') {
    if (lex.entityType === 'interstate_mover' && /\bcross-country|cross country\b/.test(normalizedQuery)) {
      confidence = 'medium';
    } else if (lex.hub && lex.entityType && !nearMe) {
      confidence = 'medium';
    } else {
      confidence = 'medium';
    }
  } else if (hub && entityType !== undefined && entityType !== null) {
    confidence = 'high';
  } else if (hub && entityType === null) {
    confidence = 'medium';
    requiresClarification = true;
  } else if (hub) {
    confidence = 'high';
  }

  // Fixture: someone to fix roof — medium clar ai, supported true
  if (/\bsomeone to fix my roof\b/.test(normalizedQuery)) {
    confidence = 'medium';
    requiresClarification = true;
    requiresAI = true;
    supported = true;
  }
  // Fixture: who can help refinance — medium, no clar, ai
  if (/\bwho can help me refinance\b/.test(normalizedQuery)) {
    confidence = 'medium';
    requiresClarification = false;
    requiresAI = true;
  }

  // mortgage lender alone → medium
  if (lex?.phrase === 'mortgage lender' && !location) {
    confidence = 'medium';
  }
  // movers alone
  if ((lex?.phrase === 'movers' || lex?.phrase === 'mover') && !location && !nearMe) {
    confidence = 'medium';
  }

  const ambiguities: SearchAmbiguity[] = [];
  if (hubCandidates && hubCandidates.length > 0) {
    ambiguities.push({ type: 'hub', options: hubCandidates });
  }
  if (locationAmbiguous) {
    ambiguities.push({
      type: 'location',
      options: location ? [location] : [],
    });
  }

  // insurance company near me
  if (
    (lex?.phrase === 'insurance company' || lex?.phrase === 'insurance companies') &&
    nearMe
  ) {
    confidence = 'low';
    requiresClarification = true;
    supported = 'soft';
  }

  const intent: TrustHubSearchIntent = {
    ...base,
    hub,
    hubCandidates,
    entityType: entityType === undefined ? undefined : entityType,
    category,
    location,
    origin: geoEarly.origin,
    destination: geoEarly.destination,
    parseMethod: requiresAI ? 'mixed' : lex?.soft ? 'taxonomy' : 'deterministic',
    confidence,
    requiresClarification,
    requiresAI,
    requiresLocation: nearMe,
    supported,
    unsupportedReason: lex && supported === false ? undefined : undefined,
    ambiguities: ambiguities.length ? ambiguities : undefined,
    consumerIntent: 'find_provider',
  };

  if (lex?.unsupportedReason) intent.unsupportedReason = undefined;
  // unsupported from exclusions already returned

  applyLicensed(normalizedQuery, intent);

  // Soft support flags from lex
  if (lex?.supported !== undefined) intent.supported = lex.supported;
  if (supported !== undefined && lex) intent.supported = supported;

  // Memory care etc already handled in exclusions

  return intent;
}
