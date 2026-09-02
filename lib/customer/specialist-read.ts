import 'server-only';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';
import { INVESTOR_CUSTOMER_VALIDATION_LOCK, resolveInvestorValidation } from './investor-validation.ts';
import { INSURANCE_CUSTOMER_VALIDATION_LOCK, resolveInsuranceValidation } from './insurance-validation.ts';

const ENDPOINTS={move:'https://www.movetrusthub.com/api/specialist-execution/v2',lender:'https://www.lendertrusthub.com/api/specialist-execution/v2',senior:'https://www.seniortrusthub.com/api/customer-profile-validation/v1',investor:'https://www.investortrusthub.com/api/customer-claim-validation/v1',insurance:'https://www.insurancetrusthub.com/api/customer-claim-validation/v1'} as const;
async function post(url:string,body:unknown){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});if(!r.ok&&r.status>=500)throw new Error('specialist_unavailable');return await r.json() as Record<string,unknown>}catch(error){if(error instanceof Error&&(error.name==='AbortError'||error instanceof TypeError))throw new Error('specialist_unavailable');throw error}finally{clearTimeout(timer)}}
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
  if(p.hub_id==='senior'){
    if(!p.provider_class||!p.canonical_profile_url) return null;
    const data=await post(ENDPOINTS.senior,{providerClass:p.provider_class,cmsCcn:p.external_key,nativeProfileId:p.native_profile_id,canonicalProfileUrl:p.canonical_profile_url});
    if(data.status==='rejected'){
      const code=String(data.errorCode||'');
      if(code==='historical_profile')throw new Error('historical_profile');
      if(code==='profile_not_public'||code==='publication_hold')throw new Error('profile_not_public');
      if(code==='backend_unavailable')throw new Error('specialist_unavailable');
      return null;
    }
    if(data.contract!=='senior-customer-profile-validation-v1'||data.contractVersion!=='1.0.0'||data.schemaFingerprint!=='f207e69d07f0a9cf660f514219908e0848af4fc270c1dcef151f24b8a1022cf1'||data.contractFingerprint!=='cf0475d70df34de062bf66bd189810e6c79cb99e994a8047dd4896065b0a9798')throw new Error('specialist_unavailable');
    if(data.providerClass!==p.provider_class||data.nativeProfileId!==p.native_profile_id||data.cmsCcn!==p.external_key||data.publicationState!=='public'||data.current!==true||data.canonicalProfileUrl!==p.canonical_profile_url)return null;
    return{id:p.native_profile_id,hubId:'senior',slug:p.slug,displayName:String(data.displayName||p.display_name||''),isThin:false,publicationEligible:true,homeState:null,licenseState:null,externalKey:p.external_key,sourceSystem:p.source_system,entityClass:p.provider_class,canonicalUrl:p.canonical_profile_url};
  }
  if(p.hub_id==='investor'){
    if(p.entity_class!=='firm'||!p.canonical_profile_url) return null;
    const lock=INVESTOR_CUSTOMER_VALIDATION_LOCK;
    const data=await post(ENDPOINTS.investor,{contract:lock.contract,entityType:'firm',nativeProfileId:p.native_profile_id,firmCrd:p.external_key,canonicalProfileUrl:p.canonical_profile_url});
    const resolved=resolveInvestorValidation(p,data);
    if(resolved.kind==='unavailable')throw new Error('specialist_unavailable');
    if(resolved.kind==='not_public')throw new Error('profile_not_public');
    return resolved.kind==='profile'?resolved.profile:null;
  }
  if(p.hub_id==='insurance'){
    if(p.entity_class!=='legal_insurer'||!p.canonical_profile_url) return null;
    const lock=INSURANCE_CUSTOMER_VALIDATION_LOCK;
    const data=await post(ENDPOINTS.insurance,{contract:lock.contract,entityClass:'legal_insurer',nativeProfileId:p.native_profile_id,naicCode:p.external_key,canonicalProfileUrl:p.canonical_profile_url});
    const resolved=resolveInsuranceValidation(p,data);
    if(resolved.kind==='unavailable')throw new Error('specialist_unavailable');
    if(resolved.kind==='not_public')throw new Error('profile_not_public');
    return resolved.kind==='profile'?resolved.profile:null;
  }
  const data=await post(ENDPOINTS.lender,{contract:'trusthub-specialist-execution-v2',queryType:'identifier',identifier:{type:'NMLS',value:p.external_key}});
  const identity=data.identity as Record<string,unknown>|undefined,destination=identity?.destination as Record<string,unknown>|undefined;
  const raw=String(destination?.url||''),url=new URL(raw,'https://www.lendertrusthub.com').toString();
  if(data.resultState!=='EXACT_IDENTITY'||identity?.entityClass!=='institution'||identity?.publicationState!=='public_profile'||String(identity?.nmls)!==p.external_key||slugFrom(url)!==p.slug)return null;
  return{id:p.native_profile_id,hubId:'lender',slug:p.slug,displayName:String(identity?.displayName||p.display_name||''),isThin:false,publicationEligible:true,homeState:null,licenseState:null,externalKey:p.external_key,sourceSystem:p.source_system,entityClass:'institution',canonicalUrl:url};
}};

export function compositeCustomerDirectory(contractor:import('./adapter.ts').CthDirectory):CustomerProfileDirectory{return{async getExact(p){if(p.hub_id==='contractor'){const row=await contractor.getById(p.native_profile_id);return row?{...row,hubId:'contractor',publicationEligible:!row.isThin,entityClass:'contractor',canonicalUrl:`https://www.contractortrusthub.com/contractors/${row.slug}`}:null}return specialistCustomerDirectory.getExact(p)}}}
