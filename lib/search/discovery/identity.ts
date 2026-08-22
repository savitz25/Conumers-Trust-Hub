/**
 * Stable network identity: `{hub}:{sourceEntityId}`
 * Preserves specialist authoritative IDs; no second regulatory identity.
 */

import type { SearchHubId } from '../types';

export function buildNetworkEntityId(hub: SearchHubId, sourceEntityId: string): string {
  const id = sourceEntityId.trim();
  if (!hub || !id) {
    throw new Error('network_entity_id requires hub and sourceEntityId');
  }
  if (id.includes(':')) {
    // Already namespaced — do not double-prefix
    if (id.startsWith(`${hub}:`)) return id;
    throw new Error(`sourceEntityId must not contain colon unless already ${hub}:…`);
  }
  return `${hub}:${id}`;
}

export function parseNetworkEntityId(networkEntityId: string): {
  hub: SearchHubId;
  sourceEntityId: string;
} {
  const i = networkEntityId.indexOf(':');
  if (i <= 0) throw new Error(`Invalid network_entity_id: ${networkEntityId}`);
  const hub = networkEntityId.slice(0, i) as SearchHubId;
  const sourceEntityId = networkEntityId.slice(i + 1);
  if (!sourceEntityId) throw new Error(`Invalid network_entity_id: ${networkEntityId}`);
  return { hub, sourceEntityId };
}

/**
 * Per-Hub source identity conventions (fixture/documentation contract).
 *
 * | Hub | source_entity_id form | Example |
 * |-----|------------------------|---------|
 * | move | usdot-{n} \| move-co-{slug} \| broker-{slug} | usdot-1234567 |
 * | lender | lender-{slug} \| nmls-co-{id} when known | lender-fl-bayshore |
 * | insurance | agency-{slug} \| carrier-{slug} \| medicare-{slug} | agency-in-midwest |
 * | contractor | contractor-{state}-{slug} | contractor-fl-miami-roof |
 * | senior | ccn-{n} (CMS) \| al-pilot-{slug} | ccn-675000 |
 * | investor | crd-{n} (SEC/IARD firm) | crd-104986 |
 */
export const NETWORK_IDENTITY_NOTES = {
  move: 'Prefer USDOT when available; otherwise internal Move company/broker slug. Do not collapse carrier↔broker IDs.',
  lender: 'Company-centric IDs; do not invent NMLS person IDs as network keys unless Hub publishes them.',
  insurance: 'Agency/agent/carrier IDs remain Hub-scoped; Medicare agent records use medicare- prefix in fixtures.',
  contractor: 'Canonical contractor entity slug; state licenses are attributes, not universal network IDs.',
  senior: 'CMS CCN is canonical for nursing facilities. Never use facility name as identity.',
  investor: 'SEC/IARD firm CRD is canonical for RIA/ERA firm fixtures.',
} as const;
