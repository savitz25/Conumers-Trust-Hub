// TH-SEARCH-R1-019D Astra review 2: rerun of the UNCHANGED frozen R1-019A/R1-019C Lender holdout
// sample (docs/qa/th-search-r1-019a/holdout-frozen.json) through the REAL lenderNameAdapter on the
// review-2-corrected build, hitting the REAL LIVE released endpoint. This is a SUPPLEMENT to the
// review-1 run (docs/qa/th-search-r1-019d/holdout-through-adapter.json, preserved unchanged), not a
// replacement: the sample itself, its order and its keys are read verbatim and never modified. Any
// difference from the review-1 run is recorded honestly; this is run exactly once, not retried.
//
// Supplemented with the namespace-family coverage the review's own probes exposed (fdic-cert,
// gleif-lei) as a SEPARATE section, run live but outside the frozen sample -- plus the combined
// initialism+suffix family from Astra review 1, re-run here to confirm review 2 did not regress it.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { lenderNameAdapter } from '../lib/network/name-candidates/adapters.ts';

const raw = readFileSync('docs/qa/th-search-r1-019a/holdout-frozen.json', 'utf8');
const sampleHash = createHash('sha256').update(raw).digest('hex');
const frozen = JSON.parse(raw);
const rows = frozen.hubs.lender.drawn;

const ctx = () => ({ fetcher: fetch, signal: new AbortController().signal });
const familyOf = (stableKey) => stableKey?.match(/^lender:([a-z]+(?:-[a-z]+)?):/)?.[1] ?? null;

async function checkRow(row) {
  const outcome = await lenderNameAdapter.search(row.name, 1, ctx());
  const expectedLei = row.key.split(':')[1];
  const found = outcome.candidates.find((c) => c.stableKey.endsWith(':' + expectedLei) || c.identifiers.some((id) => id.label === 'LEI' && id.value === expectedLei));
  return {
    scope: row.scope, page: row.page, row: row.row, name: row.name, expectedKey: row.key,
    adapterState: outcome.state, adapterFailureKind: outcome.failureKind ?? null,
    candidateCount: outcome.candidates.length, matchedStableKey: found?.stableKey ?? null,
    matchedNamespaceFamily: found ? familyOf(found.stableKey) : null,
    matchMethod: found?.matchMethod ?? null,
    keyedByDifferentNamespace: Boolean(found) && !found.stableKey.endsWith(':' + expectedLei),
    present: Boolean(found),
  };
}

const results = [];
for (const row of rows) results.push(await checkRow(row));

// Separate addition (unchanged from the review-1 run): the combined initialism+suffix family.
const combinedFamily = [
  { name: 'VIP Mortgage LLC', expectSubstring: '549300PC4MFWQBNVKG88' },
  { name: 'V.I.P. Mortgage Inc', expectSubstring: '549300PC4MFWQBNVKG88' },
];
const combinedResults = [];
for (const c of combinedFamily) {
  const outcome = await lenderNameAdapter.search(c.name, 1, ctx());
  const found = outcome.candidates.find((cand) => cand.stableKey.includes(c.expectSubstring));
  combinedResults.push({ name: c.name, adapterState: outcome.state, candidateCount: outcome.candidates.length, matchedStableKey: found?.stableKey ?? null, present: Boolean(found) });
}

// Separate addition (Astra review 2): live namespace-family coverage for the two families review 1's
// guard did not yet recognize (fdic-cert, gleif-lei) -- NOT part of the frozen sample.
const namespaceFamilyCoverage = [
  { name: 'First State Bank', expectFamily: 'fdic-cert' },
  { name: 'Select Portfolio Servicing', expectFamily: 'gleif-lei' },
];
const namespaceFamilyResults = [];
for (const c of namespaceFamilyCoverage) {
  const outcome = await lenderNameAdapter.search(c.name, 1, ctx());
  const families = outcome.candidates.map((cand) => familyOf(cand.stableKey));
  namespaceFamilyResults.push({ name: c.name, adapterState: outcome.state, candidateCount: outcome.candidates.length, observedFamilies: [...new Set(families)], expectedFamilyPresent: families.includes(c.expectFamily) });
}

// Prior run's presence result, for an honest before/after comparison (this script does not modify that file).
let priorRun = null;
try { priorRun = JSON.parse(readFileSync('docs/qa/th-search-r1-019d/holdout-through-adapter.json', 'utf8')); } catch { /* not available */ }
const priorPresent = priorRun ? new Map(priorRun.results.map((r) => [r.expectedKey, r.present])) : null;
const changedFromPriorRun = priorPresent ? results.filter((r) => priorPresent.has(r.expectedKey) && priorPresent.get(r.expectedKey) !== r.present) : [];

const report = {
  ranAt: new Date().toISOString(),
  sampleFile: 'docs/qa/th-search-r1-019a/holdout-frozen.json',
  sampleSha256: sampleHash,
  sampleUnchangedFromReview1Run: priorRun ? sampleHash === priorRun.sampleSha256 : null,
  sampleFrozenAt: frozen.frozenAt,
  sampleRowCount: rows.length,
  note: 'Live network calls against the real released lender-name-candidates-v1 endpoint via the actual lenderNameAdapter.search(), review-2-corrected build. Sample order/keys read verbatim, never modified. Run exactly once.',
  results,
  presentCount: results.filter((r) => r.present).length,
  droppedOrChanged: results.filter((r) => !r.present),
  namespaceFamiliesObservedInSample: [...new Set(results.map((r) => r.matchedNamespaceFamily).filter(Boolean))],
  changedFromPriorReview1Run: changedFromPriorRun,
  combinedInitialismSuffixFamily: combinedResults,
  namespaceFamilyCoverage: namespaceFamilyResults,
};
writeFileSync('docs/qa/th-search-r1-019d/holdout-through-adapter-review2.json', JSON.stringify(report, null, 1));
console.log(`sample sha256 ${sampleHash} (unchanged from review 1 run: ${report.sampleUnchangedFromReview1Run})`);
console.log(`present through Ask adapter: ${report.presentCount}/${rows.length}`);
console.log(`namespace families observed in the frozen sample: ${report.namespaceFamiliesObservedInSample.join(', ')}`);
if (report.droppedOrChanged.length) console.log('NOT present (reported honestly, not re-run):', JSON.stringify(report.droppedOrChanged, null, 1));
console.log(`changed from the review-1 run: ${changedFromPriorRun.length === 0 ? 'none' : JSON.stringify(changedFromPriorRun, null, 1)}`);
console.log('combined initialism+suffix family:', JSON.stringify(combinedResults, null, 1));
console.log('namespace-family coverage (separate live examples):', JSON.stringify(namespaceFamilyResults, null, 1));
