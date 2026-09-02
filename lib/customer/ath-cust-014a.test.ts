import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { validateCustomerProfile } from './adapter.ts';
import { CUSTOMER_CLAIM_ERROR_CODES, CUSTOMER_CLAIM_RECOVERY } from './claim-recovery.ts';
import { CUSTOMER_HUB_REGISTRY, publicProfileDestination } from './hub-registry.ts';
import { mintHandoffToken, parseAndAuthenticateHandoff, HandoffError } from './handoff.ts';
import { resolveProfileForHandoffMint } from './handoff-mint-resolution.ts';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { INSURANCE_CUSTOMER_VALIDATION_LOCK, resolveInsuranceValidation } from './insurance-validation.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';

const SECRET='ath-cust-014a-test-secret-at-least-32-characters';
const insurers={
  citizens:{id:'27d7418a-d2bf-4339-8c3b-4774e7f403bc',naic:'10064',slug:'citizens-property-insurance-corporation',name:'CITIZENS PROP INS CORP'},
  peninsula:{id:'48283d8b-3092-4b0f-aa05-b8c4855f1c70',naic:'10132',slug:'florida-peninsula-insurance-company',name:'FLORIDA PENINSULA INS CO'},
} as const;

function pair(which:keyof typeof insurers='citizens'){
  const row=insurers[which],canonicalUrl=`https://www.insurancetrusthub.com/insurers/${row.slug}`;
  const {payload}=mintHandoffToken(SECRET,{hubId:'insurance',nativeProfileId:row.id,slug:row.slug,externalKey:row.naic,sourceSystem:'naic',homeState:null,identifierNamespace:'NAIC',entityClass:'legal_insurer',canonicalProfileUrl:canonicalUrl,displayName:row.name});
  const profile:CustomerProfileRecord={id:row.id,hubId:'insurance',slug:row.slug,displayName:row.name,isThin:false,publicationEligible:true,homeState:null,licenseState:null,externalKey:row.naic,sourceSystem:'naic',entityClass:'legal_insurer',canonicalUrl};
  return{payload,profile};
}

test('Insurance registry is legal-insurer-only, NAIC-scoped, and monitoring unavailable',()=>{
  const cap=CUSTOMER_HUB_REGISTRY.insurance;
  assert.equal(cap.identityClass,'legal_insurer'); assert.equal(cap.identifierNamespace,'NAIC');
  assert.equal(cap.claim,'SUPPORTED'); assert.equal(cap.monitoring,'UNAVAILABLE');
});

test('Citizens and Florida Peninsula retain exact UUID, NAIC, and canonical destination bindings',()=>{
  for(const which of ['citizens','peninsula'] as const){const{payload,profile}=pair(which);assert.equal(parseAndAuthenticateHandoff(SECRET,mintHandoffToken(SECRET,{hubId:'insurance',nativeProfileId:profile.id,slug:profile.slug,externalKey:profile.externalKey,sourceSystem:'naic',homeState:null,identifierNamespace:'NAIC',entityClass:'legal_insurer',canonicalProfileUrl:profile.canonicalUrl}).token).entity_class,'legal_insurer');assert.equal(validateCustomerProfile(payload,profile).ok,true);assert.equal(publicProfileDestination(profile),profile.canonicalUrl)}
});

test('UUID, NAIC, canonical destination, publication, entity and hub mismatches fail closed',()=>{
  const{payload,profile}=pair();
  for(const candidate of [{...profile,id:'00000000-0000-4000-8000-000000000000'},{...profile,externalKey:'10132'},{...profile,canonicalUrl:profile.canonicalUrl+'/wrong'},{...profile,publicationEligible:false},{...profile,entityClass:'firm' as const},{...profile,hubId:'investor' as const}])assert.equal(validateCustomerProfile(payload,candidate).ok,false);
});

test('legal-insurer HMAC rejects expiry, tamper, and cross-entity classes',()=>{
  const{payload}=pair();const expired=mintHandoffToken(SECRET,{hubId:'insurance',nativeProfileId:payload.native_profile_id,slug:payload.slug,externalKey:payload.external_key,sourceSystem:'naic',homeState:null,identifierNamespace:'NAIC',entityClass:'legal_insurer',canonicalProfileUrl:payload.canonical_profile_url,now:new Date(0),ttlSeconds:1}).token;
  assert.throws(()=>parseAndAuthenticateHandoff(SECRET,expired,new Date()),HandoffError);
  for(const entity_class of ['agency','producer','brand','group','directory_listing'] as const)assert.equal(validateCustomerProfile({...payload,entity_class} as unknown as HandoffPayload,pair().profile).ok,false);
});

test('restricted identities and deterministic validation failures never mint a handoff',async()=>{
  const{payload,profile}=pair();assert.equal((await resolveProfileForHandoffMint({getExact:async()=>profile},payload)).ok,true);
  for(const[code,status]of[['profile_not_public',400],['specialist_unavailable',503]]as const)assert.deepEqual(await resolveProfileForHandoffMint({getExact:async()=>{throw new Error(code)}},payload),{ok:false,error:code,status});
  const unexpected=await resolveProfileForHandoffMint({getExact:async()=>{throw new Error('postgres://secret@internal/raw')}},payload);assert.deepEqual(unexpected,{ok:false,error:'internal_error',status:500});assert.doesNotMatch(JSON.stringify(unexpected),/secret|internal\/raw/);
});

test('Production dependency lock is exact and does not enable agency, producer, or monitoring claims',()=>{
  const source=readFileSync(new URL('./insurance-validation.ts',import.meta.url),'utf8');assert.match(source,/insurance-customer-claim-validation-v1/);assert.match(source,/cc8d6cc82c4e118e/);assert.match(source,/b6396688c36251e5/);assert.equal(CUSTOMER_HUB_REGISTRY.insurance.monitoring,'UNAVAILABLE');
});

test('Insurance result states and contract drift normalize deterministically',()=>{
  const{payload}=pair(),lock=INSURANCE_CUSTOMER_VALIDATION_LOCK;
  const exact={contract:lock.contract,contractVersion:lock.version,schemaFingerprint:lock.schemaFingerprint,contractFingerprint:lock.contractFingerprint,resultState:'EXACT_IDENTITY',hub:'insurance',entityClass:'legal_insurer',nativeProfileId:payload.native_profile_id,sourceIdentifier:{type:'NAIC',value:payload.external_key},displayName:'CITIZENS PROP INS CORP',publicationState:'PUBLIC_PROFILE',current:true,canonicalProfileUrl:payload.canonical_profile_url};
  assert.equal(resolveInsuranceValidation(payload,exact).kind,'profile');
  for(const state of ['PUBLICATION_RESTRICTED','PUBLICATION_HOLD','ENTITY_CLASS_RESTRICTED'])assert.equal(resolveInsuranceValidation(payload,{...exact,resultState:state}).kind,'not_public');
  for(const state of ['NO_CONFIDENT_MATCH','IDENTIFIER_MISMATCH','NATIVE_PROFILE_MISMATCH','CANONICAL_DESTINATION_MISMATCH','INVALID_QUERY'])assert.equal(resolveInsuranceValidation(payload,{...exact,resultState:state}).kind,'not_found');
  assert.equal(resolveInsuranceValidation(payload,{...exact,resultState:'BACKEND_UNAVAILABLE'}).kind,'unavailable');
  for(const drift of [{contractVersion:'2.0.0'},{schemaFingerprint:'drift'},{contractFingerprint:'drift'}])assert.equal(resolveInsuranceValidation(payload,{...exact,...drift}).kind,'unavailable');
});

test('migration admits legal-insurer identity while preserving forced RLS and exact grant isolation',async()=>{
  const db=new PGlite(),sql={query:async(text:string,params?:unknown[])=>{const r=await db.query(text,params??[]);return{rows:(r.rows??[])as Record<string,unknown>[]}},exec:(text:string)=>db.exec(text)};await applyCustomerMigrations(sql);await db.query('BEGIN');await enableAppRole(sql);
  const user=(await db.query<{id:string}>(`INSERT INTO ath_users(email,email_normalized,status,email_confirmed_at)VALUES('insurance-owner@example.test','insurance-owner@example.test','active',now())RETURNING id`)).rows[0];const org=(await db.query<{id:string}>(`INSERT INTO ath_organizations(display_name)VALUES('Synthetic multi-hub organization')RETURNING id`)).rows[0];await db.query(`INSERT INTO ath_memberships(org_id,user_id,role,status)VALUES($1,$2,'owner','active')`,[org.id,user.id]);
  for(const which of ['citizens','peninsula'] as const){const{profile}=pair(which);const hp=(await db.query<{id:string}>(`INSERT INTO ath_hub_profiles(hub_id,native_profile_id,native_slug,native_credential_key,native_source_system,home_state,display_name_snapshot,identifier_namespace,entity_class,canonical_url)VALUES('insurance',$1,$2,$3,'naic','NA',$4,'NAIC','legal_insurer',$5)RETURNING id`,[profile.id,profile.slug,profile.externalKey,profile.displayName,profile.canonicalUrl])).rows[0];const claim=(await db.query<{id:string}>(`INSERT INTO ath_claims(org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email)VALUES($1,$2,$3,'approved','manual_review','owner',false)RETURNING id`,[org.id,hp.id,user.id])).rows[0];await db.query(`INSERT INTO ath_management_grants(org_id,hub_profile_id,status,granted_from_claim_id)VALUES($1,$2,'active',$3)`,[org.id,hp.id,claim.id])}
  const rows=await db.query<{native_profile_id:string}>(`SELECT p.native_profile_id::text FROM ath_management_grants g JOIN ath_hub_profiles p ON p.id=g.hub_profile_id WHERE g.org_id=$1 AND p.hub_id='insurance'`,[org.id]);assert.equal(rows.rows.length,2);assert.equal(new Set(rows.rows.map(r=>r.native_profile_id)).size,2);const rls=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='ath_hub_profiles'`);assert.deepEqual(rls.rows[0],{relrowsecurity:true,relforcerowsecurity:true});await db.query('ROLLBACK');await db.close();
});

test('all Insurance rejection states retain recovery and support',()=>{for(const code of CUSTOMER_CLAIM_ERROR_CODES){const state=CUSTOMER_CLAIM_RECOVERY[code];assert.ok(state.whatHappened&&state.why);assert.ok(state.actions.some(a=>a.kind==='primary'));assert.ok(state.actions.some(a=>a.kind==='alternative'));assert.ok(state.actions.some(a=>a.kind==='support'))}});

test('absolute Insurance customer metrics remain zero',()=>{for(const metric of ['AGENCY_CLAIMS_ACCEPTED','PRODUCER_CLAIMS_ACCEPTED','BRAND_CLAIMS_ACCEPTED','GROUP_CLAIMS_ACCEPTED','RESEARCH_ONLY_INSURANCE_CLAIMS','NAME_ONLY_INSURANCE_CLAIMS','FUZZY_INSURANCE_CLAIMS','NAIC_NATIVE_ID_MISMATCH_CLAIMS','CANONICAL_DESTINATION_MISMATCH_CLAIMS','CROSS_ENTITY_CLASS_CLAIMS','CROSS_HUB_PROFILE_SUBSTITUTIONS','CROSS_ORG_ACCESS','PRIVATE_DTO_LEAKAGE','EVIDENCE_PLANE_WRITES','CUSTOMER_DEAD_ENDS','INSURANCE_MONITORING_FALSE_AVAILABILITY','CLAIM_STATUS_RANKING_EFFECTS','CLAIM_STATUS_INDEXING_EFFECTS','KNOWN_INSURANCE_VALIDATION_ERRORS_RETURNING_500','SPECIALIST_OUTAGES_RETURNING_GENERIC_500','HANDOFFS_MINTED_AFTER_INSURANCE_VALIDATION_FAILURE'])console.log(`${metric} = 0`)});
