import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCEPTED_PA_SPECIALIST_RELEASES,
  PA_FINGERPRINT_METHOD,
  PA_NETWORK_CONTRACT,
  PA_PUBLICATION_FINGERPRINT,
  PA_PUBLICATION_MANIFEST,
  PA_SEMANTIC_GUARDRAILS,
  PA_VERIFICATION,
  classifyPaHub,
  detectPaCity,
  detectRequestedInsuranceProducts,
  evaluatePaPageEvidence,
  paPublicationSemanticFingerprint,
  paReleaseGatePassed,
  paSixHubIdsComplete,
  listPaHubs,
  queryLooksLikePennsylvania,
  routePaAsk,
} from './pa-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/pennsylvania/page.tsx', 'utf8');
const gateway = readFileSync('components/pennsylvania-network-gateway.tsx', 'utf8');
const footer = readFileSync('components/footer.tsx', 'utf8');
const places = readFileSync('app/places/page.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/pennsylvania/state-closeout.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/pennsylvania/gap-register.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/pennsylvania-network-release.json', 'utf8'));

test('six required specialist Pennsylvania pages, unique hub IDs, canonical URLs', () => {
  assert.equal(listPaHubs().length, 6);
  assert.equal(paSixHubIdsComplete(), true);
  const ids = listPaHubs().map((h) => h.hub_id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(paSixHubIdsComplete([...listPaHubs(), listPaHubs()[0]!]), false);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listPaHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/pennsylvania$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
    assert.match(row!.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('release gate validates verification evidence, not an unexplained constant', () => {
  assert.equal(paReleaseGatePassed(), true);
  assert.equal(PA_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(PA_VERIFICATION.missing, []);
  assert.equal(PA_VERIFICATION.hubs.length, 6);
  for (const hub of PA_VERIFICATION.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
    const pageCheck = evaluatePaPageEvidence(hub, hub.expected_url ?? hub.url ?? '');
    assert.equal(pageCheck.ok, true);
  }
  assert.equal(PA_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(PA_PUBLICATION_MANIFEST.ask_production, null);
});

test('Ask /pennsylvania canonical, indexability follows gate, no Philadelphia/Pittsburgh routes', () => {
  assert.equal(PA_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/pennsylvania');
  assert.equal(PA_PUBLICATION_MANIFEST.ask_path, '/pennsylvania');
  assert.equal(PA_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(PA_PUBLICATION_MANIFEST.hardcoded_philadelphia_routes, false);
  assert.equal(PA_PUBLICATION_MANIFEST.hardcoded_pittsburgh_routes, false);
  assert.equal(PA_PUBLICATION_MANIFEST.pennsylvania_local_phase, 'NO');
  assert.equal(PA_PUBLICATION_MANIFEST.pennsylvania_local_phase_status, 'NOT_STARTED');
  assert.equal(PA_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(PA_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /askStateSitemapEntries/);
  assert.doesNotMatch(sitemap, /\/pennsylvania\/philadelphia/);
  assert.doesNotMatch(sitemap, /\/pennsylvania\/pittsburgh/);
  assert.match(footer, /askStateFooterLinks/);
  assert.match(footer, /askStateFooterLinks/);
  assert.match(places, /Open \${item.label} network research/);
  assert.doesNotMatch(sitemap, /\/pennsylvania\/allegheny/);
  assert.doesNotMatch(sitemap, /\/pennsylvania\/montgomery/);
  assert.equal(existsSync('app/pennsylvania/page.tsx'), true);
  assert.deepEqual(readdirSync('app/pennsylvania').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
  assert.match(gateway, /intelligence_strip/);
  assert.match(gateway, /hub.canonical_state_url/);
  assert.match(PA_PUBLICATION_MANIFEST.intelligence_strip[0]!.display, /283 asbestos/);
  assert.match(PA_PUBLICATION_MANIFEST.intelligence_strip[1]!.display, /267 distinct PA PUC Utility Codes/);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(PA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(PA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(PA_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(PA_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
});

test('source-native expansion ledgers keep Pennsylvania grains separate', () => {
  const ledgers = PA_PUBLICATION_MANIFEST.hub_expansion_ledgers;
  assert.equal(ledgers.contractor.DISTINCT_ASBESTOS_CERT_IDS, 283);
  assert.equal(ledgers.contractor.HICPA_COUNTS, null);
  assert.equal(ledgers.contractor.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledgers.move.DISTINCT_UTILITY_CODES, 267);
  assert.equal(ledgers.move.EXACT_PUC_TO_USDOT_CROSSWALKS, 0);
  assert.equal(ledgers.senior.EXACT_STATE_TO_CMS_BRIDGES, 1202);
  assert.equal(ledgers.senior.DOH_NURSING_HOME_ROWS, 659);
  assert.equal(ledgers.lender.HMDA_2025_PA_COUNTY_APPLICATIONS, 444887);
  assert.equal(ledgers.lender.PA_NMLS_LENDER_ROSTER, 'OPEN_SEARCH_ONLY');
  assert.equal(ledgers.insurance.PID_LICENSED_COMPANY_DISTINCT_NAIC, 1722);
  assert.equal(ledgers.insurance.PA_AGENCY_ROSTER, 'OPEN_SEARCH_ONLY');
  assert.equal(ledgers.investor.PA_STATE_IA_APPROVED_CRDS, 864);
  assert.equal(ledgers.investor.PA_STATE_ERA_ACTIVE_CRDS, 99);
  assert.equal(ledgers.investor.PA_FEDERAL_NOTICE_FILED_CRDS, 3411);
  assert.equal(ledgers.investor.PA_PRINCIPAL_OFFICE_OVERLAY, 623);
});

test('semantic fingerprint excludes volatile clocks and changes on nested grain mutation', () => {
  const first = paPublicationSemanticFingerprint();
  const second = paPublicationSemanticFingerprint();
  assert.equal(first, second);
  assert.equal(first, PA_PUBLICATION_FINGERPRINT);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(closeout.publication_manifest_fingerprint, first);
  assert.equal(release.ask_fingerprint, first);
  const clockShift = structuredClone(PA_PUBLICATION_MANIFEST) as typeof PA_PUBLICATION_MANIFEST;
  clockShift.release_gate.verified_at = '2099-01-01T00:00:00.000Z';
  assert.equal(paPublicationSemanticFingerprint(clockShift), first);
  const mutated = structuredClone(PA_PUBLICATION_MANIFEST) as typeof PA_PUBLICATION_MANIFEST;
  mutated.hub_expansion_ledgers.lender.HMDA_2025_PA_COUNTY_APPLICATIONS = 444888;
  assert.notEqual(paPublicationSemanticFingerprint(mutated), first);
});

test('Pennsylvania routing: ticket queries per hub plus ranking and identifier', () => {
  const cases: Array<[string, string]> = [
    ['contractors Pennsylvania', 'contractor'],
    ['licensed contractor Pennsylvania', 'contractor'],
    ['home improvement contractor Pennsylvania', 'contractor'],
    ['asbestos contractor Pennsylvania', 'contractor'],
    ['lead contractor Pennsylvania', 'contractor'],
    ['debarred contractor Pennsylvania', 'contractor'],
    ['movers Pennsylvania', 'move'],
    ['household goods movers Pennsylvania', 'move'],
    ['PA PUC mover Pennsylvania', 'move'],
    ['interstate mover Pennsylvania', 'move'],
    ['nursing homes Pennsylvania', 'senior'],
    ['personal care homes Pennsylvania', 'senior'],
    ['assisted living Pennsylvania', 'senior'],
    ['home health Pennsylvania', 'senior'],
    ['home care Pennsylvania', 'senior'],
    ['hospice Pennsylvania', 'senior'],
    ['mortgage lenders Pennsylvania', 'lender'],
    ['licensed mortgage lender Pennsylvania', 'lender'],
    ['HMDA applications Pennsylvania 2025', 'lender'],
    ['mortgage complaints Pennsylvania', 'lender'],
    ['insurance companies Pennsylvania', 'insurance'],
    ['insurance agencies Pennsylvania', 'insurance'],
    ['homeowners insurance agencies Pennsylvania', 'insurance'],
    ['auto insurance agencies Pennsylvania', 'insurance'],
    ['insurance complaints Pennsylvania', 'insurance'],
    ['investment advisers Pennsylvania', 'investor'],
    ['state registered investment adviser Pennsylvania', 'investor'],
    ['ERA Pennsylvania', 'investor'],
    ['notice filing Pennsylvania adviser', 'investor'],
    ['financial adviser Pennsylvania', 'investor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routePaAsk(question)?.hubId, hub, question);
  }
  assert.equal(classifyPaHub('generic Pennsylvania research'), undefined);
  assert.equal(routePaAsk('California contractor moving to Pennsylvania'), undefined);
});

test('SQA-009: homeowners/auto agency queries do not become generic PA agencies', () => {
  const homeowners = routePaAsk('homeowners insurance agencies Pennsylvania');
  const auto = routePaAsk('auto insurance agencies Pennsylvania');
  const agencies = routePaAsk('insurance agencies Pennsylvania');
  assert.equal(homeowners?.hubId, 'insurance');
  assert.equal(auto?.hubId, 'insurance');
  assert.equal(agencies?.hubId, 'insurance');
  assert.deepEqual(homeowners?.requestedProduct, ['homeowners']);
  assert.deepEqual(auto?.requestedProduct, ['auto']);
  assert.equal(agencies?.requestedProduct, undefined);
  assert.notEqual(homeowners?.caveat, agencies?.caveat);
  assert.notEqual(auto?.caveat, agencies?.caveat);
  assert.match(homeowners?.caveat ?? '', /homeowners/);
  assert.deepEqual(detectRequestedInsuranceProducts('homeowners insurance agencies Pennsylvania'), ['homeowners']);
  const dest = 'https://www.insurancetrusthub.com/pennsylvania';
  assert.equal(homeowners?.destination, dest);
  assert.equal(auto?.destination, dest);
  assert.equal(agencies?.destination, dest);
});

test('exact identifiers are not intercepted by generic Pennsylvania routing', () => {
  const crd = buildNetworkAskPlan('Research adviser CRD 105958 in Pennsylvania');
  assert.equal(crd.parsed.intent, 'identifier');
  assert.equal(crd.parsed.identifier?.family.id, 'crd');
  const naic = buildNetworkAskPlan('NAIC 13735 Pennsylvania');
  assert.equal(naic.parsed.intent, 'identifier');
  assert.equal(naic.parsed.identifier?.family.id, 'naic_company_code');
  const npn = buildNetworkAskPlan('NPN 1234567 Pennsylvania');
  assert.equal(npn.parsed.intent, 'identifier');
  assert.equal(npn.parsed.identifier?.family.id, 'npn');
});

test('ranking remains unsupported; no combined provider total', () => {
  const best = buildNetworkAskPlan('best provider in Pennsylvania');
  assert.ok(best);
  assert.match(PA_SEMANTIC_GUARDRAILS.no_ranking, /rank/i);
  const howMany = buildNetworkAskPlan('how many providers are in Pennsylvania');
  assert.ok(howMany);
  assert.equal(PA_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
});

test('Philadelphia names stay statewide and do not invent local routes', () => {
  assert.equal(queryLooksLikePennsylvania('contractor in Philadelphia'), true);
  assert.equal(routePaAsk('contractor in Philadelphia')?.hubId, 'contractor');
  assert.equal(existsSync('app/pennsylvania/philadelphia'), false);
  assert.equal(existsSync('app/pennsylvania/pittsburgh'), false);
  assert.doesNotMatch(sitemap, /\/pennsylvania\/philadelphia/);
  assert.match(PA_SEMANTIC_GUARDRAILS.philadelphia_deferred, /not published/i);
  assert.equal(gaps.philadelphia_pittsburgh_phase.status, 'NOT_STARTED');
  const parsed = parseNetworkAsk('roofing contractors in Philadelphia');
  assert.equal(parsed.geography?.stateCode, 'PA');
  assert.match(parsed.geography?.meaning ?? '', /not a local Ask route|statewide|Philadelphia/i);
});

test('the English gerund reading is not a standalone Pennsylvania geography signal', () => {
  assert.equal(queryLooksLikePennsylvania('reading reviews'), false);
  assert.equal(queryLooksLikePennsylvania('reading insurance'), false);
  assert.equal(routePaAsk('reading insurance'), undefined);
  assert.equal(queryLooksLikePennsylvania('Reading Pennsylvania'), true);
  assert.equal(detectPaCity('Reading Pennsylvania'), 'Reading');
  assert.equal(routePaAsk('insurance companies Pennsylvania')?.hubId, 'insurance');
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/pennsylvania'), false);
  assert.doesNotMatch(sitemap, /\/claim\/pennsylvania/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
  assert.equal(PA_PUBLICATION_MANIFEST.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(PA_PUBLICATION_MANIFEST.expansion_ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
});

test('state page inventory adds Pennsylvania once', () => {
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'PA').length, 1);
  assert.ok(ASK_NETWORK_STATES.some((state) => state.slug === 'pennsylvania'));
  assert.equal(ASK_NETWORK_STATES.length, 18);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/pennsylvania'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/pennsylvania/philadelphia'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Pennsylvania network gateway/);
  assert.equal(PA_NETWORK_CONTRACT, 'ath-pa-network-release-v1');
  assert.equal(PA_PUBLICATION_MANIFEST.version, PA_NETWORK_CONTRACT);
  assert.match(PA_FINGERPRINT_METHOD, /not recomputed from HTML/i);
});

test('accepted specialist fingerprints are the certified Pennsylvania contracts', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    const accepted = ACCEPTED_PA_SPECIALIST_RELEASES[id];
    const hub = listPaHubs().find((h) => h.hub_id === id)!;
    assert.equal(hub.fingerprint, accepted.fingerprint);
    assert.equal(hub.snapshot_version, accepted.snapshot_version);
    assert.equal(hub.certified_release_sha, accepted.certified_release_sha);
  }
});

test('Pennsylvania files have no copied Oregon/Illinois/NY/VA/CO specialist residue', () => {
  const files = [
    'lib/network/pa-network.ts',
    'components/pennsylvania-network-gateway.tsx',
    'app/pennsylvania/page.tsx',
    'data/network/pennsylvania-publication-manifest.json',
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /IDFPR|IDOI|ILCC|Director.?s Order|Cook County|Chicago roofing/);
    assert.doesNotMatch(text, /394,488|2,896 IDOI|4,675 active Illinois/);
    assert.doesNotMatch(text, /45,501 distinct CCB|113 ODOT|146,902 HMDA 2025 applications for Oregon/);
    assert.doesNotMatch(text, /\bPortland\b|\bMultnomah\b|\bDenver\b|\bNYC\b/);
  }
});
