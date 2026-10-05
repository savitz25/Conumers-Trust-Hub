import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { SC_HUBS, SC_PUBLICATION_FINGERPRINT, SC_PUBLICATION_MANIFEST as M, SC_RANKING_REFUSAL, scGeography, scPublicationSemanticFingerprint, scReleaseGatePassed, scSpecialistUrl } from './sc-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries } from './published-ask-states.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { planAskResearch } from './research-planner.ts';

const routing:Array<[typeof SC_HUBS[number],string[]]>=[
  ['move',['mover South Carolina','household goods in sc','USDOT 1234567 South Carolina','mover SC','MOVERS IN SOUTH CAROLINA']],
  ['contractor',['contractor South Carolina','electrical contractor South Carolina','HVAC contractor South Carolina','plumbing contractor South Carolina']],
  ['lender',['mortgage lender South Carolina','mortgage servicer South Carolina','NMLS 3030 SC','within sc mortgage']],
  ['insurance',['insurance company South Carolina','NAIC 10064 South Carolina','NPN 20000635 South Carolina','state of sc insurance company']],
  ['senior',['nursing home South Carolina','assisted living South Carolina','CCN 155001 South Carolina']],
  ['investor',['investment adviser South Carolina','CRD 6413 South Carolina','SEC 801-12345 South Carolina']],
];
for(const [hub,queries] of routing)for(const query of queries)test(`South Carolina routing: ${query}`,()=>{
  const plan=planAskResearch(query);
  assert.equal(plan.primaryHub,hub,query);
  assert.equal(plan.requestedGeography?.stateCode,'SC',query);
  assert.equal(plan.executionAllowed,true,query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination,scSpecialistUrl(hub),query);
});

test('lowercase sc, bare cities, and another state named first stay outside the South Carolina gateway',()=>{
  assert.equal(scGeography('mover sc'),undefined);
  assert.equal(scGeography('best sc advisers'),undefined);
  assert.equal(scGeography('nursing home Charleston'),undefined);
  assert.equal(scGeography('nursing home Columbia'),undefined);
  assert.equal(scGeography('nursing home Greenville'),undefined);
  assert.equal(scGeography('nursing home North Carolina')?.stateCode,undefined);
  assert.equal(scGeography('Texas movers in South Carolina')?.stateCode,undefined);
  assert.equal(scGeography('household goods in sc')?.stateCode,'SC');
  assert.equal(scGeography('nursing home Charleston, South Carolina')?.city,'Charleston');
  assert.equal(planAskResearch('mover Alabama').requestedGeography?.stateCode,'AL');
});

test('class-plus-South Carolina precedes name candidates',()=>{
  for(const query of ['mortgage lender South Carolina','insurance company South Carolina','plumbing contractor South Carolina','nursing home South Carolina','investment adviser South Carolina','mover South Carolina']){
    assert.equal(decideNameCandidateSearch(query).operation,'NOT_NAME_SEARCH',query);
  }
});

test('South Carolina identifiers keep exact family and bare digits fail closed',()=>{
  const rows:[string,string,string][]=[
    ['USDOT 1234567 South Carolina insurance','move','usdot'],['MC 123456 South Carolina lender','move','mc'],
    ['NMLS 3030 South Carolina mover','lender','nmls'],['NAIC 10064 South Carolina contractor','insurance','naic_company_code'],
    ['NPN 20000635 South Carolina lender','insurance','npn'],['CCN 155001 South Carolina insurance','senior','cms_ccn'],
    ['CRD 6413 South Carolina mover','investor','crd'],['SEC 801-12345 South Carolina mover','investor','sec_file_number'],
  ];
  for(const [query,hub,type] of rows){
    const plan=planAskResearch(query);
    assert.equal(plan.primaryHub,hub,query);
    assert.equal(plan.identifier?.type,type,query);
  }
  for(const query of ['1234567','1234567 South Carolina','license 1234567 South Carolina'])assert.equal(planAskResearch(query).executionAllowed,false,query);
});

test('South Carolina ranking vocabulary fails closed',()=>{
  for(const term of ['best','safest','recommended','top-rated','Trust Score','AggregateRating']){
    const query=`${term} South Carolina contractor`;
    const plan=planAskResearch(query);
    assert.equal(plan.executionAllowed,false,query);
    assert.match(plan.clarificationReason??'',/does not rank/);
  }
  assert.match(SC_RANKING_REFUSAL,/Trust Score/);
});

test('South Carolina manifest retains six frozen grains and the derived catalog count',()=>{
  const release=JSON.parse(readFileSync('data/releases/south-carolina-network-release.json','utf8'));
  assert.equal(scReleaseGatePassed(),true);
  assert.equal(M.hubs.length,6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL,{status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES,0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED,false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE,'NO');
  assert.equal(release.semantic_fingerprint,SC_PUBLICATION_FINGERPRINT);
  assert.equal(release.starting_ask_main,'55ca1d103da9ab6dfa9ecaae5de9da031b232176');
  assert.equal(scPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))),SC_PUBLICATION_FINGERPRINT);
  for(const id of SC_HUBS){const h=M.hubs.find(row=>row.hub_id===id)!;assert.equal(h.canonical_state_url,scSpecialistUrl(id));assert.ok(h.gaps.length>0);}
  assert.match(M.hubs[0].grain,/149 distinct certificate numbers/);
  assert.match(M.hubs[0].grain,/not household goods/);
  assert.match(M.hubs[1].grain,/not one South Carolina contractor census/);
  assert.match(M.hubs[1].grain,/1,60/);
  assert.match(M.hubs[2].grain,/not split/);
  assert.match(M.hubs[2].grain,/not licensure/);
  assert.match(M.hubs[3].grain,/are not added to 2,229/);
  assert.match(M.hubs[3].grain,/not a finding of wrongdoing/);
  assert.match(M.hubs[4].grain,/not one senior population/);
  assert.match(M.hubs[4].grain,/not a bed count/);
  assert.match(M.hubs[5].grain,/not South Carolina registration/);
  assert.match(M.hubs[5].grain,/not a finding census/);
  assert.doesNotMatch(JSON.stringify(M),/49,?355|23,?796|73,?151|\b153\b|\b123\b|2,?400|2,?336|\b111\b|-1,?403|AggregateRating|Trust Score/);
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug,'south-carolina');
  assert.equal(ASK_NETWORK_STATES.length,ASK_PUBLISHED_STATE_CATALOG.length);
  assert.ok(ASK_NETWORK_STATES.some((state)=>state.slug==='alabama'));
  assert.match(askStateExplorerEyebrow(),new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
});

test('South Carolina gateway publishes one statewide route and no local pages',()=>{
  const page=readFileSync('app/south-carolina/page.tsx','utf8');
  const ui=readFileSync('components/south-carolina-network-gateway.tsx','utf8');
  assert.doesNotMatch(page+ui,/AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g)||[]).length,1);
  assert.equal(normalizedPublishedStatePath('/South-Carolina'),'/south-carolina');
  assert.equal(askStateSitemapEntries().filter(row=>row.path==='/south-carolina').length,1);
  for(const city of ['charleston','columbia','greenville'])assert.equal(existsSync(`app/south-carolina/${city}`),false);
  assert.equal(normalizedPublishedStatePath('/south-carolina/charleston'),null);
  for(const city of ['Charleston','Columbia','Greenville']){
    assert.equal(planAskResearch(`nursing home ${city}`).requestedGeography?.stateCode,undefined,city);
    assert.equal(buildNetworkAskPlan(`nursing home ${city}, South Carolina`).placeLensHref,'/south-carolina',city);
  }
});
