import manifest from '../../data/network/kansas-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const KS_PUBLICATION_MANIFEST = manifest;
export const KS_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;

export function ksSpecialistUrl(hub: SpecialistHubId): string {
  return `${CANONICAL_ORIGINS[hub]}/kansas`;
}

export function ksReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-ks-network-release-v1' && value.state_code === 'KS' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && KS_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === ksSpecialistUrl(id) &&
        hub.capability_summary === hub.summary && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function ksGeography(query: string): { stateCode: 'KS'; stateName: 'Kansas'; meaning: string } | undefined {
  if (!/\bKansas\b|\bin\s+KS\b/i.test(query)) return undefined;
  const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
    .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'KS') return undefined;
  return {
    stateCode: 'KS',
    stateName: 'Kansas',
    meaning: 'Kansas statewide gateway to six specialist sources. Ask does not run a combined Kansas provider search or publish city or county routes.',
  };
}

export function queryLooksLikeKansas(query: string): boolean {
  return Boolean(ksGeography(query));
}

export function classifyKsHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeKansas(query)) return undefined;
  if (/\b(movers?|moving|household goods|tariff|MCID|USDOT|motor carrier)\b/i.test(query)) return 'move';
  if (/\b(contractor|construction|roofing|elevator|electrician|plumb(?:er|ing)|HVAC)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|NMLS|HMDA|loan originator|mortgage broker|mortgage company|branch)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|producer|adjuster|surplus lines|appointment|NAIC|NPN)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|senior|hospice|home health|adult day|facility|CMS|CCN|KDADS)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|CRD|broker.dealer|ERA|IARD|IAPD)\b/i.test(query)) return 'investor';
  return undefined;
}

export function ksRankingAsked(query: string): boolean {
  return queryLooksLikeKansas(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}

export function ksRefusal(query: string): string | undefined {
  if (!queryLooksLikeKansas(query)) return undefined;
  if (ksRankingAsked(query)) return 'Ask does not rank or recommend Kansas providers. No rating, Trust Score, or provider winner is established. Use Kansas specialist source evidence.';
  if (/\bhow many\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities|firms|people)\b|\b(?:providers|businesses|licenses|hubs|facilities|firms|people)\b.*\btotal\b/i.test(query)) {
    return 'A combined Kansas provider total is undefined. Carrier/tariff rows, licenses, people, facilities, firms, and market observations have different source grains and cannot be added. No result here does not mean that no record exists.';
  }
  return 'Ask does not run a combined Kansas licensing or provider search. Open Kansas specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}

export function ksCaveat(): string {
  return 'Kansas evidence remains in six specialist-owned populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}
