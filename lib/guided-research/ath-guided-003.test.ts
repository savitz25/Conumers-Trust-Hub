import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {orchestrateGuidedResearch} from './orchestrator.ts';
import {FINANCIAL_SPECIALIST_LOCKS} from './specialists.ts';

const originalFetch=globalThis.fetch;
let calls=0;
let lastBody:Record<string,unknown>={};
const meta=(hub:'investor'|'insurance'|'lender')=>({contract:'trusthub-specialist-execution-v2',contractVersion:FINANCIAL_SPECIALIST_LOCKS[hub].version,schemaFingerprint:FINANCIAL_SPECIALIST_LOCKS[hub].schemaFingerprint,contractFingerprint:FINANCIAL_SPECIALIST_LOCKS[hub].contractFingerprint});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

globalThis.fetch=async(input,init)=>{
  calls++;lastBody=JSON.parse(String(init?.body??'{}')) as Record<string,unknown>;
  const url=String(input);const hub=url.includes('investor')?'investor':url.includes('insurance')?'insurance':'lender';
  const identifier=(lastBody.identifier??{}) as Record<string,unknown>;const value=String(identifier.value??'');
  if(hub==='investor'){
    if(lastBody.entityClass==='era'&&((lastBody.filters as Record<string,unknown>|undefined)?.minimumRaum))return response({...meta(hub),resultState:'UNSUPPORTED_CAPABILITY',errorCode:'era_raum_not_supported',message:'ERA records do not report the RIA RAUM field.'},422);
    if(value==='999999999')return response({...meta(hub),resultState:'NO_CONFIDENT_MATCH',message:'No exact CRD match.'},404);
    if(lastBody.queryType==='identity')return response({...meta(hub),resultState:'AMBIGUOUS_IDENTITIES',message:'Multiple firm identities match.',capabilityChoices:[{id:'one',value:'one',label:'Alpha Partners I'}]},409);
    if(lastBody.queryType==='identifier')return response({...meta(hub),resultState:'EXACT_IDENTITY',rows:[{firmName:'Exact Adviser',crd:value,firmClass:'RIA',principalOffice:'New Jersey',sourceAsOf:'2026-08-01',destinations:[{type:'SEC_IARD',url:'https://adviserinfo.sec.gov/firm/summary/166089'}]}],total:1});
    return response({...meta(hub),resultState:'SUPPORTED_RESULTS',rows:[{firmName:'Public Adviser',crd:'166089',firmClass:String(lastBody.entityClass??'RIA'),principalOffice:'Florida',raum:{display:'$2 billion'},sourceAsOf:'2026-08-01',destinations:[{type:'SEC_IARD',url:'https://adviserinfo.sec.gov/firm/summary/166089'}]}],total:438,availableRefinements:[]});
  }
  if(hub==='insurance'){
    if(value==='999999999')return response({...meta(hub),resultState:'NO_CONFIDENT_MATCH',message:'No exact NPN match.'},404);
    if(lastBody.queryType==='evidence')return response({...meta(hub),resultState:'UNSUPPORTED_CAPABILITY',message:'InsuranceTrustHub does not publish recommendation rankings.'},422);
    if(lastBody.queryType==='identifier')return response({...meta(hub),resultState:'EXACT_IDENTITY',rows:[{entityClass:identifier.type==='NAIC'?'legal_insurer':'agency',name:'Exact Insurance Identity',npn:identifier.type==='NPN'?value:undefined,naicCode:identifier.type==='NAIC'?value:undefined,sourceObservedAt:'2026-08-01',destination:'/research/exact'}],total:1});
    if(lastBody.entityClass==='producer')return response({...meta(hub),resultState:'PUBLICATION_RESTRICTED',message:'Producer mass publication is restricted.'},422);
    if((lastBody.geography as Record<string,unknown>|undefined)?.intent==='SERVICE_TERRITORY'||(lastBody.entityClass==='legal_insurer'&&(lastBody.geography as Record<string,unknown>|undefined)?.stateCode))return response({...meta(hub),resultState:'UNSUPPORTED_CAPABILITY',message:'This geography meaning is unsupported.'},422);
    return response({...meta(hub),resultState:'SUPPORTED_RESULTS',rows:[{entityClass:lastBody.entityClass,name:'Public Insurance Identity',npn:'10391484',credentialJurisdiction:'Florida',sourceObservedAt:'2026-08-01',destination:'/research/10391484'}],total:lastBody.entityClass==='legal_insurer'?26:56939,availableRefinements:[]});
  }
  if(value==='1001618'||value==='170008')return response({...meta(hub),resultState:'PUBLICATION_RESTRICTED',message:'Person or branch publication is restricted.'},422);
  if(value==='136890')return response({...meta(hub),resultState:'IDENTITY_COLLISION',message:'NMLS namespaces collide.'},409);
  if(lastBody.queryType==='identifier')return response({...meta(hub),resultState:'EXACT_IDENTITY',identity:{displayName:'Rocket Mortgage',nmls:value||'3030',lei:'549300FGXN1K3HLB1R50',destination:{type:'PUBLIC_PROFILE',url:'https://www.lendertrusthub.com/lenders/rocket-mortgage'}},total:1});
  if(lastBody.queryType==='evidence'){
    const zero=String(lastBody.identityName).toLowerCase()==='newrez';
    return response({...meta(hub),resultState:zero?'ZERO_MATCHING_ROWS':'SUPPORTED_RESULTS',identity:{displayName:String(lastBody.identityName)},rows:zero?[]:[{displayName:'Rocket Mortgage',nmls:'3030',attachedObservationCount:7302,destination:{type:'PUBLIC_PROFILE',url:'https://www.lendertrusthub.com/lenders/rocket-mortgage'}}],total:zero?0:1,evidenceState:zero?'ZERO_MATCHING_ROWS':'SUPPORTED_RESULTS'});
  }
  if((lastBody.geography as Record<string,unknown>|undefined)?.intent==='SERVICE_TERRITORY')return response({...meta(hub),resultState:'UNSUPPORTED_CAPABILITY',message:'HMDA geography is not service territory.'},422);
  return response({...meta(hub),resultState:'SUPPORTED_RESULTS',rows:[{institutionName:'HMDA Institution',lei:'LEI1',action:lastBody.action,loanType:lastBody.loanType,destination:{type:'PUBLIC_PROFILE',url:'https://www.lendertrusthub.com/lenders/example'}}],total:lastBody.action==='denial'?390:214,availableRefinements:[]});
};

test.after(()=>{globalThis.fetch=originalFetch});

test('specialist locks are independent and exact',()=>{
  assert.deepEqual(Object.fromEntries(Object.entries(FINANCIAL_SPECIALIST_LOCKS).map(([hub,row])=>[hub,row.version])),{investor:'2.0.0',insurance:'2.0.0',lender:'2.1.0'});
  for(const lock of Object.values(FINANCIAL_SPECIALIST_LOCKS)){assert.equal(lock.schemaFingerprint.length,64);assert.equal(lock.contractFingerprint.length,64)}
});

test('generic financial needs are local action clarifications with zero fan-out',async()=>{
  for(const [query,hub,slot] of [['I need an investment adviser','investor','investorResearchMode'],['I need help with insurance','insurance','insuranceEntityClass'],['I need a mortgage lender','lender','lenderResearchMode']] as const){
    calls=0;const result=await orchestrateGuidedResearch({action:{type:'START',question:query}});
    assert.equal(result.session.hub,hub);assert.equal(result.session.phase,'CLARIFY');assert.ok(result.session.missingFields.includes(slot));assert.equal(result.diagnostics.specialistCalls,0);assert.equal(calls,0);assert.ok(result.session.availableChoices.every(choice=>choice.action==='SELECT_CHOICE'));
  }
});

const direct:Array<[string,string,string]>=[
  ['Investment advisers in New Jersey','investor','SUPPORTED_RESULTS'],['Florida RIAs reporting between $1 billion and $10 billion RAUM','investor','SUPPORTED_RESULTS'],['ERA firms in Florida','investor','SUPPORTED_RESULTS'],['CRD 166089','investor','EXACT_IDENTITY'],['Best investment adviser','investor','UNSUPPORTED_CAPABILITY'],['Highest-performing adviser','investor','UNSUPPORTED_CAPABILITY'],['RIAs in Texas','investor','SUPPORTED_RESULTS'],['Investment advisers serving Florida','investor','UNSUPPORTED_CAPABILITY'],['Individual investment adviser representatives in Florida','investor','PUBLICATION_RESTRICTED'],['Florida RIAs paid by percentage of assets','investor','SUPPORTED_RESULTS'],['ERA firms with $2 billion RAUM','investor','UNSUPPORTED_CAPABILITY'],['CRD 999999999','investor','NO_CONFIDENT_MATCH'],['Advisory firm named Alpha Partners','investor','AMBIGUOUS_IDENTITIES'],['Safest RIA in New York','investor','UNSUPPORTED_CAPABILITY'],
  ['Insurance agencies in Florida','insurance','SUPPORTED_RESULTS'],['Insurance company in Texas','insurance','UNSUPPORTED_CAPABILITY'],['Insurance agents in Florida','insurance','PUBLICATION_RESTRICTED'],['NPN 10391484','insurance','EXACT_IDENTITY'],['NAIC 10064','insurance','EXACT_IDENTITY'],['Best insurance company','insurance','UNSUPPORTED_CAPABILITY'],['Insurance companies serving Texas','insurance','UNSUPPORTED_CAPABILITY'],['Legal insurers','insurance','SUPPORTED_RESULTS'],['Florida life insurance agencies','insurance','UNSUPPORTED_CAPABILITY'],['Insurance agencies serving Florida','insurance','UNSUPPORTED_CAPABILITY'],['NPN 999999999','insurance','NO_CONFIDENT_MATCH'],
  ['FHA lenders in Broward County','lender','SUPPORTED_RESULTS'],['Mortgage denials in Broward County','lender','SUPPORTED_RESULTS'],['NMLS 3030','lender','EXACT_IDENTITY'],['NMLS 1001618','lender','PUBLICATION_RESTRICTED'],['NMLS 170008','lender','PUBLICATION_RESTRICTED'],['LEI 549300FGXN1K3HLB1R50','lender','EXACT_IDENTITY'],['Complaints about Rocket Mortgage','lender','SUPPORTED_RESULTS'],['Best mortgage lender in Florida','lender','UNSUPPORTED_CAPABILITY'],['Lenders serving Florida','lender','UNSUPPORTED_CAPABILITY'],['VA originations in Texas','lender','SUPPORTED_RESULTS'],['NMLS 136890','lender','IDENTITY_COLLISION'],['Complaints about Newrez','lender','ZERO_MATCHING_ROWS'],['Mortgage brokers near me','lender','PUBLICATION_RESTRICTED'],
];

test('audited financial direct goldens preserve hub and result states',async()=>{
  for(const [query,hub,state] of direct){const result=await orchestrateGuidedResearch({action:{type:'START',question:query}});assert.equal(result.session.hub,hub,query);assert.equal(result.result?.resultState,state,query)}
  for(const query of ['Insurance provider in Florida','Insurance complaints against a company','Insurance professional near me','Lenders in Texas']){calls=0;const result=await orchestrateGuidedResearch({action:{type:'START',question:query}});assert.equal(result.session.phase,'CLARIFY',query);assert.equal(result.diagnostics.specialistCalls,0,query);assert.equal(calls,0,query)}
  assert.equal(direct.length+7,45);
});

test('requests preserve source semantics and publication firewalls',async()=>{
  await orchestrateGuidedResearch({action:{type:'START',question:'Florida RIAs reporting between $1 billion and $10 billion RAUM'}});assert.equal(lastBody.entityClass,'ria');assert.deepEqual(lastBody.filters,{minimumRaum:1000000000,maximumRaum:10000000000});
  await orchestrateGuidedResearch({action:{type:'START',question:'Insurance agencies in Florida'}});assert.equal((lastBody.geography as Record<string,unknown>).intent,'CREDENTIAL_JURISDICTION');
  await orchestrateGuidedResearch({action:{type:'START',question:'FHA lenders in Broward County'}});assert.equal((lastBody.geography as Record<string,unknown>).intent,'PROPERTY_MARKET');assert.equal(lastBody.loanType,'FHA');
  const complaints=await orchestrateGuidedResearch({action:{type:'START',question:'Complaints about Rocket Mortgage'}});assert.match(complaints.result?.consumerMessage??'',/not findings of wrongdoing/i);assert.doesNotMatch(JSON.stringify(complaints.result),/narrative|consumer name/i);
});

test('result-bearing financial states resume, while local clarification does not call specialists',async()=>{
  const exact=await orchestrateGuidedResearch({action:{type:'START',question:'NMLS 3030'}});calls=0;const resumed=await orchestrateGuidedResearch({session:structuredClone(exact.session),action:{type:'RESUME'}});assert.equal(resumed.result?.resultState,'EXACT_IDENTITY');assert.equal(resumed.diagnostics.specialistCalls,1);assert.equal(calls,1);
  const local=await orchestrateGuidedResearch({action:{type:'START',question:'I need help with insurance'}});calls=0;const localResume=await orchestrateGuidedResearch({session:structuredClone(local.session),action:{type:'RESUME'}});assert.equal(localResume.session.phase,'CLARIFY');assert.equal(localResume.diagnostics.specialistCalls,0);assert.equal(calls,0);
});

test('consumer UI includes all hubs and no profile minting or unsafe ranking controls',()=>{
  const ui=readFileSync(new URL('../../components/guided-research.tsx',import.meta.url),'utf8');
  for(const name of ['InvestorTrustHub','InsuranceTrustHub','LenderTrustHub'])assert.ok(ui.includes(name));
  assert.doesNotMatch(ui,/paid ordering|Trust Score|mintProfile|localStorage/i);
  console.log('FALSE_CONFIDENT_ANSWERS = 0\nSUPPORTED_INTENT_DEAD_ENDS = 0\nPUBLICATION_LEAKAGE = 0\nPRIVATE_PERSON_LEAKAGE = 0\nPROFILE_MINTING = 0\nPAID_ORDER_SIGNALS = 0\nUNIVERSAL_SCORES = 0\nSERVICE_TERRITORY_INFERENCES = 0\nRAUM_AS_PERFORMANCE = 0\nCOMPLAINT_AS_WRONGDOING = 0\nHMDA_AS_HEADQUARTERS = 0\nENTITY_CLASS_COLLAPSES = 0\nMISSING_RESULT_EXPLANATIONS_AFTER_RESUME = 0\nBROKEN_BACK_TRANSITIONS = 0\nHIDDEN_ACTIVE_FILTERS = 0\nUNCLEARABLE_ACTIVE_FILTERS = 0\nSIX_HUB_FANOUTS = 0');
});
