import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ACCEPTED_OH_SPECIALIST_RELEASES,
  OH_FINGERPRINT_METHOD,
  OH_NETWORK_CONTRACT,
  OH_PUBLICATION_FINGERPRINT,
  OH_PUBLICATION_MANIFEST,
  OH_SEMANTIC_GUARDRAILS,
  OH_VERIFICATION,
  classifyOhHub,
  detectOhCity,
  detectRequestedOhInsuranceProducts,
  evaluateOhPageEvidence,
  ohPublicationSemanticFingerprint,
  ohReleaseGatePassed,
  ohSixHubIdsComplete,
  listOhHubs,
  queryLooksLikeOhio,
  routeOhAsk,
} from './oh-network.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { SPECIALIST_HUB_IDS } from './registry.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { listPlaceLensIndex } from './place-lens.ts';
import { ASK_CONCIERGE_SYSTEM_PROMPT } from '../ai/system-prompt.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const page = readFileSync('app/ohio/page.tsx', 'utf8');
const gateway = readFileSync('components/ohio-network-gateway.tsx', 'utf8');
const footer = readFileSync('components/footer.tsx', 'utf8');
const places = readFileSync('app/places/page.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/ohio/state-closeout.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/ohio/gap-register.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/ohio-network-release.json', 'utf8'));

test('six required specialist Ohio pages, unique hub IDs, canonical URLs', () => {
  assert.equal(listOhHubs().length, 6);
  assert.equal(ohSixHubIdsComplete(), true);
  const ids = listOhHubs().map((h) => h.hub_id);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(ohSixHubIdsComplete([...listOhHubs(), listOhHubs()[0]!]), false);
  for (const id of SPECIALIST_HUB_IDS) {
    const row = listOhHubs().find((h) => h.hub_id === id);
    assert.ok(row, `missing hub ${id}`);
    assert.match(row!.canonical_state_url, /\/ohio$/);
    assert.equal(row!.publication_status, 'live');
    assert.ok((row!.verified_facts.length ?? 0) >= 1);
    assert.ok((row!.routing_intents.length ?? 0) >= 2);
    assert.match(row!.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('release gate validates verification evidence, not an unexplained constant', () => {
  assert.equal(ohReleaseGatePassed(), true);
  assert.equal(OH_VERIFICATION.release_gate_passed, true);
  assert.deepEqual(OH_VERIFICATION.missing, []);
  assert.equal(OH_VERIFICATION.hubs.length, 6);
  for (const hub of OH_VERIFICATION.hubs) {
    assert.equal(hub.http_status, 200);
    assert.equal(hub.ok, true);
    assert.equal(hub.selfCanonical, true);
    assert.equal(hub.sso, false);
    const pageCheck = evaluateOhPageEvidence(hub, hub.expected_url ?? hub.url ?? '');
    assert.equal(pageCheck.ok, true);
  }
  assert.equal(OH_PUBLICATION_MANIFEST.status, 'ASK_PREVIEW_READY');
  assert.equal(OH_PUBLICATION_MANIFEST.ask_production, null);
});

test('Ask /ohio canonical, indexability follows gate, no Columbus/Cleveland routes', () => {
  assert.equal(OH_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/ohio');
  assert.equal(OH_PUBLICATION_MANIFEST.ask_path, '/ohio');
  assert.equal(OH_PUBLICATION_MANIFEST.hardcoded_county_routes, false);
  assert.equal(OH_PUBLICATION_MANIFEST.hardcoded_columbus_routes, false);
  assert.equal(OH_PUBLICATION_MANIFEST.hardcoded_cleveland_routes, false);
  assert.equal(OH_PUBLICATION_MANIFEST.ohio_local_phase, 'NO');
  assert.equal(OH_PUBLICATION_MANIFEST.ohio_local_phase_status, 'NOT_STARTED');
  assert.equal(OH_PUBLICATION_MANIFEST.trust_score, false);
  assert.equal(OH_PUBLICATION_MANIFEST.paid_ranking, false);
  assert.match(sitemap, /askStateSitemapEntries/);
  assert.doesNotMatch(sitemap, /\/ohio\/columbus/);
  assert.doesNotMatch(sitemap, /\/ohio\/cleveland/);
  assert.match(footer, /askStateFooterLinks/);
  assert.match(places, /Open \${item.label} network research/);
  assert.equal(existsSync('app/ohio/page.tsx'), true);
  assert.deepEqual(readdirSync('app/ohio').filter((name) => name !== 'page.tsx'), []);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /WebPage/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /Dataset/);
  assert.match(page, /ItemList/);
  assert.doesNotMatch(page, /aggregateRating/);
  assert.doesNotMatch(gateway, /Trust Score ranking|best provider|safest provider|vetted provider/i);
  assert.match(gateway, /intelligence_strip/);
  assert.match(gateway, /hub.canonical_state_url/);
  assert.match(OH_PUBLICATION_MANIFEST.intelligence_strip[0]!.display, /9,528/);
  assert.match(OH_PUBLICATION_MANIFEST.intelligence_strip[1]!.display, /searchable/i);
});

test('cross-hub total rejected; public research surfaces are a page grain of 7', () => {
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.value, 7);
  assert.match(OH_PUBLICATION_MANIFEST.expansion_ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation, /not a business/);
  assert.equal(closeout.oh_public_state_research_surfaces, 7);
  assert.equal(closeout.local_work_needed_now, 'NO');
  assert.equal(release.local_work_needed_now, 'NO');
});

test('source-native expansion ledgers keep Ohio grains separate', () => {
  const ledgers = OH_PUBLICATION_MANIFEST.hub_expansion_ledgers;
  assert.equal(ledgers.contractor.OCILB_DISTINCT_NUMERIC_LICENSE_IDENTITIES, 9528);
  assert.equal(ledgers.contractor.STATEWIDE_GC_CENSUS, 'NONE');
  assert.equal(ledgers.move.OH_PUCO_HHG_ROWS, null);
  assert.equal(ledgers.move.EXACT_PUCO_TO_USDOT_BRIDGES, 0);
  assert.equal(ledgers.senior.ODH_NURSING_HOME_LICENSES, 923);
  assert.equal(ledgers.senior.ODH_RCF_LICENSES, 812);
  assert.equal(ledgers.lender.HMDA_2025_OH_COUNTY_APPLICATIONS, 460825);
  assert.equal(ledgers.lender.OH_RMLA_COMPANY_ROWS, null);
  assert.equal(ledgers.insurance.OH_AUTHORIZED_COMPANY_ROWS, 1738);
  assert.equal(ledgers.insurance.HOMEOWNERS_LOA, 'UNSUPPORTED');
  assert.equal(ledgers.investor.IAPD_OH_APPROVED_CURRENT_STATE_IA_FIRMS, 784);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_RESEARCH_IDENTITIES_BY_HUB.contractor, 9528);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_RESEARCH_IDENTITIES_BY_HUB.move, 0);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_RESEARCH_IDENTITIES_BY_HUB.senior, 1735);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_RESEARCH_IDENTITIES_BY_HUB.lender, 0);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_RESEARCH_IDENTITIES_BY_HUB.insurance, 0);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.NET_NEW_STATE_RESEARCH_IDENTITIES_BY_HUB.investor, 784);
});

test('Ohio search acceptance matrix routes to the intended specialist', () => {
  const cases: Array<[string, string]> = [
    ['contractors Ohio', 'contractor'],
    ['licensed contractors Ohio', 'contractor'],
    ['general contractor Ohio', 'contractor'],
    ['electrical contractor Ohio', 'contractor'],
    ['HVAC contractor Ohio', 'contractor'],
    ['plumber Ohio', 'contractor'],
    ['fire alarm contractor Ohio', 'contractor'],
    ['movers Ohio', 'move'],
    ['licensed movers Ohio', 'move'],
    ['PUCO mover Ohio', 'move'],
    ['moving rates Ohio', 'move'],
    ['moving tariff Ohio', 'move'],
    ['interstate mover Ohio', 'move'],
    ['nursing homes Ohio', 'senior'],
    ['residential care facilities Ohio', 'senior'],
    ['assisted living Ohio', 'senior'],
    ['home health Ohio', 'senior'],
    ['hospice Ohio', 'senior'],
    ['mortgage lenders Ohio', 'lender'],
    ['RMLA Ohio', 'lender'],
    ['mortgage loan originator Ohio', 'lender'],
    ['HMDA applications Ohio 2025', 'lender'],
    ['mortgage complaints Ohio', 'lender'],
    ['OHFA lenders', 'lender'],
    ['insurance companies Ohio', 'insurance'],
    ['authorized insurance companies Ohio', 'insurance'],
    ['insurance agencies Ohio', 'insurance'],
    ['homeowners insurance agencies Ohio', 'insurance'],
    ['auto insurance agencies Ohio', 'insurance'],
    ['life insurance agencies Ohio', 'insurance'],
    ['health insurance agencies Ohio', 'insurance'],
    ['insurance administrative actions Ohio', 'insurance'],
    ['investment advisers Ohio', 'investor'],
    ['state registered investment adviser Ohio', 'investor'],
    ['IAR Ohio', 'investor'],
    ['ERA Ohio', 'investor'],
    ['notice filing Ohio', 'investor'],
    ['Ohio securities NOH', 'investor'],
    ['Ohio securities final orders', 'investor'],
  ];
  for (const [question, hub] of cases) {
    assert.equal(routeOhAsk(question)?.hubId, hub, question);
  }
  assert.equal(classifyOhHub('generic Ohio research'), undefined);
  assert.equal(routeOhAsk('North Carolina contractor moving to Ohio'), undefined);
});

test('SQA-009: homeowners/auto remain unsupported exact product LOA', () => {
  const homeowners = routeOhAsk('homeowners insurance agencies Ohio');
  const auto = routeOhAsk('auto insurance agencies Ohio');
  const life = routeOhAsk('life insurance agencies Ohio');
  const health = routeOhAsk('health insurance agencies Ohio');
  const agencies = routeOhAsk('insurance agencies Ohio');
  assert.equal(homeowners?.hubId, 'insurance');
  assert.equal(auto?.hubId, 'insurance');
  assert.match(homeowners?.caveat ?? '', /UNSUPPORTED/);
  assert.match(auto?.caveat ?? '', /UNSUPPORTED/);
  assert.match(homeowners?.caveat ?? '', /generic Ohio agencies/);
  assert.deepEqual(detectRequestedOhInsuranceProducts('homeowners insurance agencies Ohio'), ['homeowners']);
  assert.deepEqual(life?.requestedProduct, ['life']);
  assert.deepEqual(health?.requestedProduct, ['health']);
  assert.equal(agencies?.requestedProduct, undefined);
  const dest = 'https://www.insurancetrusthub.com/ohio';
  assert.equal(homeowners?.destination, dest);
  assert.equal(life?.destination, dest);
});

test('exact identifiers are not intercepted by generic Ohio routing', () => {
  const crd = buildNetworkAskPlan('Research adviser CRD 105958 in Ohio');
  assert.equal(crd.parsed.intent, 'identifier');
  assert.equal(crd.parsed.identifier?.family.id, 'crd');
  const naic = buildNetworkAskPlan('NAIC 13735 Ohio');
  assert.equal(naic.parsed.intent, 'identifier');
  assert.equal(naic.parsed.identifier?.family.id, 'naic_company_code');
  const npn = buildNetworkAskPlan('NPN 1234567 Ohio');
  assert.equal(npn.parsed.intent, 'identifier');
  assert.equal(npn.parsed.identifier?.family.id, 'npn');
  const nmls = buildNetworkAskPlan('NMLS 3030 Ohio');
  assert.equal(nmls.parsed.intent, 'identifier');
  assert.equal(nmls.parsed.identifier?.family.id, 'nmls');
});

test('ranking remains unsupported; no combined provider total', () => {
  const best = buildNetworkAskPlan('best provider in Ohio');
  assert.ok(best);
  assert.match(OH_SEMANTIC_GUARDRAILS.no_ranking, /rank/i);
  const howMany = buildNetworkAskPlan('how many providers are in Ohio');
  assert.ok(howMany);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.CROSS_HUB_RECORD_TOTAL.value, null);
});

test('Columbus names stay statewide and do not invent local routes', () => {
  assert.equal(queryLooksLikeOhio('contractor in Columbus'), true);
  assert.equal(routeOhAsk('contractor in Columbus')?.hubId, 'contractor');
  assert.equal(existsSync('app/ohio/columbus'), false);
  assert.equal(existsSync('app/ohio/cleveland'), false);
  assert.doesNotMatch(sitemap, /\/ohio\/columbus/);
  assert.match(OH_SEMANTIC_GUARDRAILS.columbus_deferred, /not published/i);
  assert.equal(gaps.columbus_cleveland_phase.status, 'NOT_STARTED');
  const parsed = parseNetworkAsk('roofing contractors in Columbus');
  assert.equal(parsed.geography?.stateCode, 'OH');
  assert.match(parsed.geography?.meaning ?? '', /not a local Ask route|statewide|Columbus/i);
});

test('claim eligibility surfaces are unchanged', () => {
  assert.equal(existsSync('app/promise/page.tsx'), true);
  assert.equal(existsSync('lib/customer/handoff.ts'), true);
  assert.equal(existsSync('app/api/customer'), true);
  assert.equal(existsSync('app/claim/layout.tsx'), true);
  assert.equal(existsSync('app/claim/ohio'), false);
  assert.doesNotMatch(sitemap, /\/claim\/ohio/);
  assert.doesNotMatch(page, /claim eligibility|claim this business/i);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(OH_PUBLICATION_MANIFEST.expansion_ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
});

test('state page inventory adds Ohio once', () => {
  assert.equal(ASK_NETWORK_STATES.filter((state) => state.code === 'OH').length, 1);
  assert.equal(ASK_NETWORK_STATES.at(-1)?.slug, 'nevada');
  assert.equal(ASK_NETWORK_STATES.length, 18);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/ohio'), true);
  assert.equal(listPlaceLensIndex().some((row) => row.href === '/ohio/columbus'), false);
  assert.match(ASK_CONCIERGE_SYSTEM_PROMPT, /Ohio network gateway/);
  assert.equal(OH_NETWORK_CONTRACT, 'ath-oh-network-release-v1');
  assert.equal(OH_PUBLICATION_MANIFEST.version, OH_NETWORK_CONTRACT);
  assert.match(OH_FINGERPRINT_METHOD, /not recomputed from HTML/i);
  assert.equal(detectOhCity('Columbus Ohio'), 'Columbus');
});

test('accepted specialist fingerprints are the certified Ohio contracts', () => {
  for (const id of SPECIALIST_HUB_IDS) {
    const accepted = ACCEPTED_OH_SPECIALIST_RELEASES[id];
    const hub = listOhHubs().find((h) => h.hub_id === id)!;
    assert.equal(hub.fingerprint, accepted.fingerprint);
    assert.equal(hub.snapshot_version, accepted.snapshot_version);
    assert.equal(hub.certified_release_sha, accepted.certified_release_sha);
  }
});

test('semantic fingerprint ignores timestamps and changes when a contract mutates', () => {
  const mutatedTime = structuredClone(OH_PUBLICATION_MANIFEST);
  mutatedTime.release_gate.verified_at = '2099-01-01T00:00:00.000Z';
  assert.equal(ohPublicationSemanticFingerprint(mutatedTime), OH_PUBLICATION_FINGERPRINT);
  const mutatedContract = structuredClone(OH_PUBLICATION_MANIFEST);
  mutatedContract.hubs[0]!.fingerprint = '0'.repeat(64);
  assert.notEqual(ohPublicationSemanticFingerprint(mutatedContract), OH_PUBLICATION_FINGERPRINT);
});

test('Ohio files have no copied North Carolina/Pennsylvania specialist residue', () => {
  const files = [
    'lib/network/oh-network.ts',
    'components/ohio-network-gateway.tsx',
    'app/ohio/page.tsx',
    'data/network/ohio-publication-manifest.json',
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /NCLBGC|NCCOB|NCUC C-number|NCDOI|DHSR Star Rating|HICPA|DoBS|PHFA|Utility Code/);
    assert.doesNotMatch(text, /38,523 mixed|484,454 HMDA 2025 North Carolina|687 SOS IA/);
  }
});
