import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';
import { decideNameCandidateSearch } from '../network/name-candidates/decision.ts';
import { alSpecialistUrl } from '../network/al-network.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});

test('real Guided Research START routes Alabama class phrases to state handoffs',async()=>{
  for(const [query,hub] of [
    ['mover Alabama','move'],['plumbing contractor Alabama','contractor'],
    ['mortgage lender Alabama','lender'],['loan broker Alabama','lender'],
    ['insurance company Alabama','insurance'],['nursing home Alabama','senior'],['investment adviser Alabama','investor'],
  ] as const){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
    const response=await start(query);
    assert.equal(response.session.hub,hub,query);
    assert.equal(response.session.phase,'DEEP_LINK',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'AL',query);
    assert.equal(response.result?.destinations[0]?.href,alSpecialistUrl(hub),query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    assert.doesNotMatch(JSON.stringify(response),/requested local scope is not executable|NO_SPECIALIST_GEOGRAPHY_CAPABILITY/i,query);
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,response.result?.destinations[0]?.href,query);
  }
});

test('Alabama contractor, senior, lender, insurance and investor grains stay separate',async()=>{
  for(const query of ['contractor Alabama','electrical contractor Alabama','HVAC contractor Alabama','plumbing contractor Alabama']){
    const response=await start(query);
    assert.equal(response.session.hub,'contractor');
    assert.match(response.result?.consumerMessage??'',/8,848 is the parsed license-row count/);
    assert.match(response.result?.consumerMessage??'',/HBLB person licenses were not acquired|HBLB, AECB, HACR, and PGFB rosters were not acquired/);
  }
  const nursing=await start('nursing home Alabama');
  assert.match(nursing.result?.consumerMessage??'',/232 nursing-home directory rows/);
  assert.match(nursing.result?.consumerMessage??'',/not one senior population/);
  const lender=await start('mortgage lender Alabama');
  assert.match(lender.result?.consumerMessage??'',/not a mortgage-lender census/);
  assert.match(lender.result?.consumerMessage??'',/Those two figures are not added/);
  const insurance=await start('insurance company Alabama');
  assert.match(insurance.result?.consumerMessage??'',/not an authorized-insurer census/);
  assert.doesNotMatch(insurance.result?.consumerMessage??'',/255,?578/);
  const investor=await start('investment adviser Alabama');
  assert.match(investor.result?.consumerMessage??'',/165 Alabama state IA firm CRDs with status APPROVED/);
  assert.match(investor.result?.consumerMessage??'',/1,639 FILED SEC notice firms/);
  assert.doesNotMatch(investor.result?.consumerMessage??'',/1913|1,913|1804/);
  const move=await start('mover Alabama');
  assert.match(move.result?.consumerMessage??'',/not a mover count/);
});

test('Alabama identifier precedence survives execution',async()=>{
  for(const [query,hub,id] of [
    ['USDOT 1234567 Alabama insurance','move','USDOT'],['MC 123456 Alabama lender','move','MC'],
    ['NMLS 3030 Alabama mover','lender','NMLS'],['NAIC 10064 Alabama contractor','insurance','NAIC'],
    ['NPN 20000635 Alabama lender','insurance','NPN'],['CCN 155001 Alabama insurance','senior','CCN'],
    ['CRD 6413 Alabama mover','investor','CRD'],
  ] as const){const response=await start(query);assert.equal(response.session.hub,hub,query);assert.equal(response.session.identifier?.type,id,query);assert.equal(response.result?.destinations[0]?.href,alSpecialistUrl(hub),query);}
  const sec=await start('SEC 801-12345 Alabama');
  assert.equal(sec.session.hub,'investor');
  assert.equal(sec.session.identifier?.type,'SEC');
  assert.equal(sec.result?.destinations[0]?.href,'https://www.investortrusthub.com/alabama');
});

test('Alabama city names stay context and ranking or bare numbers cannot execute',async()=>{
  for(const city of ['Birmingham','Montgomery','Huntsville','Tuscaloosa']){
    const response=await start(`nursing home ${city} Alabama`);
    assert.equal(response.session.hub,'senior');
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'AL');
    assert.equal(response.result?.executionOccurred,false);
    assert.match(response.result?.consumerMessage??'',/context only/i);
    assert.doesNotMatch(JSON.stringify(response),/alabama\/(?:birmingham|montgomery|huntsville|tuscaloosa|mobile)/i);
  }
  const mobile=await start('nursing home Mobile, Alabama');
  assert.equal(mobile.session.researchPlan.requestedGeography?.city,'Mobile');
  assert.equal(mobile.result?.executionOccurred,false);
  await assert.rejects(start('1234567'),/not_guided_query/);
  for(const query of ['best Alabama mover','safest Alabama contractor','recommended Alabama lender','most trustworthy Alabama insurance agency','top-rated Alabama nursing home','highest-rated Alabama adviser','AggregateRating Alabama lender','Trust Score Alabama contractor']){
    const response=await start(query);
    assert.notEqual(response.session.phase,'REFINE',query);
    assert.equal(response.result?.executionOccurred??false,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
  }
});

test('Louisiana and Indiana execution paths remain intact',async()=>{
  assert.equal((await start('nursing home Louisiana')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/louisiana');
  assert.equal((await start('nursing home Indiana')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/indiana');
  assert.equal((await start('USDOT 1234567 Louisiana insurance')).session.hub,'move');
});
