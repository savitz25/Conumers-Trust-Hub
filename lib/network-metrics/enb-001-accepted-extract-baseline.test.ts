/**
 * ENB-001 — accepted-extract baseline persistence. Pure comparisons over the bundled fallback snapshots
 * (already-accepted repo fixtures). No network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import moveFallback from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import lenderFallback from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };
import { collectCandidates, candidatesToBaseline, readAcceptedBaseline } from '../../scripts/accepted-extract-baseline.mjs';
import {
  ACCEPTED_EXTRACT_BASELINE_REL_PATH,
  ACCEPTED_EXTRACT_BASELINE_SCHEMA,
  ACCEPTED_EXTRACT_PARSER_VERSION,
  MalformedBaselineError,
  REPLACE_BASELINE_CONFIRMATION,
  buildAcceptedExtractEntry,
  buildBaseline,
  buildCandidate,
  compareAcceptedExtract,
  compareBaseline,
  isClockKey,
  notAvailableEntry,
  parseBaseline,
  serializeBaseline,
  splitContentAndClocks,
  type CandidateEntry,
} from './accepted-extract-baseline.ts';
import { FALLBACK_SPECIALIST_FINGERPRINTS, SPECIALIST_OWNED_HUBS, SPECIALIST_SOURCES } from './sources.ts';

const NOW = '2026-09-25T12:00:00.000Z';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const candidateOf = (hub: 'move' | 'lender', payload: unknown): CandidateEntry => buildCandidate(hub, { ok: true, text: JSON.stringify(payload) }, 'test', NOW);
const baselineOf = (hub: 'move' | 'lender', payload: unknown) => buildAcceptedExtractEntry(hub, clone(payload) as Record<string, unknown>, { acceptedFrom: 'test', acceptedAt: '2026-09-01T00:00:00.000Z' });
type Mutable = Record<string, unknown> & { metrics: Array<Record<string, unknown>> };

test('1. same input = NO_CHANGE (and an identical fixture read twice yields the same content and clock hashes)', () => {
  const baseline = baselineOf('move', moveFallback);
  const result = compareAcceptedExtract(baseline, candidateOf('move', moveFallback));
  assert.equal(result.primary, 'NO_CHANGE');
  assert.deepEqual(result.categories, ['NO_CHANGE']);
  assert.equal(result.contentDrift, false);
  const again = baselineOf('move', moveFallback);
  assert.equal(again.content!.contentHash, baseline.content!.contentHash);
  assert.equal(again.clocks!.clockHash, baseline.clocks!.clockHash);
  assert.equal(baseline.content!.sourceFingerprint, FALLBACK_SPECIALIST_FINGERPRINTS.move);
});

test('2. changed content with the same counts = CONTENT_HASH_CHANGED (not RECORD_COUNT_CHANGED)', () => {
  const baseline = baselineOf('move', moveFallback);
  const changed = clone(moveFallback) as Mutable;
  changed.metrics[0].label = `${changed.metrics[0].label} (renamed)`;
  const result = compareAcceptedExtract(baseline, candidateOf('move', changed));
  assert.equal(result.primary, 'CONTENT_HASH_CHANGED');
  assert.ok(!result.categories.includes('RECORD_COUNT_CHANGED'));
  assert.ok(!result.categories.includes('SOURCE_CLOCK_CHANGED'));
  assert.equal(result.contentDrift, true);
});

test('3. changed count = RECORD_COUNT_CHANGED with the exact metric, from and to', () => {
  const baseline = baselineOf('lender', lenderFallback);
  const changed = clone(lenderFallback) as Mutable;
  const target = changed.metrics.find((m) => m.key === 'lenders_lending_institutions')!;
  const before = target.value as number;
  target.value = before + 7;
  const result = compareAcceptedExtract(baseline, candidateOf('lender', changed));
  assert.equal(result.primary, 'RECORD_COUNT_CHANGED');
  assert.ok(result.categories.includes('CONTENT_HASH_CHANGED'), 'a count change is also a content change');
  const records = result.detail.records as { changes: Array<{ key: string; change: string; from: number; to: number }> };
  assert.deepEqual(records.changes, [{ key: 'lenders_lending_institutions', change: 'value', from: before, to: before + 7 }]);
  // adding a metric is a count change too
  const added = clone(lenderFallback) as Mutable;
  added.metrics.push({ ...added.metrics[0], key: 'zz_new_metric', value: 1 });
  const addedResult = compareAcceptedExtract(baseline, candidateOf('lender', added));
  assert.equal(addedResult.primary, 'RECORD_COUNT_CHANGED');
  assert.equal((addedResult.detail.records as { currentMetricCount: number }).currentMetricCount, baseline.content!.metricCount + 1);
});

test('4. clock-only difference = SOURCE_CLOCK_CHANGED; content identity unchanged; overall stays SAME', () => {
  const baseline = baselineOf('lender', lenderFallback);
  const clocked = clone(lenderFallback) as Mutable & { homeProjection: Record<string, unknown>; newestDocumentedSourceAsOf: string };
  clocked.generatedAt = '2026-09-25T09:00:00.000Z';
  clocked.newestDocumentedSourceAsOf = '2026-09-24';
  clocked.metrics[0].sourceAsOf = '2026-09-24';
  clocked.metrics[0].generatedAt = '2026-09-25T09:00:00.000Z';
  clocked.homeProjection.retrievedAt = '2026-09-25T09:00:00.000Z';
  clocked.sourceFingerprint = 'regenerated-upstream-fingerprint'; // upstream re-fingerprinted its clock-only rebuild
  const candidate = candidateOf('lender', clocked);
  assert.ok(candidate.available);
  assert.equal(candidate.entry.content!.contentHash, baseline.content!.contentHash, 'clocks never enter the content hash');
  const result = compareAcceptedExtract(baseline, candidate);
  assert.equal(result.primary, 'SOURCE_CLOCK_CHANGED');
  assert.ok(result.categories.includes('UPSTREAM_FINGERPRINT_CHANGED'));
  assert.ok(!result.categories.includes('CONTENT_HASH_CHANGED'));
  assert.equal(result.contentDrift, false);
  const clocks = result.detail.clocks as { generatedAt: { baseline: string; current: string }; metricSourceAsOfChanges: Array<{ key: string; to: string }> };
  assert.equal(clocks.generatedAt.current, '2026-09-25T09:00:00.000Z');
  assert.equal(clocks.metricSourceAsOfChanges[0].key, (lenderFallback as unknown as Mutable).metrics[0].key);
  const doc = buildBaseline([baseline], { generatedAt: NOW, generatedFrom: 'test' });
  const report = compareBaseline({ state: 'PRESENT', document: doc }, [candidate], { candidateFrom: 'test', checkedAt: NOW });
  assert.equal(report.overall, 'SAME');
  assert.equal(report.counts.clockOnly, 1);
  // a counter that merely ends in "Date" is content, not a clock
  assert.equal(isClockKey('withRefreshDate'), true);
  const { content } = splitContentAndClocks({ withRefreshDate: 12, retrievedAt: '2026-01-01', nested: { as_of: '2026-01-01', n: 2 } });
  assert.deepEqual(content, { withRefreshDate: 12, nested: { n: 2 } });
});

test('5. missing source (HTTP error, bad JSON, failed validation) = SOURCE_MISSING with no counts and no hash', () => {
  const baseline = baselineOf('move', moveFallback);
  for (const fetched of [{ ok: false as const, reason: 'upstream HTTP 503' }, { ok: true as const, text: '{not json' }, { ok: true as const, text: JSON.stringify({ schemaVersion: 'move-network-metrics-v1', metrics: [] }) }]) {
    const candidate = buildCandidate('move', fetched, 'upstream', NOW);
    assert.equal(candidate.available, false);
    const result = compareAcceptedExtract(baseline, candidate);
    assert.equal(result.primary, 'SOURCE_MISSING');
    assert.equal(JSON.stringify(result).includes('metricCount'), false);
    assert.equal(JSON.stringify(result).includes('"value":0'), false);
  }
  const doc = buildBaseline([baseline], { generatedAt: NOW, generatedFrom: 'test' });
  const report = compareBaseline({ state: 'PRESENT', document: doc }, [buildCandidate('move', { ok: false, reason: 'upstream HTTP 503' }, 'upstream', NOW)], { candidateFrom: 'upstream', checkedAt: NOW });
  assert.equal(report.overall, 'SOURCE_UNAVAILABLE');
  assert.equal(report.counts.sourceMissing, 1);
  assert.equal(report.counts.sameContent, 0);
});

test('6. missing baseline: absent file → MISSING_BASELINE; missing hub entry → BASELINE_MISSING / INCOMPLETE_BASELINE', () => {
  const candidate = candidateOf('move', moveFallback);
  const absent = compareBaseline({ state: 'ABSENT' }, [candidate], { candidateFrom: 'test', checkedAt: NOW });
  assert.equal(absent.overall, 'MISSING_BASELINE');
  assert.equal(absent.entries[0].primary, 'BASELINE_MISSING');
  const onlyLender = buildBaseline([baselineOf('lender', lenderFallback)], { generatedAt: NOW, generatedFrom: 'test' });
  const partial = compareBaseline({ state: 'PRESENT', document: onlyLender }, [candidate, candidateOf('lender', lenderFallback)], { candidateFrom: 'test', checkedAt: NOW });
  assert.equal(partial.overall, 'INCOMPLETE_BASELINE');
  assert.equal(partial.entries.find((e) => e.hub === 'move')!.primary, 'BASELINE_MISSING');
  assert.equal(partial.entries.find((e) => e.hub === 'lender')!.primary, 'NO_CHANGE');
  // a NOT_AVAILABLE entry is also "missing", never a zero to compare against
  const na = buildBaseline([notAvailableEntry('move', 'no accepted extract locally', NOW)], { generatedAt: NOW, generatedFrom: 'test' });
  const naResult = compareAcceptedExtract(na.entries[0], candidate, na.parserVersion);
  assert.equal(naResult.primary, 'BASELINE_MISSING');
  assert.ok(!naResult.categories.includes('RECORD_COUNT_CHANGED'));
});

test('7. parser version change: a baseline from another parser, or an upstream contractRevision change, = PARSER_VERSION_CHANGED', () => {
  const baseline = baselineOf('move', moveFallback);
  const otherParser = compareAcceptedExtract(baseline, candidateOf('move', moveFallback), 'ath-accepted-extract-parser-v0');
  assert.equal(otherParser.primary, 'PARSER_VERSION_CHANGED');
  assert.ok(!otherParser.categories.includes('CONTENT_HASH_CHANGED'), 'hashes from different parsers are not compared');
  const rev = clone(moveFallback) as Record<string, unknown>;
  rev.contractRevision = 'ATH-METRICS-R2-99';
  const revResult = compareAcceptedExtract(baseline, candidateOf('move', rev));
  assert.equal(revResult.primary, 'PARSER_VERSION_CHANGED');
  assert.deepEqual(revResult.detail.contractRevision, { baseline: (moveFallback as { contractRevision: string }).contractRevision, current: 'ATH-METRICS-R2-99' });
  assert.ok(!revResult.categories.includes('CONTENT_HASH_CHANGED'), 'contractRevision is version metadata, not dataset content');
});

test('8. malformed baseline: strict parse fails, comparison reports UNKNOWN, overall MISSING_BASELINE', () => {
  const good = serializeBaseline(buildBaseline([baselineOf('move', moveFallback)], { generatedAt: NOW, generatedFrom: 'test' }));
  const cases: Array<[string, string]> = [
    ['not json', '{'],
    ['wrong schema', good.replace(ACCEPTED_EXTRACT_BASELINE_SCHEMA, 'something-else')],
    ['bad hash', good.replace(/"contentHash": "[a-f0-9]{64}"/, '"contentHash": "nope"')],
    ['count/metrics mismatch', good.replace(/"metricCount": (\d+)/, (_m, n) => `"metricCount": ${Number(n) + 1}`)],
    ['duplicate hub', good.replace('"entries": [', '"entries": [' + good.slice(good.indexOf('{', good.indexOf('"entries"')), good.lastIndexOf('}', good.lastIndexOf(']')) + 1) + ',')],
    ['NOT_AVAILABLE with content', good.replace('"state": "ACCEPTED"', '"state": "NOT_AVAILABLE"')],
  ];
  for (const [label, text] of cases) {
    assert.throws(() => parseBaseline(text), MalformedBaselineError, label);
  }
  const report = compareBaseline({ state: 'MALFORMED', reason: 'baseline is not valid JSON' }, [candidateOf('move', moveFallback)], { candidateFrom: 'test', checkedAt: NOW });
  assert.equal(report.overall, 'MISSING_BASELINE');
  assert.equal(report.entries[0].primary, 'UNKNOWN');
  assert.equal(report.baseline.state, 'MALFORMED');
});

test('9. deterministic ordering: hubs, metrics and keys serialize identically regardless of input order', () => {
  const move = baselineOf('move', moveFallback);
  const lender = baselineOf('lender', lenderFallback);
  const a = serializeBaseline(buildBaseline([move, lender], { generatedAt: NOW, generatedFrom: 'test' }));
  const b = serializeBaseline(buildBaseline([lender, move], { generatedAt: NOW, generatedFrom: 'test' }));
  assert.equal(a, b);
  // object key order never changes identity (canonical JSON sorts keys)
  const reorderedKeys = Object.fromEntries(Object.entries(clone(moveFallback) as Mutable).reverse()) as Mutable;
  const c = baselineOf('move', reorderedKeys);
  assert.equal(c.content!.contentHash, move.content!.contentHash, 'object key order does not change identity');
  // array order IS content (a reordered list is a different payload), but the metric rows are compared by key,
  // so a reordered metrics array is CONTENT_HASH_CHANGED without any RECORD_COUNT_CHANGED
  const reorderedMetrics = clone(moveFallback) as Mutable;
  reorderedMetrics.metrics.reverse();
  const d = baselineOf('move', reorderedMetrics);
  assert.notEqual(d.content!.contentHash, move.content!.contentHash);
  assert.deepEqual(d.content!.metrics, move.content!.metrics, 'metric rows are sorted by key regardless of array order');
  const reorderResult = compareAcceptedExtract(move, candidateOf('move', reorderedMetrics));
  assert.equal(reorderResult.primary, 'CONTENT_HASH_CHANGED');
  assert.ok(!reorderResult.categories.includes('RECORD_COUNT_CHANGED'));
  const parsed = parseBaseline(a);
  assert.deepEqual(parsed.entries.map((e) => e.hub), ['lender', 'move']);
  assert.equal(serializeBaseline(parsed), a, 'parse → serialize round-trips byte for byte');
  assert.equal(Object.keys(JSON.parse(a).entries[0]).join(','), 'hub,acceptance,identity,content,clocks');
});

test('10. missing is never zero: NOT_AVAILABLE entries carry null content, and a proposal from a missing local fixture records it', async () => {
  const entry = notAvailableEntry('senior', 'bundled fallback not present locally', NOW);
  assert.equal(entry.content, null);
  assert.equal(entry.clocks, null);
  assert.equal(entry.acceptance.state, 'NOT_AVAILABLE');
  const candidates = await collectCandidates({ hubs: ['move', 'senior'], from: 'bundled', root: '/definitely/not/a/checkout', now: NOW });
  assert.equal(candidates.every((c) => !c.available), true);
  const doc = candidatesToBaseline(candidates, { from: 'bundled', now: NOW });
  assert.equal(doc.entries.length, 2);
  assert.ok(doc.entries.every((e) => e.acceptance.state === 'NOT_AVAILABLE' && e.content === null));
  assert.equal(serializeBaseline(doc).includes('"metricCount": 0'), false);
  // upstream fetch failure via injected fetcher is SOURCE_MISSING, never a zero
  const failing = await collectCandidates({ hubs: ['move'], from: 'upstream', fetcher: (async () => new Response('', { status: 503 })) as unknown as typeof fetch, now: NOW });
  assert.equal(failing[0].available, false);
  assert.match((failing[0] as { reason: string }).reason, /HTTP 503/);
});

test('wiring: committed baseline covers every hub, matches the bundled accepted extracts (NO_CHANGE), and the scheduled check never writes it', async () => {
  const accepted = readAcceptedBaseline(process.cwd());
  assert.equal(accepted.state, 'PRESENT', 'data/network-metrics/accepted-extract-baseline-v1.json must be committed');
  const doc = (accepted as { document: ReturnType<typeof parseBaseline> }).document;
  assert.equal(doc.parserVersion, ACCEPTED_EXTRACT_PARSER_VERSION);
  assert.deepEqual(doc.entries.map((e) => e.hub), [...SPECIALIST_OWNED_HUBS].sort());
  for (const entry of doc.entries) {
    assert.equal(entry.acceptance.state, 'ACCEPTED', `${entry.hub} baseline populated from the bundled accepted extract`);
    assert.equal(entry.content!.sourceFingerprint, FALLBACK_SPECIALIST_FINGERPRINTS[entry.hub], `${entry.hub} baseline provenance matches the pinned fallback fingerprint`);
    assert.equal(entry.identity.publicationUrl, SPECIALIST_SOURCES[entry.hub].publicationUrl);
  }
  const candidates = await collectCandidates({ from: 'bundled', now: NOW });
  const report = compareBaseline(accepted as { state: 'PRESENT'; document: typeof doc }, candidates, { candidateFrom: 'bundled', checkedAt: NOW });
  assert.equal(report.overall, 'SAME');
  assert.ok(report.entries.every((e) => e.primary === 'NO_CHANGE'), JSON.stringify(report.entries.map((e) => [e.hub, e.primary])));
  assert.equal(serializeBaseline(doc), readFileSync(join(process.cwd(), ACCEPTED_EXTRACT_BASELINE_REL_PATH), 'utf8'), 'committed file is in canonical serialized form');

  const script = readFileSync(join(process.cwd(), 'scripts/accepted-extract-baseline.mjs'), 'utf8');
  const writes = [...script.matchAll(/writeFileSync\(join\(root, (ACCEPTED_EXTRACT_[A-Z_]+_REL_PATH)\)/g)].map((m) => m[1]);
  assert.deepEqual(writes.sort(), ['ACCEPTED_EXTRACT_BASELINE_REL_PATH', 'ACCEPTED_EXTRACT_PROPOSAL_REL_PATH']);
  assert.ok(script.indexOf(`option('confirm') !== REPLACE_BASELINE_CONFIRMATION`) < script.indexOf('writeFileSync(join(root, ACCEPTED_EXTRACT_BASELINE_REL_PATH)'), 'accepted file is written only behind the explicit confirmation');
  assert.equal(REPLACE_BASELINE_CONFIRMATION, 'REPLACE-ACCEPTED-EXTRACT-BASELINE');

  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['metrics:check-accepted-baseline'], /accepted-extract-baseline\.mjs --check --from=upstream$/);
  assert.doesNotMatch(pkg.scripts['metrics:check-accepted-baseline'], /--strict|--replace|--propose/);
  assert.match(pkg.scripts['metrics:propose-accepted-baseline'], /--propose/);
  assert.equal(Object.values(pkg.scripts).some((s) => s.includes('--replace')), false, 'no npm script replaces the accepted baseline');
  const workflow = readFileSync(join(process.cwd(), '.github/workflows/specialist-network-health.yml'), 'utf8');
  assert.match(workflow, /metrics:check-accepted-baseline/);
  assert.doesNotMatch(workflow, /propose-accepted-baseline|--replace|REPLACE-ACCEPTED-EXTRACT-BASELINE/);
  assert.doesNotMatch(workflow, /contents: write/);
});
