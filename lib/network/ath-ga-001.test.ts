import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import {
  GA_NETWORK_CONTRACT,
  GA_PUBLICATION_MANIFEST,
  GA_SEMANTIC_GUARDRAILS,
  classifyGaHub,
  gaPublicationSemanticFingerprint,
  gaReleaseGatePassed,
  routeGaAsk,
} from './ga-network.ts';

const page = readFileSync('app/georgia/page.tsx', 'utf8');
const gateway = readFileSync('components/georgia-network-gateway.tsx', 'utf8');

test('Georgia manifest rejects a cross-hub total and keeps six hubs', () => {
  assert.equal(GA_NETWORK_CONTRACT, 'ath-ga-network-release-v1');
  assert.equal(GA_PUBLICATION_MANIFEST.hubs.length, 6);
  assert.equal(GA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(GA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(GA_PUBLICATION_MANIFEST.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(GA_PUBLICATION_MANIFEST.expansion_ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(GA_PUBLICATION_MANIFEST.hardcoded_atlanta_routes, false);
  assert.equal(GA_PUBLICATION_MANIFEST.georgia_local_phase, 'NO');
  assert.equal(existsSync('app/georgia/atlanta'), false);
  assert.equal(existsSync('app/atlanta'), false);
});

test('Georgia page has no ranking schema', () => {
  assert.doesNotMatch(page, /aggregateRating|ratingValue|reviewCount/);
  assert.equal(GA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/georgia');
  assert.match(gateway, /Trust Score/);
  assert.doesNotMatch(gateway, /best mover|safest adviser|vetted/i);
});

test('Georgia routing preserves grains and does not intercept identifiers', () => {
  const cases: Array<[string, string]> = [
    ['movers Georgia', 'move'],
    ['licensed movers Georgia', 'move'],
    ['Georgia MCA', 'move'],
    ['moving tariff Georgia', 'move'],
    ['interstate mover Georgia', 'move'],
    ['contractors Georgia', 'contractor'],
    ['residential contractor Georgia', 'contractor'],
    ['general contractor Georgia', 'contractor'],
    ['electrician Georgia', 'contractor'],
    ['plumber Georgia', 'contractor'],
    ['HVAC Georgia', 'contractor'],
    ['Georgia cease and desist contractor', 'contractor'],
    ['mortgage lender Georgia', 'lender'],
    ['mortgage broker Georgia', 'lender'],
    ['NMLS Georgia', 'lender'],
    ['mortgage complaints Georgia', 'lender'],
    ['HMDA Georgia', 'lender'],
    ['insurance agency Georgia', 'insurance'],
    ['insurance company Georgia', 'insurance'],
    ['insurance producer Georgia', 'insurance'],
    ['Georgia receivership', 'insurance'],
    ['Georgia mental health parity insurance', 'insurance'],
    ['nursing homes Georgia', 'senior'],
    ['assisted living Georgia', 'senior'],
    ['personal care home Georgia', 'senior'],
    ['home health Georgia', 'senior'],
    ['hospice Georgia', 'senior'],
    ['Georgia facility inspection', 'senior'],
    ['investment adviser Georgia', 'investor'],
    ['state registered adviser Georgia', 'investor'],
    ['securities enforcement Georgia', 'investor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeGaAsk(question)?.hubId, hub, question);
    assert.match(routeGaAsk(question)?.caveat ?? '', /not |separate|not a|Do not|were not|is not|stay/i);
  }
  assert.equal(routeGaAsk('CRD 105958 Georgia'), undefined);
  assert.equal(routeGaAsk('USDOT 3456789 Georgia'), undefined);
  assert.equal(routeGaAsk('NMLS 123456 Georgia'), undefined);
  assert.equal(routeGaAsk('NAIC 10064 Georgia'), undefined);
  assert.equal(routeGaAsk('NPN 10391484 Georgia'), undefined);
  assert.equal(classifyGaHub('how many businesses in Georgia'), undefined);
  const plan = buildNetworkAskPlan('insurance agency in Atlanta');
  assert.equal(plan.hubs[0]?.hubId, 'insurance');
  assert.match(plan.hubs[0]?.reason ?? '', /Not a Georgia insurer|not an insurer|Rosters were not acquired|were not acquired|No NAIC/i);
  assert.match(GA_SEMANTIC_GUARDRAILS.contractor_orders_ne_census, /not a contractor census/i);
});

test('release gate is evidence-backed when verification is present', () => {
  const verification = JSON.parse(readFileSync('data/network/georgia-verification.json', 'utf8'));
  if (verification.release_gate_passed) {
    assert.equal(gaReleaseGatePassed(), true);
    assert.equal(verification.hubs.length, 6);
    assert.equal(page.includes('noIndex: !gate'), true);
  } else {
    assert.equal(gaReleaseGatePassed(), false);
  }
});

test('Ask production certification is recorded without changing the publication manifest', () => {
  const closeout = JSON.parse(readFileSync('data/network/georgia/state-closeout.json', 'utf8'));
  const release = JSON.parse(readFileSync('data/releases/georgia-network-release.json', 'utf8'));
  assert.equal(closeout.status, 'CLOSED_PRODUCTION_VERIFIED');
  assert.equal(release.status, 'CLOSED_PRODUCTION_VERIFIED');
  assert.equal(GA_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(GA_PUBLICATION_MANIFEST.ask_production, null);
  assert.equal(closeout.ask_production.merge_sha, 'f478b2f43beecaa564571ff4124f2c122b7ba2b3');
  assert.equal(closeout.ask_production.deployment_id, 6638655763);
  assert.equal(closeout.ask_production.http_status, 200);
  assert.equal(closeout.ask_production.sso, false);
  assert.equal(release.ask_production.deployed_sha, closeout.ask_production.merge_sha);
  assert.deepEqual(release.required_hubs, ['contractor', 'move', 'senior', 'lender', 'insurance', 'investor']);
  assert.equal(closeout.network_release_gate.passed, true);
  assert.equal(closeout.network_release_gate.required_hubs, 6);
  assert.equal(closeout.publication_manifest_fingerprint, 'd7e748dda20762d39b49750777950b5a6e3ed653681fa3ae778f99e3f69263dd');
  assert.equal(release.ask_fingerprint, closeout.publication_manifest_fingerprint);
  assert.equal(gaPublicationSemanticFingerprint(), closeout.publication_manifest_fingerprint);
});
