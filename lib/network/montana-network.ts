import manifest from '../../data/network/montana-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';

export const MT_PUBLICATION_MANIFEST = manifest;
export const MT_NETWORK_CONTRACT = 'ask-mt-network-release-v1';
export const MT_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
const EXPECTED_SPECIALIST_URLS: Record<SpecialistHubId, string> = {
  move: 'https://www.movetrusthub.com/montana',
  contractor: 'https://www.contractortrusthub.com/montana',
  lender: 'https://www.lendertrusthub.com/montana',
  insurance: 'https://www.insurancetrusthub.com/montana',
  senior: 'https://www.seniortrusthub.com/montana',
  investor: 'https://www.investortrusthub.com/montana',
};

export function mtSpecialistUrl(hub: SpecialistHubId): string {
  return EXPECTED_SPECIALIST_URLS[hub];
}

export function mtReleaseGatePassed(value = manifest): boolean {
  return value.state === 'Montana' && value.code === 'MT' && value.slug === 'montana' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.ask_canonical === 'https://www.asktrusthub.com/montana' &&
    value.hubs.length === 6 && new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 &&
    MT_HUBS.every((hubId) => {
      const hub = value.hubs.find((entry) => entry.hub_id === hubId);
      return hub?.url === mtSpecialistUrl(hubId) && hub.production_sha.length === 40 &&
        hub.summary.length > 0 && hub.clock.length > 0 && hub.grain.length > 0 && hub.gap.length > 0 &&
        hub.sources.length > 0 && hub.sources.every((source) => source.url.startsWith('https://') && source.label.length > 0);
    }) && value.publication_limits.cross_hub_record_total === null &&
    value.publication_limits.cross_hub_record_total_status === 'REJECTED' &&
    value.publication_limits.ratings === 'NOT_ESTABLISHED' &&
    value.publication_limits.trust_score === 'NOT_ESTABLISHED' &&
    value.publication_limits.county_or_local_routes === 'NONE' &&
    value.publication_limits.claim_eligibility_broadened === false && value.publication_limits.ask_graph_writes === 0;
}

export function mtCaveat(hub: SpecialistHubId): string {
  const entry = manifest.hubs.find((item) => item.hub_id === hub)!;
  return `${entry.summary} ${entry.grain} ${entry.gap}`;
}
