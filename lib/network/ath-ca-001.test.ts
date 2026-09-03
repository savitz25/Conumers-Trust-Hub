import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { NJ_PUBLICATION_MANIFEST } from './nj-network.ts';
import { listNjPilotCounties } from './nj-counties.ts';

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
const flPage = readFileSync('app/places/florida/page.tsx', 'utf8');
const njPage = readFileSync('app/new-jersey/page.tsx', 'utf8');
const manifest = JSON.parse(readFileSync('data/network/california/source-manifest.json', 'utf8'));
const contractorOpp = readFileSync('docs/california/contractor-data-opportunity.md', 'utf8');
const classFix = JSON.parse(
  readFileSync('data/network/california/contractor/fixtures/cslb-classifications.json', 'utf8'),
);
const elmsFix = JSON.parse(
  readFileSync('data/network/california/senior/fixtures/elms-locations-sample.json', 'utf8'),
);

test('ATH-CA-001 is research-only: no public California routes or sitemap entries', () => {
  assert.equal(existsSync('app/california'), false);
  assert.equal(existsSync('app/places/california'), false);
  assert.doesNotMatch(sitemap, /\/california/);
  assert.equal(manifest.publication.public_california_routes, false);
  assert.equal(manifest.publication.sitemap_changes, false);
  assert.equal(manifest.scope, 'STATE_LEVEL_ONLY');
});

test('no Trust Score, paid ranking, or best/worst providers', () => {
  assert.equal(manifest.publication.trust_score, false);
  assert.equal(manifest.publication.paid_ranking, false);
  assert.match(contractorOpp, /No Trust Score, no paid ranking, no best\/worst contractors/);
});

test('CSLB is the contractor universe; vendor and PWCR are not licenses', () => {
  const master = manifest.sources.find((s: { source_id: string }) => s.source_id === 'ca-cslb-master-list');
  assert.equal(master.access_class, 'OPEN_BULK_DOWNLOAD');
  assert.equal(master.record_count, 'UNKNOWN');
  assert.equal(master.active_count, 'UNKNOWN');
  assert.equal(master.contact_fields.BUSINESS_EMAIL.count, 0);
  assert.match(contractorOpp, /Vendor ≠ licensed contractor/);
  assert.match(contractorOpp, /PWCR ≠ CSLB/);
  assert.match(contractorOpp, /UNKNOWN/);
});

test('classification fixture matches the official published codes', () => {
  assert.equal(classFix.classifications.length, 46);
  assert.equal(classFix.certifications.length, 2);
  assert.equal(classFix.classifications[0].code, 'A');
  assert.ok(classFix.classifications.some((c: { code: string }) => c.code === 'C-10'));
  assert.ok(classFix.classifications.some((c: { code: string }) => c.code === 'C-61'));
});

test('Senior ELMS fixture keeps official IDs and omits administrator names', () => {
  assert.equal(elmsFix.rows.length, 2);
  assert.equal(elmsFix.rows[0].FACID, '10000001');
  assert.equal(elmsFix.rows[0].CCN, '555120');
  const blob = JSON.stringify(elmsFix);
  assert.doesNotMatch(blob, /FACADMIN|BILLS, KEVAN|DHADDEY/);
});

test('required California network files exist', () => {
  for (const rel of [
    'data/network/california/source-manifest.json',
    'data/network/california/acquisition-summary.json',
    'data/network/california/cross-hub-source-map.json',
    'data/network/california/contractor-priority-source-map.json',
    'data/network/california/contact-source-summary.json',
    'data/network/california/identity-source-map.json',
    'data/network/california/six-hub-value-matrix.json',
    'docs/california/contractor-data-opportunity.md',
    'docs/california/ath-ca-001-network-source-map.md',
    'docs/california/requests/cslb-full-file.md',
    'scripts/california/acquire_official.py',
  ]) {
    assert.equal(existsSync(rel), true, rel);
  }
  for (const hub of ['contractor', 'lender', 'insurance', 'senior', 'move', 'investor']) {
    assert.equal(existsSync(`data/network/california/${hub}/source-manifest.json`), true, hub);
  }
});

test('NJ and Florida public surfaces are unchanged by this ticket', () => {
  assert.equal(NJ_PUBLICATION_MANIFEST.ask_canonical, 'https://www.asktrusthub.com/new-jersey');
  assert.equal(listNjPilotCounties().length, 4);
  assert.match(sitemap, /\/new-jersey\/monmouth-county/);
  assert.match(njPage, /new-jersey/);
  assert.match(flPage, /florida/);
  assert.equal(existsSync('app/new-jersey/monmouth-county/page.tsx'), true);
  assert.equal(existsSync('app/places/florida/page.tsx'), true);
  const extraCa = readdirSync('app').filter((name) => /california/i.test(name));
  assert.deepEqual(extraCa, []);
});
