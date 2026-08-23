/**
 * Consumer-facing match reasons. Never upgrade precision.
 */

import type { DiscoveryMatchReason, DiscoverySearchMatch } from '../discovery/types';
import type { TrustHubSearchIntent } from '../types';

function titleCase(s: string): string {
  return s
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function countyLabel(intent: TrustHubSearchIntent, entityCounty?: string): string {
  const slug = intent.location?.countySlug || entityCounty || '';
  const name = titleCase(slug.replace(/-/g, ' '));
  if (!name) return 'this county';
  return /county$/i.test(name) ? name : `${name} County`;
}

function stateLabel(intent: TrustHubSearchIntent, entityState?: string): string {
  return intent.location?.stateName || intent.location?.stateCode || entityState || 'this state';
}

function cityLabel(intent: TrustHubSearchIntent, entityCity?: string): string {
  return intent.location?.cityName || entityCity || 'this city';
}

const GEO_PRIORITY: DiscoveryMatchReason[] = [
  'exact_physical_city',
  'zip_match',
  'exact_physical_county',
  'county_service_area_via_zip_resolution',
  'county_service_area',
  'hmda_activity_county',
  'physical_state',
  'licensed_service_state',
  'hmda_activity_state',
  'state_service_area',
  'nationwide_coverage',
];

export function humanMatchReason(
  match: DiscoverySearchMatch,
  intent: TrustHubSearchIntent
): string | undefined {
  const reasons = match.reasons;
  const geo = GEO_PRIORITY.find((r) => reasons.includes(r));
  const e = match.entity;
  switch (geo) {
    case 'exact_physical_city':
      return `Located in ${cityLabel(intent, e.city)}`;
    case 'zip_match':
      return e.zip ? `Listed at ZIP ${e.zip}` : undefined;
    case 'exact_physical_county':
      return `Located in ${countyLabel(intent, e.county)}`;
    case 'county_service_area_via_zip_resolution':
      return `Covers ${countyLabel(intent, e.county)}`;
    case 'county_service_area':
      return `Covers ${countyLabel(intent, e.county)}`;
    case 'hmda_activity_county':
      return `Mortgage activity reported in ${countyLabel(intent, e.county)}`;
    case 'physical_state':
      return `Located in ${stateLabel(intent, e.state)}`;
    case 'licensed_service_state':
      return `Licensed to operate in ${stateLabel(intent, e.state)}`;
    case 'hmda_activity_state':
      return `Mortgage activity reported in ${stateLabel(intent, e.state)}`;
    case 'state_service_area':
      return `Statewide coverage in ${stateLabel(intent, e.state)}`;
    case 'nationwide_coverage':
      return 'Broad / national coverage';
    default:
      break;
  }
  if (reasons.includes('category_match') && intent.category) {
    return `${intent.category.replace(/_/g, ' ')} match`;
  }
  return undefined;
}

export function assertReasonDoesNotUpgrade(internal: DiscoveryMatchReason, copy: string): boolean {
  const c = copy.toLowerCase();
  if (internal === 'county_service_area' || internal === 'county_service_area_via_zip_resolution') {
    if (/\blocated in\b/.test(c) && !/county/.test(c)) return false;
    if (/serves (your )?zip/.test(c)) return false;
  }
  if (internal === 'hmda_activity_county' || internal === 'hmda_activity_state') {
    if (/\blicensed\b/.test(c)) return false;
  }
  if (internal === 'licensed_service_state') {
    if (/\blocated in\b/.test(c) || /\boffice\b/.test(c)) return false;
  }
  if (internal === 'nationwide_coverage') {
    if (/\blocated in\b/.test(c) || /\bexact\b/.test(c)) return false;
  }
  return true;
}
