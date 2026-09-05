import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {ASK_INTEL_V3_CORPUS_COUNTS,ASK_INTEL_V3_GOLDEN_CORPUS,ASK_INTEL_V3_MUTATIONS,mutateAskIntelQuery} from './ask-intel-v3-corpus.ts';
import {buildAskResearchRoute} from './ask-research-route.ts';
import {resolveGuidedNextActions} from './guided-next-actions.ts';
import {GUIDED_RESULT_STATES} from '../guided-research/contract.ts';
import {bucketLatency,bucketQueryLength,bucketResultCount,observeAskRoute,validateAskIntelObservation} from './ask-intel-observability.ts';
import {safeConciergeUrl} from '../ai/safe-markdown.ts';
import {orchestrateGuidedResearch} from '../guided-research/orchestrator.ts';

test('V3 corpus is permanent, balanced, colloquial, and covers all nine intents',()=>{
  assert.ok(ASK_INTEL_V3_CORPUS_COUNTS.total>=144);
  assert.equal(new Set(ASK_INTEL_V3_GOLDEN_CORPUS.map(row=>row.id)).size,ASK_INTEL_V3_GOLDEN_CORPUS.length);
  for(const hub of ['move','lender','insurance','senior','contractor','investor'])assert.ok(Number(ASK_INTEL_V3_CORPUS_COUNTS.byHub[hub])>=20,hub);
  for(const intent of ['IDENTIFIER_LOOKUP','ENTITY_LOOKUP','ENTITY_LOOKUP_MISSING_IDENTITY','COHORT_BROWSE','HOW_TO','EXPLAINER','COMPARE','RECOMMENDATION_REQUEST','MULTI_HUB_JOURNEY'])assert.ok(Number(ASK_INTEL_V3_CORPUS_COUNTS.byIntent[intent])>0,intent);
  const ugly=ASK_INTEL_V3_GOLDEN_CORPUS.filter(row=>row.categories.includes('colloquial')||row.categories.includes('malformed')).length;
  assert.ok(ugly/ASK_INTEL_V3_GOLDEN_CORPUS.length>=.25);
});

test('all golden cases satisfy semantic routing and hard safety invariants',()=>{
  const failures:string[]=[];const score=new Map<string,{pass:number;total:number}>();
  for(const row of ASK_INTEL_V3_GOLDEN_CORPUS){const route=buildAskResearchRoute(row.query);const actual={intent:route.plan.intent,hub:route.plan.primaryHub,hubs:route.journey?.orderedHubs,identifier:route.plan.identifier?.type,requested:route.requestedScope,executed:route.executionScope,scope:route.scope.resolutionState,allowed:route.canExecute,destinations:route.destinations.map(d=>d.id)};const errors:string[]=[];
    if(actual.intent!==row.expectedIntent)errors.push(`intent ${actual.intent} != ${row.expectedIntent}`);
    if(row.expectedHub&&actual.hub!==row.expectedHub)errors.push(`hub ${actual.hub} != ${row.expectedHub}`);
    if(row.expectedHubs&&JSON.stringify(actual.hubs)!==JSON.stringify(row.expectedHubs))errors.push(`hubs ${JSON.stringify(actual.hubs)} != ${JSON.stringify(row.expectedHubs)}`);
    if(row.expectedIdentifierFamily&&actual.identifier!==row.expectedIdentifierFamily)errors.push(`identifier ${actual.identifier} != ${row.expectedIdentifierFamily}`);
    if(row.expectedRequestedScope&&actual.requested!==row.expectedRequestedScope)errors.push(`requested ${actual.requested} != ${row.expectedRequestedScope}`);
    if(row.expectedExecutionScope&&actual.executed!==row.expectedExecutionScope)errors.push(`executed ${actual.executed} != ${row.expectedExecutionScope}`);
    if(row.expectedScopeState&&actual.scope!==row.expectedScopeState)errors.push(`scope ${actual.scope} != ${row.expectedScopeState}`);
    if(row.expectedExecutionAllowed!==undefined&&actual.allowed!==row.expectedExecutionAllowed)errors.push(`allowed ${actual.allowed} != ${row.expectedExecutionAllowed}`);
    for(const id of row.expectedDestinationIds??[])if(!actual.destinations.includes(id))errors.push(`missing destination ${id}`);
    if(row.forbiddenBehaviors?.includes('ENTITY_NAME')&&route.plan.entityName)errors.push(`manufactured entity ${route.plan.entityName}`);
    if(row.forbiddenBehaviors?.includes('STATE_BROADENING')&&route.scope.executionGeography?.kind==='state'&&!route.scope.userConsent?.approved)errors.push('silent state broadening');
    if(row.forbiddenBehaviors?.includes('SPECIALIST_EXECUTION')&&route.canExecute)errors.push('specialist execution allowed');
    if(route.journey&&route.journey.orderedHubs.length>=6)errors.push('six-hub fanout');
    const key=row.expectedHub??'network',current=score.get(key)??{pass:0,total:0};current.total++;if(!errors.length)current.pass++;score.set(key,current);
    if(errors.length)failures.push(`${row.id} | ${row.query}\n  ${errors.join('; ')}\n  actual=${JSON.stringify(actual)}`);
  }
  if(failures.length)assert.fail(`V3 semantic failures (${failures.length}/${ASK_INTEL_V3_GOLDEN_CORPUS.length}):\n${failures.join('\n')}`);
  console.log('ASK-INTEL-V3 scorecard',Object.fromEntries(score));
});

test('identifier families reject ambiguous digits and certify labeled sentence variants',()=>{
  for(const [query,family,hub] of [['Could you verify USDOT #125563 please?','usdot','move'],['Please check MC-1019808.','mc','move'],['Is NMLS #3030 valid?','nmls','lender'],['check LEI 5493001KJTIIGC8Y1R12','lei','lender'],['Is NPN #10391484 valid?','npn','insurance'],['NAIC company code 10064','naic_company_code','insurance'],['CMS CCN #105502','cms_ccn','senior'],['Is CRD #166089 registered?','crd','investor']] as const){const r=buildAskResearchRoute(query);assert.equal(r.plan.identifier?.type,family,query);assert.equal(r.plan.primaryHub,hub,query)}
  for(const query of ['125563','3030','105502','166089']){const r=buildAskResearchRoute(query);assert.equal(r.plan.identifier,undefined,query);assert.equal(r.canExecute,false,query)}
});

test('deterministic mutations do not break representative intent and Hub routing',()=>{
  const stable=ASK_INTEL_V3_GOLDEN_CORPUS.filter(row=>row.expectedHub&&['HOW_TO','EXPLAINER','COHORT_BROWSE'].includes(row.expectedIntent)).slice(0,12);
  for(const row of stable)for(const template of ASK_INTEL_V3_MUTATIONS){const q=mutateAskIntelQuery(row.query,template),r=buildAskResearchRoute(q);assert.equal(r.plan.primaryHub,row.expectedHub,`${row.id}: ${q}`);assert.equal(r.plan.intent,row.expectedIntent,`${row.id}: ${q}`)}
});

test('observability is typed, bucketed, bounded, and contains no sensitive raw fields',()=>{
  const route=buildAskResearchRoute('Is NMLS 3030 valid?'),event=observeAskRoute(route,{surface:'GUIDED',resultCount:12,totalMs:640,resultState:'EXACT_IDENTITY'});
  assert.equal(event.identifierFamily,'nmls');assert.equal(event.resultCountBucket,'11-25');assert.equal(event.latencyBucket,'500-1000ms');assert.deepEqual(validateAskIntelObservation(event),[]);
  assert.equal(JSON.stringify(event).includes('3030'),false);assert.equal(bucketResultCount(1001),'1001+');assert.equal(bucketLatency(20000),'20s+');assert.equal(bucketQueryLength(500),'500+');
  assert.deepEqual(validateAskIntelObservation({query:'private'}),['prohibited_property:query']);
});

test('result-state families remain distinct and receive state-specific next actions',()=>{
  for(const state of ['ZERO_MATCHING_ROWS','UNSUPPORTED_CAPABILITY','CLARIFICATION_REQUIRED','PUBLICATION_RESTRICTED','BACKEND_UNAVAILABLE','TIMEOUT','NO_CONFIDENT_MATCH'] as const)assert.ok(GUIDED_RESULT_STATES.includes(state));
  const route=buildAskResearchRoute('roofing contractors in Broward County Florida');
  assert.equal(resolveGuidedNextActions({plan:route.plan,scope:route.scope,resultState:'ZERO_MATCHING_ROWS'})[0]?.type,'CLEAR_FILTERS');
  for(const state of ['BACKEND_UNAVAILABLE','TIMEOUT'] as const)assert.equal(resolveGuidedNextActions({plan:route.plan,scope:route.scope,resultState:state})[0]?.type,'RETRY');
});

test('unsupported local scope causes zero specialist calls and never becomes true zero',async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('must not execute')}) as typeof fetch;
  try{for(const query of ['mover in tampa bay florida','movers in Boca Raton Florida','registered investment advisers in West Palm Beach Florida','insurance agencies in Fort Lauderdale Florida','roofer in Phoenix Arizona']){const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});assert.equal(response.diagnostics.specialistCalls,0,query);assert.notEqual(response.result?.resultState,'ZERO_MATCHING_ROWS',query)}assert.equal(calls,0)}finally{globalThis.fetch=original}
});

test('large-cohort rendering is bounded, neutral, and never labels source order as ranking',()=>{
  const guided=readFileSync(new URL('../../components/guided-research.tsx',import.meta.url),'utf8');const result=readFileSync(new URL('../../components/network-ask-result.tsx',import.meta.url),'utf8');const specialists=readFileSync(new URL('../guided-research/specialists.ts',import.meta.url),'utf8');
  assert.match(result,/slice\(0, 10\)/);assert.match(result,/Source order only[^\n]*not a ranking/);assert.match(guided,/slice\(0,3\)/);assert.match(guided,/slice\(0,8\)/);assert.match(specialists,/limit:\s*10/);assert.doesNotMatch(`${guided}\n${result}`,/>\s*(?:Top|Best|Recommended)\s*</i);
});

test('response-specific URL firewall rejects protocol, origin, encoding, and user-content attacks',()=>{
  const allowed=['https://www.movetrusthub.com/verify-dot','https://www.fmcsa.dot.gov/protect-your-move/search-mover','/ask?q=mover'];
  for(const attack of ['javascript:alert(1)','data:text/html,bad','file:///etc/passwd','blob:https://evil.example/id','//evil.example','http://[bad','https://example.com','https://movetrusthub.evil.example/verify-dot','https://preview.vercel.app','http://localhost:3000','java%73cript:alert(1)'])assert.equal(safeConciergeUrl(attack,allowed),'',attack);
  for(const url of allowed)assert.ok(safeConciergeUrl(url,allowed),url);
});

test('consumer-visible V3 code contains explicit non-inference language and no positive prohibited claims',()=>{
  const files=['research-destinations.ts','ask-research-route.ts','ask-multi-hub-journey.ts'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\n');
  assert.match(files,/does not mean good standing/i);assert.match(files,/not a TrustHub ranking or endorsement/i);assert.doesNotMatch(files,/Trust Score|paid ranking|verified by TrustHub/i);assert.doesNotMatch(files,/Current (?:means|=) good standing|Registered (?:means|=) recommended|Licensed (?:means|=) trustworthy/i);
});
