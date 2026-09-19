// TH-SEARCH-R1-019D mutation checks. Each mutation re-introduces a defect this integration removes;
// the gate MUST go red. Every file is restored byte-for-byte from memory (never git checkout).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const GATE = ['--experimental-strip-types', '--test', 'lib/network/name-candidates/th-search-r1-019d.test.ts', 'lib/network/name-candidates/th-search-r1-019d-review1.test.ts', 'lib/network/name-candidates/th-search-r1-019a.test.ts', 'lib/network/name-candidates/th-search-r1-019a-review1.test.ts'];
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
  // -------------------------------------------------------------- Astra review 1 (CHANGES_REQUESTED on 5d1f31e) repairs
  { id: 'D_R1_INITIALISM_FALLBACK_UNCOLLAPSED', file: 'lib/network/name-candidates/adapters.ts', why: 'The token-sharing fallback in rowRelatesToName compares raw (uncollapsed) tokens again, so a differing legal suffix (VIP Mortgage LLC vs V.I.P. MORTGAGE, INC.) defeats initialism equivalence.',
    find: 'const all = normalizedTokens(suppliedName);\n  const matched = normalizedTokens(matchedName);', replace: 'const all = nameTokens(suppliedName);\n  const matched = nameTokens(matchedName);' },
  { id: 'E_R2_CONTINUATION_NULLED_ON_HASMORE', file: 'lib/network/name-candidates/adapters.ts', why: "The hub-supplied continuation is dropped whenever upstream hasMore is true, so Ask holds no way forward once its own cap is reached with more source records remaining.",
    find: 'const continuation = lenderResearchAction(name, continuationRaw.url);', replace: 'const continuation = hasMore ? null : lenderResearchAction(name, continuationRaw.url);' },
  { id: 'F_R3_PAGINATION_VALIDATION_BYPASSED', file: 'lib/network/name-candidates/adapters.ts', why: 'Malformed/inconsistent pagination (wrong page, row-count mismatch, impossible hasMore) is silently accepted instead of failing closed.',
    find: 'if (!validLenderPagination(pagination, page, HUB_PAGE_SIZE, rawCandidates.length)) {', replace: 'if (false && !validLenderPagination(pagination, page, HUB_PAGE_SIZE, rawCandidates.length)) {' },
  { id: 'G_R3_GLEIF_BYPASS_VIA_PROFILE_TYPE', file: 'lib/network/name-candidates/adapters.ts', why: 'A PROFILE-typed action secretly pointed at a GLEIF URL bypasses the strict LEI-fragment binding and is waved through as an official source.',
    find: "const act = originOf(rowAction.url) === 'https://search.gleif.org' ? lenderOfficialAction(rowAction.url, lei)\n        : actionType === 'PROFILE' ? action('lender', rowAction.url, 'PROFILE', 'LenderTrustHub')",
    replace: "const act = actionType === 'PROFILE' ? action('lender', rowAction.url, 'PROFILE', 'LenderTrustHub')" },
  { id: 'H_R3_NO_MATCH_CONTRADICTION_UNCHECKED', file: 'lib/network/name-candidates/adapters.ts', why: 'A NO_MATCH result that also supplies candidate rows is silently admitted as real candidates instead of failing as a contradictory payload.',
    find: "    if (state === 'NO_MATCH' && rawCandidates.length > 0) {\n      return outcome(lenderBase, { state: 'TECHNICAL_FAILURE', failureKind: 'invalid_response', message: 'The specialist reported no match but returned candidate records.' }, started, page);\n    }\n",
    replace: '' },
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
