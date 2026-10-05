import { createHash } from 'node:crypto';
import manifest from '../../data/network/kentucky-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const KY_PUBLICATION_MANIFEST = manifest;
export const KY_NETWORK_CONTRACT = 'ath-ky-network-release-v1';
export const KY_HUBS = ['move','contractor','lender','insurance','senior','investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId,string> = {
  move:'ef7a9d8b027ec85d38b37040b640aa3c46fdd585',
  contractor:'fdfc76ce16e6f91f70ca928f4ca8918f591c2c7c',
  lender:'82f0ace97e411768e1bafd2a5328abea42f8c61a',
  insurance:'4d59339e19964ca64a49a8bf5c089f77d132c9c3',
  senior:'a9049afac58c65055e726c981aa1279c80a610a4',
  investor:'1e715d9f7084d23a3a829fefabb743b5e9952594',
};
export function kySpecialistUrl(hub:SpecialistHubId):string{return `${CANONICAL_ORIGINS[hub]}/kentucky`;}
export function kyReleaseGatePassed(value=manifest):boolean{
  return value.contract===KY_NETWORK_CONTRACT&&value.release_gate.passed&&value.scope==='STATE_LEVEL_ONLY'&&
    !value.hardcoded_city_routes&&!value.hardcoded_county_routes&&value.hubs.length===6&&
    new Set(value.hubs.map(h=>h.hub_id)).size===6&&KY_HUBS.every(id=>{
      const h=value.hubs.find(row=>row.hub_id===id);
      return h?.certified_release_sha===FROZEN_SHAS[id]&&h.canonical_state_url===kySpecialistUrl(id)&&Object.keys(h.source_clocks).length>0;
    })&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status==='REJECTED'&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value===null&&
    value.expansion_ledger.ASK_GRAPH_WRITES===0&&value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED===false&&value.expansion_ledger.LOCAL_PHASE==='NO';
}
function canonical(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([key])=>!['generatedAt','generated_at','verifiedAt','verified_at'].includes(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,nested])=>`${JSON.stringify(key)}:${canonical(nested)}`).join(',')}}`;
}
export function kyPublicationSemanticFingerprint(value:unknown=manifest):string{return createHash('sha256').update(canonical(value)).digest('hex');}
export const KY_PUBLICATION_FINGERPRINT=kyPublicationSemanticFingerprint();

const CITY=/\b(louisville|lexington)\b/i;
const TOPIC=/\b(mov(?:er|ers|ing)|household.goods|contractor|dhbc|plumb|hvac|electrical|mortgage|lender|loan broker|nmls|hmda|insurance|insurer|agency|producer|adjuster|naic|npn|nursing home|assisted living|personal care|family care|home health|hospice|adult day|long.term care|senior|investment advis(?:er|or)|ria|securities|crd)\b/i;
export function kyGeography(query:string):{stateCode:string;stateName:string;city?:string;meaning:string}|undefined{
  const named=US_JURISDICTIONS.flatMap(j=>{
    const at=query.search(new RegExp(`\\b${j.name}\\b`,'i'));
    // Bare IN stays disabled here because it collides with ordinary wording. KY is accepted only in uppercase.
    const codeAt=j.code==='IN'?-1:query.search(new RegExp(`\\b${j.code}\\b`));
    return [{j,at},{j,at:codeAt}].filter(row=>row.at>=0&&(row.at===at||!['OR','ME','OK','HI','MA','ID'].includes(j.code)));
  }).sort((a,b)=>a.at-b.at);
  const softAt=query.search(/(?:in|within|state of)\s+ky\b/i);
  const city=query.match(CITY)?.[1];
  const meaning=(withCity?:string)=>withCity?`Kentucky statewide specialist research; ${withCity} is context, not a city or county page.`:'Kentucky statewide specialist research.';
  if(named.length){if(named[0].j.code!=='KY')return undefined;return {stateCode:'KY',stateName:'Kentucky',city,meaning:meaning(city)};}
  if(softAt>=0)return {stateCode:'KY',stateName:'Kentucky',city,meaning:meaning(city)};
  if(city&&TOPIC.test(query))return {stateCode:'KY',stateName:'Kentucky',city,meaning:`${city}, Kentucky. Statewide specialist research; no city or county page.`};
  return undefined;
}
export function queryLooksLikeKentucky(q:string):boolean{return kyGeography(q)?.stateCode==='KY';}
export function classifyKyHub(q:string):SpecialistHubId|undefined{
  const patterns:Array<[SpecialistHubId,RegExp]>=[
    ['move',/\b(movers?|moving|household[- ]goods|kytc|usdot|mc)\b/i],
    ['contractor',/\b(contractors?|dhbc|plumb(?:er|ing)|electric(?:al|ian)|hvac|construction licen[cs]e|general contractor)\b/i],
    ['lender',/\b(mortgage|lenders?|loan brokers?|nmls|hmda)\b/i],
    ['insurance',/\b(insur(?:ance|ers?)|agenc(?:y|ies)|producers?|adjusters?|naic|npn)\b/i],
    ['senior',/\b(nursing homes?|assisted living|personal care|family care|home health|hospice|adult day|long[- ]term care|senior|ccn)\b/i],
    ['investor',/\b(investment advis(?:er|or)|rias?|securities|broker[- ]dealers?|crd|sec)\b/i],
  ];
  return patterns.find(([,re])=>re.test(q))?.[0];
}
export type KyIdentifier={hub:SpecialistHubId;type:string;value:string;raw:string};
export function kyIdentifier(q:string):KyIdentifier|undefined{
  if(!queryLooksLikeKentucky(q))return undefined;
  const formats:Array<[SpecialistHubId,string,RegExp]>=[
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for(const [hub,type,re] of formats){const match=q.match(re);if(match)return {hub,type,value:match[1],raw:match[0]};}
  return undefined;
}
export const KY_RANKING_REFUSAL='Ask does not rank, recommend or select a Kentucky provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';
export function kyRankingAsked(q:string):boolean{return queryLooksLikeKentucky(q)&&/(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q);}
export function kyAmbiguousNumber(q:string):boolean{return !kyIdentifier(q)&&(/^\d+(?:\s+(?:Kentucky|KY))?$/i.test(q.trim())||/^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Kentucky|KY))?$/i.test(q.trim()));}
export function kyRefusal(q:string):string|undefined{
  if(kyRankingAsked(q))return KY_RANKING_REFUSAL;
  if(!queryLooksLikeKentucky(q))return undefined;
  if(kyAmbiguousNumber(q))return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if(/how many providers|how many kentucky (?:senior )?facilities|all kentucky (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|kentucky providers)/i.test(q))return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function kyCaveat(hub:SpecialistHubId,query=''):string{
  const h=manifest.hubs.find(row=>row.hub_id===hub)!;
  const gc=hub==='contractor'&&/\bgeneral contractor\b/i.test(query)?' Kentucky has no statewide general contractor license.':'';
  return `${h.capability_summary}.${gc} ${h.grain}`;
}
export function kyResearchHandoff(plan:AskResearchPlan):{hub:SpecialistHubId;href:string;label:string}|undefined{
  if(plan.requestedGeography?.stateCode!=='KY'||!plan.primaryHub||!plan.executionAllowed||
    !plan.reasonCodes.some(code=>['KENTUCKY_RESEARCH_ROUTING','EXACT_IDENTIFIER_RECOGNIZED'].includes(code)))return undefined;
  return {hub:plan.primaryHub,href:kySpecialistUrl(plan.primaryHub),label:manifest.hubs.find(row=>row.hub_id===plan.primaryHub)!.hub_name};
}
