import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { CA_PUBLICATION_MANIFEST } from './ca-network.ts';
import { TX_PUBLICATION_MANIFEST } from './tx-network.ts';
import { WA_PUBLICATION_MANIFEST } from './wa-network.ts';
import { AZ_PUBLICATION_MANIFEST } from './az-network.ts';
import {
  CO_NETWORK_CONTRACT,
  CO_PUBLICATION_MANIFEST,
  CO_SEMANTIC_GUARDRAILS,
  coReleaseGatePassed,
  coSixHubIdsComplete,
  listCoHubs,
  queryLooksLikeColorado,
  routeCoAsk,
} from './co-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/colorado/page.tsx', 'utf8');
const gateway = readFileSync('components/colorado-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/colorado/state-closeout.json', 'utf8'));
const verification = JSON.parse(readFileSync('data/network/colorado-verification.json', 'utf8'));
const stress = JSON.parse(readFileSync('data/network/colorado-12-question-stress.json', 'utf8')) as Array<{
  question: string;
  expected_hub: string;
  expected_handoff: string;
  result: string;
  unsupported_assumption_rejected: string;
  source_grain_caveat: string;
}>;
const catalog = JSON.parse(readFileSync('data/network/colorado-evidence-catalog.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/colorado/gap-register.json', 'utf8'));

test('six required specialist Colorado pages, unique hub IDs, canonical URLs', () => {
  assert.equal(coSixHubIdsComplete(), true);
  const ids = listCoHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listCoHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/colorado$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
  }
});

test('all required production verification statuses present', () => {
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

test('Ask /colorado canonical, indexable, no denver route, no Trust Score, no paid ranking', () => {
  assert.equal(CO_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/colorado');
  assert.equal(CO_PUBLICATION_MANIFEST.ask_path, '/colorado');
  assert.equal(CO_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(CO_PUBLICATION_MANIFEST.colorado_local_phase, 'NO');
  assert.equal(CO_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(CO_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /\/colorado/);
  assert.doesNotMatch(sitemap, /\/colorado\/denver/);
  assert.equal(existsSync('app/colorado/page.tsx'), true);
  assert.deepEqual(readdirSync('app/colorado').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /index, follow|noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Organization/);
  assert.match(page, /Dataset/);
  assert.doesNotMatch(page, /aggregateRating|ratingValue/);
  assert.match(gateway, /No Trust Score/);
  assert.doesNotMatch(gateway, /safest provider|vetted provider|recommended provider/i);
  assert.match(gateway, /does not publish a composite score, Trust Score/);
});

test('no cross-hub record total', () => {
  assert.equal(CO_PUBLICATION_MANIFEST.expansion_ledger.do_not_sum_hubs, true);
  assert.equal(CO_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(CO_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  const blob = JSON.stringify(CO_PUBLICATION_MANIFEST);
  assert.doesNotMatch(blob, /Colorado added \d{3,}/);
});

test('contractor 7,936 is EC/PC credentials, not all contractors, no GC universe', () => {
  const contractor = listCoHubs().find((h) => h.hub_id === 'contractor')!;
  assert.match(contractor.coverage_summary, /7,936/);
  assert.match(contractor.coverage_summary, /EC\/PC/);
  assert.match(contractor.coverage_summary, /Not unique contractors/);
  assert.match(contractor.coverage_summary, /No statewide Colorado general-contractor license/);
  assert.match(CO_SEMANTIC_GUARDRAILS.contractor_ec_pc_ne_gc, /no statewide general-contractor license/i);
});

test('Move 203 is state HHG permit grain; PUC != FMCSA', () => {
  const move = listCoHubs().find((h) => h.hub_id === 'move')!;
  assert.match(move.verified_facts.join(' '), /203/);
  assert.match(move.coverage_summary, /not USDOT/);
  assert.match(CO_SEMANTIC_GUARDRAILS.move_puc_ne_fmcsa, /not federal interstate/);
});

test('Senior provider classes stay separate and are not summed', () => {
  const senior = listCoHubs().find((h) => h.hub_id === 'senior')!;
  assert.match(senior.verified_facts.join(' '), /210/);
  assert.match(senior.verified_facts.join(' '), /222/);
  assert.match(senior.verified_facts.join(' '), /88/);
  assert.match(senior.coverage_summary, /Do not add them into 520 Colorado senior providers/);
});

test('Lender MLO != company and HMDA != license', () => {
  assert.match(CO_SEMANTIC_GUARDRAILS.lender_mlo_ne_company, /MLO person license is not a lender company/);
  assert.match(CO_SEMANTIC_GUARDRAILS.lender_mlo_ne_company, /not a license roster/);
});

test('Investor 740 != 589 != 3673 != 209 as grains, not because numbers differ; six-CRD overlap allowed', () => {
  assert.match(CO_SEMANTIC_GUARDRAILS.investor_740_ne_office_ne_notice, /Grain distinction does not rely on numeric inequality/);
  assert.match(CO_SEMANTIC_GUARDRAILS.investor_740_ne_office_ne_notice, /Six CRDs/);
  const investor = listCoHubs().find((h) => h.hub_id === 'investor')!;
  assert.match(investor.coverage_summary, /overlap is allowed/);
});

test('Insurance 1,839 != current authorized; surplus 259 != admitted; ratio != TrustHub score', () => {
  assert.match(CO_SEMANTIC_GUARDRAILS.insurance_1839_ne_authorized, /not currently authorized/);
  assert.match(CO_SEMANTIC_GUARDRAILS.insurance_1839_ne_authorized, /not admitted/);
  assert.match(CO_SEMANTIC_GUARDRAILS.insurance_1839_ne_authorized, /not a TrustHub score/);
});

test('missing/search-only != zero', () => {
  assert.match(CO_SEMANTIC_GUARDRAILS.search_only_ne_zero, /unknown, not zero/);
  assert.match(CO_PUBLICATION_MANIFEST.conceptual_statement, /unknown — not zero/);
});

test('state closeout is Production verified after Ask /colorado certification', () => {
  assert.equal(closeout.status, 'CLOSED_PRODUCTION_VERIFIED');
  assert.equal(CO_PUBLICATION_MANIFEST.status, 'CLOSED_PRODUCTION_VERIFIED');
  assert.match(closeout.note, /COLORADO STATEWIDE EXPANSION CLOSED/);
  assert.equal(closeout.ask_production.merge_sha, '19d6601b6db2af6fa50078b35f93b421161b7447');
  assert.equal(closeout.ask_production.deployment_id, 6374596054);
  assert.equal(closeout.publication_manifest_fingerprint, '0ce737cf5660c0b7383b24cce41fac911f2448b75f8297e1b9416822ef85d653');
  assert.equal(closeout.local_work_decision, 'NO');
  assert.ok(closeout.backlog.some((row: { id: string }) => row.id === 'INV-STATE-IAPD-001'));
});

test('12-question Colorado stress is 12/12 PASS and routes correctly', () => {
  assert.equal(stress.length, 12);
  assert.equal(stress.filter((row) => row.result === 'PASS').length, 12);
  const hubs = new Set(stress.map((row) => row.expected_hub));
  assert.deepEqual([...hubs].sort(), ['contractor', 'insurance', 'investor', 'lender', 'move', 'senior']);
  for (const row of stress) {
    const routed = routeCoAsk(row.question);
    assert.equal(routed?.hubId, row.expected_hub, row.question);
    assert.equal(routed?.destination, row.expected_handoff, row.question);
    assert.equal(routed?.caveat, row.source_grain_caveat, row.question);
    const plan = buildNetworkAskPlan(row.question);
    assert.equal(plan.parsed.geography?.stateCode, 'CO', row.question);
    assert.equal(plan.hubs[0]?.hubId, row.expected_hub, row.question);
    assert.equal(plan.placeLensHref, '/colorado', row.question);
  }
});

test('Search V3 Colorado routes do not steal other states', () => {
  assert.equal(queryLooksLikeColorado('Is this mover licensed in New Jersey?'), false);
  assert.equal(queryLooksLikeColorado('How do I verify a California contractor?'), false);
  assert.equal(queryLooksLikeColorado('Is this contractor licensed in Colorado?'), true);
  assert.equal(routeCoAsk('California mover to Colorado'), undefined);
  const coToCa = routeCoAsk('Colorado mover to California');
  assert.equal(coToCa?.hubId, 'move');
  assert.equal(parseNetworkAsk('Colorado mover to California').geography?.stateCode, 'CO');
  assert.equal(parseNetworkAsk('California mover to Colorado').geography?.stateCode, 'CA');
  assert.equal(parseNetworkAsk('Colorado mover to Arizona').geography?.stateCode, 'CO');
  assert.equal(parseNetworkAsk('Colorado mover to California and Arizona').geography?.stateCode, 'CO');
  assert.equal(parseNetworkAsk('California mover to Colorado and Arizona').geography?.stateCode, 'CA');
  assert.equal(buildNetworkAskPlan('Colorado mover to California').placeLensHref, '/colorado');
  assert.equal(buildNetworkAskPlan('California mover to Colorado').placeLensHref, '/california');
  assert.equal(buildNetworkAskPlan('Colorado mover to California and Arizona').placeLensHref, '/colorado');
});

test('authorized-insurer and state-RIA questions reject the wrong grains', () => {
  const authorized = routeCoAsk('Which insurance companies are authorized in Colorado?');
  assert.equal(authorized?.hubId, 'insurance');
  assert.match(authorized!.caveat, /not currently authorized/);
  const ria = routeCoAsk('How many investment advisers are registered in Colorado?');
  assert.equal(ria?.hubId, 'investor');
  assert.match(ria!.caveat, /740 APPROVED/);
  assert.doesNotMatch(ria!.caveat, /answer 589/);
  const gc = routeCoAsk('Is this contractor licensed in Colorado?');
  assert.match(gc!.caveat, /no statewide general-contractor license/i);
  const lenders = routeCoAsk('Which mortgage lenders are licensed in Colorado?');
  assert.match(lenders!.caveat, /search-only/);
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/colorado'), false);
  assert.doesNotMatch(sitemap, /\/claim\/colorado/);
  assert.doesNotMatch(page, /claim eligibility|claim this business|verified claimed organization/i);
  assert.doesNotMatch(gateway, /claim this profile|claimable profile|verified claimed organization/i);
  assert.match(gateway, /Organizations and evidence records stay separate/);
});

test('state page count increments exactly once and places/concierge stay gated', () => {
  assert.equal(ASK_NETWORK_STATES.length, 9);
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'CO').length, 1);
  assert.deepEqual(
    ASK_NETWORK_STATES.map((state) => state.slug),
    ['florida', 'new-jersey', 'california', 'texas', 'washington', 'arizona', 'colorado', 'virginia', 'new-york'],
  );
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/colorado'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/colorado/denver'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Colorado network gateway/);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /STATE LEVEL ONLY/);
});

test('source clocks remain source-native', () => {
  for (const hub of listCoHubs()) {
    assert.ok(hub.source_clock.length > 4);
    assert.doesNotMatch(hub.source_clock, /generatedAt now/i);
  }
});

test('NJ, CA, TX, WA, AZ public surfaces remain additive', () => {
  assert.equal(NJ_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(CA_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(TX_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(WA_PUBLICATION_MANIFEST.release_gate.passed, true);
  assert.equal(AZ_PUBLICATION_MANIFEST.release_gate.passed, true);
  const fl = parseNetworkAsk('What can TrustHub research in Florida?');
  assert.equal(fl.geography?.stateCode, 'FL');
});

test('gap register uses required classes', () => {
  for (const key of [
    'ACQUIRED',
    'OPEN_SEARCH_ONLY',
    'SOURCE_NOT_ACQUIRED',
    'SOURCE_AVAILABLE_BY_REQUEST',
    'SOURCE_USE_RESTRICTED',
    'HISTORICAL_STALE',
    'UNKNOWN',
    'NOT_APPLICABLE',
  ]) {
    assert.ok(key in gaps);
  }
  assert.ok(catalog.rows.length >= 6);
});

test('release contract name', () => {
  assert.equal(CO_NETWORK_CONTRACT, 'ath-co-network-release-v1');
  assert.equal(CO_PUBLICATION_MANIFEST.version, 'ath-co-network-release-v1');
  assert.equal(coReleaseGatePassed(), true);
});
