import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { WI_HUBS, WI_PUBLICATION_FINGERPRINT, WI_PUBLICATION_MANIFEST as M, WI_RANKING_REFUSAL, wiPublicationSemanticFingerprint, wiReleaseGatePassed, wiSpecialistUrl } from './wi-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateSitemapEntries } from './published-ask-states.ts';
import { planAskResearch } from './research-planner.ts';

const routing: Array<[typeof WI_HUBS[number], string[]]> = [
  ['move', ['mover Wisconsin','Wisconsin LC authority','household goods Wisconsin','USDOT 1234567 Wisconsin','MC 123456 Wisconsin']],
  ['contractor', ['contractor Wisconsin','dwelling contractor Wisconsin','electrical contractor Wisconsin','HVAC contractor Wisconsin']],
  ['lender', ['mortgage lender Wisconsin','mortgage broker Wisconsin','NMLS 3030 Wisconsin','HMDA Wisconsin']],
  ['insurance', ['insurer Wisconsin','insurance agency Wisconsin','NAIC 10064 Wisconsin','NPN 20000635 Wisconsin','OCI Wisconsin']],
  ['senior', ['nursing home Wisconsin','adult family home Wisconsin','CBRF Wisconsin','RCAC Wisconsin','hospice Wisconsin','home health Wisconsin','CCN 105502 Wisconsin']],
  ['investor', ['investment adviser Wisconsin','RIA Wisconsin','securities enforcement Wisconsin','CRD 166089 Wisconsin','SEC 801-12345 Wisconsin']],
];
for (const [hub, queries] of routing) for (const query of queries) test(`WI routing / ${query}`, () => {
  const plan = planAskResearch(query);
  assert.equal(plan.primaryHub, hub, query);
  assert.equal(plan.normalizedGeography?.stateCode, 'WI', query);
  const handoff = buildNetworkAskPlan(query).hubs[0];
  assert.equal(handoff?.destination, wiSpecialistUrl(hub), query);
  assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  if (query.startsWith('SEC ')) assert.match(handoff?.name ?? '', /InvestorTrustHub/);
});

test('WI identifier precedence, state-aware SEC handoff and bare-number safety', () => {
  for (const [query,hub,type] of [
    ['USDOT 1234567 Wisconsin insurance','move','usdot'], ['MC 123456 Wisconsin lender','move','mc'],
    ['NMLS 3030 Wisconsin mover','lender','nmls'], ['NAIC 10064 Wisconsin contractor','insurance','naic_company_code'],
    ['NPN 20000635 Wisconsin lender','insurance','npn'], ['CCN 105502 Wisconsin insurance','senior','cms_ccn'],
    ['CRD 166089 Wisconsin mover','investor','crd'], ['SEC 801-12345 Wisconsin mover','investor','sec_file_number'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.executionMode, 'IDENTIFIER', query);
    assert.equal(plan.identifier?.type, type, query);
    assert.equal(plan.entityName, undefined, query);
    assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, wiSpecialistUrl(hub), query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
  const sec = buildNetworkAskPlan('SEC 801-12345 Wisconsin');
  assert.equal(sec.hubs[0]?.destination, 'https://www.investortrusthub.com/wisconsin');
  assert.match(sec.hubs[0]?.reason ?? '', /Wisconsin/);
  for (const query of ['1234567','1234567 Wisconsin','license 1234567 Wisconsin']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
});

test('WI ranking vocabulary fails closed without a provider cohort', () => {
  const terms = ['best','safest','recommended','most trustworthy','most trusted','top-rated','highest-rated','#1','number one','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking'];
  const providers = ['mover','contractor','mortgage lender','insurance agency','nursing home','investment adviser'];
  for (const [i,term] of terms.entries()) {
    const query = `${term} Wisconsin ${providers[i % providers.length]}`;
    assert.equal(planAskResearch(query).executionAllowed, false, query);
    assert.equal(planAskResearch(query).clarificationReason, WI_RANKING_REFUSAL, query);
    assert.equal(buildAskResearchRoute(query).canExecute, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h => h.capabilityStatus !== 'execute' && !h.options?.length), query);
  }
});

test('WI manifest freezes six distinct grains, clocks, gaps and Ask boundary', () => {
  const release = JSON.parse(readFileSync('data/releases/wisconsin-network-release.json','utf8'));
  assert.equal(wiReleaseGatePassed(), true);
  assert.equal(M.hubs.length, 6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL, {status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE, 'NO');
  assert.equal(release.semantic_fingerprint, WI_PUBLICATION_FINGERPRINT);
  assert.equal(wiPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))), WI_PUBLICATION_FINGERPRINT);
  const drift = structuredClone(M); drift.hubs[0].certified_release_sha = '0'.repeat(40);
  assert.equal(wiReleaseGatePassed(drift), false);
  for (const id of WI_HUBS) {
    const h = M.hubs.find(row => row.hub_id === id)!;
    assert.equal(h.canonical_state_url, wiSpecialistUrl(id));
    assert.ok(Object.keys(h.source_clocks).length > 0);
    assert.ok(h.gaps.length > 0);
  }
  assert.doesNotMatch(M.hubs[0].capability_summary, /\d[\d,]*\s+(?:movers?|registrations?)/i);
  assert.match(M.hubs[1].grain, /not an acquired row-level roster or deduplicated company count/);
  assert.match(M.hubs[2].grain, /not a license census/);
  assert.match(M.hubs[3].grain, /not unique insurers/);
  assert.match(M.hubs[4].grain, /not a senior-provider total/);
  assert.match(M.hubs[5].grain, /office location does not establish Wisconsin registration/);
});

test('WI gateway has one indexable statewide route, six canonical links and no local routes', () => {
  const page = readFileSync('app/wisconsin/page.tsx','utf8');
  const ui = readFileSync('components/wisconsin-network-gateway.tsx','utf8');
  assert.doesNotMatch(page + ui, /['"]Dataset['"]|AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g) || []).length, 1);
  assert.equal(normalizedPublishedStatePath('/Wisconsin'), '/wisconsin');
  assert.equal(normalizedPublishedStatePath('/WISCONSIN'), '/wisconsin');
  assert.equal(askStateSitemapEntries().filter(row => row.path === '/wisconsin').length, 1);
  for (const city of ['milwaukee','madison','green-bay','kenosha']) assert.equal(existsSync(`app/wisconsin/${city}`), false);
  assert.equal(normalizedPublishedStatePath('/wisconsin/milwaukee'), null);
  for (const city of ['Milwaukee','Madison','Green Bay','Kenosha']) {
    const query = `${city} nursing home`;
    assert.equal(planAskResearch(query).normalizedGeography?.stateCode, 'WI', city);
    assert.equal(buildNetworkAskPlan(query).placeLensHref, '/wisconsin', city);
  }
  assert.equal(planAskResearch('Milwaukee Minnesota nursing home').normalizedGeography?.stateCode, 'MN');
});
