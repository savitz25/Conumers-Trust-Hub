import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';
import { decideNameCandidateSearch } from '../network/name-candidates/decision.ts';
import { scSpecialistUrl } from '../network/sc-network.ts';

const start=(question:string)=>orchestrateGuidedResearch({action:{type:'START',question}});

test('real Guided Research START routes South Carolina class phrases to state handoffs',async()=>{
  for(const [query,hub] of [
    ['mover South Carolina','move'],['plumbing contractor South Carolina','contractor'],
    ['mortgage lender South Carolina','lender'],['mortgage servicer South Carolina','lender'],
    ['insurance company South Carolina','insurance'],['nursing home South Carolina','senior'],['investment adviser South Carolina','investor'],
  ] as const){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
    const response=await start(query);
    assert.equal(response.session.hub,hub,query);
    assert.equal(response.session.phase,'DEEP_LINK',query);
    assert.equal(response.session.researchPlan.requestedGeography?.stateCode,'SC',query);
    assert.equal(response.result?.destinations[0]?.href,scSpecialistUrl(hub),query);
    assert.equal(response.result?.executionOccurred,false,query);
    assert.equal(response.diagnostics.specialistCalls,0,query);
    const initial=createGuidedSession(query)!;
    assert.equal(initial.phase,'DEEP_LINK',query);
    const resumed=await orchestrateGuidedResearch({session:initial,action:{type:'EXECUTE'}});
    assert.equal(resumed.result?.destinations[0]?.href,response.result?.destinations[0]?.href,query);
  }
});

test('South Carolina grains stay separate',async()=>{
  const move=await start('mover South Carolina');
  assert.match(move.result?.consumerMessage??'',/150 Class E household-goods certificate rows/);
  assert.match(move.result?.consumerMessage??'',/not household goods/);
  assert.doesNotMatch(move.result?.consumerMessage??'',/\b153\b/);
  const contractor=await start('contractor South Carolina');
  assert.match(contractor.result?.consumerMessage??'',/not one South Carolina contractor census/);
  assert.match(contractor.result?.consumerMessage??'',/1,60/);
  assert.doesNotMatch(contractor.result?.consumerMessage??'',/49,?355|23,?796/);
  const senior=await start('assisted living South Carolina');
  assert.match(senior.result?.consumerMessage??'',/not an assisted-living census/);
  assert.match(senior.result?.consumerMessage??'',/not one senior population/);
  assert.doesNotMatch(senior.result?.consumerMessage??'',/2,?400|2,?336|\b111\b|-1,?403/);
  const lender=await start('mortgage lender South Carolina');
  assert.match(lender.result?.consumerMessage??'',/564 SC-BFI/);
  assert.match(lender.result?.consumerMessage??'',/not licensure/);
  const insurance=await start('insurance company South Carolina');
  assert.match(insurance.result?.consumerMessage??'',/are not added to 2,229/);
  assert.doesNotMatch(insurance.result?.consumerMessage??'',/2,?509|2,?512|2,?546/);
  const investor=await start('investment adviser South Carolina');
  assert.match(investor.result?.consumerMessage??'',/320 South Carolina state-registered IA firm CRDs with status APPROVED/);
  assert.match(investor.result?.consumerMessage??'',/not a finding census/);
  assert.doesNotMatch(investor.result?.consumerMessage??'',/\b123\b/);
});

test('South Carolina cities stay context and bare sc does not route',async()=>{
  for(const city of ['Charleston','Columbia','Greenville']){
    const response=await start(`nursing home ${city}, South Carolina`);
    assert.equal(response.session.hub,'senior');
    assert.match(response.result?.consumerMessage??'',/context only/i);
    assert.doesNotMatch(JSON.stringify(response),/south-carolina\/(?:charleston|columbia|greenville)/i);
    const bare=await start(`nursing home ${city}`);
    assert.notEqual(bare.session.phase,'DEEP_LINK',city);
    assert.notEqual(bare.session.researchPlan.requestedGeography?.stateCode,'SC',city);
    assert.doesNotMatch(JSON.stringify(bare),/south-carolina/i,city);
  }
  const bareSc=await start('mover sc');
  assert.notEqual(bareSc.session.researchPlan.requestedGeography?.stateCode,'SC');
  assert.doesNotMatch(JSON.stringify(bareSc),/south-carolina|150 Class E/);
  const insc=await start('investment adviser in sc');
  assert.equal(insc.session.hub,'investor');
  assert.match(insc.result?.consumerMessage??'',/320 South Carolina state-registered/);
  assert.equal((await start('nursing home Alabama')).result?.destinations[0]?.href,'https://www.seniortrusthub.com/alabama');
});
