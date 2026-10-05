import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { resolveAskNameState } from './name-candidates/page-state.ts';
import { createFixtureAdapters } from './name-candidates/fixtures.ts';
import { LA_HUBS, LA_PUBLICATION_FINGERPRINT, LA_PUBLICATION_MANIFEST as M, LA_RANKING_REFUSAL, laGeography, laPublicationSemanticFingerprint, laReleaseGatePassed, laSpecialistUrl } from './la-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateExplorerEyebrow, askStateSitemapEntries } from './published-ask-states.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { planAskResearch } from './research-planner.ts';

const routing:Array<[typeof LA_HUBS[number],string[]]>=[
  ['move',['mover Louisiana','household goods in la','USDOT 1234567 Louisiana','mover LA']],
  ['contractor',['contractor Louisiana','electrical contractor Louisiana','HVAC contractor Louisiana','plumbing contractor Louisiana']],
  ['lender',['mortgage lender Louisiana','loan broker Louisiana','NMLS 3030 LA','within la mortgage']],
  ['insurance',['insurance company Louisiana','NAIC 10064 Louisiana','NPN 20000635 Louisiana','state of la insurance company']],
  ['senior',['nursing home Louisiana','assisted living Louisiana','CCN 155001 Louisiana']],
  ['investor',['investment adviser Louisiana','CRD 6413 Louisiana','SEC 801-12345 Louisiana']],
];
for(const [hub,queries] of routing)for(const query of queries)test(`Louisiana routing: ${query}`,()=>{
  const plan=planAskResearch(query);
  assert.equal(plan.primaryHub,hub,query);
  assert.equal(plan.requestedGeography?.stateCode,'LA',query);
  assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination,laSpecialistUrl(hub),query);
});

test('lowercase la and another state named first stay outside the Louisiana gateway',()=>{
  assert.equal(laGeography('best la movers'),undefined);
  assert.equal(laGeography('la'),undefined);
  assert.equal(laGeography('Texas movers in Louisiana')?.stateCode,undefined);
  assert.notEqual(planAskResearch('best la movers').requestedGeography?.stateCode,'LA');
});

test('class-plus-Louisiana precedes name candidates; an actual company name remains eligible',()=>{
  for(const query of ['mortgage lender Louisiana','loan broker Louisiana','insurance company Louisiana','plumbing contractor Louisiana','nursing home Louisiana','investment adviser Louisiana','mover Louisiana']){
    const decision=decideNameCandidateSearch(query);
    assert.equal(decision.operation,'NOT_NAME_SEARCH',query);
  }
  const realName=decideNameCandidateSearch('Louisiana Members Credit Union');
  assert.equal(realName.operation,'NAME_CANDIDATES');
  if(realName.operation==='NAME_CANDIDATES')assert.equal(realName.name,'Louisiana Members Credit Union');
});

test('the Ask page name-state path still returns an actual Louisiana company candidate',async()=>{
  const query='Louisiana Members Credit Union';
  const state=await resolveAskNameState({query,plan:planAskResearch(query)},
    {adapters:createFixtureAdapters([{hub:'lender',key:'fx-la-members',name:query,entityType:'Lender',identifier:{label:'NMLS',value:'12345'}}])});
  assert.equal(state.mode,'NAME_RESULTS');
  if(state.mode==='NAME_RESULTS')assert.deepEqual(state.response.hubs.flatMap(h=>h.candidates.map(c=>c.displayName)),[query]);
});

test('Louisiana identifiers keep exact family and bare digits fail closed',()=>{
  for(const [query,hub,type] of [
    ['USDOT 1234567 Louisiana insurance','move','usdot'],['MC 123456 Louisiana lender','move','mc'],
    ['NMLS 3030 Louisiana mover','lender','nmls'],['NAIC 10064 Louisiana contractor','insurance','naic_company_code'],
    ['NPN 20000635 Louisiana lender','insurance','npn'],['CCN 155001 Louisiana insurance','senior','cms_ccn'],
    ['CRD 6413 Louisiana mover','investor','crd'],['SEC 801-12345 Louisiana mover','investor','sec_file_number'],
  ] as const){const plan=planAskResearch(query);assert.equal(plan.primaryHub,hub,query);assert.equal(plan.identifier?.type,type,query);assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);}
  for(const query of ['1234567','1234567 Louisiana','license 1234567 Louisiana'])assert.equal(planAskResearch(query).executionAllowed,false,query);
});

test('Louisiana ranking vocabulary fails closed',()=>{
  for(const term of ['best','safest','recommended','most trustworthy','top-rated','highest-rated','#1','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking']){
    const query=`${term} Louisiana contractor`;
    assert.equal(planAskResearch(query).clarificationReason,LA_RANKING_REFUSAL,query);
    assert.equal(buildAskResearchRoute(query).canExecute,false,query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h=>h.capabilityStatus!=='execute'&&!h.options?.length),query);
  }
});

test('Louisiana manifest retains six frozen grains, independent clocks, and no graph or local expansion',()=>{
  const release=JSON.parse(readFileSync('data/releases/louisiana-network-release.json','utf8'));
  assert.equal(laReleaseGatePassed(),true);
  assert.equal(M.hubs.length,6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  assert.equal(release.semantic_fingerprint,LA_PUBLICATION_FINGERPRINT);
  assert.equal(release.starting_ask_main,'14f50a5944c3600e9a7a5093b06b69740222283d');
  assert.equal(laPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),LA_PUBLICATION_FINGERPRINT);
  for(const id of LA_HUBS){const h=M.hubs.find(row=>row.hub_id===id)!;assert.equal(h.canonical_state_url,laSpecialistUrl(id));assert.ok(Object.keys(h.source_clocks).length>0);assert.ok(h.gaps.length>0);}
  assert.doesNotMatch(M.hubs[0].capability_summary,/\d[\d,]*\s+movers?/i);
  assert.match(M.hubs[0].grain,/not a mover census and not an insurance-minimum figure/);
  assert.match(M.hubs[1].grain,/26,369 is the certificate-row total, not a company census/);
  assert.match(M.hubs[1].grain,/Plumbing Board person licenses were not acquired/);
  assert.match(M.hubs[2].grain,/not added to 9,812/);
  assert.match(M.hubs[2].grain,/132,458 applications/);
  assert.match(M.hubs[3].grain,/2,788 is the printed FY2025 sum only/);
  assert.match(M.hubs[3].grain,/not a company census and not a producer census/);
  assert.match(M.hubs[4].grain,/not one combined senior total/);
  assert.match(M.hubs[5].grain,/overlap of approved state IA and notice is 11 and is not dropped from either side/);
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='louisiana'));
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='kentucky'));
  assert.match(askStateExplorerEyebrow(),/^\d+-state network explorer$/);
});

test('Louisiana gateway publishes one statewide route and no local pages',()=>{
  const page=readFileSync('app/louisiana/page.tsx','utf8');
  const ui=readFileSync('components/louisiana-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1);
  assert.equal(normalizedPublishedStatePath('/Louisiana'),'/louisiana');
  assert.equal(askStateSitemapEntries().filter(row=>row.path==='/louisiana').length,1);
  for(const city of ['new-orleans','baton-rouge','shreveport','lafayette'])assert.equal(existsSync(`app/louisiana/${city}`),false);
  assert.equal(normalizedPublishedStatePath('/louisiana/new-orleans'),null);
  for(const city of ['New Orleans','Baton Rouge','Shreveport','Lafayette']){
    const query=`${city} nursing home`;
    assert.equal(planAskResearch(query).requestedGeography?.stateCode,'LA',city);
    assert.equal(buildNetworkAskPlan(query).placeLensHref,'/louisiana',city);
  }
});
