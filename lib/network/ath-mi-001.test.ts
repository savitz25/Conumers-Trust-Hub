import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { MI_HUBS, MI_PUBLICATION_FINGERPRINT, MI_PUBLICATION_MANIFEST as M, MI_RANKING_REFUSAL, miPublicationSemanticFingerprint, miReleaseGatePassed, miSpecialistUrl } from './mi-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateSitemapEntries } from './published-ask-states.ts';
import { planAskResearch } from './research-planner.ts';

const routing: Array<[typeof MI_HUBS[number], string[]]> = [
  ['move', ['Michigan mover','Michigan household goods','CVED authority Michigan','USDOT 1234567 Michigan','MC 123456 Michigan']],
  ['lender', ['mortgage lender Michigan','mortgage servicer Michigan','NMLS 2229 Michigan','HMDA Michigan','mortgage enforcement Michigan']],
  ['contractor', ['contractor Michigan','residential builder Michigan','Michigan builder discipline','electrical contractor Michigan','plumbing contractor Michigan','mechanical contractor Michigan']],
  ['insurance', ['insurer Michigan','insurance agency Michigan','insurance producer Michigan','NAIC 12345 Michigan','NPN 123456 Michigan','DIFS insurance enforcement Michigan']],
  ['senior', ['nursing home Michigan','adult foster care Michigan','home for the aged Michigan','hospice Michigan','Michigan senior discipline','CCN 123456 Michigan']],
  ['investor', ['investment adviser Michigan','RIA Michigan','ERA Michigan','federal notice Michigan','broker-dealer Michigan','CRD 123456 Michigan','SEC file 801-12345 Michigan','securities enforcement Michigan']],
];
for (const [hub, queries] of routing) for (const query of queries) test(`MI routing / ${query}`, () => {
  const plan = planAskResearch(query);
  assert.equal(plan.primaryHub, hub);
  assert.equal(plan.normalizedGeography?.stateCode, 'MI');
  assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, miSpecialistUrl(hub));
  assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH');
});

test('MI exact identifiers outrank generic words; bare digits never become names', () => {
  for (const [query, hub, type] of [
    ['USDOT 1234567 Michigan insurance','move','usdot'], ['MC 123456 Michigan mortgage','move','mc'],
    ['NMLS 2229 Michigan contractor','lender','nmls'], ['NAIC 12345 Michigan mover','insurance','naic_company_code'],
    ['NPN 123456 Michigan senior','insurance','npn'], ['CCN 123456 Michigan insurance','senior','cms_ccn'],
    ['CRD 123456 Michigan mortgage','investor','crd'], ['SEC file 801-12345 Michigan mover','investor','sec_file_number'],
    ['BCC license 2101234567 Michigan mortgage','contractor','mi_bcc_credential'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.executionMode, 'IDENTIFIER', query);
    assert.equal(plan.identifier?.type, type, query);
    assert.equal(plan.entityName, undefined, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
  for (const query of ['2229','2229 Michigan','license 2229 Michigan']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
});

test('MI ranking vocabulary refuses execution across representative hubs', () => {
  const terms = ['best','safest','recommended','recommend','top-rated','highest-rated','#1','number one','most trustworthy','most trusted','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking'];
  const providers = ['mover','mortgage lender','contractor','insurance agency','nursing home','investment adviser'];
  for (const [index, term] of terms.entries()) {
    const query = `${term} Michigan ${providers[index % providers.length]}`;
    const plan = planAskResearch(query);
    assert.equal(plan.executionAllowed, false, query);
    assert.equal(plan.clarificationReason, MI_RANKING_REFUSAL, query);
    assert.equal(buildAskResearchRoute(query).canExecute, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h => h.capabilityStatus !== 'execute' && !h.options?.length), query);
  }
});

test('MI manifest, fingerprint, clocks, page and expansion boundary', () => {
  const release = JSON.parse(readFileSync('data/releases/michigan-network-release.json','utf8'));
  assert.equal(miReleaseGatePassed(), true);
  assert.equal(M.hubs.length, 6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL, {status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE, 'NO');
  assert.match(MI_PUBLICATION_FINGERPRINT, /^[a-f0-9]{64}$/);
  assert.equal(release.semantic_fingerprint, MI_PUBLICATION_FINGERPRINT);
  assert.equal(miPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))), MI_PUBLICATION_FINGERPRINT);
  const drift = structuredClone(M); drift.hubs[0].certified_release_sha = '0'.repeat(40);
  assert.equal(miReleaseGatePassed(drift), false);
  for (const id of MI_HUBS) {
    const h = M.hubs.find(row => row.hub_id === id)!;
    assert.equal(h.canonical_state_url, miSpecialistUrl(id));
    assert.ok(Object.keys(h.source_clocks).length > 0);
  }
  const page = readFileSync('app/michigan/page.tsx','utf8');
  const ui = readFileSync('components/michigan-network-gateway.tsx','utf8');
  assert.doesNotMatch(page + ui, /['"]Dataset['"]|AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g) || []).length, 1);
  assert.equal(normalizedPublishedStatePath('/Michigan'), '/michigan');
  assert.equal(normalizedPublishedStatePath('/MICHIGAN'), '/michigan');
  assert.equal(askStateSitemapEntries().filter(row => row.path === '/michigan').length, 1);
  for (const city of ['detroit','grand-rapids','lansing','ann-arbor']) assert.equal(existsSync(`app/michigan/${city}`), false);
  for (const legacy of ['app/hubs/michigan','app/hubs/browse/michigan','app/moving-to/michigan','app/local-lenders/michigan','app/fdic-insured-banks/michigan']) assert.equal(existsSync(legacy), false);
  assert.equal(normalizedPublishedStatePath('/michigan/detroit'), null);
});

test('MI city inference and explicit other-state precedence', () => {
  for (const city of ['Detroit','Grand Rapids','Lansing','Ann Arbor']) {
    const plan = planAskResearch(`${city} nursing home`);
    assert.equal(plan.normalizedGeography?.stateCode, 'MI', city);
    assert.equal(plan.primaryHub, 'senior', city);
    assert.equal(buildNetworkAskPlan(`${city} nursing home`).placeLensHref, '/michigan', city);
  }
  assert.equal(planAskResearch('Detroit Minnesota nursing home').normalizedGeography?.stateCode, 'MN');
  assert.equal(planAskResearch('Michigan nursing home').normalizedGeography?.stateCode, 'MI');
});
