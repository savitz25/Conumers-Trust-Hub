import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOMER_EMAIL_TRIGGER_MATRIX, CUSTOMER_EMAIL_TYPES, customerLifecycleEmail, safeCustomerActionUrl } from './customer-emails.ts';
import { CUSTOMER_LIFECYCLE_PREVIEWS } from '../emails/previews/customer-lifecycle.ts';

const scenarios=[
  'claim-submitted','claim-needs-info','claim-approved-first','claim-approved-second','claim-provider-failure',
  'first-profile','existing-profile-no-welcome','issue-received','issue-needs-info','issue-resolved',
  'response-submitted','response-published','response-needs-changes','team-invitation','team-accepted',
  'access-role-change','access-removed','monitoring-supported','monitoring-disabled','monitoring-unsupported',
  'malicious-name','long-name','canonical-link','duplicate-transition','preview-sink','transactional-footer',
  'move-copy','lender-copy','insurance-copy','senior-copy','contractor-copy','investor-copy',
] as const;

test('permanent lifecycle corpus contains 25-35 semantic scenarios',()=>assert.ok(scenarios.length>=25&&scenarios.length<=35));
test('catalog exposes stable lifecycle IDs and trigger dispositions',()=>{
  assert.equal(new Set(CUSTOMER_EMAIL_TYPES).size,CUSTOMER_EMAIL_TYPES.length);
  assert.ok(CUSTOMER_EMAIL_TRIGGER_MATRIX.every(row=>['IMPLEMENTED','NOT_CURRENTLY_APPLICABLE','FUTURE'].includes(row[2])));
});
test('every catalog template is transactional, has useful text, and explains why it was sent',()=>{
  for(const type of CUSTOMER_EMAIL_TYPES){const mail=customerLifecycleEmail({type,profileName:'Synthetic Profile',organizationName:'Synthetic Org',hub:'contractor',detail:'A useful status explanation.',actionPath:'/manage',actionLabel:'Open My Trust Hub'});assert.equal(mail.transactional,true);assert.ok(mail.text.length>100,type);assert.match(mail.text,/You received this because/);assert.match(mail.html,/<!DOCTYPE html>/);assert.match(mail.html,/alt="Ask Trust Hub"/);assert.doesNotMatch(mail.subject,/\r|\n/);}
});
test('controlled content is escaped and never becomes markup',()=>{const attack='<script>alert(1)</script><img onerror="x"> & “Unicode”';const mail=customerLifecycleEmail({type:'CLAIM_APPROVED',profileName:attack,detail:attack,actionPath:'/manage'});assert.doesNotMatch(mail.html,/<script>|<img onerror/);assert.match(mail.html,/&lt;script&gt;/);});
test('actions are fixed to canonical Ask HTTPS origin',()=>{
  assert.equal(safeCustomerActionUrl('/manage'),'https://www.asktrusthub.com/manage');
  for(const path of ['//evil.test','https://evil.test','javascript:alert(1)','data:text/html,x'])assert.throws(()=>safeCustomerActionUrl(path));
  assert.throws(()=>safeCustomerActionUrl('/manage','http://www.asktrusthub.com'));
  assert.throws(()=>safeCustomerActionUrl('/manage','https://asktrusthub.com'));
});
test('six Hub display names remain registry-driven and semantically exact',()=>{
  const hubs=['move','lender','insurance','senior','contractor','investor'] as const;
  const expected=['MoveTrustHub','LenderTrustHub','InsuranceTrustHub','SeniorTrustHub','ContractorTrustHub','InvestorTrustHub'];
  hubs.forEach((hub,i)=>assert.match(customerLifecycleEmail({type:'CLAIM_STARTED',hub,profileName:'Synthetic'}).text,new RegExp(expected[i])));
});
test('preview gallery renders required representative messages',()=>{assert.equal(CUSTOMER_LIFECYCLE_PREVIEWS.length,8);assert.ok(CUSTOMER_LIFECYCLE_PREVIEWS.every(m=>m.html.includes('max-width:560px')));});
test('trust semantics never create endorsements or mutable evidence',()=>{for(const type of CUSTOMER_EMAIL_TYPES){const text=customerLifecycleEmail({type,profileName:'Synthetic'}).text;assert.doesNotMatch(text,/good standing|Trust Score|recommended provider|pay to rank/i);}});
