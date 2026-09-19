// TH-SEARCH-R1-019D mutation checks. Each mutation re-introduces a defect this integration removes;
// the gate MUST go red. Every file is restored byte-for-byte from memory (never git checkout).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const GATE = ['--experimental-strip-types', '--test', 'lib/network/name-candidates/th-search-r1-019d.test.ts', 'lib/network/name-candidates/th-search-r1-019a.test.ts', 'lib/network/name-candidates/th-search-r1-019a-review1.test.ts'];
const run = () => {
  const r = spawnSync(process.execPath, GATE, { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  return { pass: Number(/ℹ pass (\d+)/.exec(out)?.[1] ?? -1), fail: Number(/ℹ fail (\d+)/.exec(out)?.[1] ?? -1), failing: [...out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i) };
};
const sha = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');
const CR = String.fromCharCode(13);

const mutations = [
  { id: 'A_RESTORED_OLD_V2_DISPATCH', file: 'lib/network/name-candidates/adapters.ts', why: 'Lender name search falls back to the old exact-only v2 identity operation instead of the released v1 candidate operation.',
    find: 'const res = await call(ctx, LENDER_NAME_CANDIDATES_LOCK.url, {', replace: "const res = await call(ctx, NAME_SPECIALIST_LOCKS.lender.url, {" },
  { id: 'B_GLEIF_FRAGMENT_CHECK_LOST', file: 'lib/network/name-candidates/adapters.ts', why: "A GLEIF action is accepted without verifying its #/record/<LEI> fragment matches the record's own LEI.",
    find: "  if (url.origin !== 'https://search.gleif.org' || url.hash !== `#/record/${lei}`) return null;", replace: "  if (url.origin !== 'https://search.gleif.org') return null;" },
  { id: 'C_FAILURE_MISCLASSIFIED_AS_MISS', file: 'lib/network/name-candidates/adapters.ts', why: 'A technical source failure (SOURCE_UNAVAILABLE) is reported as a completed miss instead of a failure.',
    find: "if (state === 'SOURCE_UNAVAILABLE') return outcome(lenderBase, { state: 'TECHNICAL_FAILURE', failureKind: 'unavailable' }, started, page);", replace: "if (state === 'SOURCE_UNAVAILABLE') return outcome(lenderBase, { state: 'COMPLETED_NO_CANDIDATES' }, started, page);" },
];

const report = { generatedAt: new Date().toISOString(), cleanBefore: run(), mutations: [], cleanAfter: null };
if (report.cleanBefore.fail !== 0) throw new Error('gate is not clean before mutation');
for (const m of mutations) {
  const original = readFileSync(m.file); const before = sha(m.file);
  const text = original.toString('utf8').split(CR).join('');
  if (!text.includes(m.find)) throw new Error('anchor missing for ' + m.id);
  let result;
  try { writeFileSync(m.file, text.replace(m.find, m.replace)); result = run(); }
  finally { writeFileSync(m.file, original); }
  report.mutations.push({ id: m.id, why: m.why, detected: result.fail > 0, failedTests: result.failing, restoredByteIdentical: sha(m.file) === before });
}
report.cleanAfter = run();
writeFileSync('docs/qa/th-search-r1-019d/mutation-report.json', JSON.stringify(report, null, 1));
for (const m of report.mutations) console.log((m.detected ? 'DETECTED ' : 'MISSED   ') + m.id + ' -> ' + m.failedTests.length + ' failing: ' + m.failedTests.slice(0, 3).join(' | ') + ' | restored byte-identical: ' + m.restoredByteIdentical);
console.log(`clean before: ${report.cleanBefore.pass}/${report.cleanBefore.fail} | clean after restore: ${report.cleanAfter.pass}/${report.cleanAfter.fail}`);
if (report.mutations.some((m) => !m.detected || !m.restoredByteIdentical) || report.cleanAfter.fail !== 0) process.exit(1);
