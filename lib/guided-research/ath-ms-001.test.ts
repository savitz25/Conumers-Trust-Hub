import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';
import { decideNameCandidateSearch } from '../network/name-candidates/decision.ts';
import { msSpecialistUrl } from '../network/ms-network.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});

test('real Guided Research START routes Mississippi class phrases to state handoffs',async()=>{
  for(const [query,hub] of [
    ['mover Mississippi','move'],['plumbing contractor Mississippi','contractor'],
    ['mortgage lender Mississippi','lender'],['mortgage servicer Mississippi','lender'],
    ['insurance company Mississippi','insurance'],['nursing home Mississippi','senior'],['investment adviser Mississippi','investor'],
  ] as const){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
    const response=await start(query);
    assert.equal(response.session.hub,hub,query);
    assert.equal(response.session.phase,'DEEP_LINK',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'MS',query);
    assert.equal(response.result?.destinations[0]?.href,msSpecialistUrl(hub),query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,response.result?.destinations[0]?.href,query);
  }
});

test('Mississippi grains stay separate',async()=>{
  const move=await start('mover Mississippi');
  assert.match(move.result?.consumerMessage??'',/Household-goods certificate roster not acquired/);
  assert.match(move.result?.consumerMessage??'',/not zero/);
  const contractor=await start('contractor Mississippi');
  assert.match(contractor.result?.consumerMessage??'',/3,425/);
  assert.match(contractor.result?.consumerMessage??'',/not the licensed count/);
  const senior=await start('assisted living Mississippi');
  assert.match(senior.result?.consumerMessage??'',/not an assisted-living census/);
  assert.match(senior.result?.consumerMessage??'',/not one senior population/);
  const lender=await start('mortgage lender Mississippi');
  assert.match(lender.result?.consumerMessage??'',/7,093/);
  assert.match(lender.result?.consumerMessage??'',/not a license census/);
  const insurance=await start('insurance company Mississippi');
  assert.match(insurance.result?.consumerMessage??'',/are not added/);
  assert.doesNotMatch(insurance.result?.consumerMessage??'',/12,?774/);
  const investor=await start('investment adviser Mississippi');
  assert.match(investor.result?.consumerMessage??'',/67 Mississippi state-registered IA firm CRDs with status APPROVED/);
  assert.match(investor.result?.consumerMessage??'',/are not added/);
  assert.doesNotMatch(investor.result?.consumerMessage??'',/\b1,?304\b/);
});

test('Mississippi cities stay context and bare ms does not route',async()=>{
  for(const city of ['Jackson','Gulfport','Biloxi']){
    const response=await start(`nursing home ${city}, Mississippi`);
    assert.equal(response.session.hub,'senior');
    assert.match(response.result?.consumerMessage??'',/context only/i);
    assert.doesNotMatch(JSON.stringify(response),/mississippi\/(?:jackson|gulfport|biloxi)/i);
    const bare=await start(`nursing home ${city}`);
    assert.notEqual(bare.session.phase,'DEEP_LINK',city);
    assert.notEqual(bare.session.researchPlan.requestedGeography?.stateCode,'MS',city);
    assert.doesNotMatch(JSON.stringify(bare),/\/mississippi/i,city);
  }
  const bareMs=await start('mover ms');
  assert.notEqual(bareMs.session.researchPlan.requestedGeography?.stateCode,'MS');
  assert.doesNotMatch(JSON.stringify(bareMs),/Household-goods certificate roster not acquired/);
  const inms=await start('investment adviser in ms');
  assert.equal(inms.session.hub,'investor');
  assert.match(inms.result?.consumerMessage??'',/67 Mississippi state-registered/);
  assert.equal((await start('nursing home South Carolina')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/south-carolina');
  assert.notEqual((await start('investment adviser in missouri')).session.researchPlan.requestedGeography?.stateCode,'MS');
  assert.notEqual((await start('nursing home Massachusetts')).session.researchPlan.requestedGeography?.stateCode,'MS');
  assert.notEqual((await start('mortgage lender Indiana')).session.researchPlan.requestedGeography?.stateCode,'MS');
});
