import { createHash } from 'node:crypto';
import manifest from '../../data/network/indiana-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const IN_PUBLICATION_MANIFEST = manifest;
export const IN_NETWORK_CONTRACT = 'ath-in-network-release-v1';
export const IN_HUBS = ['move','contractor','lender','insurance','senior','investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId,string> = {
  move:'62b2cdd0a9cefb9255e3b09548795a351b9279f2',
  contractor:'8575bc3fd10fb3751bf7cd2952410458e8db3b2c',
  lender:'38b91f316d6902543035ff152f6a172e61254c0f',
  insurance:'33c176213aeb02651c91c48fdd82215bf3e57e14',
  senior:'9b35178e40b054783ba4b655fc7fb03d3286239e',
  investor:'9a6681377e442151e969e1ea8422ac5f7c6e2a5d',
};
export function inSpecialistUrl(hub:SpecialistHubId):string{return `${CANONICAL_ORIGINS[hub]}/indiana`;}
export function inReleaseGatePassed(value=manifest):boolean{
  return value.contract===IN_NETWORK_CONTRACT&&value.release_gate.passed&&value.scope==='STATE_LEVEL_ONLY'&&
    !value.hardcoded_city_routes&&!value.hardcoded_county_routes&&value.hubs.length===6&&
    new Set(value.hubs.map(h=>h.hub_id)).size===6&&IN_HUBS.every(id=>{
      const h=value.hubs.find(row=>row.hub_id===id);
      return h?.certified_release_sha===FROZEN_SHAS[id]&&h.canonical_state_url===inSpecialistUrl(id)&&Object.keys(h.source_clocks).length>0;
    })&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status==='REJECTED'&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value===null&&
    value.expansion_ledger.ASK_GRAPH_WRITES===0&&value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED===false&&value.expansion_ledger.LOCAL_PHASE==='NO';
}
function canonical(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key])=>!['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,nested])=>`${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function inPublicationSemanticFingerprint(value:unknown=manifest):string{return createHash('sha256').update(canonical(value)).digest('hex');}
export const IN_PUBLICATION_FINGERPRINT=inPublicationSemanticFingerprint();

const CITY=/\b(indianapolis|fort wayne|evansville|south bend)\b/i;
const TOPIC=/\b(mov(?:er|ers|ing)|household.goods|contractor|plumb|hvac|electrical|mortgage|lender|loan broker|insurance|insurer|agency|producer|nursing home|assisted living|residential care|home health|hospice|senior|investment advis(?:er|or)|ria|securities|crd|ccn)\b/i;
export function inGeography(query:string):{stateCode:string;stateName:string;city?:string;meaning:string}|undefined{
  const named=US_JURISDICTIONS.flatMap(j=>{
    const at=query.search(new RegExp(`\\b${j.name}\\b`,'i'));
    // Bare IN collides with ordinary wording and an established Bloomington IN regression.
    // This gateway requires the full state name or one of its named cities.
    const codeAt=j.code==='IN'?-1:query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at},{j,at:codeAt}].filter(row=>row.at>=0&&(row.at===at||!['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b)=>a.at-b.at);
  const city=query.match(CITY)?.[1];
  if(named.length){if(named[0].j.code!=='IN')return undefined;return {stateCode:'IN',stateName:'Indiana',city,meaning:`Indiana statewide specialist research${city?`; ${city} is context, not a city page`:''}.`};}
  if(city&&TOPIC.test(query))return {stateCode:'IN',stateName:'Indiana',city,meaning:`${city}, Indiana. Statewide specialist research; no city page.`};
  return undefined;
}
export function queryLooksLikeIndiana(q:string):boolean{return inGeography(q)?.stateCode==='IN';}
export function classifyInHub(q:string):SpecialistHubId|undefined{
  const patterns:Array<[SpecialistHubId,RegExp]>=[
    ['move',/\b(movers?|moving|household[- ]goods|dor moving authority|usdot|mc)\b/i],
    ['contractor',/\b(contractors?|plumb(?:er|ing)|electric(?:al|ian)|hvac|construction licen[cs]e)\b/i],
    ['lender',/\b(mortgage|lenders?|loan brokers?|nmls|hmda|dfi mortgage)\b/i],
    ['insurance',/\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|naic|npn|idoi)\b/i],
    ['senior',/\b(nursing homes?|comprehensive care|residential care|assisted living|home health|hospice|senior|ccn)\b/i],
    ['investor',/\b(investment advis(?:er|or)|rias?|securities|crd|sec)\b/i],
  ];
  return patterns.find(([,re])=>re.test(q))?.[0];
}
export type InIdentifier={hub:SpecialistHubId;type:string;value:string;raw:string};
export function inIdentifier(q:string):InIdentifier|undefined{
  if(!queryLooksLikeIndiana(q))return undefined;
  const formats:Array<[SpecialistHubId,string,RegExp]>=[
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for(const [hub,type,re] of formats){const match=q.match(re);if(match)return {hub,type,value:match[1],raw:match[0]};}
  return undefined;
}
export const IN_RANKING_REFUSAL='Ask does not rank, recommend or select an Indiana provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function inRankingAsked(q:string):boolean{return queryLooksLikeIndiana(q)&&/(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q);}
export function inAmbiguousNumber(q:string):boolean{return !inIdentifier(q)&&(/^\d+(?:\s+(?:Indiana|IN))?$/i.test(q.trim())||/^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Indiana|IN))?$/i.test(q.trim()));}
export function inRefusal(q:string):string|undefined{
  if(inRankingAsked(q))return IN_RANKING_REFUSAL;
  if(!queryLooksLikeIndiana(q))return undefined;
  if(inAmbiguousNumber(q))return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if(/how many providers|all indiana (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|indiana providers)/i.test(q))return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function inCaveat(hub:SpecialistHubId,query=''):string{
  const h=manifest.hubs.find(row=>row.hub_id===hub)!;
  if(hub==='contractor'&&!/\bplumb(?:er|ing)\b/i.test(query))return 'Indiana does not license most construction contractors statewide. General, electrical and HVAC licensing is primarily local. Ask has no statewide roster or count for those classes; ContractorTrustHub Indiana publishes separate statewide plumbing evidence.';
  if(hub==='senior'&&/\bassisted living\b/i.test(query))return 'Indiana publishes Residential Care as the relevant statewide source class. Ask does not assert a standalone Assisted Living license roster. Comprehensive Care, Home Health Agency and Hospice stay separate.';
  if(hub==='senior'&&/\bnursing home\b/i.test(query))return 'Indiana Comprehensive Care has 507 directory rows and 59,891 licensed beds. Residential Care, Home Health Agency and Hospice stay separate; no combined senior total.';
  if(hub==='lender'&&/\bloan brokers?\b/i.test(query))return 'Indiana Securities Division Loan Brokers are separate from DFI Mortgage Lenders. The Loan Broker roster was not acquired; 12 company enforcement orders are a separate order grain.';
  return `${h.capability_summary}. ${h.grain}`;
}
export function inResearchHandoff(plan:AskResearchPlan):{hub:SpecialistHubId;href:string;label:string}|undefined{
  if(plan.requestedGeography?.stateCode!=='IN'||!plan.primaryHub||!plan.executionAllowed||
    !plan.reasonCodes.some(code=>['INDIANA_RESEARCH_ROUTING','EXACT_IDENTIFIER_RECOGNIZED'].includes(code)))return undefined;
  return {hub:plan.primaryHub,href:inSpecialistUrl(plan.primaryHub),label:manifest.hubs.find(row=>row.hub_id===plan.primaryHub)!.hub_name};
}
