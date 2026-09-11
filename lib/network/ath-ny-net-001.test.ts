import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCEPTED_NY_SPECIALIST_RELEASES,
  NY_FINGERPRINT_METHOD,
  NY_NETWORK_CONTRACT,
  NY_PUBLICATION_FINGERPRINT,
  NY_PUBLICATION_MANIFEST,
  NY_SEMANTIC_GUARDRAILS,
  NY_VERIFICATION,
  classifyNyHub,
  evaluateNyPageEvidence,
  nyPublicationSemanticFingerprint,
  nyReleaseGatePassed,
  nySixHubIdsComplete,
  listNyHubs,
  queryLooksLikeNewYork,
  requestedLegalJurisdiction,
  routeNyAsk,
} from './ny-network.ts';
import { MOVE_ASK_ROUTE } from './move-ask.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/new-york/page.tsx', 'utf8');
const gateway = readFileSync('components/new-york-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/new-york/state-closeout.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/new-york/gap-register.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/new-york-network-release.json', 'utf8'));

test('six required specialist New York pages, unique hub IDs, canonical URLs', () => {
  assert.equal(listNyHubs().length, 6);
  assert.equal(nySixHubIdsComplete(), true);
  const ids = listNyHubs().map((h) => h.hub_id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(nySixHubIdsComplete([...listNyHubs(), listNyHubs()[0]!]), false);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listNyHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/new-york$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
    assert.match(row!.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('release gate validates verification evidence, not an unexplained constant', () => {
  assert.equal(nyReleaseGatePassed(), true);
  assert.equal(NY_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(NY_VERIFICATION.missing, []);
  assert.equal(NY_VERIFICATION.hubs.length, 6);
  for (const hub of NY_VERIFICATION.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
  }
  assert.equal(NY_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(NY_PUBLICATION_MANIFEST.ask_production, null);
  assert.equal(closeout.status, 'ASK_PREVIEW_READY');
  assert.equal(closeout.ask_production, null);
});

test('Ask /new-york canonical, indexability follows gate, no NYC routes', () => {
  assert.equal(NY_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-york');
  assert.equal(NY_PUBLICATION_MANIFEST.ask_path, '/new-york');
  assert.equal(NY_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(NY_PUBLICATION_MANIFEST.hardcoded_nyc_routes, false);
  assert.equal(NY_PUBLICATION_MANIFEST.new_york_local_phase, 'APPROVED_AFTER_STATEWIDE_CLOSEOUT');
  assert.equal(NY_PUBLICATION_MANIFEST.new_york_local_phase_status, 'NOT_STARTED');
  assert.equal(NY_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(NY_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /\/new-york/);
  assert.doesNotMatch(sitemap, /\/new-york\/manhattan/);
  assert.doesNotMatch(sitemap, /\/new-york\/brooklyn/);
  assert.equal(existsSync('app/new-york/page.tsx'), true);
  assert.deepEqual(readdirSync('app/new-york').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
  assert.match(gateway, /14,665 public-work certificate rows/);
  assert.match(gateway, /Current NYSDOT household-goods roster is search only/);
  assert.equal(listNyHubs().find((h) => h.hub_id === 'move')?.canonical_state_url, 'https://www.movetrusthub.com/new-york');
  assert.match(gateway, /hub.canonical_state_url/);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(NY_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(NY_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(NY_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(NY_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
});

test('source-native expansion ledgers are not a common NET_NEW_STATE_IDENTITIES field', () => {
  const ledgers = NY_PUBLICATION_MANIFEST.hub_expansion_ledgers;
  assert.equal(ledgers.contractor.NEW_STATE_IDENTITIES, 14665);
  assert.equal(ledgers.contractor.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledgers.move.hhgApplicationObservations, 108);
  assert.equal(ledgers.move.distinctCaseNumbers, 103);
  assert.equal(ledgers.move.currentHhgAuthorityRows, null);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.move, false);
  assert.equal(ledgers.senior.NYSDOH_NH_PROFILE_FACILITY_IDENTITIES, 597);
  assert.equal(ledgers.senior.DISTINCT_SOURCE_NATIVE_CCNS, 594);
  assert.equal(ledgers.senior.CMS_NY_NURSING_HOMES, 593);
  assert.equal(ledgers.senior.ACF_RESEARCH_IDENTITIES, 527);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.senior, false);
  assert.equal(ledgers.lender.HMDA_2025_NY_PROPERTY_APPLICATIONS, 388207);
  assert.equal(ledgers.lender.END_OF_2024_BANKERS, 151);
  assert.equal(ledgers.lender.CFPB_NY_MORTGAGE_BULK_COUNT, null);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.lender, false);
  assert.equal(ledgers.insurance.DFS_COMPANY_DIRECTORY_ROWS, 1054);
  assert.equal(ledgers.insurance.HEALTH_COMPLAINT_BULK_COUNT, null);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.insurance, false);
  assert.equal(ledgers.investor.NY_STATE_IA_APPROVED_CURRENT, 1297);
  assert.equal(ledgers.investor.NEW_NY_STATE_IDENTITIES, 1624);
  assert.equal(ledgers.investor.OAG_BOUNDED_ENFORCEMENT_COUNT, null);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.investor, false);
});

test('semantic fingerprint excludes volatile clocks and changes on nested grain mutation', () => {
  const first = nyPublicationSemanticFingerprint();
  const second = nyPublicationSemanticFingerprint();
  assert.equal(first, second);
  assert.equal(first, NY_PUBLICATION_FINGERPRINT);
  assert.equal(closeout.publication_manifest_fingerprint, first);
  assert.equal(release.ask_fingerprint, first);
  const clockShift = structuredClone(NY_PUBLICATION_MANIFEST) as typeof NY_PUBLICATION_MANIFEST;
  clockShift.release_gate.verified_at = '2099-01-01T00:00:00.000Z';
  assert.equal(nyPublicationSemanticFingerprint(clockShift), first);
  const mutated = structuredClone(NY_PUBLICATION_MANIFEST) as typeof NY_PUBLICATION_MANIFEST;
  mutated.hub_expansion_ledgers.move.hhgApplicationObservations = 109;
  assert.notEqual(nyPublicationSemanticFingerprint(mutated), first);
});

test('New York routing: two queries per hub plus cross-boundary cases', () => {
  const cases: Array<[string, string]> = [
    ['How many public-work contractors are registered in New York?', 'contractor'],
    ['Is this contractor registered for public work in New York?', 'contractor'],
    ['Show intrastate movers in New York', 'move'],
    ['Show current interstate carriers headquartered in NY', 'move'],
    ['Nursing homes in New York', 'senior'],
    ['licensed home-care agencies in NY', 'senior'],
    ['How much mortgage lending happened in New York in 2025?', 'lender'],
    ['Which mortgage lenders are currently licensed in New York?', 'lender'],
    ['Which insurance companies are in the New York DFS directory?', 'insurance'],
    ['Does this insurer have a New York DFS enforcement observation?', 'insurance'],
    ['How many investment advisers are registered in New York?', 'investor'],
    ['Does a New York principal office mean the adviser is state-registered?', 'investor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeNyAsk(question)?.hubId, hub, question);
  }
  assert.equal(classifyNyHub('generic New York research'), undefined);
  assert.equal(routeNyAsk('New York contractor debarred in Florida'), undefined);
});

test('exact USDOT identity keeps the structured Ask destination', () => {
  const plan = buildNetworkAskPlan('Find USDOT 3244649 in New York');
  const move = plan.hubs.find((h) => h.hubId === 'move');
  assert.equal(plan.parsed.intent, 'identifier');
  assert.equal(plan.parsed.identifier?.family.id, 'usdot');
  assert.match(plan.parsed.identifier?.raw ?? '', /3244649/);
  assert.equal(move?.capabilityStatus, 'execute');
  assert.equal(move?.mode, 'identifier');
  assert.equal(move?.structuredFilters?.identifier, plan.parsed.identifier?.raw);
  assert.match(move?.destination ?? '', /movetrusthub\.com\/ask\?/);
  assert.match(move?.destination ?? '', /3244649/);
  assert.doesNotMatch(move?.destination ?? '', /\/new-york$/);
  assert.notEqual(move?.preview?.sourceFamily, 'nysdot');
  assert.match(move?.geographyCapability ?? '', /Identifier routing/i);
});

test('federal NY headquarters research keeps structured Ask execution', () => {
  const plan = buildNetworkAskPlan('Show current interstate carriers headquartered in NY');
  const move = plan.hubs.find((h) => h.hubId === 'move');
  assert.equal(plan.parsed.geography?.stateCode, 'NY');
  assert.notEqual(plan.parsed.topic, 'Florida Intrastate Mover registration research');
  assert.equal(move?.capabilityStatus, 'execute');
  assert.equal(move?.mode, 'entity');
  assert.match(move?.destination ?? '', new RegExp(MOVE_ASK_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(move?.destination ?? '', /\/new-york$/);
  assert.match(move?.geographyCapability ?? '', /headquarters|recorded/i);
  assert.doesNotMatch(move?.preview?.grain ?? '', /FDACS/);
});

test('NYSDOT intrastate roster stays fail-closed and does not become Florida IM', () => {
  const intra = parseNetworkAsk('Show intrastate movers in New York');
  assert.equal(intra.geography?.stateCode, 'NY');
  assert.notEqual(intra.topic, 'Florida Intrastate Mover registration research');
  const plan = buildNetworkAskPlan('Show intrastate movers in New York');
  const move = plan.hubs.find((h) => h.hubId === 'move');
  assert.equal(move?.mode, 'fail_closed');
  assert.match(move?.whatItCanAnswer ?? move?.reason ?? '', /not acquired|Florida IM registration is not a substitute/i);
  assert.doesNotMatch(move?.preview?.grain ?? '', /FDACS/);
  const fdacs = parseNetworkAsk('Show Florida intrastate movers registered with FDACS');
  assert.equal(fdacs.geography?.stateCode, 'FL');
  assert.equal(fdacs.topic, 'Florida Intrastate Mover registration research');
});

test('complaint evidence keeps source scope through the final plan', () => {
  const federal = buildNetworkAskPlan('Show complaint observations for USDOT 3244649, a New York mover');
  const federalMove = federal.hubs.find((h) => h.hubId === 'move');
  assert.equal(federal.parsed.intent, 'identifier');
  assert.equal(federalMove?.mode, 'evidence');
  assert.match(federalMove?.destination ?? '', /movetrusthub\.com\/ask\?/);
  assert.doesNotMatch(federalMove?.destination ?? '', /\/new-york$/);
  const nysdot = buildNetworkAskPlan('NYSDOT complaints for USDOT 3244649');
  const nysdotMove = nysdot.hubs.find((h) => h.hubId === 'move');
  assert.equal(nysdotMove?.mode, 'fail_closed');
  assert.match(nysdotMove?.whatItCanAnswer ?? nysdotMove?.reason ?? '', /NYSDOT complaint corpus is not acquired/i);
  assert.doesNotMatch(nysdotMove?.preview?.grain ?? '', /FDACS|federal complaint rows/i);
});

test('requested registration and debarment jurisdiction wins through the final plan', () => {
  const cases: Array<[string, string]> = [
    ['New Jersey adviser registered in New York', 'NY'],
    ['California adviser registered in New York', 'NY'],
    ['Florida adviser registered in NY', 'NY'],
    ['New York adviser registered in Florida', 'FL'],
    ['New York contractor debarred in Texas', 'TX'],
  ];
  for (const [query, code] of cases) {
    const parsed = parseNetworkAsk(query);
    const plan = buildNetworkAskPlan(query);
    assert.equal(parsed.geography?.stateCode, code, query);
    assert.equal(plan.parsed.geography?.stateCode, code, query);
    assert.doesNotMatch(parsed.geography?.meaning ?? '', /first state mentioned/i);
  }
  assert.equal(requestedLegalJurisdiction('Florida adviser registered in NY')?.code, 'NY');
  assert.equal(requestedLegalJurisdiction('New York contractor debarred in Texas')?.code, 'TX');
  assert.equal(routeNyAsk('New York contractor debarred in Texas'), undefined);
  assert.equal(routeNyAsk('New Jersey adviser registered in New York')?.hubId, 'investor');
  const vaMortgage = buildNetworkAskPlan('VA mortgage in New York');
  assert.equal(vaMortgage.parsed.geography?.stateCode, 'NY');
  assert.equal(vaMortgage.hubs[0]?.hubId, 'lender');
  assert.equal(queryLooksLikeNewYork('New York Life'), false);
  assert.equal(parseNetworkAsk('New York Life').geography?.stateCode, undefined);
  assert.equal(parseNetworkAsk('West Virginia contractor').geography?.stateCode, 'WV');
  assert.equal(parseNetworkAsk('Is this mover licensed in New Jersey?').geography?.stateCode, 'NJ');
  assert.equal(requestedLegalJurisdiction('adviser registered in or near New York'), undefined);
  assert.equal(parseNetworkAsk('adviser registered in or near New York').geography?.stateCode, 'NY');
  assert.equal(buildNetworkAskPlan('adviser registered in or near New York').parsed.geography?.stateCode, 'NY');
});

test('multiple requested registration states clarify instead of collapsing', () => {
  const queries = [
    'An adviser registered in New York and registered in Florida',
    'An adviser registered in New York and Florida',
    'An adviser registered in NY and FL',
    'New Jersey adviser registered in New York and Florida',
  ];
  for (const query of queries) {
    const requested = requestedLegalJurisdiction(query);
    const parsed = parseNetworkAsk(query);
    const plan = buildNetworkAskPlan(query);
    const hub = plan.hubs[0];
    assert.equal(requested?.ambiguous, true, query);
    assert.ok(requested?.codes.includes('NY'), query);
    assert.ok(requested?.codes.includes('FL'), query);
    assert.equal(parsed.geography?.stateCode, undefined, query);
    assert.match(parsed.geography?.meaning ?? '', /New York/i, query);
    assert.match(parsed.geography?.meaning ?? '', /Florida/i, query);
    assert.doesNotMatch(parsed.geography?.meaning ?? '', /first state mentioned/i, query);
    assert.equal(plan.parsed.geography?.stateCode, undefined, query);
    assert.equal(hub?.mode, 'fail_closed', query);
    assert.notEqual(hub?.capabilityStatus, 'execute', query);
    assert.doesNotMatch(hub?.destination ?? '', /\/ask(\?|$)/i, query);
    assert.doesNotMatch(hub?.destination ?? '', /investortrusthub\.com\/ask/i, query);
    assert.match(`${hub?.whatItCanAnswer ?? ''} ${hub?.reason ?? ''} ${hub?.geographyCapability ?? ''}`, /New York/i, query);
    assert.match(`${hub?.whatItCanAnswer ?? ''} ${hub?.reason ?? ''} ${hub?.geographyCapability ?? ''}`, /Florida/i, query);
  }
  const officeOnly = buildNetworkAskPlan('Florida adviser registered in New York');
  assert.equal(officeOnly.parsed.geography?.stateCode, 'NY');
  assert.notEqual(officeOnly.hubs[0]?.mode, 'fail_closed');
  for (const query of queries) {
    const route = buildAskResearchRoute(query);
    assert.equal(route.canExecute, false, query);
    assert.match(route.status, /detail before I search|clarif/i, query);
    assert.match(`${route.explanation} ${route.requestedScope ?? ''} ${route.executionScope ?? ''}`, /New York|Florida|geography/i, query);
  }
});

test('NYC names stay statewide and do not invent local routes', () => {
  assert.equal(queryLooksLikeNewYork('contractor in Brooklyn'), true);
  assert.equal(routeNyAsk('contractor in Manhattan')?.hubId, 'contractor');
  assert.equal(existsSync('app/new-york/manhattan'), false);
  assert.doesNotMatch(sitemap, /\/new-york\/queens/);
  assert.match(NY_SEMANTIC_GUARDRAILS.nyc_deferred, /not started/i);
  assert.equal(gaps.nyc_phase.status, 'NOT_STARTED');
  assert.equal(gaps.nyc_phase.decision, 'APPROVED_AFTER_STATEWIDE_CLOSEOUT');
});

test('ranking and malformed identifiers do not become counts', () => {
  const best = buildNetworkAskPlan('best mover in New York');
  const move = best.hubs.find((h) => h.hubId === 'move');
  assert.notEqual(move?.mode, 'count');
  assert.match(move?.destination ?? '', /movetrusthub\.com\/ask/);
  assert.doesNotMatch(move?.destination ?? '', /\/new-york$/);
  assert.match(`${move?.judgmentNote ?? ''} ${move?.whatItCanAnswer ?? ''}`, /rank/i);
  assert.match(NY_SEMANTIC_GUARDRAILS.no_ranking, /does not publish paid rankings/);
  const banana = parseNetworkAsk('USDOT banana');
  assert.notEqual(banana.intent, 'count');
  const named = buildNetworkAskPlan('Is Acme Moving licensed in New York?');
  assert.notEqual(named.hubs[0]?.mode, 'count');
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/new-york'), false);
  assert.doesNotMatch(sitemap, /\/claim\/new-york/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
});

test('state page inventory adds New York once', () => {
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'NY').length, 1);
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug, 'new-york');
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/new-york'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/new-york/manhattan'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /New York network gateway/);
  assert.doesNotMatch(ASK_CONCIERGE_SYSTEM_PROMPT, /ASK_PREVIEW_READY, not Production-closed/);
  assert.equal(NY_NETWORK_CONTRACT, 'ath-ny-network-release-v1');
  assert.equal(NY_PUBLICATION_MANIFEST.version, NY_NETWORK_CONTRACT);
  assert.match(NY_FINGERPRINT_METHOD, /not recomputed from HTML/i);
});

test('release gate fails on modified fixtures', () => {
  const goodPage = {
    hub_id: 'move',
    url: 'https://www.movetrusthub.com/new-york',
    http_status: 200,
    canonical: 'https://www.movetrusthub.com/new-york',
    robots: 'index, follow',
    x_robots_tag: null,
    final_url: 'https://www.movetrusthub.com/new-york',
    sso: false,
    headline_ok: true,
    intended_intelligence_page: true,
    not_noindex: true,
  };
  const expected = ACCEPTED_NY_SPECIALIST_RELEASES.move.canonical_state_url;
  assert.equal(evaluateNyPageEvidence(goodPage, expected).ok, true);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, canonical: 'https://www.otherexample.com/new-york' }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, canonical: 'https://www.movetrusthub.com/florida' }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, final_url: 'https://www.movetrusthub.com/' }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, sso: true, final_url: 'https://vercel.com/login' }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, robots: 'noindex, follow' }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, x_robots_tag: 'noindex' }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, http_status: 404 }, expected).ok, false);
  assert.equal(evaluateNyPageEvidence({ ...goodPage, headline_ok: false }, expected).ok, false);

  const hubs = structuredClone(NY_PUBLICATION_MANIFEST.hubs);
  assert.equal(nySixHubIdsComplete(hubs), true);
  assert.equal(nySixHubIdsComplete(hubs.slice(0, 5)), false);
  assert.equal(nySixHubIdsComplete([...hubs, hubs[0]!]), false);

  const verification = structuredClone(NY_VERIFICATION);
  assert.equal(nyReleaseGatePassed(NY_PUBLICATION_MANIFEST, verification), true);

  const duplicateManifest = { ...NY_PUBLICATION_MANIFEST, hubs: [...hubs, hubs[0]!] };
  assert.equal(nyReleaseGatePassed(duplicateManifest, verification), false);

  const missingHub = { ...NY_PUBLICATION_MANIFEST, hubs: hubs.filter((h) => h.hub_id !== 'insurance') };
  assert.equal(nyReleaseGatePassed(missingHub, verification), false);

  const duplicateVerification = { ...verification, hubs: [...verification.hubs, verification.hubs[0]!] };
  assert.equal(nyReleaseGatePassed(NY_PUBLICATION_MANIFEST, duplicateVerification), false);

  const wrongOrigin = structuredClone(NY_PUBLICATION_MANIFEST);
  wrongOrigin.hubs[0]!.canonical_state_url = 'https://www.example.com/new-york';
  assert.equal(nyReleaseGatePassed(wrongOrigin, verification), false);

  const noindexVerification = structuredClone(verification);
  noindexVerification.hubs[0]!.robots = 'noindex, follow';
  assert.equal(nyReleaseGatePassed(NY_PUBLICATION_MANIFEST, noindexVerification), false);

  const wrongSnapshot = structuredClone(NY_PUBLICATION_MANIFEST);
  wrongSnapshot.hubs[0]!.snapshot_version = 'contractor-ny-state-intel-v0';
  assert.equal(nyReleaseGatePassed(wrongSnapshot, verification), false);

  const wrongFingerprint = structuredClone(NY_PUBLICATION_MANIFEST);
  wrongFingerprint.hubs[0]!.fingerprint = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.equal(nyReleaseGatePassed(wrongFingerprint, verification), false);
});
