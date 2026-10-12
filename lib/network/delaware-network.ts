import manifest from '../../data/network/delaware-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';

export const DE_PUBLICATION_MANIFEST = manifest;
export const DE_NETWORK_CONTRACT = 'ask-de-network-release-v1';
export const DE_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;

const EXPECTED_SPECIALIST_URLS: Record<SpecialistHubId, string> = {
  move: 'https://www.movetrusthub.com/moving-to/delaware',
  contractor: 'https://www.contractortrusthub.com/delaware',
  lender: 'https://www.lendertrusthub.com/delaware',
  insurance: 'https://www.insurancetrusthub.com/delaware',
  senior: 'https://www.seniortrusthub.com/delaware',
  investor: 'https://www.investortrusthub.com/delaware',
};

export function deSpecialistUrl(hub: SpecialistHubId): string {
  return EXPECTED_SPECIALIST_URLS[hub];
}

export function deReleaseGatePassed(value = manifest): boolean {
  return value.state === 'Delaware' && value.code === 'DE' && value.slug === 'delaware' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.ask_canonical === 'https://www.asktrusthub.com/delaware' &&
    value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 &&
    DE_HUBS.every((hubId) => {
      const hub = value.hubs.find((entry) => entry.hub_id === hubId);
      return hub?.url === deSpecialistUrl(hubId) && hub.production_sha.length === 40 &&
        hub.summary.length > 0 && hub.clock.length > 0 && hub.grain.length > 0 && hub.gap.length > 0 &&
        hub.sources.length > 0 && hub.sources.every((source) => source.url.startsWith('https://') && source.label.length > 0);
    }) && value.publication_limits.cross_hub_record_total === null &&
    value.publication_limits.cross_hub_record_total_status === 'REJECTED' &&
    value.publication_limits.ratings === 'NOT_ESTABLISHED' &&
    value.publication_limits.trust_score === 'NOT_ESTABLISHED' &&
    value.publication_limits.county_or_local_routes === 'NONE' &&
    value.publication_limits.claim_eligibility_broadened === false &&
    value.publication_limits.ask_graph_writes === 0;
}

export function deCaveat(hub: SpecialistHubId): string {
  const entry = manifest.hubs.find((item) => item.hub_id === hub)!;
  return `${entry.summary} ${entry.grain} ${entry.gap}`;
}
