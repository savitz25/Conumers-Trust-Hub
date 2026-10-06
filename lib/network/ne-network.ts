import manifest from '../../data/network/nebraska-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const NE_PUBLICATION_MANIFEST = manifest;
export const NE_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;

export function neSpecialistUrl(hub: SpecialistHubId): string {
  return `${CANONICAL_ORIGINS[hub]}/nebraska`;
}

export function neReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-ne-network-release-v1' && value.state_code === 'NE' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && NE_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === neSpecialistUrl(id) && hub.capability_summary === hub.summary && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function neGeography(query: string): { stateCode: 'NE'; stateName: 'Nebraska'; meaning: string } | undefined {
  if (/\bnevada\b/i.test(query) && !/\bnebraska\b/i.test(query)) return undefined;
  if (!/\bnebraska\b|\bin ne\b/i.test(query)) return undefined;
  const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
    .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'NE') return undefined;
  return { stateCode: 'NE', stateName: 'Nebraska', meaning: 'Nebraska statewide research. Ask publishes no Nebraska city or county route.' };
}

export function queryLooksLikeNebraska(query: string): boolean {
  return Boolean(neGeography(query));
}

export function neIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeNebraska(query)) return undefined;
  const families: Array<[SpecialistHubId, string, RegExp]> = [
    ['move', 'usdot', /\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move', 'mc', /\bmc\s*#?\s*(\d{4,8})\b/i],
    ['move', 'hhg_license', /\bML-\d{2}\b/i],
    ['lender', 'nmls', /\bnmls\s*#?\s*(\d{4,12})\b/i],
    ['insurance', 'naic_company_code', /\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance', 'npn', /\bnpn\s*#?\s*(\d{4,12})\b/i],
    ['senior', 'cms_ccn', /\bccn\s*#?\s*(\d{6})\b/i],
    ['investor', 'crd', /\bcrd\s*#?\s*(\d+)\b/i],
  ];
  for (const [hub, type, pattern] of families) {
    const match = query.match(pattern);
    if (match) return { hub, type, value: match[1] ?? match[0], raw: match[0] };
  }
  return undefined;
}

export function classifyNeHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeNebraska(query)) return undefined;
  const identifier = neIdentifier(query);
  if (identifier) return identifier.hub;
  if (/\b(movers?|moving|household goods|psc|usdot|mc\s*#?)\b/i.test(query)) return 'move';
  if (/\b(contractor|registration|electrician|plumb(?:er|ing))\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|servicer|mortgage broker|mortgage banker)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|naic|npn|producer|adjuster|surplus lines|appointment)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|senior|hospice|home health|adult day|facility|cms|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|broker.dealer|era|iard|iapd)\b/i.test(query)) return 'investor';
  return undefined;
}

export function neRankingAsked(query: string): boolean {
  return queryLooksLikeNebraska(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}

export function neAmbiguousNumber(query: string): boolean {
  return queryLooksLikeNebraska(query) && !neIdentifier(query) &&
    /^(?:(?:license|credential|registration)\s*#?\s*)?\d+(?:\s+(?:Nebraska|in NE))?$/i.test(query.trim());
}

export function neRefusal(query: string): string | undefined {
  if (!queryLooksLikeNebraska(query)) return undefined;
  if (neRankingAsked(query)) return 'Ask does not rank or recommend Nebraska providers. No rating, Trust Score, or provider winner is established. Use the Nebraska specialist source evidence.';
  if (neAmbiguousNumber(query)) return 'A bare number is ambiguous. Name its identifier family and use the responsible Nebraska specialist source.';
  if (/\bhow many\b[\s\S]{0,48}\b(?:contractors?|providers?|senior facilities|facilities)\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities|contractors)\b/i.test(query)) {
    return 'A combined Nebraska provider total is undefined. Contractors, facilities, licenses, people, firms, and market populations cannot be added.';
  }
  return 'Ask does not run a combined Nebraska licensing or provider search. Open Nebraska specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}

export function neCaveat(): string {
  return 'Nebraska evidence stays in six specialist-owned populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}
