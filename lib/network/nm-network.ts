import manifest from '../../data/network/new-mexico-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const NM_PUBLICATION_MANIFEST = manifest;
export const NM_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
export function nmSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/new-mexico`; }
export function nmReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-nm-network-release-v1' && value.state_code === 'NM' &&
    value.scope === 'STATE_LEVEL_ONLY' && value.release_gate.passed &&
    value.cross_hub_record_total === null && value.graph_writes === 0 && value.hubs.length === 6 &&
    new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 && NM_HUBS.every((id) =>
      value.hubs.some((hub) => hub.hub_id === id && hub.url === nmSpecialistUrl(id) && hub.capability_summary === hub.summary && /^[a-f0-9]{40}$/i.test(hub.production_sha)),
    );
}

export function nmGeography(query: string): { stateCode: 'NM'; stateName: 'New Mexico'; meaning: string } | undefined {
  if (/\bnew mexico\b/i.test(query) || /\bin nm\b/i.test(query)) {
    const named = US_JURISDICTIONS.map((state) => ({ state, at: query.search(new RegExp(`\\b${state.name}\\b`, 'i')) }))
      .filter((row) => row.at >= 0).sort((a, b) => a.at - b.at);
    if (named.length && named[0].state.code !== 'NM') return undefined;
    return { stateCode: 'NM', stateName: 'New Mexico', meaning: 'New Mexico statewide research. Ask publishes no New Mexico city or county route.' };
  }
  return undefined;
}
export function queryLooksLikeNewMexico(query: string): boolean { return Boolean(nmGeography(query)); }

export function nmIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeNewMexico(query)) return undefined;
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

export function classifyNmHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeNewMexico(query)) return undefined;
  const identifier = nmIdentifier(query);
  if (identifier) return identifier.hub;
  if (/\b(movers?|moving|household goods|prc|motor carrier|usdot|mc\s*#?)\b/i.test(query)) return 'move';
  if (/\b(contractor|construction industries|qualifying party|journeyman|electrician|plumber)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|servicer|mortgage broker)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|title|underwriter|osi|naic|npn|producer|adjuster|surplus lines)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|senior|hospice|home health|health care authority|facility|cms|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|sec|broker.dealer|era|iapd)\b/i.test(query)) return 'investor';
  return undefined;
}
export function nmRankingAsked(query: string): boolean {
  return queryLooksLikeNewMexico(query) && /\b(best|safest|recommend(?:ed)?|top[-\s]?rated|highest[-\s]?rated|trust score|number one|most trusted|paid ranking|sponsored ranking)\b|#1\b/i.test(query);
}
export function nmAmbiguousNumber(query: string): boolean {
  return queryLooksLikeNewMexico(query) && !/\b(?:usdot|dot|mc|nmls|naic|npn|ccn|crd)\s*#?\s*\d+\b/i.test(query) &&
    /^(?:(?:license|credential)\s*#?\s*)?\d+(?:\s+(?:New Mexico|in NM))?$/i.test(query.trim());
}
export function nmRefusal(query: string): string | undefined {
  if (!queryLooksLikeNewMexico(query)) return undefined;
  if (nmRankingAsked(query)) return 'Ask does not rank or recommend New Mexico providers. No rating, Trust Score, or provider winner is established. Use New Mexico specialist source evidence instead.';
  if (nmAmbiguousNumber(query)) return 'A bare number is ambiguous. Name its identifier family (for example, USDOT, NMLS, NPN, CCN, or CRD) and use the responsible New Mexico specialist source.';
  if (/\bhow many\b|\bcombined\b|\btotal\b.*\b(?:providers|businesses|licenses|hubs|facilities)\b|\b(?:providers|businesses|licenses|hubs|facilities)\b.*\btotal\b/i.test(query)) {
    return 'A combined New Mexico provider total is undefined. Different license, person, facility, and market populations cannot be added.';
  }
  return 'Ask does not run a combined New Mexico licensing or provider search. Open New Mexico specialist research to choose the source that owns the record. No result here does not mean that no record exists.';
}
export function nmCaveat(): string {
  return 'New Mexico evidence stays in six specialist-owned source populations. Ask publishes no combined total, cross-hub identity merge, graph write, rating, or local route.';
}
export function nmResearchHandoff(plan: AskResearchPlan): { hub: SpecialistHubId; href: string; label: string } | undefined {
  if (plan.requestedGeography?.stateCode !== 'NM' || !plan.primaryHub) return undefined;
  return { hub: plan.primaryHub, href: nmSpecialistUrl(plan.primaryHub), label: NM_PUBLICATION_MANIFEST.hubs.find((entry) => entry.hub_id === plan.primaryHub)!.hub_name };
}
