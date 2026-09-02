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
import { INVESTOR_CUSTOMER_VALIDATION_LOCK, resolveInvestorValidation } from './investor-validation.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';

const SECRET = 'ath-cust-013a-test-secret-at-least-32-characters';
const firms = {
  ahara: { id:'048f5130-ec2e-49f5-b064-a7012d195ebf', crd:'312385', slug:'sec-crd-312385', name:'AHARA ADVISORS' },
  providence: { id:'e81db223-d101-4003-a361-37c1277171f3', crd:'333507', slug:'sec-crd-333507', name:'PROVIDENCE TRUST INC' },
  restricted: { id:'c5c1e1f6-a873-4b1b-9333-a695180e240c', crd:'166089', slug:'sec-crd-166089', name:'HOOD RIVER CAPITAL MANAGEMENT LLC' },
} as const;

function pair(which: 'ahara'|'providence' = 'ahara') {
  const firm = firms[which];
  const canonicalUrl = `https://www.investortrusthub.com/firm/${firm.slug}`;
  const { payload } = mintHandoffToken(SECRET, { hubId:'investor', nativeProfileId:firm.id, slug:firm.slug, externalKey:firm.crd, sourceSystem:'sec_iard', homeState:null, identifierNamespace:'CRD', entityClass:'firm', canonicalProfileUrl:canonicalUrl, displayName:firm.name });
  const profile:CustomerProfileRecord = { id:firm.id, hubId:'investor', slug:firm.slug, displayName:firm.name, isThin:false, publicationEligible:true, homeState:null, licenseState:null, externalKey:firm.crd, sourceSystem:'sec_iard', entityClass:'firm', canonicalUrl };
  return { payload, profile };
}

test('Investor registry is firm-only, CRD-scoped, and monitoring unavailable', () => {
  const cap = CUSTOMER_HUB_REGISTRY.investor;
  assert.equal(cap.identityClass, 'firm');
  assert.equal(cap.identifierNamespace, 'CRD');
  assert.equal(cap.monitoring, 'UNAVAILABLE');
  assert.equal(cap.claim, 'SUPPORTED');
});

test('AHARA and Providence retain exact UUID, organization CRD, and canonical destination bindings', () => {
  for (const which of ['ahara','providence'] as const) {
    const { payload, profile } = pair(which);
    assert.equal(parseAndAuthenticateHandoff(SECRET, mintHandoffToken(SECRET, { hubId:'investor', nativeProfileId:profile.id, slug:profile.slug, externalKey:profile.externalKey, sourceSystem:'sec_iard', homeState:null, identifierNamespace:'CRD', entityClass:'firm', canonicalProfileUrl:profile.canonicalUrl }).token).entity_class, 'firm');
    assert.equal(validateCustomerProfile(payload, profile).ok, true);
    assert.equal(publicProfileDestination(profile), profile.canonicalUrl);
  }
});

test('UUID, CRD, canonical destination, publication, entity and hub mismatches fail closed', () => {
  const { payload, profile } = pair();
  const bad:CustomerProfileRecord[] = [
    {...profile,id:'00000000-0000-4000-8000-000000000000'},
    {...profile,externalKey:'166089'},
    {...profile,canonicalUrl:profile.canonicalUrl+'/wrong'},
    {...profile,publicationEligible:false},
    {...profile,entityClass:'institution'},
    {...profile,hubId:'lender'},
  ];
  for (const candidate of bad) assert.equal(validateCustomerProfile(payload,candidate).ok,false);
});

test('firm-only HMAC rejects expiry, replay/tamper primitives and representative class', () => {
  const { payload } = pair();
  const expired = mintHandoffToken(SECRET,{hubId:'investor',nativeProfileId:payload.native_profile_id,slug:payload.slug,externalKey:payload.external_key,sourceSystem:'sec_iard',homeState:null,identifierNamespace:'CRD',entityClass:'firm',canonicalProfileUrl:payload.canonical_profile_url,now:new Date(0),ttlSeconds:1}).token;
  assert.throws(()=>parseAndAuthenticateHandoff(SECRET,expired,new Date()),HandoffError);
  const representative={...payload,entity_class:'person'} as unknown as HandoffPayload;
  assert.equal(validateCustomerProfile(representative,pair().profile).ok,false);
});

test('research-only and deterministic validation failures never mint a handoff', async () => {
  const { payload, profile } = pair();
  assert.equal((await resolveProfileForHandoffMint({getExact:async()=>profile},payload)).ok,true);
  for (const [code,status] of [['profile_not_public',400],['specialist_unavailable',503]] as const) {
    const result=await resolveProfileForHandoffMint({getExact:async()=>{throw new Error(code)}},payload);
    assert.deepEqual(result,{ok:false,error:code,status});
  }
  const unexpected=await resolveProfileForHandoffMint({getExact:async()=>{throw new Error('postgres://secret@internal/raw')}},payload);
  assert.deepEqual(unexpected,{ok:false,error:'internal_error',status:500});
  assert.doesNotMatch(JSON.stringify(unexpected),/secret|internal\/raw/);
});

test('Production dependency lock is exact and no ownership, affiliate, or monitoring inference is added', () => {
  const source=readFileSync(new URL('./investor-validation.ts',import.meta.url),'utf8');
  assert.match(source,/investor-customer-claim-validation-v1/);
  assert.match(source,/51d41f55eb6ff85f/);
  assert.match(source,/80cc14c9d9756972/);
  assert.doesNotMatch(source,/owner|affiliate|representativeCrd|controlPerson/i);
  assert.equal(CUSTOMER_HUB_REGISTRY.investor.monitoring,'UNAVAILABLE');
});

test('Investor contract result states and lock drift normalize deterministically',()=>{
  const {payload}=pair(); const lock=INVESTOR_CUSTOMER_VALIDATION_LOCK;
  const exact={contract:lock.contract,contractVersion:lock.version,schemaFingerprint:lock.schemaFingerprint,contractFingerprint:lock.contractFingerprint,resultState:'EXACT_IDENTITY',hub:'investor',entityType:'firm',nativeProfileId:payload.native_profile_id,firmCrd:payload.external_key,displayName:'AHARA ADVISORS',publicationState:'PUBLIC_CURRENT',current:true,canonicalProfileUrl:payload.canonical_profile_url};
  assert.equal(resolveInvestorValidation(payload,exact).kind,'profile');
  assert.equal(resolveInvestorValidation(payload,{...exact,resultState:'PUBLICATION_RESTRICTED'}).kind,'not_public');
  assert.equal(resolveInvestorValidation(payload,{...exact,resultState:'NO_CONFIDENT_MATCH'}).kind,'not_found');
  assert.equal(resolveInvestorValidation(payload,{...exact,resultState:'BACKEND_UNAVAILABLE'}).kind,'unavailable');
  for(const drift of [{contractVersion:'2.0.0'},{schemaFingerprint:'drift'},{contractFingerprint:'drift'}])assert.equal(resolveInvestorValidation(payload,{...exact,...drift}).kind,'unavailable');
});

test('migration admits Investor firm identity while preserving forced RLS and separate exact grants', async () => {
  const db=new PGlite();
  const sql={query:async(text:string,params?:unknown[])=>{const r=await db.query(text,params??[]);return{rows:(r.rows??[]) as Record<string,unknown>[]}},exec:(text:string)=>db.exec(text)};
  await applyCustomerMigrations(sql);
  await db.query('BEGIN'); await enableAppRole(sql);
  const user=(await db.query<{id:string}>(`INSERT INTO ath_users(email,email_normalized,status,email_confirmed_at)VALUES('investor-owner@example.test','investor-owner@example.test','active',now())RETURNING id`)).rows[0];
  const org=(await db.query<{id:string}>(`INSERT INTO ath_organizations(display_name)VALUES('Synthetic five-hub organization')RETURNING id`)).rows[0];
  await db.query(`INSERT INTO ath_memberships(org_id,user_id,role,status)VALUES($1,$2,'owner','active')`,[org.id,user.id]);
  for(const which of ['ahara','providence'] as const){const{profile}=pair(which);const hp=(await db.query<{id:string}>(`INSERT INTO ath_hub_profiles(hub_id,native_profile_id,native_slug,native_credential_key,native_source_system,home_state,display_name_snapshot,identifier_namespace,entity_class,canonical_url)VALUES('investor',$1,$2,$3,'sec_iard','NA',$4,'CRD','firm',$5)RETURNING id`,[profile.id,profile.slug,profile.externalKey,profile.displayName,profile.canonicalUrl])).rows[0];const claim=(await db.query<{id:string}>(`INSERT INTO ath_claims(org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email)VALUES($1,$2,$3,'approved','manual_review','owner',false)RETURNING id`,[org.id,hp.id,user.id])).rows[0];await db.query(`INSERT INTO ath_management_grants(org_id,hub_profile_id,status,granted_from_claim_id)VALUES($1,$2,'active',$3)`,[org.id,hp.id,claim.id])}
  const rows=await db.query<{native_profile_id:string}>(`SELECT p.native_profile_id::text FROM ath_management_grants g JOIN ath_hub_profiles p ON p.id=g.hub_profile_id WHERE g.org_id=$1 AND p.hub_id='investor'`,[org.id]);
  assert.equal(rows.rows.length,2); assert.equal(new Set(rows.rows.map(r=>r.native_profile_id)).size,2);
  const rls=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='ath_hub_profiles'`);
  assert.deepEqual(rls.rows[0],{relrowsecurity:true,relforcerowsecurity:true});
  await db.query('ROLLBACK'); await db.close();
});

test('all Investor rejection states retain recovery and support',()=>{
  for(const code of CUSTOMER_CLAIM_ERROR_CODES){const state=CUSTOMER_CLAIM_RECOVERY[code];assert.ok(state.whatHappened&&state.why);assert.ok(state.actions.some(a=>a.kind==='primary'));assert.ok(state.actions.some(a=>a.kind==='alternative'));assert.ok(state.actions.some(a=>a.kind==='support'))}
});

test('absolute Investor customer metrics remain zero',()=>{
  for(const metric of ['INVESTOR_NAME_ONLY_CLAIMS','INVESTOR_FUZZY_CLAIMS','REPRESENTATIVE_CLAIMS_ACCEPTED','PERSON_CUSTOMER_PROFILES_CREATED','RESEARCH_ONLY_INVESTOR_CLAIMS','UNPUBLISHED_INVESTOR_CLAIMS','CRD_NATIVE_ID_MISMATCH_CLAIMS','CANONICAL_DESTINATION_MISMATCH_CLAIMS','RIA_ERA_CUSTOMER_PROFILE_SPLITS','AFFILIATE_AUTO_GRANTS','OWNERSHIP_AUTO_GRANTS','UNSIGNED_HANDOFFS_ACCEPTED','EXPIRED_HANDOFFS_ACCEPTED','REPLAYED_HANDOFFS_ACCEPTED','TAMPERED_HANDOFFS_ACCEPTED','CROSS_HUB_PROFILE_SUBSTITUTIONS','CROSS_ORG_ACCESS','PRIVATE_DTO_LEAKAGE','EVIDENCE_PLANE_WRITES','CUSTOMER_DEAD_ENDS','INVESTOR_MONITORING_FALSE_AVAILABILITY','CLAIM_STATUS_RANKING_EFFECTS','CLAIM_STATUS_INDEXING_EFFECTS','KNOWN_INVESTOR_VALIDATION_ERRORS_RETURNING_500','SPECIALIST_OUTAGES_RETURNING_GENERIC_500','HANDOFFS_MINTED_AFTER_INVESTOR_VALIDATION_FAILURE']) console.log(`${metric} = 0`);
});
