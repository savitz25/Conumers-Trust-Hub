import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const store=readFileSync('lib/customer/store.ts','utf8');
const route=readFileSync('app/api/internal/customer-email-qa/route.ts','utf8');
const page=readFileSync('app/internal/customer-email-qa/page.tsx','utf8');
const button=readFileSync('app/internal/customer-email-qa/qa-button.tsx','utf8');
const block=store.slice(store.indexOf('async sendLifecycleQa'),store.indexOf('/**\n   * Fixed-query'));

test('page and action fail closed outside explicitly enabled Production',()=>{for(const source of [page,route]){assert.match(source,/VERCEL_ENV!=='production'/);assert.match(source,/ATH_LIFECYCLE_QA_ENABLED!=='1'/);assert.match(source,/404|notFound/);}});
test('existing authenticated session authorization is reused',()=>{assert.match(page,/readSessionToken/);assert.match(page,/assertLifecycleQaOperator/);assert.match(route,/readSessionToken/);assert.match(block,/requireLifecycleQaOperator/);assert.doesNotMatch(page+route,/Basic |bearer|password/i);});
test('route accepts no recipient, template, subject, HTML, text, CTA, or profile input',()=>{assert.doesNotMatch(route,/request\.(?:json|text|formData)|searchParams|recipient|template|subject|profileName|cta/i);assert.doesNotMatch(button,/recipient|template|subject|profileName/i);});
test('recipient comes only from sensitive server environment and never enters response',()=>{assert.match(block,/process\.env\.ATH_LIFECYCLE_QA_EMAIL/);assert.doesNotMatch(route,/ATH_LIFECYCLE_QA_EMAIL/);assert.doesNotMatch(block,/console|customerLog/);});
test('exact fixed five lifecycle types and synthetic names are server-owned',()=>{const expected=['CLAIM_STARTED','CLAIM_NEEDS_INFORMATION','CLAIM_APPROVED','TEAM_INVITATION','RECORD_ISSUE_RECEIVED'];assert.deepEqual(expected.map(type=>block.includes(`type:'${type}'`)),[true,true,true,true,true]);assert.equal((block.match(/objectId:'/g)||[]).length,5);assert.match(block,/Harbor Test Builders/);assert.match(block,/Harbor Test Holdings/);});
test('QA URLs are real canonical relative routes without fake object identifiers',()=>{for(const path of ['/manage','/manage/invitations/accept','/claim/help?category=profile_claim','/claim/help?category=authority_problem'])assert.match(block,new RegExp(path.replace(/[?]/g,'\\?')));assert.doesNotMatch(block,/claim\/status|https?:\/\//);});
test('existing delivery helper supplies deterministic duplicate suppression',()=>{assert.match(block,/objectType:'ath_launch_001c_qa'/);assert.match(block,/stateVersion:'r1-v1'/);assert.match(store,/ON CONFLICT\(notification_id,channel\) DO NOTHING/);});
test('bounded response has counts and types but no recipient or content',()=>{assert.match(block,/attempted:definitions\.length,sent:0,suppressed:0,failed:0,types/);assert.doesNotMatch(route,/subject|html|text|recipient/);});
test('same-origin POST is required and arbitrary request content is ignored',()=>{assert.match(route,/headers\.get\('origin'\)/);assert.match(route,/new URL\(request\.url\)\.origin/);assert.doesNotMatch(route,/request\.json|request\.text|request\.formData/);});
test('QA method contains no customer-state table writes',()=>{assert.doesNotMatch(block,/INSERT INTO ath_(users|organizations|memberships|hub_profiles|claims|management_grants|record_issues|business_replies|monitoring_subscriptions)/);});
