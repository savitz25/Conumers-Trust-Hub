import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const njPage = readFileSync('app/new-jersey/page.tsx', 'utf8');
const caPage = readFileSync('app/california/page.tsx', 'utf8');
const txPage = readFileSync('app/texas/page.tsx', 'utf8');
const waPage = readFileSync('app/washington/page.tsx', 'utf8');
const manifest = JSON.parse(readFileSync('data/network/arizona/source-manifest.json', 'utf8'));
const ledger = JSON.parse(readFileSync('data/network/arizona/expansion-ledger-blueprint.json', 'utf8'));
const order = JSON.parse(readFileSync('data/network/arizona/build-order.json', 'utf8'));
const acquired = JSON.parse(readFileSync('data/network/arizona/acquisition-summary.json', 'utf8'));
const matrix = JSON.parse(readFileSync('data/network/arizona/value-per-hour-matrix.json', 'utf8'));
const sequence = readFileSync('docs/arizona/build-sequence.md', 'utf8');
const sourceMap = readFileSync('docs/arizona/ath-az-001-network-source-map.md', 'utf8');
const sbsDoc = readFileSync('docs/arizona/sbs-paid-access.md', 'utf8');
const moveDoc = readFileSync('docs/arizona/mover-no-state-roster.md', 'utf8');
const localDoc = readFileSync('docs/arizona/local-exception-parked.md', 'utf8');
const sbsFix = JSON.parse(
  readFileSync('data/network/arizona/insurance/fixtures/sbs-paid-report-note.json', 'utf8'),
);
const moveFix = JSON.parse(
  readFileSync('data/network/arizona/move/fixtures/ag-no-license-note.json', 'utf8'),
);
const hmdaFix = JSON.parse(
  readFileSync('data/network/arizona/lender/fixtures/hmda-az-already-acquired.json', 'utf8'),
);
const iardFix = JSON.parse(
  readFileSync('data/network/arizona/investor/fixtures/iard-overlay-note.json', 'utf8'),
);
const rocFix = JSON.parse(
  readFileSync('data/network/arizona/contractor/fixtures/roc-owned-by-az-con-001.json', 'utf8'),
);
const senFix = JSON.parse(
  readFileSync('data/network/arizona/senior/fixtures/az-sen-001-accepted-ledger.json', 'utf8'),
);

function source(id: string) {
  return manifest.sources.find((s: { source_id: string }) => s.source_id === id);
}

test('ATH-AZ-001 is state-level research only: ATH-AZ-FINAL publishes Ask /arizona, still no counties', () => {
  assert.equal(existsSync('app/arizona/page.tsx'), true);
  assert.equal(existsSync('app/places/arizona'), false);
  assert.match(sitemap, /\/arizona/);
  assert.equal(manifest.scope, 'STATE_LEVEL_ONLY');
  assert.equal(manifest.arizona_local_phase, 'NO');
  assert.equal(manifest.publication.county_work, false);
  assert.equal(manifest.publication.city_work, false);
  assert.equal(manifest.publication.specialist_repo_edits, false);
  assert.equal(manifest.publication.sbs_purchase, false);
  assert.equal(manifest.publication.pra_request, false);
  assert.equal(manifest.publication.nmls_scrape, false);
  assert.equal(manifest.publication.search_portal_scrape, false);
  assert.deepEqual(
    readdirSync('app/arizona').filter((name) => name !== 'page.tsx'),
    [],
  );
});

test('no Trust Score, paid ranking, or people publication', () => {
  assert.equal(manifest.publication.trust_score, false);
  assert.equal(manifest.publication.paid_ranking, false);
  assert.equal(manifest.publication.people_publication, false);
  assert.match(JSON.stringify(manifest.principles), /no_trust_score/);
  assert.match(sourceMap, /No Trust Score/);
  assert.match(matrix.note, /No Trust Score/);
});

test('Arizona has no statewide mover license; 0 is proven absence, not a missing scrape', () => {
  const gap = source('az-ag-mover-no-license');
  assert.equal(gap.access_class, 'NO_STATE_ROSTER');
  assert.equal(gap.record_count, 0);
  assert.equal(gap.unique_companies, 0);
  assert.equal(gap.entity_growth, 'NONE');
  assert.equal(moveFix.statewide_hhg_roster, false);
  assert.equal(moveFix.record_count, 0);
  assert.match(moveFix.quote, /does not have a registration law/);
  assert.equal(ledger.hubs.MOVE.POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledger.hubs.MOVE.POTENTIAL_NET_NEW_STATE_IDENTITIES, 0);
  assert.equal(ledger.hubs.MOVE.PRE_EXISTING_STATE_IDENTITIES, 0);
  assert.equal(ledger.hubs.MOVE.NEW_SOURCE_IDENTITIES_ACQUIRED, 0);
  assert.equal(ledger.hubs.MOVE.POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED, 'UNKNOWN');
  assert.match(moveDoc, /no statewide license roster/i);
  assert.match(JSON.stringify(manifest.principles), /ARIZONA_HAS_NO_STATEWIDE_MOVER_LICENSE/);
});

test('FMCSA AZ census is all motor carriers, not movers, and is not ingested', () => {
  const census = source('az-fmcsa-mcmis-census-az-physical');
  assert.equal(census.record_count, 60519);
  assert.equal(census.active_count, 31875);
  assert.equal(census.acquisition_status, 'COUNTED_NOT_INGESTED');
  assert.equal(census.grain, 'all_motor_carriers_not_household_goods');
  assert.equal(ledger.hubs.MOVE.do_not_call_companies.fmcsa_az_phy_all, 60519);
  assert.match(census.count_notes, /not movers/);
});

test('SBS Report Generator is paid at $0.03/row $30 minimum and was not purchased', () => {
  const sbs = source('az-sbs-report-generator');
  assert.equal(sbs.access_class, 'OPEN_REPORT_GENERATOR_PAID');
  assert.equal(sbs.report_price_per_row_usd, 0.03);
  assert.equal(sbs.report_minimum_usd, 30);
  assert.equal(sbs.report_format, 'CSV');
  assert.equal(sbs.acquisition_status, 'NOT_ACQUIRED_PAID');
  assert.equal(sbs.record_count, 'UNKNOWN');
  assert.equal(sbsFix.purchased, false);
  assert.equal(sbsFix.price_per_row_usd, 0.03);
  assert.equal(sbsFix.minimum_usd, 30);
  assert.equal(acquired.paid_report.purchased, false);
  assert.equal(acquired.paid_report.price_per_row_usd, 0.03);
  assert.equal(ledger.hubs.INSURANCE.POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS, 'UNKNOWN');
  assert.equal(ledger.hubs.INSURANCE.NEW_SOURCE_IDENTITIES_ACQUIRED, 0);
  assert.match(sbsDoc, /\$0\.03 per row/);
  assert.match(JSON.stringify(manifest.principles), /do_not_buy_SBS_reports/);
});

test('HMDA Arizona is already acquired market observation, not lender companies', () => {
  const hmda = source('az-hmda-cfpb-overlay');
  assert.equal(hmda.record_count, 307379);
  assert.equal(hmda.originations, 183374);
  assert.equal(hmda.denials, 49376);
  assert.equal(hmda.lender_hub_slice.counties, 15);
  assert.equal(hmda.lender_hub_slice.lei_state_rows, 953);
  assert.equal(hmda.grain, 'mortgage_application');
  assert.equal(hmda.entity_growth, 'ZERO');
  assert.equal(hmdaFix.is_lender_company_roster, false);
  assert.equal(hmdaFix.already_in_ask, true);
  assert.equal(hmdaFix.applications, 307379);
  assert.equal(hmdaFix.lender_hub_slice.high_confidence_lei_maps, 123);
  const nmls = source('az-nmls-consumer-access');
  assert.equal(nmls.access_class, 'OPEN_SEARCH_ONLY');
  assert.equal(nmls.record_count, 'UNKNOWN');
  assert.equal(ledger.hubs.LENDER.NEW_SOURCE_IDENTITIES_ACQUIRED, 0);
  assert.equal(ledger.hubs.LENDER.POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS, 'UNKNOWN');
  assert.match(JSON.stringify(manifest.principles), /HMDA_applications_are_not_lender_companies/);
});

test('IARD overlay is existing firms; ACC lists are by request and were not pulled', () => {
  const iard = source('az-sec-iard-principal-office-overlay');
  assert.equal(iard.record_count, 25777);
  assert.equal(iard.ria_facts, 17018);
  assert.equal(iard.az_principal_office, 213);
  assert.equal(iard.entity_growth, 'ZERO_NET_NEW_CANONICAL');
  assert.equal(iardFix.net_new_canonical_from_overlay, 0);
  assert.equal(iardFix.arizona_principal_office, 213);
  assert.equal(iardFix.pra_filed, false);
  assert.equal(ledger.hubs.INVESTOR.POTENTIAL_EXISTING_ORGANIZATIONS_ENRICHED, 213);
  const pra = source('az-acc-securities-list-request');
  assert.equal(pra.access_class, 'SOURCE_AVAILABLE_BY_REQUEST');
  assert.equal(pra.acquisition_status, 'NOT_ACQUIRED_PRA');
  assert.equal(pra.record_count, 'UNKNOWN');
  assert.equal(ledger.hubs.INVESTOR.POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS.from_iard_overlay, 0);
  assert.equal(ledger.hubs.INVESTOR.POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS.from_acc_pra_list, 'UNKNOWN');
  assert.equal(ledger.hubs.INVESTOR.NEW_SOURCE_IDENTITIES_ACQUIRED, 0);
});

test('ACC eCorp is search-only; bulk is PRA and was not requested', () => {
  const search = source('az-acc-ecorp-entity-search');
  const bulk = source('az-acc-ecorp-bulk-request');
  assert.equal(search.access_class, 'OPEN_SEARCH_ONLY');
  assert.equal(bulk.access_class, 'SOURCE_AVAILABLE_BY_REQUEST');
  assert.equal(bulk.acquisition_status, 'NOT_ACQUIRED_PRA');
  assert.match(JSON.stringify(manifest.principles), /ACC_business_registration_is_not_professional_license/);
});

test('ROC and Senior are pointers; this ticket did not re-acquire them', () => {
  const roc = source('az-roc-contractor-pointer');
  assert.equal(roc.acquisition_status, 'OWNED_BY_AZ_CON_001');
  assert.equal(roc.record_count, 58408);
  assert.equal(rocFix.acquired_this_ticket, false);
  assert.equal(rocFix.az_roc_license_rows_in_ask_metrics, 58408);
  const sen = source('az-senior-cms-and-state-pointer');
  assert.equal(sen.acquisition_status, 'ALREADY_PUBLISHED_AZ_SEN_001');
  assert.equal(sen.cms_nursing_homes, 140);
  assert.equal(sen.accepted_ledger.NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(sen.accepted_ledger.NET_NEW_STATE_IDENTITIES, 2776);
  assert.equal(senFix.redo, false);
  assert.equal(ledger.hubs.SENIOR.accepted_az_sen_001.NET_NEW_STATE_IDENTITIES, 2776);
  assert.equal(ledger.hubs.CONTRACTOR.NEW_SOURCE_IDENTITIES_ACQUIRED, 0);
});

test('nothing bulk was acquired; UNKNOWN is not coerced to zero', () => {
  assert.deepEqual(acquired.acquired_this_ticket, []);
  assert.equal(acquired.arizona_local_phase, 'NO');
  assert.equal(order.arizona_local_phase, 'NO');
  for (const hub of ['INSURANCE', 'LENDER', 'INVESTOR']) {
    assert.equal(ledger.hubs[hub].NEW_SOURCE_IDENTITIES_ACQUIRED, 0);
  }
  assert.equal(ledger.hubs.INSURANCE.POTENTIAL_NET_NEW_STATE_IDENTITIES, 'UNKNOWN');
  assert.equal(ledger.hubs.LENDER.PRE_EXISTING_CANONICAL_ORGANIZATIONS, 'UNKNOWN');
  assert.match(ledger.note, /UNKNOWN ≠ 0/);
  assert.match(JSON.stringify(manifest.principles), /data_row_is_not_entity_growth/);
  assert.match(JSON.stringify(manifest.principles), /license_row_is_not_unique_company/);
});

test('build sequence finishes Arizona with intelligence pages, not paid or local work', () => {
  assert.equal(order.remaining_specialist_order[0].ticket, 'AZ-LEND-001');
  assert.equal(order.remaining_specialist_order[1].ticket, 'AZ-INV-001');
  assert.equal(order.remaining_specialist_order[2].ticket, 'AZ-INS-001');
  assert.equal(order.remaining_specialist_order[3].ticket, 'AZ-MOVE-001');
  assert.equal(order.remaining_specialist_order[4].ticket, 'ATH-AZ-002');
  assert.equal(order.builder_3_next_after_az_con_001.ticket, 'AZ-INV-001');
  assert.equal(order.builder_3_next_after_az_con_001.repo, 'investor-trust-hub');
  assert.equal(order.builder_4_next.ticket, 'AZ-LEND-001');
  assert.equal(order.builder_4_next.repo, 'lender-trust-hub');
  assert.match(sequence, /AZ-INV-001/);
  assert.match(sequence, /AZ-INS-001/);
  assert.match(sequence, /ARIZONA_LOCAL_PHASE = NO/);
  assert.match(localDoc, /ARIZONA_LOCAL_PHASE = NO/);
  assert.match(sequence, /Not this ticket/);
});

test('required Arizona network files exist', () => {
  for (const rel of [
    'data/network/arizona/source-manifest.json',
    'data/network/arizona/identity-source-map.json',
    'data/network/arizona/expansion-ledger-blueprint.json',
    'data/network/arizona/value-per-hour-matrix.json',
    'data/network/arizona/build-order.json',
    'data/network/arizona/acquisition-summary.json',
    'data/network/arizona/contact-source-summary.json',
    'data/network/arizona/cross-hub-source-map.json',
    'docs/arizona/ath-az-001-network-source-map.md',
    'docs/arizona/build-sequence.md',
    'docs/arizona/sbs-paid-access.md',
    'docs/arizona/sbs-access-restrictions.md',
    'docs/arizona/mover-no-state-roster.md',
    'docs/arizona/remaining-hub-opportunity.md',
    'docs/arizona/local-exception-parked.md',
    'data/network/arizona/remaining-hub-value-matrix.json',
    'data/network/arizona/lender/fixtures/hmda-az-partition-note.json',
    'data/network/arizona/investor/fixtures/acc-securities-request-note.json',
    'scripts/arizona/probe_official.py',
    'scripts/arizona/probe_counts.py',
    'scripts/arizona/write_network.py',
  ]) {
    assert.equal(existsSync(rel), true, rel);
  }
  for (const hub of ['contractor', 'lender', 'insurance', 'senior', 'move', 'investor']) {
    assert.equal(existsSync(`data/network/arizona/${hub}/source-manifest.json`), true, hub);
  }
});

test('Washington, Texas, California, NJ, and Florida public surfaces are unchanged', () => {
  assert.equal(existsSync('app/washington/page.tsx'), true);
  assert.equal(existsSync('app/texas/page.tsx'), true);
  assert.equal(existsSync('app/california/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/washington/);
  assert.match(sitemap, /\/texas/);
  assert.match(sitemap, /\/california/);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.match(waPage, /washington/i);
  assert.match(txPage, /texas/);
  assert.match(caPage, /california/);
  assert.match(njPage, /new-jersey/);
  assert.match(flPage, /florida/);
  assert.equal(existsSync('app/new-jersey/monmouth-county/page.tsx'), true);
  assert.deepEqual(
    readdirSync('app/washington').filter((name) => name !== 'page.tsx'),
    [],
  );
  assert.deepEqual(
    readdirSync('app/texas').filter((name) => name !== 'page.tsx'),
    [],
  );
  assert.deepEqual(
    readdirSync('app/california').filter((name) => name !== 'page.tsx'),
    [],
  );
});
