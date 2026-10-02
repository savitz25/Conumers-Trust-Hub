/**
 * POST-R1-FINAL-CERT -- certification reporter.
 *
 *   node --experimental-strip-types scripts/cert-post-r1-final.mjs [--mode prep|final] [--out docs/qa/post-r1-final-cert]
 *
 * Runs the frozen pack through the page-order runner and writes:
 *   <out>/<mode>-latest.json   every CertRecord (machine-readable evidence, incl. cold-retry attempts)
 *   <out>/<mode>-latest.md     per-query table, Contractor first-touch table, backlog, six-hub matrix
 * The matrix is only ever GREEN-eligible in `final` mode; `prep` runs print NOT CERTIFIED.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const mode = flag('--mode', 'prep') === 'final' ? 'final' : 'prep';
process.env.POST_R1_CERT_MODE = mode;
const outDir = flag('--out', 'docs/qa/post-r1-final-cert');

const { QUERY_PACK, OBSERVATION_QUERIES, BACKLOG_GUIDED_QUERIES, BACKLOG_FLOWS, KNOWN_LIMITATIONS } = await import('../lib/network/post-r1-final-cert/pack.ts');
const { runCertQuery, runMultiHubFlow } = await import('../lib/network/post-r1-final-cert/runner.ts');

const sha = (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
const startedAt = new Date().toISOString();
const records = [];
for (const entry of QUERY_PACK) {
  const record = await runCertQuery(entry, { mode });
  records.push(record);
  console.log(`${record.id.padEnd(7)} ${record.status.padEnd(16)} ${record.outcomeClass.padEnd(46)} ${record.surface.padEnd(16)} ${String(record.resultState ?? '-').padEnd(28)} ${record.latencyMs}ms${record.attempts ? ` (attempts: ${record.attempts.map((a) => `${a.outcomeClass}@${a.latencyMs}ms`).join(' -> ')})` : ''}`);
}
const backlog = [];
for (const entry of [...OBSERVATION_QUERIES, ...BACKLOG_GUIDED_QUERIES]) backlog.push(await runCertQuery(entry, { mode }));
const flows = {
  stateFarmInsurance: await runMultiHubFlow('is state farm licensed in texas', ['hub:insurance']),
  electricianLender: await runMultiHubFlow('electrician mortgage lender New Jersey', ['hub:lender']),
  electricianContractor: await runMultiHubFlow('electrician mortgage lender New Jersey', ['hub:contractor']),
  backlogF3: await runMultiHubFlow(BACKLOG_FLOWS.F3.query, [...BACKLOG_FLOWS.F3.selections]),
};

const HUBS = ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'];
const hubRecords = (hub) => records.filter((r) => r.hub === hub || (r.hub === 'network' && (r.vertical ?? '').split('+').includes(hub)));
const worst = (rows) => rows.some((r) => r.status === 'FAIL') ? 'FAIL' : rows.some((r) => r.status === 'KNOWN_LIMITATION') ? 'KNOWN_LIMITATION' : rows.length ? 'PASS' : 'NOT_EXERCISED';
const matrix = HUBS.map((hub) => {
  const rows = hubRecords(hub);
  const coldRetries = rows.filter((r) => r.attempts);
  const unavailable = rows.filter((r) => r.failure.kind === 'unavailable');
  const routing = rows.filter((r) => r.outcomeClass === 'WRONG_VERTICAL');
  const identity = rows.filter((r) => r.kind === 'identity' || r.kind === 'identifier');
  const local = rows.filter((r) => ['cohort_local', 'cohort_state', 'product_local'].includes(r.kind));
  const handoff = rows.filter((r) => r.violations.some((v) => v.startsWith('BROKEN_HANDOFF')) || r.outcomeClass === 'BROKEN_HANDOFF');
  const limitations = [...new Set(records.filter((r) => r.knownLimitation && (r.limitationHub ? r.limitationHub === hub : r.hub === hub) && (r.status === 'KNOWN_LIMITATION' || r.status === 'PASS')).map((r) => r.knownLimitation))];
  const overall = worst(rows);
  const performanceLimited = rows.some((r) => r.status === 'KNOWN_LIMITATION' && r.attempts);
  const green = overall === 'PASS' || overall === 'KNOWN_LIMITATION';
  const verdictWord = green ? (performanceLimited ? 'GREEN WITH KNOWN PERFORMANCE LIMITATION' : 'GREEN') : 'BLOCKED';
  return {
    hub,
    specialistStatus: rows.some((r) => r.status === 'FAIL' && r.failure.kind === 'timeout') ? `TIMEOUT (unrecovered) on ${rows.filter((r) => r.status === 'FAIL' && r.failure.kind === 'timeout').map((r) => r.id).join(',')}` : coldRetries.length ? `RESPONDING; cold first-touch TIMEOUT recovered by bounded retry on ${coldRetries.map((r) => r.id).join(',')}` : unavailable.length ? `UNAVAILABLE on ${unavailable.map((r) => r.id).join(',')}` : 'RESPONDING',
    askRoutingStatus: routing.length ? `WRONG_VERTICAL on ${routing.map((r) => r.id).join(',')}` : 'CORRECT',
    identityStatus: identity.length ? `${worst(identity)} (${identity.map((r) => `${r.id}:${r.outcomeClass}`).join('; ')})` : 'NOT_EXERCISED',
    localGeographyStatus: local.length ? `${worst(local)} (${local.map((r) => `${r.id}:${r.outcomeClass}`).join('; ')})` : 'NOT_EXERCISED',
    handoffStatus: handoff.length ? `BROKEN on ${handoff.map((r) => r.id).join(',')}` : 'SAFE (allowlisted https, query context preserved)',
    knownLimitations: limitations,
    verdict: mode !== 'final' ? `NOT CERTIFIED (prep run; would be ${verdictWord})` : verdictWord,
  };
});

const counts = Object.fromEntries(['PASS', 'KNOWN_LIMITATION', 'FAIL'].map((s) => [s, records.filter((r) => r.status === s).length]));
const report = { schema: 'post-r1-final-cert-v2', mode, askSha: sha, startedAt, finishedAt: new Date().toISOString(), counts, matrix, records, backlog, flows, knownLimitations: KNOWN_LIMITATIONS };
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/${mode}-latest.json`, JSON.stringify(report, null, 2));

const esc = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const contractorFirstTouch = records.filter((r) => r.hub === 'contractor');
const md = [
  `# Post-R1 cross-hub certification -- ${mode} run`,
  '',
  `- Ask HEAD: \`${sha}\``,
  `- Mode: **${mode}** ${mode === 'final' ? '' : '(prep -- nothing is certified GREEN by this run)'}`,
  `- Started: ${startedAt}`,
  `- Result: PASS ${counts.PASS} / KNOWN_LIMITATION ${counts.KNOWN_LIMITATION} / FAIL ${counts.FAIL}`,
  '',
  '## Six-hub matrix',
  '',
  '| Hub | Specialist | Ask routing | Identity | Local / geography | Handoff | Known limitations | Verdict |',
  '|---|---|---|---|---|---|---|---|',
  ...matrix.map((m) => `| ${m.hub.toUpperCase()} | ${esc(m.specialistStatus)} | ${esc(m.askRoutingStatus)} | ${esc(m.identityStatus)} | ${esc(m.localGeographyStatus)} | ${esc(m.handoffStatus)} | ${esc(m.knownLimitations.join(', ') || '-')} | **${esc(m.verdict)}** |`),
  '',
  '## Contractor first-touch certification (Section 3 rule)',
  '',
  '| ID | Query | Attempt 1 | Timeout? | Interpretation | Safe next action | Attempt 2 | Status |',
  '|---|---|---|---|---|---|---|---|',
  ...contractorFirstTouch.map((r) => {
    const a1 = r.attempts?.[0], a2 = r.attempts?.[1];
    const interp = `${esc(Object.entries((a1 ?? r).product).filter(([k]) => k === 'trade').map(([, v]) => `trade=${v}`).join(' ') || (r.identifier ? `${r.identifier.type}:${r.identifier.value}` : '-'))}; geo ${esc((a1 ?? r).geography.requested?.display ?? (a1 ?? r).geography.session?.display ?? '-')} -> ${esc((a1 ?? r).geography.executed?.display ?? '-')}`;
    return `| ${r.id} | ${esc(r.query)} | ${a1 ? `${a1.outcomeClass} (${a1.resultState}) ${a1.latencyMs}ms` : `${r.outcomeClass} (${r.resultState ?? '-'}) ${r.latencyMs}ms`} | ${a1 ? 'yes' : r.outcomeClass === 'TECHNICAL_TIMEOUT' ? 'yes (unrecovered)' : 'no'} | ${interp} | ${a1 ? esc(a1.nextActionTypes.join(', ')) : esc(r.nextActions.map((a) => a.type).join(', ') || '-')} | ${a2 ? `${a2.outcomeClass} (${a2.resultState}) ${a2.latencyMs}ms` : 'not needed'} | **${r.status}** |`;
  }),
  '',
  '## Per-query records',
  '',
  '| ID | Query | Surface | Vertical | Entity | Identifier | Product/class | Geography (requested -> executed) | Capability | Result state | Outcome class | Next actions | Failure | Status |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...records.map((r) => `| ${r.id} | ${esc(r.query)} | ${r.surface} | ${esc(r.vertical ?? '-')} | ${esc(r.entity ?? '-')} | ${r.identifier ? `${r.identifier.type}:${r.identifier.value}` : '-'} | ${esc(Object.entries(r.product).map(([k, v]) => `${k}=${v}`).join(' ') || '-')} | ${esc(`${r.geography.requested?.display ?? r.geography.session?.display ?? '-'} -> ${r.geography.executed?.display ?? '-'}`)} | ${esc(r.capability)} | ${esc(`${r.resultState ?? '-'}/${r.resultShape}`)} | ${r.outcomeClass} | ${esc(r.nextActions.map((a) => a.type).join(', ') || r.choices.slice(0, 4).join(', ') || '-')} | ${esc(r.failure.kind ? `${r.failure.kind}${r.failure.code ? ` (${r.failure.code})` : ''}` : '-')} | **${r.status}** |`),
  '',
  '## POST-R1 backlog observations (non-gating, no tickets opened)',
  '',
  ...backlog.map((r) => `- ${r.id} "${r.query}": ${r.surface} -> ${r.outcomeClass} -- ${esc(r.classDetail)}`),
  `- OBS-F3 state farm -> insurance -> legal_insurer: sessionValid=${flows.backlogF3.sessionValid} deadEnd=${flows.backlogF3.deadEnd}; last step: ${esc(JSON.stringify(flows.backlogF3.steps.at(-1)))}`,
  '',
  '## Multi-hub choice flows',
  '',
  ...Object.entries(flows).map(([k, f]) => `- ${k}: sessionValid=${f.sessionValid} deadEnd=${f.deadEnd} steps=${f.steps.map((s) => `${s.action}=>${s.ok ? `${s.phase}/${s.hub ?? 'multi'}` : `THREW ${s.error}`}`).join(' | ')}`),
  '',
].join('\n');
writeFileSync(`${outDir}/${mode}-latest.md`, md);
console.log(`\n${mode}: PASS ${counts.PASS} / KNOWN_LIMITATION ${counts.KNOWN_LIMITATION} / FAIL ${counts.FAIL} -> ${outDir}/${mode}-latest.{json,md}`);
if (counts.FAIL) process.exitCode = 1;
