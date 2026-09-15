// TH-DISCOVERY-001: Network Intelligent Discovery Contract.
//
// Permanent cross-network consumer acceptance corpus. Encodes the network's shared Discovery
// contract: an unsupported condition (an unprovable geography grain, an unsupported "best"/"top"
// ranking modifier) must narrow the claim or offer a path to real results -- it must not
// automatically suppress an otherwise relevant, source-backed entity down to a dead end. Exact
// identifiers and verification questions remain untouched -- this ticket only concerns DISCOVERY.
//
// These tests call the real live network (no fetch mock) for cases where locking in exact
// specialist row data isn't the point -- the point is the shared *routing/scope/disclosure*
// contract holding regardless of which specialist answers. Where a specific specialist payload
// shape matters, a mock is used (see the Tampa Bay two-step flow below).
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { planAskResearch } from '../network/research-planner.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// ============================================================================
// TAMPA BAY MOVER (ticket section 37 -- the screenshot-class regression)
// ============================================================================

test('TAMPA BAY: "best mover in tampa bay florida" preserves provider-discovery intent, not a Trust Score request', () => {
  const plan = planAskResearch('best mover in tampa bay florida');
  assert.equal(plan.primaryHub, 'move');
  assert.equal(plan.entityClass?.id, 'mover');
  assert.equal(plan.requestedGeography?.display, 'Tampa Bay, Florida');
  assert.ok(plan.reasonCodes.includes('VALUE_JUDGMENT_REQUESTED'), '"best" must be recognized as an unsupported ranking modifier, not silently dropped or silently obeyed');
  assert.doesNotMatch(JSON.stringify(plan), /trust.?score/i);
});

test('TAMPA BAY: inability to prove complete Tampa Bay service territory does not require zero entities -- a path to real movers exists', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => json({
    contract: 'trusthub-specialist-execution-v2', contractVersion: 'move-ask-v1', resultType: 'SUPPORTED_RESULTS',
    rows: [{ publicDisplayName: 'Source Florida Movers LLC', usdot: '1234567', role: 'Carrier', recordedHq: { raw: 'Tampa, FL' }, authorityState: 'active', canonicalProfileUrl: 'https://www.movetrusthub.com/companies/source-florida-movers' }],
    total: 37, pagination: { page: 1, limit: 10, totalPages: 4 }, provenance: {}, limitations: [],
  })) as typeof fetch;
  try {
    const step1 = await orchestrateGuidedResearch({ action: { type: 'START', question: 'best mover in tampa bay florida' } });
    assert.equal(step1.session.phase, 'CLARIFY');
    assert.equal(step1.diagnostics.specialistCalls, 0, 'no result may claim Tampa Bay service before the consumer chooses a scope');
    const broaden = step1.session.availableChoices.find((c) => c.value === 'scope_state:FL');
    assert.ok(broaden, 'a path to broader Florida results must be offered, not just a dead end');
    const subRegions = step1.session.availableChoices.filter((c) => c.value.startsWith('scope_place:'));
    assert.ok(subRegions.length > 0, 'sub-region refinement (Tampa/St. Petersburg/Clearwater) must also remain available');

    const step2 = await orchestrateGuidedResearch({ session: step1.session, action: { type: 'SELECT_CHOICE', value: broaden!.value } });
    assert.equal(step2.result?.resultState, 'SUPPORTED_RESULTS', 'relevant source-backed mover options must be permitted once the consumer accepts the broader scope');
    assert.equal(step2.result?.total, 37);
    assert.equal(step2.result?.rows[0]?.whyShown && step2.result.rows[0].whyShown.length > 0, true, 'every returned mover must state its actual evidence basis');
    assert.ok(step2.result?.rows[0]?.destination?.href, 'canonical profile destination must be preserved when available');
    // No result may claim Tampa Bay *service* -- the actual geography basis (recorded HQ, broadened
    // to Florida) must be visible in the interpretation, not silently pretended to satisfy Tampa Bay.
    const askedRow = step2.session.executionScope.requestedGeography?.display;
    const executedRow = step2.session.executionScope.executionGeography?.display;
    assert.equal(askedRow, 'Tampa Bay, Florida');
    assert.equal(executedRow, 'Florida');
    assert.doesNotMatch(step2.result?.consumerMessage ?? '', /serves? tampa bay/i);
  } finally { globalThis.fetch = original; }
});

// ============================================================================
// PALM BEACH CONTRACTOR (ticket section 38)
// ============================================================================

test('PALM BEACH: "electrician palm beach county" preserves Discovery intent, trade, and geography', () => {
  const plan = planAskResearch('electrician palm beach county');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.entityClass?.id, 'electrical_contractor');
  assert.equal(plan.requestedGeography?.county, 'Palm Beach');
});

test('PALM BEACH: real contractors are not suppressed merely because complete service-territory evidence is absent (roofing, a trade with real PB data)', async () => {
  // Electrical credential data for Florida genuinely does not exist in Contractor's accepted
  // source today (state-capabilities.ts explicitly marks FL electrical unsupported) -- that is a
  // real data-source gap, not a suppression bug this network-contract ticket can fix by policy
  // alone (see TH-DISCOVERY-001 closeout, section Q). Roofing has real accepted Palm Beach County
  // data and proves the underlying *policy* -- credential/address evidence qualifies a result with
  // a service-territory disclosure, it doesn't get discarded -- actually holds.
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'roofer in Palm Beach County Florida' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0, 'real credential/location evidence must be permitted to qualify a result');
  assert.ok(r.result?.rows[0]?.facts.some((f) => f.label === 'Credential jurisdiction'), 'the qualifying evidence basis must be visible on the result');
});

test('PALM BEACH: the genuine FL-electrical data gap is disclosed honestly, not silently substituted or falsely zeroed', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'electrician palm beach county' } });
  assert.equal(r.result?.resultState, 'UNSUPPORTED_TRADE_CAPABILITY');
  assert.notEqual(r.result?.resultState, 'ZERO_MATCHING_ROWS', 'a structural data gap is a different claim from "we searched and found zero"');
  assert.match(r.result?.consumerMessage ?? '', /electrical/i);
});

// ============================================================================
// MONMOUTH LENDER (ticket section 39)
// ============================================================================

test('MONMOUTH: "mortgage broker in monmouth county new jersey" stays provider Discovery, never HMDA aggregate research', () => {
  const plan = planAskResearch('mortgage broker in monmouth county new jersey');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.primaryHub, 'lender');
  assert.equal(plan.entityClass?.id, 'mortgage_broker');
  assert.equal(plan.requestedGeography?.county, 'Monmouth');
  assert.notEqual(plan.intent, 'HOW_TO');
  assert.equal(plan.requestedEvidence.includes('HMDA'), false, 'HMDA is supporting evidence, never the requested proposition itself');
});

test('MONMOUTH: provider Discovery actually executes and returns real, evidence-labeled lender results', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'mortgage broker in monmouth county new jersey' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
  assert.match(r.result?.consumerMessage ?? '', /HMDA/i, 'the HMDA evidence basis must be stated, not hidden');
  assert.match(r.result?.consumerMessage ?? '', /property geography is not headquarters/i, 'property geography must be explicitly disclaimed as not headquarters/branch/service-territory, not silently relabeled as one');
});

// ============================================================================
// FLORIDA SENIOR CARE (ticket section 40)
// ============================================================================

test('SENIOR CARE: "senior care florida" is Discovery with unresolved care class, never a literal provider-name lookup', () => {
  const plan = planAskResearch('senior care florida');
  assert.ok(plan.candidateHubs.includes('senior'));
  assert.equal(plan.careSetting, undefined, 'care class must stay honestly unresolved, not guessed');
  assert.equal(plan.entityName, undefined, 'the phrase itself must never become a provider name');
  assert.equal(plan.requestedGeography?.stateCode, 'FL');
});

test('SENIOR CARE: unresolved care class triggers useful refinement toward real providers, not "no provider found"', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'senior care florida' } });
  assert.equal(r.session.phase, 'CLARIFY');
  assert.notEqual(r.session.phase, 'ERROR_RECOVERY');
  assert.ok(r.session.availableChoices.length > 0, 'refinement choices must lead toward actual provider classes, not a dead end');
  assert.ok(r.session.availableChoices.some((c) => c.value === 'nursing_home'), 'Nursing Home must remain a distinct, selectable class');
  assert.ok(r.session.availableChoices.some((c) => c.value === 'home_health'), 'Home Health must remain a distinct, selectable class (never merged with Nursing Home)');
});

// ============================================================================
// BOCA INSURANCE (ticket section 35 corpus)
// ============================================================================

// TH-DISCOVERY-002B superseded this case: InsuranceTrustHub's real local-directory query is now
// wired into specialist-execution/v2 (OFFICE_LOCATION geography intent), so Boca Raton reaches
// real local evidence directly instead of the old ZIP/local-directory capability-gap handoff. The
// underlying "never false-zero a genuine capability gap" principle this test locked in is now
// covered by th-discovery-002b-corpus.test.ts's R1 ZIP SAFETY case (an unrecognized ZIP) instead.
test('BOCA INSURANCE: real local-directory evidence is never false-zeroed or silently substituted', async () => {
  // Retries a few times: this hits live production's real local-directory backend, which has a
  // rare, genuine transient-outage rate (correctly surfaced as BACKEND_UNAVAILABLE/
  // UNSUPPORTED_CAPABILITY under load, not a false zero) -- see TH-DISCOVERY-002B's fail-loud fix.
  let r: Awaited<ReturnType<typeof orchestrateGuidedResearch>> | undefined;
  for (let i = 0; i < 4; i++) {
    r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance company in boca raton fl' } });
    if (r.result?.resultState === 'SUPPORTED_RESULTS') break;
  }
  assert.ok(
    ['SUPPORTED_RESULTS', 'BACKEND_UNAVAILABLE'].includes(r?.result?.resultState ?? ''),
    `a genuine local-directory search must either succeed or honestly report a backend failure, never a fabricated result (got ${r?.result?.resultState})`
  );
});

// ============================================================================
// UNSUPPORTED RANKING MODIFIER POLICY (ticket sections 5, 13, 29)
// ============================================================================

test('RANKING POLICY: "best"/"top"/"safest" never trigger a proprietary quality score anywhere in a Discovery response', async () => {
  for (const question of ['best mortgage lender in Florida', 'best insurance company', 'roofer in Palm Beach County Florida']) {
    const r = await orchestrateGuidedResearch({ action: { type: 'START', question } });
    const serialized = JSON.stringify(r.result);
    assert.doesNotMatch(serialized, /trust.?score/i, question);
    assert.doesNotMatch(serialized, /\bsafety.?score\b/i, question);
    assert.doesNotMatch(serialized, /\breputation.?score\b/i, question);
  }
});

test('RANKING POLICY: "best mortgage lender in Florida" executes real results with an explicit "does not rank" disclosure', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'best mortgage lender in Florida' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
  assert.match(r.result?.limitations.join(' ') ?? '', /does not rank/i);
});
