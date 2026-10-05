import { createHash } from 'node:crypto';
import manifest from '../../data/network/south-carolina-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const SC_PUBLICATION_MANIFEST = manifest;
export const SC_NETWORK_CONTRACT = 'ath-sc-network-release-v1';
export const SC_HUBS = ['move','contractor','lender','insurance','senior','investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId,string> = {
  move:'5d45bdeff0ac4b971a7946b1bf87732168265ac2',
  contractor:'25dbabf51419b09463da9296ce528034a02b0f2a',
  lender:'933b747361fced30b53d1690c4cc919420e7e0df',
  insurance:'1d5118251ad000dc7a271ed275f7ce65c687cbcb',
  senior:'45e23fd5a127ecb72bc3cbb9e0aca87a09db7f71',
  investor:'c53b4d4dd6d83eee0e9210b2bd34d3b0edbd0bfe',
};
const FALSE_PUBLIC_CLAIM = /49,?355|23,?796|73,?151|\b153\b|\b123\b|2,?400|2,?336|\b111\b|-1,?403|2,?509|2,?512|2,?546|\b1,?912\b/;
export function scSpecialistUrl(hub:SpecialistHubId):string{return `${CANONICAL_ORIGINS[hub]}/south-carolina`;}
export function scReleaseGatePassed(value=manifest):boolean{
  return value.contract===SC_NETWORK_CONTRACT&&value.release_gate.passed&&value.scope==='STATE_LEVEL_ONLY'&&
    !value.hardcoded_city_routes&&!value.hardcoded_county_routes&&value.hubs.length===6&&
    new Set(value.hubs.map(h=>h.hub_id)).size===6&&SC_HUBS.every(id=>{
      const h=value.hubs.find(row=>row.hub_id===id);
      return h?.certified_release_sha===FROZEN_SHAS[id]&&h.canonical_state_url===scSpecialistUrl(id)&&
        !FALSE_PUBLIC_CLAIM.test(`${h.capability_summary} ${h.grain}`);
    })&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status==='REJECTED'&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value===null&&
    value.expansion_ledger.ASK_GRAPH_WRITES===0&&value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED===false&&value.expansion_ledger.LOCAL_PHASE==='NO';
}
export function scPublicationSemanticFingerprint(value=manifest):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export const SC_PUBLICATION_FINGERPRINT = scPublicationSemanticFingerprint();
export const SC_RANKING_REFUSAL = 'Ask does not rank, recommend or select a South Carolina provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';

const CODE_SEARCH = US_JURISDICTIONS.filter(j=>!['OR','ME','OK','HI','MA','ID','IN'].includes(j.code)).map(j=>({j,re:new RegExp(`\\b${j.code}\\b`)}));
const NAME_SEARCH = US_JURISDICTIONS.map(j=>({j,re:new RegExp(`\\b${j.name}\\b`,'i')}));
const CITY = /\b(charleston|columbia|greenville)\b/i;

function namedStates(query:string){
  const found:[number,{j:(typeof US_JURISDICTIONS)[number]}][]=[];
  for(const row of NAME_SEARCH){const at=query.search(row.re);if(at>=0)found.push([at,row]);}
  for(const row of CODE_SEARCH){const at=query.search(row.re);if(at>=0)found.push([at,row]);}
  return found.sort((a,b)=>a[0]-b[0]);
}
export function scGeography(query:string):{stateCode:'SC';stateName:'South Carolina';city?:string;meaning:string}|undefined{
  const named=namedStates(query);
  if(named.length&&named[0][1].j.code!=='SC')return undefined;
  const softAt=query.search(/(?:in|within|state of)\s+sc\b/i);
  if(!named.length&&softAt<0)return undefined;
  const city=query.match(CITY)?.[1];
  const base={stateCode:'SC' as const,stateName:'South Carolina' as const,city,meaning:city?`${city} is context only. Ask publishes no South Carolina city or county route. A principal office does not establish South Carolina registration.`:'South Carolina statewide research. No city or county route.'};
  return base;
}
export function queryLooksLikeSouthCarolina(query:string):boolean{return Boolean(scGeography(query));}

export function scIdentifier(query:string):{hub:SpecialistHubId;type:string;value:string;raw:string}|undefined{
  if(!queryLooksLikeSouthCarolina(query))return undefined;
  const formats:Array<[SpecialistHubId,string,RegExp]>=[
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for(const [hub,type,re] of formats){const match=query.match(re);if(match)return {hub,type,value:match[1],raw:match[0]};}
  return undefined;
}
export function classifyScHub(query:string):SpecialistHubId|undefined{
  if(!queryLooksLikeSouthCarolina(query))return undefined;
  if(/\b(movers?|moving|household goods|class e|ors|psc|usdot|mc\s*#?)\b/i.test(query))return 'move';
  if(/\b(contractor|llr|home builder|plumb|hvac|electric(?:al)?)\b/i.test(query))return 'contractor';
  if(/\b(mortgage|lender|servicer|sc-bfi|nmls|hmda)\b/i.test(query))return 'lender';
  if(/\b(insurance|doi|naic|npn|surplus|captive)\b/i.test(query))return 'insurance';
  if(/\b(nursing|community residential|assisted living|crcf|home health|hospice|adult day|in-home|senior|dph|ccn)\b/i.test(query))return 'senior';
  if(/\b(investment|advis[eo]r|ria|securities|crd|sec|broker|era)\b/i.test(query))return 'investor';
  return undefined;
}
export function scRankingAsked(q:string):boolean{return queryLooksLikeSouthCarolina(q)&&/(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q);}
export function scAmbiguousNumber(q:string):boolean{return !scIdentifier(q)&&(/^\d+(?:\s+(?:South Carolina|SC))?$/i.test(q.trim())||/^(?:license|credential)\s*#?\s*\d+(?:\s+(?:South Carolina|SC))?$/i.test(q.trim()));}
export function scRefusal(q:string):string|undefined{
  if(scRankingAsked(q))return SC_RANKING_REFUSAL;
  if(!queryLooksLikeSouthCarolina(q))return undefined;
  if(scAmbiguousNumber(q))return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if(/how many providers|all south carolina (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|south carolina providers)/i.test(q))return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function scCaveat(hub:SpecialistHubId,query=''):string{
  const h=manifest.hubs.find(row=>row.hub_id===hub)!;
  const assisted=hub==='senior'&&/\bassisted living\b/i.test(query)?' Community Residential Care Facility may be marketed as assisted living. It is not an assisted-living census.':'';
  return `${h.capability_summary}.${assisted} ${h.grain}`;
}
export function scResearchHandoff(plan:AskResearchPlan):{hub:SpecialistHubId;href:string;label:string}|undefined{
  if(plan.requestedGeography?.stateCode!=='SC'||!plan.primaryHub||!plan.executionAllowed||
    !plan.reasonCodes.some(code=>['SOUTH_CAROLINA_RESEARCH_ROUTING','EXACT_IDENTIFIER_RECOGNIZED'].includes(code)))return undefined;
  return {hub:plan.primaryHub,href:scSpecialistUrl(plan.primaryHub),label:manifest.hubs.find(row=>row.hub_id===plan.primaryHub)!.hub_name};
}
