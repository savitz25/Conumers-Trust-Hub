import 'server-only';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';

const ENDPOINTS={move:'https://www.movetrusthub.com/api/specialist-execution/v2',lender:'https://www.lendertrusthub.com/api/specialist-execution/v2'} as const;
async function post(url:string,body:unknown){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});if(!r.ok&&r.status>=500)throw new Error('specialist_unavailable');return await r.json() as Record<string,unknown>}finally{clearTimeout(timer)}}
function slugFrom(value:string){try{return new URL(value).pathname.split('/').filter(Boolean).at(-1)||''}catch{return value.split('/').filter(Boolean).at(-1)||''}}

export const specialistCustomerDirectory:CustomerProfileDirectory={async getExact(p:HandoffPayload):Promise<CustomerProfileRecord|null>{
  if(p.hub_id==='contractor') return null;
  if(p.hub_id==='move'){
    const data=await post(ENDPOINTS.move,{contract:'trusthub-specialist-execution-v2',queryType:'identifier',entityClass:'mover',identifier:{type:'USDOT',value:p.external_key}});
    const row=Array.isArray(data.rows)?data.rows[0] as Record<string,unknown>|undefined:undefined;
    const url=String(row?.canonicalProfileUrl||'');
    if(data.resultType!=='SUPPORTED_RESULTS'||Number(data.total)!==1||String(row?.usdot)!==p.external_key||slugFrom(url)!==p.slug)return null;
    return{id:p.native_profile_id,hubId:'move',slug:p.slug,displayName:String(row?.publicDisplayName||p.display_name||''),isThin:false,publicationEligible:true,homeState:(row?.recordedHq as Record<string,unknown>|undefined)?.state as string|null??null,licenseState:null,externalKey:p.external_key,sourceSystem:p.source_system,entityClass:'mover',canonicalUrl:url};
  }
  const data=await post(ENDPOINTS.lender,{contract:'trusthub-specialist-execution-v2',queryType:'identifier',identifier:{type:'NMLS',value:p.external_key}});
  const identity=data.identity as Record<string,unknown>|undefined,destination=identity?.destination as Record<string,unknown>|undefined;
  const raw=String(destination?.url||''),url=new URL(raw,'https://www.lendertrusthub.com').toString();
  if(data.resultState!=='EXACT_IDENTITY'||identity?.entityClass!=='institution'||identity?.publicationState!=='public_profile'||String(identity?.nmls)!==p.external_key||slugFrom(url)!==p.slug)return null;
  return{id:p.native_profile_id,hubId:'lender',slug:p.slug,displayName:String(identity?.displayName||p.display_name||''),isThin:false,publicationEligible:true,homeState:null,licenseState:null,externalKey:p.external_key,sourceSystem:p.source_system,entityClass:'institution',canonicalUrl:url};
}};

export function compositeCustomerDirectory(contractor:import('./adapter.ts').CthDirectory):CustomerProfileDirectory{return{async getExact(p){if(p.hub_id==='contractor'){const row=await contractor.getById(p.native_profile_id);return row?{...row,hubId:'contractor',publicationEligible:!row.isThin,entityClass:'contractor',canonicalUrl:`https://www.contractortrusthub.com/contractors/${row.slug}`}:null}return specialistCustomerDirectory.getExact(p)}}}
