import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { decideNameCandidateSearch } from './name-candidates/decision.ts';
import {
  MA_NETWORK_CONTRACT,
  MA_PUBLICATION_MANIFEST,
  MA_SEMANTIC_GUARDRAILS,
  classifyMaHub,
  maPublicationSemanticFingerprint,
  maReleaseGatePassed,
  routeMaAsk,
} from './ma-network.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { askStateExplorerEyebrow, askStateSitemapEntries } from './published-ask-states.ts';

const page = readFileSync('app/massachusetts/page.tsx', 'utf8');
const gateway = readFileSync('components/massachusetts-network-gateway.tsx', 'utf8');
const sitemap = readFileSync('app/sitemap.ts', 'utf8');

test('Massachusetts manifest rejects a cross-hub total and keeps six hubs', () => {
  assert.equal(MA_NETWORK_CONTRACT, 'ath-ma-network-release-v1');
  assert.equal(MA_PUBLICATION_MANIFEST.state_code, 'MA');
  assert.equal(MA_PUBLICATION_MANIFEST.state_name, 'Massachusetts');
  assert.equal(MA_PUBLICATION_MANIFEST.scope, 'STATE_LEVEL_ONLY');
  assert.equal(MA_PUBLICATION_MANIFEST.hubs.length, 6);
  assert.equal(MA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(MA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(MA_PUBLICATION_MANIFEST.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(MA_PUBLICATION_MANIFEST.expansion_ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(MA_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(MA_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.equal(MA_PUBLICATION_MANIFEST.hardcoded_boston_routes, false);
  assert.equal(MA_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(MA_PUBLICATION_MANIFEST.massachusetts_local_phase, 'NO');
  assert.equal(MA_PUBLICATION_MANIFEST.status, 'ASK_PUBLICATION_CONTRACT');
  assert.equal(MA_PUBLICATION_MANIFEST.ask_production, null);
  assert.equal(existsSync('app/massachusetts/boston'), false);
  assert.equal(existsSync('app/boston'), false);
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug, 'tennessee');
  assert.equal(ASK_NETWORK_STATES.length, 17);
});

test('Massachusetts page has no ranking schema and is cataloged once', () => {
  assert.doesNotMatch(page, /aggregateRating|ratingValue|reviewCount/);
  assert.equal(MA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/massachusetts');
  assert.match(gateway, /Trust Score/);
  assert.match(gateway, /What makes Massachusetts different/);
  assert.doesNotMatch(gateway, /best mover|safest adviser|vetted/i);
  assert.match(sitemap, /askStateSitemapEntries/);
  const paths = askStateSitemapEntries().map((entry) => entry.path);
  assert.equal(paths.filter((path) => path === '/massachusetts').length, 1);
  assert.match(askStateExplorerEyebrow(), /Seventeen-state network explorer/);
});

test('Massachusetts routing preserves grains and does not intercept identifiers', () => {
  const cases: Array<[string, string]> = [
    ['movers Massachusetts', 'move'],
    ['Massachusetts DPU mover', 'move'],
    ['Massachusetts moving tariff', 'move'],
    ['DPU certificate 32011', 'move'],
    ['mortgage lender Massachusetts', 'lender'],
    ['mortgage broker Massachusetts', 'lender'],
    ['mortgage loan originator Massachusetts', 'lender'],
    ['Massachusetts mortgage enforcement', 'lender'],
    ['contractor Massachusetts', 'contractor'],
    ['HIC Massachusetts', 'contractor'],
    ['CSL Massachusetts', 'contractor'],
    ['Massachusetts contractor discipline', 'contractor'],
    ['contractor debarment Massachusetts', 'contractor'],
    ['insurance companies Massachusetts', 'insurance'],
    ['NAIC Massachusetts', 'insurance'],
    ['auto insurers Massachusetts', 'insurance'],
    ['insurance enforcement Massachusetts', 'insurance'],
    ['nursing homes Massachusetts', 'senior'],
    ['assisted living Massachusetts', 'senior'],
    ['rest homes Massachusetts', 'senior'],
    ['senior care Massachusetts', 'senior'],
    ['investment adviser Massachusetts', 'investor'],
    ['Massachusetts RIA', 'investor'],
    ['ERA Massachusetts', 'investor'],
    ['securities enforcement Massachusetts', 'investor'],
    ['nursing homes Boston', 'senior'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeMaAsk(question)?.hubId, hub, question);
    assert.match(routeMaAsk(question)?.destination ?? '', /massachusetts/);
    assert.match(routeMaAsk(question)?.caveat ?? '', /not |separate|not a|Do not|were not|is not|stay/i);
  }
  assert.equal(routeMaAsk('USDOT 3456789 Massachusetts'), undefined);
  assert.equal(routeMaAsk('MC 123456 Massachusetts'), undefined);
  assert.equal(routeMaAsk('NMLS 123456 Massachusetts'), undefined);
  assert.equal(routeMaAsk('NAIC 10064 Massachusetts'), undefined);
  assert.equal(routeMaAsk('NPN 10391484 Massachusetts'), undefined);
  assert.equal(routeMaAsk('CCN 225500 Massachusetts'), undefined);
  assert.equal(routeMaAsk('CRD 105958 Massachusetts'), undefined);
  assert.equal(routeMaAsk('SEC number 801-12345 Massachusetts'), undefined);
  assert.equal(routeMaAsk('HIC 445566 Massachusetts'), undefined);
  assert.equal(routeMaAsk('CSL 778899 Massachusetts'), undefined);
  assert.equal(routeMaAsk('Medicare Advantage MA plans'), undefined);
  assert.equal(routeMaAsk('MA-PD drug plan'), undefined);
  assert.equal(routeMaAsk('nursing homes Springfield'), undefined);
  assert.equal(classifyMaHub('how many businesses in Massachusetts'), undefined);
  assert.equal(planAskResearch('DPU certificate 32011').primaryHub, 'move');
  assert.equal(decideNameCandidateSearch('DPU certificate 32011').operation, 'NOT_NAME_SEARCH');
  const plan = buildNetworkAskPlan('best mortgage lender Massachusetts');
  assert.equal(plan.hubs[0]?.hubId, 'lender');
  assert.match(plan.hubs[0]?.destination ?? '', /lendertrusthub.com\/massachusetts/);
  assert.match(plan.hubs[0]?.reason ?? '', /does not select a winner|separate/i);
  assert.equal(parseNetworkAsk('Medicare Advantage MA plans').geography?.stateCode, undefined);
  assert.notEqual(parseNetworkAsk('nursing homes Springfield').geography?.stateCode, 'MA');
  assert.equal(parseNetworkAsk('nursing homes Springfield Massachusetts').geography?.stateCode, 'MA');
  assert.equal(parseNetworkAsk('movers Massachusetts').geography?.stateCode, 'MA');
  assert.match(MA_SEMANTIC_GUARDRAILS.contractor_discipline_ne_census, /not a contractor census/i);
  assert.match(MA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.explanation, /cannot be summed/);
});

test('existing state routes stay registered ahead of Massachusetts', () => {
  assert.deepEqual(
    ASK_NETWORK_STATES.map((state) => state.slug),
    ['florida', 'new-jersey', 'california', 'texas', 'washington', 'arizona', 'colorado', 'virginia', 'new-york', 'illinois', 'oregon', 'pennsylvania', 'north-carolina', 'ohio', 'georgia', 'massachusetts', 'tennessee'],
  );
});

test('release gate is evidence-backed when verification is present', () => {
  const verification = JSON.parse(readFileSync('data/network/massachusetts-verification.json', 'utf8'));
  if (verification.release_gate_passed) {
    assert.equal(maReleaseGatePassed(), true);
    assert.equal(verification.hubs.length, 6);
    assert.equal(page.includes('noIndex: !gate'), true);
    for (const hub of verification.hubs) {
      assert.equal(hub.http_status, 200);
      assert.equal(hub.sso, false);
      assert.equal(hub.selfCanonical, true);
      assert.match(String(hub.robots), /index,\s*follow/i);
    }
  } else {
    assert.equal(maReleaseGatePassed(), false);
  }
});

test('production certificate stays outside the publication manifest until Production is recorded', () => {
  const closeout = JSON.parse(readFileSync('data/network/massachusetts/state-closeout.json', 'utf8'));
  const release = JSON.parse(readFileSync('data/releases/massachusetts-network-release.json', 'utf8'));
  const gaps = JSON.parse(readFileSync('data/network/massachusetts/gap-register.json', 'utf8'));
  assert.equal(closeout.local_work_decision, 'NO');
  assert.equal(closeout.cross_hub_record_total_status, 'REJECTED');
  assert.equal(closeout.ask_graph_writes, 0);
  assert.equal(release.trust_score, false);
  assert.equal(release.paid_ranking, false);
  assert.equal(release.ask_fingerprint, closeout.publication_manifest_fingerprint);
  assert.equal(closeout.publication_manifest_fingerprint, maPublicationSemanticFingerprint());
  assert.equal(gaps.cross_hub_record_total.value, null);
  assert.equal(gaps.local_work_needed_now, 'NO');
  assert.ok(gaps.remaining_gaps.length >= 6);
  assert.equal(closeout.status, 'CLOSED_PRODUCTION_VERIFIED');
  assert.equal(release.status, 'CLOSED_PRODUCTION_VERIFIED');
  assert.equal(closeout.ask_production.merge_sha, '3afeb9d8e9d3fb8ca3de2d636dfcc4f7221eb36d');
  assert.equal(closeout.ask_production.deployment_id, 6646186023);
  assert.equal(closeout.ask_production.http_status, 200);
  assert.equal(closeout.ask_production.sso, false);
  assert.equal(closeout.ask_production.canonical, 'https://www.asktrusthub.com/massachusetts');
  assert.equal(release.ask_production.deployed_sha, closeout.ask_production.merge_sha);
  assert.equal(MA_PUBLICATION_MANIFEST.status, 'ASK_PUBLICATION_CONTRACT');
  assert.equal(MA_PUBLICATION_MANIFEST.ask_production, null);
});
