import { createHash } from 'node:crypto';
import manifest from '../../data/network/maryland-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const MD_PUBLICATION_MANIFEST = manifest;
export const MD_NETWORK_CONTRACT = 'ath-md-network-release-v1';
export const MD_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId, string> = {
  move: '13a4b8e69ae93dcfa4e518ee8c0d11ee2ebd4886',
  contractor: '3f8d0e21119edbc1f9e1dd727e7dcd1e672d9979',
  lender: '98e6ef9cb900f816a71e519f3bd9c7dee436dd81',
  insurance: 'ff48c58ea04466d660019ff88c978a7e249619c5',
  senior: '31985f3aa213228f28486f852ca979fe7c1e2815',
  investor: '1d5554a5c775ff29ae73317475689b0e002889d2',
};
export function mdSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/maryland`; }
export function mdReleaseGatePassed(value = manifest): boolean {
  return value.contract === MD_NETWORK_CONTRACT && value.release_gate.passed && value.scope === 'STATE_LEVEL_ONLY' &&
    !value.hardcoded_city_routes && !value.hardcoded_county_routes && value.hubs.length === 6 &&
    new Set(value.hubs.map(h => h.hub_id)).size === 6 && MD_HUBS.every(id => {
      const h = value.hubs.find(row => row.hub_id === id);
      return h?.certified_release_sha === FROZEN_SHAS[id] && h.canonical_state_url === mdSpecialistUrl(id) && Object.keys(h.source_clocks).length > 0;
    }) && value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status === 'REJECTED' &&
    value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value === null && value.expansion_ledger.ASK_GRAPH_WRITES === 0 &&
    value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED === false && value.expansion_ledger.LOCAL_PHASE === 'NO';
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key]) => !['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key,nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function mdPublicationSemanticFingerprint(value: unknown = manifest): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export const MD_PUBLICATION_FINGERPRINT = mdPublicationSemanticFingerprint();

const CITY = /\b(baltimore|annapolis|frederick|rockville)\b/i;
const TOPIC = /\b(mov(?:er|ers|ing)|household goods|mortgage|hmda|nmls|contractor|mhic|guaranty fund|insur(?:ance|er)|agency|producer|nursing home|assisted living|hospice|home health|senior|investment advis(?:er|or)|ria|securities|crd)\b/i;
export function mdGeography(query: string): {stateCode:string;stateName:string;city?:string;meaning:string} | undefined {
  const named = US_JURISDICTIONS.flatMap(j => {
    const at = query.search(new RegExp(`\\b${j.name}\\b`, 'i'));
    const codeAt = query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at}, {j,at:codeAt}].filter(row => row.at >= 0 && (row.at === at || !['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b) => a.at-b.at);
  const city = query.match(CITY)?.[1];
  if (named.length) {
    if (named[0].j.code !== 'MD') return undefined;
    return {stateCode:'MD',stateName:'Maryland',city,meaning:`Maryland statewide specialist research${city ? `; ${city} is search context, not a city page` : ''}.`};
  }
  if (city && TOPIC.test(query)) return {stateCode:'MD',stateName:'Maryland',city,meaning:`${city}, Maryland. Statewide specialist research; no city page.`};
  return undefined;
}
export function queryLooksLikeMaryland(q: string): boolean { return mdGeography(q)?.stateCode === 'MD'; }
export function classifyMdHub(q: string): SpecialistHubId | undefined {
  const patterns: Array<[SpecialistHubId,RegExp]> = [
    ['move', /\b(movers?|moving|household[- ]goods|mover registration|usdot|mc)\b/i],
    ['contractor', /\b(contractors?|home improvement|mhic|guaranty fund|builder discipline)\b/i],
    ['lender', /\b(mortgage|lenders?|brokers?|servicers?|nmls|hmda|ofr)\b/i],
    ['insurance', /\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|naic|npn|mia orders)\b/i],
    ['senior', /\b(nursing homes?|assisted living|hospice|home health|senior|ccn)\b/i],
    ['investor', /\b(investment advis(?:er|or)|rias?|securities|crd|sec)\b/i],
  ];
  return patterns.find(([,re]) => re.test(q))?.[0];
}
export type MdIdentifier = {hub:SpecialistHubId;type:string;value:string;raw:string};
export function mdIdentifier(q: string): MdIdentifier | undefined {
  if (!queryLooksLikeMaryland(q)) return undefined;
  const formats: Array<[SpecialistHubId,string,RegExp]> = [
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i], ['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i], ['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i], ['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i], ['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for (const [hub,type,re] of formats) { const match = q.match(re); if (match) return {hub,type,value:match[1],raw:match[0]}; }
  return undefined;
}
export const MD_RANKING_REFUSAL = 'Ask does not rank, recommend, or select a Maryland provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function mdRankingAsked(q: string): boolean { return queryLooksLikeMaryland(q) && /(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q); }
export function mdAmbiguousNumber(q: string): boolean {
  if (mdIdentifier(q)) return false;
  return /^\d+(?:\s+(?:Maryland|MD))?$/i.test(q.trim()) || /^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Maryland|MD))?$/i.test(q.trim());
}
export function mdRefusal(q: string): string | undefined {
  if (mdRankingAsked(q)) return MD_RANKING_REFUSAL;
  if (!queryLooksLikeMaryland(q)) return undefined;
  if (mdAmbiguousNumber(q)) return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if (/how many providers|all maryland (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|maryland providers)/i.test(q)) return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function mdCaveat(hub: SpecialistHubId): string { const h = manifest.hubs.find(row => row.hub_id === hub)!; return `${h.capability_summary}. ${h.grain}`; }
