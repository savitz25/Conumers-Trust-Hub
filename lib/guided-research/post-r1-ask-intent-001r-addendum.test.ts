/**
 * POST-R1-ASK-INTENT-001R ADDENDUM -- CONTRACTOR PARITY GATES
 *
 * Case 1: "general contractor in miami" timed out in Ask ("This research request took too
 * long.") while direct ContractorTrustHub succeeded. Real Production testing in the immediately
 * prior ticket (POST-R1-CON-LOCAL-001S) measured the largest single FL cohort (general/building
 * contractor x Miami-Dade) hitting a genuine, one-time ContractorTrustHub cold-start: first-ever
 * touch 15.25s (full miss), immediate retry 8.21s (succeeded, but past the old 8000ms
 * CONTRACTOR_SPECIALIST_TIMEOUT_MS here), then sub-second on every request after. Ask's own client
 * (components/guided-research.tsx) already waits up to 12000ms for the whole round trip, so this
 * call site's budget was raising the server-side ceiling into headroom that already existed and
 * was already proven safe -- not inventing new tolerance. These tests prove: (a) the 8.21s
 * warm-retry case, which the OLD 8000ms budget could not survive, now succeeds; and (b) a genuine
 * timeout (beyond the new 10000ms budget) still fails closed with an honest TIMEOUT, now carrying a
 * deterministic destination straight to ContractorTrustHub's own /ask surface instead of a dead end.
 *
 * Case 2: "licensed electrician in boca raton" -- Ask's existing electrical-unavailable / broader
 * general+building-alternative behavior (TH-DISCOVERY-RESET-001) must remain completely unchanged.
 * No electrical data is acquired or fabricated here; this file does not touch that logic and the
 * existing th-search-r1-018.test.ts / th-discovery-*.test.ts suites already cover it and pass
 * unmodified.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { CONTRACTOR_CONTRACT_VERSION, CONTRACTOR_SCHEMA_FINGERPRINT, CONTRACTOR_SPECIALIST_TIMEOUT_MS } from './specialists.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// A fetch mock that resolves after delayMs but also honors the caller's AbortSignal, so it
// faithfully reproduces the real fetch()+AbortController race that specialistFetch() relies on.
function delayedFetch(body: unknown, delayMs: number, status = 200) {
  return (async (_url: unknown, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(json(body, status)), delayMs);
    init.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    });
  })) as typeof fetch;
}

const MIAMI_GENERAL_PAYLOAD = {
  contract: 'trusthub-specialist-execution-v2', contractVersion: CONTRACTOR_CONTRACT_VERSION, schemaFingerprint: CONTRACTOR_SCHEMA_FINGERPRINT,
  contractFingerprint: 'live-build-fingerprint', resultState: 'SUPPORTED_RESULTS',
  rows: [{ name: 'Source General Contractor', credentialNumber: 'CGC123456', trade: 'General', status: 'active', recordedGeography: { city: 'Miami', county: 'Miami-Dade', state: 'FL' }, source: { system: 'fl_dbpr', label: 'Florida DBPR' }, destinations: [] }],
  total: 3767, pagination: { page: 1, limit: 10, totalPages: 377 }, queryInterpretation: { trade: 'general', geography: { city: 'Miami', state: 'FL' } }, provenance: { source: 'Florida DBPR' }, limitations: [],
};

test('CONTRACTOR CASE 1: sanity -- the timeout budget for this call site was actually raised past the old 8000ms value', () => {
  assert.ok(CONTRACTOR_SPECIALIST_TIMEOUT_MS > 8_000, `expected the addendum fix to raise CONTRACTOR_SPECIALIST_TIMEOUT_MS above the old 8000ms value; got ${CONTRACTOR_SPECIALIST_TIMEOUT_MS}`);
});

test('CONTRACTOR CASE 1: the real documented 8.21s Miami-Dade/general warm-retry latency (POST-R1-CON-LOCAL-001S) now succeeds instead of timing out', async () => {
  const original = globalThis.fetch;
  // 8210ms mirrors the exact real Production latency measured for the immediate retry in the
  // immediately-prior ticket -- past the OLD 8000ms budget (would have aborted) and comfortably
  // inside the NEW 10000ms budget.
  globalThis.fetch = delayedFetch(MIAMI_GENERAL_PAYLOAD, 8_210);
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'general contractor in miami' } });
    assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS', 'the 8.21s warm-retry latency must no longer be reported as a timeout');
    assert.equal(r.result?.total, 3767);
    assert.notEqual(r.result?.consumerHeading, 'This research request took too long');
  } finally { globalThis.fetch = original; }
}, { timeout: 20_000 });

test('CONTRACTOR CASE 1: a genuine timeout beyond the new budget still fails closed, but now with a working direct link to ContractorTrustHub', async () => {
  const original = globalThis.fetch;
  // Beyond the new CONTRACTOR_SPECIALIST_TIMEOUT_MS (10000ms) -- simulates the residual, rarer,
  // still out-of-scope full cold-miss (documented as CONTRACTOR_LOCAL_COLD_CACHE_STATS_FOLLOWUP,
  // which needs a Contractor-side CREATE STATISTICS DDL change this ticket is not authorized to make).
  globalThis.fetch = delayedFetch(MIAMI_GENERAL_PAYLOAD, 30_000);
  try {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'general contractor in miami' } });
    assert.equal(r.result?.resultState, 'TIMEOUT');
    assert.equal(r.result?.consumerHeading, 'This research request took too long');
    assert.equal(r.result?.error?.retryable, true);
    const directory = r.result?.destinations?.find((d) => d.type === 'DIRECTORY');
    assert.ok(directory, 'a genuine timeout must still hand the consumer a working direct link to ContractorTrustHub, not a dead end');
    assert.match(directory!.href, /^https:\/\/www\.contractortrusthub\.com\/ask\?q=/);
  } finally { globalThis.fetch = original; }
}, { timeout: 20_000 });
