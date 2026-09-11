import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  NY_NETWORK_CONTRACT,
  NY_PUBLICATION_FINGERPRINT,
  NY_PUBLICATION_MANIFEST,
  NY_SEMANTIC_GUARDRAILS,
  NY_VERIFICATION,
  classifyNyHub,
  nyPublicationSemanticFingerprint,
  nyReleaseGatePassed,
  nySixHubIdsComplete,
  listNyHubs,
  queryLooksLikeNewYork,
  routeNyAsk,
} from './ny-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
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
  assert.equal(nySixHubIdsComplete(), true);
  const ids = listNyHubs().map((h) => h.hub_id);
  assert.equal(new Set(ids).size, 6);
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

test('Move NYSDOT limitation is not Florida IM; federal NY geography stays available', () => {
  const intra = parseNetworkAsk('Show intrastate movers in New York');
  assert.equal(intra.geography?.stateCode, 'NY');
  assert.notEqual(intra.topic, 'Florida Intrastate Mover registration research');
  assert.equal(routeNyAsk('Show intrastate movers in New York')?.hubId, 'move');
  assert.match(routeNyAsk('Show intrastate movers in New York')?.caveat ?? '', /NOT_ACQUIRED|search\/verification only|unknown, not zero/);
  const federal = parseNetworkAsk('Show current interstate carriers headquartered in NY');
  assert.equal(federal.geography?.stateCode, 'NY');
  assert.equal(federal.suggestedHubs[0], 'move');
  assert.notEqual(federal.topic, 'Florida Intrastate Mover registration research');
  const plan = buildNetworkAskPlan('Show current interstate carriers headquartered in NY');
  assert.equal(plan.placeLensHref, '/new-york');
  assert.equal(plan.parsed.suggestedHubs[0], 'move');
  assert.ok(plan.hubs.some((h) => h.hubId === 'move') || plan.parsed.suggestedHubs.includes('move'));
  const fdacs = parseNetworkAsk('Show Florida intrastate movers registered with FDACS');
  assert.equal(fdacs.geography?.stateCode, 'FL');
  assert.equal(fdacs.topic, 'Florida Intrastate Mover registration research');
});

test('exact identifiers remain usable and stay distinct from NYSDOT complaints', () => {
  const usdot = parseNetworkAsk('Find USDOT 3244649 in New York');
  assert.equal(usdot.intent, 'identifier');
  assert.equal(usdot.identifier?.family.id, 'usdot');
  const nysdotComplaint = routeNyAsk('NYSDOT complaints for USDOT 3244649');
  assert.equal(nysdotComplaint?.hubId, 'move');
  assert.match(nysdotComplaint?.caveat ?? '', /USDOT is not NY intrastate|NOT_ACQUIRED|complaint/);
});

test('other-state wording, New York Life, VA mortgage, and West Virginia/New Jersey', () => {
  assert.equal(queryLooksLikeNewYork('New York Life'), false);
  assert.equal(routeNyAsk('New York Life'), undefined);
  assert.equal(parseNetworkAsk('New York Life').geography?.stateCode !== 'NY' || parseNetworkAsk('New York Life').intent !== 'place', true);
  assert.equal(routeNyAsk('California contractor moving to New York'), undefined);
  assert.equal(parseNetworkAsk('California contractor moving to New York').geography?.stateCode, 'CA');
  assert.equal(parseNetworkAsk('VA mortgage in New York').geography?.stateCode, 'NY');
  assert.equal(parseNetworkAsk('VA mortgage in New York').suggestedHubs[0], 'lender');
  assert.equal(parseNetworkAsk('West Virginia contractor').geography?.stateCode, 'WV');
  assert.equal(queryLooksLikeNewYork('Is this mover licensed in New Jersey?'), false);
  assert.equal(parseNetworkAsk('Is this mover licensed in New Jersey?').geography?.stateCode, 'NJ');
  const registeredNy = parseNetworkAsk('Florida adviser registered in New York');
  assert.equal(registeredNy.geography?.stateCode, 'NY');
  assert.match(registeredNy.geography?.meaning ?? '', /registration jurisdiction/i);
  const registeredFl = parseNetworkAsk('New York adviser registered in Florida');
  assert.equal(registeredFl.geography?.stateCode, 'FL');
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
  const best = parseNetworkAsk('best mover in New York');
  assert.notEqual(best.intent, 'count');
  assert.match(NY_SEMANTIC_GUARDRAILS.no_ranking, /does not publish paid rankings/);
  const banana = parseNetworkAsk('USDOT banana');
  assert.notEqual(banana.intent, 'count');
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
  assert.equal(NY_NETWORK_CONTRACT, 'ath-ny-network-release-v1');
  assert.equal(NY_PUBLICATION_MANIFEST.version, NY_NETWORK_CONTRACT);
});
