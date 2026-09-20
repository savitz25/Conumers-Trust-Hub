// TH-SEARCH-R1-019G mutation checks. Each mutation re-introduces a defect this integration removes;
// the gate MUST go red. Every file is restored byte-for-byte from memory (never git checkout).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const GATE = ['--experimental-strip-types', '--test', 'lib/network/name-candidates/th-search-r1-019g.test.ts', 'lib/network/name-candidates/th-search-r1-019a.test.ts'];
const run = () => {
  const r = spawnSync(process.execPath, GATE, { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  return { pass: Number(/ℹ pass (\d+)/.exec(out)?.[1] ?? -1), fail: Number(/ℹ fail (\d+)/.exec(out)?.[1] ?? -1), failing: [...out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i) };
};
const sha = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');
const CR = String.fromCharCode(13);
const FILE = 'lib/network/name-candidates/adapters.ts';

const mutations = [
  { id: 'A_OLD_FREE_TEXT_API_RESTORED', file: FILE, why: 'Senior NAME_CANDIDATES falls back to the old free-text senior-ask-v1 engine instead of the released senior-name-candidates-v1 operation.',
    find: "const res = await call(ctx, SENIOR_NAME_CANDIDATES_LOCK.url, {\n      method: 'POST', headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ operation: 'provider_name_candidates', name, page }),\n    });",
    replace: "const url = new URL('https://www.seniortrusthub.com/api/ask'); url.searchParams.set('q', name);\n    const res = await call(ctx, url, { method: 'GET' });" },
  { id: 'B_PREDICATE_PROOF_REMOVED', file: FILE, why: 'A response that never proves the name predicate was applied (predicateApplied !== true) is admitted anyway.',
    find: "    if (nameBlock.predicateApplied !== true || !echoesName(text(nameBlock.supplied), name)) {\n      return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);\n    }\n    if (!Array.isArray(p.candidates)) {\n      return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'invalid_response', message: 'The specialist did not return a candidates array.' }, started, page);",
    replace: "    if (!Array.isArray(p.candidates)) {\n      return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'invalid_response', message: 'The specialist did not return a candidates array.' }, started, page);" },
  { id: 'C_SUPPLIED_NAME_ECHO_REMOVED', file: FILE, why: 'The specialist’s echoed name is never compared against the name Ask actually sent, so a cross-wired/stale response could be admitted.',
    find: "if (nameBlock.predicateApplied !== true || !echoesName(text(nameBlock.supplied), name)) {\n      return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);\n    }",
    replace: "if (nameBlock.predicateApplied !== true) {\n      return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'name_filter_not_proven' }, started, page);\n    }" },
  { id: 'D_UNSUPPORTED_CONVERTED_TO_MISS', file: FILE, why: 'UNSUPPORTED_OPERATION (a category-intent decline) is reported as a completed miss instead of unsupported.',
    find: "if (state === 'UNSUPPORTED_OPERATION') {\n      // The specialist itself declined this input (a care-category/quality-intent phrase, not a\n      // structured provider name). Not evidence a matching provider does not exist, never a miss.\n      return outcome(seniorBase, { state: 'UNSUPPORTED_OPERATION', message: text(p.message) }, started, page);\n    }",
    replace: "if (state === 'UNSUPPORTED_OPERATION') {\n      return outcome(seniorBase, { state: 'COMPLETED_NO_CANDIDATES' }, started, page);\n    }" },
  { id: 'E_SOURCE_FAILURE_CONVERTED_TO_MISS', file: FILE, why: 'TECHNICAL_FAILURE (a genuine source outage) is reported as a completed miss instead of a failure.',
    find: "if (state === 'TECHNICAL_FAILURE') return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'unavailable', message: text(p.message) }, started, page);",
    replace: "if (state === 'TECHNICAL_FAILURE') return outcome(seniorBase, { state: 'COMPLETED_NO_CANDIDATES' }, started, page);" },
  { id: 'F_PROVIDER_CLASS_INFERRED', file: FILE, why: 'Every row is forced to nursing_home regardless of the specialist’s own reported class, merging Nursing Home/Home Health/Hospice into one denominator.',
    find: "const cls = text(row.providerClass);",
    replace: "const cls = 'nursing_home';" },
  { id: 'G_CCN_OMITTED_FROM_STABLE_KEY', file: FILE, why: 'The stable key drops the CCN, so two different providers of the same class could collide/dedupe onto one card.',
    find: 'stableKey: `senior:${cls}:${ccn}`, displayName,',
    replace: 'stableKey: `senior:${cls}`, displayName,' },
  { id: 'H_ASK_CONSTRUCTS_OWN_PROFILE_URL', file: FILE, why: 'Ask builds its own Senior profile URL from the CCN/slug instead of only ever using the specialist-supplied action.href.',
    find: "const act = text(rowAction.type) === 'PROFILE' ? seniorProfileAction(ccn, rowAction.href) : null;",
    replace: "const act = { type: 'PROFILE' as const, href: `https://www.seniortrusthub.com/facility/cms/${ccn}/profile`, label: 'Open SeniorTrustHub profile' };" },
  { id: 'I_PAGE_MISMATCH_ADMITTED', file: FILE, why: 'Pagination whose reported page disagrees with the page Ask requested is silently accepted.',
    find: 'if (!validSeniorPagination(pagination, page)) {',
    replace: 'if (false) {' },
  { id: 'J_MALFORMED_ARRAY_BECOMES_ZERO_RESULT_SUCCESS', file: FILE, why: 'A non-array `candidates` field (a malformed payload) is coerced into an empty array and reported as a completed miss instead of a technical failure.',
    find: "    if (!Array.isArray(p.candidates)) {\n      return outcome(seniorBase, { state: 'TECHNICAL_FAILURE', failureKind: 'invalid_response', message: 'The specialist did not return a candidates array.' }, started, page);\n    }\n    const rawCandidates = p.candidates;",
    replace: '    const rawCandidates = Array.isArray(p.candidates) ? p.candidates : [];' },
];

const report = { generatedAt: new Date().toISOString(), cleanBefore: run(), mutations: [], cleanAfter: null };
if (report.cleanBefore.fail !== 0) throw new Error('gate is not clean before mutation: ' + JSON.stringify(report.cleanBefore));
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
writeFileSync('docs/qa/th-search-r1-019g/mutation-report.json', JSON.stringify(report, null, 1));
for (const m of report.mutations) console.log((m.detected ? 'DETECTED ' : 'MISSED   ') + m.id + ' -> ' + m.failedTests.length + ' failing: ' + m.failedTests.slice(0, 3).join(' | ') + ' | restored byte-identical: ' + m.restoredByteIdentical);
console.log(`clean before: ${report.cleanBefore.pass}/${report.cleanBefore.fail} | clean after restore: ${report.cleanAfter.pass}/${report.cleanAfter.fail}`);
if (report.mutations.some((m) => !m.detected || !m.restoredByteIdentical) || report.cleanAfter.fail !== 0) process.exit(1);
