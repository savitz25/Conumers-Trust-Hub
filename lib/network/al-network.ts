import { createHash } from 'node:crypto';
import manifest from '../../data/network/alabama-publication-manifest.json' with { type: 'json' };
import { CANONICAL_ORIGINS, type SpecialistHubId } from './registry.ts';
import { US_JURISDICTIONS } from './us-jurisdictions.ts';
import type { AskResearchPlan } from './research-planner.ts';

export const AL_PUBLICATION_MANIFEST = manifest;
export const AL_NETWORK_CONTRACT = 'ath-al-network-release-v1';
export const AL_HUBS = ['move','contractor','lender','insurance','senior','investor'] as const;
const FROZEN_SHAS: Record<SpecialistHubId,string> = {
  move:'452a08dd8c407f4e1e87b5866e26605bee65c6fb',
  contractor:'1cda07a7d0bead85595027e3d06cb0cdddb92ede',
  lender:'4efb1efc3dcd2a3999a155d35f4591816cb27f85',
  insurance:'52a7905922ed845de9b64ba9d6cf32a6e96ef27f',
  senior:'ed144256ae717845579531bcfb682d27ab26a993',
  investor:'7f386118cea5f6868e14945fbcab09beb95a2012',
};
export function alSpecialistUrl(hub:SpecialistHubId):string{return `${CANONICAL_ORIGINS[hub]}/alabama`;}
export function alReleaseGatePassed(value=manifest):boolean{
  return value.contract===AL_NETWORK_CONTRACT&&value.release_gate.passed&&value.scope==='STATE_LEVEL_ONLY'&&
    !value.hardcoded_city_routes&&!value.hardcoded_county_routes&&value.hubs.length===6&&
    new Set(value.hubs.map(h=>h.hub_id)).size===6&&AL_HUBS.every(id=>{
      const h=value.hubs.find(row=>row.hub_id===id);
      return h?.certified_release_sha===FROZEN_SHAS[id]&&h.canonical_state_url===alSpecialistUrl(id)&&
        !/1913|1,913|1804|255,?578|1,719|1719/.test(`${h.capability_summary} ${h.grain}`);
    })&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status==='REJECTED'&&value.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value===null&&
    value.expansion_ledger.ASK_GRAPH_WRITES===0&&value.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED===false&&value.expansion_ledger.LOCAL_PHASE==='NO';
}
export function alPublicationSemanticFingerprint(value=manifest):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export const AL_PUBLICATION_FINGERPRINT = alPublicationSemanticFingerprint();
export const AL_RANKING_REFUSAL = 'Ask does not rank, recommend or select an Alabama provider winner. Best, safest, top-rated, #1, Trust Score, paid ranking and sponsored ranking are not established. Research source evidence instead.';

const CODE_SEARCH = US_JURISDICTIONS.filter(j=>!['OR','ME','OK','HI','MA','ID'].includes(j.code)).map(j=>({j,re:new RegExp(`\\b${j.code}\\b`)}));
const NAME_SEARCH = US_JURISDICTIONS.map(j=>({j,re:new RegExp(`\\b${j.name}\\b`,'i')}));
const CITY = /\b(birmingham|montgomery|huntsville|tuscaloosa)\b/i;
const MOBILE_ALABAMA = /\bmobile,?\s+alabama\b/i;
const TOPIC = /\b(movers?|moving|household goods|apsc|contractor|albgc|plumb|hvac|electric(?:al)?|mortgage|lender|loan broker|nmls|hmda|insurance|naic|npn|aldoi|nursing|assisted living|specialty care|home health|hospice|senior|ccn|adph|investment|advis[eo]r|ria|securities|crd|sec|broker)\b/i;

function namedStates(query:string){
  const found:[number,{j:(typeof US_JURISDICTIONS)[number]}][]=[];
  for(const row of NAME_SEARCH){const at=query.search(row.re);if(at>=0)found.push([at,row]);}
  for(const row of CODE_SEARCH){const at=query.search(row.re);if(at>=0)found.push([at,row]);}
  return found.sort((a,b)=>a[0]-b[0]);
}
export function alGeography(query:string):{stateCode:'AL';stateName:'Alabama';city?:string;meaning:string}|undefined{
  const named=namedStates(query);
  if(named.length&&named[0][1].j.code!=='AL')return undefined;
  const softAt=query.search(/(?:in|within|state of)\s+al\b/i);
  const city=query.match(CITY)?.[1]??(MOBILE_ALABAMA.test(query)?'Mobile':undefined);
  const base={stateCode:'AL' as const,stateName:'Alabama' as const,city,meaning:city?`${city} is context only. Ask publishes no Alabama city or county route. A principal office does not establish Alabama registration.`:'Alabama statewide research. No city or county route.'};
  if(named.length)return base;
  if(softAt>=0)return base;
  if(city&&TOPIC.test(query))return base;
  return undefined;
}
export function queryLooksLikeAlabama(query:string):boolean{return Boolean(alGeography(query));}

export function alIdentifier(query:string):{hub:SpecialistHubId;type:string;value:string;raw:string}|undefined{
  if(!queryLooksLikeAlabama(query))return undefined;
  const formats:Array<[SpecialistHubId,string,RegExp]>=[
    ['move','usdot',/\b(?:usdot|dot)\s*#?\s*(\d{5,8})\b/i],['move','mc',/\bmc\s*#?\s*(\d{4,8})\b/i],
    ['lender','nmls',/\bnmls\s*#?\s*(\d{4,12})\b/i],['insurance','naic_company_code',/\bnaic\s*#?\s*(\d{3,6})\b/i],
    ['insurance','npn',/\bnpn\s*#?\s*(\d{4,12})\b/i],['senior','cms_ccn',/\bccn\s*#?\s*(\d{6})\b/i],
    ['investor','crd',/\bcrd\s*#?\s*(\d+)\b/i],['investor','sec_file_number',/\bsec\s*(?:file|number)?\s*#?\s*(\d{3}-\d+)\b/i],
  ];
  for(const [hub,type,re] of formats){const match=query.match(re);if(match)return {hub,type,value:match[1],raw:match[0]};}
  return undefined;
}
export function classifyAlHub(query:string):SpecialistHubId|undefined{
  if(!queryLooksLikeAlabama(query))return undefined;
  if(/\b(movers?|moving|household goods|apsc|usdot|mc\s*#?)\b/i.test(query))return 'move';
  if(/\b(contractor|albgc|plumb|hvac|electric(?:al)?)\b/i.test(query))return 'contractor';
  if(/\b(mortgage|lender|loan broker|nmls|hmda)\b/i.test(query))return 'lender';
  if(/\b(insurance|naic|npn|aldoi)\b/i.test(query))return 'insurance';
  if(/\b(nursing|assisted living|specialty care|home health|hospice|senior|ccn|adph)\b/i.test(query))return 'senior';
  if(/\b(investment|advis[eo]r|ria|securities|crd|sec|broker)\b/i.test(query))return 'investor';
  return undefined;
}
export function alRankingAsked(q:string):boolean{return queryLooksLikeAlabama(q)&&/(?:\b(best|safest|recommend(?:ed)?|(?:top|highest)[-\s]+rated|number\s+one|most\s+(?:trustworthy|trusted)|trust\s+score|AggregateRating|ratingValue|(?:paid|sponsored)\s+ranking)\b|#1\b)/i.test(q);}
export function alAmbiguousNumber(q:string):boolean{return !alIdentifier(q)&&(/^\d+(?:\s+(?:Alabama|AL))?$/i.test(q.trim())||/^(?:license|credential)\s*#?\s*\d+(?:\s+(?:Alabama|AL))?$/i.test(q.trim()));}
export function alRefusal(q:string):string|undefined{
  if(alRankingAsked(q))return AL_RANKING_REFUSAL;
  if(!queryLooksLikeAlabama(q))return undefined;
  if(alAmbiguousNumber(q))return 'A bare number or unqualified license is ambiguous. Supply its identifier family; Ask will not search the number as a company name.';
  if(/how many providers|all alabama (?:businesses|facilities|companies)|combined.*total|total.*(?:hubs|alabama providers)/i.test(q))return 'CROSS_HUB_RECORD_TOTAL is REJECTED; value is null. Unlike specialist source grains cannot be summed.';
  return undefined;
}
export function alCaveat(hub:SpecialistHubId,query=''):string{
  const h=manifest.hubs.find(row=>row.hub_id===hub)!;
  const plumbing=hub==='contractor'&&/\bplumb/i.test(query)?' HBLB person licenses were not acquired.':'';
  return `${h.capability_summary}.${plumbing} ${h.grain}`;
}
export function alResearchHandoff(plan:AskResearchPlan):{hub:SpecialistHubId;href:string;label:string}|undefined{
  if(plan.requestedGeography?.stateCode!=='AL'||!plan.primaryHub||!plan.executionAllowed||
    !plan.reasonCodes.some(code=>['ALABAMA_RESEARCH_ROUTING','EXACT_IDENTIFIER_RECOGNIZED'].includes(code)))return undefined;
  return {hub:plan.primaryHub,href:alSpecialistUrl(plan.primaryHub),label:manifest.hubs.find(row=>row.hub_id===plan.primaryHub)!.hub_name};
}
