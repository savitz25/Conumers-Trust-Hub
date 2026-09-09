import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {validateAdminCommandV1,validateClaimPolicyV1,validateOpsCaseV1,validateProductEventV1} from './index.ts';
import {guidedSearchTerminalOutcome,observeAskRoute,searchTerminalAnalyticsProps,searchTerminalOutcome} from '../../network/ask-intel-observability.ts';
import {buildAskResearchRoute} from '../../network/ask-research-route.ts';

const event={schema_version:'product_event.v1',event_id:'evt_1',event_name:'search_terminal_outcome',occurred_at:'2026-09-08T12:00:00Z',surface:'ASK_SSR',hub:'ask'};
test('V1 schemas accept valid examples and reject versions/enums',()=>{
  assert.equal(validateProductEventV1(event).ok,true);
  assert.equal(validateProductEventV1({...event,schema_version:'v2'}).ok,false);
  assert.equal(validateProductEventV1({...event,terminal_outcome:'DONE'}).ok,false);
  assert.equal(validateOpsCaseV1({schema_version:'ops_case.v1',case_id:'c1',case_type:'CLAIM_REVIEW',hub:'contractor',severity:'P1',status:'OPEN',queue:'claims',target_type:'profile',target_ref:'opaque',opened_at:'2026-09-08T12:00:00Z',reason_codes:[],evidence_refs:[],audit_refs:[]}).ok,true);
});
test('product telemetry neither requires nor permits raw/private material',()=>{
  assert.equal(validateProductEventV1(event).ok,true);
  for(const key of ['raw_query','email','private_note','private_decision','service_role_key'])assert.equal(validateProductEventV1({...event,[key]:'sensitive'}).ok,false,key);
});
test('admin commands require actor, reason, authorization and audit structure',()=>{
  const base={schema_version:'admin_command.v1',command_id:'cmd1',command_type:'SOURCE_MARK_DEGRADED',target_scope:{type:'capability',ref:'opaque'},actor:{type:'STAFF_USER',ref:'opaque'},authorization_context:{role:'operator',policy_version:'rbac.v1'},reason_code:'SOURCE_CHECK_FAILED',requested_at:'2026-09-08T12:00:00Z',before_state_ref:'snapshot:1',intended_after_state:'DEGRADED',audit_ref:'audit:1'};
  assert.equal(validateAdminCommandV1(base).ok,true);assert.equal(validateAdminCommandV1({...base,actor:undefined}).ok,false);assert.equal(validateAdminCommandV1({...base,reason_code:''}).ok,false);
});
test('claim policy is hub/profile/jurisdiction/version scoped',()=>{
  const policy={schema_version:'claim_policy.v1',policy_version:'contractor.fl.v1',hub:'contractor',profile_class:'contractor_company',jurisdiction:'FL',strong_verification_signals:[],step_up_signals:[],disqualifiers:[],conflicting_signals:[],competing_claim:'NOT_YET_DEFINED',existing_management_grant:'NOT_YET_DEFINED',third_party_representative:'NOT_YET_DEFINED',risk_signals:[],automatic_approval_eligibility:'NOT_YET_DEFINED',required_evidence:[],default_result:'NOT_YET_DEFINED'};
  assert.equal(validateClaimPolicyV1(policy).ok,true);assert.equal(validateClaimPolicyV1({...policy,jurisdiction:''}).ok,false);assert.equal(validateClaimPolicyV1({...policy,strong_verification_signals:['email domain alone']}).ok,false);
});
test('terminal Search telemetry is normalized and does not change routing',()=>{
  const before=buildAskResearchRoute('Find mover USDOT 3244649.');const observation=observeAskRoute(before);const props=searchTerminalAnalyticsProps(observation);const after=buildAskResearchRoute('Find mover USDOT 3244649.');
  assert.deepEqual(after.plan,before.plan);assert.equal(searchTerminalOutcome(observation),'RESULTS');assert.equal('query' in props,false);assert.equal('question' in props,false);assert.equal(JSON.stringify(props).includes('3244649'),false);
  const clarification=observeAskRoute(buildAskResearchRoute('Is this financial advisor registered with the SEC?'));assert.equal(searchTerminalOutcome(clarification),'CLARIFICATION');
  assert.equal(guidedSearchTerminalOutcome('SUPPORTED_RESULTS',2,false),'RESULTS');assert.equal(guidedSearchTerminalOutcome('UNSUPPORTED_CAPABILITY',0,true),'FAIL_CLOSED_WITH_ACTION');assert.equal(guidedSearchTerminalOutcome('UNSUPPORTED_CAPABILITY',0,false),'FAIL_CLOSED_DEAD_END');assert.equal(guidedSearchTerminalOutcome('TIMEOUT',0,true),'ERROR');
});
test('client telemetry imports no database or service-role module',()=>{
  const source=readFileSync(new URL('../../../components/ask-route-analytics.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/service.role|SUPABASE_SERVICE_ROLE|customer\/store|database|\bpg\b/i);
});
