import { createHash } from 'node:crypto';
import manifest from '../../data/network/minnesota-publication-manifest.json' with { type: 'json' };
import certificates from '../../data/network/minnesota/certified-specialists.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';

export const MN_PUBLICATION_MANIFEST = manifest;
export const MN_NETWORK_CONTRACT = 'ath-mn-network-release-v1';
export const MN_HUBS = ['move', 'lender', 'contractor', 'insurance', 'senior', 'investor'] as const;
export function mnSpecialistUrl(hub: SpecialistHubId): string { return `${CANONICAL_ORIGINS[hub]}/minnesota`; }
export function mnReleaseGatePassed(value = manifest): boolean {
  return value.release_gate.passed && value.scope === 'STATE_LEVEL_ONLY' && !value.hardcoded_city_routes && !value.hardcoded_county_routes &&
    value.hubs.length === 6 && new Set(value.hubs.map(h => h.hub_id)).size === 6 && MN_HUBS.every(id => {
      const h = value.hubs.find(h => h.hub_id === id), c = certificates[id];
      return h?.certified_release_sha === c.sha && h.fingerprint === c.fingerprint && h.specialist_status === 'CLOSED_PRODUCTION_VERIFIED' && h.independent_certification === 'PASS' && h.canonical_state_url === mnSpecialistUrl(id);
    }) && value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status === 'REJECTED' && value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value === null && value.expansion_ledger.ASK_GRAPH_WRITES === 0 && value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED === false;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([k]) => !['generatedAt','generated_at','verifiedAt','verified_at'].includes(k)).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
export function mnPublicationSemanticFingerprint(value = manifest): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export const MN_PUBLICATION_FINGERPRINT = mnPublicationSemanticFingerprint();

/** Explicit states precede city inference; no national city resolver changes. */
export function mnGeography(query: string): { stateCode: string; stateName: string; city?: string; meaning: string } | undefined {
  const tokens = US_JURISDICTIONS.flatMap(j => {
    const name = query.search(new RegExp(`\\b${j.name}\\b`, 'i'));
    const code = query.search(new RegExp(`\\b${j.code}\\b`, j.code === 'MN' ? 'i' : ''));
    return [{j,at:name}, {j,at:code}].filter(x => x.at >= 0 && (x.at === name || !['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b) => a.at-b.at);
  const city = query.match(/\b(minneapolis|saint paul|st\.? paul|duluth|rochester|bloomington)\b/i)?.[1];
  const explicitMn = /\bminnesota\b|\bMN\b/i.test(query);
  if (tokens.length) {
    if (!explicitMn && !city) return undefined;
    // Bloomington IN is pre-existing national debt; do not change it here.
    if (!explicitMn && /\bbloomington\b/i.test(query)) return undefined;
    const j = tokens[0].j;
    return {stateCode:j.code,stateName:j.name,city,meaning:`${j.name}. Explicit state intent; source-specific geography, not service territory.`};
  }
  if (!city || /rochester|bloomington/i.test(city)) return undefined;
  if (!classifyMnHub(query)) return undefined;
  return {stateCode:'MN',stateName:'Minnesota',city,meaning:`${city}, Minnesota. Statewide research; no city marketplace.`};
}
export function queryLooksLikeMinnesota(q: string): boolean { return mnGeography(q)?.stateCode === 'MN'; }
export function classifyMnHub(q: string): SpecialistHubId | undefined {
  const patterns: Array<[SpecialistHubId, RegExp]> = [
    ['move', /\b(movers?|moving|household[- ]goods|mndot|usdot|mc|intrastate)\b/i],
    ['lender', /\b(mortgage|lenders?|mlos?|loan originator|servicers?|nmls|hmda)\b/i],
    ['contractor', /\b(dli|contractors?|roofers?|roofing|remodelers?|electrical|plumbing)\b/i],
    ['senior', /\b(nursing homes?|assisted living|dementia care|memory care|boarding care|home care|home health|hospice|hfid|mdh|ccn|senior)\b/i],
    ['investor', /\b(investment|financial advis[eo]r|rias?|eras?|advis[eo]rs?|notice filing|broker[- ]dealer|securities|crd|sec)\b/i],
    ['insurance', /\b(insurance|insurers?|agenc(?:y|ies)|producers?|naic|npn)\b/i],
  ];
  return patterns.find(([,re]) => re.test(q))?.[0];
}
export type MnIdentifier = { hub: SpecialistHubId; type: string; value: string; raw: string };
export function mnIdentifier(q: string): MnIdentifier | undefined {
  const mn = queryLooksLikeMinnesota(q);
  const formats: Array<[SpecialistHubId,string,RegExp,boolean]> = [
    ['move','mn_mndot_carrier_number',/\bmndot\s*(?:permit|carrier|number|no\.?|#)?\s*(\d+)\b/i,true],
    ['move','mn_mndot_carrier_number',/\bmover permit\s*#?\s*(\d+)\b/i,mn],
    ['contractor','mn_dli_credential',/\b((?:BC|CR|RR|QB|QC|QR|PC|EC|PM|PL|RE|RT|TS|BF)\d{6})\b/i,mn || /\bdli\b/i.test(q)],
    ['senior','mn_mdh_hfid',/\bhfid\s*(?:number|#)?\s*(\d+)\b/i,true],
    ['senior','mn_mdh_license',/\bmdh\s*(?:license|credential)?\s*#?\s*(\d+)\b/i,true],
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d+)\b/i,mn],
    ['move','mc',/\bmc\s*#?\s*(\d+)\b/i,mn],
    ['lender','nmls',/\bnmls\s*#?\s*(\d+)\b/i,mn],
    ['insurance','naic_company_code',/\bnaic\s*#?\s*(\d+)\b/i,mn],
    ['insurance','npn',/\bnpn\s*#?\s*(\d+)\b/i,mn],
    ['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i,mn],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i,mn],
    ['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i,mn],
  ];
  for (const [hub,type,re,admitted] of formats) { const m = admitted && q.match(re); if (m) return {hub,type,value:m[1],raw:m[0]}; }
  return undefined;
}
export const MN_RANKING_REFUSAL = 'Ask does not rank, recommend, or select a provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function mnRankingAsked(q: string): boolean { return queryLooksLikeMinnesota(q) && /(?:\b(best|safest|recommended|top[- ]rated|trust score|paid ranking|sponsored ranking)\b|#1\b)/i.test(q); }
export function mnAmbiguousNumber(q: string): boolean {
  if (mnIdentifier(q)) return false;
  return /^\d+(?:\s+(?:Minnesota|MN))?$/i.test(q.trim()) || /^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Minnesota|MN))?$/i.test(q.trim());
}
export function mnRefusal(q: string): string | undefined {
  if (mnRankingAsked(q)) return MN_RANKING_REFUSAL;
  if (mnAmbiguousNumber(q)) return 'A bare number or unqualified license is ambiguous. Supply the identifier family (for example NMLS 2229); Ask will not search the number as a company name.';
  if (!queryLooksLikeMinnesota(q)) return undefined;
  if (/\b(?:HIC\s*\d+|(?:RC|RF)\d{6})\b/i.test(q)) return 'That prefix is not a recognized Minnesota credential. Specify the regulator and printed credential; Ask will not guess or search it as a business name.';
  if (/280,?548/.test(q)) return '280,548 mixes DLI credential classes and is not a count of contractor companies. The safe lens is 10,923 Residential Building Contractor credentials with status Issued; individual credentials are not business profiles.';
  if (/how many providers|total licensed businesses|all minnesota senior facilities|combined.*total/i.test(q)) return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Different source grains and Senior care classes cannot be summed.';
  return undefined;
}
export function mnCaveat(hub: SpecialistHubId): string { const h=manifest.hubs.find(h=>h.hub_id===hub)!; return `${h.capability_summary}. ${h.grain}`; }
export function mnConciergeContext(): string { return `Minnesota is a six-specialist gateway at /minnesota, not a seventh dataset. No city routes, graph writes or claim expansion. No combined record total or universal source clock. ${MN_RANKING_REFUSAL}\n${manifest.hubs.map(h=>`${h.hub_name}: ${h.canonical_state_url}. ${h.capability_summary}. ${h.grain}`).join('\n')}`; }
