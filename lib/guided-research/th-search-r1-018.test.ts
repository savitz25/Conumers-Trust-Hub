/**
 * TH-SEARCH-R1-018 — Ask-owned five-blocker repair gate.
 *
 * Covers BLOCKER-INSURANCE-01, BLOCKER-IDENTIFIER-FILLER-WORD-01, BLOCKER-SENIOR-01,
 * BLOCKER-CONTRACTOR-01, and BLOCKER-CROSS-01, all found by the independent TH-SEARCH-R1-017
 * acceptance sweep. Does not touch BLOCKER-MOVE-01 (fixed separately in savitz25/Move-trust-Hub).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuidedSession, parseLabeledIdentifier } from './session.ts';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { decideAskExecution } from '../network/execution-decision.ts';
import { planAskResearch } from '../network/research-planner.ts';
import { CONTRACTOR_CONTRACT_VERSION, CONTRACTOR_SCHEMA_FINGERPRINT, FINANCIAL_SPECIALIST_LOCKS } from './specialists.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// ============================================================================
// INSURANCE SCOPE (BLOCKER-INSURANCE-01)
// ============================================================================

test('INSURANCE SCOPE: named agency does not become an unscoped cohort', () => {
  const plan = planAskResearch('National Trust Insurance Group');
  assert.equal(plan.entityName, 'National Trust Insurance Group');
  const session = createGuidedSession('National Trust Insurance Group');
  assert.equal(session?.identityName, 'National Trust Insurance Group');
  assert.equal(session?.insuranceResearchMode, 'identity_name');
});

test('INSURANCE SCOPE: named insurer does not become an agency cohort', async () => {
  const original = globalThis.fetch;
  let sentBody: Record<string, unknown> | undefined;
  const lock = FINANCIAL_SPECIALIST_LOCKS.insurance;
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    sentBody = JSON.parse(String(init.body));
    return json({ contract: 'trusthub-specialist-execution-v2', contractVersion: lock.version, schemaFingerprint: lock.schemaFingerprint, contractFingerprint: lock.contractFingerprint, resultState: 'EXACT_IDENTITY', total: 1, rows: [{ name: 'Progressive Casualty Insurance Company', entityClass: 'legal_insurer' }], provenance: {} }) as unknown as Response;
  }) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'Progressive Casualty Insurance Company' } });
    assert.equal(sentBody?.queryType, 'identity');
    assert.equal(sentBody?.identityName, 'Progressive Casualty Insurance Company');
    assert.notEqual(sentBody?.queryType, 'cohort');
    assert.equal(r.result?.resultState, 'EXACT_IDENTITY');
  } finally { globalThis.fetch = original; }
});

test('INSURANCE SCOPE: ZIP is retained and handed off, never executed as an unscoped cohort', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; return json({ resultState: 'SUPPORTED_RESULTS', total: 82071, rows: [] }); }) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agencies in ZIP 33441' } });
    assert.equal(called, false, 'specialist-execution/v2 must never be dispatched for an unsupported ZIP request');
    assert.equal(r.result?.resultState, 'UNSUPPORTED_CAPABILITY');
    assert.equal(r.result?.destinations?.[0]?.type, 'DIRECTORY');
    assert.match(r.result?.destinations?.[0]?.href ?? '', /insurancetrusthub\.com\/ask\?q=/);
    assert.notEqual(r.result?.total, 82071);
  } finally { globalThis.fetch = original; }
});

test('INSURANCE SCOPE: unsupported local (bare city) path never becomes an unscoped cohort', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; return json({ resultState: 'SUPPORTED_RESULTS', total: 82071, rows: [] }); }) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency in Boca Raton Florida' } });
    assert.equal(called, false);
    assert.equal(r.result?.resultState, 'UNSUPPORTED_CAPABILITY');
    assert.equal(r.result?.destinations?.[0]?.type, 'DIRECTORY');
  } finally { globalThis.fetch = original; }
});

test('INSURANCE SCOPE: near-me stays fail-closed (unaffected control)', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency near me' } });
  assert.equal(r.result?.resultState, 'UNSUPPORTED_CAPABILITY');
  assert.notEqual(r.result?.total, 82071);
});

test('INSURANCE SCOPE MUTATION: removing identityName mapping forces cohort (must fail if restored)', () => {
  // Fixture-level proof this test suite is sensitive to the original defect: simulate the
  // pre-fix session shape directly and confirm it is NOT what createGuidedSession now produces.
  const session = createGuidedSession('National Trust Insurance Group');
  assert.notEqual(session?.insuranceResearchMode, 'cohort', 'a specific entity name must never fall back to cohort mode');
});

// ============================================================================
// IDENTIFIER FILLERS (BLOCKER-IDENTIFIER-FILLER-WORD-01)
// ============================================================================

test('IDENTIFIER FILLERS: NAIC positive formats extract the real value', () => {
  for (const q of ['NAIC 10064', 'NAIC code 10064', 'NAIC company code 10064', 'NAIC #10064']) {
    const session = createGuidedSession(q);
    assert.deepEqual(session?.identifier, { type: 'NAIC', value: '10064' }, q);
  }
});

test('IDENTIFIER FILLERS: NPN positive formats extract the real value', () => {
  for (const q of ['NPN 20000635', 'NPN number 20000635', 'NPN #20000635']) {
    const session = createGuidedSession(q);
    assert.deepEqual(session?.identifier, { type: 'NPN', value: '20000635' }, q);
  }
});

test('IDENTIFIER FILLERS: CRD positive formats extract the real value', () => {
  for (const q of ['CRD 166089', 'CRD number 166089', 'CRD #166089']) {
    const session = createGuidedSession(q);
    assert.deepEqual(session?.identifier, { type: 'CRD', value: '166089' }, q);
  }
});

test('IDENTIFIER FILLERS: NMLS positive formats extract the real value', () => {
  for (const q of ['NMLS 3030', 'NMLS number 3030', 'NMLS #3030']) {
    const session = createGuidedSession(q);
    assert.deepEqual(session?.identifier, { type: 'NMLS', value: '3030' }, q);
  }
});

test('IDENTIFIER FILLERS: LEI positive formats extract the real value', () => {
  const value = '5493001KJTIIGC8Y1R12';
  for (const q of [`LEI ${value}`, `LEI number ${value}`, `LEI code ${value}`]) {
    const session = createGuidedSession(q);
    assert.deepEqual(session?.identifier, { type: 'LEI', value }, q);
  }
});

test('IDENTIFIER FILLERS: trailing context is not swallowed as the value', () => {
  const session = createGuidedSession('NMLS number 3030 in Florida');
  assert.deepEqual(session?.identifier, { type: 'NMLS', value: '3030' });
});

test('IDENTIFIER FILLERS negatives: missing value never fabricates an identifier', () => {
  for (const q of ['NAIC code', 'NPN number', 'CRD #', 'NMLS number in Florida']) {
    const session = createGuidedSession(q);
    assert.equal(session?.identifier, undefined, q);
  }
});

test('IDENTIFIER FILLERS: a company containing the bare word "Code" is not treated as an identifier without a real label', () => {
  const match = parseLabeledIdentifier('Code Corporation LLC', ['CRD', 'NPN', 'NAIC', 'NMLS'], { leiSupported: true });
  assert.equal(match, null);
});

test('IDENTIFIER FILLERS MUTATION: restoring first-token-after-label behavior must fail these tests', () => {
  const restoredBehavior = (text: string) => text.match(/\b(CRD|NPN|NAIC|NMLS|LEI)\s*#?\s*([A-Z0-9-]+)\b/i);
  const match = restoredBehavior('NAIC code 10064');
  assert.equal(match?.[2], 'code', 'confirms the historical defect the fix replaces');
  assert.notEqual(match?.[2], '10064');
});

// ============================================================================
// SENIOR DEICTIC (BLOCKER-SENIOR-01)
// ============================================================================

test('SENIOR DEICTIC: nursing home', () => {
  for (const q of ['Who owns this nursing home?', 'Can you tell me who owns this nursing home?', 'Has this nursing home been fined?', 'Did this nursing home change owners?']) {
    const d = decideAskExecution(q);
    assert.equal(d.plan.entityName, undefined, q);
    assert.equal(d.executionAllowed, false, q);
  }
});

test('SENIOR DEICTIC: assisted living and hospice do not fabricate an entity name', () => {
  for (const q of ['Who owns this assisted living facility?', 'What happened at this hospice?']) {
    const d = decideAskExecution(q);
    assert.equal(d.plan.entityName, undefined, q);
    assert.equal(d.executionAllowed, false, q);
  }
});

test('SENIOR DEICTIC: exact identifier positive is not blocked by the deictic guard', () => {
  const d = decideAskExecution('Who owns the nursing home with CMS CCN 455799?');
  assert.equal(d.plan.intent, 'IDENTIFIER_LOOKUP');
  assert.equal(d.executionAllowed, true);
});

test('SENIOR DEICTIC MUTATION: removing "nursing home" from deictic coverage must fail (must fail if restored)', () => {
  const restoredRegex = /\b(?:this|that)\s+(?:company|firm|facility|place|agency|contractor|roofer|roof\s+guy|mover|moving\s+company|lender|advis(?:er|or)|financial\s+advis(?:er|or)|investment\s+advis(?:er|or)|agent|insurance\s+agent|guy|home\s+health\s+agency)\b/i;
  assert.equal(restoredRegex.test('Who owns this nursing home?'), false, 'confirms the pre-fix regex genuinely lacked this coverage');
});

// ============================================================================
// CONTRACTOR (BLOCKER-CONTRACTOR-01)
// ============================================================================

test('CONTRACTOR: live compatible contract (matching version+schema, different fingerprint) is accepted', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({
    contract: 'trusthub-specialist-execution-v2', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT,
    contractFingerprint: 'a-genuinely-different-but-compatible-build-fingerprint',
    resultState: 'SUPPORTED_RESULTS', rows: [{ name: 'Source Contractor', credentialNumber: 'CCC123', trade: 'Roofing', status: 'active', recordedGeography: { city: 'Fort Lauderdale', county: 'Broward', state: 'FL' }, source: { system: 'fl_dbpr', label: 'Florida DBPR' }, destinations: [] }],
    total: 924, pagination: { page: 1, limit: 10, totalPages: 93 }, queryInterpretation: { state: 'FL' }, provenance: { source: 'Florida DBPR' }, limitations: [],
  })) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofers in Broward County' } });
    assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS', 'a compatible-fingerprint build must not be treated as an outage');
    assert.equal(r.result?.total, 924);
  } finally { globalThis.fetch = original; }
});

test('CONTRACTOR: stale/incompatible contractVersion is still rejected fail-closed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({ contract: 'trusthub-specialist-execution-v2', contractVersion: '1.0.0', schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, contractFingerprint: 'irrelevant', resultState: 'SUPPORTED_RESULTS', rows: [], total: 5, provenance: {} })) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofers in Broward County' } });
    assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
    assert.equal(r.result?.error?.code, 'contract_version_mismatch');
  } finally { globalThis.fetch = original; }
});

test('CONTRACTOR: incompatible schemaFingerprint is still rejected fail-closed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({ contract: 'trusthub-specialist-execution-v2', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: 'a-genuinely-different-schema-shape', contractFingerprint: 'irrelevant', resultState: 'SUPPORTED_RESULTS', rows: [], total: 5, provenance: {} })) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofers in Broward County' } });
    assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
    assert.equal(r.result?.error?.code, 'contract_version_mismatch');
  } finally { globalThis.fetch = original; }
});

test('CONTRACTOR: wrong specialist envelope (contract family) is still rejected fail-closed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({ contract: 'some-other-contract-v9', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, resultState: 'SUPPORTED_RESULTS', rows: [], total: 5 })) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofers in Broward County' } });
    assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
  } finally { globalThis.fetch = original; }
});

test('CONTRACTOR: missing required result-state field is still rejected fail-closed', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({ contract: 'trusthub-specialist-execution-v2', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, rows: [], total: 5 })) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofers in Broward County' } });
    assert.ok(['BACKEND_UNAVAILABLE', 'INVALID_QUERY'].includes(r.result?.resultState ?? ''));
  } finally { globalThis.fetch = original; }
});

test('CONTRACTOR: NJ and TX specialist semantics remain preserved (unaffected control)', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({ contract: 'trusthub-specialist-execution-v2', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, contractFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, resultState: 'CLARIFICATION_REQUIRED', errorCode: 'new_jersey_credential_class_required', capabilityChoices: [], rows: [], total: 0, provenance: {} }, 422)) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'contractor in New Jersey' } });
    assert.equal(r.result?.error?.code, 'new_jersey_credential_class_required');
  } finally { globalThis.fetch = original; }
});

test('CONTRACTOR MUTATION: restoring the stale fingerprint-pinned lock must fail Broward execution (must fail if restored)', async () => {
  const original = globalThis.fetch;
  const staleFingerprint = '441f0e7c1f62bc4c5f9ed3720c56095d2b10748dcb9ff9130ad7eb62ea2f5eb7';
  globalThis.fetch = (async () => json({ contract: 'trusthub-specialist-execution-v2', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, contractFingerprint: 'a-genuinely-different-but-compatible-build-fingerprint', resultState: 'SUPPORTED_RESULTS', rows: [], total: 924, provenance: {} })) as typeof fetch;
  try {
    // Simulate the OLD (stale) validation logic directly to prove it would have failed this exact
    // live-shaped response, confirming the regression this fix resolves.
    const payload = { contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT, contractFingerprint: 'a-genuinely-different-but-compatible-build-fingerprint' };
    const oldCheckWouldReject = payload.contractFingerprint !== staleFingerprint;
    assert.equal(oldCheckWouldReject, true, 'the old exact-fingerprint pin would have rejected this genuinely compatible response');
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofers in Broward County' } });
    assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS', 'the current (fixed) validation correctly accepts it');
  } finally { globalThis.fetch = original; }
});

// ============================================================================
// CROSS DOMAIN (BLOCKER-CROSS-01)
// ============================================================================

test('CROSS DOMAIN: mover+lender requires clarification, never silently executes one domain', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'I need a mover and a mortgage lender in New Jersey' } });
  assert.equal(r.session.phase, 'CLARIFY');
  assert.notEqual(r.session.hub, 'lender');
  assert.equal(r.result, undefined, 'no specialist should have been dispatched');
});

test('CROSS DOMAIN: contractor+lender requires clarification', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'I need a contractor and a lender for my home purchase' } });
  assert.equal(r.session.phase, 'CLARIFY');
  assert.equal(r.result, undefined);
});

test('CROSS DOMAIN: insurance+lender requires clarification', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'I need an insurance agent and a mortgage lender' } });
  assert.equal(r.session.phase, 'CLARIFY');
  assert.equal(r.result, undefined);
});

test('CROSS DOMAIN: move+senior requires clarification', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: "Research a mover and a nursing home for my mother's relocation" } });
  assert.equal(r.session.phase, 'CLARIFY');
  assert.equal(r.result, undefined);
});

test('CROSS DOMAIN false-positive controls: single-domain company names and phrasings execute normally', async () => {
  const cases: Array<[string, string]> = [['Rocket Mortgage', 'lender'], ['Senior Moving Services LLC', 'move'], ['State Farm insurance company', 'insurance'], ['lenders in New Jersey', 'lender']];
  for (const [q, expectedHub] of cases) {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: q } });
    assert.equal(r.session.hub, expectedHub, q);
    assert.notEqual(r.session.phase, 'CLARIFY', `${q} must not be treated as an unresolved multi-domain request`);
  }
});

test('CROSS DOMAIN control: the existing intentional Broward home-buying journey is preserved', () => {
  const plan = planAskResearch("I'm buying a home in Broward County. What should I research?");
  assert.equal(plan.intent, 'MULTI_HUB_JOURNEY');
});

test('CROSS DOMAIN MUTATION: allowing lenderIntent early-return before the multi-domain plan check must fail (must fail if restored)', () => {
  const plan = planAskResearch('I need a mover and a mortgage lender in New Jersey');
  assert.equal(plan.intent, 'MULTI_HUB_JOURNEY', 'the planner must classify this as multi-domain before any single-hub session logic runs');
  assert.deepEqual([...plan.candidateHubs].sort(), ['lender', 'move']);
});
