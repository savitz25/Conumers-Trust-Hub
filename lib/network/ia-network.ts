import manifest from '../../data/network/iowa-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const IA_PUBLICATION_MANIFEST = manifest;
export const IA_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
export function iaSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/iowa`; }
export function iaReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-ia-network-release-v1' && value.state_code === 'IA' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && IA_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === iaSpecialistUrl(id) && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function iaGeography(query: string): { stateCode: 'IA'; stateName: 'Iowa'; meaning: string } | undefined {
  if (!/\biowa\b|(?:\bin|\bwithin|\bstate of)\s+IA\b|\bIA\s+state\b/i.test(query)) return undefined;
  const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
    .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'IA') return undefined;
  return { stateCode: 'IA', stateName: 'Iowa', meaning: 'Iowa statewide research. Ask publishes no Iowa city or county route.' };
}
export function queryLooksLikeIowa(query: string): boolean { return Boolean(iaGeography(query)); }

export function iaIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeIowa(query)) return undefined;
  const families: Array<[SpecialistHubId, string, RegExp]> = [
    ['move', 'usdot', /\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move', 'mc', /\bmc\s*#?\s*(\d{4,8})\b/i],
    ['contractor', 'iowa_contractor_registration', /\b(?:iowa\s+)?contractor\s+registration\s*#?\s*([a-z]\d{4,8})\b/i],
    ['lender', 'nmls', /\bnmls\s*#?\s*(\d{4,12})\b/i],
    ['insurance', 'naic_company_code', /\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance', 'npn', /\bnpn\s*#?\s*(\d{4,12})\b/i],
    ['senior', 'assisted_living_certification', /\b(?:assisted\s+living\s+)?certification\s*#?\s*(S\d{4,6})\b/i],
    ['senior', 'cms_ccn', /\bccn\s*#?\s*(\d{6})\b/i],
    ['investor', 'crd', /\bcrd\s*#?\s*(\d+)\b/i],
  ];
  for (const [hub, type, pattern] of families) {
    const match = query.match(pattern);
    if (match) return { hub, type, value: match[1], raw: match[0] };
  }
  return undefined;
}

export function classifyIaHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeIowa(query)) return undefined;
  const identifier = iaIdentifier(query);
  if (identifier) return identifier.hub;
  if (/\b(movers?|moving|household goods|motor carrier|usdot|mc\s*#?)\b/i.test(query)) return 'move';
  if (/\b(contractor|construction registration|electrician|plumb(?:er|ing)|mechanical license)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|servicer|mortgage broker)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|naic|npn|producer|adjuster|surplus lines|appointment)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|senior|hospice|home health|residential care|adult day|facility|cms|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|broker.dealer|era|iard)\b/i.test(query)) return 'investor';
  return undefined;
}
export function iaRankingAsked(query: string): boolean {
  return queryLooksLikeIowa(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}
export function iaAmbiguousNumber(query: string): boolean {
  return queryLooksLikeIowa(query) && !iaIdentifier(query) &&
    /^(?:(?:license|credential|registration)\s*#?\s*)?\d+(?:\s+(?:Iowa|IA))?$/i.test(query.trim());
}
export function iaRefusal(query: string): string | undefined {
  if (!queryLooksLikeIowa(query)) return undefined;
  if (iaRankingAsked(query)) return 'Ask does not rank or recommend Iowa providers. No rating, Trust Score, or provider winner is established. Use the Iowa specialist source evidence.';
  if (iaAmbiguousNumber(query)) return 'A bare number is ambiguous. Name its identifier family and use the responsible Iowa specialist source.';
  if (/\bhow many\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities)\b|\b(?:providers|businesses|licenses|hubs|facilities)\b.*\btotal\b/i.test(query)) {
    return 'A combined Iowa provider total is undefined. Different license, registration, person, facility, firm, and market populations cannot be added.';
  }
  return 'Ask does not run a combined Iowa licensing or provider search. Open Iowa specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}
export function iaCaveat(): string {
  return 'Iowa evidence stays in six specialist-owned populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}
