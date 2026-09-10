import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  VA_NETWORK_CONTRACT,
  VA_PUBLICATION_FINGERPRINT,
  VA_PUBLICATION_MANIFEST,
  VA_SEMANTIC_GUARDRAILS,
  vaReleaseGatePassed,
  vaSixHubIdsComplete,
  listVaHubs,
  queryLooksLikeVirginia,
  routeVaAsk,
  classifyVaHub,
} from './va-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/virginia/page.tsx', 'utf8');
const gateway = readFileSync('components/virginia-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/virginia/state-closeout.json', 'utf8'));
const verification = JSON.parse(readFileSync('data/network/virginia-verification.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/virginia/gap-register.json', 'utf8'));

test('six required specialist Virginia pages, unique hub IDs, canonical URLs', () => {
  assert.equal(vaSixHubIdsComplete(), true);
  const ids = listVaHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listVaHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/virginia$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
  }
});

test('release gate passes only 6/6 live specialist pages', () => {
  assert.equal(vaReleaseGatePassed(), true);
  assert.equal(verification.release_gate_passed, true);
  assert.deepEqual(verification.missing, []);
  assert.equal(verification.hubs.length, 6);
  for (const hub of verification.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
  }
});

test('Ask /virginia canonical, indexability follows gate, no local routes', () => {
  assert.equal(VA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/virginia');
  assert.equal(VA_PUBLICATION_MANIFEST.ask_path, '/virginia');
  assert.equal(VA_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(VA_PUBLICATION_MANIFEST.virginia_local_phase, 'NO');
  assert.equal(VA_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(VA_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /\/virginia/);
  assert.doesNotMatch(sitemap, /\/virginia\/richmond/);
  assert.doesNotMatch(sitemap, /\/virginia\/fairfax/);
  assert.equal(existsSync('app/virginia/page.tsx'), true);
  assert.deepEqual(readdirSync('app/virginia').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(VA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(VA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(VA_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(VA_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
});

test('contractor grain: 53840 license numbers are not unique companies', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.contractor_license_ne_company, /53,840/);
  assert.match(VA_SEMANTIC_GUARDRAILS.contractor_license_ne_company, /LICENSE NUMBERS/);
  assert.match(VA_SEMANTIC_GUARDRAILS.contractor_license_ne_company, /not unique companies/);
});

test('move grain: HHG is not Property, Property is not a mover census, 30-mile rule, DMV is not FMCSA', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property, /192/);
  assert.match(VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property, /not Property Carrier/);
  assert.match(VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property, /not a mover census/);
  assert.match(VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property, /30 miles/);
  assert.match(VA_SEMANTIC_GUARDRAILS.move_hhg_ne_property, /FMCSA/);
  assert.doesNotMatch(gateway, /5,108/);
});

test('senior grain: ALF is not NH; capacity is not occupancy; no combined senior total', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.senior_classes_separate, /573/);
  assert.match(VA_SEMANTIC_GUARDRAILS.senior_classes_separate, /not nursing homes/);
  assert.match(VA_SEMANTIC_GUARDRAILS.senior_classes_separate, /not occupancy/);
  assert.match(VA_SEMANTIC_GUARDRAILS.senior_classes_separate, /not a substantiated complaint/);
  assert.match(VA_SEMANTIC_GUARDRAILS.senior_classes_separate, /573 \+ 82 \+ 289 \+ 237 \+ 110/);
});

test('lender grain: dated 2025 roster is not current 2026; MLO is not a company; HMDA is not a lender', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current, /1,257/);
  assert.match(VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current, /not a live September 2026/);
  assert.match(VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current, /MLO is not a company/);
  assert.match(VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current, /HMDA application is not a lender/);
  assert.match(VA_SEMANTIC_GUARDRAILS.lender_dated_ne_current, /complaint is not a violation/);
});

test('insurance grain: 2025 observation is not current authorization; 1727 is not unique insurers', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized, /1,546/);
  assert.match(VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized, /not currently authorized/);
  assert.match(VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized, /not a conviction/);
  assert.match(VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized, /not a violation/);
  assert.match(VA_SEMANTIC_GUARDRAILS.insurance_1546_ne_authorized, /1,727 exact-match observations are not unique insurers/);
});

test('investor grain: 697 is not office, ERA, notice, or 4481 firms', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice, /697/);
  assert.match(VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice, /not 339/);
  assert.match(VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice, /not 107 ERA/);
  assert.match(VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice, /not 3,289/);
  assert.match(VA_SEMANTIC_GUARDRAILS.investor_697_ne_office_ne_notice, /not 4,481 firms/);
});

test('unknown and search-only are not zero; no Trust Score or ranking', () => {
  assert.match(VA_SEMANTIC_GUARDRAILS.missing_ne_zero, /not zero/);
  assert.match(VA_SEMANTIC_GUARDRAILS.search_only_ne_zero, /not zero/);
  assert.equal(VA_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(VA_PUBLICATION_MANIFEST.paid_ranking, false);
});

test('Virginia routing: two queries per hub plus city intent', () => {
  const cases: Array<[string, string]> = [
    ['Is this contractor licensed in Virginia?', 'contractor'],
    ['How many contractors are in Virginia?', 'contractor'],
    ['Can I check a mover in Virginia?', 'move'],
    ['Does a Virginia Property Carrier permit mean they can move my household goods?', 'move'],
    ['Find assisted living in Virginia.', 'senior'],
    ['Find nursing homes in Virginia.', 'senior'],
    ['Which mortgage lenders are licensed in Virginia?', 'lender'],
    ['How much mortgage lending happened in Virginia last year?', 'lender'],
    ['Which insurance companies are authorized in Virginia?', 'insurance'],
    ['Does this insurer have a Virginia regulatory action?', 'insurance'],
    ['How many investment advisers are registered in Virginia?', 'investor'],
    ['Does a Virginia principal office mean the adviser is state-registered?', 'investor'],
    ['Fairfax contractor licensed in Virginia', 'contractor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeVaAsk(question)?.hubId, hub, question);
  }
  assert.equal(routeVaAsk('Richmond assisted living')?.destination, 'https://www.seniortrusthub.com/virginia');
  assert.equal(classifyVaHub('generic Virginia research'), undefined);
});

test('other-state wording does not hijack Virginia; no invented local route', () => {
  assert.equal(routeVaAsk('California contractor moving to Virginia'), undefined);
  assert.equal(parseNetworkAsk('California contractor moving to Virginia').geography?.stateCode, 'CA');
  const vaToNc = routeVaAsk('Virginia mover to North Carolina');
  assert.equal(vaToNc?.hubId, 'move');
  assert.equal(parseNetworkAsk('Colorado investment adviser registered in Virginia').geography?.stateCode, 'CO');
  assert.equal(existsSync('app/virginia/richmond'), false);
  assert.doesNotMatch(sitemap, /\/virginia\/richmond/);
  assert.equal(buildNetworkAskPlan('Virginia mover to North Carolina').placeLensHref, '/virginia');
  assert.equal(buildNetworkAskPlan('California contractor moving to Virginia').placeLensHref, '/california');
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/virginia'), false);
  assert.doesNotMatch(sitemap, /\/claim\/virginia/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
});

test('state page count increments exactly once and places/concierge stay gated', () => {
  assert.equal(ASK_NETWORK_STATES.length, 8);
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'VA').length, 1);
  assert.deepEqual(
    ASK_NETWORK_STATES.map((state) => state.slug),
    ['florida', 'new-jersey', 'california', 'texas', 'washington', 'arizona', 'colorado', 'virginia'],
  );
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/virginia'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/virginia/richmond'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Virginia network gateway/);
  assert.equal(VA_NETWORK_CONTRACT, 'ath-va-network-release-v1');
  assert.equal(VA_PUBLICATION_MANIFEST.version, VA_NETWORK_CONTRACT);
});

test('preview closeout is not Production-closed; fingerprint is locked; local work is NO', () => {
  assert.equal(closeout.status, 'ASK_PREVIEW_READY');
  assert.doesNotMatch(closeout.status, /CLOSED_PRODUCTION_VERIFIED/);
  assert.equal(closeout.local_work_decision, 'NO');
  assert.equal(closeout.publication_manifest_fingerprint, VA_PUBLICATION_FINGERPRINT);
  assert.ok(Array.isArray(gaps.OPEN_SEARCH_ONLY));
  assert.ok(gaps.LEFT_LOCAL_FUTURE.length >= 1);
});

test('queryLooksLikeVirginia recognizes cities without inventing local routes', () => {
  assert.equal(queryLooksLikeVirginia('contractor in Fairfax'), true);
  assert.equal(queryLooksLikeVirginia('Is this mover licensed in New Jersey?'), false);
});
