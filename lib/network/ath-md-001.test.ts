import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { MD_HUBS, MD_PUBLICATION_FINGERPRINT, MD_PUBLICATION_MANIFEST as M, MD_RANKING_REFUSAL, mdPublicationSemanticFingerprint, mdReleaseGatePassed, mdSpecialistUrl } from './md-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateSitemapEntries } from './published-ask-states.ts';
import { planAskResearch } from './research-planner.ts';

const routing: Array<[typeof MD_HUBS[number], string[]]> = [
  ['move', ['mover Maryland','household goods mover Maryland','Maryland mover registration','USDOT 1234567 Maryland','MC 123456 Maryland']],
  ['contractor', ['contractor Maryland','MHIC Maryland','home improvement contractor Maryland','Guaranty Fund Maryland','contractor discipline Maryland']],
  ['lender', ['mortgage lender Maryland','mortgage broker Maryland','mortgage servicer Maryland','NMLS 3030 Maryland','HMDA Maryland']],
  ['insurance', ['insurer Maryland','insurance agency Maryland','insurance producer Maryland','NAIC 10064 Maryland','NPN 20000635 Maryland','MIA orders Maryland']],
  ['senior', ['assisted living Maryland','nursing home Maryland','hospice Maryland','home health Maryland','CCN 105502 Maryland']],
  ['investor', ['investment adviser Maryland','RIA Maryland','securities enforcement Maryland','CRD 166089 Maryland','SEC file 801-12345 Maryland']],
];
for (const [hub, queries] of routing) for (const query of queries) test(`MD routing / ${query}`, () => {
  const plan = planAskResearch(query);
  assert.equal(plan.primaryHub, hub, query);
  assert.equal(plan.normalizedGeography?.stateCode, 'MD', query);
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, mdSpecialistUrl(hub), query);
  assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
});

test('MD labeled identifier family outranks incidental vertical words; bare digits stay untyped', () => {
  for (const [query,hub,type] of [
    ['USDOT 1234567 Maryland insurance','move','usdot'], ['MC 123456 Maryland lender','move','mc'],
    ['NMLS 3030 Maryland mover','lender','nmls'], ['NAIC 10064 Maryland contractor','insurance','naic_company_code'],
    ['NPN 20000635 Maryland lender','insurance','npn'], ['CCN 105502 Maryland insurance','senior','cms_ccn'],
    ['CRD 166089 Maryland mover','investor','crd'], ['SEC file 801-12345 Maryland mover','investor','sec_file_number'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.executionMode, 'IDENTIFIER', query);
    assert.equal(plan.identifier?.type, type, query);
    assert.equal(plan.entityName, undefined, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
  for (const query of ['1234567','1234567 Maryland','license 1234567 Maryland']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
});

test('MD ranking vocabulary refuses execution and never forms a provider cohort', () => {
  const terms = ['best','safest','recommended','most trustworthy','most trusted','top-rated','highest-rated','#1','number one','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking'];
  const providers = ['mover','contractor','mortgage lender','insurance agency','nursing home','investment adviser'];
  for (const [i,term] of terms.entries()) {
    const query = `${term} Maryland ${providers[i % providers.length]}`;
    assert.equal(planAskResearch(query).executionAllowed, false, query);
    assert.equal(planAskResearch(query).clarificationReason, MD_RANKING_REFUSAL, query);
    assert.equal(buildAskResearchRoute(query).canExecute, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h => h.capabilityStatus !== 'execute' && !h.options?.length), query);
  }
});

test('MD manifest freezes six source grains, clocks, gaps and Ask boundary', () => {
  const release = JSON.parse(readFileSync('data/releases/maryland-network-release.json','utf8'));
  assert.equal(mdReleaseGatePassed(), true);
  assert.equal(M.hubs.length, 6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL, {status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE, 'NO');
  assert.equal(release.semantic_fingerprint, MD_PUBLICATION_FINGERPRINT);
  assert.equal(mdPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))), MD_PUBLICATION_FINGERPRINT);
  const drift = structuredClone(M); drift.hubs[0].certified_release_sha = '0'.repeat(40);
  assert.equal(mdReleaseGatePassed(drift), false);
  for (const id of MD_HUBS) {
    const h = M.hubs.find(row => row.hub_id === id)!;
    assert.equal(h.canonical_state_url, mdSpecialistUrl(id));
    assert.ok(Object.keys(h.source_clocks).length > 0);
    assert.ok(h.gaps.length > 0);
  }
  assert.doesNotMatch(M.hubs[0].capability_summary, /\d[\d,]*\s+(?:movers?|registrations?)/i);
  assert.match(M.hubs[1].grain, /not confirmed payouts/);
  assert.match(M.hubs[2].grain, /not a license census/);
  assert.match(M.hubs[3].grain, /not a deduplicated insurer census/);
  assert.match(M.hubs[4].grain, /not a senior-facility total/);
  assert.match(M.hubs[5].grain, /office location does not establish Maryland registration/);
});

test('MD gateway is one indexable statewide route with six canonical specialist links', () => {
  const page = readFileSync('app/maryland/page.tsx','utf8');
  const ui = readFileSync('components/maryland-network-gateway.tsx','utf8');
  assert.doesNotMatch(page + ui, /['"]Dataset['"]|AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g) || []).length, 1);
  assert.equal(normalizedPublishedStatePath('/Maryland'), '/maryland');
  assert.equal(normalizedPublishedStatePath('/MARYLAND'), '/maryland');
  assert.equal(askStateSitemapEntries().filter(row => row.path === '/maryland').length, 1);
  for (const city of ['baltimore','annapolis','frederick','rockville']) assert.equal(existsSync(`app/maryland/${city}`), false);
  assert.equal(normalizedPublishedStatePath('/maryland/baltimore'), null);
  for (const city of ['Baltimore','Annapolis','Frederick','Rockville']) {
    const plan = planAskResearch(`${city} nursing home`);
    assert.equal(plan.normalizedGeography?.stateCode, 'MD', city);
    assert.equal(buildNetworkAskPlan(`${city} nursing home`).placeLensHref, '/maryland', city);
  }
  assert.equal(planAskResearch('Baltimore Minnesota nursing home').normalizedGeography?.stateCode, 'MN');
  assert.equal(planAskResearch('Maryland nursing home').normalizedGeography?.stateCode, 'MD');
});
