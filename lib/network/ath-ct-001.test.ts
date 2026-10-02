import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createGuidedSession } from '../guided-research/session.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import { CT_HUBS, CT_PUBLICATION_FINGERPRINT, CT_PUBLICATION_MANIFEST as M, CT_RANKING_REFUSAL, ctPublicationSemanticFingerprint, ctReleaseGatePassed, ctSpecialistUrl } from './ct-network.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';
import { askStateSitemapEntries } from './published-ask-states.ts';
import { planAskResearch } from './research-planner.ts';

const routing: Array<[typeof CT_HUBS[number], string[]]> = [
  ['move', ['Connecticut mover','CTDOT mover','household goods Connecticut','RCHG','USDOT 1234567 Connecticut','MC 123456 Connecticut']],
  ['contractor', ['contractor Connecticut','HIC Connecticut','home improvement contractor Connecticut','new home contractor Connecticut','electrician Connecticut','plumber Connecticut']],
  ['lender', ['mortgage lender Connecticut','mortgage broker Connecticut','servicer Connecticut','NMLS 3030 Connecticut','HMDA Connecticut']],
  ['insurance', ['insurer Connecticut','insurance agency Connecticut','insurance producer Connecticut','NAIC 10064 Connecticut','NPN 20000635 Connecticut']],
  ['senior', ['nursing home Connecticut','CCNH Connecticut','residential care Connecticut','assisted living Connecticut','CCN 105502 Connecticut']],
  ['investor', ['investment adviser Connecticut','RIA Connecticut','ERA Connecticut','CRD 166089 Connecticut','SEC file 801-12345 Connecticut','securities enforcement Connecticut']],
];

test('CT six-hub routing remains source-specific', () => {
  for (const [hub, queries] of routing) for (const query of queries) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.normalizedGeography?.stateCode, 'CT', query);
    assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, ctSpecialistUrl(hub), query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
});

test('CT labeled identifier family wins over incidental vertical; bare numbers fail closed', () => {
  for (const [query, hub, type, guidedType] of [
    ['USDOT 1234567 Connecticut insurance','move','usdot','USDOT'],
    ['MC 123456 Connecticut lender','move','mc','MC'],
    ['NMLS 3030 Connecticut mover','lender','nmls','NMLS'],
    ['NAIC 10064 Connecticut lender','insurance','naic_company_code','NAIC'],
    ['NPN 20000635 Connecticut contractor','insurance','npn','NPN'],
    ['CCN 105502 Connecticut insurance','senior','cms_ccn','CCN'],
    ['CRD 166089 Connecticut mover','investor','crd','CRD'],
    ['SEC file 801-12345 Connecticut mover','investor','sec_file_number','SEC'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.executionMode, 'IDENTIFIER', query);
    assert.equal(plan.identifier?.type, type, query);
    assert.equal(plan.entityName, undefined, query);
    assert.equal(createGuidedSession(query)?.hub, hub, query);
    assert.equal(createGuidedSession(query)?.identifier?.type, guidedType, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
  for (const query of ['3030','3030 Connecticut','license 3030 Connecticut']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
  }
});

test('CT ranking requests refuse executable provider cohorts', () => {
  const terms = ['best','safest','recommended','recommend','most trustworthy','most trusted','top-rated','highest-rated','#1','number one','Trust Score','AggregateRating','ratingValue','paid ranking','sponsored ranking'];
  const providers = ['mover','contractor','mortgage lender','insurance agency','nursing home','investment adviser'];
  for (const [index, term] of terms.entries()) {
    const query = `${term} Connecticut ${providers[index % providers.length]}`;
    const plan = planAskResearch(query);
    assert.equal(plan.executionAllowed, false, query);
    assert.equal(plan.clarificationReason, CT_RANKING_REFUSAL, query);
    assert.equal(buildAskResearchRoute(query).canExecute, false, query);
    assert.equal(decideNameCandidateSearch(query).operation, 'NOT_NAME_SEARCH', query);
    assert.ok(buildNetworkAskPlan(query).hubs.every(h => h.capabilityStatus !== 'execute' && !h.options?.length), query);
  }
});

test('CT manifest, fingerprint, separate clocks, canonical links and expansion boundary', () => {
  const release = JSON.parse(readFileSync('data/releases/connecticut-network-release.json','utf8'));
  assert.equal(ctReleaseGatePassed(), true);
  assert.equal(M.hubs.length, 6);
  assert.deepEqual(M.expansion_ledger.CROSS_HUB_RECORD_TOTAL, {status:'REJECTED',value:null});
  assert.equal(M.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(M.expansion_ledger.CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(M.expansion_ledger.LOCAL_PHASE, 'NO');
  assert.match(CT_PUBLICATION_FINGERPRINT, /^[a-f0-9]{64}$/);
  assert.equal(release.semantic_fingerprint, CT_PUBLICATION_FINGERPRINT);
  assert.equal(ctPublicationSemanticFingerprint(JSON.parse(JSON.stringify(M))), CT_PUBLICATION_FINGERPRINT);
  const drift = structuredClone(M); drift.hubs[0].certified_release_sha = '0'.repeat(40);
  assert.equal(ctReleaseGatePassed(drift), false);
  for (const id of CT_HUBS) {
    const h = M.hubs.find(row => row.hub_id === id)!;
    assert.equal(h.canonical_state_url, ctSpecialistUrl(id));
    assert.ok(Object.keys(h.source_clocks).length > 0);
  }
  assert.equal(M.hubs.find(h => h.hub_id === 'move')?.source_clocks.workbook_publication_date_printed, null);
  assert.equal(M.hubs.find(h => h.hub_id === 'lender')?.source_clocks.dob_license_sheets_as_of, '2026-09-02');
  assert.equal(M.hubs.find(h => h.hub_id === 'insurance')?.source_clocks.company_list_as_of, '2026-06-30');
  assert.equal(M.hubs.find(h => h.hub_id === 'investor')?.source_clocks.iapd_feed_as_of, '2026-09-17');
  assert.equal(Object.hasOwn(M,'asOf'), false);
  const page = readFileSync('app/connecticut/page.tsx','utf8');
  const ui = readFileSync('components/connecticut-network-gateway.tsx','utf8');
  assert.doesNotMatch(page + ui, /['"]Dataset['"]|AggregateRating|ratingValue|Trust Score|createClient|\.insert\(|\.upsert\(/);
  assert.equal((ui.match(/<a href=\{hub.canonical_state_url\}/g) || []).length, 1);
  assert.equal(normalizedPublishedStatePath('/Connecticut'), '/connecticut');
  assert.equal(normalizedPublishedStatePath('/CONNECTICUT'), '/connecticut');
  assert.equal(askStateSitemapEntries().filter(row => row.path === '/connecticut').length, 1);
  for (const city of ['hartford','new-haven','stamford','bridgeport']) assert.equal(existsSync(`app/connecticut/${city}`), false);
  assert.equal(normalizedPublishedStatePath('/connecticut/hartford'), null);
});

test('CT city context and explicit other-state precedence', () => {
  for (const city of ['Hartford','New Haven','Stamford','Bridgeport']) {
    const plan = planAskResearch(`${city} nursing home`);
    assert.equal(plan.normalizedGeography?.stateCode, 'CT', city);
    assert.equal(plan.primaryHub, 'senior', city);
    assert.equal(buildNetworkAskPlan(`${city} nursing home`).placeLensHref, '/connecticut', city);
  }
  assert.equal(planAskResearch('Hartford Minnesota nursing home').normalizedGeography?.stateCode, 'MN');
  assert.equal(planAskResearch('Connecticut nursing home').normalizedGeography?.stateCode, 'CT');
  assert.equal(planAskResearch('How many providers across Connecticut hubs?').executionAllowed, false);
});
