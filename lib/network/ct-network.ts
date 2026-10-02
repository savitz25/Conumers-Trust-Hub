import { createHash } from 'node:crypto';
import manifest from '../../data/network/connecticut-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const CT_PUBLICATION_MANIFEST = manifest;
export const CT_NETWORK_CONTRACT = 'ath-ct-network-release-v1';
export const CT_HUBS = ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId, string> = {
  move: '38112e200ebcd5df3044593c81fb826e6af5c7e0',
  contractor: '7e25742f75b3b4c1cf79ae554a28cee1aa54447b',
  lender: '7f0fade2ad9bf5e9089f7d1e9974802648852639',
  insurance: '5b7ffabdf7327a1223650690fe43afbc1a0c3148',
  senior: '48f4e18bb7f03cb4c00aae9f4de42c2875553759',
  investor: '3eede73a6067ca404350acd9f5f8a3b324f978b3',
};

export function ctSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/connecticut`; }
export function ctReleaseGatePassed(value = manifest): boolean {
  return value.contract === CT_NETWORK_CONTRACT && value.release_gate.passed && value.scope === 'STATE_LEVEL_ONLY' &&
    !value.hardcoded_city_routes && !value.hardcoded_county_routes && value.hubs.length === 6 &&
    new Set(value.hubs.map(h => h.hub_id)).size === 6 && CT_HUBS.every(id => {
      const h = value.hubs.find(row => row.hub_id === id);
      return h?.certified_release_sha === FROZEN_SHAS[id] && h.canonical_state_url === ctSpecialistUrl(id) && Object.keys(h.source_clocks).length > 0;
    }) && value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status === 'REJECTED' &&
    value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value === null && value.expansion_ledger.ASK_GRAPH_WRITES === 0 &&
    value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED === false && value.expansion_ledger.LOCAL_PHASE === 'NO';
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key]) => !['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key,nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function ctPublicationSemanticFingerprint(value: unknown = manifest): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export const CT_PUBLICATION_FINGERPRINT = ctPublicationSemanticFingerprint();

const CITY = /\b(hartford|new haven|stamford|bridgeport)\b/i;
const TOPIC = /\b(mov(?:er|ers|ing)|household goods|ctdot|rchg|mortgage|hmda|nmls|contractor|builder|hic|electrician|plumber|insurance|insurer|agency|producer|nursing home|ccnh|residential care|assisted living|home health|hospice|senior|investment advis(?:er|or)|ria|era|securities)\b/i;
/** A named state wins over a Connecticut city; cities only select statewide context. */
export function ctGeography(query: string): {stateCode:string;stateName:string;city?:string;meaning:string} | undefined {
  const named = US_JURISDICTIONS.flatMap(j => {
    const at = query.search(new RegExp(`\\b${j.name}\\b`, 'i'));
    const codeAt = query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at}, {j,at:codeAt}].filter(row => row.at >= 0 && (row.at === at || !['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b) => a.at-b.at);
  const city = query.match(CITY)?.[1];
  if (named.length) {
    if (named[0].j.code !== 'CT') return undefined;
    return {stateCode:'CT',stateName:'Connecticut',city,meaning:`Connecticut statewide specialist research${city ? `; ${city} is search context, not a city page` : ''}.`};
  }
  if (/\b(?:CTDOT|RCHG)\b/i.test(query)) return {stateCode:'CT',stateName:'Connecticut',city,meaning:'Connecticut statewide CTDOT household-goods authority research; no city page.'};
  if (city && TOPIC.test(query)) return {stateCode:'CT',stateName:'Connecticut',city,meaning:`${city}, Connecticut. Statewide specialist research; no city page.`};
  return undefined;
}
export function queryLooksLikeConnecticut(q: string): boolean { return ctGeography(q)?.stateCode === 'CT'; }
export function classifyCtHub(q: string): SpecialistHubId | undefined {
  const patterns: Array<[SpecialistHubId,RegExp]> = [
    ['move', /\b(movers?|moving|household[- ]goods|ctdot|rchg|usdot|mc)\b/i],
    ['contractor', /\b(contractors?|home improvement|new home|builders?|hic|electricians?|plumbers?|hvac|heating|fire protection)\b/i],
    ['lender', /\b(mortgage|lenders?|brokers?|servicers?|nmls|hmda|loan originator)\b/i],
    ['insurance', /\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|naic|npn|cid)\b/i],
    ['senior', /\b(nursing homes?|ccnh|residential care|assisted living|home health|hospice|senior|ccn)\b/i],
    ['investor', /\b(investment advis(?:er|or)|rias?|eras?|federal notice|broker[- ]dealer|securities|crd|sec)\b/i],
  ];
  return patterns.find(([,re]) => re.test(q))?.[0];
}
export type CtIdentifier = {hub:SpecialistHubId;type:string;value:string;raw:string};
export function ctIdentifier(q: string): CtIdentifier | undefined {
  if (!queryLooksLikeConnecticut(q)) return undefined;
  const formats: Array<[SpecialistHubId,string,RegExp]> = [
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['contractor','ct_hic_credential',/\bhic[. -]?(\d{6,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],
    ['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],
    ['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],
    ['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for (const [hub,type,re] of formats) { const match = q.match(re); if (match) return {hub,type,value:match[1],raw:match[0]}; }
  return undefined;
}
export const CT_RANKING_REFUSAL = 'Ask does not rank, recommend, or select a Connecticut provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function ctRankingAsked(q: string): boolean { return queryLooksLikeConnecticut(q) && /(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q); }
export function ctAmbiguousNumber(q: string): boolean {
  if (ctIdentifier(q)) return false;
  return /^\d+(?:\s+(?:Connecticut|CT))?$/i.test(q.trim()) || /^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Connecticut|CT))?$/i.test(q.trim());
}
export function ctRefusal(q: string): string | undefined {
  if (ctRankingAsked(q)) return CT_RANKING_REFUSAL;
  if (!queryLooksLikeConnecticut(q)) return undefined;
  if (ctAmbiguousNumber(q)) return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if (/how many providers|all connecticut (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|connecticut providers)/i.test(q)) return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function ctCaveat(hub: SpecialistHubId): string { const h = manifest.hubs.find(row => row.hub_id === hub)!; return `${h.capability_summary}. ${h.grain}`; }
