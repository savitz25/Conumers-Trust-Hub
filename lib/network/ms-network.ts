import { createHash } from 'node:crypto';
import manifest from '../../data/network/mississippi-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const MS_PUBLICATION_MANIFEST = manifest;
export const MS_NETWORK_CONTRACT = 'ath-ms-network-release-v1';
export const MS_HUBS = ['move','contractor','lender','insurance','senior','investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId,string> = {
  move:'37c925e077232170c4ee67ff0cf26608d8afe260',
  contractor:'ea0e165bd579c2ca3f529c0eb79ab45ad538d2ff',
  lender:'05206d912c2a58b242c97334664f4650a60f34cd',
  insurance:'228dd8ced67bad4e48d0e1c3cdebef2a32bde1f9',
  senior:'2888dac858d794c3c240caf5ee9a78309ea05177',
  investor:'ca3be460e8279b0ad9ec8f05893a17eb3570b33e',
};
const FALSE_PUBLIC_CLAIM = /12,?774|38,?709|\b1,?304\b|AggregateRating|Trust Score/;
export function msSpecialistUrl(hub:SpecialistHubId):string{return `${CANONICAL_ORIGINS[hub]}/mississippi`;}
export function msReleaseGatePassed(value=manifest):boolean{
  return value.contract===MS_NETWORK_CONTRACT&&value.release_gate.passed&&value.scope==='STATE_LEVEL_ONLY'&&
    !value.hardcoded_city_routes&&!value.hardcoded_county_routes&&value.hubs.length===6&&
    new Set(value.hubs.map(h=>h.hub_id)).size===6&&MS_HUBS.every(id=>{
      const h=value.hubs.find(row=>row.hub_id===id);
      return h?.certified_release_sha===FROZEN_SHAS[id]&&h.canonical_state_url===msSpecialistUrl(id)&&
        !FALSE_PUBLIC_CLAIM.test(`${h.capability_summary} ${h.grain}`);
    })&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status==='REJECTED'&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value===null&&
    value.expansion_ledger.ASK_GRAPH_WRITES===0&&value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED===false&&value.expansion_ledger.LOCAL_PHASE==='NO';
}
export function msPublicationSemanticFingerprint(value=manifest):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export const MS_PUBLICATION_FINGERPRINT = msPublicationSemanticFingerprint();
export const MS_RANKING_REFUSAL = 'Ask does not rank, recommend or select a Mississippi provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';

const CODE_SEARCH = US_JURISDICTIONS.filter(j=>!['OR','ME','OK','HI','MA','ID','IN'].includes(j.code)).map(j=>({j,re:new RegExp(`\\b${j.code}\\b`)}));
const NAME_SEARCH = US_JURISDICTIONS.map(j=>({j,re:new RegExp(`\\b${j.name}\\b`,'i')}));
const CITY = /\b(jackson|gulfport|biloxi)\b/i;

function namedStates(query:string){
  const found:[number,{j:(typeof US_JURISDICTIONS)[number]}][]=[];
  for(const row of NAME_SEARCH){const at=query.search(row.re);if(at>=0)found.push([at,row]);}
  for(const row of CODE_SEARCH){const at=query.search(row.re);if(at>=0)found.push([at,row]);}
  return found.sort((a,b)=>a[0]-b[0]);
}
export function msGeography(query:string):{stateCode:'MS';stateName:'Mississippi';city?:string;meaning:string}|undefined{
  if(/\bmissouri\b/i.test(query)&&!/\bmississippi\b/i.test(query))return undefined;
  const named=namedStates(query);
  if(named.length&&named[0][1].j.code!=='MS')return undefined;
  const softAt=query.search(/(?:in|within|state of)\s+ms\b/i);
  if(!named.length&&softAt<0)return undefined;
  const city=query.match(CITY)?.[1];
  const base={stateCode:'MS' as const,stateName:'Mississippi' as const,city,meaning:city?`${city} is context only. Ask publishes no Mississippi city or county route. A principal office does not establish Mississippi registration.`:'Mississippi statewide research. No city or county route.'};
  return base;
}
export function queryLooksLikeMississippi(query:string):boolean{return Boolean(msGeography(query));}

export function msIdentifier(query:string):{hub:SpecialistHubId;type:string;value:string;raw:string}|undefined{
  if(!queryLooksLikeMississippi(query))return undefined;
  const formats:Array<[SpecialistHubId,string,RegExp]>=[
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for(const [hub,type,re] of formats){const match=query.match(re);if(match)return {hub,type,value:match[1],raw:match[0]};}
  return undefined;
}
export function classifyMsHub(query:string):SpecialistHubId|undefined{
  if(!queryLooksLikeMississippi(query))return undefined;
  if(/\b(movers?|moving|household goods|mdot|usdot|mc\s*#?)\b/i.test(query))return 'move';
  if(/\b(contractor|msboc|home builder|plumb|hvac|electric(?:al)?)\b/i.test(query))return 'contractor';
  if(/\b(mortgage|lender|servicer|dbcf|nmls|hmda)\b/i.test(query))return 'lender';
  if(/\b(insurance|mid|naic|npn|surplus)\b/i.test(query))return 'insurance';
  if(/\b(nursing|personal care|assisted living|home health|hospice|icf|senior|msdh|ccn)\b/i.test(query))return 'senior';
  if(/\b(investment|advis[eo]r|ria|securities|crd|sec|broker|era)\b/i.test(query))return 'investor';
  return undefined;
}
export function msRankingAsked(q:string):boolean{return queryLooksLikeMississippi(q)&&/(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q);}
export function msAmbiguousNumber(q:string):boolean{return !msIdentifier(q)&&(/^\d+(?:\s+(?:Mississippi|MS))?$/i.test(q.trim())||/^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Mississippi|MS))?$/i.test(q.trim()));}
export function msRefusal(q:string):string|undefined{
  if(msRankingAsked(q))return MS_RANKING_REFUSAL;
  if(!queryLooksLikeMississippi(q))return undefined;
  if(msAmbiguousNumber(q))return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if(/how many providers|all mississippi (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|mississippi providers)/i.test(q))return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function msCaveat(hub:SpecialistHubId,query=''):string{
  const h=manifest.hubs.find(row=>row.hub_id===hub)!;
  const assisted=hub==='senior'&&/\bassisted living\b/i.test(query)?' Personal care is the Mississippi facility class. It is not an assisted-living census.':'';
  return `${h.capability_summary}.${assisted} ${h.grain}`;
}
export function msResearchHandoff(plan:AskResearchPlan):{hub:SpecialistHubId;href:string;label:string}|undefined{
  if(plan.requestedGeography?.stateCode!=='MS'||!plan.primaryHub||!plan.executionAllowed||
    !plan.reasonCodes.some(code=>['MISSISSIPPI_RESEARCH_ROUTING','EXACT_IDENTIFIER_RECOGNIZED'].includes(code)))return undefined;
  return {hub:plan.primaryHub,href:msSpecialistUrl(plan.primaryHub),label:manifest.hubs.find(row=>row.hub_id===plan.primaryHub)!.hub_name};
}
