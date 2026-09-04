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
const manifest = JSON.parse(readFileSync('data/network/washington/source-manifest.json', 'utf8'));
const joinNote = JSON.parse(
  readFileSync('data/network/washington/contractor/fixtures/lni-three-layer-join-note.json', 'utf8'),
);
const contractorOpp = readFileSync('docs/washington/contractor-data-opportunity.md', 'utf8');
const sequence = readFileSync('docs/washington/build-sequence.md', 'utf8');
const oicDoc = readFileSync('docs/washington/oic-access-restrictions.md', 'utf8');
const genFix = JSON.parse(
  readFileSync('data/network/washington/contractor/fixtures/lni-general-sample.json', 'utf8'),
);
const bondFix = JSON.parse(
  readFileSync('data/network/washington/contractor/fixtures/lni-bond-sample.json', 'utf8'),
);
const insFix = JSON.parse(
  readFileSync('data/network/washington/contractor/fixtures/lni-insurance-sample.json', 'utf8'),
);
const seniorFix = JSON.parse(
  readFileSync('data/network/washington/senior/fixtures/dshs-residential-care-sample.json', 'utf8'),
);
const oicFix = JSON.parse(
  readFileSync('data/network/washington/insurance/fixtures/oic-access-note.json', 'utf8'),
);

test('ATH-WA-001 is state-level research only: ATH-WA-002 publishes Ask /washington, still no counties', () => {
  assert.equal(existsSync('app/washington/page.tsx'), true);
  assert.equal(existsSync('app/places/washington'), false);
  assert.match(sitemap, /\/washington/);
  assert.equal(manifest.scope, 'STATE_LEVEL_ONLY');
  assert.equal(manifest.publication.county_work, false);
  assert.equal(manifest.publication.city_work, false);
  assert.equal(manifest.publication.specialist_repo_edits, false);
  assert.deepEqual(
    readdirSync('app/washington').filter((name) => name !== 'page.tsx'),
    [],
  );
});

test('no Trust Score, paid ranking, or people publication', () => {
  assert.equal(manifest.publication.trust_score, false);
  assert.equal(manifest.publication.paid_ranking, false);
  assert.equal(manifest.publication.people_publication, false);
  assert.match(contractorOpp, /No Trust Score, no paid ranking, no best\/worst contractors/);
  assert.match(JSON.stringify(manifest.principles), /no_trust_score/);
});

test('L&I general, bond, and insurance counts are the live CSV ingest', () => {
  const general = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-lni-contractor-general',
  );
  const bond = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-lni-contractor-bond',
  );
  const ins = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-lni-contractor-insurance',
  );
  assert.equal(general.record_count, 160923);
  assert.equal(general.active_count, 75823);
  assert.equal(general.contact_fields.BUSINESS_PHONE.count, 160850);
  assert.equal(general.contact_fields.BUSINESS_EMAIL.count, 0);
  assert.equal(general.contact_fields.WEBSITE.count, 0);
  assert.equal(bond.record_count, 176920);
  assert.equal(bond.unique_license_numbers, 82635);
  assert.equal(ins.record_count, 77005);
  assert.equal(ins.unique_license_numbers, 70953);
});

test('three-layer join is exact on ContractorLicenseNumber and keeps orphans visible', () => {
  const join = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-lni-three-layer-join',
  );
  assert.equal(join.join.bond_orphan_not_in_general, 0);
  assert.equal(join.join.insurance_orphan_not_in_general, 0);
  assert.equal(join.join.active_with_current_bond_and_insurance, 69966);
  assert.equal(join.join.active_without_current_insurance_evidence, 5398);
  assert.equal(joinNote.orphans_bond, 0);
  assert.equal(joinNote.orphans_insurance, 0);
  assert.match(contractorOpp, /BOND ≠ ENDORSEMENT/);
  assert.match(contractorOpp, /INSURANCE RECORD ≠ SAFETY/);
  assert.match(JSON.stringify(manifest.principles), /CURRENT_REGISTRATION_is_not_current_bond_or_insurance/);
});

test('fixtures keep license IDs and omit principal / WAOIC person fields', () => {
  assert.equal(genFix.rows.length, 3);
  assert.equal(genFix.rows[0].ContractorLicenseNumber, 'ECOSTSC758NN');
  assert.equal(bondFix.rows[0].ContractorLicenseNumber, 'ECOSTSC758NN');
  assert.equal(insFix.rows[0].InsuranceAmt, '1000000');
  const rowsBlob = JSON.stringify(genFix.rows) + JSON.stringify(bondFix.rows) + JSON.stringify(insFix.rows);
  assert.doesNotMatch(rowsBlob, /PrimaryPrincipalName|CreatedBy_WAOIC_ID|PrincipalName/);
});

test('OIC individual producer lists are restricted; lookup is search-only', () => {
  const restricted = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-oic-lists-of-individuals',
  );
  const lookup = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-oic-agent-company-lookup',
  );
  assert.equal(restricted.access_class, 'SOURCE_USE_RESTRICTED');
  assert.equal(restricted.use_class, 'SOURCE_USE_RESTRICTED');
  assert.equal(lookup.access_class, 'OPEN_SEARCH_ONLY');
  assert.equal(oicFix.producer_bulk, false);
  assert.match(oicDoc, /SOURCE_USE_RESTRICTED/);
  assert.match(oicDoc, /lists of individuals/);
  assert.match(JSON.stringify(manifest.principles), /OIC_PRODUCER_is_not_agency/);
});

test('Senior GIS current AFH/ALF counts are official; DSHS is not CMS', () => {
  const gis = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-dshs-gis-residential-care',
  );
  assert.equal(gis.record_count, 6968);
  assert.equal(seniorFix.current_counts.AF, 6179);
  assert.equal(seniorFix.current_counts.BH, 557);
  assert.equal(seniorFix.rows[0].LicenseNumber, '754112');
  assert.equal(seniorFix.rows[1].FacilityType, 'BH');
  const rowsBlob = JSON.stringify(seniorFix.rows);
  assert.doesNotMatch(rowsBlob, /FacilityPOC/);
  assert.match(JSON.stringify(manifest.principles), /DSHS_is_not_CMS/);
});

test('build sequence is evidence-based: Contractor first, not a Texas mirror', () => {
  assert.match(sequence, /WA-CON-001/);
  assert.match(sequence, /WA-SEN-001/);
  assert.match(sequence, /Contractor is \*\*first\*\*/);
  assert.match(sequence, /do not\*\* support copying Texas/);
  assert.match(sequence, /Insurance is \*\*not\*\* early Washington/);
});

test('UTC household goods is documented, not scraped; lender has no fake denominator', () => {
  const utc = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-utc-household-goods-directory',
  );
  const dfi = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'wa-dfi-verify-license',
  );
  assert.equal(utc.record_count, 285);
  assert.equal(utc.acquisition_status, 'DOCUMENTED_NOT_SCRAPED');
  assert.equal(dfi.record_count, 'UNKNOWN');
  assert.match(JSON.stringify(manifest.principles), /UTC_STATE_AUTHORITY_is_not_FMCSA/);
  assert.match(JSON.stringify(manifest.principles), /UBI_is_not_professional_license/);
  assert.match(contractorOpp, /UBI is \*\*not\*\* a professional license/);
});

test('required Washington network files exist', () => {
  for (const rel of [
    'data/network/washington/source-manifest.json',
    'data/network/washington/acquisition-summary.json',
    'data/network/washington/cross-hub-source-map.json',
    'data/network/washington/contact-source-summary.json',
    'data/network/washington/identity-source-map.json',
    'data/network/washington/six-hub-value-matrix.json',
    'docs/washington/contractor-data-opportunity.md',
    'docs/washington/ath-wa-001-network-source-map.md',
    'docs/washington/build-sequence.md',
    'docs/washington/oic-access-restrictions.md',
    'scripts/washington/probe_official.py',
    'scripts/washington/acquire_lni.py',
    'scripts/washington/write_network.py',
  ]) {
    assert.equal(existsSync(rel), true, rel);
  }
  for (const hub of ['contractor', 'lender', 'insurance', 'senior', 'move', 'investor']) {
    assert.equal(existsSync(`data/network/washington/${hub}/source-manifest.json`), true, hub);
  }
});

test('NJ, Florida, California, and Texas public surfaces are unchanged by this ticket', () => {
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
});
