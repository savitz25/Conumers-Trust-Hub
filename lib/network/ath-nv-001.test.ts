import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import {
  ACCEPTED_NV_SPECIALIST_RELEASES,
  NV_NETWORK_CONTRACT,
  NV_PUBLICATION_FINGERPRINT,
  NV_PUBLICATION_MANIFEST,
  NV_SEMANTIC_GUARDRAILS,
  NV_VERIFICATION,
  REQUIRED_NV_HUB_IDS,
  classifyNvHub,
  nevadaNamedFirst,
  nvBareLicenseAmbiguous,
  nvConciergeContext,
  nvGatewayOnlyQuery,
  nvIdentifierRoute,
  nvPublicationSemanticFingerprint,
  nvReleaseGatePassed,
  queryLooksLikeNevada,
  routeNvAsk,
  stateCodeNamedBeforeNevada,
} from './nv-network.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { askStateExplorerEyebrow, askStateFooterLinks, askStateSitemapEntries, listGatedAskStates } from './published-ask-states.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';

const page = readFileSync('app/nevada/page.tsx', 'utf8');
const gateway = readFileSync('components/nevada-network-gateway.tsx', 'utf8');
const closeout = JSON.parse(readFileSync('data/network/nevada/state-closeout.json', 'utf8'));
const release = JSON.parse(readFileSync('data/releases/nevada-network-release.json', 'utf8'));
const gaps = JSON.parse(readFileSync('data/network/nevada/gap-register.json', 'utf8'));
const M = NV_PUBLICATION_MANIFEST;

const FROZEN: Record<string, [string, string]> = {
  move: ['d0dddb4e93ec1e5557e0fa006ae020cc2407b2e8', '4a8af0569b5d5d023dbdcd7b37ac30842158282d11e45fd7ffbfd8cfa43d4f80'],
  lender: ['a8dafcda82b5e2c561aa38ffd5fad60f097c226d', 'a38a2aa9b3929f04c4cbea42a435866e6f1f31e41dc570e0b7ec1a7145ac6400'],
  contractor: ['c6835be2c61b98fdaf5959d507a22a78f56ab615', 'a0fd24f0af96fda1408c53af35675961dc7beb529b1e90336162e12a433ccbaa'],
  insurance: ['9bd835860b68507546deb0392bd5d261e327eaeb', '633d2f8bbcde1f817532ccf3c02e9ba0deda879ed4ebac79046736acbcf19c55'],
  senior: ['234c6b09a019da362b1c383418d13e3715a5fbca', '43e036b7d3db32c9c76393a79b51163f5d8de5014d90899213639715dd49b640'],
  investor: ['68fa8d10ccc2fe71e61ca078ef26d79a0ea44b15', '951496e8f1ef02f7b2777455e965b0768c0a89c610dbe8d2a3b4ed192661f6f6'],
};
const LEGACY = ['/hubs/nevada', '/hubs/browse/nevada', '/moving-to/nevada', '/local-lenders/nevada', '/local-lenders/nv', '/fdic-insured-banks/nevada', '/nevada/las-vegas', '/nevada/reno'];

const plan = (q: string) => buildNetworkAskPlan(q);
const primary = (q: string) => plan(q).hubs[0]?.hubId;

test('six frozen specialist certificates match the manifest and pass the release gate', () => {
  assert.equal(NV_NETWORK_CONTRACT, 'ath-nv-network-release-v1');
  assert.equal(M.hubs.length, 6);
  assert.deepEqual([...REQUIRED_NV_HUB_IDS].sort(), Object.keys(FROZEN).sort());
  for (const hub of M.hubs) {
    const [sha, fingerprint] = FROZEN[hub.hub_id];
    assert.equal(hub.certified_release_sha, sha, hub.hub_id);
    assert.equal(hub.fingerprint, fingerprint, hub.hub_id);
    assert.equal(hub.specialist_status, 'CLOSED_PRODUCTION_VERIFIED', hub.hub_id);
    const accepted = ACCEPTED_NV_SPECIALIST_RELEASES[hub.hub_id as keyof typeof ACCEPTED_NV_SPECIALIST_RELEASES];
    assert.equal(hub.canonical_state_url, accepted.canonical_state_url);
    assert.equal(hub.snapshot_version, accepted.snapshot_version);
    assert.match(hub.canonical_state_url, /^https:\/\/www\.[a-z]+trusthub\.com\/nevada$/);
  }
  assert.equal(M.hubs.find((h) => h.hub_id === 'lender')?.data_release_sha, 'c6970df5b7c442b89f4ae0f120e0c581114a477c');
  assert.equal(M.release_gate.passed, true);
  assert.equal(M.release_gate.blocker, null);
  assert.equal(NV_VERIFICATION.release_gate_passed, true);
  assert.equal(NV_VERIFICATION.hubs.length, 6);
  for (const row of NV_VERIFICATION.hubs) {
    assert.equal(row.ok, true, row.hub_id);
    assert.equal(row.rating_schema, false, row.hub_id);
    assert.equal(row.sitemap_occurrences, 1, row.hub_id);
    assert.equal(row.city_route_status['/nevada/las-vegas'], 404, row.hub_id);
  }
  assert.equal(nvReleaseGatePassed(), true);
});

test('the gate fails closed on any drifted specialist', () => {
  const drift = structuredClone(M);
  drift.hubs[0].fingerprint = '0'.repeat(64);
  assert.equal(nvReleaseGatePassed(drift), false);
  const pending = structuredClone(M);
  pending.hubs[1].specialist_status = 'IN_PROGRESS';
  assert.equal(nvReleaseGatePassed(pending), false);
  const city = structuredClone(M);
  (city as { hardcoded_city_routes: boolean }).hardcoded_city_routes = true;
  assert.equal(nvReleaseGatePassed(city), false);
});

test('federation contract: no graph writes, no claim expansion, cross-hub total rejected, no ranking', () => {
  const ledger = M.expansion_ledger;
  assert.equal(ledger.CROSS_HUB_RECORD_TOTAL.status, 'REJECTED');
  assert.equal(ledger.CROSS_HUB_RECORD_TOTAL.value, null);
  assert.match(ledger.CROSS_HUB_RECORD_TOTAL.explanation, /cannot be summed/);
  assert.equal(ledger.ASK_GRAPH_WRITES, 0);
  assert.equal(ledger.ASK_CLAIM_ELIGIBILITY_BROADENED, false);
  assert.equal(ledger.LOCAL_WORK_NEEDED_NOW, 'NO');
  for (const [hub, l] of Object.entries(M.hub_expansion_ledgers)) {
    assert.equal((l as { GRAPH_WRITES: number }).GRAPH_WRITES, 0, hub);
    assert.equal((l as { CLAIM_ELIGIBILITY_BROADENED: boolean }).CLAIM_ELIGIBILITY_BROADENED, false, hub);
  }
  assert.equal(M.trust_score, false);
  assert.equal(M.paid_ranking, false);
  assert.equal(M.hardcoded_city_routes, false);
  assert.equal(M.nevada_local_phase, 'NO');
  const senior = M.hub_expansion_ledgers.senior;
  assert.equal(senior.RFG, 438);
  assert.equal(senior.RFG_ASSISTED_LIVING_ENDORSED, 74);
  assert.equal(senior.RFG_IS_ASSISTED_LIVING, false);
  assert.equal(senior.STATE_LICENSE_IS_CMS_CERTIFICATION, false);
  assert.equal(M.hub_expansion_ledgers.lender.COMBINED_NEVADA_LENDER_TOTAL, 'UNSUPPORTED');
  assert.equal(M.hub_expansion_ledgers.insurance.LEGACY_HUBS_NEVADA_USED, false);
  assert.equal(M.hub_expansion_ledgers.investor.SUBSTITUTE_REGULATOR, false);
  for (const doc of [closeout, release]) {
    assert.equal(doc.ask_graph_writes, 0);
    assert.equal(doc.ask_claim_eligibility_broadened, false);
  }
  assert.equal(closeout.cross_hub_record_total, null);
  assert.equal(release.cross_hub_record_total.status, 'REJECTED');
  assert.equal(gaps.cross_hub_record_total.value, null);
  const text = JSON.stringify(M);
  assert.doesNotMatch(text, /total nevada (providers|businesses|companies|records)|combined (professionals|facilities)/i);
  assert.doesNotMatch(text, /"@type"\s*:\s*"AggregateRating"|top[- ]rated|sponsored|paid ranking:\s*true/i);
});

test('strip headlines keep exact grains; no card is summed', () => {
  const strip = Object.fromEntries(M.intelligence_strip.map((r) => [r.hub_id, r]));
  assert.equal(strip.move.display, '46 Nevada household-goods CPCN identities');
  assert.equal(strip.contractor.display, '19,213 active Nevada contractor license numbers');
  assert.doesNotMatch(strip.contractor.display, /19,213 contractors/);
  assert.equal(strip.lender.display, '119,768 Nevada HMDA applications in 2025');
  assert.match(strip.lender.grain, /not a lender, company or MLO count/);
  assert.match(strip.insurance.display, /as of October 2024/);
  assert.match(strip.insurance.grain, /Not a September 2026 identity count/);
  assert.equal(strip.senior.display, '438 Nevada Residential Facility for Groups licenses');
  assert.match(strip.senior.grain, /not assisted living by default/);
  assert.equal(strip.investor.display, '271 APPROVED Nevada state IA firms');
});

test('source clocks stay separate; no single Nevada source date', () => {
  const clocks = Object.fromEntries(M.hubs.map((h) => [h.hub_id, h.source_clocks as unknown as Record<string, string | null>]));
  assert.equal(clocks.move.nta_active_certificates, null);
  assert.equal(clocks.insurance.ndoi_market_report_census, '2024-10');
  assert.equal(clocks.investor.iapd_state_ia_era, '2026-09-17');
  assert.equal(clocks.investor.iapd_sec_notice_filing, '2026-09-18');
  assert.equal(clocks.investor.principal_office_overlay, '2026-08-27');
  assert.match(String(clocks.contractor.nscb_active_directory_as_of), /9\/25\/2026 10:32:43 AM/);
  assert.match(String(clocks.senior.hcqc_inspection_dates), /2016-04-21 to 2026-09-22/);
  assert.equal(clocks.lender.hmda, 'HMDA 2025');
  assert.doesNotMatch(JSON.stringify(M), /"(common|shared|nevada)_?source_?(as_?of|date)"/i);
  assert.match(gateway, /Source clocks: \{clockLine/);
  assert.match(gateway, /Source clocks differ by hub/);
});

test('state named first: Nevada wins when first, yields when another state is first', () => {
  assert.equal(parseNetworkAsk('Nevada contractor Tennessee').geography?.stateCode, 'NV');
  assert.equal(parseNetworkAsk('Nevada mover Georgia').geography?.stateCode, 'NV');
  assert.equal(parseNetworkAsk('Nevada insurance Massachusetts').geography?.stateCode, 'NV');
  assert.equal(parseNetworkAsk('NV contractor TN').geography?.stateCode, 'NV');
  assert.equal(parseNetworkAsk('Nevada nursing home Ohio').geography?.stateCode, 'NV');
  assert.equal(parseNetworkAsk('Tennessee mover Nevada').geography?.stateCode, 'TN');
  assert.equal(parseNetworkAsk('Massachusetts insurance agent Nevada').geography?.stateCode, 'MA');
  assert.equal(parseNetworkAsk('Georgia mover Nevada').geography?.stateCode, 'GA');
  assert.equal(parseNetworkAsk('TN contractor NV').geography?.stateCode, 'TN');
  assert.equal(parseNetworkAsk('movers CA and Nevada').geography?.stateCode, 'CA', 'a code named before Nevada keeps its state');
  assert.equal(stateCodeNamedBeforeNevada('movers CA and Nevada'), 'CA');
  assert.equal(parseNetworkAsk('Nevada and California movers').geography?.stateCode, 'NV');
  assert.equal(nevadaNamedFirst('MA HIC Nevada'), true, 'MA is an ambiguous code in the shared contract');
});

test('cities: Nevada geography only with a vertical and no other state; no city routes', () => {
  for (const city of ['Las Vegas', 'Reno', 'Henderson', 'Carson City', 'North Las Vegas']) {
    const p = plan(`contractor ${city}`);
    assert.equal(p.parsed.geography?.stateCode, 'NV', city);
    assert.equal(p.placeLensHref, '/nevada', city);
    assert.equal(p.parsed.geography?.city, city, city);
  }
  assert.equal(queryLooksLikeNevada('assisted living Las Vegas NM'), false);
  assert.equal(queryLooksLikeNevada('contractor Reno Texas'), false);
  assert.equal(queryLooksLikeNevada('contractor Henderson Kentucky'), false);
  assert.equal(queryLooksLikeNevada('Reno'), false, 'a bare city is context only');
  assert.equal(normalizedPublishedStatePath('/Nevada'), '/nevada');
  assert.equal(normalizedPublishedStatePath('/NEVADA'), '/nevada');
  assert.equal(normalizedPublishedStatePath('/nevada/las-vegas'), null);
  for (const c of ['las-vegas', 'reno', 'henderson', 'carson-city', 'north-las-vegas']) assert.equal(existsSync(`app/nevada/${c}`), false);
});

test('vertical routing: one exact hub per Nevada question, Nevada HIC is senior care', () => {
  const cases: Array<[string, string]> = [
    ['CPCN Nevada', 'move'], ['Nevada moving tariff', 'move'], ['movers Nevada', 'move'],
    ['MLO Nevada', 'lender'], ['mortgage servicer Nevada', 'lender'], ['escrow Nevada', 'lender'], ['NMLS Nevada', 'lender'],
    ['contractor monetary limit Nevada', 'contractor'], ['Nevada contractor license', 'contractor'],
    ['insurance agent Nevada', 'insurance'], ['NAIC Nevada', 'insurance'], ['NPN Nevada', 'insurance'],
    ['RFG Nevada', 'senior'], ['Residential Facility for Groups Nevada', 'senior'], ["Alzheimer's facility Nevada", 'senior'],
    ['SNF Nevada', 'senior'], ['HIC Nevada', 'senior'], ['HHA Nevada', 'senior'], ['Nevada HCQC state credential', 'senior'],
    ['notice filing Nevada', 'investor'], ['ERA Nevada', 'investor'], ['Nevada securities enforcement', 'investor'],
  ];
  for (const [q, hub] of cases) {
    const p = plan(q);
    assert.equal(p.hubs[0]?.hubId, hub, q);
    assert.equal(p.placeLensHref, '/nevada', q);
    for (const h of p.hubs) for (const l of LEGACY) assert.ok(!(h.destination ?? '').includes(l), `${q} -> ${h.destination}`);
  }
  assert.equal(classifyNvHub('HIC Nevada'), 'senior');
  assert.ok(!plan('HIC Nevada').hubs.some((h) => h.hubId === 'contractor'));
  assert.equal(routeNvAsk('HIC Nevada')?.destination, 'https://www.seniortrusthub.com/nevada#hirc');
  assert.match(routeNvAsk('best contractor Nevada')?.caveat ?? '', /does not select a winner/);
  for (const [q, hub] of [['RFG Nevada', 'senior'], ['HIC Nevada', 'senior'], ['CPCN 3251.3', 'move'], ['116-AGC-41', 'senior'], ['notice filing Nevada', 'investor'], ['Nevada contractor license 0095506', 'contractor']] as const) {
    const research = planAskResearch(q);
    assert.equal(research.primaryHub, hub, q);
    assert.deepEqual(research.candidateHubs, [hub], q);
  }
  assert.equal(planAskResearch('HIC Nashville').primaryHub, 'contractor', 'Tennessee HIC stays a contractor credential');
});

test('identifiers outrank Nevada routing; missing families are handed to their hub', () => {
  assert.equal(primary('CPCN 3251.3'), 'move');
  assert.equal(primary('CPCN 3251.3 Tennessee'), 'move');
  assert.equal(primary('116-AGC-41'), 'senior');
  assert.equal(primary('116-AGC-41 Las Vegas'), 'senior');
  assert.equal(primary('SEC 801-12345'), 'investor');
  assert.equal(primary('SEC 801-12345 Nevada'), 'investor');
  assert.equal(nvIdentifierRoute('SEC 801-12345 Tennessee', true), undefined, 'Tennessee keeps its own SEC-file handoff');
  for (const [q, hub] of [['USDOT 1234567 Nevada', 'move'], ['MC 123456 Las Vegas', 'move'], ['NMLS 3029 Nevada', 'lender'], ['NAIC 19232 Nevada', 'insurance'], ['NPN 17405963 Nevada', 'insurance'], ['CCN 295102 Nevada', 'senior'], ['CRD 108137 Nevada', 'investor']] as const) {
    assert.equal(primary(q), hub, q);
  }
  const c = plan('Nevada contractor license 0095506').hubs[0];
  assert.equal(c.hubId, 'contractor');
  assert.equal(c.destination, 'https://www.contractortrusthub.com/nevada?license=0095506#license-lookup');
  assert.equal(plan('Nevada contractor license 95506').hubs[0].destination, 'https://www.contractortrusthub.com/nevada?license=0095506#license-lookup');
});

test('a bare Nevada license number fails closed; qualified numbers route', () => {
  for (const q of ['license 115 Nevada', 'license 100 Nevada', 'credential 42 Nevada', 'Nevada license number 8620', 'license #0095506 Nevada']) {
    assert.equal(nvBareLicenseAmbiguous(q), true, q);
    const p = plan(q);
    assert.equal(p.hubs.length, 1, q);
    assert.equal(p.hubs[0].mode, 'fail_closed', q);
    assert.equal(p.hubs[0].reason, NV_SEMANTIC_GUARDRAILS.bare_license_ambiguous, q);
  }
  assert.equal(primary('Nevada RFG license 116'), 'senior');
  assert.equal(primary('Nevada SNF license 8620'), 'senior');
  assert.equal(primary('Nevada insurance agent license 3234567'), 'insurance');
  assert.equal(primary('Nevada mortgage license 4321'), 'lender');
});

test('gateway-only answers: cross-hub totals rejected, vertical-free complaints need a vertical', () => {
  assert.equal(nvGatewayOnlyQuery('all Nevada providers'), 'cross_hub_total');
  assert.equal(nvGatewayOnlyQuery('how many Nevada businesses are there'), 'cross_hub_total');
  assert.deepEqual(plan('all Nevada providers').hubs, []);
  assert.equal(plan('all Nevada providers').placeLensHref, '/nevada');
  assert.equal(nvGatewayOnlyQuery('Nevada complaints'), 'ambiguous_complaints');
  assert.equal(nvGatewayOnlyQuery('Nevada nursing home complaint'), undefined);
});

test('page and gateway: canonical, gated indexing, six canonical links, no legacy, no rating, no totals', () => {
  assert.match(page, /const PATH = '\/nevada'/);
  assert.match(page, /noIndex: !gate/);
  assert.match(page, /'@type': 'BreadcrumbList'/);
  assert.doesNotMatch(page + gateway, /AggregateRating'|ratingValue|reviewCount/);
  assert.match(gateway, /manifest\.hubs\.map/);
  assert.match(gateway, /href=\{hub\.canonical_state_url\}/);
  for (const l of LEGACY) assert.ok(!(page + gateway + JSON.stringify(M)).includes(l), l);
  assert.match(gateway, /The cards are not symmetric and are never added together/);
  assert.match(gateway, /There is no Trust Score and no paid ranking/);
  assert.equal(M.hubs.filter((h) => /^https:\/\/www\.[a-z]+trusthub\.com\/nevada$/.test(h.canonical_state_url)).length, 6);
  assert.doesNotMatch(page + gateway, /Tennessee|tennessee/);
});

test('catalog, sitemap, footer, explorer and evidence inventory include Nevada exactly once', () => {
  const gated = listGatedAskStates();
  assert.equal(gated.filter((s) => s.slug === 'nevada').length, 1);
  assert.equal(askStateSitemapEntries().filter((e) => e.path === '/nevada').length, 1);
  assert.equal(askStateFooterLinks().filter((l) => l.href === '/nevada').length, 1);
  assert.match(askStateExplorerEyebrow(), /^Eighteen-state network explorer$/);
  assert.ok(ASK_NETWORK_STATES.some((s: { slug?: string; href?: string; code?: string }) => s.slug === 'nevada' || s.href === '/nevada' || s.code === 'NV'));
});

test('concierge context keeps Nevada semantics and the rejected total', () => {
  const ctx = nvConciergeContext();
  assert.match(ctx, /STATE LEVEL ONLY/);
  assert.match(ctx, /HIC means Home for Individual Residential Care/);
  assert.match(ctx, /no single Nevada source date/);
  assert.match(ctx, /Cross-hub record total: REJECTED/);
  assert.match(ctx, /gate: passed/);
});

test('publication fingerprint uses the Ask canonical implementation and is recorded', () => {
  assert.equal(NV_PUBLICATION_FINGERPRINT, nvPublicationSemanticFingerprint());
  assert.equal(closeout.publication_manifest_fingerprint, NV_PUBLICATION_FINGERPRINT);
  assert.equal(release.ask_fingerprint, NV_PUBLICATION_FINGERPRINT);
  assert.match(closeout.publication_manifest_fingerprint_method, /nvPublicationSemanticFingerprint\(\)/);
  assert.equal(closeout.status, 'AWAITING_PRODUCTION_CERTIFICATE');
  assert.equal(closeout.ask_production, null);
});

test('prior states are not stolen by Nevada', () => {
  const keep: Array<[string, string]> = [
    ['contractor Tennessee', 'TN'], ['HIC Nashville', 'TN'], ['Tennessee ACLF license 115', 'TN'],
    ['HIC Massachusetts', 'MA'], ['mover Massachusetts', 'MA'], ['contractor Georgia', 'GA'], ['nursing home Ohio', 'OH'],
    ['mover New Jersey', 'NJ'], ['contractor Texas', 'TX'], ['mover California', 'CA'], ['contractor Arizona', 'AZ'],
    ['nursing home Pennsylvania', 'PA'], ['contractor North Carolina', 'NC'], ['contractor Illinois', 'IL'],
  ];
  for (const [q, code] of keep) assert.equal(parseNetworkAsk(q).geography?.stateCode, code, q);
  assert.equal(plan('HIC Massachusetts').placeLensHref, '/massachusetts');
  assert.equal(plan('contractor Tennessee').placeLensHref, '/tennessee');
});
