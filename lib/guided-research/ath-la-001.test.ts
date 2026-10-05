import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';
import { decideNameCandidateSearch } from '../network/name-candidates/decision.ts';
import { laSpecialistUrl } from '../network/la-network.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});

test('real Guided Research START routes Louisiana class phrases to state handoffs',async()=>{
  for(const [query,hub] of [
    ['mover Louisiana','move'],['plumbing contractor Louisiana','contractor'],
    ['mortgage lender Louisiana','lender'],['loan broker Louisiana','lender'],
    ['insurance company Louisiana','insurance'],['nursing home Louisiana','senior'],['investment adviser Louisiana','investor'],
  ] as const){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
    const response=await start(query);
    assert.equal(response.session.hub,hub,query);
    assert.equal(response.session.phase,'DEEP_LINK',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'LA',query);
    assert.equal(response.result?.destinations[0]?.href,laSpecialistUrl(hub),query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    assert.doesNotMatch(JSON.stringify(response),/requested local scope is not executable|NO_SPECIALIST_GEOGRAPHY_CAPABILITY/i,query);
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,response.result?.destinations[0]?.href,query);
  }
});

test('Louisiana contractor, senior, lender, insurance and investor grains stay separate',async()=>{
  for(const query of ['contractor Louisiana','electrical contractor Louisiana','HVAC contractor Louisiana','plumbing contractor Louisiana']){
    const response=await start(query);
    assert.equal(response.session.hub,'contractor');
    assert.match(response.result?.consumerMessage??'',/26,369 is the certificate-row total, not a company census/);
    assert.match(response.result?.consumerMessage??'',/Plumbing Board person licenses were not acquired/);
  }
  const nursing=await start('nursing home Louisiana');
  assert.match(nursing.result?.consumerMessage??'',/266 nursing-home rows/);
  assert.match(nursing.result?.consumerMessage??'',/not one combined senior total/);
  const assisted=await start('assisted living Louisiana');
  assert.equal(assisted.session.hub,'senior');
  assert.match(assisted.result?.consumerMessage??'',/164 adult residential care/);
  const lender=await start('mortgage lender Louisiana');
  assert.match(lender.result?.consumerMessage??'',/9,812 Louisiana OFI originator-under-lender row items/);
  assert.match(lender.result?.consumerMessage??'',/not added to 9,812/);
  assert.match(lender.result?.consumerMessage??'',/132,458 applications/);
  const insurance=await start('insurance company Louisiana');
  assert.match(insurance.result?.consumerMessage??'',/1,926 risk-bearing category entries and 862 non-risk-bearing registration entries/);
  assert.match(insurance.result?.consumerMessage??'',/2,788 is the printed FY2025 sum only/);
  assert.match(insurance.result?.consumerMessage??'',/not a company census and not a producer census/);
  const investor=await start('investment adviser Louisiana');
  assert.match(investor.result?.consumerMessage??'',/617 Louisiana state IA firm CRDs with status APPROVED/);
  assert.match(investor.result?.consumerMessage??'',/3,348 federal notice FILED firms/);
  assert.match(investor.result?.consumerMessage??'',/not dropped from either side/);
  const move=await start('mover Louisiana');
  assert.match(move.result?.consumerMessage??'',/not a mover census and not an insurance-minimum figure/);
  assert.match(move.result?.consumerMessage??'',/July 12, 2013/);
});

test('Louisiana identifier precedence survives execution',async()=>{
  for(const [query,hub,id] of [
    ['USDOT 1234567 Louisiana insurance','move','USDOT'],['MC 123456 Louisiana lender','move','MC'],
    ['NMLS 3030 Louisiana mover','lender','NMLS'],['NAIC 10064 Louisiana contractor','insurance','NAIC'],
    ['NPN 20000635 Louisiana lender','insurance','NPN'],['CCN 155001 Louisiana insurance','senior','CCN'],
    ['CRD 6413 Louisiana mover','investor','CRD'],
  ] as const){const response=await start(query);assert.equal(response.session.hub,hub,query);assert.equal(response.session.identifier?.type,id,query);assert.equal(response.result?.destinations[0]?.href,laSpecialistUrl(hub),query);}
  const sec=await start('SEC 801-12345 Louisiana');
  assert.equal(sec.session.hub,'investor');
  assert.equal(sec.session.identifier?.type,'SEC');
  assert.equal(sec.result?.destinations[0]?.href,'https://www.investortrusthub.com/louisiana');
  assert.match(sec.result?.consumerMessage??'',/InvestorTrustHub Louisiana/);
});

test('Louisiana city names stay context and ranking or bare numbers cannot execute',async()=>{
  for(const city of ['New Orleans','Baton Rouge','Shreveport','Lafayette']){
    const response=await start(`nursing home ${city} Louisiana`);
    assert.equal(response.session.hub,'senior');
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'LA');
    assert.equal(response.result?.executionOccurred,false);
    assert.match(response.result?.consumerMessage??'',/context only/i);
    assert.doesNotMatch(JSON.stringify(response),/louisiana\/(?:new-orleans|baton-rouge|shreveport|lafayette)/i);
  }
  await assert.rejects(start('1234567'),/not_guided_query/);
  for(const query of ['best Louisiana mover','safest Louisiana contractor','recommended Louisiana lender','most trustworthy Louisiana insurance agency','top-rated Louisiana nursing home','highest-rated Louisiana adviser','AggregateRating Louisiana lender','Trust Score Louisiana contractor']){
    const response=await start(query);
    assert.notEqual(response.session.phase,'REFINE',query);
    assert.equal(response.result?.executionOccurred??false,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
  }
});

test('Indiana and Wisconsin execution paths remain intact',async()=>{
  assert.equal((await start('nursing home Indiana')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/indiana');
  assert.equal((await start('adult family home Wisconsin')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/wisconsin');
  assert.equal((await start('USDOT 1234567 Indiana insurance')).session.hub,'move');
});
