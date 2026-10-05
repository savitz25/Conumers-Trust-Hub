import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { resolveAskNameState } from './name-candidates/page-state.ts';
import { createFixtureAdapters } from './name-candidates/fixtures.ts';
import { AL_HUBS, AL_PUBLICATION_FINGERPRINT, AL_PUBLICATION_MANIFEST as M, AL_RANKING_REFUSAL, alGeography, alPublicationSemanticFingerprint, alReleaseGatePassed, alSpecialistUrl } from './al-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateExplorerEyebrow, askStateSitemapEntries } from './published-ask-states.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { planAskResearch } from './research-planner.ts';

const routing:Array<[typeof AL_HUBS[number],string[]]>=[
  ['move',['mover Alabama','household goods in al','USDOT 1234567 Alabama','mover AL']],
  ['contractor',['contractor Alabama','electrical contractor Alabama','HVAC contractor Alabama','plumbing contractor Alabama']],
  ['lender',['mortgage lender Alabama','loan broker Alabama','NMLS 3030 AL','within al mortgage']],
  ['insurance',['insurance company Alabama','NAIC 10064 Alabama','NPN 20000635 Alabama','state of al insurance company']],
  ['senior',['nursing home Alabama','assisted living Alabama','CCN 155001 Alabama']],
  ['investor',['investment adviser Alabama','CRD 6413 Alabama','SEC 801-12345 Alabama']],
];
for(const [hub,queries] of routing)for(const query of queries)test(`Alabama routing: ${query}`,()=>{
  const plan=planAskResearch(query);
  assert.equal(plan.primaryHub,hub,query);
  assert.equal(plan.requestedGeography?.stateCode,'AL',query);
  assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination,alSpecialistUrl(hub),query);
});

test('lowercase al, bare mobile, and another state named first stay outside the Alabama gateway',()=>{
  assert.equal(alGeography('best al movers'),undefined);
  assert.equal(alGeography('al'),undefined);
  assert.equal(alGeography('investment adviser mobile'),undefined);
  assert.equal(alGeography('mobile financial advisers'),undefined);
  assert.equal(alGeography('Texas movers in Alabama')?.stateCode,undefined);
  assert.notEqual(planAskResearch('best al movers').requestedGeography?.stateCode,'AL');
  assert.notEqual(planAskResearch('investment adviser mobile').requestedGeography?.stateCode,'AL');
  assert.equal(alGeography('nursing home Mobile, Alabama')?.city,'Mobile');
  assert.equal(alGeography('nursing home mobile alabama')?.city,'Mobile');
  assert.equal(alGeography('nursing home Birmingham')?.stateCode,'AL');
});

test('class-plus-Alabama precedes name candidates; an actual company name remains eligible',()=>{
  for(const query of ['mortgage lender Alabama','loan broker Alabama','insurance company Alabama','plumbing contractor Alabama','nursing home Alabama','investment adviser Alabama','mover Alabama']){
    const decision=decideNameCandidateSearch(query);
    assert.equal(decision.operation,'NOT_NAME_SEARCH',query);
  }
  const realName=decideNameCandidateSearch('Alabama Power Credit Union');
  assert.equal(realName.operation,'NAME_CANDIDATES');
  if(realName.operation==='NAME_CANDIDATES')assert.equal(realName.name,'Alabama Power Credit Union');
});

test('the Ask page name-state path still returns an actual Alabama company candidate',async()=>{
  const query='Alabama Power Credit Union';
  const state=await resolveAskNameState({query,plan:planAskResearch(query)},
    {adapters:createFixtureAdapters([{hub:'lender',key:'fx-al-power',name:query,entityType:'Lender',identifier:{label:'NMLS',value:'12345'}}])});
  assert.equal(state.mode,'NAME_RESULTS');
  if(state.mode==='NAME_RESULTS')assert.deepEqual(state.response.hubs.flatMap(h=>h.candidates.map(c=>c.displayName)),[query]);
});

test('Alabama identifiers keep exact family and bare digits fail closed',()=>{
  for(const [query,hub,type] of [
    ['USDOT 1234567 Alabama insurance','move','usdot'],['MC 123456 Alabama lender','move','mc'],
    ['NMLS 3030 Alabama mover','lender','nmls'],['NAIC 10064 Alabama contractor','insurance','naic_company_code'],
    ['NPN 20000635 Alabama lender','insurance','npn'],['CCN 155001 Alabama insurance','senior','cms_ccn'],
    ['CRD 6413 Alabama mover','investor','crd'],['SEC 801-12345 Alabama mover','investor','sec_file_number'],
  ] as const){const plan=planAskResearch(query);assert.equal(plan.primaryHub,hub,query);assert.equal(plan.identifier?.type,type,query);assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);}
  for(const query of ['1234567','1234567 Alabama','license 1234567 Alabama'])assert.equal(planAskResearch(query).executionAllowed,false,query);
});

test('Alabama ranking vocabulary fails closed',()=>{
  for(const term of ['best','safest','recommended','most trustworthy','top-rated','highest-rated','#1','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking']){
    const query=`${term} Alabama contractor`;
    assert.equal(planAskResearch(query).clarificationReason,AL_RANKING_REFUSAL,query);
    assert.equal(buildAskResearchRoute(query).canExecute,false,query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h=>h.capabilityStatus!=='execute'&&!h.options?.length),query);
  }
});

test('Alabama manifest retains six frozen grains, independent clocks, and no graph or local expansion',()=>{
  const release=JSON.parse(readFileSync('data/releases/alabama-network-release.json','utf8'));
  assert.equal(alReleaseGatePassed(),true);
  assert.equal(M.hubs.length,6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  assert.equal(release.semantic_fingerprint,AL_PUBLICATION_FINGERPRINT);
  assert.equal(release.starting_ask_main,'73e7744e6013f44ab7ff2ceaabaad4c4a9cddeb4');
  assert.equal(alPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),AL_PUBLICATION_FINGERPRINT);
  for(const id of AL_HUBS){const h=M.hubs.find(row=>row.hub_id===id)!;assert.equal(h.canonical_state_url,alSpecialistUrl(id));assert.ok(Object.keys(h.source_clocks).length>0);assert.ok(h.gaps.length>0);}
  assert.doesNotMatch(M.hubs[0].capability_summary,/\d[\d,]*\s+movers?/i);
  assert.match(M.hubs[0].grain,/not a mover count/);
  assert.match(M.hubs[1].grain,/5,536 other rows stay unclassified/);
  assert.match(M.hubs[2].grain,/Those two figures are not added/);
  assert.match(M.hubs[2].grain,/206,604 applications/);
  assert.match(M.hubs[3].grain,/are not added/);
  assert.doesNotMatch(`${M.hubs[3].capability_summary} ${M.hubs[3].grain}`,/255,?578/);
  assert.match(M.hubs[4].grain,/not one senior population/);
  assert.match(M.hubs[5].grain,/not a final adjudication/);
  assert.doesNotMatch(JSON.stringify(M),/1913|1,913|1804/);
  assert.notEqual(M.hubs[5].certified_release_sha,'0000000000000000000000000000000000000000');
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug,'alabama');
  assert.equal(ASK_NETWORK_STATES.length,27);
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='kentucky'));
  assert.match(askStateExplorerEyebrow(),/^27-state network explorer$/);
});

test('Alabama gateway publishes one statewide route and no local pages',()=>{
  const page=readFileSync('app/alabama/page.tsx','utf8');
  const ui=readFileSync('components/alabama-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1);
  assert.equal(normalizedPublishedStatePath('/Alabama'),'/alabama');
  assert.equal(askStateSitemapEntries().filter(row=>row.path==='/alabama').length,1);
  for(const city of ['birmingham','montgomery','huntsville','mobile','tuscaloosa'])assert.equal(existsSync(`app/alabama/${city}`),false);
  assert.equal(normalizedPublishedStatePath('/alabama/birmingham'),null);
  for(const city of ['Birmingham','Montgomery','Huntsville','Tuscaloosa']){
    const query=`${city} nursing home`;
    assert.equal(planAskResearch(query).requestedGeography?.stateCode,'AL',city);
    assert.equal(buildNetworkAskPlan(query).placeLensHref,'/alabama',city);
  }
  assert.equal(planAskResearch('nursing home Mobile').requestedGeography?.stateCode,undefined);
  assert.equal(buildNetworkAskPlan('nursing home Mobile, Alabama').placeLensHref,'/alabama');
});
