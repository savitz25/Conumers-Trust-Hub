import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cert = JSON.parse(readFileSync(new URL('../data/search/specialist-search-network-cert-v1.json', import.meta.url)));
const golden = JSON.parse(readFileSync(new URL('../data/search/specialist-search-network-golden-v1.json', import.meta.url)));
const destinations = readFileSync(new URL('../lib/network/research-destinations.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const hubs = ['contractor', 'move', 'lender', 'senior', 'insurance', 'investor'];
const outcomes = ['PASS', 'PARTIAL', 'UNSUPPORTED_SAFE', 'FAIL'];

assert.equal(cert.schema, 'trusthub-specialist-search-network-certification-v1');
assert.equal(cert.contractVersion, 'trusthub-specialist-search-network-v1');
assert.match(cert.askMainSha, /^[0-9a-f]{40}$/);
assert.deepEqual(cert.shared.capabilityStates, ['KNOWN','UNKNOWN','PARTIAL','NOT_ACQUIRED','REQUEST_ONLY','UNSUPPORTED']);
assert.equal(new Set(cert.shared.analyticsEvents).size, 7);
assert.equal(golden.schema, 'trusthub-specialist-search-network-golden-v1');
assert.equal(golden.cases.length, 84);

const totals = Object.fromEntries(outcomes.map((outcome) => [outcome, golden.cases.filter((row) => row.outcome === outcome).length]));
assert.deepEqual(cert.golden, { total: 84, pass: totals.PASS, partial: totals.PARTIAL, unsupportedSafe: totals.UNSUPPORTED_SAFE, fail: totals.FAIL });
assert.equal(totals.FAIL, 0);

for (const hub of ['ask', ...hubs]) {
  const rows = golden.cases.filter((row) => row.hub === hub);
  assert.equal(rows.length, 12, `${hub} must contribute exactly 12 certification questions`);
  assert.equal(new Set(rows.map((row) => row.query)).size, 12, `${hub} queries must be unique`);
}

assert.equal(cert.perHub.length, 6);
for (const hub of hubs) {
  const row = cert.perHub.find((candidate) => candidate.hub === hub);
  assert.ok(row, `missing ${hub} certification`);
  assert.match(row.certifiedMainSha, /^[0-9a-f]{40}$/);
  assert.equal(new URL(row.askUrl).pathname, '/ask');
  assert.equal(row.fail, 0);
  assert.equal(row.goldenTotal, row.pass + row.partial + row.unsupportedSafe + row.fail);
  assert.match(row.analyticsStatus, /ALL_SEVEN_EVENTS/);
  assert.match(row.seoStatus, /NOINDEX_FOLLOW/);
  assert.deepEqual(row.blockers, []);
  const actual = golden.cases.filter((candidate) => candidate.hub === hub);
  assert.equal(row.pass, actual.filter((candidate) => candidate.outcome === 'PASS').length, `${hub} PASS count drift`);
  assert.equal(row.partial, actual.filter((candidate) => candidate.outcome === 'PARTIAL').length, `${hub} PARTIAL count drift`);
  assert.equal(row.unsupportedSafe, actual.filter((candidate) => candidate.outcome === 'UNSUPPORTED_SAFE').length, `${hub} unsupported count drift`);
  assert.match(destinations, new RegExp(`hub:'${hub}'`));
}
for (const id of ['move.ask','lender.research','insurance.research','contractor.ask','senior.search','investor.ask']) assert.match(destinations, new RegExp(`id:'${id}'`));

assert.equal(packageJson.scripts['check:th-search-network-cert'], 'node scripts/check-th-search-network-cert.mjs && node --experimental-strip-types --test lib/network/th-search-network-cert.test.ts');
console.log(`TH-SEARCH-NETWORK-CERT-001 static contract PASS: ${golden.cases.length} cases; PASS ${totals.PASS}; PARTIAL ${totals.PARTIAL}; UNSUPPORTED_SAFE ${totals.UNSUPPORTED_SAFE}; FAIL ${totals.FAIL}.`);
