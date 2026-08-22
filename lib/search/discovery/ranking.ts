/**
 * Simple explainable relevance for ASK-SEARCH-005.
 * No paid / premium / popularity / RAUM signals.
 */

import type { TrustHubSearchIntent } from '../types';
import type {
  DiscoveryMatchReason,
  DiscoverySearchMatch,
  NetworkDiscoveryEntity,
} from './types';
import { isPreviewEligible } from './schema';

const PREVIEW_CAP = 7;

export function getTopMatchesPreviewCap(): number {
  return PREVIEW_CAP;
}

function norm(s?: string): string {
  return (s || '').toLowerCase().trim();
}

function cityMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = norm(intent.location?.cityName || intent.location?.citySlug?.replace(/-/g, ' '));
  if (!want) return false;
  if (norm(entity.city) === want || norm(entity.city?.replace(/-/g, ' ')) === want) return true;
  return (entity.service_areas || []).some(
    (a) => a.kind === 'city' && norm(a.city) === want
  );
}

function countyMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = norm(intent.location?.countySlug);
  if (!want) return false;
  if (norm(entity.county) === want) return true;
  return (entity.service_areas || []).some(
    (a) => a.kind === 'county' && norm(a.county) === want
  );
}

function zipMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = intent.location?.zip;
  if (!want) return false;
  if (entity.zip === want) return true;
  return (entity.service_areas || []).some((a) => a.kind === 'zip' && a.zip === want);
}

function stateMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = norm(intent.location?.stateCode || intent.location?.stateSlug);
  if (!want) return false;
  const st = norm(entity.state);
  if (st === want || st === norm(intent.location?.stateCode)) return true;
  if (intent.location?.stateCode && st === intent.location.stateCode.toLowerCase()) return true;
  return (entity.service_areas || []).some((a) => {
    if (a.kind === 'state' && norm(a.state) === want) return true;
    if (a.kind === 'interstate') return true;
    if (a.kind === 'nationwide') return true;
    if ((a.kind === 'city' || a.kind === 'county') && norm(a.state) === want) return true;
    return false;
  });
}

function serviceAreaMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  return cityMatch(entity, intent) || countyMatch(entity, intent) || zipMatch(entity, intent);
}

function nameMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  // Intent has no free-text search blob by design — use entity type token lightly
  const terms = [entity.display_name, entity.legal_name, ...(entity.search_terms || [])]
    .map(norm)
    .filter(Boolean);
  const et = norm(String(intent.entityType || ''));
  if (!et) return false;
  return terms.some((t) => t.includes(et.replace(/_/g, ' ')) || et.includes(t.split(' ')[0]));
}

function searchTermMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const cat = norm(intent.category);
  if (cat && (entity.search_terms || []).some((t) => norm(t).includes(cat.replace(/_/g, ' ')))) {
    return true;
  }
  return false;
}

/** Score a single eligible entity against intent. Returns null if filtered out. */
export function scoreEntity(
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent
): DiscoverySearchMatch | null {
  const status = entity.discovery_status ?? 'active';
  if (status === 'held' || status === 'disabled') return null;
  if (!isPreviewEligible(entity)) return null;

  const hub = intent.hub || intent.primaryHub;
  if (hub && entity.hub !== hub) return null;

  if (intent.entityType && intent.entityType !== 'unknown' && intent.entityType !== null) {
    if (entity.entity_type !== intent.entityType) return null;
  }

  if (intent.category) {
    const cats = (entity.categories || []).map(norm);
    if (!cats.includes(norm(intent.category))) {
      // allow interstate mover without explicit category list
      if (!(intent.entityType === 'interstate_mover' && entity.entity_type === 'interstate_mover')) {
        return null;
      }
    }
  }

  // Geography: if intent has geo, require at least state/service coverage when precision ≥ state
  const loc = intent.location;
  if (loc && loc.precision !== 'near_me' && loc.precision !== 'unknown') {
    const hasGeo =
      zipMatch(entity, intent) ||
      cityMatch(entity, intent) ||
      countyMatch(entity, intent) ||
      stateMatch(entity, intent);
    if (!hasGeo) return null;
  }

  const reasons: DiscoveryMatchReason[] = [];
  let score = 0;

  if (hub && entity.hub === hub) {
    reasons.push('hub_match');
    score += 40;
  }
  if (intent.entityType && entity.entity_type === intent.entityType) {
    reasons.push('entity_match');
    score += 30;
  }
  if (intent.category && (entity.categories || []).map(norm).includes(norm(intent.category))) {
    reasons.push('category_match');
    score += 20;
  }
  if (zipMatch(entity, intent)) {
    reasons.push('zip_match');
    score += 25;
  }
  if (cityMatch(entity, intent)) {
    reasons.push('city_match');
    score += 22;
  }
  if (countyMatch(entity, intent)) {
    reasons.push('county_match');
    score += 18;
  }
  if (stateMatch(entity, intent)) {
    reasons.push('state_match');
    score += 10;
  }
  if (serviceAreaMatch(entity, intent)) {
    if (!reasons.includes('city_match') && !reasons.includes('county_match') && !reasons.includes('zip_match')) {
      reasons.push('service_area_match');
      score += 15;
    } else if (!reasons.includes('service_area_match')) {
      reasons.push('service_area_match');
      score += 5;
    }
  }
  if (nameMatch(entity, intent)) {
    reasons.push('name_match');
    score += 4;
  }
  if (searchTermMatch(entity, intent)) {
    reasons.push('search_term_match');
    score += 3;
  }

  if (reasons.length === 0) return null;

  return { entity, score, reasons };
}

export function rankMatches(matches: DiscoverySearchMatch[]): DiscoverySearchMatch[] {
  return [...matches].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entity.network_entity_id.localeCompare(b.entity.network_entity_id);
  });
}

export function sliceTopMatches(matches: DiscoverySearchMatch[]): DiscoverySearchMatch[] {
  return matches.slice(0, PREVIEW_CAP);
}
