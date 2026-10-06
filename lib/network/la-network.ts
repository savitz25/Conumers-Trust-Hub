import { createHash } from 'node:crypto';
import manifest from '../../data/network/louisiana-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const LA_PUBLICATION_MANIFEST = manifest;
export const LA_NETWORK_CONTRACT = 'ath-la-network-release-v1';
export const LA_HUBS = ['move','contractor','lender','insurance','senior','investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId,string> = {
  move:'0e0340c11c19741c9255dcf2870d60fb752d268b',
  contractor:'913c97fd8627c1ffa222055c1fe43c4f6d45f1ca',
  lender:'66701e6f9d79848616c4cd6d0aa68625f496e56c',
  insurance:'53eba72847d732ebaa8efaff3d2cdee1a5f7d62e',
  senior:'42cb68be0fc27b964405a6fe60baa2462477b9bb',
  investor:'40c5614dee85143cb92707bd699fc7fef0272c96',
};
export function laSpecialistUrl(hub:SpecialistHubId):string{return `${CANONICAL_ORIGINS[hub]}/louisiana`;}
export function laReleaseGatePassed(value=manifest):boolean{
  return value.contract===LA_NETWORK_CONTRACT&&value.release_gate.passed&&value.scope==='STATE_LEVEL_ONLY'&&
    !value.hardcoded_city_routes&&!value.hardcoded_county_routes&&value.hubs.length===6&&
    new Set(value.hubs.map(h=>h.hub_id)).size===6&&LA_HUBS.every(id=>{
      const h=value.hubs.find(row=>row.hub_id===id);
      return h?.certified_release_sha===FROZEN_SHAS[id]&&h.canonical_state_url===laSpecialistUrl(id)&&Object.keys(h.source_clocks).length>0;
    })&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status==='REJECTED'&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value===null&&
    value.expansion_ledger.ASK_GRAPH_WRITES===0&&value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED===false&&value.expansion_ledger.LOCAL_PHASE==='NO';
}
function canonical(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key])=>!['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,nested])=>`${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function laPublicationSemanticFingerprint(value:unknown=manifest):string{return createHash('sha256').update(canonical(value)).digest('hex');}
export const LA_PUBLICATION_FINGERPRINT=laPublicationSemanticFingerprint();

const CITY=/\b(new orleans|baton rouge|shreveport|lafayette)\b/i;
const TOPIC=/\b(mov(?:er|ers|ing)|household.goods|contractor|lslbc|plumb|hvac|electrical|mortgage|lender|loan broker|nmls|hmda|insurance|insurer|agency|producer|adjuster|naic|npn|nursing home|assisted living|residential care|home health|hospice|adult day|icf|senior|investment advis(?:er|or)|ria|securities|crd)\b/i;
export function laGeography(query:string):{stateCode:string;stateName:string;city?:string;meaning:string}|undefined{
  const named=US_JURISDICTIONS.flatMap(j=>{
    const at=query.search(new RegExp(`\\b${j.name}\\b`,'i'));
    // Bare IN stays disabled here because it collides with ordinary wording. LA is accepted only in uppercase.
    const codeAt=j.code==='IN'?-1:query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at},{j,at:codeAt}].filter(row=>row.at>=0&&(row.at===at||!['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b)=>a.at-b.at);
  const softAt=query.search(/(?:in|within|state of)\s+la\b/i);
  const city=query.match(CITY)?.[1];
  const meaning=(withCity?:string)=>withCity?`Louisiana statewide specialist research; ${withCity} is context, not a city or parish page.`:'Louisiana statewide specialist research.';
  if(named.length){if(named[0].j.code!=='LA')return undefined;return {stateCode:'LA',stateName:'Louisiana',city,meaning:meaning(city)};}
  if(softAt>=0)return {stateCode:'LA',stateName:'Louisiana',city,meaning:meaning(city)};
  if(city&&TOPIC.test(query))return {stateCode:'LA',stateName:'Louisiana',city,meaning:`${city}, Louisiana. Statewide specialist research; no parish or city page.`};
  return undefined;
}
export function queryLooksLikeLouisiana(q:string):boolean{return laGeography(q)?.stateCode==='LA';}
export function classifyLaHub(q:string):SpecialistHubId|undefined{
  const patterns:Array<[SpecialistHubId,RegExp]>=[
    ['move',/\b(movers?|moving|household[- ]goods|lpsc|usdot|mc)\b/i],
    ['contractor',/\b(contractors?|lslbc|plumb(?:er|ing)|electric(?:al|ian)|hvac|construction licen[cs]e|home improvement|mold remediation)\b/i],
    ['lender',/\b(mortgage|lenders?|loan brokers?|nmls|hmda|ofi)\b/i],
    ['insurance',/\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|adjusters?|naic|npn|ldi)\b/i],
    ['senior',/\b(nursing homes?|assisted living|residential care|home health|hospice|adult day|icf|senior|ccn)\b/i],
    ['investor',/\b(investment advis(?:er|or)|rias?|securities|crd|sec)\b/i],
  ];
  return patterns.find(([,re])=>re.test(q))?.[0];
}
export type LaIdentifier={hub:SpecialistHubId;type:string;value:string;raw:string};
export function laIdentifier(q:string):LaIdentifier|undefined{
  if(!queryLooksLikeLouisiana(q))return undefined;
  const formats:Array<[SpecialistHubId,string,RegExp]>=[
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for(const [hub,type,re] of formats){const match=q.match(re);if(match)return {hub,type,value:match[1],raw:match[0]};}
  return undefined;
}
export const LA_RANKING_REFUSAL='Ask does not rank, recommend or select a Louisiana provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function laRankingAsked(q:string):boolean{return queryLooksLikeLouisiana(q)&&/(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q);}
export function laAmbiguousNumber(q:string):boolean{return !laIdentifier(q)&&(/^\d+(?:\s+(?:Louisiana|LA))?$/i.test(q.trim())||/^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Louisiana|LA))?$/i.test(q.trim()));}
export function laRefusal(q:string):string|undefined{
  if(laRankingAsked(q))return LA_RANKING_REFUSAL;
  if(!queryLooksLikeLouisiana(q))return undefined;
  if(laAmbiguousNumber(q))return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if(/how many providers|all louisiana (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|louisiana providers)/i.test(q))return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function laCaveat(hub:SpecialistHubId,query=''):string{
  const h=manifest.hubs.find(row=>row.hub_id===hub)!;
  const plumbing=hub==='contractor'&&/\bplumb/i.test(query)?' Plumbing Board person licenses were not acquired.':'';
  return `${h.capability_summary}.${plumbing} ${h.grain}`;
}
export function laResearchHandoff(plan:AskResearchPlan):{hub:SpecialistHubId;href:string;label:string}|undefined{
  if(plan.requestedGeography?.stateCode!=='LA'||!plan.primaryHub||!plan.executionAllowed||
    !plan.reasonCodes.some(code=>['LOUISIANA_RESEARCH_ROUTING','EXACT_IDENTIFIER_RECOGNIZED'].includes(code)))return undefined;
  return {hub:plan.primaryHub,href:laSpecialistUrl(plan.primaryHub),label:manifest.hubs.find(row=>row.hub_id===plan.primaryHub)!.hub_name};
}
