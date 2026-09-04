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
const ledger = JSON.parse(
  readFileSync('data/network/arizona/expansion-ledger-blueprint.json', 'utf8'),
);
const matrix = JSON.parse(
  readFileSync('data/network/arizona/remaining-hub-value-matrix.json', 'utf8'),
);
const order = JSON.parse(readFileSync('data/network/arizona/build-order.json', 'utf8'));
const acquisition = JSON.parse(
  readFileSync('data/network/arizona/acquisition-summary.json', 'utf8'),
);
const sequence = readFileSync('docs/arizona/build-sequence.md', 'utf8');
const sbsDoc = readFileSync('docs/arizona/sbs-access-restrictions.md', 'utf8');
const sbsFix = JSON.parse(
  readFileSync('data/network/arizona/insurance/fixtures/sbs-paid-report-note.json', 'utf8'),
);
const hmdaFix = JSON.parse(
  readFileSync('data/network/arizona/lender/fixtures/hmda-az-partition-note.json', 'utf8'),
);
const invFix = JSON.parse(
  readFileSync('data/network/arizona/investor/fixtures/acc-securities-request-note.json', 'utf8'),
);
const moveFix = JSON.parse(
  readFileSync('data/network/arizona/move/fixtures/dps-hhg-deregulation-note.json', 'utf8'),
);
const localForbidden = [
  'phoenix',
  'maricopa',
  'tucson',
  'pima',
  'mesa',
  'scottsdale',
  'tempe',
  'chandler',
  'glendale',
];

test('ATH-AZ-001 is state-level research only: no public Ask /arizona', () => {
  assert.equal(existsSync('app/arizona'), false);
  assert.equal(existsSync('app/arizona/page.tsx'), false);
  assert.equal(existsSync('app/places/arizona'), false);
  assert.doesNotMatch(sitemap, /\/arizona/);
  assert.equal(manifest.scope, 'STATE_LEVEL_ONLY');
  assert.equal(manifest.publication.public_arizona_routes, false);
  assert.equal(manifest.publication.county_work, false);
  assert.equal(manifest.publication.city_work, false);
  assert.equal(manifest.publication.specialist_repo_edits, false);
  assert.equal(manifest.publication.ask_arizona_release, 'ATH-AZ-002_AFTER_SPECIALISTS');
});

test('no local Arizona city or county routes', () => {
  for (const slug of localForbidden) {
    assert.equal(existsSync(`app/arizona/${slug}`), false, slug);
    assert.equal(existsSync(`app/places/arizona/${slug}`), false, `places/${slug}`);
    assert.doesNotMatch(sitemap, new RegExp(`/${slug}`));
  }
  assert.match(JSON.stringify(manifest.principles), /no_local_arizona/);
});

test('no Trust Score, paid ranking, or people publication', () => {
  assert.equal(manifest.publication.trust_score, false);
  assert.equal(manifest.publication.paid_ranking, false);
  assert.equal(manifest.publication.people_publication, false);
  assert.match(JSON.stringify(manifest.principles), /no_trust_score/);
  assert.match(sequence, /No Trust Score/);
});

test('SBS report generator is paid and was not purchased', () => {
  const sbs = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'az-difi-sbs-report-generator',
  );
  assert.equal(sbs.access_class, 'OPEN_REPORT_GENERATOR_PAID');
  assert.equal(sbs.acquisition_status, 'NOT_PURCHASED');
  assert.equal(sbs.price_per_row_usd, 0.03);
  assert.equal(sbs.minimum_charge_usd, 30);
  assert.equal(sbsFix.purchased, false);
  assert.equal(sbsFix.producer_is_not_agency, true);
  assert.match(sbsDoc, /\$0\.03 per row/);
  assert.match(JSON.stringify(manifest.principles), /paid_is_not_acquired/);
});

test('NMLS and ACC Entity Search are search-only and not scraped', () => {
  const nmls = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'az-nmls-consumer-access',
  );
  const ecorp = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'az-acc-ecorp-entity-search',
  );
  assert.equal(nmls.access_class, 'OPEN_SEARCH_ONLY');
  assert.equal(ecorp.access_class, 'OPEN_SEARCH_ONLY');
  assert.match(JSON.stringify(manifest.principles), /no_nmls_scrape/);
  assert.match(JSON.stringify(manifest.principles), /no_acc_entity_search_crawl/);
  assert.equal(acquisition.acquired_this_ticket.length, 0);
});

test('HMDA Arizona partition is existing intelligence, not a license roster', () => {
  const hmda = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'az-hmda-cfpb-overlay',
  );
  assert.equal(hmda.record_count, 308338);
  assert.equal(hmda.originations, 183374);
  assert.equal(hmda.counties, 15);
  assert.equal(hmda.lei_state_rows, 953);
  assert.equal(hmdaFix.new_federal_ingest, false);
  assert.equal(hmdaFix.hmda_is_not_license_roster, true);
  assert.equal(hmdaFix.lender_hub_slice.originations, 183374);
  assert.match(JSON.stringify(manifest.principles), /HMDA_is_not_license_roster/);
  assert.equal(ledger.hubs.LENDER.classification, 'INTELLIGENCE_GROWTH_HEAVY');
  assert.equal(ledger.hubs.LENDER.intelligence_not_entity.hmda_originations, 183374);
});

test('Arizona mover licensing gap is official; R-22 is not HHG', () => {
  assert.equal(moveFix.state_hhg_license_roster, false);
  assert.equal(moveFix.state_hhg_registration_law, false);
  assert.match(moveFix.official_line, /no registration law or professional licensing/);
  assert.match(JSON.stringify(manifest.principles), /ROC_R22_is_not_HHG_mover/);
  assert.equal(ledger.hubs.MOVE.PRE_EXISTING_STATE_IDENTITIES, 0);
  assert.equal(ledger.hubs.MOVE.POTENTIAL_NET_NEW_STATE_IDENTITIES, 0);
  assert.equal(ledger.hubs.MOVE.classification, 'SEARCH_PATH_ONLY');
});

test('Investor overlay is principal office, not Arizona state registration', () => {
  const iard = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'az-sec-iard-principal-office-overlay',
  );
  const req = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'az-acc-list-request',
  );
  assert.equal(iard.record_count, 213);
  assert.equal(req.access_class, 'SOURCE_AVAILABLE_BY_REQUEST');
  assert.equal(invFix.request_filed, false);
  assert.equal(invFix.az_principal_office_is_not_state_registration, true);
  assert.equal(invFix.existing_iard_az_principal_office_n, 213);
  assert.match(
    JSON.stringify(manifest.principles),
    /AZ_PRINCIPAL_OFFICE_is_not_state_IA_registration/,
  );
  assert.equal(ledger.hubs.INVESTOR.classification, 'MIXED_ENTITY_AND_INTELLIGENCE');
});

test('remaining-hub classifications and build order are evidence-based', () => {
  assert.equal(manifest.hub_classifications.LENDER, 'INTELLIGENCE_GROWTH_HEAVY');
  assert.equal(manifest.hub_classifications.INVESTOR, 'MIXED_ENTITY_AND_INTELLIGENCE');
  assert.equal(manifest.hub_classifications.INSURANCE, 'SEARCH_PATH_ONLY');
  assert.equal(manifest.hub_classifications.MOVE, 'SEARCH_PATH_ONLY');
  assert.equal(matrix.hubs.LENDER.MARKET_VALUE, 'HIGH');
  assert.equal(matrix.hubs.MOVE.NET_NEW_ENTITY_POTENTIAL, 'LOW');
  assert.equal(order.remaining_sequence[0].ticket, 'AZ-LEND-001');
  assert.equal(order.remaining_sequence[1].ticket, 'AZ-INV-001');
  assert.equal(order.remaining_sequence[2].ticket, 'AZ-INS-001');
  assert.equal(order.remaining_sequence[3].ticket, 'AZ-MOVE-001');
  assert.equal(order.remaining_sequence[4].ticket, 'ATH-AZ-002');
  assert.equal(order.builder_3_next_after_az_con_001, 'AZ-INV-001');
  assert.equal(order.builder_4_next_assignment, 'AZ-LEND-001');
  assert.match(sequence, /AZ-LEND-001/);
  assert.match(sequence, /do not\*\* support assuming Move first/);
});

test('Senior accepted ledger is not reinterpreted; ROC is context only', () => {
  assert.equal(ledger.hubs.SENIOR.POTENTIAL_NET_NEW_CANONICAL_ORGANIZATIONS, 0);
  assert.equal(ledger.hubs.SENIOR.POTENTIAL_NET_NEW_STATE_IDENTITIES, 2776);
  assert.equal(manifest.current_network.senior.expansion_ledger.NET_NEW_STATE_IDENTITIES, 2776);
  assert.equal(manifest.current_network.contractor.status, 'AZ-CON-001_IN_PROGRESS_BUILDER_3');
  assert.equal(
    manifest.current_network.contractor.profile_all_current_context.data_rows,
    58131,
  );
});

test('required Arizona network files exist', () => {
  for (const rel of [
    'data/network/arizona/source-manifest.json',
    'data/network/arizona/identity-source-map.json',
    'data/network/arizona/expansion-ledger-blueprint.json',
    'data/network/arizona/remaining-hub-value-matrix.json',
    'data/network/arizona/acquisition-summary.json',
    'data/network/arizona/build-order.json',
    'docs/arizona/ath-az-001-network-source-map.md',
    'docs/arizona/build-sequence.md',
    'docs/arizona/sbs-access-restrictions.md',
    'docs/arizona/remaining-hub-opportunity.md',
    'scripts/arizona/probe_official.py',
  ]) {
    assert.equal(existsSync(rel), true, rel);
  }
  for (const hub of ['move', 'insurance', 'lender', 'investor']) {
    assert.equal(existsSync(`data/network/arizona/${hub}/source-manifest.json`), true, hub);
  }
});

test('Washington, Texas, California, New Jersey, and Florida public surfaces are unchanged', () => {
  assert.equal(existsSync('app/washington/page.tsx'), true);
  assert.match(sitemap, /\/washington/);
  assert.match(waPage, /washington/);
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.match(njPage, /new-jersey/);
  assert.match(flPage, /florida/);
  assert.match(caPage, /california/);
  assert.match(txPage, /texas/);
  assert.match(sitemap, /\/texas/);
  assert.equal(existsSync('app/new-jersey/monmouth-county/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.equal(existsSync('app/california/page.tsx'), true);
  assert.equal(existsSync('app/texas/page.tsx'), true);
  assert.deepEqual(
    readdirSync('app/california').filter((name) => name !== 'page.tsx'),
    [],
  );
  assert.deepEqual(
    readdirSync('app/texas').filter((name) => name !== 'page.tsx'),
    [],
  );
  assert.deepEqual(
    readdirSync('app/washington').filter((name) => name !== 'page.tsx'),
    [],
  );
});
