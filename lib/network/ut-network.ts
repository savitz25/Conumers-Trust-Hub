import manifest from '../../data/network/utah-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const UT_PUBLICATION_MANIFEST = manifest;
export const UT_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
export function utSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/utah`; }
export function utReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-ut-network-release-v1' && value.state_code === 'UT' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && UT_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === utSpecialistUrl(id) && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function utGeography(query: string): { stateCode: 'UT'; stateName: 'Utah'; meaning: string } | undefined {
  if (/\butah\b/i.test(query) || /(?:\bin|\bwithin|\bstate of)\s+UT\b/i.test(query) || /\bUT\s+state\b/i.test(query)) {
    const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
      .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
    if (named.length && named[0].state.code !== 'UT') return undefined;
    return { stateCode: 'UT', stateName: 'Utah', meaning: 'Utah statewide research. Ask publishes no Utah city or county route.' };
  }
  return undefined;
}
export function queryLooksLikeUtah(query: string): boolean { return Boolean(utGeography(query)); }

export function utIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeUtah(query)) return undefined;
  const families: Array<[SpecialistHubId, string, RegExp]> = [
    ['move', 'usdot', /\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move', 'mc', /\bmc\s*#?\s*(\d{4,8})\b/i],
    ['contractor', 'dopl_license', /\bdopl\s*(?:license\s*)?#?\s*([a-z0-9-]{3,20})\b/i],
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

export function classifyUtHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeUtah(query)) return undefined;
  const identifier = utIdentifier(query);
  if (identifier) return identifier.hub;
  if (/\b(movers?|moving|household goods|motor carrier|usdot|mc\s*#?)\b/i.test(query)) return 'move';
  if (/\b(contractor|dopl|electrician|plumber|construction license|construction business registry)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|servicer|mortgage broker)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|naic|npn|producer|adjuster|surplus lines|appointment)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|senior|hospice|home health|personal care|facility|cms|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|sec|broker.dealer|era|iard)\b/i.test(query)) return 'investor';
  return undefined;
}
export function utRankingAsked(query: string): boolean {
  return queryLooksLikeUtah(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}
export function utAmbiguousNumber(query: string): boolean {
  return queryLooksLikeUtah(query) && !/\b(?:usdot|dot|mc|nmls|naic|npn|ccn|crd|dopl)\s*#?\s*\d+\b/i.test(query) &&
    /^(?:(?:license|credential)\s*#?\s*)?\d+(?:\s+(?:Utah|UT))?$/i.test(query.trim());
}
export function utRefusal(query: string): string | undefined {
  if (!queryLooksLikeUtah(query)) return undefined;
  if (utRankingAsked(query)) return 'Ask does not rank or recommend Utah providers. No rating, Trust Score, or provider winner is established. Use Utah specialist source evidence instead.';
  if (utAmbiguousNumber(query)) return 'A bare number is ambiguous. Name its identifier family (for example, USDOT, NMLS, NPN, CCN, or CRD) and use the responsible Utah specialist source.';
  if (/\bhow many\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities)\b|\b(?:providers|businesses|licenses|hubs|facilities)\b.*\btotal\b/i.test(query)) {
    return 'A combined Utah provider total is undefined. Different license, person, facility, and market populations cannot be added.';
  }
  return 'Ask does not run a combined Utah licensing or provider search. Open Utah specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}
export function utCaveat(): string {
  return 'Utah evidence stays in six specialist-owned source populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}
export function utResearchHandoff(plan: AskResearchPlan): { hub: SpecialistHubId; href: string; label: string } | undefined {
  if (plan.requestedGeography?.stateCode !== 'UT' || !plan.primaryHub) return undefined;
  return { hub: plan.primaryHub, href: utSpecialistUrl(plan.primaryHub), label: UT_PUBLICATION_MANIFEST.hubs.find((entry) => entry.hub_id === plan.primaryHub)!.hub_name };
}
