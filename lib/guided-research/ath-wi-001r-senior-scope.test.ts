import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});
const seniorHref='https://www.seniortrusthub.com/wisconsin';

test('Wisconsin source-native Senior classes hand off at state grain without a provider cohort',async()=>{
  for(const [query,classId] of [
    ['adult family home Wisconsin','adult_family_home'],['CBRF Wisconsin','cbrf'],
    ['RCAC Wisconsin','rcac'],['nursing home Wisconsin','nursing_home'],
    ['hospice Wisconsin','hospice'],['home health Wisconsin','home_health'],
  ] as const){
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    assert.equal(initial.entityClass,classId,query);
    const response=await start(query);
    assert.equal(response.session.hub,'senior',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'WI',query);
    assert.equal(response.session.executionScope.resolutionState,'EXACT',query);
    assert.ok(!response.session.executionScope.reasonCodes.includes('NO_SPECIALIST_GEOGRAPHY_CAPABILITY'),query);
    assert.equal(response.result?.destinations[0]?.href,seniorHref,query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    assert.match(response.result?.consumerMessage??'',/Wisconsin statewide.*evidence is available/i,query);
    assert.doesNotMatch(JSON.stringify(response),/requested local scope is not executable|unexecutable local scope/i,query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,seniorHref,query);
  }
});

test('Wisconsin CCN wins over insurance and retains exact identifier',async()=>{
  const response=await start('CCN 525001 Wisconsin insurance');
  assert.equal(response.session.hub,'senior');
  assert.deepEqual(response.session.identifier,{type:'CCN',value:'525001'});
  assert.equal(response.session.researchPlan.identifier?.type,'cms_ccn');
  assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'WI');
  assert.equal(response.result?.destinations[0]?.href,seniorHref);
  assert.equal(response.result?.executionOccurred,false);
  assert.ok(!response.session.executionScope.reasonCodes.includes('NO_SPECIALIST_GEOGRAPHY_CAPABILITY'));
});

test('Milwaukee remains context for Wisconsin statewide nursing-home handoff',async()=>{
  const response=await start('nursing home Milwaukee Wisconsin');
  assert.equal(response.session.hub,'senior');
  assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'WI');
  assert.equal(response.result?.destinations[0]?.href,seniorHref);
  assert.equal(response.result?.executionOccurred,false);
  assert.match(response.result?.consumerMessage??'',/Milwaukee is context only/i);
  assert.doesNotMatch(JSON.stringify(response),/wisconsin\/milwaukee/i);
});

test('Maryland repairs and state-aware SEC handoffs remain intact',async()=>{
  const maryland=await start('assisted living Maryland');
  assert.equal(maryland.result?.destinations[0]?.href,'https://www.seniortrusthub.com/maryland');
  for(const [query,href] of [
    ['SEC 801-12345 Maryland','https://www.investortrusthub.com/maryland'],
    ['SEC 801-12345 Wisconsin','https://www.investortrusthub.com/wisconsin'],
  ]){
    const response=await start(query);
    assert.equal(response.session.hub,'investor');
    assert.equal(response.result?.destinations[0]?.href,href);
  }
});

test('identifier precedence, bare numbers and ranking refusal stay fail closed',async()=>{
  for(const [query,hub] of [
    ['USDOT 1234567 Wisconsin insurance','move'],['MC 123456 Wisconsin lender','move'],
    ['NMLS 3030 Wisconsin mover','lender'],['NAIC 10064 Wisconsin contractor','insurance'],
    ['NPN 20000635 Wisconsin lender','insurance'],['CRD 166089 Wisconsin mover','investor'],
  ] as const) assert.equal((await start(query)).session.hub,hub,query);
  await assert.rejects(start('1234567'),/not_guided_query/);
  for(const query of ['best Wisconsin mover','top-rated Wisconsin nursing home','AggregateRating Wisconsin lender','Trust Score Wisconsin contractor']){
    const response=await start(query);
    assert.notEqual(response.session.phase,'REFINE',query);
    assert.equal(response.result?.executionOccurred??false,false,query);
  }
});
