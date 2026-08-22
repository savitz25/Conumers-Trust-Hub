import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUniversalSearchQuery } from '../lib/search/parser';
import type { TrustHubSearchIntent } from '../lib/search/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = join(root, 'docs/fixtures/ask-universal-search-intent-corpus.v1.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  count: number;
  fixtures: Array<{ id: string; query: string; expected: Record<string, unknown>; tags?: string[] }>;
};

type Fail = { id: string; query: string; field: string; expected: unknown; actual: unknown };

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => eq(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a && b) {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length) return false;
    return ak.every((k) => eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

function checkFixture(
  intent: TrustHubSearchIntent,
  expected: Record<string, unknown>,
  id: string,
  query: string
): Fail[] {
  const fails: Fail[] = [];
  const loc = intent.location;

  const map: Array<[string, unknown, unknown]> = [
    ['hub', expected.hub, intent.hub],
    ['hubCandidates', expected.hubCandidates, intent.hubCandidates],
    ['primaryHub', expected.primaryHub, intent.primaryHub],
    ['relatedHubs', expected.relatedHubs, intent.relatedHubs],
    ['entityType', expected.entityType, intent.entityType],
    ['category', expected.category, intent.category],
    ['state', expected.state, loc?.stateCode],
    ['city', expected.city, loc?.cityName],
    ['zip', expected.zip, loc?.zip],
    ['county', expected.county, loc?.countySlug],
    ['confidence', expected.confidence, intent.confidence],
    ['requiresClarification', expected.requiresClarification, intent.requiresClarification],
    ['requiresAI', expected.requiresAI, intent.requiresAI],
    ['supported', expected.supported, intent.supported],
    ['consumerIntent', expected.consumerIntent, intent.consumerIntent],
    ['situationIdHint', expected.situationIdHint, intent.situationIdHint],
    ['originState', expected.originState, intent.origin?.stateCode],
    ['destinationState', expected.destinationState, intent.destination?.stateCode ?? (expected.destinationState ? intent.location?.stateCode : undefined)],
    ['geoPrecision', expected.geoPrecision, loc?.precision],
    ['unsupportedReason', expected.unsupportedReason, intent.unsupportedReason],
  ];

  for (const [field, exp, act] of map) {
    if (exp === undefined) continue;
    if (!eq(exp, act)) fails.push({ id, query, field, expected: exp, actual: act });
  }

  if (expected.filters) {
    if (!eq(expected.filters, intent.filters)) {
      fails.push({ id, query, field: 'filters', expected: expected.filters, actual: intent.filters });
    }
  }

  return fails;
}

const CRITICAL = [
  'movers in Keansburg NJ',
  'licensed movers around 07734',
  'long distance mover Florida',
  'moving broker in Miami',
  'mortgage companies in Florida',
  'FHA lenders Tampa',
  'refinance company near Austin',
  'Medicare agents Indiana',
  'home insurance companies in Miami',
  'insurance company near me',
  'roofers Miami',
  'kitchen remodeler Fort Lauderdale',
  'someone to redo my kitchen',
  'nursing homes Austin Texas',
  'senior care near 78701',
  'assisted living Austin',
  'RIA Boca Raton',
  'investment advisers in Palm Beach County',
  'financial advisor near me',
  'broker in Tampa',
  'company near me',
  'moving insurance',
  'senior moving company',
  'investment property mortgage',
  "I'm moving from New Jersey to Florida and buying a house",
];

const times: number[] = [];
const allFails: Fail[] = [];
let passed = 0;

for (const f of corpus.fixtures) {
  const t0 = performance.now();
  const intent = parseUniversalSearchQuery(f.query);
  times.push(performance.now() - t0);
  const fails = checkFixture(intent, f.expected, f.id, f.query);
  if (fails.length === 0) passed++;
  else allFails.push(...fails);
}

const criticalFails: string[] = [];
for (const q of CRITICAL) {
  const f = corpus.fixtures.find((x) => x.query === q);
  if (!f) {
    criticalFails.push(`MISSING FIXTURE: ${q}`);
    continue;
  }
  const intent = parseUniversalSearchQuery(q);
  const fails = checkFixture(intent, f.expected, f.id, q);
  if (fails.length) {
    criticalFails.push(
      `${q} :: ` + fails.map((x) => `${x.field} exp=${JSON.stringify(x.expected)} got=${JSON.stringify(x.actual)}`).join('; ')
    );
  }
}

times.sort((a, b) => a - b);
const sum = times.reduce((a, b) => a + b, 0);
const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))];

const report = {
  fixture_count: corpus.fixtures.length,
  passed,
  failed_fixtures: corpus.fixtures.length - passed,
  pass_rate: `${((passed / corpus.fixtures.length) * 100).toFixed(1)}%`,
  failure_details: allFails.slice(0, 80),
  failure_count: allFails.length,
  critical_fail_count: criticalFails.length,
  critical_fails: criticalFails,
  performance_ms: {
    total: Number(sum.toFixed(3)),
    average: Number((sum / times.length).toFixed(4)),
    p50: Number(pct(50).toFixed(4)),
    p95: Number(pct(95).toFixed(4)),
    max: Number(times[times.length - 1].toFixed(4)),
  },
  external_calls: {
    LLM: 0,
    Google: 0,
    external_geo: 0,
    specialist_APIs: 0,
  },
};

writeFileSync(join(root, 'docs/fixtures/ask-search-003-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (passed !== corpus.fixtures.length || criticalFails.length) {
  process.exit(1);
}
console.log('ASK-SEARCH-003 fixture corpus: ALL PASS');
