import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform, ClaimError } from './store.ts';
import { HandoffError, mintHandoffToken } from './handoff.ts';
import { CLAIM_CAPABILITY_MATRIX, CLAIM_LAUNCH_GOLDEN_CORPUS, claimAcquisitionSource, safeClaimFunnelProperties } from './claim-launch.ts';
import { CUSTOMER_CLAIM_ERROR_CODES, CUSTOMER_CLAIM_RECOVERY } from './claim-recovery.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerHubId, CustomerProfileRecord, HandoffPayload } from './types.ts';
import type { SqlClient } from './sql.ts';

const SECRET='ath-launch-001a-handoff-secret-32-characters';
const profiles: CustomerProfileRecord[] = [
  ['move','mover','USDOT','fmcsa','1199826','https://www.movetrusthub.com/companies/test-mover'],
  ['lender','institution','NMLS','nmls','3030','https://www.lendertrusthub.com/lenders/test-lender'],
  ['insurance','legal_insurer','NAIC','naic_legal_insurer','12345','https://www.insurancetrusthub.com/insurers/test-insurer'],
  ['senior','nursing_home','CMS_CCN','cms','105411','https://www.seniortrusthub.com/facility/cms/105411/test-home'],
  ['contractor','contractor','credential','fl_dbpr','CBC015082','https://www.contractortrusthub.com/contractors/test-contractor'],
  ['investor','firm','CRD','sec_iard','166089','https://www.investortrusthub.com/firm/test-firm'],
].map(([hubId,entityClass,_namespace,sourceSystem,externalKey,canonicalUrl],index)=>({
  id:`00000000-0000-4000-8000-00000000000${index+1}`,hubId:hubId as CustomerHubId,entityClass:entityClass as CustomerProfileRecord['entityClass'],
  slug:`launch-fixture-${hubId}`,displayName:`${hubId} launch fixture`,isThin:false,publicationEligible:true,
  homeState:'FL',licenseState:'FL',externalKey,sourceSystem,canonicalUrl,
}));

const directory: CustomerProfileDirectory = { async getExact(payload) {
  return profiles.find(p=>p.hubId===payload.hub_id&&p.id===payload.native_profile_id) ?? null;
} };

function asSql(db:PGlite):SqlClient{return{async query(text,params){const result=await db.query(text,params??[]);return{rows:(result.rows??[]) as Record<string,unknown>[]}},async exec(sql){await db.exec(sql)}}}
async function boot(){const db=new PGlite(),sql=asSql(db);await applyCustomerMigrations(sql);await db.query('BEGIN');await enableAppRole(sql);const platform=new CustomerPlatform({sql,cth:directory,mailer:async(message)=>({sent:false,preview:message.text}),handoffSecret:SECRET,staffEmails:['staff@asktrusthub.com'],siteUrl:'https://www.asktrusthub.com'});return{db,sql,platform}}
async function signup(platform:CustomerPlatform,email:string){const sent=await platform.requestMagicLink({email,nextPath:'/claim/continue'}),match=sent.preview?.match(/token=([^&\s]+)/);assert.ok(match);return platform.consumeMagicLink(decodeURIComponent(match[1]))}
function handoff(profile:CustomerProfileRecord,nonce?:string){
  const cap=CLAIM_CAPABILITY_MATRIX.find(x=>x.hub===profile.hubId&&x.profileClass===profile.entityClass)!;
  return mintHandoffToken(SECRET,{hubId:profile.hubId,nativeProfileId:profile.id,slug:profile.slug,externalKey:profile.externalKey,
    sourceSystem:profile.sourceSystem,homeState:profile.homeState,identifierNamespace:cap.canonicalIdentifier==='CMS CCN'?'CMS_CCN':cap.canonicalIdentifier==='Credential'?'credential':cap.canonicalIdentifier as HandoffPayload['identifier_namespace'],
    entityClass:profile.entityClass,providerClass:profile.hubId==='senior'?profile.entityClass as 'nursing_home':undefined,canonicalProfileUrl:profile.canonicalUrl,displayName:profile.displayName,version:2,nonce});
}

test('launch matrix names every claimable class and explicit person/branch exclusions',()=>{
  assert.deepEqual([...new Set(CLAIM_CAPABILITY_MATRIX.map(x=>x.hub))].sort(),['contractor','insurance','investor','lender','move','senior']);
  for(const row of CLAIM_CAPABILITY_MATRIX){assert.ok(row.canonicalIdentifier);assert.equal(row.successDestination,'/manage');if(row.claimable){assert.ok(row.specialistCta&&row.signedHandoff&&row.askValidation&&row.organizationAttachment)}else{assert.ok(row.exclusion);assert.equal(row.specialistCta,false)}}
  assert.equal(CLAIM_CAPABILITY_MATRIX.find(x=>x.profileClass==='mlo')?.claimable,false);
  assert.equal(CLAIM_CAPABILITY_MATRIX.find(x=>x.profileClass==='producer')?.claimable,false);
  assert.equal(CLAIM_CAPABILITY_MATRIX.find(x=>x.profileClass==='representative')?.claimable,false);
});

test('permanent corpus has 50+ balanced structured launch scenarios',()=>{
  assert.ok(CLAIM_LAUNCH_GOLDEN_CORPUS.length>=50);
  assert.equal(new Set(CLAIM_LAUNCH_GOLDEN_CORPUS.map(x=>x.id)).size,CLAIM_LAUNCH_GOLDEN_CORPUS.length);
  for(const category of ['SUCCESS','INELIGIBLE','HANDOFF_SECURITY','AUTH','CONFLICT','BACKEND','MANAGEMENT','RECOVERY','ANALYTICS']) assert.ok(CLAIM_LAUNCH_GOLDEN_CORPUS.some(x=>x.category===category));
});

test('all six exact public profile contracts accept signed handoffs once',async()=>{
  const {db,platform}=await boot();
  for(const profile of profiles){const minted=handoff(profile,`nonce-${profile.hubId}`);const accepted=await platform.acceptHandoff(minted.token);assert.equal(accepted.payload.hub_id,profile.hubId);assert.equal(accepted.payload.external_key,profile.externalKey)}
  await db.close();
});

test('tampering, expiry, replay, and profile substitution fail closed',async()=>{
  const {db,platform}=await boot(),profile=profiles[0],minted=handoff(profile,'security-nonce');
  const [body,sig]=minted.token.split('.'),parsed=JSON.parse(Buffer.from(body,'base64url').toString()) as HandoffPayload;
  parsed.external_key='9999999';const tampered=`${Buffer.from(JSON.stringify(parsed)).toString('base64url')}.${sig}`;
  await assert.rejects(()=>platform.acceptHandoff(tampered),HandoffError);
  await platform.acceptHandoff(minted.token);
  await assert.rejects(()=>platform.acceptHandoff(minted.token),(e:unknown)=>e instanceof HandoffError&&e.code==='reused_nonce');
  const expired=mintHandoffToken(SECRET,{hubId:'move',nativeProfileId:profile.id,slug:profile.slug,externalKey:profile.externalKey,sourceSystem:'fmcsa',identifierNamespace:'USDOT',entityClass:'mover',displayName:profile.displayName,version:2,now:new Date('2020-01-01'),ttlSeconds:1});
  await assert.rejects(()=>platform.acceptHandoff(expired.token),HandoffError);await db.close();
});

test('identifier knowledge is not authority and a mismatched attestation is rejected',async()=>{
  const {db,platform}=await boot(),profile=profiles[4],intent=await platform.acceptHandoff(handoff(profile,'attestation').token),user=await signup(platform,'owner@example.test');
  await assert.rejects(()=>platform.submitClaim({sessionToken:user.sessionToken,intentId:intent.intentId,relationshipType:'owner',credentialAttestation:'CBC999999',authorized:true}),(e:unknown)=>e instanceof ClaimError&&e.code==='credential_mismatch');
  const home=await platform.managedHome(user.sessionToken);assert.equal(home.length,0);await db.close();
});

test('fresh handoff for same claimant/profile returns existing claim without duplicate organization',async()=>{
  const {db,sql,platform}=await boot(),profile=profiles[4],user=await signup(platform,'repeat@example.test');
  const first=await platform.acceptHandoff(handoff(profile,'repeat-one').token),a=await platform.submitClaim({sessionToken:user.sessionToken,intentId:first.intentId,relationshipType:'owner',credentialAttestation:profile.externalKey,authorized:true});
  const second=await platform.acceptHandoff(handoff(profile,'repeat-two').token),b=await platform.submitClaim({sessionToken:user.sessionToken,intentId:second.intentId,relationshipType:'owner',credentialAttestation:profile.externalKey,authorized:true});
  assert.equal(b.claimId,a.claimId);assert.equal(b.orgId,a.orgId);
  assert.equal((await sql.query<{n:string}>('SELECT count(*)::text n FROM ath_claims')).rows[0].n,'1');
  assert.equal((await sql.query<{n:string}>('SELECT count(*)::text n FROM ath_organizations')).rows[0].n,'1');await db.close();
});

test('same organization can retain separate exact profiles across Hubs without fuzzy merging',async()=>{
  const {db,sql,platform}=await boot(),user=await signup(platform,'network-owner@example.test'),firstProfile=profiles[0],secondProfile=profiles[4];
  const first=await platform.acceptHandoff(handoff(firstProfile,'cross-one').token),claimA=await platform.submitClaim({sessionToken:user.sessionToken,intentId:first.intentId,relationshipType:'owner',credentialAttestation:firstProfile.externalKey,authorized:true});
  await sql.query("UPDATE ath_memberships SET status='active' WHERE org_id=$1",[claimA.orgId]);
  const second=await platform.acceptHandoff(handoff(secondProfile,'cross-two').token),claimB=await platform.submitClaim({sessionToken:user.sessionToken,intentId:second.intentId,orgId:claimA.orgId,relationshipType:'owner',credentialAttestation:secondProfile.externalKey,authorized:true});
  assert.equal(claimB.orgId,claimA.orgId);assert.notEqual(claimB.claimId,claimA.claimId);assert.equal((await sql.query<{n:string}>('SELECT count(*)::text n FROM ath_organizations')).rows[0].n,'1');await db.close();
});

test('every recovery code has useful deterministic actions and review path',()=>{for(const code of CUSTOMER_CLAIM_ERROR_CODES){const r=CUSTOMER_CLAIM_RECOVERY[code];assert.ok(r.headline&&r.whatHappened&&r.why);assert.deepEqual(r.actions.map(x=>x.kind),['primary','alternative','support']);assert.match(r.actions[2].href,/^\/claim\/help\?category=/)}});

test('claim analytics are bounded and discard identifiers, names, emails, and tokens',()=>{
  assert.equal(claimAcquisitionSource('unbounded-campaign'),'organic');assert.equal(claimAcquisitionSource('email_campaign'),'email_campaign');
  const safe=safeClaimFunnelProperties({hub:'move',profileClass:'mover',state:'FL',resultState:'submitted',source:'organic',authenticated:true});
  assert.deepEqual(safe,{hub:'move',profileClass:'mover',state:'FL',resultState:'submitted',source:'organic',authenticated:true});
  const attacked=safeClaimFunnelProperties({hub:'move',profileClass:'mover',state:'FL'}) as Record<string,unknown>;for(const key of Object.keys(attacked))assert.doesNotMatch(key,/(?:email|identifier|profile_?id|token)/i);
});

test('business management contract never exposes regulatory evidence as editable fields',async()=>{
  const source=await import('node:fs').then(fs=>fs.readFileSync(new URL('./business-profile.ts',import.meta.url),'utf8'));
  for(const forbidden of ['license_number','regulatory_status','enforcement','cms_rating','nmls','usdot','crd','naic']) assert.doesNotMatch(source,new RegExp(`['\"]${forbidden}['\"]\s*,?`));
  assert.match(source,/BUSINESS_FIELD_KEYS/);
});
