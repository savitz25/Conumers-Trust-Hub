import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCEPTED_IL_SPECIALIST_RELEASES,
  IL_FINGERPRINT_METHOD,
  IL_NETWORK_CONTRACT,
  IL_PUBLICATION_FINGERPRINT,
  IL_PUBLICATION_MANIFEST,
  IL_SEMANTIC_GUARDRAILS,
  IL_VERIFICATION,
  classifyIlHub,
  evaluateIlPageEvidence,
  ilPublicationSemanticFingerprint,
  ilReleaseGatePassed,
  ilSixHubIdsComplete,
  listIlHubs,
  queryLooksLikeIllinois,
  routeIlAsk,
} from './il-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { buildAskResearchRoute } from './ask-research-route.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/illinois/page.tsx', 'utf8');
const gateway = readFileSync('components/illinois-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/illinois/state-closeout.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/illinois/gap-register.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/illinois-network-release.json', 'utf8'));

test('six required specialist Illinois pages, unique hub IDs, canonical URLs', () => {
  assert.equal(listIlHubs().length, 6);
  assert.equal(ilSixHubIdsComplete(), true);
  const ids = listIlHubs().map((h) => h.hub_id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(ilSixHubIdsComplete([...listIlHubs(), listIlHubs()[0]!]), false);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listIlHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/illinois$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
    assert.match(row!.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('release gate validates verification evidence, not an unexplained constant', () => {
  assert.equal(ilReleaseGatePassed(), true);
  assert.equal(IL_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(IL_VERIFICATION.missing, []);
  assert.equal(IL_VERIFICATION.hubs.length, 6);
  for (const hub of IL_VERIFICATION.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
  }
  assert.equal(IL_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(IL_PUBLICATION_MANIFEST.ask_production, null);
});

test('Ask /illinois canonical, indexability follows gate, no Chicago/Cook routes', () => {
  assert.equal(IL_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/illinois');
  assert.equal(IL_PUBLICATION_MANIFEST.ask_path, '/illinois');
  assert.equal(IL_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(IL_PUBLICATION_MANIFEST.hardcoded_chicago_routes, false);
  assert.equal(IL_PUBLICATION_MANIFEST.hardcoded_cook_routes, false);
  assert.equal(IL_PUBLICATION_MANIFEST.illinois_local_phase, 'NO');
  assert.equal(IL_PUBLICATION_MANIFEST.illinois_local_phase_status, 'NOT_STARTED');
  assert.equal(IL_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(IL_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /\/illinois/);
  assert.doesNotMatch(sitemap, /\/illinois\/chicago/);
  assert.doesNotMatch(sitemap, /\/illinois\/cook/);
  assert.equal(existsSync('app/illinois/page.tsx'), true);
  assert.deepEqual(readdirSync('app/illinois').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
  assert.match(gateway, /4,675 active roofing business credential IDs/);
  assert.match(gateway, /Current ILCC household-goods roster is search only/);
  assert.doesNotMatch(gateway, /0 licensed movers/);
  assert.equal(listIlHubs().find((h) => h.hub_id === 'move')?.canonical_state_url, 'https://www.movetrusthub.com/illinois');
  assert.match(gateway, /hub.canonical_state_url/);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(IL_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(IL_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(IL_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(IL_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
});

test('source-native expansion ledgers keep Illinois grains separate', () => {
  const ledgers = IL_PUBLICATION_MANIFEST.hub_expansion_ledgers;
  assert.equal(ledgers.contractor.ACTIVE_BUSINESS_IDS, 4675);
  assert.equal(ledgers.contractor.DISTINCT_ROOFING_IDS, 33290);
  assert.equal(ledgers.contractor.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledgers.move.currentHhgAuthorityRows, null);
  assert.equal(ledgers.move.currentHhgAuthorityIds, null);
  assert.equal(ledgers.move.EXACT_IL_STATE_TO_USDOT_CROSSWALKS, 0);
  assert.equal(ledgers.move.EXACT_IL_STATE_TO_MC_CROSSWALKS, 0);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.move, false);
  assert.equal(ledgers.senior.CMS_NURSING_HOMES, 666);
  assert.equal(ledgers.senior.IDPH_HOME_HEALTH_LICENSES, 595);
  assert.equal(ledgers.senior.HFS_SUPPORTIVE_LIVING_SITES, 169);
  assert.equal(ledgers.senior.EXACT_IL_STATE_TO_CMS_BRIDGES, 0);
  assert.equal(ledgers.lender.HMDA_2025_IL_PROPERTY_APPLICATIONS, 394488);
  assert.equal(ledgers.lender.HMDA_2025_IL_ORIGINATIONS, 231788);
  assert.equal(ledgers.lender.HMDA_2025_IL_DENIALS, 66742);
  assert.equal(ledgers.lender.DENIALS_AS_PCT_OF_APPLICATIONS, 16.92);
  assert.equal(ledgers.insurance.IDOI_DIRECTOR_ORDER_OBSERVATIONS, 2896);
  assert.equal(ledgers.insurance.EXACT_COMPANY_ENFORCEMENT_ASSOCIATIONS, 0);
  assert.equal(ledgers.insurance.AUTHORIZED_COMPANY_UNIVERSE, null);
  assert.equal(ledgers.investor.IL_STATE_IA_APPROVED_CURRENT, 855);
  assert.equal(ledgers.investor.IL_STATE_ERA_IDENTITIES, 55);
  assert.equal(ledgers.investor.NOTICE_FILINGS, 3560);
  assert.equal(ledgers.investor.PRINCIPAL_OFFICE_OVERLAY, 793);
  assert.equal(ledgers.investor.IA_NOTICE_OVERLAP_EXACT_CRDS, 1);
  assert.equal(ledgers.investor.NEW_IL_STATE_IDENTITIES, 910);
  assert.equal('NET_NEW_STATE_IDENTITIES' in ledgers.investor, false);
});

test('semantic fingerprint excludes volatile clocks and changes on nested grain mutation', () => {
  const first = ilPublicationSemanticFingerprint();
  const second = ilPublicationSemanticFingerprint();
  assert.equal(first, second);
  assert.equal(first, IL_PUBLICATION_FINGERPRINT);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(closeout.publication_manifest_fingerprint, first);
  assert.equal(release.ask_fingerprint, first);
  const clockShift = structuredClone(IL_PUBLICATION_MANIFEST) as typeof IL_PUBLICATION_MANIFEST;
  clockShift.release_gate.verified_at = '2099-01-01T00:00:00.000Z';
  assert.equal(ilPublicationSemanticFingerprint(clockShift), first);
  const mutated = structuredClone(IL_PUBLICATION_MANIFEST) as typeof IL_PUBLICATION_MANIFEST;
  mutated.hub_expansion_ledgers.lender.HMDA_2025_IL_PROPERTY_APPLICATIONS = 394489;
  assert.notEqual(ilPublicationSemanticFingerprint(mutated), first);
});

test('Illinois routing: ticket queries per hub plus ranking and identifier', () => {
  const cases: Array<[string, string]> = [
    ['roofing contractors in Illinois', 'contractor'],
    ['How many active roofing businesses are indexed in Illinois?', 'contractor'],
    ['disciplinary records for an Illinois roofing contractor', 'contractor'],
    ['best contractor in Illinois', 'contractor'],
    ['licensed movers in Illinois', 'move'],
    ['How many movers are licensed in Illinois?', 'move'],
    ['interstate mover in Illinois', 'move'],
    ['nursing homes in Illinois', 'senior'],
    ['assisted living in Illinois', 'senior'],
    ['supportive living in Illinois', 'senior'],
    ['mortgage activity in Illinois', 'lender'],
    ['How many mortgage applications were reported in Illinois in 2025?', 'lender'],
    ['licensed mortgage companies in Illinois', 'lender'],
    ['insurance companies in Illinois', 'insurance'],
    ['insurance agencies in Illinois', 'insurance'],
    ['Director’s Orders in Illinois', 'insurance'],
    ['state registered investment advisers in Illinois', 'investor'],
    ['federal advisers filing notice in Illinois', 'investor'],
    ['investment advisers in Illinois', 'investor'],
    ['Who regulates movers in Illinois?', 'move'],
    ['Where can I research a roofing contractor in Illinois?', 'contractor'],
    ['Where can I research a nursing home in Illinois?', 'senior'],
    ['Where can I verify an insurance company in Illinois?', 'insurance'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeIlAsk(question)?.hubId, hub, question);
  }
  assert.equal(classifyIlHub('generic Illinois research'), undefined);
  assert.equal(routeIlAsk('California contractor moving to Illinois'), undefined);
});

test('exact identifiers are not intercepted by generic Illinois routing', () => {
  const crd = buildNetworkAskPlan('Research adviser CRD 105958 in Illinois');
  assert.equal(crd.parsed.intent, 'identifier');
  assert.equal(crd.parsed.identifier?.family.id, 'crd');
  const investor = crd.hubs.find((h) => h.hubId === 'investor');
  assert.ok(investor);
  assert.notEqual(investor?.mode, 'count');
  const usdot = buildNetworkAskPlan('Find USDOT 3244649 in Illinois');
  assert.equal(usdot.parsed.intent, 'identifier');
  assert.equal(usdot.parsed.identifier?.family.id, 'usdot');
  const move = usdot.hubs.find((h) => h.hubId === 'move');
  assert.ok(move);
  assert.doesNotMatch(move?.destination ?? '', /\/illinois$/);
});

test('ranking remains unsupported; search-only mover count is not zero', () => {
  const best = buildNetworkAskPlan('best contractor in Illinois');
  const contractor = best.hubs.find((h) => h.hubId === 'contractor');
  assert.notEqual(contractor?.mode, 'count');
  assert.match(`${contractor?.judgmentNote ?? ''} ${contractor?.whatItCanAnswer ?? ''} ${IL_SEMANTIC_GUARDRAILS.no_ranking}`, /rank/i);
  assert.match(IL_SEMANTIC_GUARDRAILS.move_roster_search_only, /unknown, not zero/);
  assert.doesNotMatch(gateway, />0</);
  const licensed = buildNetworkAskPlan('How many movers are licensed in Illinois?');
  const move = licensed.hubs.find((h) => h.hubId === 'move');
  assert.ok(move);
  assert.match(`${move?.reason ?? ''} ${move?.whatItCanAnswer ?? ''} ${IL_SEMANTIC_GUARDRAILS.move_roster_search_only}`, /unknown, not zero|search/i);
});

test('Chicago names stay statewide and do not invent local routes', () => {
  assert.equal(queryLooksLikeIllinois('contractor in Chicago'), true);
  assert.equal(routeIlAsk('contractor in Chicago')?.hubId, 'contractor');
  assert.equal(existsSync('app/illinois/chicago'), false);
  assert.equal(existsSync('app/illinois/cook'), false);
  assert.doesNotMatch(sitemap, /\/illinois\/chicago/);
  assert.match(IL_SEMANTIC_GUARDRAILS.chicago_deferred, /not published/i);
  assert.equal(gaps.chicago_cook_phase.status, 'NOT_STARTED');
  const parsed = parseNetworkAsk('roofing contractors in Chicago');
  assert.equal(parsed.geography?.stateCode, 'IL');
  assert.match(parsed.geography?.meaning ?? '', /not a local Ask route|statewide|Chicago/i);
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/illinois'), false);
  assert.doesNotMatch(sitemap, /\/claim\/illinois/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
});

test('state page inventory adds Illinois once', () => {
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'IL').length, 1);
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug, 'illinois');
  assert.equal(ASK_NETWORK_STATES.length, 10);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/illinois'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/illinois/chicago'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Illinois network gateway/);
  assert.equal(IL_NETWORK_CONTRACT, 'ath-il-network-release-v1');
  assert.equal(IL_PUBLICATION_MANIFEST.version, IL_NETWORK_CONTRACT);
  assert.match(IL_FINGERPRINT_METHOD, /not recomputed from HTML/i);
});

test('accepted specialist fingerprints are the certified Illinois contracts', () => {
  assert.equal(ACCEPTED_IL_SPECIALIST_RELEASES.contractor.fingerprint, 'a9f63e7625d25fd64e4fe95b15f558a49fc719376154be481fdd062042dd0235');
  assert.equal(ACCEPTED_IL_SPECIALIST_RELEASES.move.fingerprint, 'b484ba81488f813b43698ccb8a034afc645809be03662f101a951020839c388d');
  assert.equal(ACCEPTED_IL_SPECIALIST_RELEASES.senior.fingerprint, '20e48b6f8a24c2f3acb0ea208961a93e5c10a3c858d5f42f81454059dea85bac');
  assert.equal(ACCEPTED_IL_SPECIALIST_RELEASES.lender.fingerprint, '06c7f10b4756076b57da54c64306fb50fc9666a379855d1e262591652a9f70a4');
  assert.equal(ACCEPTED_IL_SPECIALIST_RELEASES.insurance.fingerprint, '3085ccfe7ec30c038fafcfb3e70a11609eeba91a9918c9efe14ceb7f0ef634aa');
  assert.equal(ACCEPTED_IL_SPECIALIST_RELEASES.investor.fingerprint, '997728ec50c9a913a64283b7a10810440c1e0b88e7fae03a91df58df3997534d');
});

test('release gate fails on modified fixtures', () => {
  const goodPage = {
    hub_id: 'move',
    url: 'https://www.movetrusthub.com/illinois',
    http_status: 200,
    canonical: 'https://www.movetrusthub.com/illinois',
    robots: 'index, follow',
    x_robots_tag: null,
    final_url: 'https://www.movetrusthub.com/illinois',
    sso: false,
    headline_ok: true,
    intended_intelligence_page: true,
    not_noindex: true,
  };
  const expected = ACCEPTED_IL_SPECIALIST_RELEASES.move.canonical_state_url;
  assert.equal(evaluateIlPageEvidence(goodPage, expected).ok, true);
  assert.equal(evaluateIlPageEvidence({ ...goodPage, canonical: 'https://www.otherexample.com/illinois' }, expected).ok, false);
  assert.equal(evaluateIlPageEvidence({ ...goodPage, sso: true, final_url: 'https://vercel.com/login' }, expected).ok, false);
  assert.equal(evaluateIlPageEvidence({ ...goodPage, robots: 'noindex, follow' }, expected).ok, false);
  assert.equal(evaluateIlPageEvidence({ ...goodPage, http_status: 404 }, expected).ok, false);

  const hubs = structuredClone(IL_PUBLICATION_MANIFEST.hubs);
  assert.equal(ilSixHubIdsComplete(hubs), true);
  assert.equal(ilReleaseGatePassed(IL_PUBLICATION_MANIFEST, structuredClone(IL_VERIFICATION)), true);
  const missingHub = { ...IL_PUBLICATION_MANIFEST, hubs: hubs.filter((h) => h.hub_id !== 'insurance') };
  assert.equal(ilReleaseGatePassed(missingHub, IL_VERIFICATION), false);
  const wrongFingerprint = structuredClone(IL_PUBLICATION_MANIFEST);
  wrongFingerprint.hubs[0]!.fingerprint = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.equal(ilReleaseGatePassed(wrongFingerprint, IL_VERIFICATION), false);
});

test('research route still executes for identifier questions', () => {
  const route = buildAskResearchRoute('Research adviser CRD 105958.');
  assert.equal(route.plan.primaryHub, 'investor');
});
