/**
 * Explicit Ask-side projections. Source JSON snapshots are not rewritten on disk.
 */

import type { NetworkDiscoveryEntity, DiscoveryServiceArea } from '../discovery/types';
import type { SearchHubId, SearchEntityType } from '../types';

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

/** Insurance 001.1 snapshot uses network_id / profile_url / eligible. */
export function projectInsuranceSnapshotEntity(raw: Record<string, unknown>): NetworkDiscoveryEntity | null {
  const network_entity_id = str(raw.network_entity_id) || str(raw.network_id);
  const display_name = str(raw.display_name);
  const profile = str(raw.canonical_profile_url) || str(raw.profile_url);
  const slug = str(raw.slug) || str(raw.source_pk);
  if (!network_entity_id || !display_name || !profile) return null;

  const loc = (raw.physical_location || {}) as Record<string, unknown>;
  const licensed = Array.isArray(raw.licensed_service_states)
    ? (raw.licensed_service_states as unknown[]).map((s) => String(s).toUpperCase()).filter(Boolean)
    : [];
  const service_areas: DiscoveryServiceArea[] = licensed.map((state) => ({
    kind: 'state',
    state,
    // label is Ask-side; not a Hub mutation of the snapshot file
  }));

  const statusRaw = str(raw.discovery_status);
  const discovery_status =
    statusRaw === 'eligible' || statusRaw === 'active' || !statusRaw ? 'active' : 'held';

  return {
    network_entity_id,
    hub: 'insurance',
    source_entity_id: slug || network_entity_id.replace(/^insurance:/, ''),
    entity_type: (str(raw.entity_type) || 'insurance_brokerage') as SearchEntityType,
    display_name,
    city: str(loc.city),
    county: str(loc.county),
    state: str(loc.state) || str(raw.license_state),
    zip: str(loc.postal_code),
    categories: Array.isArray(raw.categories) ? (raw.categories as unknown[]).map(String) : [],
    service_areas,
    canonical_profile_url: profile,
    search_terms: [display_name, slug].filter(Boolean) as string[],
    discovery_status,
    source_version: str(raw.source_version),
  };
}

export function projectStandardEntity(raw: Record<string, unknown>, hub: SearchHubId): NetworkDiscoveryEntity | null {
  if (hub === 'insurance' && !str(raw.canonical_profile_url) && str(raw.profile_url)) {
    return projectInsuranceSnapshotEntity(raw);
  }
  const network_entity_id = str(raw.network_entity_id);
  const display_name = str(raw.display_name);
  const canonical_profile_url = str(raw.canonical_profile_url);
  const source_entity_id = str(raw.source_entity_id);
  if (!network_entity_id || !display_name || !canonical_profile_url || !source_entity_id) return null;
  const hubField = (str(raw.hub) || hub) as SearchHubId;
  return {
    ...(raw as unknown as NetworkDiscoveryEntity),
    network_entity_id,
    hub: hubField,
    source_entity_id,
    entity_type: raw.entity_type as SearchEntityType,
    display_name,
    canonical_profile_url,
  };
}
