import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';
import { decideNameCandidateSearch } from '../network/name-candidates/decision.ts';
import { kySpecialistUrl } from '../network/ky-network.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});

test('real Guided Research START routes Kentucky class phrases to state handoffs',async()=>{
  for(const [query,hub] of [
    ['mover Kentucky','move'],['plumbing contractor Kentucky','contractor'],
    ['mortgage lender Kentucky','lender'],['loan broker Kentucky','lender'],
    ['insurance company Kentucky','insurance'],['nursing home Kentucky','senior'],['investment adviser Kentucky','investor'],
  ] as const){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
    const response=await start(query);
    assert.equal(response.session.hub,hub,query);
    assert.equal(response.session.phase,'DEEP_LINK',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'KY',query);
    assert.equal(response.result?.destinations[0]?.href,kySpecialistUrl(hub),query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    assert.doesNotMatch(JSON.stringify(response),/requested local scope is not executable|NO_SPECIALIST_GEOGRAPHY_CAPABILITY/i,query);
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,response.result?.destinations[0]?.href,query);
  }
});

test('Kentucky contractor, senior, lender, insurance and investor grains stay separate',async()=>{
  for(const query of ['contractor Kentucky','electrical contractor Kentucky','HVAC contractor Kentucky','plumbing contractor Kentucky']){
    const response=await start(query);
    assert.equal(response.session.hub,'contractor');
    assert.match(response.result?.consumerMessage??'',/8,360 Active Kentucky DHBC electrical, HVAC, and plumbing license rows/);
    assert.match(response.result?.consumerMessage??'',/not a company census and not a statewide general-contractor count/);
  }
  const general=await start('general contractor Kentucky');
  assert.match(general.result?.consumerMessage??'',/no statewide general contractor license/);
  const nursing=await start('nursing home Kentucky');
  assert.match(nursing.result?.consumerMessage??'',/312 Kentucky long-term care facility rows/);
  assert.match(nursing.result?.consumerMessage??'',/not one Kentucky senior total/);
  const assisted=await start('assisted living Kentucky');
  assert.equal(assisted.session.hub,'senior');
  assert.match(assisted.result?.consumerMessage??'',/247 assisted-living type rows/);
  const lender=await start('mortgage lender Kentucky');
  assert.match(lender.result?.consumerMessage??'',/1,929 Kentucky mortgage company and branch rows/);
  assert.match(lender.result?.consumerMessage??'',/not a distinct-company count/);
  assert.match(lender.result?.consumerMessage??'',/172,675 applications/);
  const insurance=await start('insurance company Kentucky');
  assert.match(insurance.result?.consumerMessage??'',/1,734 Kentucky domestic and licensed foreign insurers/);
  assert.match(insurance.result?.consumerMessage??'',/inside the 1,734, not added to it/);
  const investor=await start('investment adviser Kentucky');
  assert.match(investor.result?.consumerMessage??'',/150 Kentucky state IA firm CRDs with status APPROVED/);
  assert.match(investor.result?.consumerMessage??'',/1,528 federal notice FILED firms/);
  assert.match(investor.result?.consumerMessage??'',/not dropped/);
  const move=await start('mover Kentucky');
  assert.match(move.result?.consumerMessage??'',/not FMCSA interstate authority/);
  assert.match(move.result?.consumerMessage??'',/not proof of current insurance or tariff compliance/);
  const combined=await start('how many Kentucky senior facilities');
  assert.equal(combined.result?.executionOccurred??false,false);
  assert.match(JSON.stringify(combined),/cannot be summed/);
  assert.doesNotMatch(JSON.stringify(combined),/1,173|1,174|1,678/);
});

test('Kentucky identifier precedence survives execution',async()=>{
  for(const [query,hub,id] of [
    ['USDOT 1234567 Kentucky insurance','move','USDOT'],['MC 123456 Kentucky lender','move','MC'],
    ['NMLS 3030 Kentucky mover','lender','NMLS'],['NAIC 10064 Kentucky contractor','insurance','NAIC'],
    ['NPN 20000635 Kentucky lender','insurance','NPN'],['CCN 155001 Kentucky insurance','senior','CCN'],
    ['CRD 6413 Kentucky mover','investor','CRD'],
  ] as const){const response=await start(query);assert.equal(response.session.hub,hub,query);assert.equal(response.session.identifier?.type,id,query);assert.equal(response.result?.destinations[0]?.href,kySpecialistUrl(hub),query);}
  const sec=await start('SEC 801-12345 Kentucky');
  assert.equal(sec.session.hub,'investor');
  assert.equal(sec.session.identifier?.type,'SEC');
  assert.equal(sec.result?.destinations[0]?.href,'https://www.investortrusthub.com/kentucky');
  assert.match(sec.result?.consumerMessage??'',/InvestorTrustHub Kentucky/);
});

test('Kentucky city names stay context and ranking or bare numbers cannot execute',async()=>{
  for(const city of ['Louisville','Lexington']){
    const response=await start(`nursing home ${city} Kentucky`);
    assert.equal(response.session.hub,'senior');
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'KY');
    assert.equal(response.result?.executionOccurred,false);
    assert.match(response.result?.consumerMessage??'',/context only/i);
    assert.doesNotMatch(JSON.stringify(response),/kentucky\/(?:louisville|lexington)/i);
  }
  await assert.rejects(start('1234567'),/not_guided_query/);
  for(const query of ['best Kentucky mover','safest Kentucky contractor','recommended Kentucky lender','most trustworthy Kentucky insurance agency','top-rated Kentucky nursing home','highest-rated Kentucky adviser','AggregateRating Kentucky lender','Trust Score Kentucky contractor']){
    const response=await start(query);
    assert.notEqual(response.session.phase,'REFINE',query);
    assert.equal(response.result?.executionOccurred??false,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
  }
});

test('Louisiana, Indiana and Wisconsin execution paths remain intact',async()=>{
  assert.equal((await start('nursing home Louisiana')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/louisiana');
  assert.equal((await start('nursing home Indiana')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/indiana');
  assert.equal((await start('adult family home Wisconsin')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/wisconsin');
  assert.equal((await start('USDOT 1234567 Indiana insurance')).session.hub,'move');
});
