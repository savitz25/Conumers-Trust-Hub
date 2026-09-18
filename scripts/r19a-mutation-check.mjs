// TH-SEARCH-R1-019A mutation checks. Each mutation re-introduces a defect this milestone removes;
// the gate MUST go red. Every file is restored byte-for-byte from memory and the clean gate is re-run.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const GATE = ['--experimental-strip-types', '--test', 'lib/network/name-candidates/th-search-r1-019a.test.ts'];
const run = () => { const r = spawnSync(process.execPath, GATE, { encoding: 'utf8' }); const out = r.stdout + r.stderr; return { status: r.status, pass: Number(/ℹ pass (\d+)/.exec(out)?.[1] ?? -1), fail: Number(/ℹ fail (\d+)/.exec(out)?.[1] ?? -1), failing: [...out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i) }; };

const mutations = [
  { id: 'A_RESTORED_HUB_REQUIRED_GATE', file: 'lib/network/name-candidates/decision.ts', why: 'A name must again have a known hub before it can be searched.',
    find: "  const distinctive = distinctiveTokens(name, plan);", replace: "  if (!plan.primaryHub) return not('MUTATION_HUB_REQUIRED');\n  const distinctive = distinctiveTokens(name, plan);" },
  { id: 'B_DROPPED_NAME_FILTER_GUARD', file: 'lib/network/name-candidates/adapters.ts', why: 'An unfiltered cohort is admitted as name candidates.',
    find: "  const admitted = mapped.filter((c) => rowRelatesToName(name, c.matchedName, c.matchMethod));", replace: "  const admitted = mapped;" },
  { id: 'C_SILENT_OMISSION_OF_RESPONDING_HUB', file: 'lib/network/name-candidates/orchestrator.ts', why: 'An enabled, responding hub is silently dropped from the fan-out.',
    find: "  const order = [...priority, ...SPECIALIST_HUB_IDS.filter((hub) => !priority.includes(hub))];", replace: "  const order = [...priority, ...SPECIALIST_HUB_IDS.filter((hub) => !priority.includes(hub))].filter((hub) => hub !== 'senior');" },
];

const report = { generatedAt: new Date().toISOString(), cleanBefore: run(), mutations: [], cleanAfter: null };
if (report.cleanBefore.fail !== 0) throw new Error('gate is not clean before mutation');
for (const m of mutations) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.find)) throw new Error(`anchor missing for ${m.id}`);
  try { writeFileSync(m.file, original.replace(m.find, m.replace)); const r = run(); report.mutations.push({ id: m.id, why: m.why, detected: r.fail > 0, failedTests: r.failing }); }
  // Restore the EXACT pre-mutation bytes from memory. Never `git checkout`: that would silently
  // discard any uncommitted work in the file being mutated.
  finally { writeFileSync(m.file, original); }
}
report.cleanAfter = run();
writeFileSync('docs/qa/th-search-r1-019a/mutation-report.json', JSON.stringify(report, null, 1));
for (const m of report.mutations) console.log(`${m.detected ? 'DETECTED' : 'MISSED  '} ${m.id} -> ${m.failedTests.length} failing: ${m.failedTests.map((t) => t.slice(0, 40)).join(' | ')}`);
console.log(`clean before: ${report.cleanBefore.pass} pass/${report.cleanBefore.fail} fail | clean after restore: ${report.cleanAfter.pass} pass/${report.cleanAfter.fail} fail`);
if (report.mutations.some((m) => !m.detected) || report.cleanAfter.fail !== 0) process.exit(1);
