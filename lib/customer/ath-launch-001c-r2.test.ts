import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isLifecycleQaOperator } from './lifecycle-qa-auth.ts';

const store=readFileSync('lib/customer/store.ts','utf8');
const page=readFileSync('app/internal/customer-email-qa/page.tsx','utf8');
const route=readFileSync('app/api/internal/customer-email-qa/route.ts','utf8');
const qaBlock=store.slice(store.indexOf('async assertLifecycleQaOperator'),store.indexOf('/**\n   * Fixed-query'));

const base={isStaff:false,sessionEmail:'operator@example.test',operatorEmail:'operator@example.test',vercelEnv:'production',enabled:'1'};

test('normal staff remains authorized only on the enabled production QA surface',()=>{assert.equal(isLifecycleQaOperator({...base,isStaff:true,sessionEmail:'staff@example.test',operatorEmail:undefined}),true);assert.equal(isLifecycleQaOperator({...base,isStaff:true,enabled:'0'}),false);});
test('configured operator requires an exact normalized authenticated email match',()=>{assert.equal(isLifecycleQaOperator({...base,sessionEmail:' Operator@Example.Test '}),true);assert.equal(isLifecycleQaOperator({...base,sessionEmail:'wrong@example.test'}),false);});
test('flag, environment, and operator configuration all fail closed',()=>{assert.equal(isLifecycleQaOperator({...base,enabled:'0'}),false);assert.equal(isLifecycleQaOperator({...base,vercelEnv:'preview'}),false);assert.equal(isLifecycleQaOperator({...base,operatorEmail:undefined}),false);});
test('unauthenticated sessions are rejected before scoped authorization',()=>{assert.match(qaBlock,/sessionUser\(sessionToken\)/);assert.match(qaBlock,/if\(!user\)throw new AuthError\('missing_session'\)/);});
test('general staff authorization implementation remains unchanged and separate',()=>{assert.match(store,/private async requireStaff\(sessionToken: string\)/);assert.doesNotMatch(store.slice(store.indexOf('private async requireStaff'),store.indexOf('async staffDecide')),/LIFECYCLE_QA|isLifecycleQaOperator/);});
test('only lifecycle QA page and send method use scoped operator authorization',()=>{assert.match(page,/assertLifecycleQaOperator/);assert.match(qaBlock,/requireLifecycleQaOperator/);assert.doesNotMatch(readFileSync('app/internal/review/page.tsx','utf8'),/LifecycleQaOperator|LIFECYCLE_QA_OPERATOR/);assert.doesNotMatch(readFileSync('app/internal/record-issues/page.tsx','utf8'),/LifecycleQaOperator|LIFECYCLE_QA_OPERATOR/);});
test('operator is never promoted into the general staff list',()=>{assert.doesNotMatch(qaBlock,/staffEmails|staffSet|isStaffEmail/);assert.doesNotMatch(store.slice(0,store.indexOf('async assertLifecycleQaOperator')),/ATH_LIFECYCLE_QA_OPERATOR_EMAIL/);});
test('recipient and operator remain separate server-only concepts',()=>{assert.match(qaBlock,/ATH_LIFECYCLE_QA_OPERATOR_EMAIL/);assert.match(qaBlock,/ATH_LIFECYCLE_QA_EMAIL/);assert.doesNotMatch(page+route,/ATH_LIFECYCLE_QA_(?:OPERATOR_)?EMAIL/);assert.doesNotMatch(route,/request\.(?:json|text|formData)|searchParams/);});
test('operator email cannot enter response, logging, or analytics',()=>{assert.doesNotMatch(qaBlock,/console|customerLog|track|analytics/);assert.doesNotMatch(route,/operator|recipient|email/i);});
test('operator variable is referenced only by QA authorization and this test',()=>{const files=execFileSync('rg',['-l','ATH_LIFECYCLE_QA_OPERATOR_EMAIL','.','--glob','!node_modules/**','--glob','!.next/**'],{encoding:'utf8'}).trim().split(/\r?\n/).map(file=>file.replace(/^\.\\|^\.\//,'').replaceAll('\\','/')).sort();assert.deepEqual(files,['lib/customer/ath-launch-001c-r2.test.ts','lib/customer/store.ts']);});
