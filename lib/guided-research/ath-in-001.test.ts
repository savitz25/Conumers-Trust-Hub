import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';
import { decideNameCandidateSearch } from '../network/name-candidates/decision.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});

test('real Guided Research START routes eight Indiana class phrases to state handoffs',async()=>{
  for(const [query,hub] of [
    ['mover Indiana','move'],['plumbing contractor Indiana','contractor'],
    ['mortgage lender Indiana','lender'],['mortgage broker Indiana','lender'],['loan broker Indiana','lender'],
    ['insurance company Indiana','insurance'],['nursing home Indiana','senior'],['investment adviser Indiana','investor'],
  ] as const){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
    const response=await start(query);
    assert.equal(response.session.hub,hub,query);
    assert.equal(response.session.phase,'DEEP_LINK',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'IN',query);
    assert.equal(response.result?.destinations[0]?.href,`https://www.${hub==='move'?'move':hub}trusthub.com/indiana`,query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    assert.doesNotMatch(JSON.stringify(response),/requested local scope is not executable|NO_SPECIALIST_GEOGRAPHY_CAPABILITY/i,query);
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,response.result?.destinations[0]?.href,query);
  }
});

test('Indiana Contractor boundary and Senior taxonomy remain source-native',async()=>{
  for(const query of ['contractor Indiana','electrical contractor Indiana','HVAC contractor Indiana']){
    const response=await start(query);
    assert.equal(response.session.hub,'contractor');
    assert.match(response.result?.consumerMessage??'',/does not license most construction contractors statewide/i);
    assert.doesNotMatch(response.result?.consumerMessage??'',/9,895|statewide electrical roster/i);
  }
  const plumbing=await start('plumbing contractor Indiana');
  assert.match(plumbing.result?.consumerMessage??'',/500 active Indiana-address Plumbing Corporation credential entries/);
  const assisted=await start('assisted living Indiana');
  assert.equal(assisted.session.hub,'senior');
  assert.match(assisted.result?.consumerMessage??'',/Residential Care/);
  assert.doesNotMatch(assisted.result?.consumerMessage??'',/standalone Assisted Living license roster exists/i);
  const nursing=await start('nursing home Indiana');
  assert.match(nursing.result?.consumerMessage??'',/Comprehensive Care/);
});

test('lender, insurance and investor evidence grains remain distinct',async()=>{
  const lender=await start('mortgage lender Indiana');
  assert.match(lender.result?.consumerMessage??'',/490 Indiana DFI Mortgage Lender listing rows \/ 489 distinct companies/);
  assert.match(lender.result?.consumerMessage??'',/not an SOS Loan Broker census or HMDA activity/);
  const broker=await start('loan broker Indiana');
  assert.match(broker.result?.consumerMessage??'',/Loan Broker roster was not acquired/);
  const insurance=await start('insurance company Indiana');
  assert.match(insurance.result?.consumerMessage??'',/enforcement-index rows/);
  assert.match(insurance.result?.consumerMessage??'',/not insurer population or current license authority/);
  const investor=await start('investment adviser Indiana');
  assert.match(investor.result?.consumerMessage??'',/369 Indiana state IA firm CRDs with status APPROVED/);
  assert.match(investor.result?.consumerMessage??'',/distinct from 2,008 federal-covered notice FILED firms/);
});

test('Indiana identifier precedence and state-aware SEC handoff survive execution',async()=>{
  for(const [query,hub,id] of [
    ['USDOT 1234567 Indiana insurance','move','USDOT'],['MC 123456 Indiana lender','move','MC'],
    ['NMLS 3030 Indiana mover','lender','NMLS'],['NAIC 10064 Indiana contractor','insurance','NAIC'],
    ['NPN 20000635 Indiana lender','insurance','NPN'],['CCN 155001 Indiana insurance','senior','CCN'],
    ['CRD 6413 Indiana mover','investor','CRD'],
  ] as const){const response=await start(query);assert.equal(response.session.hub,hub,query);assert.equal(response.session.identifier?.type,id,query);assert.equal(response.result?.destinations[0]?.href,`https://www.${hub}trusthub.com/indiana`,query);}
  const sec=await start('SEC 801-12345 Indiana');
  assert.equal(sec.session.hub,'investor');
  assert.equal(sec.session.identifier?.type,'SEC');
  assert.equal(sec.result?.destinations[0]?.href,'https://www.investortrusthub.com/indiana');
  assert.match(sec.result?.consumerMessage??'',/InvestorTrustHub Indiana/);
  assert.doesNotMatch(sec.result?.consumerMessage??'',/Michigan|Maryland|Wisconsin/);
});

test('Indiana city names stay context and ranking or bare numbers cannot execute',async()=>{
  for(const city of ['Indianapolis','Fort Wayne','Evansville','South Bend']){
    const response=await start(`nursing home ${city} Indiana`);
    assert.equal(response.session.hub,'senior');
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'IN');
    assert.equal(response.result?.executionOccurred,false);
    assert.match(response.result?.consumerMessage??'',/context only/i);
    assert.doesNotMatch(JSON.stringify(response),/indiana\/(?:indianapolis|fort-wayne|evansville|south-bend)/i);
  }
  await assert.rejects(start('1234567'),/not_guided_query/);
  for(const query of ['best Indiana mover','safest Indiana contractor','recommended Indiana lender','most trustworthy Indiana insurance agency','top-rated Indiana nursing home','highest-rated Indiana adviser','AggregateRating Indiana lender','Trust Score Indiana contractor']){
    const response=await start(query);
    assert.notEqual(response.session.phase,'REFINE',query);
    assert.equal(response.result?.executionOccurred??false,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
  }
});

test('Wisconsin, Maryland, Connecticut, Michigan and Minnesota execution paths remain intact',async()=>{
  assert.equal((await start('adult family home Wisconsin')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/wisconsin');
  assert.equal((await start('assisted living Maryland')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/maryland');
  assert.equal((await start('SEC 801-12345 Maryland')).result?.destinations[0]?.href,'https://www.investortrusthub.com/maryland');
  assert.equal((await start('SEC 801-12345 Connecticut')).result?.destinations[0]?.href,'https://www.investortrusthub.com/connecticut');
  assert.equal((await start('SEC 801-12345 Michigan')).result?.destinations[0]?.href,'https://www.investortrusthub.com/michigan');
  assert.equal((await start('SEC 801-12345 Minnesota')).result?.destinations[0]?.href,'https://www.investortrusthub.com/minnesota');
  assert.equal((await start('USDOT 1234567 Michigan insurance')).session.hub,'move');
});
