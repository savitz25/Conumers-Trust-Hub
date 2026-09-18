import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCEPTED_NC_SPECIALIST_RELEASES,
  NC_FINGERPRINT_METHOD,
  NC_NETWORK_CONTRACT,
  NC_PUBLICATION_FINGERPRINT,
  NC_PUBLICATION_MANIFEST,
  NC_SEMANTIC_GUARDRAILS,
  NC_VERIFICATION,
  classifyNcHub,
  detectNcCity,
  detectRequestedInsuranceProducts,
  evaluateNcPageEvidence,
  ncPublicationSemanticFingerprint,
  ncReleaseGatePassed,
  ncSixHubIdsComplete,
  listNcHubs,
  queryLooksLikeNorthCarolina,
  routeNcAsk,
} from './nc-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/north-carolina/page.tsx', 'utf8');
const gateway = readFileSync('components/north-carolina-network-gateway.tsx', 'utf8');
const footer = readFileSync('components/footer.tsx', 'utf8');
const places = readFileSync('app/places/page.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/north-carolina/state-closeout.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/north-carolina/gap-register.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/north-carolina-network-release.json', 'utf8'));

test('six required specialist North Carolina pages, unique hub IDs, canonical URLs', () => {
  assert.equal(listNcHubs().length, 6);
  assert.equal(ncSixHubIdsComplete(), true);
  const ids = listNcHubs().map((h) => h.hub_id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(ncSixHubIdsComplete([...listNcHubs(), listNcHubs()[0]!]), false);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listNcHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/north-carolina$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
    assert.match(row!.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('release gate validates verification evidence, not an unexplained constant', () => {
  assert.equal(ncReleaseGatePassed(), true);
  assert.equal(NC_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(NC_VERIFICATION.missing, []);
  assert.equal(NC_VERIFICATION.hubs.length, 6);
  for (const hub of NC_VERIFICATION.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
    const pageCheck = evaluateNcPageEvidence(hub, hub.expected_url ?? hub.url ?? '');
    assert.equal(pageCheck.ok, true);
  }
  assert.equal(NC_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(NC_PUBLICATION_MANIFEST.ask_production, null);
});

test('Ask /north-carolina canonical, indexability follows gate, no Charlotte/Raleigh routes', () => {
  assert.equal(NC_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/north-carolina');
  assert.equal(NC_PUBLICATION_MANIFEST.ask_path, '/north-carolina');
  assert.equal(NC_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(NC_PUBLICATION_MANIFEST.hardcoded_charlotte_routes, false);
  assert.equal(NC_PUBLICATION_MANIFEST.hardcoded_raleigh_routes, false);
  assert.equal(NC_PUBLICATION_MANIFEST.north_carolina_local_phase, 'NO');
  assert.equal(NC_PUBLICATION_MANIFEST.north_carolina_local_phase_status, 'NOT_STARTED');
  assert.equal(NC_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(NC_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /\/north-carolina/);
  assert.doesNotMatch(sitemap, /\/north-carolina\/charlotte/);
  assert.doesNotMatch(sitemap, /\/north-carolina\/raleigh/);
  assert.match(footer, /ncReleaseGatePassed/);
  assert.match(footer, /\/north-carolina/);
  assert.match(places, /Open North Carolina network research/);
  assert.doesNotMatch(sitemap, /\/north-carolina\/durham/);
  assert.doesNotMatch(sitemap, /\/north-carolina\/mecklenburg/);
  assert.equal(existsSync('app/north-carolina/page.tsx'), true);
  assert.deepEqual(readdirSync('app/north-carolina').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
  assert.match(gateway, /intelligence_strip/);
  assert.match(gateway, /hub.canonical_state_url/);
  assert.match(NC_PUBLICATION_MANIFEST.intelligence_strip[0]!.display, /search-only/i);
  assert.match(NC_PUBLICATION_MANIFEST.intelligence_strip[1]!.display, /362 NCUC C-number/);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(NC_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(NC_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(NC_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(NC_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
});

test('source-native expansion ledgers keep North Carolina grains separate', () => {
  const ledgers = NC_PUBLICATION_MANIFEST.hub_expansion_ledgers;
  assert.equal(ledgers.contractor.NCLBGC_STATEWIDE_CENSUS, 'OPEN_SEARCH_ONLY');
  assert.equal(ledgers.contractor.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledgers.move.DISTINCT_C_NUMBERS, 362);
  assert.equal(ledgers.move.EXACT_NCUC_TO_USDOT_BRIDGES, 0);
  assert.equal(ledgers.senior.ADULT_CARE_HOME_LICENSES, 568);
  assert.equal(ledgers.senior.EXACT_STATE_TO_CMS_BRIDGES, 0);
  assert.equal(ledgers.lender.HMDA_2025_NC_COUNTY_APPLICATIONS, 484454);
  assert.equal(ledgers.lender.NC_MORTGAGE_LENDER_ROWS, 640);
  assert.equal(ledgers.insurance.NCDOI_LICENSING_ACTION_ROWS, 2874);
  assert.equal(ledgers.insurance.AGENCY_ROSTER, 'OPEN_SEARCH_ONLY');
  assert.equal(ledgers.investor.SOS_IA_FIRM_CRDS, 687);
  assert.equal(ledgers.investor.IAPD_APPROVED_CURRENT_STATE_IA_FIRMS, 701);
});

test('semantic fingerprint excludes volatile clocks and changes on nested grain mutation', () => {
  const first = ncPublicationSemanticFingerprint();
  const second = ncPublicationSemanticFingerprint();
  assert.equal(first, second);
  assert.equal(first, NC_PUBLICATION_FINGERPRINT);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(closeout.publication_manifest_fingerprint, first);
  assert.equal(release.ask_fingerprint, first);
  const clockShift = structuredClone(NC_PUBLICATION_MANIFEST) as typeof NC_PUBLICATION_MANIFEST;
  clockShift.release_gate.verified_at = '2099-01-01T00:00:00.000Z';
  assert.equal(ncPublicationSemanticFingerprint(clockShift), first);
  const mutated = structuredClone(NC_PUBLICATION_MANIFEST) as typeof NC_PUBLICATION_MANIFEST;
  mutated.hub_expansion_ledgers.lender.HMDA_2025_NC_COUNTY_APPLICATIONS = 484455;
  assert.notEqual(ncPublicationSemanticFingerprint(mutated), first);
});

test('North Carolina routing: ticket queries per hub plus ranking and identifier', () => {
  const cases: Array<[string, string]> = [
    ['contractors North Carolina', 'contractor'],
    ['licensed contractor North Carolina', 'contractor'],
    ['general contractor North Carolina', 'contractor'],
    ['roofing contractor North Carolina', 'contractor'],
    ['contractor disciplinary action North Carolina', 'contractor'],
    ['movers North Carolina', 'move'],
    ['NCUC mover North Carolina', 'move'],
    ['interstate mover North Carolina', 'move'],
    ['moving rates North Carolina', 'move'],
    ['adult care homes North Carolina', 'senior'],
    ['family care homes North Carolina', 'senior'],
    ['assisted living North Carolina', 'senior'],
    ['nursing homes North Carolina', 'senior'],
    ['home health North Carolina', 'senior'],
    ['hospice North Carolina', 'senior'],
    ['PACE North Carolina', 'senior'],
    ['CCRC North Carolina', 'senior'],
    ['mortgage lenders North Carolina', 'lender'],
    ['mortgage broker North Carolina', 'lender'],
    ['mortgage servicer North Carolina', 'lender'],
    ['MOSR North Carolina', 'lender'],
    ['HMDA applications North Carolina 2025', 'lender'],
    ['mortgage complaints North Carolina', 'lender'],
    ['insurance companies North Carolina', 'insurance'],
    ['insurance agencies North Carolina', 'insurance'],
    ['homeowners insurance agencies North Carolina', 'insurance'],
    ['auto insurance agencies North Carolina', 'insurance'],
    ['insurance licensing actions North Carolina', 'insurance'],
    ['investment advisers North Carolina', 'investor'],
    ['NC registered investment adviser', 'investor'],
    ['ERA North Carolina', 'investor'],
    ['notice filing North Carolina', 'investor'],
    ['financial adviser North Carolina', 'investor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeNcAsk(question)?.hubId, hub, question);
  }
  assert.equal(classifyNcHub('generic North Carolina research'), undefined);
  assert.equal(routeNcAsk('Pennsylvania contractor moving to North Carolina'), undefined);
});

test('SQA-009: homeowners/auto agency queries do not become generic NC agencies', () => {
  const homeowners = routeNcAsk('homeowners insurance agencies North Carolina');
  const auto = routeNcAsk('auto insurance agencies North Carolina');
  const agencies = routeNcAsk('insurance agencies North Carolina');
  assert.equal(homeowners?.hubId, 'insurance');
  assert.equal(auto?.hubId, 'insurance');
  assert.equal(agencies?.hubId, 'insurance');
  assert.deepEqual(homeowners?.requestedProduct, ['homeowners']);
  assert.deepEqual(auto?.requestedProduct, ['auto']);
  assert.equal(agencies?.requestedProduct, undefined);
  assert.notEqual(homeowners?.caveat, agencies?.caveat);
  assert.notEqual(auto?.caveat, agencies?.caveat);
  assert.match(homeowners?.caveat ?? '', /homeowners/);
  assert.deepEqual(detectRequestedInsuranceProducts('homeowners insurance agencies North Carolina'), ['homeowners']);
  const dest = 'https://www.insurancetrusthub.com/north-carolina';
  assert.equal(homeowners?.destination, dest);
  assert.equal(auto?.destination, dest);
  assert.equal(agencies?.destination, dest);
});

test('exact identifiers are not intercepted by generic North Carolina routing', () => {
  const crd = buildNetworkAskPlan('Research adviser CRD 105958 in North Carolina');
  assert.equal(crd.parsed.intent, 'identifier');
  assert.equal(crd.parsed.identifier?.family.id, 'crd');
  const naic = buildNetworkAskPlan('NAIC 13735 North Carolina');
  assert.equal(naic.parsed.intent, 'identifier');
  assert.equal(naic.parsed.identifier?.family.id, 'naic_company_code');
  const npn = buildNetworkAskPlan('NPN 1234567 North Carolina');
  assert.equal(npn.parsed.intent, 'identifier');
  assert.equal(npn.parsed.identifier?.family.id, 'npn');
  const nmls = buildNetworkAskPlan('NMLS 3030 North Carolina');
  assert.equal(nmls.parsed.intent, 'identifier');
  assert.equal(nmls.parsed.identifier?.family.id, 'nmls');
});

test('ranking remains unsupported; no combined provider total', () => {
  const best = buildNetworkAskPlan('best provider in North Carolina');
  assert.ok(best);
  assert.match(NC_SEMANTIC_GUARDRAILS.no_ranking, /rank/i);
  const howMany = buildNetworkAskPlan('how many providers are in North Carolina');
  assert.ok(howMany);
  assert.equal(NC_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
});

test('Charlotte names stay statewide and do not invent local routes', () => {
  assert.equal(queryLooksLikeNorthCarolina('contractor in Charlotte'), true);
  assert.equal(routeNcAsk('contractor in Charlotte')?.hubId, 'contractor');
  assert.equal(existsSync('app/north-carolina/charlotte'), false);
  assert.equal(existsSync('app/north-carolina/raleigh'), false);
  assert.doesNotMatch(sitemap, /\/north-carolina\/charlotte/);
  assert.match(NC_SEMANTIC_GUARDRAILS.charlotte_deferred, /not published/i);
  assert.equal(gaps.charlotte_raleigh_phase.status, 'NOT_STARTED');
  const parsed = parseNetworkAsk('roofing contractors in Charlotte');
  assert.equal(parsed.geography?.stateCode, 'NC');
  assert.match(parsed.geography?.meaning ?? '', /not a local Ask route|statewide|Charlotte/i);
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/north-carolina'), false);
  assert.doesNotMatch(sitemap, /\/claim\/north-carolina/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
  assert.equal(NC_PUBLICATION_MANIFEST.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(NC_PUBLICATION_MANIFEST.expansion_ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
});

test('state page inventory adds North Carolina once', () => {
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'NC').length, 1);
  assert.ok(ASK_NETWORK_STATES.some((state) => state.slug === 'north-carolina'));
  assert.equal(ASK_NETWORK_STATES.length, 14);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/north-carolina'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/north-carolina/charlotte'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /North Carolina network gateway/);
  assert.equal(NC_NETWORK_CONTRACT, 'ath-nc-network-release-v1');
  assert.equal(NC_PUBLICATION_MANIFEST.version, NC_NETWORK_CONTRACT);
  assert.match(NC_FINGERPRINT_METHOD, /not recomputed from HTML/i);
  assert.equal(detectNcCity('Charlotte North Carolina'), 'Charlotte');
});

test('accepted specialist fingerprints are the certified North Carolina contracts', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    const accepted = ACCEPTED_NC_SPECIALIST_RELEASES[id];
    const hub = listNcHubs().find((h) => h.hub_id === id)!;
    assert.equal(hub.fingerprint, accepted.fingerprint);
    assert.equal(hub.snapshot_version, accepted.snapshot_version);
    assert.equal(hub.certified_release_sha, accepted.certified_release_sha);
  }
});

test('North Carolina files have no copied Pennsylvania/Oregon/Illinois specialist residue', () => {
  const files = [
    'lib/network/nc-network.ts',
    'components/north-carolina-network-gateway.tsx',
    'app/north-carolina/page.tsx',
    'data/network/north-carolina-publication-manifest.json',
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /HICPA|DoBS|PHFA|Utility Code|PA PUC|PID licensed/);
    assert.doesNotMatch(text, /444,887|1,202 exact PA|864 approved Pennsylvania/);
    assert.doesNotMatch(text, /Philadelphia|Pittsburgh|IDFPR|ILCC|Portland|Multnomah/);
  }
});
