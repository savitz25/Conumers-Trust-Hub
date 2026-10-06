import manifest from '../../data/network/west-virginia-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const WV_PUBLICATION_MANIFEST = manifest;
export const WV_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;

export function wvSpecialistUrl(hub: SpecialistHubId): string {
  return `${CANONICAL_ORIGINS[hub]}/west-virginia`;
}

export function wvReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-wv-network-release-v1' && value.state_code === 'WV' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && WV_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === wvSpecialistUrl(id) && hub.capability_summary === hub.summary && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function wvGeography(query: string): { stateCode: 'WV'; stateName: 'West Virginia'; meaning: string } | undefined {
  if (/\bvirginia\b/i.test(query) && !/\bwest virginia\b/i.test(query)) return undefined;
  if (!/\bwest virginia\b|\bin wv\b/i.test(query)) return undefined;
  const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
    .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'WV') return undefined;
  return { stateCode: 'WV', stateName: 'West Virginia', meaning: 'West Virginia statewide research. Ask publishes no West Virginia city or county route.' };
}

export function queryLooksLikeWestVirginia(query: string): boolean {
  return Boolean(wvGeography(query));
}

export function wvIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeWestVirginia(query)) return undefined;
  const families: Array<[SpecialistHubId, string, RegExp]> = [
    ['move', 'usdot', /\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move', 'mc', /\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender', 'nmls', /\bnmls\s*#?\s*(\d{4,12})\b/i],
    ['insurance', 'naic_company_code', /\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance', 'npn', /\bnpn\s*#?\s*(\d{4,12})\b/i],
    ['senior', 'cms_ccn', /\bccn\s*#?\s*(\d{6})\b/i],
    ['investor', 'crd', /\bcrd\s*#?\s*(\d+)\b/i],
  ];
  for (const [hub, type, pattern] of families) {
    const match = query.match(pattern);
    if (match) return { hub, type, value: match[1], raw: match[0] };
  }
  return undefined;
}

export function classifyWvHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeWestVirginia(query)) return undefined;
  const identifier = wvIdentifier(query);
  if (identifier) return identifier.hub;
  if (/\b(movers?|moving|household goods|certificate|tariff|motor carrier)\b/i.test(query)) return 'move';
  if (/\b(contractor|elevator|hvac|plumb(?:er|ing)|manufactured housing)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|servicer|mortgage broker)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|producer|adjuster|surplus|appointment)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|home health|hospice|adult day|icf|residential care|senior|facility|ohflac)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|broker.dealer|era|iapd|notice filing)\b/i.test(query)) return 'investor';
  return undefined;
}

export function wvRankingAsked(query: string): boolean {
  return queryLooksLikeWestVirginia(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}

export function wvAmbiguousNumber(query: string): boolean {
  return queryLooksLikeWestVirginia(query) && !wvIdentifier(query) &&
    /^(?:(?:license|credential|registration)\s*#?\s*)?\d+(?:\s+(?:West Virginia|in WV))?$/i.test(query.trim());
}

export function wvRefusal(query: string): string | undefined {
  if (!queryLooksLikeWestVirginia(query)) return undefined;
  if (wvRankingAsked(query)) return 'Ask does not rank or recommend West Virginia providers. No rating, Trust Score, or provider winner is established. Use West Virginia specialist source evidence instead.';
  if (wvAmbiguousNumber(query)) return 'A bare number is ambiguous. Name its identifier family and use the responsible West Virginia specialist source.';
  if (/\bhow many\b[\s\S]{0,48}\b(?:contractors?|providers?|senior facilities|facilities)\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities|contractors)\b/i.test(query)) {
    return 'A combined West Virginia provider total is undefined. Contractors, facilities, licenses, people, firms, and market populations cannot be added.';
  }
  return 'Ask does not run a combined West Virginia licensing or provider search. Open West Virginia specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}

export function wvCaveat(): string {
  return 'West Virginia evidence stays in six specialist-owned source populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}

export function wvResearchHandoff(plan: AskResearchPlan): { hub: SpecialistHubId; href: string; label: string } | undefined {
  if (plan.requestedGeography?.stateCode !== 'WV' || !plan.primaryHub) return undefined;
  return { hub: plan.primaryHub, href: wvSpecialistUrl(plan.primaryHub), label: WV_PUBLICATION_MANIFEST.hubs.find((entry) => entry.hub_id === plan.primaryHub)!.hub_name };
}
