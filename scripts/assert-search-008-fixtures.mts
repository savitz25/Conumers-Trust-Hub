/**
 * ASK-SEARCH-008 additional Senior/Investor parser fixtures.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUniversalSearchQuery } from '../lib/search/parser';

const root = process.cwd();
const path = join(root, 'docs/fixtures/ask-search-008-senior-investor-intent.v1.json');
const corpus = JSON.parse(readFileSync(path, 'utf8')) as {
  fixtures: Array<{ id: string; query: string; expected: Record<string, unknown> }>;
};

let failed = 0;
let passed = 0;

function check(id: string, cond: boolean, detail: string) {
  if (!cond) {
    console.error(`FAIL ${id}: ${detail}`);
    failed++;
  } else {
    passed++;
  }
}

for (const f of corpus.fixtures) {
  const intent = parseUniversalSearchQuery(f.query);
  const exp = f.expected;
  if (exp.hub !== undefined) check(f.id, intent.hub === exp.hub, `hub got ${intent.hub}`);
  if (exp.entityType !== undefined) {
    check(f.id, intent.entityType === exp.entityType, `entityType got ${intent.entityType}`);
  }
  if (exp.supported !== undefined) {
    check(f.id, intent.supported === exp.supported, `supported got ${String(intent.supported)}`);
  }
  if (exp.unsupportedReason !== undefined) {
    check(
      f.id,
      intent.unsupportedReason === exp.unsupportedReason,
      `unsupportedReason got ${intent.unsupportedReason}`
    );
  }
  if (exp.state !== undefined) {
    check(f.id, intent.location?.stateCode === exp.state, `state got ${intent.location?.stateCode}`);
  }
  if (exp.city !== undefined) {
    check(f.id, intent.location?.cityName === exp.city, `city got ${intent.location?.cityName}`);
  }
  if (exp.confidence !== undefined) {
    check(f.id, intent.confidence === exp.confidence, `confidence got ${intent.confidence}`);
  }
  if (exp.requiresClarification !== undefined) {
    check(
      f.id,
      intent.requiresClarification === exp.requiresClarification,
      `requiresClarification got ${intent.requiresClarification}`
    );
  }
}

if (failed) {
  console.error(`ASK-SEARCH-008 fixtures FAILED (${failed}); passed field-checks=${passed}`);
  process.exit(1);
}
console.log(`ASK-SEARCH-008 fixtures: ${corpus.fixtures.length}/${corpus.fixtures.length} PASS`);
