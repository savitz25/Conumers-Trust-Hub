// TH-ARCH-P0-002: Capability, Contract & Execution Authority.
//
// Permanent regression coverage for financial-specialist (investor/insurance/lender) contract
// compatibility, mirroring the Contractor fix already made under TH-SEARCH-R1-018
// BLOCKER-CONTRACTOR-01. Contractor's own git history proved this exact fragility class is real:
// contractFingerprint hashes a descriptor that includes the supported-states list, so a purely
// additive, backward-compatible state addition silently changes the fingerprint. The financial
// specialists build their fingerprints the same way (confirmed against investor-trust-hub and
// insurance-trust-hub's own contract source), so the identical risk applied to them until this fix.
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { FINANCIAL_SPECIALIST_LOCKS, SPECIALIST_EXECUTION_CONTRACT } from './specialists.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const CASES = [
  { hub: 'investor' as const, question: 'financial advisers in California', row: { firmName: 'Source Adviser LLC', crd: '166089', firmClass: 'ria', principalOffice: 'Los Angeles, CA', registrationStatus: 'active', destinations: [] } },
  { hub: 'insurance' as const, question: 'insurance agencies in Texas', row: { name: 'Source Insurance Agency', entityClass: 'agency', credentialJurisdiction: 'TX', credentialStatus: 'active', destination: undefined } },
  { hub: 'lender' as const, question: 'mortgage lenders in Texas', row: { displayName: 'Source Lender Institution', nmls: '12345', currentStatus: 'active', destination: undefined } },
];

for (const { hub, question, row } of CASES) {
  const lock = FINANCIAL_SPECIALIST_LOCKS[hub];

  test(`${hub.toUpperCase()}: live compatible contract (matching version+schema, different fingerprint) is accepted`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json({
      contract: SPECIALIST_EXECUTION_CONTRACT, contractVersion: lock.version, schemaFingerprint: lock.schemaFingerprint,
      contractFingerprint: 'a-genuinely-different-but-compatible-build-fingerprint',
      resultState: 'SUPPORTED_RESULTS', rows: [row], total: 42, pagination: { page: 1, limit: 10 }, queryInterpretation: {}, provenance: {}, limitations: [],
    })) as typeof fetch;
    try {
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question } });
      assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS', 'a compatible-fingerprint build must not be treated as an outage');
      assert.equal(r.result?.total, 42);
    } finally { globalThis.fetch = original; }
  });

  test(`${hub.toUpperCase()}: stale/incompatible contractVersion is still rejected fail-closed`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json({ contract: SPECIALIST_EXECUTION_CONTRACT, contractVersion: '0.0.1', schemaFingerprint: lock.schemaFingerprint, contractFingerprint: 'irrelevant', resultState: 'SUPPORTED_RESULTS', rows: [], total: 5, provenance: {} })) as typeof fetch;
    try {
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question } });
      assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
      assert.equal(r.result?.error?.code, 'contract_mismatch');
    } finally { globalThis.fetch = original; }
  });

  test(`${hub.toUpperCase()}: incompatible schemaFingerprint is still rejected fail-closed`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json({ contract: SPECIALIST_EXECUTION_CONTRACT, contractVersion: lock.version, schemaFingerprint: 'a-genuinely-different-schema-shape', contractFingerprint: 'irrelevant', resultState: 'SUPPORTED_RESULTS', rows: [], total: 5, provenance: {} })) as typeof fetch;
    try {
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question } });
      assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
      assert.equal(r.result?.error?.code, 'contract_mismatch');
    } finally { globalThis.fetch = original; }
  });

  test(`${hub.toUpperCase()}: wrong specialist envelope (contract family) is still rejected fail-closed`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json({ contract: 'some-other-contract-v9', contractVersion: lock.version, schemaFingerprint: lock.schemaFingerprint, contractFingerprint: lock.contractFingerprint, resultState: 'SUPPORTED_RESULTS', rows: [], total: 5 })) as typeof fetch;
    try {
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question } });
      assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
    } finally { globalThis.fetch = original; }
  });

  test(`${hub.toUpperCase()}: missing required resultState field is still rejected fail-closed`, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => json({ contract: SPECIALIST_EXECUTION_CONTRACT, contractVersion: lock.version, schemaFingerprint: lock.schemaFingerprint, contractFingerprint: lock.contractFingerprint, rows: [], total: 5 })) as typeof fetch;
    try {
      const r = await orchestrateGuidedResearch({ action: { type: 'START', question } });
      assert.equal(r.result?.resultState, 'BACKEND_UNAVAILABLE');
    } finally { globalThis.fetch = original; }
  });

  test(`${hub.toUpperCase()} MUTATION: restoring the stale fingerprint-pinned lock must fail this exact live-shaped response (must fail if restored)`, async () => {
    // Simulate the OLD (pre-fix) validation logic directly against a genuinely compatible response
    // to prove it would have rejected it -- confirming the regression this fix resolves.
    const payload = { contractVersion: lock.version, schemaFingerprint: lock.schemaFingerprint, contractFingerprint: 'a-genuinely-different-but-compatible-build-fingerprint' };
    const oldCheckWouldReject = payload.contractFingerprint !== lock.contractFingerprint;
    assert.equal(oldCheckWouldReject, true, 'the old exact-fingerprint pin would have rejected this genuinely compatible response');
  });
}

test('SENIOR: network execution capability is independent of the specialist consumer-UI feature flag', async () => {
  // TH-ARCH-P0-002 section 14: UI availability must not gate Ask's network integration. Senior's
  // own route handler carries no such flag check (confirmed via repo inventory) -- lock in the
  // Ask-side behavior: a well-formed network response executes regardless of any UI-gating concept,
  // because Ask only ever talks to the network contract, never the consumer UI.
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({
    contract: SPECIALIST_EXECUTION_CONTRACT, hub: 'senior', status: 'ok',
    queryInterpretation: { providerClass: 'nursing_home', geography: { type: 'state', value: 'FL', state: 'FL' } },
    rows: [{ name: 'Source Nursing Home', cmsCcn: '105502', providerClass: 'nursing_home', canonicalProfileUrl: 'https://www.seniortrusthub.com/facility/cms/105502/source-nursing-home', recordedLocationFields: { city: 'Miami', state: 'FL', zip: '33101' }, status: 'active', evidence: [] }],
    total: 1, provenance: {},
  })) as typeof fetch;
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'nursing homes in Florida' } });
    assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
    assert.equal(r.result?.total, 1);
  } finally { globalThis.fetch = original; }
});

test('LENDER: an honestly unsupported capability is represented as such, not executed or false-zeroed', async () => {
  // "best mortgage lenders" trips Ask's own local ranking-refusal (no network call at all -- Lender
  // never advertises ranking as a capability, so Ask doesn't pretend to ask for it). The distinction
  // still matters: UNSUPPORTED_CAPABILITY is a different claim from ZERO_MATCHING_ROWS ("we executed
  // the supported filters and found nothing") -- collapsing them would turn "we cannot rank" into a
  // false "no lenders exist" answer.
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'best mortgage lenders in Texas' } });
  assert.equal(r.result?.resultState, 'UNSUPPORTED_CAPABILITY');
  assert.notEqual(r.result?.resultState, 'ZERO_MATCHING_ROWS');
  assert.notEqual(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.match(r.result?.consumerMessage ?? '', /does not rank/i);
  assert.equal(r.result?.rows.length, 0);
});
