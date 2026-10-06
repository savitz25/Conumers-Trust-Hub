import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { MS_HUBS, MS_PUBLICATION_FINGERPRINT, MS_PUBLICATION_MANIFEST as M, MS_RANKING_REFUSAL, msGeography, msPublicationSemanticFingerprint, msReleaseGatePassed, msSpecialistUrl } from './ms-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries } from './published-ask-states.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { planAskResearch } from './research-planner.ts';

const routing:Array<[typeof MS_HUBS[number],string[]]>=[
  ['move',['mover Mississippi','household goods in ms','USDOT 1234567 Mississippi','mover MS','MOVERS IN MISSISSIPPI']],
  ['contractor',['contractor Mississippi','electrical contractor Mississippi','HVAC contractor Mississippi','plumbing contractor Mississippi']],
  ['lender',['mortgage lender Mississippi','mortgage servicer Mississippi','NMLS 3030 MS','within ms mortgage']],
  ['insurance',['insurance company Mississippi','NAIC 10064 Mississippi','NPN 20000635 Mississippi','state of ms insurance company']],
  ['senior',['nursing home Mississippi','assisted living Mississippi','CCN 155001 Mississippi']],
  ['investor',['investment adviser Mississippi','CRD 6413 Mississippi','SEC 801-12345 Mississippi']],
];
for(const [hub,queries] of routing)for(const query of queries)test(`Mississippi routing: ${query}`,()=>{
  const plan=planAskResearch(query);
  assert.equal(plan.primaryHub,hub,query);
  assert.equal(plan.requestedGeography?.stateCode,'MS',query);
  assert.equal(plan.executionAllowed,true,query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination,msSpecialistUrl(hub),query);
});

test('lowercase ms, bare cities, and another state named first stay outside the Mississippi gateway',()=>{
  assert.equal(msGeography('mover ms'),undefined);
  assert.equal(msGeography('best ms advisers'),undefined);
  assert.equal(msGeography('nursing home Jackson'),undefined);
  assert.equal(msGeography('nursing home Gulfport'),undefined);
  assert.equal(msGeography('nursing home Biloxi'),undefined);
  assert.equal(msGeography('nursing home Missouri')?.stateCode,undefined);
  assert.equal(msGeography('nursing home Massachusetts')?.stateCode,undefined);
  assert.equal(msGeography('nursing home Indiana')?.stateCode,undefined);
  assert.equal(msGeography('Texas movers in Mississippi')?.stateCode,undefined);
  assert.equal(msGeography('household goods in ms')?.stateCode,'MS');
  assert.equal(msGeography('nursing home Jackson, Mississippi')?.city,'Jackson');
  assert.equal(planAskResearch('investment adviser in missouri').requestedGeography?.stateCode,'MO');
  assert.equal(planAskResearch('investment adviser in sc').requestedGeography?.stateCode,'SC');
  assert.equal(planAskResearch('mover Alabama').requestedGeography?.stateCode,'AL');
});

test('class-plus-Mississippi precedes name candidates',()=>{
  for(const query of ['mortgage lender Mississippi','insurance company Mississippi','plumbing contractor Mississippi','nursing home Mississippi','investment adviser Mississippi','mover Mississippi']){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
  }
});

test('Mississippi identifiers keep exact family and bare digits fail closed',()=>{
  const rows:[string,string,string][]=[
    ['USDOT 1234567 Mississippi insurance','move','usdot'],['MC 123456 Mississippi lender','move','mc'],
    ['NMLS 3030 Mississippi mover','lender','nmls'],['NAIC 10064 Mississippi contractor','insurance','naic_company_code'],
    ['NPN 20000635 Mississippi lender','insurance','npn'],['CCN 155001 Mississippi insurance','senior','cms_ccn'],
    ['CRD 6413 Mississippi mover','investor','crd'],['SEC 801-12345 Mississippi mover','investor','sec_file_number'],
  ];
  for(const [query,hub,type] of rows){
    const plan=planAskResearch(query);
    assert.equal(plan.primaryHub,hub,query);
    assert.equal(plan.identifier?.type,type,query);
  }
  for(const query of ['1234567','1234567 Mississippi','license 1234567 Mississippi'])assert.equal(planAskResearch(query).executionAllowed,false,query);
});

test('Mississippi ranking vocabulary fails closed',()=>{
  for(const term of ['best','safest','recommended','top-rated','Trust Score','AggregateRating']){
    const query=`${term} Mississippi contractor`;
    const plan=planAskResearch(query);
    assert.equal(plan.executionAllowed,false,query);
    assert.match(plan.clarificationReason??'',/does not rank/);
  }
  assert.match(MS_RANKING_REFUSAL,/Trust Score/);
});

test('Mississippi manifest retains six frozen grains and the derived catalog count',()=>{
  const release=JSON.parse(readFileSync('data/releases/mississippi-network-release.json','utf8'));
  assert.equal(msReleaseGatePassed(),true);
  assert.equal(M.hubs.length,6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  assert.equal(release.semantic_fingerprint,MS_PUBLICATION_FINGERPRINT);
  assert.equal(release.starting_ask_main,'e6130ef5a04b0d297acf884013571ba33f576c66');
  assert.equal(msPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),MS_PUBLICATION_FINGERPRINT);
  for(const id of MS_HUBS){const h=M.hubs.find(row=>row.hub_id===id)!;assert.equal(h.canonical_state_url,msSpecialistUrl(id));assert.ok(h.gaps.length>0);}
  assert.match(M.hubs[0].grain,/not acquired/);
  assert.match(M.hubs[0].grain,/not zero/);
  assert.match(M.hubs[1].grain,/3,425/);
  assert.match(M.hubs[1].grain,/not the licensed count/);
  assert.match(M.hubs[2].grain,/not split/);
  assert.match(M.hubs[2].grain,/not a license census/);
  assert.match(M.hubs[3].grain,/are not added/);
  assert.match(M.hubs[3].grain,/not producer licenses/);
  assert.match(M.hubs[4].grain,/not one senior population/);
  assert.match(M.hubs[4].grain,/not invented/);
  assert.match(M.hubs[5].grain,/not Mississippi registration/);
  assert.match(M.hubs[5].grain,/are not added/);
  assert.doesNotMatch(JSON.stringify(M),/12,?774|38,?709|\b1,?304\b|AggregateRating|Trust Score/);
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug,'mississippi');
  assert.equal(ASK_NETWORK_STATES.length,ASK_PUBLISHED_STATE_CATALOG.length);
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='south-carolina'));
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='alabama'));
  assert.match(askStateExplorerEyebrow(),new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
});

test('Mississippi gateway publishes one statewide route and no local pages',()=>{
  const page=readFileSync('app/mississippi/page.tsx','utf8');
  const ui=readFileSync('components/mississippi-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1);
  assert.equal(normalizedPublishedStatePath('/Mississippi'),'/mississippi');
  assert.equal(askStateSitemapEntries().filter(row=>row.path==='/mississippi').length,1);
  for(const city of ['jackson','gulfport','biloxi'])assert.equal(existsSync(`app/mississippi/${city}`),false);
  assert.equal(normalizedPublishedStatePath('/mississippi/jackson'),null);
  for(const city of ['Jackson','Gulfport','Biloxi']){
    assert.equal(planAskResearch(`nursing home ${city}`).requestedGeography?.stateCode,undefined,city);
    assert.equal(buildNetworkAskPlan(`nursing home ${city}, Mississippi`).placeLensHref,'/mississippi',city);
  }
});
