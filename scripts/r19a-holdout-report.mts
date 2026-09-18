// TH-SEARCH-R1-019A review-1 finding 5: report preserved holdout runs WITHOUT re-running anything.
// Every request in these runs was scoped to the record's own hub (hubScope = target hub), so every
// failure counted here happened AT THE TARGET HUB -- there were no unrelated hubs in those requests.
import { readFileSync, writeFileSync } from 'node:fs';
type Row = { key: string; name: string; variant: string; input: string; skipped?: string; redundantClarification?: boolean; state?: string; failureKind?: string | null; found?: boolean; foundByName?: boolean; irrelevant?: number; irrelevantDetail?: unknown[] };
type Run = { evaluatedAt: string; results: Record<string, Row[]> };
const COMPLETED = new Set(['COMPLETED_WITH_CANDIDATES', 'COMPLETED_NO_CANDIDATES', 'PARTIAL_TRUNCATED']);
const load = (f: string): Run => JSON.parse(readFileSync(f, 'utf8'));
const runs = { run3: load('docs/qa/th-search-r1-019a/holdout-results.run3.json'), run4: load('docs/qa/th-search-r1-019a/holdout-results.run4.json') };

function perHub(run: Run) {
  return Object.fromEntries(Object.entries(run.results).map(([hub, rows]) => {
    const displayed = rows.filter((r) => r.variant === 'displayed');
    const completed = displayed.filter((r) => !r.redundantClarification && COMPLETED.has(r.state ?? ''));
    const failures = displayed.filter((r) => r.state === 'TECHNICAL_FAILURE');
    return [hub, {
      endToEndRecall: `${displayed.filter((r) => r.found).length}/${displayed.length}`,
      recallWhenTargetSourceCompleted: `${completed.filter((r) => r.found).length}/${completed.length}`,
      targetHubTechnicalFailures: failures.length, failureKinds: failures.reduce((m: Record<string, number>, r) => { const k = r.failureKind ?? 'unknown'; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
      targetHubUnsupported: displayed.filter((r) => r.state === 'UNSUPPORTED_OPERATION').length,
      redundantClarifications: displayed.filter((r) => r.redundantClarification).length,
      nameLevelHits: displayed.filter((r) => r.found || r.foundByName).length,
    }];
  }));
}
type Change = { hub: string; variant: string; input: string; run3: { state?: string; found: boolean }; run4: { state?: string; found: boolean } };
const changed: Change[] = [];
for (const hub of Object.keys(runs.run3.results)) for (const a of runs.run3.results[hub]) {
  const b = runs.run4.results[hub]?.find((r) => r.key === a.key && r.variant === a.variant);
  if (b && (a.found !== b.found || a.state !== b.state)) changed.push({ hub, variant: a.variant, input: a.input, run3: { state: a.state ?? (a.redundantClarification ? 'NOT_NAME_SEARCH' : a.skipped), found: a.found ?? false }, run4: { state: b.state ?? (b.redundantClarification ? 'NOT_NAME_SEARCH' : b.skipped), found: b.found ?? false } });
}
const irrelevant = Object.entries(runs.run4.results).flatMap(([hub, rows]) => rows.filter((r) => (r.irrelevant ?? 0) > 0).map((r) => ({ hub, input: r.input, variant: r.variant, candidates: r.irrelevantDetail })));
const report = { note: 'Both runs are preserved in full. Nothing was re-run to obtain a better sample. Small diagnostic sample; no statistical claim.', scopeOfEveryRequest: 'hubScope = the record\'s own hub, so all failures below are TARGET-hub failures', run3: { evaluatedAt: runs.run3.evaluatedAt, perHub: perHub(runs.run3) }, run4: { evaluatedAt: runs.run4.evaluatedAt, perHub: perHub(runs.run4) }, changedOutcomesRun3ToRun4: changed, irrelevantCandidatesRun4: irrelevant };
writeFileSync('docs/qa/th-search-r1-019a/review-1/holdout-report.json', JSON.stringify(report, null, 1));
for (const run of ['run3', 'run4'] as const) { console.log(`\n== ${run} (${report[run].evaluatedAt})`); for (const [hub, s] of Object.entries(report[run].perHub)) console.log('  ', hub.padEnd(10), JSON.stringify(s)); }
console.log('\nchanged outcomes run3 -> run4:', changed.length); for (const c of changed) console.log('  ', c.hub, c.variant, JSON.stringify(c.input), c.run3.state, c.run3.found, '->', c.run4.state, c.run4.found);
console.log('\nirrelevant candidates (run4):'); for (const i of irrelevant) console.log('  ', i.hub, JSON.stringify(i.input), '->', JSON.stringify(i.candidates).slice(0, 500));
