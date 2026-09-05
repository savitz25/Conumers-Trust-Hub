import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from '../guided-research/orchestrator.ts';
import { planAskResearch } from './research-planner.ts';
import { resolveResearchScope } from './research-scope.ts';

type Expected = {
  query: string;
  hub: string;
  requested: string;
  executed?: string;
  state: string;
  meaning?: string;
  transformation?: string;
  allowed: boolean;
};

const matrix: Expected[] = [
  {query:'mover in tampa bay florida',hub:'move',requested:'Tampa Bay, Florida',state:'CLARIFICATION_REQUIRED',allowed:false},
  {query:'movers in Boca Raton Florida',hub:'move',requested:'Boca Raton, Florida',state:'BROADENING_REQUIRES_CONSENT',meaning:'RECORDED_HEADQUARTERS',allowed:false},
  {query:'licensed roofer in Fort Lauderdale Florida',hub:'contractor',requested:'Fort Lauderdale, Florida',executed:'Broward County, Florida',state:'DETERMINISTIC_EQUIVALENT',meaning:'CREDENTIAL_GEOGRAPHY',transformation:'CITY_TO_COUNTY',allowed:true},
  {query:'roofing contractors in Broward County Florida',hub:'contractor',requested:'Broward County, Florida',executed:'Broward County, Florida',state:'EXACT',allowed:true},
  {query:'roofers in Tampa Florida',hub:'contractor',requested:'Tampa, Florida',state:'CAPABILITY_UNSUPPORTED',allowed:false},
  {query:'registered investment advisers in West Palm Beach Florida',hub:'investor',requested:'West Palm Beach, Florida',state:'BROADENING_REQUIRES_CONSENT',meaning:'PRINCIPAL_OFFICE',allowed:false},
  {query:'RIAs in Florida',hub:'investor',requested:'Florida',executed:'Florida',state:'EXACT',meaning:'PRINCIPAL_OFFICE',allowed:true},
  {query:'mortgage lenders in Palm Beach County Florida',hub:'lender',requested:'Palm Beach County, Florida',executed:'Palm Beach County, Florida',state:'EXACT',meaning:'PROPERTY_GEOGRAPHY',allowed:true},
  {query:'mortgage lenders in West Palm Beach Florida',hub:'lender',requested:'West Palm Beach, Florida',executed:'Palm Beach County, Florida',state:'DETERMINISTIC_EQUIVALENT',meaning:'PROPERTY_GEOGRAPHY',transformation:'CITY_TO_COUNTY',allowed:true},
  {query:'nursing homes in Boca Raton Florida',hub:'senior',requested:'Boca Raton, Florida',executed:'Boca Raton, Florida',state:'EXACT',meaning:'RECORDED_PROVIDER_LOCATION',allowed:true},
  {query:'hospice providers in Palm Beach County Florida',hub:'senior',requested:'Palm Beach County, Florida',executed:'Palm Beach County, Florida',state:'EXACT',meaning:'RECORDED_OFFICE_LOCATION',allowed:true},
  {query:'insurance agencies in Fort Lauderdale Florida',hub:'insurance',requested:'Fort Lauderdale, Florida',state:'BROADENING_REQUIRES_CONSENT',meaning:'CREDENTIAL_GEOGRAPHY',allowed:false},
  {query:'roofer in Phoenix Arizona',hub:'contractor',requested:'Phoenix, Arizona',state:'BROADENING_REQUIRES_CONSENT',allowed:false},
  {query:'contractor in Seattle Washington',hub:'contractor',requested:'Seattle, Washington',state:'BROADENING_REQUIRES_CONSENT',allowed:false},
  {query:'lender in Austin Texas',hub:'lender',requested:'Austin, Texas',state:'BROADENING_REQUIRES_CONSENT',allowed:false},
  {query:'mover headquartered in Miami Florida',hub:'move',requested:'Miami, Florida',state:'BROADENING_REQUIRES_CONSENT',meaning:'RECORDED_HEADQUARTERS',allowed:false},
  {query:'mover serving Miami Florida',hub:'move',requested:'Miami, Florida',state:'CAPABILITY_UNSUPPORTED',meaning:'SERVICE_TERRITORY',allowed:false},
  {query:"I'm moving from Chicago to Denver, who can move me?",hub:'move',requested:'Chicago to Denver',state:'CAPABILITY_UNSUPPORTED',meaning:'ORIGIN_DESTINATION',allowed:false},
  {query:'home health agency in Boca Raton',hub:'senior',requested:'Boca Raton, Florida',executed:'Boca Raton, Florida',state:'EXACT',meaning:'RECORDED_OFFICE_LOCATION',allowed:true},
  {query:'nursing homes within 25 miles of Boca Raton',hub:'senior',requested:'Boca Raton, Florida',state:'CLARIFICATION_REQUIRED',allowed:false},
];

test('permanent requested-versus-executed scope matrix',()=>{
  for(const expected of matrix){
    const plan=planAskResearch(expected.query); const scope=resolveResearchScope(plan);
    assert.equal(plan.primaryHub,expected.hub,expected.query);
    assert.equal(scope.requestedGeography?.display,expected.requested,expected.query);
    assert.equal(scope.executionGeography?.display,expected.executed,expected.query);
    assert.equal(scope.resolutionState,expected.state,expected.query);
    assert.equal(scope.executionAllowed,expected.allowed,expected.query);
    if(expected.meaning)assert.equal(scope.executionGeographyMeaning,expected.meaning,expected.query);
    if(expected.transformation)assert.equal(scope.transformation,expected.transformation,expected.query);
    if(scope.transformation!=='NONE')assert.equal(scope.disclosureRequired,true,expected.query);
  }
});

test('partial Florida crosswalk covers the published journey municipalities',()=>{
  const expected:Record<string,string>={
    'Fort Lauderdale':'Broward','Ft. Lauderdale':'Broward','Deerfield Beach':'Broward','Pompano Beach':'Broward','Hollywood':'Broward','Pembroke Pines':'Broward','Coral Springs':'Broward',
    'Boca Raton':'Palm Beach','West Palm Beach':'Palm Beach','Delray Beach':'Palm Beach','Boynton Beach':'Palm Beach','Jupiter':'Palm Beach','Wellington':'Palm Beach',
    'Tampa':'Hillsborough','St. Petersburg':'Pinellas','Saint Petersburg':'Pinellas','Clearwater':'Pinellas','Miami':'Miami-Dade','Miami Beach':'Miami-Dade','Hialeah':'Miami-Dade','Orlando':'Orange',
  };
  for(const [city,county] of Object.entries(expected)){
    const scope=resolveResearchScope(planAskResearch(`mortgage lenders in ${city} Florida`));
    assert.equal(scope.normalizedRequestedGeography?.city,city==='Ft. Lauderdale'?'Fort Lauderdale':city,city);
    assert.equal(scope.normalizedRequestedGeography?.county,county,city);
  }
});

test('scope invariants require consent and retain the original request',()=>{
  const plan=planAskResearch('RIAs in West Palm Beach Florida');
  const before=structuredClone(plan.requestedGeography);
  const blocked=resolveResearchScope(plan);
  assert.equal(blocked.consentRequired,true);
  assert.equal(blocked.executionGeography,undefined);
  const approved=resolveResearchScope(plan,{approvedBroaderGeography:{kind:'state',display:'Florida',stateCode:'FL',stateName:'Florida'}});
  assert.deepEqual(plan.requestedGeography,before);
  assert.equal(approved.resolutionState,'BROADENING_REQUIRES_CONSENT');
  assert.equal(approved.executionAllowed,true);
  assert.equal(approved.userConsent?.approved,true);
  assert.equal(approved.executionGeography?.display,'Florida');
});

test('START blocks unsupported scopes before specialist execution',async()=>{
  const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=(async()=>{calls+=1;throw new Error('specialist must not run')}) as typeof fetch;
  try{
    for(const query of ['mover in tampa bay florida','movers in Boca Raton Florida','registered investment advisers in West Palm Beach Florida','insurance agencies in Fort Lauderdale Florida','mover serving Miami Florida']){
      const response=await orchestrateGuidedResearch({action:{type:'START',question:query}});
      assert.equal(response.diagnostics.specialistCalls,0,query);
      assert.equal(response.session.phase,'CLARIFY',query);
      assert.notEqual(response.result?.resultState,'ZERO_MATCHING_ROWS',query);
    }
    assert.equal(calls,0);
  }finally{globalThis.fetch=originalFetch;}
});

test('Fort Lauderdale contractor executes Broward while local-only failures never masquerade as zero rows',async()=>{
  const originalFetch=globalThis.fetch;const bodies:Record<string,unknown>[]=[];
  globalThis.fetch=(async(_input,init)=>{bodies.push(JSON.parse(String(init?.body)));return new Response(JSON.stringify({contract:'trusthub-specialist-execution-v2',contractVersion:'contractor-execution-v2.1',schemaFingerprint:'contractor-v2.1-schema-2026-08-20',contractFingerprint:'contractor-v2.1-contract-2026-08-20',resultState:'SUPPORTED_RESULTS',rows:[],total:1,pagination:{page:1,limit:10,totalPages:1},provenance:{source:'Florida DBPR'},limitations:['Recorded geography is not service territory.']}),{status:200,headers:{'content-type':'application/json'}})}) as typeof fetch;
  try{
    const response=await orchestrateGuidedResearch({action:{type:'START',question:'licensed roofer in Fort Lauderdale Florida'}});
    assert.equal(response.diagnostics.specialistCalls,1);
    assert.equal(bodies[0].county,'Broward');
    assert.equal(bodies[0].city,undefined);
    assert.equal(response.session.executionScope.executionGeography?.display,'Broward County, Florida');
    assert.match(response.session.executionScope.disclosure??'',/Fort Lauderdale.*Broward County/i);
  }finally{globalThis.fetch=originalFetch;}
});

test('variants preserve local scope rather than manufacturing statewide execution',()=>{
  for(const query of ['ft lauderdale roofer','roof guy fort lauderdale','ria west palm beach','mortgage lenders west palm','mover boca','mover tampa bay','insurance agency boca','nursing home boca','phoenix roofer','seattle contractor']){
    const scope=resolveResearchScope(planAskResearch(query));
    assert.ok(scope.requestedGeography,query);
    if(scope.requestedGeography?.kind==='city'&&scope.executionGeography?.kind==='state')assert.equal(scope.userConsent?.approved,true,query);
  }
});

test('specialist request bodies receive only resolved execution geography',async()=>{
  const originalFetch=globalThis.fetch;const seen:Array<Record<string,unknown>>=[];
  globalThis.fetch=(async(_input,init)=>{seen.push(JSON.parse(String(init?.body)));return new Response('{}',{status:503,headers:{'content-type':'application/json'}})}) as typeof fetch;
  try{
    const move=await orchestrateGuidedResearch({action:{type:'START',question:'movers in Boca Raton Florida'}});
    assert.equal(move.diagnostics.specialistCalls,0);assert.equal(seen.length,0);assert.equal(move.session.executionScope.executionGeography,undefined);
    const lender=await orchestrateGuidedResearch({action:{type:'START',question:'mortgage lenders in West Palm Beach Florida'}});
    assert.equal(lender.diagnostics.specialistCalls,1);assert.equal((seen.at(-1)?.geography as Record<string,unknown>).county,'Palm Beach');assert.equal((seen.at(-1)?.geography as Record<string,unknown>).countyFips,'12099');
    const senior=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Boca Raton Florida'}});
    assert.equal(senior.diagnostics.specialistCalls,1);assert.deepEqual(seen.at(-1)?.geography,{type:'city',value:'Boca Raton'});
    const investor=await orchestrateGuidedResearch({action:{type:'START',question:'registered investment advisers in West Palm Beach Florida'}});
    assert.equal(investor.diagnostics.specialistCalls,0);assert.equal(seen.length,2);
    const approved=await orchestrateGuidedResearch({session:investor.session,action:{type:'SELECT_CHOICE',value:'scope_state:FL'}});
    assert.equal(approved.diagnostics.specialistCalls,1);assert.equal((seen.at(-1)?.geography as Record<string,unknown>).stateCode,'FL');
    assert.equal(approved.session.executionScope.userConsent?.requestedDisplay,'West Palm Beach, Florida');
  }finally{globalThis.fetch=originalFetch;}
});
