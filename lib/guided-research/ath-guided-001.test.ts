import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuidedSession, validateGuidedSession } from './session.ts';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { GUIDED_SESSION_VERSION, GUIDED_SESSION_TTL_MS } from './contract.ts';

const originalFetch=globalThis.fetch;
let lastMoveBody:Record<string,unknown>|undefined;
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
globalThis.fetch=async(input,init)=>{
  const url=String(input);const body=JSON.parse(String(init?.body??'{}'));
  if(url.includes('seniortrusthub')){
    if(body.providerClass==='home_health'&&body.geography?.type==='county')return json({contract:'trusthub-specialist-execution-v2',status:'unsupported_capability',errorCode:'unsupported_home_health_county_geography',message:'Home Health county execution is unsupported.',limitation:'Office location is not service area.'},422);
    const noMatch=body.identifier==='105502';
    return json({contract:'trusthub-specialist-execution-v2',status:'ok',rows:noMatch?[]:[{providerClass:body.providerClass??'nursing_home',name:'CMS Research Facility',cmsCcn:body.identifier??'105411',recordedLocation:{city:'Boca Raton',state:'FL',zip:'33432'},status:'Current CMS record',evidence:{overall_rating:4,staffing_rating:3},canonicalProfileUrl:'https://www.seniortrusthub.com/providers/105411'}],total:noMatch?0:body.geography?.type==='county'?54:694,pagination:{page:1,pageSize:24,hasMore:true},provenance:{sourceFamily:'CMS Care Compare'},limitations:['Recorded location is not service area.']});
  }
  if(url.includes('contractortrusthub')){
    if(body.trade==='electrical')return json({contract:'trusthub-specialist-execution-v2',hub:'contractor',status:'unsupported_capability',errorCode:'unsupported_florida_electrical_source',resolvedGeography:{state:'FL',county:'Palm Beach',city:'Boca Raton'},supportedAlternatives:[{label:'Verify with Florida regulator',destination:'https://www.myfloridalicense.com/'}],limitation:'No Florida electrical source; no substitute rows.'},422);
    return json({contract:'trusthub-specialist-execution-v2',hub:'contractor',rows:[{name:'Source Contractor',credentialNumber:'CCC123',trade:body.trade,status:'active',recordedGeography:{city:'Fort Lauderdale',county:'Broward',state:'FL'},source:{observedAt:'2026-08-01'},destination:'https://www.contractortrusthub.com/contractors/source-contractor'}],total:12,pagination:{page:1,limit:10,totalPages:2},availableRefinements:[{field:'credentialStatus',values:['active_current','expired']}],provenance:{source:'Florida DBPR'},limitations:['Credential is not endorsement.','Recorded geography is not service territory.']});
  }
  if(url.includes('movetrusthub')){
    lastMoveBody=body;
    if(body.geography?.intent==='SERVICE_TERRITORY')return json({contract:'trusthub-specialist-execution-v2',contractVersion:'trusthub-specialist-execution-v2',resultType:'UNSUPPORTED_CAPABILITY',rows:[],total:0,limitations:['Service territory and route availability are not source-backed.'],destinations:{research:'https://www.movetrusthub.com/companies?state=NY',verifyDot:'https://www.movetrusthub.com/verify-dot'}});
    const noMatch=body.identityName==='Sunshine State Movers';
    return json({contract:'trusthub-specialist-execution-v2',contractVersion:'trusthub-specialist-execution-v2',resultType:noMatch?'ZERO_MATCHING_ROWS':'SUPPORTED_RESULTS',rows:noMatch?[]:[{publicDisplayName:'Source Mover',canonicalProfileUrl:'https://www.movetrusthub.com/companies/source-mover',usdot:'3244649',mc:'1019808',role:body.role??'Carrier',authorityState:'Current authority recorded',recordedHq:{raw:body.geography?.stateCode==='NY'?'Albany, NY':'Miami, FL'},sourceLastChecked:'2026-08-20',whyMatched:'Matched source-owned Move filters.'}],total:noMatch?0:body.entityClass==='auto_transport'?6:246,pagination:{page:1,limit:10,hasMore:true},availableRefinements:[{id:'role',values:['Carrier','Broker'],meaning:'Regulatory role only.'}],provenance:{sourceFamily:'FMCSA'},limitations:['Headquarters is not service territory.','Broker is not necessarily the transporting carrier.']});
  }
  return json({},503);
};
test.after(()=>{globalThis.fetch=originalFetch;});

test('session contract is versioned, ephemeral, validated, resettable, and action based',async()=>{
  const start=createGuidedSession('need help finding a home for my grandma')!;
  assert.equal(start.version,GUIDED_SESSION_VERSION);assert.ok(start.sessionId);assert.equal(validateGuidedSession(start)?.sessionId,start.sessionId);
  assert.equal(validateGuidedSession({...start,version:'old'}),null);
  assert.equal(validateGuidedSession({...start,updatedAt:new Date(Date.now()-GUIDED_SESSION_TTL_MS-1).toISOString()}),null);
  assert.ok(start.availableChoices.every(choice=>choice.action==='SELECT_CHOICE'&&!('href' in choice)));
  const selected=await orchestrateGuidedResearch({session:start,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
  assert.equal(selected.session.providerClass,'nursing_home');assert.deepEqual(selected.session.selectedFilters,{});assert.equal(selected.session.phase,'COLLECT');
  const back=await orchestrateGuidedResearch({session:selected.session,action:{type:'BACK'}});assert.equal(back.session.providerClass,undefined);
  const reset=await orchestrateGuidedResearch({session:selected.session,action:{type:'RESET'}});assert.equal(reset.session.phase,'CLARIFY');
  const resumed=await orchestrateGuidedResearch({session:selected.session,action:{type:'RESUME'}});assert.equal(resumed.session.phase,'COLLECT');assert.equal(resumed.diagnostics.specialistCalls,0);
});

test('complete direct queries bypass clarification while incomplete identities retain their flow',async()=>{
  for(const query of ['moving company in Dallas Texas','movers in New York','nursing homes in Florida','nursing homes in Palm Beach County','roofers in Broward','HVAC contractors in Florida','auto transport companies in New York','USDOT 3244649','CMS CCN 105411']){
    const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});
    assert.ok(response.result,query);assert.equal(response.diagnostics.specialistCalls,1,query);assert.notEqual(response.session.phase,'CLARIFY',query);
  }
  const identity=await orchestrateGuidedResearch({action:{type:'START',question:'SHIFL'}});assert.equal(identity.session.hub,'move');assert.ok(identity.result);
  const exact=await orchestrateGuidedResearch({action:{type:'START',question:'USDOT 3244649'}});assert.equal(exact.result?.resultState,'SUPPORTED_RESULTS');assert.equal(lastMoveBody?.entityClass,'mover');
  const restored=await orchestrateGuidedResearch({session:exact.session,action:{type:'RESUME'}});assert.equal(restored.result?.resultState,'SUPPORTED_RESULTS');assert.equal(restored.diagnostics.specialistCalls,1);
});

test('Senior life situation asks class then geography and executes class-separated evidence',async()=>{
  const start=await orchestrateGuidedResearch({action:{type:'START',question:'need help finding a home for my grandma'}});
  assert.equal(start.session.hub,'senior');assert.equal(start.session.phase,'CLARIFY');assert.equal(start.session.nextAction,'What kind of care are you looking for?');
  assert.ok(!start.session.availableChoices.some(choice=>/move/i.test(choice.label)));
  const nursing=await orchestrateGuidedResearch({session:start.session,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
  assert.equal(nursing.session.providerClass,'nursing_home');assert.ok(nursing.session.missingFields.includes('geography'));
  const florida=await orchestrateGuidedResearch({session:nursing.session,action:{type:'SET_GEOGRAPHY',value:'Florida'}});
  assert.equal(florida.result?.resultState,'SUPPORTED_RESULTS');assert.equal(florida.result?.total,694);assert.equal(florida.result?.rows[0].identifier?.label,'CMS CCN');
  assert.ok(florida.result?.refinements.some(row=>row.id==='staffingStars'));assert.ok(!florida.result?.consumerMessage.match(/best|recommended/i));
  const home=await orchestrateGuidedResearch({session:start.session,action:{type:'SELECT_CHOICE',value:'home_health'}});
  assert.equal(home.session.providerClass,'home_health');assert.equal(home.session.selectedFilters.overallStars,undefined);
  const hospice=await orchestrateGuidedResearch({session:start.session,action:{type:'SELECT_CHOICE',value:'hospice'}});assert.equal(hospice.session.providerClass,'hospice');
});

test('Senior supported county, unsupported Home Health county, and CCN fixtures remain distinct',async()=>{
  const palm=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Palm Beach County'}});assert.equal(palm.result?.total,54);
  let hh=await orchestrateGuidedResearch({action:{type:'START',question:'home health in Florida'}});
  hh=await orchestrateGuidedResearch({session:{...hh.session,phase:'COLLECT',missingFields:['geography']},action:{type:'SET_GEOGRAPHY',value:'Palm Beach County'}});
  assert.equal(hh.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(hh.result?.total,0);
  const exact=await orchestrateGuidedResearch({action:{type:'START',question:'CMS CCN 105411'}});assert.equal(exact.result?.resultState,'SUPPORTED_RESULTS');
  const absent=await orchestrateGuidedResearch({action:{type:'START',question:'CMS CCN 105502'}});assert.equal(absent.result?.resultState,'ZERO_MATCHING_ROWS');assert.equal(absent.result?.rows.length,0);
});

test('Contractor collects missing trade/geography and executes supported Florida DBPR scope',async()=>{
  const roofer=await orchestrateGuidedResearch({action:{type:'START',question:'I need a roofer'}});assert.equal(roofer.session.hub,'contractor');assert.deepEqual(roofer.session.missingFields,['geography']);
  const broward=await orchestrateGuidedResearch({session:roofer.session,action:{type:'SET_GEOGRAPHY',value:'Broward'}});
  assert.equal(broward.result?.resultState,'SUPPORTED_RESULTS');assert.equal(broward.result?.rows[0].identifier?.value,'CCC123');
  assert.ok(broward.result?.limitations.some(value=>/not endorsement/i.test(value)));assert.ok(broward.result?.limitations.some(value=>/not service territory/i.test(value)));
  const generic=await orchestrateGuidedResearch({action:{type:'START',question:'I need a contractor'}});assert.deepEqual(generic.session.missingFields,['trade']);assert.ok(generic.session.availableChoices.some(choice=>choice.value==='plumbing'));assert.ok(!generic.session.availableChoices.some(choice=>choice.value==='electrical'));
  for(const query of ['HVAC contractors in Florida','plumbers in Florida']){const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});assert.equal(response.result?.resultState,'SUPPORTED_RESULTS');}
});

test('Florida electrical resolves Boca/Palm Beach but renders unsupported without substitute rows',async()=>{
  const response=await orchestrateGuidedResearch({action:{type:'START',question:'electrical contractor in Boca Raton'}});
  assert.equal(response.session.hub,'contractor');assert.equal(response.session.trade,'electrical');assert.equal(response.session.geography?.city,'Boca Raton');
  assert.equal(response.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(response.result?.rows.length,0);assert.match(response.result?.consumerMessage??'',/does not include Florida electrical credentials/);
  assert.ok(response.result?.destinations.every(row=>!row.href.includes('/contractors/source-contractor')));
});

test('Move clarifies mode, executes Auto Transport without route geography, and preserves role refinements',async()=>{
  const movers=await orchestrateGuidedResearch({action:{type:'START',question:'I need movers'}});
  assert.equal(movers.session.phase,'CLARIFY');assert.equal(movers.session.nextAction,'What are you moving?');assert.ok(movers.session.availableChoices.some(choice=>choice.value==='auto_transport'));
  const auto=await orchestrateGuidedResearch({action:{type:'START',question:'I need someone to ship my car'}});
  assert.equal(auto.session.moveMode,'auto_transport');assert.equal(auto.result?.resultState,'SUPPORTED_RESULTS');assert.equal(auto.result?.total,6);
  assert.ok(auto.result?.refinements.some(row=>row.id==='role'));assert.ok(auto.result?.limitations.some(value=>/not service territory/i.test(value)));
  const ny=await orchestrateGuidedResearch({action:{type:'START',question:'auto transport carriers in New York'}});
  assert.equal(ny.session.regulatoryRole,'Carrier');assert.equal(ny.session.geography?.stateCode,'NY');assert.equal(ny.result?.rows[0].classLabel,'Carrier');
});

test('Move service-territory and route availability fail closed usefully',async()=>{
  for(const query of ['I need movers serving New York','ship my car from Florida to New York']){
    const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});
    assert.equal(response.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(response.result?.rows.length,0);assert.ok(response.result?.destinations.length);assert.ok(response.result?.limitations.some(value=>/not source-backed/i.test(value)));
  }
});

test('result states, deep links, refinements, and safety invariants remain explicit',async()=>{
  const supported=await orchestrateGuidedResearch({action:{type:'START',question:'roofers in Broward'}});
  assert.equal(supported.result?.resultState,'SUPPORTED_RESULTS');assert.ok(supported.result?.rows.every(row=>/^https:\/\//.test(row.destination.href)));assert.ok(supported.result?.rows.every(row=>!row.destination.href.includes('#')));
  const zero=await orchestrateGuidedResearch({action:{type:'START',question:'Sunshine State Movers'}});
  assert.equal(zero.result?.resultState,'ZERO_MATCHING_ROWS');assert.notEqual(zero.result?.resultState,'UNSUPPORTED_CAPABILITY');
  const serialized=JSON.stringify(supported);
  for(const forbidden of ['reputation_score','Trust Score','paidStatus','subscriptionStatus','internalId'])assert.ok(!serialized.includes(forbidden));
  assert.equal(supported.diagnostics.specialistCalls,1);assert.equal(supported.result?.firstUsefulResult,true);
});

test('absolute metrics remain zero by construction',()=>{
  const source=[createGuidedSession.toString(),orchestrateGuidedResearch.toString()].join('\n');
  assert.equal(/localStorage|INSERT INTO|supabase.*insert/i.test(source),false);
  assert.equal(/six.?hub.?fan.?out/i.test(source),false);
  assert.equal(/paid.*(?:boost|order)|universal.*score|recommended provider/i.test(source),false);
});
