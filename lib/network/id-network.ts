import manifest from '../../data/network/idaho-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const ID_PUBLICATION_MANIFEST = manifest;
export const ID_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;

export function idSpecialistUrl(hub: SpecialistHubId): string {
  return `${CANONICAL_ORIGINS[hub]}/idaho`;
}

export function idReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-id-network-release-v1' && value.state_code === 'ID' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && ID_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === idSpecialistUrl(id) && hub.capability_summary === hub.summary && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function idGeography(query: string): { stateCode: 'ID'; stateName: 'Idaho'; meaning: string } | undefined {
  if (!/\bidaho\b|\bin id\b/i.test(query)) return undefined;
  const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
    .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'ID') return undefined;
  return { stateCode: 'ID', stateName: 'Idaho', meaning: 'Idaho statewide research. Ask publishes no Idaho city or county route.' };
}

export function queryLooksLikeIdaho(query: string): boolean {
  return Boolean(idGeography(query));
}

export function idIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeIdaho(query)) return undefined;
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

export function classifyIdHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeIdaho(query)) return undefined;
  const identifier = idIdentifier(query);
  if (identifier) return identifier.hub;
  if (/\b(movers?|moving|household goods|commodity|commodities)\b/i.test(query)) return 'move';
  if (/\b(contractor|registration|dopl|electrician|plumb(?:er|ing)|hvac)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|servicer|mortgage broker|credit code)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|producer|adjuster|surplus|title|doi|sbs|appointment)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|ralf|certified family|hospice|home health|adult day|senior|facility|cms|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|sec|broker.dealer|era|iapd)\b/i.test(query)) return 'investor';
  return undefined;
}

export function idRankingAsked(query: string): boolean {
  return queryLooksLikeIdaho(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}

export function idAmbiguousNumber(query: string): boolean {
  return queryLooksLikeIdaho(query) && !idIdentifier(query) &&
    /^(?:(?:license|credential|registration)\s*#?\s*)?\d+(?:\s+(?:Idaho|in ID))?$/i.test(query.trim());
}

export function idRefusal(query: string): string | undefined {
  if (!queryLooksLikeIdaho(query)) return undefined;
  if (idRankingAsked(query)) return 'Ask does not rank or recommend Idaho providers. No rating, Trust Score, or provider winner is established. Use Idaho specialist source evidence instead.';
  if (idAmbiguousNumber(query)) return 'A bare number is ambiguous. Name its identifier family and use the responsible Idaho specialist source.';
  if (/\bhow many\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities)\b|\b(?:providers|businesses|licenses|hubs|facilities)\b.*\btotal\b/i.test(query)) {
    return 'A combined Idaho provider total is undefined. Different license, person, facility, and market populations cannot be added.';
  }
  return 'Ask does not run a combined Idaho licensing or provider search. Open Idaho specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}

export function idCaveat(): string {
  return 'Idaho evidence stays in six specialist-owned source populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}

export function idResearchHandoff(plan: AskResearchPlan): { hub: SpecialistHubId; href: string; label: string } | undefined {
  if (plan.requestedGeography?.stateCode !== 'ID' || !plan.primaryHub) return undefined;
  return { hub: plan.primaryHub, href: idSpecialistUrl(plan.primaryHub), label: ID_PUBLICATION_MANIFEST.hubs.find((entry) => entry.hub_id === plan.primaryHub)!.hub_name };
}
