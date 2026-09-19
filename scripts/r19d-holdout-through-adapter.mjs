// TH-SEARCH-R1-019D Astra review 1: run the UNCHANGED frozen R1-019A/R1-019C Lender holdout sample
// (docs/qa/th-search-r1-019a/holdout-frozen.json) through the REAL lenderNameAdapter on the corrected
// build, hitting the REAL LIVE released endpoint (no mocked transport). Prior Lender-side 20/20 only
// proved the source engine; this is the first time the sample is walked through Ask's mapping layer.
// Sample hash/order/keys are read verbatim and never modified. The combined initialism+suffix family
// (VIP Mortgage LLC vs V.I.P. MORTGAGE, INC.) is added as a SEPARATE case, not mixed into the sample.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { lenderNameAdapter } from '../lib/network/name-candidates/adapters.ts';

const raw = readFileSync('docs/qa/th-search-r1-019a/holdout-frozen.json', 'utf8');
const sampleHash = createHash('sha256').update(raw).digest('hex');
const frozen = JSON.parse(raw);
const rows = frozen.hubs.lender.drawn;

const ctx = () => ({ fetcher: fetch, signal: new AbortController().signal });

async function checkRow(row) {
  const outcome = await lenderNameAdapter.search(row.name, 1, ctx());
  const expectedLei = row.key.split(':')[1];
  // The frozen sample's key is always lei:<LEI> (drawn from the OLD cohort operation). The new v1
  // catalog keys a PUBLISHED-PROFILE institution by its own stable_key (usually nmls-inst:<nmls>),
  // carrying the same LEI only as a secondary identifier -- so match on either the stableKey OR an
  // identifier value, never just the stableKey suffix, or a legitimate re-keying reads as a false drop.
  const found = outcome.candidates.find((c) => c.stableKey.endsWith(':' + expectedLei) || c.identifiers.some((id) => id.label === 'LEI' && id.value === expectedLei));
  return {
    scope: row.scope, page: row.page, row: row.row, name: row.name, expectedKey: row.key,
    adapterState: outcome.state, adapterFailureKind: outcome.failureKind ?? null,
    candidateCount: outcome.candidates.length, matchedStableKey: found?.stableKey ?? null,
    matchMethod: found?.matchMethod ?? null,
    keyedByDifferentNamespace: Boolean(found) && !found.stableKey.endsWith(':' + expectedLei),
    present: Boolean(found),
  };
}

const results = [];
for (const row of rows) results.push(await checkRow(row));

// Separate addition: the combined initialism+suffix family from Astra review 1 (R1), not part of the frozen sample.
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

const report = {
  ranAt: new Date().toISOString(),
  sampleFile: 'docs/qa/th-search-r1-019a/holdout-frozen.json',
  sampleSha256: sampleHash,
  sampleFrozenAt: frozen.frozenAt,
  sampleRowCount: rows.length,
  note: 'Live network calls against the real released lender-name-candidates-v1 endpoint via the actual lenderNameAdapter.search(). Sample order/keys read verbatim, never modified.',
  results,
  presentCount: results.filter((r) => r.present).length,
  droppedOrChanged: results.filter((r) => !r.present),
  combinedInitialismSuffixFamily: combinedResults,
};
writeFileSync('docs/qa/th-search-r1-019d/holdout-through-adapter.json', JSON.stringify(report, null, 1));
console.log(`sample sha256 ${sampleHash}`);
console.log(`present through Ask adapter: ${report.presentCount}/${rows.length}`);
if (report.droppedOrChanged.length) console.log('NOT present (reported honestly, not re-run):', JSON.stringify(report.droppedOrChanged, null, 1));
console.log('combined initialism+suffix family:', JSON.stringify(combinedResults, null, 1));
