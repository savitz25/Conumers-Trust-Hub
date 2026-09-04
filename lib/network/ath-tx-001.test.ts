import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const njPage = readFileSync('app/new-jersey/page.tsx', 'utf8');
const caPage = readFileSync('app/california/page.tsx', 'utf8');
const manifest = JSON.parse(readFileSync('data/network/texas/source-manifest.json', 'utf8'));
const contractorOpp = readFileSync('docs/texas/contractor-data-opportunity.md', 'utf8');
const sequence = readFileSync('docs/texas/build-sequence.md', 'utf8');
const graph = JSON.parse(
  readFileSync('data/network/texas/insurance/fixtures/tdi-appointment-graph-note.json', 'utf8'),
);
const rmpFix = JSON.parse(
  readFileSync('data/network/texas/contractor/fixtures/tsbpe-rmp-sample.json', 'utf8'),
);
const elecFix = JSON.parse(
  readFileSync('data/network/texas/contractor/fixtures/tdlr-electrical-contractor-sample.json', 'utf8'),
);
const smlFix = JSON.parse(
  readFileSync('data/network/texas/lender/fixtures/sml-enforcement-sample.json', 'utf8'),
);

test('ATH-TX-001 is state-level research only: ATH-TX-002 publishes Ask /texas, still no counties', () => {
  assert.equal(existsSync('app/texas/page.tsx'), true);
  assert.equal(existsSync('app/places/texas'), false);
  assert.match(sitemap, /\/texas/);
  assert.equal(manifest.scope, 'STATE_LEVEL_ONLY');
  assert.equal(manifest.publication.county_work, false);
  assert.equal(manifest.publication.specialist_repo_edits, false);
  assert.deepEqual(
    readdirSync('app/texas').filter((name) => name !== 'page.tsx'),
    [],
  );
});

test('no Trust Score, paid ranking, or people publication', () => {
  assert.equal(manifest.publication.trust_score, false);
  assert.equal(manifest.publication.paid_ranking, false);
  assert.equal(manifest.publication.people_publication, false);
  assert.match(contractorOpp, /No Trust Score, no paid ranking, no best\/worst contractors/);
});

test('Texas has no statewide general-contractor license; vendor is not a license', () => {
  const gap = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'tx-no-statewide-general-contractor-license',
  );
  assert.equal(gap.record_count, 0);
  assert.match(contractorOpp, /Vendor ≠ licensed contractor/);
  assert.match(contractorOpp, /no CSLB equivalent/i);
  assert.match(JSON.stringify(manifest.principles), /TEXAS_HAS_NO_STATEWIDE_GENERAL_CONTRACTOR_LICENSE/);
  const ac = manifest.sources.find((s: { source_id: string }) => s.source_id === 'tx-tdlr-ac-contractor');
  assert.equal(ac.record_count, 20427);
  assert.equal(ac.contact_fields.BUSINESS_PHONE.count, 0);
  const ec = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'tx-tdlr-electrical-contractor',
  );
  assert.equal(ec.record_count, 14036);
  assert.equal(ec.contact_fields.BUSINESS_PHONE.count, 14031);
});

test('TDI appointment graph counts are live and people stay unpublished', () => {
  const agencies = manifest.sources.find((s: { source_id: string }) => s.source_id === 'tx-tdi-agencies');
  const appts = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'tx-tdi-agency-appointments',
  );
  const people = manifest.sources.find(
    (s: { source_id: string }) => s.source_id === 'tx-tdi-person-licenses',
  );
  assert.equal(agencies.record_count, 56625);
  assert.equal(agencies.unique_npn, 43597);
  assert.equal(appts.record_count, 622019);
  assert.equal(appts.unique_naic, 1414);
  assert.equal(people.record_count, 962001);
  assert.equal(people.publication, 'people_suppressed');
  assert.equal(graph.graph.agency_appointment_rows, 622019);
  assert.equal(graph.graph.person_publication, false);
});

test('TSBPE RMP fixture keeps license IDs and omits person names', () => {
  assert.equal(rmpFix.rows.length, 2);
  assert.equal(rmpFix.rows[0].LICENSE_NBR, '16345');
  assert.equal(rmpFix.rows[0].PLUMB_COMPANY, 'SAWYER PLUMBING SERVICE');
  const blob = JSON.stringify(rmpFix);
  assert.doesNotMatch(blob, /SAWYER, LARRY|LAST_NAME|FIRST_NAME/);
  assert.equal(elecFix.rows[0]['LICENSE NUMBER'], '17000');
});

test('SML fixture only attaches on NMLS ID', () => {
  assert.equal(smlFix.rows.length, 1);
  assert.equal(smlFix.rows[0]['NMLS ID'], '374994');
  assert.equal(smlFix.nmls_nonempty, 2493);
});

test('build sequence is evidence-based: Insurance then Contractor, not Senior first', () => {
  assert.match(sequence, /TX-INS-001/);
  assert.match(sequence, /TX-CON-001/);
  assert.match(sequence, /not an early Texas specialist/);
  assert.match(sequence, /TULIP is search-only/);
});

test('required Texas network files exist', () => {
  for (const rel of [
    'data/network/texas/source-manifest.json',
    'data/network/texas/acquisition-summary.json',
    'data/network/texas/cross-hub-source-map.json',
    'data/network/texas/contact-source-summary.json',
    'data/network/texas/identity-source-map.json',
    'data/network/texas/six-hub-value-matrix.json',
    'docs/texas/contractor-data-opportunity.md',
    'docs/texas/ath-tx-001-network-source-map.md',
    'docs/texas/insurance-appointment-graph.md',
    'docs/texas/build-sequence.md',
    'scripts/texas/probe_official.py',
    'scripts/texas/write_network.py',
  ]) {
    assert.equal(existsSync(rel), true, rel);
  }
  for (const hub of ['contractor', 'lender', 'insurance', 'senior', 'move', 'investor']) {
    assert.equal(existsSync(`data/network/texas/${hub}/source-manifest.json`), true, hub);
  }
});

test('NJ, Florida, and California public surfaces are unchanged by this ticket', () => {
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.match(njPage, /new-jersey/);
  assert.match(flPage, /florida/);
  assert.match(caPage, /california/);
  assert.equal(existsSync('app/new-jersey/monmouth-county/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  assert.equal(existsSync('app/california/page.tsx'), true);
  assert.deepEqual(
    readdirSync('app/california').filter((name) => name !== 'page.tsx'),
    [],
  );
  const extraTx = readdirSync('app').filter((name) => /texas/i.test(name));
  assert.deepEqual(extraTx, ['texas']);
});
