import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCEPTED_OR_SPECIALIST_RELEASES,
  OR_FINGERPRINT_METHOD,
  OR_NETWORK_CONTRACT,
  OR_PUBLICATION_FINGERPRINT,
  OR_PUBLICATION_MANIFEST,
  OR_SEMANTIC_GUARDRAILS,
  OR_VERIFICATION,
  classifyOrHub,
  evaluateOrPageEvidence,
  orPublicationSemanticFingerprint,
  orReleaseGatePassed,
  orSixHubIdsComplete,
  listOrHubs,
  queryLooksLikeOregon,
  routeOrAsk,
} from './or-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/oregon/page.tsx', 'utf8');
const gateway = readFileSync('components/oregon-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/oregon/state-closeout.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/oregon/gap-register.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/oregon-network-release.json', 'utf8'));

test('six required specialist Oregon pages, unique hub IDs, canonical URLs', () => {
  assert.equal(listOrHubs().length, 6);
  assert.equal(orSixHubIdsComplete(), true);
  const ids = listOrHubs().map((h) => h.hub_id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(orSixHubIdsComplete([...listOrHubs(), listOrHubs()[0]!]), false);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listOrHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/oregon$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
    assert.match(row!.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('release gate validates verification evidence, not an unexplained constant', () => {
  assert.equal(orReleaseGatePassed(), true);
  assert.equal(OR_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(OR_VERIFICATION.missing, []);
  assert.equal(OR_VERIFICATION.hubs.length, 6);
  for (const hub of OR_VERIFICATION.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
    const pageCheck = evaluateOrPageEvidence(hub, hub.expected_url ?? hub.url ?? '');
    assert.equal(pageCheck.ok, true);
  }
  assert.equal(OR_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(OR_PUBLICATION_MANIFEST.ask_production, null);
});

test('Ask /oregon canonical, indexability follows gate, no Portland/Multnomah routes', () => {
  assert.equal(OR_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/oregon');
  assert.equal(OR_PUBLICATION_MANIFEST.ask_path, '/oregon');
  assert.equal(OR_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(OR_PUBLICATION_MANIFEST.hardcoded_portland_routes, false);
  assert.equal(OR_PUBLICATION_MANIFEST.hardcoded_multnomah_routes, false);
  assert.equal(OR_PUBLICATION_MANIFEST.oregon_local_phase, 'NO');
  assert.equal(OR_PUBLICATION_MANIFEST.oregon_local_phase_status, 'NOT_STARTED');
  assert.equal(OR_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(OR_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /\/oregon/);
  assert.doesNotMatch(sitemap, /\/oregon\/portland/);
  assert.doesNotMatch(sitemap, /\/oregon\/multnomah/);
  assert.equal(existsSync('app/oregon/page.tsx'), true);
  assert.deepEqual(readdirSync('app/oregon').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
  assert.match(gateway, /45,501 distinct CCB license IDs/);
  assert.match(gateway, /113 ODOT household-goods certificates/);
  assert.match(gateway, /hub.canonical_state_url/);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(OR_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(OR_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(OR_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(OR_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
});

test('source-native expansion ledgers keep Oregon grains separate', () => {
  const ledgers = OR_PUBLICATION_MANIFEST.hub_expansion_ledgers;
  assert.equal(ledgers.contractor.DISTINCT_CCB_LICENSE_IDS, 45501);
  assert.equal(ledgers.contractor.CCB_SOURCE_ROWS, 56172);
  assert.equal(ledgers.contractor.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledgers.move.DISTINCT_OREGON_HHG_CERTIFICATE_IDS, 113);
  assert.equal(ledgers.move.EXACT_OREGON_CERTIFICATE_TO_USDOT_CROSSWALKS, 0);
  assert.equal(ledgers.move.COMPLAINT_OBSERVATIONS, null);
  assert.equal(ledgers.senior.ODHS_OPEN_NF, 128);
  assert.equal(ledgers.senior.ODHS_OPEN_AFH, 1580);
  assert.equal(ledgers.senior.EXACT_ODHS_TO_CMS_BRIDGES, 0);
  assert.equal(ledgers.lender.HMDA_2025_OR_COUNTY_APPLICATIONS, 146902);
  assert.equal(ledgers.lender.HMDA_2025_OR_LEI_APPLICATIONS, 145271);
  assert.equal(ledgers.lender.OR_MORTGAGE_COMPANY_ROSTER, 'OPEN_SEARCH_ONLY');
  assert.equal(ledgers.insurance.DFR_2025_COMPLAINT_TABLE_ROWS, 1309);
  assert.equal(ledgers.insurance.DFR_INSURANCE_UNIQUE_CASES, 726);
  assert.equal(ledgers.insurance.OR_AGENCY_ROSTER, 'OPEN_SEARCH_ONLY');
  assert.equal(ledgers.investor.OR_STATE_IA_APPROVED_CRDS, 335);
  assert.equal(ledgers.investor.OR_STATE_ERA_ACTIVE_CRDS, 26);
  assert.equal(ledgers.investor.OR_FEDERAL_NOTICE_FILED_CRDS, 2262);
  assert.equal(ledgers.investor.OR_PRINCIPAL_OFFICE_OVERLAY, 167);
});

test('semantic fingerprint excludes volatile clocks and changes on nested grain mutation', () => {
  const first = orPublicationSemanticFingerprint();
  const second = orPublicationSemanticFingerprint();
  assert.equal(first, second);
  assert.equal(first, OR_PUBLICATION_FINGERPRINT);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(closeout.publication_manifest_fingerprint, first);
  assert.equal(release.ask_fingerprint, first);
  const clockShift = structuredClone(OR_PUBLICATION_MANIFEST) as typeof OR_PUBLICATION_MANIFEST;
  clockShift.release_gate.verified_at = '2099-01-01T00:00:00.000Z';
  assert.equal(orPublicationSemanticFingerprint(clockShift), first);
  const mutated = structuredClone(OR_PUBLICATION_MANIFEST) as typeof OR_PUBLICATION_MANIFEST;
  mutated.hub_expansion_ledgers.lender.HMDA_2025_OR_COUNTY_APPLICATIONS = 146903;
  assert.notEqual(orPublicationSemanticFingerprint(mutated), first);
});

test('Oregon routing: ticket queries per hub plus ranking and identifier', () => {
  const cases: Array<[string, string]> = [
    ['contractors in Oregon', 'contractor'],
    ['Oregon contractor license', 'contractor'],
    ['CCB license Oregon', 'contractor'],
    ['roofing contractor Oregon', 'contractor'],
    ['movers in Oregon', 'move'],
    ['Oregon mover certificate', 'move'],
    ['Oregon household goods mover', 'move'],
    ['interstate mover Oregon', 'move'],
    ['nursing homes in Oregon', 'senior'],
    ['assisted living Oregon', 'senior'],
    ['residential care Oregon', 'senior'],
    ['adult foster homes Oregon', 'senior'],
    ['senior care violations Oregon', 'senior'],
    ['mortgage lenders Oregon', 'lender'],
    ['licensed mortgage lender Oregon', 'lender'],
    ['HMDA applications Oregon 2025', 'lender'],
    ['mortgage denials Oregon', 'lender'],
    ['insurance agency Oregon', 'insurance'],
    ['insurance agent Oregon', 'insurance'],
    ['insurance complaints Oregon', 'insurance'],
    ['Oregon insurance enforcement', 'insurance'],
    ['market conduct exam Oregon', 'insurance'],
    ['investment adviser Oregon', 'investor'],
    ['state registered investment adviser Oregon', 'investor'],
    ['CRD 105958 Oregon', 'investor'],
    ['Oregon adviser enforcement', 'investor'],
    ['Oregon notice filing', 'investor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeOrAsk(question)?.hubId, hub, question);
  }
  assert.equal(classifyOrHub('generic Oregon research'), undefined);
  assert.equal(routeOrAsk('California contractor moving to Oregon'), undefined);
});

test('exact identifiers are not intercepted by generic Oregon routing', () => {
  const crd = buildNetworkAskPlan('Research adviser CRD 105958 in Oregon');
  assert.equal(crd.parsed.intent, 'identifier');
  assert.equal(crd.parsed.identifier?.family.id, 'crd');
  const investor = crd.hubs.find((h) => h.hubId === 'investor');
  assert.ok(investor);
  assert.notEqual(investor?.mode, 'count');
  const usdot = buildNetworkAskPlan('Find USDOT 3244649 in Oregon');
  assert.equal(usdot.parsed.intent, 'identifier');
  assert.equal(usdot.parsed.identifier?.family.id, 'usdot');
});

test('ranking remains unsupported; no combined provider total', () => {
  const best = buildNetworkAskPlan('best provider in Oregon');
  assert.ok(best);
  assert.match(OR_SEMANTIC_GUARDRAILS.no_ranking, /rank/i);
  const howMany = buildNetworkAskPlan('how many providers are in Oregon');
  assert.ok(howMany);
  assert.equal(OR_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
});

test('Portland names stay statewide and do not invent local routes', () => {
  assert.equal(queryLooksLikeOregon('contractor in Portland'), true);
  assert.equal(routeOrAsk('contractor in Portland')?.hubId, 'contractor');
  assert.equal(existsSync('app/oregon/portland'), false);
  assert.equal(existsSync('app/oregon/multnomah'), false);
  assert.doesNotMatch(sitemap, /\/oregon\/portland/);
  assert.match(OR_SEMANTIC_GUARDRAILS.portland_deferred, /not published/i);
  assert.equal(gaps.portland_multnomah_phase.status, 'NOT_STARTED');
  const parsed = parseNetworkAsk('roofing contractors in Portland');
  assert.equal(parsed.geography?.stateCode, 'OR');
  assert.match(parsed.geography?.meaning ?? '', /not a local Ask route|statewide|Portland/i);
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/oregon'), false);
  assert.doesNotMatch(sitemap, /\/claim\/oregon/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
});

test('state page inventory adds Oregon once', () => {
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'OR').length, 1);
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.slug === 'oregon').length, 1);
  assert.equal(ASK_NETWORK_STATES.length, 13);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/oregon'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/oregon/portland'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Oregon network gateway/);
  assert.equal(OR_NETWORK_CONTRACT, 'ath-or-network-release-v1');
  assert.equal(OR_PUBLICATION_MANIFEST.version, OR_NETWORK_CONTRACT);
  assert.match(OR_FINGERPRINT_METHOD, /not recomputed from HTML/i);
});

test('accepted specialist fingerprints are the certified Oregon contracts', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    const accepted = ACCEPTED_OR_SPECIALIST_RELEASES[id];
    const hub = listOrHubs().find((h) => h.hub_id === id)!;
    assert.equal(hub.fingerprint, accepted.fingerprint);
    assert.equal(hub.snapshot_version, accepted.snapshot_version);
    assert.equal(hub.certified_release_sha, accepted.certified_release_sha);
  }
});

test('Oregon files have no copied Illinois/NY/VA/CO specialist residue', () => {
  const files = [
    'lib/network/or-network.ts',
    'components/oregon-network-gateway.tsx',
    'app/oregon/page.tsx',
    'data/network/oregon-publication-manifest.json',
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /IDFPR|IDOI|ILCC|Director.?s Order|Cook County|Chicago roofing/);
    assert.doesNotMatch(text, /394,488|2,896 IDOI|4,675 active Illinois/);
  }
});
