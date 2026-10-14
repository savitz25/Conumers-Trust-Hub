import manifest from '../../data/network/hawaii-publication-manifest.json' with { type: 'json' };
import type { SpecialistHubId } from './registry.ts';

export const HI_PUBLICATION_MANIFEST = manifest;
export const HI_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;

const EXPECTED_SPECIALIST_URLS: Record<SpecialistHubId, string> = {
  move: 'https://www.movetrusthub.com/hawaii',
  contractor: 'https://www.contractortrusthub.com/hawaii',
  lender: 'https://www.lendertrusthub.com/hawaii',
  insurance: 'https://www.insurancetrusthub.com/hawaii',
  senior: 'https://www.seniortrusthub.com/hawaii',
  investor: 'https://www.investortrusthub.com/hawaii',
};

export function hiSpecialistUrl(hub: SpecialistHubId): string {
  return EXPECTED_SPECIALIST_URLS[hub];
}

export function hiReleaseGatePassed(value = manifest): boolean {
  return value.state === 'Hawaii' && value.code === 'HI' && value.slug === 'hawaii' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.ask_canonical === 'https://www.asktrusthub.com/hawaii' &&
    value.hubs.length === 6 && new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 &&
    HI_HUBS.every((hubId) => {
      const hub = value.hubs.find((entry) => entry.hub_id === hubId);
      return hub?.url === hiSpecialistUrl(hubId) && /^[a-f0-9]{40}$/.test(hub.production_sha) &&
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
