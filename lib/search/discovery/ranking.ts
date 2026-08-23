/**
 * Deterministic relevance for Universal Search.
 * No paid / premium / popularity / ratings / RAUM / Trust Score signals.
 *
 * Tie-break: score desc → display_name → network_entity_id.
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

function countyKey(s?: string): string {
  return norm(s)
    .replace(/\bcounty\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function cityKey(s?: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, '');
}

function wantCity(intent: TrustHubSearchIntent): string {
  return cityKey(intent.location?.cityName || intent.location?.citySlug);
}

function wantCounty(intent: TrustHubSearchIntent): string {
  return countyKey(intent.location?.countySlug);
}

function wantState(intent: TrustHubSearchIntent): string {
  return norm(intent.location?.stateCode || intent.location?.stateSlug);
}

function physicalCity(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantCity(intent);
  if (!want) return false;
  return cityKey(entity.city) === want;
}

function physicalCounty(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantCounty(intent);
  if (!want) return false;
  return countyKey(entity.county) === want;
}

function physicalZip(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = intent.location?.zip;
  if (!want) return false;
  return entity.zip === want;
}

function physicalState(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantState(intent);
  if (!want) return false;
  const st = norm(entity.state);
  return st === want || st === norm(intent.location?.stateCode);
}

function countyService(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantCounty(intent);
  if (!want) return false;
  return (entity.service_areas || []).some(
    (a) => a.kind === 'county' && countyKey(a.county) === want && (!wantState(intent) || norm(a.state) === wantState(intent))
  );
}

function cityService(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantCity(intent);
  if (!want) return false;
  return (entity.service_areas || []).some((a) => a.kind === 'city' && cityKey(a.city) === want);
}

function zipService(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = intent.location?.zip;
  if (!want) return false;
  return (entity.service_areas || []).some((a) => a.kind === 'zip' && a.zip === want);
}

function stateService(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantState(intent);
  if (!want) return false;
  return (entity.service_areas || []).some((a) => a.kind === 'state' && norm(a.state) === want);
}

function countyInRequestedState(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantState(intent);
  if (!want) return false;
  return (entity.service_areas || []).some((a) => a.kind === 'county' && norm(a.state) === want);
}

function nationwide(entity: NetworkDiscoveryEntity): boolean {
  return (entity.service_areas || []).some((a) => a.kind === 'nationwide' || a.kind === 'interstate');
}

function hmdaState(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantState(intent);
  if (!want) return false;
  return (entity.service_areas || []).some(
    (a) =>
      a.kind === 'state' &&
      norm(a.state) === want &&
      'label' in a &&
      String((a as { label?: string }).label || '').includes('hmda')
  );
}

function hmdaCounty(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  const want = wantCounty(intent);
  if (!want) return false;
  return (entity.service_areas || []).some(
    (a) =>
      a.kind === 'county' &&
      countyKey(a.county) === want &&
      'label' in a &&
      String((a as { label?: string }).label || '').includes('hmda')
  );
}

/** Legacy names used by ASK-SEARCH-005 fixtures. */
function cityMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  return physicalCity(entity, intent) || cityService(entity, intent);
}

function countyMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  return physicalCounty(entity, intent) || countyService(entity, intent);
}

function zipMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  return physicalZip(entity, intent) || zipService(entity, intent);
}

function stateMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  return physicalState(entity, intent) || stateService(entity, intent);
}

function serviceAreaMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
  return cityService(entity, intent) || countyService(entity, intent) || zipService(entity, intent);
}

function agencyLike(
  intentType: string | null | undefined,
  entityType: string
): boolean {
  const a = new Set(['insurance_agency', 'insurance_brokerage', 'insurance_agent']);
  if (!intentType || intentType === 'unknown') return false;
  if (intentType === entityType) return true;
  return a.has(intentType) && a.has(entityType);
}

function nameMatch(entity: NetworkDiscoveryEntity, intent: TrustHubSearchIntent): boolean {
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

export function scoreEntity(
  entity: NetworkDiscoveryEntity,
  intent: TrustHubSearchIntent
): DiscoverySearchMatch | null {
  const status = entity.discovery_status ?? 'active';
  if (status === 'held' || status === 'disabled') return null;
  if (!isPreviewEligible(entity)) return null;

  const hub = intent.hub || intent.primaryHub;
  if (hub && entity.hub !== hub) return null;

  const moverFamily = new Set(['mover', 'interstate_mover', 'intrastate_mover']);
  if (intent.entityType && intent.entityType !== 'unknown' && intent.entityType !== null) {
    const moverOk = intent.entityType === 'mover' && moverFamily.has(entity.entity_type);
    if (
      entity.entity_type !== intent.entityType &&
      !agencyLike(intent.entityType, entity.entity_type) &&
      !moverOk
    ) {
      return null;
    }
    if (intent.entityType === 'insurance_carrier' && entity.entity_type !== 'insurance_carrier') {
      return null;
    }
    if (
      (intent.entityType === 'insurance_agency' ||
        intent.entityType === 'insurance_brokerage' ||
        intent.entityType === 'insurance_agent') &&
      entity.entity_type === 'insurance_carrier'
    ) {
      return null;
    }
  }

  if (intent.category) {
    const cats = (entity.categories || []).map(norm);
    if (!cats.includes(norm(intent.category))) {
      if (!(intent.entityType === 'interstate_mover' && entity.entity_type === 'interstate_mover')) {
        return null;
      }
    }
  }

  const loc = intent.location;
  if (loc && loc.precision !== 'near_me' && loc.precision !== 'unknown') {
    const localGeo =
      zipMatch(entity, intent) || cityMatch(entity, intent) || countyMatch(entity, intent);
    const stateGeo = stateMatch(entity, intent) || countyInRequestedState(entity, intent);
    const cityOrZip = loc.precision === 'city' || loc.precision === 'zip';
    const hasGeo = cityOrZip ? localGeo : localGeo || stateGeo || nationwide(entity);
    if (!hasGeo) return null;
  }

  const reasons: DiscoveryMatchReason[] = [];
  let score = 0;

  if (hub && entity.hub === hub) {
    reasons.push('hub_match');
    score += 40;
  }
  if (
    intent.entityType &&
    (entity.entity_type === intent.entityType ||
      agencyLike(intent.entityType, entity.entity_type) ||
      (intent.entityType === 'mover' && moverFamily.has(entity.entity_type)))
  ) {
    reasons.push('entity_match');
    score += 30;
  }
  if (intent.category && (entity.categories || []).map(norm).includes(norm(intent.category))) {
    reasons.push('category_match');
    score += 20;
  }

  if (physicalZip(entity, intent)) {
    reasons.push('zip_match');
    score += 28;
  }
  if (physicalCity(entity, intent)) {
    reasons.push('city_match');
    reasons.push('exact_physical_city');
    score += 26;
  } else if (cityService(entity, intent)) {
    reasons.push('city_match');
    score += 14;
  }
  if (physicalCounty(entity, intent)) {
    reasons.push('county_match');
    reasons.push('exact_physical_county');
    score += 20;
  } else if (countyService(entity, intent)) {
    reasons.push('county_match');
    reasons.push('county_service_area');
    score += 16;
    if (intent.location?.zip && !physicalZip(entity, intent) && !zipService(entity, intent)) {
      reasons.push('county_service_area_via_zip_resolution');
    }
  }
  if (hmdaCounty(entity, intent)) {
    reasons.push('hmda_activity_county');
    score += 12;
  }
  if (countyInRequestedState(entity, intent) && !wantCounty(intent)) {
    reasons.push('state_service_area');
    score += 12;
  }
  if (physicalState(entity, intent)) {
    reasons.push('state_match');
    reasons.push('physical_state');
    score += 10;
  } else if (stateService(entity, intent)) {
    reasons.push('state_match');
    if (hmdaState(entity, intent)) {
      reasons.push('hmda_activity_state');
      score += 5;
    } else {
      reasons.push(entity.hub === 'insurance' ? 'licensed_service_state' : 'state_service_area');
      score += 6;
    }
  }
  if (serviceAreaMatch(entity, intent) && !reasons.includes('city_match') && !reasons.includes('county_match')) {
    reasons.push('service_area_match');
    score += 8;
  } else if (serviceAreaMatch(entity, intent) && !reasons.includes('service_area_match')) {
    reasons.push('service_area_match');
    score += 3;
  }
  if (
    nationwide(entity) &&
    !physicalCity(entity, intent) &&
    !physicalCounty(entity, intent) &&
    !countyService(entity, intent) &&
    !countyInRequestedState(entity, intent) &&
    !physicalState(entity, intent) &&
    !stateService(entity, intent)
  ) {
    reasons.push('nationwide_coverage');
    score += 2;
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
  return { entity, score, reasons: [...new Set(reasons)] };
}

export function rankMatches(matches: DiscoverySearchMatch[]): DiscoverySearchMatch[] {
  return [...matches].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byName = a.entity.display_name.localeCompare(b.entity.display_name);
    if (byName !== 0) return byName;
    return a.entity.network_entity_id.localeCompare(b.entity.network_entity_id);
  });
}

export function sliceTopMatches(matches: DiscoverySearchMatch[]): DiscoverySearchMatch[] {
  return matches.slice(0, PREVIEW_CAP);
}
