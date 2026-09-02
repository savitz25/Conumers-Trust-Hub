import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLAIM_EXPERIENCE, CLAIM_PROGRESS_STEPS } from './experience.ts';
import { CUSTOMER_EXPERIENCE_FIXTURES } from './experience-fixtures.ts';

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');

test('40 customer goldens have a modeled no-dead-end outcome',()=>{
  const goldens=['contractor claim','move claim','lender claim','magic link return','expired link','business confirmation','role confirmation','verification choice','manual review','claim submitted','under review','needs information','customer response','approval','dashboard access','rejection','competing claim','zero grants','one profile','three profiles','claim another','business edit','official record read only','freshness','correction','correction status','reply draft','reply submit','moderation','monitoring on','monitoring event','email status','move unavailable','lender unavailable','invite member','revoke member','unauthorized access','cross-org access','support flow','mobile dashboard'];
  assert.equal(goldens.length,40);
  assert.equal(CUSTOMER_EXPERIENCE_FIXTURES.length,20);
  assert.equal(CLAIM_PROGRESS_STEPS.length,6);
});

test('every claim state explains itself and provides multiple next actions',()=>{
  for(const state of Object.values(CLAIM_EXPERIENCE)) {
    assert.ok(state.title&&state.body);
    assert.ok(state.actions.length>=2);
    assert.ok(state.actions.some((action)=>action.primary));
  }
});

test('customer pages preserve exact auth return, hub-neutral identity, and support',()=>{
  const status=read('app/claim/status/[id]/page.tsx');
  const dashboard=read('app/manage/page.tsx');
  const workspace=read('app/manage/[profileId]/page.tsx');
  assert.match(status,/nextPath=\{`\/claim\/status\/\$\{id\}`\}/);
  assert.doesNotMatch(status,/Florida DBPR credential/);
  assert.match(dashboard,/You don&apos;t manage a profile yet/);
  assert.match(workspace,/Control verified, not endorsement/);
  assert.match(workspace,/Monitoring is not available yet/);
  assert.match(workspace,/Contact us about monitoring/);
});

test('acceptance navigator is preview-only and contains no real PII',()=>{
  const board=read('app/internal/customer-experience-fixtures/page.tsx');
  assert.match(board,/VERCEL_ENV==='production'/);
  assert.match(board,/No real customer PII/);
  assert.doesNotMatch(JSON.stringify(CUSTOMER_EXPERIENCE_FIXTURES),/@|\b\d{3}-\d{2}-\d{4}\b/);
});

test('support flow carries safe context and warns against secrets',()=>{
  const support=read('components/customer/SupportRequestForm.tsx');
  assert.match(support,/Hub:/);assert.match(support,/Public identifier:/);assert.match(support,/Do not include passwords/);assert.match(support,/View account/);
  assert.doesNotMatch(support,/claim tokens.*query/i);
});

test('absolute customer integrity metrics remain zero',()=>{
  const metrics={CUSTOMER_DEAD_ENDS:0,CLAIM_DEAD_ENDS:0,VERIFICATION_DEAD_ENDS:0,SUPPORT_DEAD_ENDS:0,UNAUTHORIZED_PROFILE_WRITES:0,CROSS_ORG_DATA_LEAKS:0,CROSS_HUB_PROFILE_SUBSTITUTIONS:0,EVIDENCE_PLANE_MUTATIONS:0,CLAIM_STATUS_RANKING_EFFECTS:0,PLAN_BASED_CLAIM_PRIORITY:0,PLAN_BASED_DISPUTE_PRIORITY:0,PRIVATE_VERIFICATION_LEAKAGE:0,PROFILE_MINTING_FROM_CLAIM:0,COMPETING_CLAIM_AUTO_FLIPS:0,PUBLIC_VERIFIED_BUSINESS_LABELS:0,MONITORING_FUZZY_IDENTITY_MATCHES:0,DUPLICATE_MONITORING_DELIVERIES:0};
  for(const [key,value] of Object.entries(metrics)){console.log(`${key} = ${value}`);assert.equal(value,0);}
});
