import manifest from '../../data/network/arkansas-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const AR_PUBLICATION_MANIFEST = manifest;
export const AR_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
export function arSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/arkansas`; }
export function arReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-ar-network-release-v1' && value.scope === 'STATE_LEVEL_ONLY' &&
    value.release_gate.passed && value.cross_hub_record_total === null && value.graph_writes === 0 &&
    value.hubs.length === 6 && new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 &&
    AR_HUBS.every((id) => value.hubs.some((hub) => hub.hub_id === id && hub.url === arSpecialistUrl(id) && Boolean(hub.production_sha)));
}

const namedStates = US_JURISDICTIONS.map((state) => ({ state, pattern: new RegExp(`\\b${state.name}\\b`, 'i') }));
export function arGeography(query: string): { stateCode: 'AR'; stateName: 'Arkansas'; meaning: string } | undefined {
  if (/\barizona\b/i.test(query) && !/\barkansas\b/i.test(query)) return undefined;
  if (!/\barkansas\b|(?:\bin|\bwithin|\bstate of)\s+AR\b/i.test(query)) return undefined;
  const named = namedStates.map((item) => ({ ...item, at: query.search(item.pattern) })).filter((item) => item.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'AR') return undefined;
  if (!named.length && !/(?:\bin|\bwithin|\bstate of)\s+AR\b/i.test(query)) return undefined;
  return { stateCode: 'AR', stateName: 'Arkansas', meaning: 'Arkansas statewide research. No city or county route; a city mention is geography only.' };
}
export function queryLooksLikeArkansas(query: string): boolean { return Boolean(arGeography(query)); }

export function arIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeArkansas(query)) return undefined;
  const formats: Array<[SpecialistHubId, string, RegExp]> = [
    ['move', 'usdot', /\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move', 'mc', /\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender', 'nmls', /\bnmls\s*#?\s*(\d{4,12})\b/i],
    ['insurance', 'naic_company_code', /\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance', 'npn', /\bnpn\s*#?\s*(\d{4,12})\b/i],
    ['senior', 'cms_ccn', /\bccn\s*#?\s*(\d{6})\b/i],
    ['investor', 'crd', /\bcrd\s*#?\s*(\d+)\b/i],
  ];
  for (const [hub, type, pattern] of formats) { const match = query.match(pattern); if (match) return { hub, type, value: match[1], raw: match[0] }; }
  return undefined;
}
export function classifyArHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeArkansas(query)) return undefined;
  if (/\b(movers?|moving|household goods|ardot|motor carrier|usdot|mc\s*#?)\b/i.test(query)) return 'move';
  if (/\b(contractor|contractors licensing board|commercial license|residential (?:building|builder|roofer|remodeler)|home improvement)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|nmls|hmda|loan originator|loan officer)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|naic|npn|adjuster|surplus lines|captive)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|adult day|senior|hospice|home health|icf|ltc|dhs|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|broker.dealer|era)\b/i.test(query)) return 'investor';
  return undefined;
}
export function arRankingAsked(query: string): boolean { return queryLooksLikeArkansas(query) && /\b(best|safest|recommend(?:ed)?|top.rated|highest.rated|trust score|paid ranking|sponsored ranking)\b|#1\b/i.test(query); }
export function arAmbiguousNumber(query: string): boolean { return queryLooksLikeArkansas(query) && !arIdentifier(query) && /^(?:(?:license|credential)\s*#?\s*)?\d+(?:\s+(?:Arkansas|AR))?$/i.test(query.trim()); }
export function arRefusal(query: string): string | undefined {
  if (arRankingAsked(query)) return 'Ask does not rank or recommend Arkansas providers. No Trust Score or provider winner is established.';
  if (!queryLooksLikeArkansas(query)) return undefined;
  if (arAmbiguousNumber(query)) return 'A bare number is ambiguous. Supply the identifier family and use the specialist source.';
  if (/\bhow many (?:contractors?|providers?|senior facilities)\b|combined.*total|total.*(?:hubs|arkansas providers)|all arkansas (?:businesses|facilities|companies)/i.test(query)) return 'A cross-hub or combined Arkansas record total is undefined. Different license, person, facility and market grains cannot be summed.';
  return undefined;
}
export function arCaveat(hub: SpecialistHubId): string { const item = manifest.hubs.find((entry) => entry.hub_id === hub)!; return `${item.summary} ${item.gap}`; }
export function arResearchHandoff(plan: AskResearchPlan): { hub: SpecialistHubId; href: string; label: string } | undefined {
  if (plan.requestedGeography?.stateCode !== 'AR' || !plan.primaryHub || !plan.executionAllowed ||
      !plan.reasonCodes.some((code) => ['ARKANSAS_RESEARCH_ROUTING', 'EXACT_IDENTIFIER_RECOGNIZED'].includes(code))) return undefined;
  return { hub: plan.primaryHub, href: arSpecialistUrl(plan.primaryHub), label: manifest.hubs.find((entry) => entry.hub_id === plan.primaryHub)!.hub_name };
}
