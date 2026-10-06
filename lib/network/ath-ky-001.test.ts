import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { resolveAskNameState } from './name-candidates/page-state.ts';
import { createFixtureAdapters } from './name-candidates/fixtures.ts';
import { KY_HUBS, KY_PUBLICATION_FINGERPRINT, KY_PUBLICATION_MANIFEST as M, KY_RANKING_REFUSAL, kyGeography, kyPublicationSemanticFingerprint, kyReleaseGatePassed, kySpecialistUrl } from './ky-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries } from './published-ask-states.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { planAskResearch } from './research-planner.ts';

const routing:Array<[typeof KY_HUBS[number],string[]]>=[
  ['move',['mover Kentucky','household goods in ky','USDOT 1234567 Kentucky','mover KY']],
  ['contractor',['contractor Kentucky','electrical contractor Kentucky','HVAC contractor Kentucky','plumbing contractor Kentucky','general contractor Kentucky']],
  ['lender',['mortgage lender Kentucky','loan broker Kentucky','NMLS 3030 KY','within ky mortgage']],
  ['insurance',['insurance company Kentucky','NAIC 10064 Kentucky','NPN 20000635 Kentucky','state of ky insurance company']],
  ['senior',['nursing home Kentucky','assisted living Kentucky','CCN 155001 Kentucky']],
  ['investor',['investment adviser Kentucky','CRD 6413 Kentucky','SEC 801-12345 Kentucky']],
];
for(const [hub,queries] of routing)for(const query of queries)test(`Kentucky routing: ${query}`,()=>{
  const plan=planAskResearch(query);
  assert.equal(plan.primaryHub,hub,query);
  assert.equal(plan.requestedGeography?.stateCode,'KY',query);
  assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination,kySpecialistUrl(hub),query);
});

test('lowercase ky and another state named first stay outside the Kentucky gateway',()=>{
  assert.equal(kyGeography('best ky movers'),undefined);
  assert.equal(kyGeography('ky'),undefined);
  assert.equal(kyGeography('Texas movers in Kentucky')?.stateCode,undefined);
  assert.notEqual(planAskResearch('best ky movers').requestedGeography?.stateCode,'KY');
  assert.equal(planAskResearch('movers Louisiana').requestedGeography?.stateCode,'LA');
});

test('class-plus-Kentucky precedes name candidates; an actual company name remains eligible',()=>{
  for(const query of ['mortgage lender Kentucky','loan broker Kentucky','insurance company Kentucky','plumbing contractor Kentucky','nursing home Kentucky','investment adviser Kentucky','mover Kentucky']){
    const decision=decideNameCandidateSearch(query);
    assert.equal(decision.operation,'NOT_NAME_SEARCH',query);
  }
  const realName=decideNameCandidateSearch('Kentucky Members Credit Union');
  assert.equal(realName.operation,'NAME_CANDIDATES');
  if(realName.operation==='NAME_CANDIDATES')assert.equal(realName.name,'Kentucky Members Credit Union');
});

test('the Ask page name-state path still returns an actual Kentucky company candidate',async()=>{
  const query='Kentucky Members Credit Union';
  const state=await resolveAskNameState({query,plan:planAskResearch(query)},
    {adapters:createFixtureAdapters([{hub:'lender',key:'fx-ky-members',name:query,entityType:'Lender',identifier:{label:'NMLS',value:'12345'}}])});
  assert.equal(state.mode,'NAME_RESULTS');
  if(state.mode==='NAME_RESULTS')assert.deepEqual(state.response.hubs.flatMap(h=>h.candidates.map(c=>c.displayName)),[query]);
});

test('Kentucky identifiers keep exact family and bare digits fail closed',()=>{
  for(const [query,hub,type] of [
    ['USDOT 1234567 Kentucky insurance','move','usdot'],['MC 123456 Kentucky lender','move','mc'],
    ['NMLS 3030 Kentucky mover','lender','nmls'],['NAIC 10064 Kentucky contractor','insurance','naic_company_code'],
    ['NPN 20000635 Kentucky lender','insurance','npn'],['CCN 155001 Kentucky insurance','senior','cms_ccn'],
    ['CRD 6413 Kentucky mover','investor','crd'],['SEC 801-12345 Kentucky mover','investor','sec_file_number'],
  ] as const){const plan=planAskResearch(query);assert.equal(plan.primaryHub,hub,query);assert.equal(plan.identifier?.type,type,query);assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);}
  for(const query of ['1234567','1234567 Kentucky','license 1234567 Kentucky'])assert.equal(planAskResearch(query).executionAllowed,false,query);
});

test('Kentucky ranking vocabulary fails closed',()=>{
  for(const term of ['best','safest','recommended','most trustworthy','top-rated','highest-rated','#1','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking']){
    const query=`${term} Kentucky contractor`;
    assert.equal(planAskResearch(query).clarificationReason,KY_RANKING_REFUSAL,query);
    assert.equal(buildAskResearchRoute(query).canExecute,false,query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h=>h.capabilityStatus!=='execute'&&!h.options?.length),query);
  }
});

test('Kentucky manifest retains six frozen grains, independent clocks, and no graph or local expansion',()=>{
  const release=JSON.parse(readFileSync('data/releases/kentucky-network-release.json','utf8'));
  const published=JSON.stringify(M);
  assert.equal(kyReleaseGatePassed(),true);
  assert.equal(M.hubs.length,6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  assert.equal(release.semantic_fingerprint,KY_PUBLICATION_FINGERPRINT);
  assert.equal(release.starting_ask_main,'494f4321fea5daf5d690b0c29e9bc3b8707ae1a7');
  assert.equal(kyPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),KY_PUBLICATION_FINGERPRINT);
  for(const id of KY_HUBS){const h=M.hubs.find(row=>row.hub_id===id)!;assert.equal(h.canonical_state_url,kySpecialistUrl(id));assert.ok(Object.keys(h.source_clocks).length>0);assert.ok(h.gaps.length>0);}
  assert.match(M.hubs[0].grain,/not FMCSA interstate authority/);
  assert.match(M.hubs[0].grain,/not proof of current insurance or tariff compliance/);
  assert.match(M.hubs[1].grain,/not a company census and not a statewide general-contractor count/);
  assert.match(M.hubs[1].grain,/no statewide general contractor license/);
  assert.match(M.hubs[2].grain,/not a distinct-company count/);
  assert.match(M.hubs[2].grain,/not a lender census/);
  assert.match(M.hubs[2].grain,/not licenses/);
  assert.match(M.hubs[3].grain,/inside the 1,734, not added to it/);
  assert.match(M.hubs[3].grain,/not an enforcement action/);
  assert.match(M.hubs[4].grain,/not one Kentucky senior total/);
  assert.match(M.hubs[4].grain,/blank is not zero/);
  assert.match(M.hubs[5].grain,/not dropped/);
  assert.match(M.hubs[5].grain,/different clock/);
  assert.doesNotMatch(published,/1,173|1,174|1,678|1173|1174|1678/);
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='kentucky'));
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug,'mississippi');
  assert.equal(ASK_NETWORK_STATES.length,ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(),new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  const evidence=readFileSync('lib/network-metrics/network-evidence.ts','utf8');
  assert.equal((evidence.match(/'\/kentucky'/g)||[]).length,6);
});

test('Kentucky gateway publishes one statewide route and no local pages',()=>{
  const page=readFileSync('app/kentucky/page.tsx','utf8');
  const ui=readFileSync('components/kentucky-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.doesNotMatch(page+ui,/1,173|1,174|1,678/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1);
  assert.equal(normalizedPublishedStatePath('/Kentucky'),'/kentucky');
  assert.equal(askStateSitemapEntries().filter(row=>row.path==='/kentucky').length,1);
  for(const city of ['louisville','lexington'])assert.equal(existsSync(`app/kentucky/${city}`),false);
  assert.equal(normalizedPublishedStatePath('/kentucky/louisville'),null);
  for(const city of ['Louisville','Lexington']){
    const query=`${city} nursing home`;
    assert.equal(planAskResearch(query).requestedGeography?.stateCode,'KY',city);
    assert.equal(buildNetworkAskPlan(query).placeLensHref,'/kentucky',city);
  }
});

test('a combined Kentucky facility question fails closed',()=>{
  const plan=planAskResearch('how many Kentucky senior facilities');
  assert.equal(plan.executionAllowed,false);
  assert.match(plan.clarificationReason??'',/cannot be summed/);
});
