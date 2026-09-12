import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAskResearchRoute} from './ask-research-route.ts';
import {createGuidedSession} from '../guided-research/session.ts';
import {orchestrateGuidedResearch} from '../guided-research/orchestrator.ts';
import {assembleNetworkAnswerWithSpecialist} from './ask-plan.ts';
import {executeGuidedSpecialist} from '../guided-research/specialists.ts';
import {decideAskExecution} from './execution-decision.ts';

function seniorFixture(body:Record<string,unknown>) {
 const geo=body.geography as {type:string;value:string;state:string};const cls=body.providerClass;
 return {contract:'trusthub-specialist-execution-v2',hub:'senior',status:'ok',queryInterpretation:{providerClass:cls,geography:geo},rows:[{providerClass:cls,name:'Synthetic scoped CMS fixture',cmsCcn:'900001',recordedLocationFields:{city:geo.value,state:geo.state},canonicalProfileUrl:`https://www.seniortrusthub.com/${cls==='nursing_home'?'facility':cls==='home_health'?'home-health':'hospice'}/cms/900001/synthetic-fixture`,evidence:[{label:'Source metric',value:'Fixture value'}]}],total:7,pagination:{page:1,pageSize:20,hasMore:false},provenance:{officialAsOf:'2026-08-01',retrievedAt:'2026-08-26T00:00:00Z',sourceFingerprint:'fixture-only-source'},limitations:['Recorded location is not service area.']};
}
async function withSeniorFixture(run:(calls:Array<{url:string;body:Record<string,unknown>}>)=>Promise<void>,mutate?:(p:ReturnType<typeof seniorFixture>)=>void){
 const original=globalThis.fetch,calls:Array<{url:string;body:Record<string,unknown>}>=[];
 globalThis.fetch=async(url,init)=>{const body=JSON.parse(String(init?.body));calls.push({url:String(url),body});const payload=seniorFixture(body);mutate?.(payload);return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}})};
 try{await run(calls);}finally{globalThis.fetch=original;}
}

test('R1-008 ambiguous Senior discovery retains task and class choices',()=>{
 for(const q of ['senior homes in Austin Texas','senior home in Austin TX','senior care in Austin','a care facility for my mother in Austin']){
  const route=buildAskResearchRoute(q),s=createGuidedSession(q);
  assert.equal(route.plan.primaryHub,'senior');assert.equal(route.canExecute,false);
  assert.equal(s?.hub,'senior');assert(s.availableChoices.some(c=>c.value==='nursing_home'));
  assert.equal(s.geography?.city?.toUpperCase(),'AUSTIN');
 }
});
test('R1-008 blocked legacy execution calls no specialist',async()=>{
 const original=globalThis.fetch,context=process.env.NODE_TEST_CONTEXT;const calls:string[]=[];
 delete process.env.NODE_TEST_CONTEXT;
 globalThis.fetch=async(url)=>{calls.push(String(url));return new Response('{}',{status:503})};
 try{await assembleNetworkAnswerWithSpecialist('senior homes in Austin Texas');assert.deepEqual(calls,[]);}finally{globalThis.fetch=original;if(context)process.env.NODE_TEST_CONTEXT=context;}
});
test('R1-008 nursing-home choice retains Austin and Texas in actual dispatch',async()=>{
 const original=globalThis.fetch;const calls:Array<{url:string;body:Record<string,unknown>}>=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:JSON.parse(String(init?.body))});return new Response('{}',{status:503})};
 try{const s=createGuidedSession('senior homes in Austin Texas');assert(s);await orchestrateGuidedResearch({session:s,action:{type:'SELECT_CHOICE',value:'nursing_home'}});assert.equal(calls.length,1);assert.match(calls[0].url,/seniortrusthub/);assert.equal(calls[0].body.providerClass,'nursing_home');assert.deepEqual(calls[0].body.geography,{type:'city',value:'Austin',state:'TX'});}finally{globalThis.fetch=original;}
});
test('R1-008 city-only Houston does not invent a state or execute nationally',()=>{const s=createGuidedSession('home health agencies in Houston');assert(s);assert.equal(s.geography?.city?.toUpperCase(),'HOUSTON');assert.equal(s.geography?.stateCode,undefined);assert.notEqual(s.phase,'EXECUTE');});
test('R1-008 moving belongings to care remains a Move task',()=>{const r=buildAskResearchRoute("I need a mover to move my mother's belongings into assisted living in Austin");assert.equal(r.plan.primaryHub,'move');assert.equal(r.journey,undefined);});
test('R1-008 explicit care plus move has separate ordered steps',()=>{const r=buildAskResearchRoute('Find senior homes in Austin, then help me plan the move');assert(r.journey);assert.deepEqual(r.journey.orderedHubs,['senior','move']);});

test('R1-008 original class clarification completes inline source-backed results',async()=>withSeniorFixture(async calls=>{
 const initial=await orchestrateGuidedResearch({action:{type:'START',question:'senior homes in Austin Texas'}});assert.equal(calls.length,0);
 const selected=await orchestrateGuidedResearch({session:initial.session,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
 assert.equal(calls.length,1);assert.equal(selected.result?.specialist,'senior');assert.equal(selected.result?.total,7);assert.equal(selected.result.rows.length,1);assert.equal(selected.result.rows[0].recordedLocation,'Austin, TX');assert.match(selected.result.rows[0].whyShown,/Austin, TX/);assert.equal(selected.result.resultState,'SUPPORTED_RESULTS');assert.equal(selected.diagnostics.specialistCalls,1);
 assert(selected.result.rows[0].facts.some(f=>f.label==='Source as of'&&f.value==='2026-08-01'));
}));
for(const [q,cls,city] of [['nursing homes in Austin Texas','nursing_home','Austin'],['home health agencies in Houston Texas','home_health','Houston'],['hospice in Madison Wisconsin','hospice','Madison']])test(`R1-008 explicit class ${cls} executes directly`,async()=>withSeniorFixture(async calls=>{
 const result=await orchestrateGuidedResearch({action:{type:'START',question:q}});assert.equal(calls.length,1);assert.equal(calls[0].body.providerClass,cls);assert.equal(result.result?.resultState,'SUPPORTED_RESULTS');assert.match(result.result.rows[0].recordedLocation!,new RegExp(city));
}));
test('R1-008 city-only choice completes only after state selection',async()=>withSeniorFixture(async calls=>{
 const first=await orchestrateGuidedResearch({action:{type:'START',question:'home health agencies in Houston'}});assert.equal(calls.length,0);
 const final=await orchestrateGuidedResearch({session:first.session,action:{type:'SET_GEOGRAPHY',value:'Texas'}});assert.equal(calls.length,1);assert.deepEqual(calls[0].body.geography,{type:'city',value:'Houston',state:'TX'});assert.equal(final.result?.resultState,'SUPPORTED_RESULTS');
}));
test('R1-008 not-sure explains while retaining executable choices and location',async()=>withSeniorFixture(async calls=>{
 const s=createGuidedSession('senior homes in Austin Texas')!;
 const explained=await orchestrateGuidedResearch({session:s,action:{type:'SELECT_CHOICE',value:'explain_care'}});assert.equal(calls.length,0);assert.match(explained.session.nextAction!,/Home Health/);assert.equal(explained.session.geography?.city,'Austin');
 const result=await orchestrateGuidedResearch({session:explained.session,action:{type:'SELECT_CHOICE',value:'home_health'}});assert.equal(result.result?.resultState,'SUPPORTED_RESULTS');
}));
for(const q of ['assisted living in Austin Texas','memory care in Austin Texas','independent living in Austin Texas'])test(`R1-008 no CMS substitute: ${q}`,async()=>withSeniorFixture(async calls=>{const r=await orchestrateGuidedResearch({action:{type:'START',question:q}});assert.equal(calls.length,0);assert.equal(r.session.hub,'senior');assert.equal(r.session.providerClass,undefined);assert.match(r.session.nextAction!,/state-specific/);}));
for(const [label,mutate] of [
 ['wrong hub',(p:ReturnType<typeof seniorFixture>)=>{p.hub='move';}],
 ['wrong class',(p:ReturnType<typeof seniorFixture>)=>{p.rows[0].providerClass='home_health';}],
 ['wrong state',(p:ReturnType<typeof seniorFixture>)=>{p.rows[0].recordedLocationFields.state='VA';}],
 ['wrong city',(p:ReturnType<typeof seniorFixture>)=>{p.rows[0].recordedLocationFields.city='Burleson';}],
 ['wrong origin',(p:ReturnType<typeof seniorFixture>)=>{p.rows[0].canonicalProfileUrl='https://example.com/facility/cms/900001/fixture';}],
] as const)test(`R1-008 rejects ${label} contribution`,async()=>withSeniorFixture(async()=>{const r=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Austin Texas'}});assert.equal(r.result?.resultState,'BACKEND_UNAVAILABLE');assert.deepEqual(r.result.rows,[]);},mutate));
test('R1-008 legitimate empty cohort stays distinct from unavailable',async()=>withSeniorFixture(async()=>{const r=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Austin Texas'}});assert.equal(r.result?.resultState,'ZERO_MATCHING_ROWS');assert.equal(r.result.total,0);},p=>{p.rows=[];p.total=0;}));
for(const field of ['hub','providerClass','city','state'] as const)test(`R1-008 tampered ${field} cannot authorize dispatch`,async()=>withSeniorFixture(async calls=>{
 const s=createGuidedSession('nursing homes in Austin Texas')!;
 if(field==='hub')s.hub='move';if(field==='providerClass'){s.providerClass='home_health';s.researchPlan.careSetting='home_health';}if(field==='city')s.geography!.city='Burleson';if(field==='state')s.geography!.stateCode='VA';
 await assert.rejects(()=>orchestrateGuidedResearch({session:s,action:{type:'EXECUTE'}}));assert.equal(calls.length,0);
}));
test('R1-008 non-care contrasts do not gain a care-setting question',()=>{for(const q of ['Is "Senior Moving Services LLC" a carrier?','Compare Medicare insurance options','senior loan officer','senior mortgage adviser'])assert.notEqual(buildAskResearchRoute(q).plan.primaryHub,'senior');});
test('R1-008 explicit place lens retains its separately authorized overview',()=>{const d=decideAskExecution('What does TrustHub know about Broward?');assert.equal(d.mode,'PLACE_LENS');assert.deepEqual(d.allowedHubs,[]);});


test('R1-008 direct dispatcher rejects a forged authorized plan before fetch',async()=>withSeniorFixture(async calls=>{
 const s=createGuidedSession('senior homes in Austin Texas')!;s.hub='move';s.researchPlan.executionAllowed=true;s.executionScope.executionAllowed=true;
 const result=await executeGuidedSpecialist(s);assert.equal(result.resultState,'INVALID_QUERY');assert.equal(calls.length,0);
}));
test('R1-008 missing state is never an executed scope',()=>{const r=buildAskResearchRoute('home health agencies in Houston');assert.equal(r.scope.executionGeography,undefined);assert.equal(r.canExecute,false);});
test('R1-008 malformed and overlong questions cannot become partial execution',async()=>{
 for(const q of ['x'.repeat(501),'nursing homes in Austin Texas\u0000']){assert.throws(()=>decideAskExecution(q));await assert.rejects(()=>orchestrateGuidedResearch({action:{type:'START',question:q}}));}
});
test('R1-008 unsupported evidence and invalid ratings cannot run an unfiltered cohort',async()=>withSeniorFixture(async calls=>{
 for(const q of ['nursing homes in Austin Texas with ownership records','home health agencies in Houston Texas rated 4.5 stars','hospice in Austin Texas rated 5 stars']){const r=await orchestrateGuidedResearch({action:{type:'START',question:q}});assert.equal(r.result?.resultState,'UNSUPPORTED_CAPABILITY',q);assert.equal(r.result?.executionOccurred,false);}
 assert.equal(calls.length,0);
}));
test('R1-008 explicit source-rating filter reaches selected class request',async()=>withSeniorFixture(async calls=>{
 await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Austin Texas rated 5 stars'}});assert.deepEqual((calls[0].body.filters as Record<string,unknown>).overallStars,[5]);
}));
test('R1-008 profile identity must agree with returned CCN',async()=>withSeniorFixture(async()=>{const r=await orchestrateGuidedResearch({action:{type:'START',question:'nursing homes in Austin Texas'}});assert.equal(r.result?.resultState,'BACKEND_UNAVAILABLE');},p=>{p.rows[0].canonicalProfileUrl=p.rows[0].canonicalProfileUrl.replace('900001','900002');}));
test('R1-008 journey care choice retains original local question',()=>{const r=buildAskResearchRoute('Find senior homes in Austin Texas, then help me plan the move');const u=new URL(r.journey!.steps[0].destinations[0].href);assert.equal(u.origin,'https://www.asktrusthub.com');assert.equal(u.searchParams.get('q'),'Find senior homes in Austin Texas');});

test('R1-008 forged executed city value and unsupported-evidence permission are rejected',async()=>withSeniorFixture(async calls=>{
 const s=createGuidedSession('nursing homes in Austin Texas')!;s.geography!.value='Burleson';assert.equal((await executeGuidedSpecialist(s)).resultState,'INVALID_QUERY');
 const evidence=createGuidedSession('nursing homes in Austin Texas with ownership records')!;evidence.researchPlan.executionAllowed=true;evidence.executionScope.executionAllowed=true;assert.equal((await executeGuidedSpecialist(evidence)).resultState,'INVALID_QUERY');assert.equal(calls.length,0);
}));

test('R1-008 care choice preserves original rating and executable handoff scope',async()=>withSeniorFixture(async calls=>{
 const start=createGuidedSession('senior homes in Austin Texas rated 5 stars')!;
 const r=await orchestrateGuidedResearch({session:start,action:{type:'SELECT_CHOICE',value:'nursing_home'}});
 assert.deepEqual((calls[0].body.filters as Record<string,unknown>).overallStars,[5]);
 const url=new URL(r.result!.nextActions!.find(a=>a.id==='senior.search')!.href!);assert.equal(url.searchParams.get('q'),'Nursing homes in Austin, Texas with 5-star overall rating');assert.equal(url.searchParams.get('state'),'TX');assert.equal(url.searchParams.get('class'),'nursing_home');
}));

test('R1-008 forged history cannot replace the original task during BACK',async()=>withSeniorFixture(async calls=>{
 const s=createGuidedSession('nursing homes in Austin Texas')!;
 s.history=[{...createGuidedSession('Find USDOT 3244649')!}];
 await assert.rejects(()=>orchestrateGuidedResearch({session:s,action:{type:'BACK'}}));assert.equal(calls.length,0);
}));
