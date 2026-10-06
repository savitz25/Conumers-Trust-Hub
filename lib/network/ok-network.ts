import manifest from '../../data/network/oklahoma-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const OK_PUBLICATION_MANIFEST = manifest;
export const OK_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
export function okSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/oklahoma`; }
export function okReleaseGatePassed(value = manifest): boolean {
  return value.contract === 'ath-ok-network-release-v1' && value.scope === 'STATE_LEVEL_ONLY' &&
    value.release_gate.passed && value.cross_hub_record_total === null && value.graph_writes === 0 &&
    value.hubs.length === 6 && new Set(value.hubs.map((hub) => hub.hub_id)).size === 6 &&
    OK_HUBS.every((id) => value.hubs.some((hub) => hub.hub_id === id && hub.url === okSpecialistUrl(id) && Boolean(hub.production_sha)));
}

const namedStates = US_JURISDICTIONS.map((state) => ({ state, pattern: new RegExp(`\\b${state.name}\\b`, 'i') }));
export function okGeography(query: string): { stateCode: 'OK'; stateName: 'Oklahoma'; meaning: string } | undefined {
  const named = namedStates.map((item) => ({ ...item, at: query.search(item.pattern) })).filter((item) => item.at >= 0).sort((a, b) => a.at - b.at);
  if (named.length && named[0].state.code !== 'OK') return undefined;
  if (!named.length && !/(?:\bin|\bwithin|\bstate of)\s+OK\b/i.test(query)) return undefined;
  return { stateCode: 'OK', stateName: 'Oklahoma', meaning: 'Oklahoma statewide research. No city or county route; a city mention is geography only.' };
}
export function queryLooksLikeOklahoma(query: string): boolean { return Boolean(okGeography(query)); }

export function okIdentifier(query: string): { hub: SpecialistHubId; type: string; value: string; raw: string } | undefined {
  if (!queryLooksLikeOklahoma(query)) return undefined;
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
export function classifyOkHub(query: string): SpecialistHubId | undefined {
  if (!queryLooksLikeOklahoma(query)) return undefined;
  if (/\b(movers?|moving|household goods|corporation commission|usdot|mc\s*#?)\b/i.test(query)) return 'move';
  if (/\b(contractor|construction industries|electric(?:al)?|plumb|mechanical|journeyman|apprentice)\b/i.test(query)) return 'contractor';
  if (/\b(mortgage|lender|servicer|nmls|hmda|consumer credit|supervised lender|loan originator)\b/i.test(query)) return 'lender';
  if (/\b(insurance|insurer|oid|naic|npn|adjuster|surplus lines)\b/i.test(query)) return 'insurance';
  if (/\b(nursing|assisted living|residential care|adult day|home health|hospice|senior|osdh|ccn)\b/i.test(query)) return 'senior';
  if (/\b(investment|advis[eo]r|securities|crd|broker.dealer|era)\b/i.test(query)) return 'investor';
  return undefined;
}
export function okRankingAsked(query: string): boolean { return queryLooksLikeOklahoma(query) && /\b(best|safest|recommend(?:ed)?|top.rated|highest.rated|trust score|paid ranking|sponsored ranking)\b|#1\b/i.test(query); }
export function okAmbiguousNumber(query: string): boolean { return queryLooksLikeOklahoma(query) && !okIdentifier(query) && /^(?:(?:license|credential)\s*#?\s*)?\d+(?:\s+(?:Oklahoma|OK))?$/i.test(query.trim()); }
export function okRefusal(query: string): string | undefined {
  if (okRankingAsked(query)) return 'Ask does not rank or recommend Oklahoma providers. No Trust Score or provider winner is established.';
  if (!queryLooksLikeOklahoma(query)) return undefined;
  if (okAmbiguousNumber(query)) return 'A bare number is ambiguous. Supply the identifier family and use the specialist source.';
  if (/combined.*total|total.*(?:hubs|oklahoma providers)|how many providers|all oklahoma (?:businesses|facilities|companies)/i.test(query)) return 'A cross-hub Oklahoma record total is undefined. Different license, person, facility and market grains cannot be summed.';
  return undefined;
}
export function okCaveat(hub: SpecialistHubId): string { const item = manifest.hubs.find((entry) => entry.hub_id === hub)!; return `${item.summary} ${item.gap}`; }
export function okResearchHandoff(plan: AskResearchPlan): { hub: SpecialistHubId; href: string; label: string } | undefined {
  if (plan.requestedGeography?.stateCode !== 'OK' || !plan.primaryHub || !plan.executionAllowed ||
      !plan.reasonCodes.some((code) => ['OKLAHOMA_RESEARCH_ROUTING', 'EXACT_IDENTIFIER_RECOGNIZED'].includes(code))) return undefined;
  return { hub: plan.primaryHub, href: okSpecialistUrl(plan.primaryHub), label: manifest.hubs.find((entry) => entry.hub_id === plan.primaryHub)!.hub_name };
}
