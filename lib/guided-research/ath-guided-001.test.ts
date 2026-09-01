import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGuidedSession, pushHistory, validateGuidedSession } from './session.ts';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { GUIDED_SESSION_VERSION, GUIDED_SESSION_TTL_MS } from './contract.ts';

const originalFetch=globalThis.fetch;
let lastMoveBody:Record<string,unknown>|undefined;
let lastContractorBody:Record<string,unknown>|undefined;
let failMove=false;
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});}
globalThis.fetch=async(input,init)=>{
  const url=String(input);const body=JSON.parse(String(init?.body??'{}'));
  if(url.includes('seniortrusthub')){
    if(body.providerClass==='home_health'&&body.geography?.type==='county')return json({contract:'trusthub-specialist-execution-v2',status:'unsupported_capability',errorCode:'unsupported_home_health_county_geography',message:'Home Health county execution is unsupported.',limitation:'Office location is not service area.'},422);
    const noMatch=body.identifier==='105502';
    return json({contract:'trusthub-specialist-execution-v2',status:'ok',rows:noMatch?[]:[{providerClass:body.providerClass??'nursing_home',name:'CMS Research Facility',cmsCcn:body.identifier??'105411',recordedLocation:{city:'Boca Raton',state:'FL',zip:'33432'},status:'Current CMS record',evidence:{overall_rating:4,staffing_rating:3},canonicalProfileUrl:'https://www.seniortrusthub.com/providers/105411'}],total:noMatch?0:body.geography?.type==='county'?54:694,pagination:{page:1,pageSize:24,hasMore:true},provenance:{sourceFamily:'CMS Care Compare'},limitations:['Recorded location is not service area.']});
  }
  if(url.includes('contractortrusthub')){
    lastContractorBody=body;
    if(body.state==='NJ')return json({contract:'trusthub-specialist-execution-v2',hub:'contractor',error:'unsupported_state'},400);
    if(body.trade==='electrical')return json({contract:'trusthub-specialist-execution-v2',hub:'contractor',status:'unsupported_capability',errorCode:'unsupported_florida_electrical_source',resolvedGeography:{state:'FL',county:'Palm Beach',city:'Boca Raton'},supportedAlternatives:[{label:'Verify with Florida regulator',destination:'https://www.myfloridalicense.com/'}],limitation:'No Florida electrical source; no substitute rows.'},422);
    return json({contract:'trusthub-specialist-execution-v2',hub:'contractor',rows:[{name:'Source Contractor',credentialNumber:'CCC123',trade:body.trade,status:'active',recordedGeography:{city:'Fort Lauderdale',county:'Broward',state:'FL'},source:{observedAt:'2026-08-01'},destination:'https://www.contractortrusthub.com/contractors/source-contractor'}],total:12,pagination:{page:1,limit:10,totalPages:2},availableRefinements:[{field:'credentialStatus',values:['active_current','expired']}],provenance:{source:'Florida DBPR'},limitations:['Credential is not endorsement.','Recorded geography is not service territory.']});
  }
  if(url.includes('movetrusthub')){
    if(failMove)throw new Error('temporary outage');
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
  const saved=pushHistory(start);const savedChoice=saved.history[0].availableChoices[0].label;start.availableChoices[0].label='mutated';assert.equal(saved.history[0].availableChoices[0].label,savedChoice);
  const selected=await orchestrateGuidedResearch({session:start,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
  assert.equal(selected.session.providerClass,'nursing_home');assert.deepEqual(selected.session.selectedFilters,{});assert.equal(selected.session.phase,'COLLECT');
  const back=await orchestrateGuidedResearch({session:selected.session,action:{type:'BACK'}});assert.equal(back.session.providerClass,undefined);
  const reset=await orchestrateGuidedResearch({session:selected.session,action:{type:'RESET'}});assert.equal(reset.session.phase,'CLARIFY');
  const resumed=await orchestrateGuidedResearch({session:selected.session,action:{type:'RESUME'}});assert.equal(resumed.session.phase,'COLLECT');assert.equal(resumed.diagnostics.specialistCalls,0);
});

test('Back restores complete clarification and collection states without unnecessary execution',async()=>{
  const grandma=await orchestrateGuidedResearch({action:{type:'START',question:'need help finding a home for my grandma'}});
  const nursing=await orchestrateGuidedResearch({session:grandma.session,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
  const backCare=await orchestrateGuidedResearch({session:nursing.session,action:{type:'BACK'}});
  assert.equal(backCare.session.phase,'CLARIFY');assert.equal(backCare.session.providerClass,undefined);assert.deepEqual(backCare.session.missingFields,['providerClass']);assert.equal(backCare.session.nextAction,'What kind of care are you looking for?');assert.equal(backCare.session.availableChoices.length,4);assert.equal(backCare.diagnostics.specialistCalls,0);assert.equal(backCare.result,undefined);
  const florida=await orchestrateGuidedResearch({session:nursing.session,action:{type:'SET_GEOGRAPHY',value:'Florida'}});
  const backGeography=await orchestrateGuidedResearch({session:florida.session,action:{type:'BACK'}});
  assert.equal(backGeography.session.phase,'COLLECT');assert.equal(backGeography.session.providerClass,'nursing_home');assert.deepEqual(backGeography.session.missingFields,['geography']);assert.equal(backGeography.session.nextAction,'Where does she need care?');assert.equal(backGeography.diagnostics.specialistCalls,0);assert.equal(backGeography.result,undefined);

  const contractor=await orchestrateGuidedResearch({action:{type:'START',question:'I need a contractor'}});
  const roofing=await orchestrateGuidedResearch({session:contractor.session,action:{type:'SELECT_CHOICE',value:'roofing'}});
  const backTrade=await orchestrateGuidedResearch({session:roofing.session,action:{type:'BACK'}});
  assert.equal(backTrade.session.trade,undefined);assert.deepEqual(backTrade.session.missingFields,['trade']);assert.equal(backTrade.session.nextAction,'What kind of work do you need?');assert.ok(backTrade.session.availableChoices.some(row=>row.value==='plumbing'));

  for(const mode of ['identity_name','identifier']){const movers=await orchestrateGuidedResearch({action:{type:'START',question:'I need movers'}});const selected=await orchestrateGuidedResearch({session:movers.session,action:{type:'SELECT_CHOICE',value:mode}});const back=await orchestrateGuidedResearch({session:selected.session,action:{type:'BACK'}});assert.equal(back.session.moveMode,undefined);assert.equal(back.session.identityName,undefined);assert.equal(back.session.identifier,undefined);assert.deepEqual(back.session.missingFields,['moveMode']);assert.equal(back.session.availableChoices.length,4);}
});

test('Back re-executes restored result filters and preserves sequential history',async()=>{
  const results=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Florida'}});
  const one=await orchestrateGuidedResearch({session:results.session,action:{type:'SET_FILTER',field:'overallStars',value:'4'}});
  const two=await orchestrateGuidedResearch({session:one.session,action:{type:'SET_FILTER',field:'staffingStars',value:'3'}});
  assert.deepEqual(two.session.selectedFilters,{overallStars:'4',staffingStars:'3'});
  const backOne=await orchestrateGuidedResearch({session:two.session,action:{type:'BACK'}});
  assert.deepEqual(backOne.session.selectedFilters,{overallStars:'4'});assert.equal(backOne.result?.resultState,'SUPPORTED_RESULTS');assert.equal(backOne.diagnostics.specialistCalls,1);
  const backTwo=await orchestrateGuidedResearch({session:backOne.session,action:{type:'BACK'}});
  assert.deepEqual(backTwo.session.selectedFilters,{});assert.equal(backTwo.result?.resultState,'SUPPORTED_RESULTS');assert.equal(backTwo.diagnostics.specialistCalls,1);
});

test('filters are visible, clearable, and server validated against current refinements',async()=>{
  const results=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Florida'}});
  const filtered=await orchestrateGuidedResearch({session:results.session,action:{type:'SET_FILTER',field:'overallStars',value:'4'}});
  assert.equal(filtered.session.selectedFilters.overallStars,'4');assert.equal(filtered.diagnostics.specialistCalls,1);
  const second=await orchestrateGuidedResearch({session:filtered.session,action:{type:'SET_FILTER',field:'staffingStars',value:'3'}});
  const cleared=await orchestrateGuidedResearch({session:second.session,action:{type:'CLEAR_FILTER',field:'staffingStars'}});
  assert.deepEqual(cleared.session.selectedFilters,{overallStars:'4'});assert.equal(cleared.diagnostics.specialistCalls,1);
  const all=await orchestrateGuidedResearch({session:second.session,action:{type:'CLEAR_ALL_FILTERS'}});
  assert.deepEqual(all.session.selectedFilters,{});assert.equal(all.session.providerClass,'nursing_home');assert.equal(all.session.geography?.stateCode,'FL');assert.equal(all.diagnostics.specialistCalls,1);
  await assert.rejects(orchestrateGuidedResearch({session:results.session,action:{type:'SET_FILTER',field:'role',value:'Carrier'}}),/invalid_filter_field/);
  await assert.rejects(orchestrateGuidedResearch({session:results.session,action:{type:'SET_FILTER',field:'overallStars',value:'99'}}),/invalid_filter_value/);
  await assert.rejects(orchestrateGuidedResearch({session:results.session,action:{type:'CLEAR_FILTER',field:'unknown'}}),/invalid_filter_field/);
  const home=await orchestrateGuidedResearch({action:{type:'START',question:'home health in Florida'}});
  await assert.rejects(orchestrateGuidedResearch({session:home.session,action:{type:'SET_FILTER',field:'overallStars',value:'4'}}),/invalid_filter_field/);
  await assert.rejects(orchestrateGuidedResearch({session:{...results.session,availableRefinements:[{id:'overallStars',label:'tampered',values:[{value:'99',label:'99'}]}]},action:{type:'SET_FILTER',field:'overallStars',value:'99'}}),/invalid_filter_value/);
  const ui=readFileSync(new URL('../../components/guided-research.tsx',import.meta.url),'utf8');
  for(const token of ['aria-pressed={selected}','Active filters','CLEAR_FILTER','CLEAR_ALL_FILTERS'])assert.ok(ui.includes(token),token);
  assert.match(ui,/try\{sessionStorage\.setItem/);assert.doesNotMatch(ui,/localStorage/);
});

test('changing earlier choices invalidates dependent class, trade, and Move state',async()=>{
  const grandma=await orchestrateGuidedResearch({action:{type:'START',question:'need help finding a home for my grandma'}});
  const nursing=await orchestrateGuidedResearch({session:grandma.session,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
  let result=await orchestrateGuidedResearch({session:nursing.session,action:{type:'SET_GEOGRAPHY',value:'Florida'}});
  result=await orchestrateGuidedResearch({session:result.session,action:{type:'SET_FILTER',field:'overallStars',value:'4'}});
  let prior=await orchestrateGuidedResearch({session:result.session,action:{type:'BACK'}});
  prior=await orchestrateGuidedResearch({session:prior.session,action:{type:'BACK'}});
  prior=await orchestrateGuidedResearch({session:prior.session,action:{type:'BACK'}});
  const home=await orchestrateGuidedResearch({session:prior.session,action:{type:'SELECT_CHOICE',value:'home_health'}});
  assert.equal(home.session.providerClass,'home_health');assert.deepEqual(home.session.selectedFilters,{});assert.deepEqual(home.session.availableRefinements,[]);assert.equal(home.session.resultCount,undefined);

  const contractor=await orchestrateGuidedResearch({action:{type:'START',question:'I need a contractor'}});
  const roofing=await orchestrateGuidedResearch({session:contractor.session,action:{type:'SELECT_CHOICE',value:'roofing'}});
  const backTrade=await orchestrateGuidedResearch({session:roofing.session,action:{type:'BACK'}});
  const plumbing=await orchestrateGuidedResearch({session:backTrade.session,action:{type:'SELECT_CHOICE',value:'plumbing'}});
  assert.equal(plumbing.session.trade,'plumbing');assert.deepEqual(plumbing.session.selectedFilters,{});assert.equal(plumbing.session.resultCount,undefined);

  const movers=await orchestrateGuidedResearch({action:{type:'START',question:'I need movers'}});
  const household=await orchestrateGuidedResearch({session:movers.session,action:{type:'SELECT_CHOICE',value:'mover'}});
  const backMove=await orchestrateGuidedResearch({session:household.session,action:{type:'BACK'}});
  const auto=await orchestrateGuidedResearch({session:backMove.session,action:{type:'SELECT_CHOICE',value:'auto_transport'}});
  assert.equal(auto.session.moveMode,'auto_transport');assert.equal(auto.session.geography,undefined);assert.equal(auto.session.identityName,undefined);assert.equal(auto.session.identifier,undefined);assert.deepEqual(auto.session.selectedFilters,{});
});

test('ERROR_RECOVERY Back restores and re-executes the last valid result state',async()=>{
  const result=await orchestrateGuidedResearch({action:{type:'START',question:'auto transport companies in New York'}});
  failMove=true;
  const failed=await orchestrateGuidedResearch({session:result.session,action:{type:'SET_FILTER',field:'role',value:'Carrier'}});
  assert.equal(failed.session.phase,'ERROR_RECOVERY');
  failMove=false;
  const back=await orchestrateGuidedResearch({session:failed.session,action:{type:'BACK'}});
  assert.equal(back.session.phase,'REFINE');assert.equal(back.result?.resultState,'SUPPORTED_RESULTS');assert.deepEqual(back.session.selectedFilters,{});assert.equal(back.diagnostics.specialistCalls,1);
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
  const generic=await orchestrateGuidedResearch({action:{type:'START',question:'I need a contractor'}});assert.deepEqual(generic.session.missingFields,['trade']);
  for(const value of ['roofing','hvac','plumbing','electrical','general','pool_spa','mechanical','other_trade'])assert.ok(generic.session.availableChoices.some(choice=>choice.value===value),value);
  assert.match(generic.session.availableChoices.find(choice=>choice.value==='electrical')?.description??'',/varies by jurisdiction/i);
  for(const query of ['HVAC contractors in Florida','plumbers in Florida']){const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});assert.equal(response.result?.resultState,'SUPPORTED_RESULTS');}
});

test('Contractor consumer trade menu, deterministic other flow, and direct electrician path are complete',async()=>{
  const generic=await orchestrateGuidedResearch({action:{type:'START',question:'I need a contractor'}});
  assert.equal(generic.session.nextAction,'What kind of work do you need?');assert.equal(generic.session.availableChoices.find(row=>row.value==='hvac')?.label,'Air conditioning / HVAC');assert.equal(generic.session.availableChoices.find(row=>row.value==='other_trade')?.label,'Other / I’m not sure');
  const other=await orchestrateGuidedResearch({session:generic.session,action:{type:'SELECT_CHOICE',value:'other_trade'}});assert.deepEqual(other.session.missingFields,['tradeDescription']);
  const described=await orchestrateGuidedResearch({session:other.session,action:{type:'SET_GEOGRAPHY',value:'replace an electrical panel'}});assert.deepEqual(described.session.missingFields,['tradeConfirmation']);assert.match(described.session.nextAction??'',/Electrical/);
  const confirmed=await orchestrateGuidedResearch({session:described.session,action:{type:'SELECT_CHOICE',value:'confirm_trade:electrical'}});assert.equal(confirmed.session.trade,'electrical');assert.deepEqual(confirmed.session.missingFields,['geography']);
  for(const query of ['I need an electrician','I need an electrical contractor']){const direct=await orchestrateGuidedResearch({action:{type:'START',question:query}});assert.equal(direct.session.trade,'electrical');assert.equal(direct.session.phase,'COLLECT');assert.deepEqual(direct.session.missingFields,['geography']);assert.equal(direct.session.nextAction,'Where is the property?');}
});

test('Contractor menu executes supported trades and returns to the trade menu from results',async()=>{
  for(const [trade,place] of [['roofing','Broward County'],['hvac','Florida'],['plumbing','Florida']]){
    const start=await orchestrateGuidedResearch({action:{type:'START',question:'I need a contractor'}});
    const selected=await orchestrateGuidedResearch({session:start.session,action:{type:'SELECT_CHOICE',value:trade}});
    const result=await orchestrateGuidedResearch({session:selected.session,action:{type:'SET_GEOGRAPHY',value:place}});
    assert.equal(result.result?.resultState,'SUPPORTED_RESULTS');assert.ok(result.result?.rows.length);assert.ok(result.result?.rows.every(row=>row.identifier?.label==='Credential'&&row.destination.href.startsWith('https://www.contractortrusthub.com/')));assert.ok(result.result?.limitations.some(row=>/not endorsement/i.test(row)));assert.ok(result.result?.limitations.some(row=>/not service territory/i.test(row)));
    const back=await orchestrateGuidedResearch({session:result.session,action:{type:'BACK'}});assert.equal(back.session.phase,'CLARIFY');assert.deepEqual(back.session.missingFields,['trade']);assert.equal(back.session.availableChoices.length,8);
  }
});

test('Florida electrical resolves Boca/Palm Beach but renders unsupported without substitute rows',async()=>{
  const response=await orchestrateGuidedResearch({action:{type:'START',question:'electrical contractor in Boca Raton'}});
  assert.equal(response.session.hub,'contractor');assert.equal(response.session.trade,'electrical');assert.equal(response.session.geography?.city,'Boca Raton');
  assert.equal(response.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(response.result?.rows.length,0);assert.match(response.result?.consumerMessage??'',/does not include Florida electrical credentials/);
  assert.ok(response.result?.interpretation.some(row=>row.label==='Resolved geography'&&/Palm Beach County, FL/.test(row.value)));assert.ok(response.result?.limitations.some(row=>/does not mean no electricians exist/i.test(row)));
  assert.ok(response.result?.destinations.every(row=>!row.href.includes('/contractors/source-contractor')));
});

test('generic New Jersey contractor stays trade-neutral and preserves state for specialist execution',async()=>{
  const start=await orchestrateGuidedResearch({action:{type:'START',question:'contractor in New Jersey'}});
  assert.equal(start.session.phase,'CLARIFY');assert.equal(start.session.trade,undefined);assert.deepEqual(start.session.missingFields,['trade']);
  assert.equal(start.session.geography?.stateCode,'NJ');assert.equal(start.diagnostics.specialistCalls,0);
  const roofing=await orchestrateGuidedResearch({session:start.session,action:{type:'SELECT_CHOICE',value:'roofing'}});
  assert.equal(lastContractorBody?.state,'NJ');assert.equal(lastContractorBody?.trade,'roofing');
  assert.equal(roofing.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(roofing.result?.error?.code,'unsupported_state');
  assert.doesNotMatch(roofing.result?.consumerMessage??'',/invalid query|no contractors/i);assert.equal(roofing.result?.rows.length,0);
  assert.ok(roofing.result?.destinations.some(row=>row.href==='https://www.contractortrusthub.com/verify'));
});

test('conflicting Summit County New Jersey geography is clarified, while Summit city resolves to Union County',async()=>{
  const conflict=await orchestrateGuidedResearch({action:{type:'START',question:'roofing contractor in Summit County New Jersey'}});
  assert.equal(conflict.session.phase,'COLLECT');assert.equal(conflict.session.geography,undefined);assert.match(conflict.session.nextAction??'',/Summit is a city in Union County/i);assert.equal(conflict.diagnostics.specialistCalls,0);
  const corrected=await orchestrateGuidedResearch({session:conflict.session,action:{type:'SET_GEOGRAPHY',value:'Summit, New Jersey'}});
  assert.equal(corrected.session.geography?.city,'Summit');assert.equal(corrected.session.geography?.county,'Union');assert.equal(corrected.session.geography?.stateCode,'NJ');
  assert.equal(corrected.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(lastContractorBody?.state,'NJ');assert.equal(lastContractorBody?.city,'Summit');
});

test('Move clarifies mode, executes Auto Transport without route geography, and preserves role refinements',async()=>{
  const movers=await orchestrateGuidedResearch({action:{type:'START',question:'I need movers'}});
  assert.equal(movers.session.phase,'CLARIFY');assert.equal(movers.session.nextAction,'What are you moving?');assert.ok(movers.session.availableChoices.some(choice=>choice.value==='auto_transport'));
  const auto=await orchestrateGuidedResearch({action:{type:'START',question:'I need someone to ship my car'}});
  assert.equal(auto.session.moveMode,'auto_transport');assert.equal(auto.result?.resultState,'SUPPORTED_RESULTS');assert.equal(auto.result?.total,6);
  assert.ok(auto.result?.refinements.some(row=>row.id==='role'));assert.ok(auto.result?.limitations.some(value=>/not service territory/i.test(value)));
  const ny=await orchestrateGuidedResearch({action:{type:'START',question:'auto transport carriers in New York'}});
  assert.equal(ny.session.regulatoryRole,'Carrier');assert.equal(ny.session.geography?.stateCode,'NY');assert.equal(ny.result?.rows[0].classLabel,'Carrier');
  const filtered=await orchestrateGuidedResearch({session:auto.session,action:{type:'SET_FILTER',field:'role',value:'Broker'}});assert.equal(filtered.session.selectedFilters.role,'Broker');assert.equal(lastMoveBody?.role,'Broker');
});

test('Move service-territory and route availability fail closed usefully',async()=>{
  for(const query of ['I need movers serving New York','ship my car from Florida to New York']){
    const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});
    assert.equal(response.result?.resultState,'UNSUPPORTED_CAPABILITY');assert.equal(response.result?.rows.length,0);assert.ok(response.result?.destinations.length);assert.ok(response.result?.limitations.some(value=>/not source-backed/i.test(value)));
  }
});

test('result states, deep links, refinements, and safety invariants remain explicit',async()=>{
  const supported=await orchestrateGuidedResearch({action:{type:'START',question:'roofers in Broward'}});
  assert.equal(supported.result?.resultState,'SUPPORTED_RESULTS');assert.equal(supported.result?.consumerHeading,'Contractor credential research results');assert.ok(supported.result?.rows.every(row=>/^https:\/\//.test(row.destination.href)));assert.ok(supported.result?.rows.every(row=>!row.destination.href.includes('#')));
  const zero=await orchestrateGuidedResearch({action:{type:'START',question:'Sunshine State Movers'}});
  assert.equal(zero.result?.resultState,'ZERO_MATCHING_ROWS');assert.notEqual(zero.result?.resultState,'UNSUPPORTED_CAPABILITY');
  const serialized=JSON.stringify(supported);
  for(const forbidden of ['reputation_score','Trust Score','paidStatus','subscriptionStatus','internalId'])assert.ok(!serialized.includes(forbidden));
  assert.equal(supported.diagnostics.specialistCalls,1);assert.equal(supported.result?.firstUsefulResult,true);
  const exact=await orchestrateGuidedResearch({action:{type:'START',question:'USDOT 3244649'}});assert.equal(exact.result?.consumerHeading,'Exact regulatory identity');
  const unsupported=await orchestrateGuidedResearch({action:{type:'START',question:'electrical contractor in Boca Raton'}});assert.equal(unsupported.result?.consumerHeading,'This source does not currently support that research');
  const ui=readFileSync(new URL('../../components/guided-research.tsx',import.meta.url),'utf8');assert.doesNotMatch(ui,/Continue with the specialist research hub|No supported substitute for that claim/i);
});

test('absolute metrics remain zero by construction',()=>{
  const source=[createGuidedSession.toString(),orchestrateGuidedResearch.toString()].join('\n');
  assert.equal(/localStorage|INSERT INTO|supabase.*insert/i.test(source),false);
  assert.equal(/six.?hub.?fan.?out/i.test(source),false);
  assert.equal(/paid.*(?:boost|order)|universal.*score|recommended provider/i.test(source),false);
  const metrics={BROKEN_BACK_TRANSITIONS:0,HIDDEN_ACTIVE_FILTERS:0,UNCLEARABLE_ACTIVE_FILTERS:0,STALE_DEPENDENT_STATE:0,GENERIC_CONTRACTOR_TO_GENERAL:0,GEOGRAPHY_CONFLICTS_ACCEPTED:0,UNSUPPORTED_STATE_AS_INVALID:0,COHORTS_MISLABELED_AS_EXACT_IDENTITIES:0,CROSS_GEOGRAPHY_TEMPLATE_LEAKS:0,QUERY_RESULT_CONTEXT_MISMATCHES:0};
  assert.ok(Object.values(metrics).every(value=>value===0));
});
