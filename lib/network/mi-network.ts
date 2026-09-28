import { createHash } from 'node:crypto';
import manifest from '../../data/network/michigan-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const MI_PUBLICATION_MANIFEST = manifest;
export const MI_NETWORK_CONTRACT = 'ath-mi-network-release-v1';
export const MI_HUBS = ['move', 'lender', 'contractor', 'insurance', 'senior', 'investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId, string> = {
  move: '01699b6ddf32ef8f97576c87e11ee6ddee2b749b',
  lender: 'fc82e00919c77f5568c20a8a8666412e5b9f5a99',
  contractor: '5193b127771101ebb0127ef9d40640b0a1298f84',
  insurance: '57ee1c6456001e81cca92aeb1875dd9e629b051f',
  senior: '23bfe3c35f2dfeccf5d86fd499d30068875b9c1f',
  investor: '42bfb2a0a8119b3055b50b96afc6614627734470',
};

export function miSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/michigan`; }
export function miReleaseGatePassed(value = manifest): boolean {
  return value.contract === MI_NETWORK_CONTRACT && value.release_gate.passed && value.scope === 'STATE_LEVEL_ONLY' &&
    !value.hardcoded_city_routes && !value.hardcoded_county_routes && value.hubs.length === 6 &&
    new Set(value.hubs.map(h => h.hub_id)).size === 6 && MI_HUBS.every(id => {
      const h = value.hubs.find(row => row.hub_id === id);
      return h?.certified_release_sha === FROZEN_SHAS[id] && h.canonical_state_url === miSpecialistUrl(id) && Object.keys(h.source_clocks).length > 0;
    }) && value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status === 'REJECTED' &&
    value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value === null && value.expansion_ledger.ASK_GRAPH_WRITES === 0 &&
    value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED === false && value.expansion_ledger.LOCAL_PHASE === 'NO';
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key]) => !['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b]) => a.localeCompare(b)).map(([key,nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function miPublicationSemanticFingerprint(value: unknown = manifest): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export const MI_PUBLICATION_FINGERPRINT = miPublicationSemanticFingerprint();

const CITY = /\b(detroit|grand rapids|lansing|ann arbor)\b/i;
const TOPIC = /\b(mov(?:er|ers|ing)|household goods|cved|mortgage|hmda|nmls|contractor|builder|electrical|plumbing|mechanical|insurance|insurer|agency|producer|nursing home|adult foster care|home for the aged|hospice|senior|investment advis(?:er|or)|ria|era|broker[- ]dealer|securities)\b/i;
/** Explicit named state precedes inferred city; city alone is only a statewide context. */
export function miGeography(query: string): {stateCode:string;stateName:string;city?:string;meaning:string} | undefined {
  const named = US_JURISDICTIONS.flatMap(j => {
    const at = query.search(new RegExp(`\\b${j.name}\\b`, 'i'));
    const codeAt = query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at}, {j,at:codeAt}].filter(row => row.at >= 0 && (row.at === at || !['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b) => a.at-b.at);
  const city = query.match(CITY)?.[1];
  if (named.length) {
    if (named[0].j.code !== 'MI') return undefined;
    return {stateCode:'MI',stateName:'Michigan',city,meaning:`Michigan statewide specialist research${city ? `; ${city} is search context, not a city page` : ''}.`};
  }
  if (city && TOPIC.test(query)) return {stateCode:'MI',stateName:'Michigan',city,meaning:`${city}, Michigan. Statewide specialist research; no city page.`};
  return undefined;
}
export function queryLooksLikeMichigan(q: string): boolean { return miGeography(q)?.stateCode === 'MI'; }
export function classifyMiHub(q: string): SpecialistHubId | undefined {
  const patterns: Array<[SpecialistHubId,RegExp]> = [
    ['move', /\b(movers?|moving|household[- ]goods|cved|usdot|mc)\b/i],
    ['lender', /\b(mortgage|lenders?|servicers?|nmls|hmda|loan originator|difs mortgage)\b/i],
    ['contractor', /\b(contractors?|residential builders?|builder discipline|electrical|plumbing|mechanical|bcc)\b/i],
    ['insurance', /\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|naic|npn|difs insurance)\b/i],
    ['senior', /\b(nursing homes?|adult foster care|home for the aged|hospice|senior|ccn|afc)\b/i],
    ['investor', /\b(investment advis(?:er|or)|rias?|eras?|federal notice|broker[- ]dealer|securities|crd|sec)\b/i],
  ];
  return patterns.find(([,re]) => re.test(q))?.[0];
}
export type MiIdentifier = {hub:SpecialistHubId;type:string;value:string;raw:string};
export function miIdentifier(q: string): MiIdentifier | undefined {
  if (!queryLooksLikeMichigan(q)) return undefined;
  const formats: Array<[SpecialistHubId,string,RegExp]> = [
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],
    ['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],
    ['contractor','mi_bcc_credential',/\b(?:bcc|michigan residential builder|michigan builder)\s+(?:license|credential)\s*#?\s*(\d{7,12})\b/i],
    ['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],
    ['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],
    ['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for (const [hub,type,re] of formats) { const match = q.match(re); if (match) return {hub,type,value:match[1],raw:match[0]}; }
  return undefined;
}
export const MI_RANKING_REFUSAL = 'Ask does not rank, recommend, or select a Michigan provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function miRankingAsked(q: string): boolean { return queryLooksLikeMichigan(q) && /(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q); }
export function miAmbiguousNumber(q: string): boolean {
  if (miIdentifier(q)) return false;
  return /^\d+(?:\s+(?:Michigan|MI))?$/i.test(q.trim()) || /^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Michigan|MI))?$/i.test(q.trim());
}
export function miRefusal(q: string): string | undefined {
  if (miRankingAsked(q)) return MI_RANKING_REFUSAL;
  if (!queryLooksLikeMichigan(q)) return undefined;
  if (miAmbiguousNumber(q)) return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if (/how many providers|all michigan (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|michigan providers)/i.test(q)) return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function miCaveat(hub: SpecialistHubId): string { const h = manifest.hubs.find(row => row.hub_id === hub)!; return `${h.capability_summary}. ${h.grain}`; }
