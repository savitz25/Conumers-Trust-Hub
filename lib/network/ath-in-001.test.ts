import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { resolveAskNameState } from './name-candidates/page-state.ts';
import { createFixtureAdapters } from './name-candidates/fixtures.ts';
import { IN_HUBS, IN_PUBLICATION_FINGERPRINT, IN_PUBLICATION_MANIFEST as M, IN_RANKING_REFUSAL, inPublicationSemanticFingerprint, inReleaseGatePassed, inSpecialistUrl } from './in-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateSitemapEntries } from './published-ask-states.ts';
import { planAskResearch } from './research-planner.ts';

const routing:Array<[typeof IN_HUBS[number],string[]]>=[
  ['move',['mover Indiana','USDOT 1234567 Indiana']],
  ['contractor',['contractor Indiana','electrical contractor Indiana','HVAC contractor Indiana','plumbing contractor Indiana']],
  ['lender',['mortgage lender Indiana','mortgage broker Indiana','loan broker Indiana','NMLS 3030 Indiana']],
  ['insurance',['insurance company Indiana','NAIC 10064 Indiana','NPN 20000635 Indiana']],
  ['senior',['nursing home Indiana','assisted living Indiana','CCN 155001 Indiana']],
  ['investor',['investment adviser Indiana','CRD 6413 Indiana','SEC 801-12345 Indiana']],
];
for(const [hub,queries] of routing)for(const query of queries)test(`Indiana routing: ${query}`,()=>{
  const plan=planAskResearch(query);
  assert.equal(plan.primaryHub,hub,query);
  assert.equal(plan.requestedGeography?.stateCode,'IN',query);
  assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination,inSpecialistUrl(hub),query);
});

test('class-plus-Indiana precedes name candidates; an actual company name remains eligible',()=>{
  for(const query of ['mortgage lender Indiana','mortgage broker Indiana','loan broker Indiana','insurance company Indiana','plumbing contractor Indiana','nursing home Indiana','investment adviser Indiana','mover Indiana']){
    const decision=decideNameCandidateSearch(query);
    assert.equal(decision.operation,'NOT_NAME_SEARCH',query);
  }
  const realName=decideNameCandidateSearch('Indiana Members Credit Union');
  assert.equal(realName.operation,'NAME_CANDIDATES');
  if(realName.operation==='NAME_CANDIDATES')assert.equal(realName.name,'Indiana Members Credit Union');
});

test('the Ask page name-state path still returns an actual Indiana company candidate',async()=>{
  const query='Indiana Members Credit Union';
  const state=await resolveAskNameState({query,plan:planAskResearch(query)},
    {adapters:createFixtureAdapters([{hub:'lender',key:'fx-in-members',name:query,entityType:'Lender',identifier:{label:'NMLS',value:'12345'}}])});
  assert.equal(state.mode,'NAME_RESULTS');
  if(state.mode==='NAME_RESULTS')assert.deepEqual(state.response.hubs.flatMap(h=>h.candidates.map(c=>c.displayName)),[query]);
});

test('Indiana identifiers keep exact family and bare digits fail closed',()=>{
  for(const [query,hub,type] of [
    ['USDOT 1234567 Indiana insurance','move','usdot'],['MC 123456 Indiana lender','move','mc'],
    ['NMLS 3030 Indiana mover','lender','nmls'],['NAIC 10064 Indiana contractor','insurance','naic_company_code'],
    ['NPN 20000635 Indiana lender','insurance','npn'],['CCN 155001 Indiana insurance','senior','cms_ccn'],
    ['CRD 6413 Indiana mover','investor','crd'],['SEC 801-12345 Indiana mover','investor','sec_file_number'],
  ] as const){const plan=planAskResearch(query);assert.equal(plan.primaryHub,hub,query);assert.equal(plan.identifier?.type,type,query);assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);}
  for(const query of ['1234567','1234567 Indiana','license 1234567 Indiana'])assert.equal(planAskResearch(query).executionAllowed,false,query);
});

test('Indiana ranking vocabulary fails closed',()=>{
  for(const term of ['best','safest','recommended','most trustworthy','top-rated','highest-rated','#1','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking']){
    const query=`${term} Indiana contractor`;
    assert.equal(planAskResearch(query).clarificationReason,IN_RANKING_REFUSAL,query);
    assert.equal(buildAskResearchRoute(query).canExecute,false,query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h=>h.capabilityStatus!=='execute'&&!h.options?.length),query);
  }
});

test('Indiana manifest retains six frozen grains, independent clocks, and no graph or local expansion',()=>{
  const release=JSON.parse(readFileSync('data/releases/indiana-network-release.json','utf8'));
  assert.equal(inReleaseGatePassed(),true);
  assert.equal(M.hubs.length,6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  assert.equal(release.semantic_fingerprint,IN_PUBLICATION_FINGERPRINT);
  assert.equal(inPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),IN_PUBLICATION_FINGERPRINT);
  for(const id of IN_HUBS){const h=M.hubs.find(row=>row.hub_id===id)!;assert.equal(h.canonical_state_url,inSpecialistUrl(id));assert.ok(Object.keys(h.source_clocks).length>0);assert.ok(h.gaps.length>0);}
  assert.doesNotMatch(M.hubs[0].capability_summary,/\d[\d,]*\s+movers?/i);
  assert.match(M.hubs[1].capability_summary,/Plumbing Corporation credential entries/);
  assert.match(M.hubs[2].grain,/DFI Mortgage Lender listing, not an SOS Loan Broker census or HMDA activity/);
  assert.match(M.hubs[3].grain,/not insurer population or current license authority/);
  assert.match(M.hubs[4].grain,/not a combined senior total/);
  assert.match(M.hubs[5].grain,/Do not add the lenses/);
});

test('Indiana gateway publishes one statewide route and no local pages',()=>{
  const page=readFileSync('app/indiana/page.tsx','utf8');
  const ui=readFileSync('components/indiana-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1);
  assert.equal(normalizedPublishedStatePath('/Indiana'),'/indiana');
  assert.equal(askStateSitemapEntries().filter(row=>row.path==='/indiana').length,1);
  for(const city of ['indianapolis','fort-wayne','evansville','south-bend'])assert.equal(existsSync(`app/indiana/${city}`),false);
  assert.equal(normalizedPublishedStatePath('/indiana/indianapolis'),null);
  for(const city of ['Indianapolis','Fort Wayne','Evansville','South Bend']){
    const query=`${city} nursing home`;
    assert.equal(planAskResearch(query).requestedGeography?.stateCode,'IN',city);
    assert.equal(buildNetworkAskPlan(query).placeLensHref,'/indiana',city);
  }
});
