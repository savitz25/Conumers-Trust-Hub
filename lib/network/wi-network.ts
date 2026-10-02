import { createHash } from 'node:crypto';
import manifest from '../../data/network/wisconsin-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const WI_PUBLICATION_MANIFEST = manifest;
export const WI_NETWORK_CONTRACT = 'ath-wi-network-release-v1';
export const WI_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId, string> = {
  move: '4ea562022b22f3041856b33790df5a768f6b765e',
  contractor: 'bcf259ae737e032c761c2c68e2e647cc1c0d6981',
  lender: 'da676f739f72e345940c13619e48ff66214424f0',
  insurance: 'd86bc5e0972ab72a5b308e698564157141b0a367',
  senior: '4fab19fd55f34433cf5bd6ecc231b431eb441c15',
  investor: '90e4edcd63bede842493c5e95a241af87b10c544',
};
export function wiSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/wisconsin`; }
export type WiSeniorStateClass = 'adult_family_home'|'cbrf'|'rcac'|'nursing_home'|'hospice'|'home_health'|'ccn';
export function wiSeniorStateResearch(plan: AskResearchPlan): {classId: WiSeniorStateClass; label: string; href: string} | undefined {
  if (plan.primaryHub !== 'senior' || plan.requestedGeography?.stateCode !== 'WI' || !plan.executionAllowed) return undefined;
  const q = plan.originalQuestion;
  const classes: Array<[WiSeniorStateClass, string, RegExp]> = [
    ['adult_family_home', 'Adult Family Home', /\badult family homes?\b/i],
    ['cbrf', 'Community-Based Residential Facility', /\b(?:CBRF|community[- ]based residential facilit(?:y|ies))\b/i],
    ['rcac', 'Residential Care Apartment Complex', /\b(?:RCAC|residential care apartment complex(?:es)?)\b/i],
    ['nursing_home', 'Nursing Home', /\bnursing homes?\b/i],
    ['hospice', 'Hospice', /\bhospice\b/i],
    ['home_health', 'Home Health Agency', /\bhome health\b/i],
  ];
  if (plan.identifier?.type === 'cms_ccn') return {classId:'ccn',label:'CCN verification',href:wiSpecialistUrl('senior')};
  const found = classes.find(([, , pattern]) => pattern.test(q));
  return found ? {classId:found[0], label:found[1], href:wiSpecialistUrl('senior')} : undefined;
}
export function wiReleaseGatePassed(value = manifest): boolean {
  return value.contract === WI_NETWORK_CONTRACT && value.release_gate.passed && value.scope === 'STATE_LEVEL_ONLY' &&
    !value.hardcoded_city_routes && !value.hardcoded_county_routes && value.hubs.length === 6 &&
    new Set(value.hubs.map(h => h.hub_id)).size === 6 && WI_HUBS.every(id => {
      const h = value.hubs.find(row => row.hub_id === id);
      return h?.certified_release_sha === FROZEN_SHAS[id] && h.canonical_state_url === wiSpecialistUrl(id) && Object.keys(h.source_clocks).length > 0;
    }) && value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status === 'REJECTED' &&
    value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value === null && value.expansion_ledger.ASK_GRAPH_WRITES === 0 &&
    value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED === false && value.expansion_ledger.LOCAL_PHASE === 'NO';
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key]) => !['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key,nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function wiPublicationSemanticFingerprint(value: unknown = manifest): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export const WI_PUBLICATION_FINGERPRINT = wiPublicationSemanticFingerprint();

const CITY = /\b(milwaukee|madison|green bay|kenosha)\b/i;
const TOPIC = /\b(mov(?:er|ers|ing)|household goods|local cartage|mortgage|hmda|nmls|contractor|dwelling|hvac|insur(?:ance|er)|agency|producer|nursing home|adult family home|cbrf|rcac|hospice|home health|senior|investment advis(?:er|or)|ria|securities|crd)\b/i;
export function wiGeography(query: string): {stateCode:string;stateName:string;city?:string;meaning:string} | undefined {
  const named = US_JURISDICTIONS.flatMap(j => {
    const at = query.search(new RegExp(`\\b${j.name}\\b`, 'i'));
    const codeAt = query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at}, {j,at:codeAt}].filter(row => row.at >= 0 && (row.at === at || !['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b) => a.at-b.at);
  const city = query.match(CITY)?.[1];
  if (named.length) {
    if (named[0].j.code !== 'WI') return undefined;
    return {stateCode:'WI',stateName:'Wisconsin',city,meaning:`Wisconsin statewide specialist research${city ? `; ${city} is search context, not a city page` : ''}.`};
  }
  if (city && TOPIC.test(query)) return {stateCode:'WI',stateName:'Wisconsin',city,meaning:`${city}, Wisconsin. Statewide specialist research; no city page.`};
  return undefined;
}
export function queryLooksLikeWisconsin(q: string): boolean { return wiGeography(q)?.stateCode === 'WI'; }
export function classifyWiHub(q: string): SpecialistHubId | undefined {
  const patterns: Array<[SpecialistHubId,RegExp]> = [
    ['move', /\b(movers?|moving|household[- ]goods|local cartage|lc authority|motor carrier authority|usdot|mc)\b/i],
    ['contractor', /\b(contractors?|dwelling contractor|electrical contractor|hvac contractor|dsps)\b/i],
    ['lender', /\b(mortgage|lenders?|brokers?|servicers?|nmls|hmda)\b/i],
    ['insurance', /\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|naic|npn|oci)\b/i],
    ['senior', /\b(nursing homes?|adult family home|cbrf|rcac|residential care apartment|hospice|home health|senior|ccn)\b/i],
    ['investor', /\b(investment advis(?:er|or)|rias?|securities|crd|sec)\b/i],
  ];
  return patterns.find(([,re]) => re.test(q))?.[0];
}
export type WiIdentifier = {hub:SpecialistHubId;type:string;value:string;raw:string};
export function wiIdentifier(q: string): WiIdentifier | undefined {
  if (!queryLooksLikeWisconsin(q)) return undefined;
  const formats: Array<[SpecialistHubId,string,RegExp]> = [
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i], ['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i], ['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i], ['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i], ['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for (const [hub,type,re] of formats) { const match = q.match(re); if (match) return {hub,type,value:match[1],raw:match[0]}; }
  return undefined;
}
export const WI_RANKING_REFUSAL = 'Ask does not rank, recommend, or select a Wisconsin provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function wiRankingAsked(q: string): boolean { return queryLooksLikeWisconsin(q) && /(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q); }
export function wiAmbiguousNumber(q: string): boolean {
  if (wiIdentifier(q)) return false;
  return /^\d+(?:\s+(?:Wisconsin|WI))?$/i.test(q.trim()) || /^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Wisconsin|WI))?$/i.test(q.trim());
}
export function wiRefusal(q: string): string | undefined {
  if (wiRankingAsked(q)) return WI_RANKING_REFUSAL;
  if (!queryLooksLikeWisconsin(q)) return undefined;
  if (wiAmbiguousNumber(q)) return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if (/how many providers|all wisconsin (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|wisconsin providers)/i.test(q)) return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function wiCaveat(hub: SpecialistHubId): string { const h = manifest.hubs.find(row => row.hub_id === hub)!; return `${h.capability_summary}. ${h.grain}`; }

