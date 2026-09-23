/**
 * POST-R1-FINAL-CERT-PREP-001 -- Post-R1 cross-hub certification gate.
 *
 * Runs the FROZEN query pack (lib/network/post-r1-final-cert/pack.ts) through the real page-order
 * pipeline against live specialists and asserts every query ends in an acceptable outcome class
 * with its source-grain and handoff rules intact. Structural only -- no dynamic counts are locked.
 *
 *   prep  mode (default):        pending-release items (Contractor cold path / PR #194) are recorded
 *                                as PENDING_RELEASE and do not fail.
 *   final mode (POST_R1_CERT_MODE=final): nothing pending is tolerated; only PASS / KNOWN_LIMITATION.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { CERT_MODES, DESTINATION_HOST_ALLOWLIST, KNOWN_LIMITATIONS, OBSERVATION_QUERIES, OUTCOME_CLASSES, PENDING_RELEASES, QUERY_PACK, SOURCE_GRAIN_RULES, UNACCEPTABLE_CLASSES, certMode } from './post-r1-final-cert/pack.ts';
import { runCertQuery, runMultiHubFlow, type CertRecord } from './post-r1-final-cert/runner.ts';

const mode = certMode();
const records: CertRecord[] = [];

test('pack integrity: frozen ids are unique, every Founder-required query is present, classes are disjoint', () => {
  assert.ok(CERT_MODES.includes(mode));
  assert.equal(new Set(QUERY_PACK.map((e) => e.id)).size, QUERY_PACK.length);
  assert.equal(new Set(QUERY_PACK.map((e) => e.query.toLowerCase())).size, QUERY_PACK.length);
  const required = [
    'is rocket mortgage legit', 'banks that do helocs in ohio', 'va loan lenders near fort bragg nc',
    'insurance agent in miami', 'insurance agency in broward county', 'medicare supplement agent in ohio', 'is state farm licensed in texas',
    'general contractor in miami', 'roofers in broward', 'plumber in miami', 'verify contractor license CBC015082', 'licensed electrician in boca raton',
    'is abbey delray south medicare certified', 'hospice care for my mom in tampa', 'memory care in orlando', 'assisted living facilities in new jersey', 'home health agencies in miami dade county',
    'AVANTE',
  ];
  for (const q of required) assert.ok(QUERY_PACK.some((e) => e.query === q), `missing required query: ${q}`);
  for (const hub of ['move', 'investor'] as const) {
    const kinds = new Set(QUERY_PACK.filter((e) => e.hub === hub).map((e) => e.kind));
    assert.ok(kinds.has('identity') && kinds.has('identifier'), `${hub} must carry identity + identifier queries`);
    assert.ok(kinds.has('cohort_local') || kinds.has('cohort_state'), `${hub} must carry a geography query`);
  }
  const network = QUERY_PACK.filter((e) => e.hub === 'network').map((e) => e.kind);
  for (const k of ['multi_hub', 'no_result', 'unsupported_source', 'ambiguous_name']) assert.ok(network.includes(k as never), `network section must carry a ${k} query`);
  assert.equal(new Set([...OUTCOME_CLASSES, ...UNACCEPTABLE_CLASSES]).size, OUTCOME_CLASSES.length + UNACCEPTABLE_CLASSES.length);
  for (const e of QUERY_PACK) {
    for (const c of e.accept) assert.ok(OUTCOME_CLASSES.includes(c), `${e.id}: accept must list acceptable classes only`);
    if (e.knownLimitation) assert.ok(e.knownLimitation in KNOWN_LIMITATIONS, `${e.id}: unknown limitation id`);
    if (e.pendingRelease) assert.ok(e.pendingRelease in PENDING_RELEASES, `${e.id}: unknown pending release id`);
  }
  for (const hub of ['lender', 'insurance', 'contractor', 'senior', 'move', 'investor'] as const) assert.ok(SOURCE_GRAIN_RULES[hub].length >= 1, `${hub} needs a source-grain rule`);
  for (const host of DESTINATION_HOST_ALLOWLIST) assert.doesNotMatch(host, /localhost|vercel\.app/);
});

for (const entry of QUERY_PACK) {
  test(`${entry.id} [${entry.hub}/${entry.kind}] "${entry.query}"`, async () => {
    const record = await runCertQuery(entry, { mode });
    records.push(record);
    const summary = `${record.surface} -> ${record.outcomeClass} (${record.classDetail}); vertical=${record.vertical ?? '-'}; geo=${record.geography.session?.kind ?? record.geography.requested?.kind ?? '-'}:${record.geography.session?.display ?? record.geography.requested?.display ?? '-'}; state=${record.resultState ?? '-'}/${record.resultShape}; ${record.latencyMs}ms`;
    assert.notEqual(record.status, 'FAIL', `${entry.id} FAIL: ${record.statusReason}\n  ${summary}`);
    if (record.status === 'PENDING_RELEASE') console.log(`  [PENDING_RELEASE] ${entry.id}: ${record.statusReason}`);
    if (record.status === 'KNOWN_LIMITATION') console.log(`  [KNOWN_LIMITATION] ${entry.id}: ${record.statusReason}`);
  });
}

test('multi-hub choice flow: "is state farm licensed in texas" -> InsuranceTrustHub keeps a valid session, retains TX, and offers class choices', async () => {
  const flow = await runMultiHubFlow('is state farm licensed in texas', ['hub:insurance']);
  assert.ok(flow.sessionValid, JSON.stringify(flow.steps));
  assert.ok(flow.steps[0].choices.includes('hub:insurance'));
  assert.equal(flow.steps[1].hub, 'insurance');
  assert.ok(flow.steps[1].choices.some((c) => c.startsWith('insurance_class:')), 'entity-class choices must follow the hub choice');
  assert.equal(flow.deadEnd, false);
});

test('multi-hub choice flow: "electrician mortgage lender New Jersey" -> both offered hubs are selectable without an invalid session', async () => {
  for (const hub of ['hub:lender', 'hub:contractor']) {
    const flow = await runMultiHubFlow('electrician mortgage lender New Jersey', [hub]);
    assert.ok(flow.sessionValid, `${hub}: ${JSON.stringify(flow.steps)}`);
    assert.equal(flow.steps[1].hub, hub.slice(4));
  }
});

test('observations (non-gating): recorded for Founder triage only', async () => {
  for (const entry of OBSERVATION_QUERIES) {
    const record = await runCertQuery(entry, { mode });
    console.log(`  [OBSERVATION] ${entry.id} "${entry.query}": ${record.surface} -> ${record.outcomeClass} (${record.classDetail})`);
  }
  const legalInsurer = await runMultiHubFlow('is state farm licensed in texas', ['hub:insurance', 'insurance_class:legal_insurer']);
  console.log(`  [OBSERVATION] state farm -> insurance -> legal_insurer: deadEnd=${legalInsurer.deadEnd} last=${JSON.stringify(legalInsurer.steps.at(-1))}`);
});

test('summary', () => {
  const by = (status: CertRecord['status']) => records.filter((r) => r.status === status).map((r) => r.id);
  console.log(`\nPOST-R1 FINAL CERT (${mode}): ${records.length} queries; PASS ${by('PASS').length}; KNOWN_LIMITATION ${by('KNOWN_LIMITATION').length} [${by('KNOWN_LIMITATION').join(', ')}]; PENDING_RELEASE ${by('PENDING_RELEASE').length} [${by('PENDING_RELEASE').join(', ')}]; FAIL ${by('FAIL').length} [${by('FAIL').join(', ')}]`);
  for (const r of records) console.log(`  ${r.id.padEnd(7)} ${r.status.padEnd(16)} ${r.outcomeClass.padEnd(46)} ${r.surface.padEnd(16)} ${(r.vertical ?? '-').padEnd(12)} ${String(r.resultState ?? '-').padEnd(28)} ${r.latencyMs}ms`);
  assert.equal(records.length, QUERY_PACK.length);
});
