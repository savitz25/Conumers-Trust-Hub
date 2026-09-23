/**
 * POST-R1-FINAL-CERT -- Post-R1 cross-hub certification gate.
 *
 * Runs the FROZEN query pack (lib/network/post-r1-final-cert/pack.ts) through the real page-order
 * pipeline against live specialists and asserts every query ends in an acceptable outcome class
 * with its source-grain and handoff rules intact. Structural only -- no dynamic counts are locked.
 *
 * Statuses: PASS, KNOWN_LIMITATION (a frozen limitation, still honestly disclosed), FAIL.
 * A Contractor first-touch TIMEOUT is never simply ignored: it is KNOWN_LIMITATION only under the
 * strict Section 3 cold-retry rule (`evaluateColdRetry`), which is unit-tested offline below.
 *
 *   POST_R1_CERT_MODE=prep  (default) dry run -- identical gate, matrix verdict never GREEN
 *   POST_R1_CERT_MODE=final           certification run
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKLOG_FLOWS, BACKLOG_GUIDED_QUERIES, CERT_MODES, COLD_RETRY_LIMITATIONS, DESTINATION_HOST_ALLOWLIST, KNOWN_LIMITATIONS, OBSERVATION_QUERIES, OUTCOME_CLASSES, QUERY_PACK, SOURCE_GRAIN_RULES, UNACCEPTABLE_CLASSES, certMode, type PackEntry } from './post-r1-final-cert/pack.ts';
import { evaluateColdRetry, runCertQuery, runMultiHubFlow, type CertAttempt, type CertRecord } from './post-r1-final-cert/runner.ts';

const mode = certMode();
const records: CertRecord[] = [];

test('pack integrity: frozen ids are unique, every Founder-required query is present, classes are disjoint', () => {
  assert.ok(CERT_MODES.includes(mode));
  assert.equal(QUERY_PACK.length, 28, 'the frozen pack is exactly 28 gating queries');
  assert.equal(new Set(QUERY_PACK.map((e) => e.id)).size, QUERY_PACK.length);
  assert.equal(new Set(QUERY_PACK.map((e) => e.query.toLowerCase())).size, QUERY_PACK.length);
  const required = [
    'is rocket mortgage legit', 'banks that do helocs in ohio', 'va loan lenders near fort bragg nc',
    'insurance agent in miami', 'insurance agency in broward county', 'medicare supplement agent in ohio', 'is state farm licensed in texas',
    'general contractor in miami', 'roofers in broward', 'plumber in miami', 'verify contractor license CBC015082', 'licensed electrician in boca raton',
    'is abbey delray south medicare certified', 'hospice care for my mom in tampa', 'memory care in orlando', 'assisted living facilities in new jersey', 'home health agencies in miami dade county',
    'Senior Moving Services LLC', 'movers in broward county', 'USDOT 3244649', 'Fisher Investments', 'CRD 105958', 'investment advisers in california',
    'AVANTE', 'electrician mortgage lender New Jersey', 'NPN 00000001', 'restaurant health inspections in miami', 'brightway insurance jacksonville',
  ];
  for (const q of required) assert.ok(QUERY_PACK.some((e) => e.query === q), `missing required query: ${q}`);
  assert.equal(new Set([...OUTCOME_CLASSES, ...UNACCEPTABLE_CLASSES]).size, OUTCOME_CLASSES.length + UNACCEPTABLE_CLASSES.length);
  for (const e of QUERY_PACK) {
    for (const c of e.accept) assert.ok(OUTCOME_CLASSES.includes(c), `${e.id}: accept must list acceptable classes only`);
    if (e.knownLimitation) assert.ok(e.knownLimitation in KNOWN_LIMITATIONS, `${e.id}: unknown limitation id`);
    for (const c of (e.tolerate ?? []) as readonly string[]) assert.ok(!(UNACCEPTABLE_CLASSES as readonly string[]).includes(c), `${e.id}: tolerate can never blanket-accept an unacceptable class (${c})`);
  }
  for (const hub of ['lender', 'insurance', 'contractor', 'senior', 'move', 'investor'] as const) assert.ok(SOURCE_GRAIN_RULES[hub].length >= 1, `${hub} needs a source-grain rule`);
  for (const host of DESTINATION_HOST_ALLOWLIST) assert.doesNotMatch(host, /localhost|vercel\.app/);
});

test('frozen limitations: no pending-release escape hatch remains; the cold-retry exception is limited to two Contractor limitation ids', () => {
  assert.ok('CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY' in KNOWN_LIMITATIONS);
  assert.ok('CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP' in KNOWN_LIMITATIONS);
  assert.ok(!('CONTRACTOR_COLD_PATH_STABILIZATION' in KNOWN_LIMITATIONS) && !('ASK_PR_194_TIMEOUT_FALLBACK' in KNOWN_LIMITATIONS));
  assert.deepEqual([...COLD_RETRY_LIMITATIONS].sort(), ['CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY', 'CONTRACTOR_IDENTIFIER_TIMEOUT_FOLLOWUP']);
  for (const e of QUERY_PACK) if (e.knownLimitation && COLD_RETRY_LIMITATIONS.has(e.knownLimitation)) assert.equal(e.hub, 'contractor', `${e.id}: cold-retry limitations are Contractor-only`);
  for (const id of ['AVANTE_SIX_CHARACTER_AMBIGUITY', 'FL_ELECTRICAL_SOURCE_GAP', 'NJ_LOCAL_CONTRACTOR_MUNICIPALITY', 'CMS_MEMORY_CARE_ASSISTED_LIVING_SOURCE_GAP', 'HOME_HEALTH_COUNTY_SERVICE_AREA', 'INSURANCE_JACKSONVILLE_CROSSWALK_GAP', 'LENDER_MISSING_PUBLIC_DESTINATION']) assert.ok(id in KNOWN_LIMITATIONS, `frozen limitation ${id} must be preserved`);
});

// ---------------------------------------------------------------------------------------------
// Section 3 -- offline unit tests of the Contractor cold-retry acceptance rule (no network).
// ---------------------------------------------------------------------------------------------
const CON01 = QUERY_PACK.find((e) => e.id === 'CON-01')!;
const attempt = (over: Partial<CertAttempt>): CertAttempt => ({
  attempt: 1, latencyMs: 8020, outcomeClass: 'TECHNICAL_TIMEOUT', classDetail: 'TIMEOUT after 8020ms', resultState: 'TIMEOUT', resultShape: 'ZERO', total: 0, vertical: 'contractor',
  product: { trade: 'general', entityClass: 'credential_record' }, identifier: null, geography: { requested: { kind: 'city', display: 'Miami, Florida', stateCode: 'FL', county: 'Miami-Dade' }, executed: { kind: 'county', display: 'Miami-Dade County, Florida', stateCode: 'FL', county: 'Miami-Dade' } },
  nextActionTypes: ['RETRY', 'OPEN_TRUSTHUB_DESTINATION'], consumerHeading: 'This research request took too long', consumerMessage: 'Retry, or continue directly with the specialist Trust Hub.', failureCode: 'timeout', violations: [], ...over,
});
const goodRetry = attempt({ attempt: 2, latencyMs: 3100, outcomeClass: 'SOURCE_BACKED_RESULT', classDetail: 'SUPPORTED_RESULTS rows=10', resultState: 'SUPPORTED_RESULTS', resultShape: 'ROWS', total: 5535, nextActionTypes: ['OPEN_TRUSTHUB_DESTINATION'], consumerHeading: 'Contractor credential research results', consumerMessage: '5,535 public records match these source-owned filters.', failureCode: null });

test('cold-retry rule: a supported Contractor first-touch timeout with explicit disclosure + RETRY whose bounded retry succeeds is KNOWN_LIMITATION', () => {
  const r = evaluateColdRetry(CON01, attempt({}), goodRetry);
  assert.equal(r.status, 'KNOWN_LIMITATION');
});
test('cold-retry rule: two consecutive timeouts are FAIL', () => {
  assert.equal(evaluateColdRetry(CON01, attempt({}), attempt({ attempt: 2 })).status, 'FAIL');
});
test('cold-retry rule: a timeout converted to zero results is FAIL (first attempt and retry)', () => {
  assert.equal(evaluateColdRetry(CON01, attempt({ resultState: 'ZERO_MATCHING_ROWS', outcomeClass: 'SOURCE_BACKED_RESULT' }), goodRetry).status, 'FAIL');
  assert.equal(evaluateColdRetry(CON01, attempt({}), attempt({ attempt: 2, outcomeClass: 'SOURCE_BACKED_RESULT', resultState: 'ZERO_MATCHING_ROWS', resultShape: 'ZERO' })).status, 'FAIL');
});
test('cold-retry rule: wrong trade or geography before the timeout is FAIL', () => {
  assert.equal(evaluateColdRetry(CON01, attempt({ violations: ['PRODUCT: expected trade=general, got roofing'] }), goodRetry).status, 'FAIL');
  assert.equal(evaluateColdRetry(CON01, attempt({ violations: ['GEOGRAPHY: expected county Miami-Dade, got Broward'] }), goodRetry).status, 'FAIL');
});
test('cold-retry rule: no explicit timeout disclosure, or no RETRY/safe next action, is FAIL', () => {
  assert.equal(evaluateColdRetry(CON01, attempt({ consumerHeading: 'Results', consumerMessage: 'Nothing to show.', failureCode: null }), goodRetry).status, 'FAIL');
  assert.equal(evaluateColdRetry(CON01, attempt({ nextActionTypes: [] }), goodRetry).status, 'FAIL');
});
test('cold-retry rule: retry that breaks the session/handoff or violates source grain is FAIL', () => {
  assert.equal(evaluateColdRetry(CON01, attempt({}), attempt({ attempt: 2, outcomeClass: 'INVALID_GUIDED_SESSION' })).status, 'FAIL');
  assert.equal(evaluateColdRetry(CON01, attempt({}), { ...goodRetry, violations: ['SOURCE_GRAIN: contractor rows shown without "recorded credential/address geography != service territory" disclosure'] }).status, 'FAIL');
});
test('cold-retry rule: the exception is Contractor-only and limited to the two frozen cold limitations', () => {
  const lender: PackEntry = { ...CON01, id: 'X', hub: 'lender', knownLimitation: 'CONTRACTOR_COLD_FIRST_TOUCH_IO_LATENCY' };
  assert.equal(evaluateColdRetry(lender, attempt({ vertical: 'lender' }), goodRetry).status, 'FAIL');
  const otherLimitation: PackEntry = { ...CON01, knownLimitation: 'FL_ELECTRICAL_SOURCE_GAP' };
  assert.equal(evaluateColdRetry(otherLimitation, attempt({}), goodRetry).status, 'FAIL');
  const noLimitation: PackEntry = { ...CON01, knownLimitation: undefined };
  assert.equal(evaluateColdRetry(noLimitation, attempt({}), goodRetry).status, 'FAIL');
  assert.equal(evaluateColdRetry(CON01, attempt({ outcomeClass: 'SOURCE_BACKED_RESULT', resultState: 'SUPPORTED_RESULTS', resultShape: 'ROWS', total: 5 }), goodRetry).status, 'FAIL', 'only a TIMEOUT first attempt enters the rule');
});

// ---------------------------------------------------------------------------------------------
// Live gate.
// ---------------------------------------------------------------------------------------------
for (const entry of QUERY_PACK) {
  test(`${entry.id} [${entry.hub}/${entry.kind}] "${entry.query}"`, async () => {
    const record = await runCertQuery(entry, { mode });
    records.push(record);
    const summary = `${record.surface} -> ${record.outcomeClass} (${record.classDetail}); vertical=${record.vertical ?? '-'}; geo=${record.geography.session?.kind ?? record.geography.requested?.kind ?? '-'}:${record.geography.session?.display ?? record.geography.requested?.display ?? '-'}; state=${record.resultState ?? '-'}/${record.resultShape}; ${record.latencyMs}ms`;
    assert.notEqual(record.status, 'FAIL', `${entry.id} FAIL: ${record.statusReason}\n  ${summary}`);
    if (record.status === 'KNOWN_LIMITATION') console.log(`  [KNOWN_LIMITATION] ${entry.id}: ${record.statusReason}`);
    if (record.attempts) for (const a of record.attempts) console.log(`  [ATTEMPT ${a.attempt}] ${entry.id}: ${a.outcomeClass} ${a.resultState} ${a.latencyMs}ms next=${a.nextActionTypes.join(',')} heading="${a.consumerHeading}"`);
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

test('POST-R1 backlog observations (F2/F3/F4/F6): recorded only, never asserted, no tickets opened', async () => {
  for (const entry of [...OBSERVATION_QUERIES, ...BACKLOG_GUIDED_QUERIES]) {
    const record = await runCertQuery(entry, { mode });
    console.log(`  [BACKLOG] ${entry.id} "${entry.query}": ${record.surface} -> ${record.outcomeClass} (${record.classDetail})`);
  }
  const f3 = await runMultiHubFlow(BACKLOG_FLOWS.F3.query, [...BACKLOG_FLOWS.F3.selections]);
  console.log(`  [BACKLOG] OBS-F3 state farm -> insurance -> legal_insurer: sessionValid=${f3.sessionValid} deadEnd=${f3.deadEnd} last=${JSON.stringify(f3.steps.at(-1))}`);
  assert.ok(f3.sessionValid, 'F3 must never become an invalid guided session (that would break a supported core workflow)');
});

test('summary', () => {
  const by = (status: CertRecord['status']) => records.filter((r) => r.status === status).map((r) => r.id);
  console.log(`\nPOST-R1 FINAL CERT (${mode}): ${records.length} queries; PASS ${by('PASS').length}; KNOWN_LIMITATION ${by('KNOWN_LIMITATION').length} [${by('KNOWN_LIMITATION').join(', ')}]; FAIL ${by('FAIL').length} [${by('FAIL').join(', ')}]`);
  for (const r of records) console.log(`  ${r.id.padEnd(7)} ${r.status.padEnd(16)} ${r.outcomeClass.padEnd(46)} ${r.surface.padEnd(16)} ${(r.vertical ?? '-').padEnd(12)} ${String(r.resultState ?? '-').padEnd(28)} ${r.latencyMs}ms${r.attempts ? ` (attempts: ${r.attempts.map((a) => `${a.outcomeClass}@${a.latencyMs}ms`).join(' -> ')})` : ''}`);
  assert.equal(records.length, QUERY_PACK.length);
});
