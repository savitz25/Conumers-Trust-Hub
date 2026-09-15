// TH-DISCOVERY-002: Lender + Insurance Intelligent Discovery.
//
// Permanent consumer acceptance corpus for Lender and Insurance provider Discovery. Locks in:
// - Monmouth broker (the regression anchor, ticket section 48) stays GOOD.
// - Named-entity lender lookups (Rocket Mortgage) resolve to exact identity, not a doomed
//   market-cohort request (a real bug this ticket found and fixed).
// - Live-rate-shopping requests are answered honestly, not treated like any other missing-identity
//   case.
// - Boca Raton insurance Discovery (the flagship case, ticket section 46) has a real path to
//   providers instead of a bare dead end.
// - Homeowners product intent (the flagship product-intent case, ticket section 47) is disclosed
//   honestly instead of silently ignored.
// - A well-known carrier brand name alone routes to the insurance hub instead of crashing.
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { planAskResearch } from '../network/research-planner.ts';

// TH-DISCOVERY-002B: the Boca Raton flagship now hits live production's real local-directory
// backend, which has a rare, genuine transient-outage rate (correctly surfaced as
// BACKEND_UNAVAILABLE, not a false zero). Retry a few times so that already-correctly-handled
// transience doesn't flake this permanent regression file; still requires genuine
// SUPPORTED_RESULTS to pass.
async function orchestrateUntilSupported(question: string, attempts = 6) {
  let last: Awaited<ReturnType<typeof orchestrateGuidedResearch>> | undefined;
  for (let i = 0; i < attempts; i++) {
    last = await orchestrateGuidedResearch({ action: { type: 'START', question } });
    if (last.result?.resultState === 'SUPPORTED_RESULTS') return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return last!;
}

// ============================================================================
// LENDER
// ============================================================================

test('MONMOUTH ANCHOR: "mortgage broker in monmouth county new jersey" stays GOOD -- provider Discovery, real results, never HMDA aggregate research', async () => {
  const plan = planAskResearch('mortgage broker in monmouth county new jersey');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.entityClass?.id, 'mortgage_broker');
  assert.equal(plan.requestedGeography?.county, 'Monmouth');
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'mortgage broker in monmouth county new jersey' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
  assert.match(r.result?.consumerMessage ?? '', /HMDA/i);
});

test('LENDER: "mortgage lender in Broward County Florida" is GOOD -- real, bounded, evidence-labeled results', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'mortgage lender in Broward County Florida' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
  assert.equal(r.result?.rows.length <= 10, true, 'shown rows must be bounded regardless of total');
});

// TH-DISCOVERY-RESET-001: superseded -- a city mapping to an unpublished county now auto-broadens
// to Florida and executes in the SAME response (RESULTS FIRST), instead of requiring a prior
// consumer choice before ever showing a lender.
test('LENDER: "mortgage lenders in Miami Florida" -- a city mapping to an unpublished county auto-broadens to real Florida results, not a dead end', async () => {
  const step1 = await orchestrateGuidedResearch({ action: { type: 'START', question: 'mortgage lenders in Miami Florida' } });
  assert.equal(step1.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((step1.result?.total ?? 0) > 0);
  assert.equal(step1.session.executionScope.reasonCodes.includes('AUTOMATIC_BROADENING'), true);
  assert.equal(step1.session.executionScope.requestedGeography?.display, 'Miami, Florida');
  assert.equal(step1.session.executionScope.executionGeography?.display, 'Florida');
});

test('LENDER: "best mortgage lender in Florida" executes real results with an honest "does not rank" disclosure, never a proprietary score', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'best mortgage lender in Florida' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
  assert.match(r.result?.limitations.join(' ') ?? '', /does not rank/i);
  assert.doesNotMatch(JSON.stringify(r.result), /trust.?score/i);
});

test('LENDER: "Rocket Mortgage" resolves to exact identity, not a doomed market-cohort request', async () => {
  const plan = planAskResearch('Rocket Mortgage');
  assert.equal(plan.intent, 'ENTITY_LOOKUP');
  assert.equal(plan.entityName, 'Rocket Mortgage');
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'Rocket Mortgage' } });
  assert.equal(r.session.lenderResearchMode, 'identity_name');
  assert.equal(r.result?.resultState, 'EXACT_IDENTITY');
  assert.ok(r.result?.rows[0]?.destination?.href, 'canonical profile destination must be preserved');
});

test('LENDER: "complaints about Rocket Mortgage" is unaffected by the identity-name fix -- stays a distinct complaints mode', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'complaints about Rocket Mortgage' } });
  assert.equal(r.session.lenderResearchMode, 'complaints');
});

test('LENDER: "NMLS 3030" remains exact identity, unaffected by Discovery changes', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'NMLS 3030' } });
  assert.equal(r.result?.resultState, 'EXACT_IDENTITY');
});

test('LIVE RATE HONESTY: "lowest mortgage rates today" explicitly discloses that live rate pricing is unavailable, not a generic missing-identity dead end', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'lowest mortgage rates today' } });
  assert.equal(r.session.hub, 'lender');
  assert.equal(r.session.phase, 'CLARIFY');
  assert.match(r.session.nextAction ?? '', /live.*real-time.*rate|does not have live/i);
  assert.equal(r.result, undefined, 'no specialist call should have been made for a request with nothing executable');
  assert.doesNotMatch(r.session.nextAction ?? '', /trust.?score/i);
});

test('LIVE RATE HONESTY: a geography-scoped rate mention still reaches real property-market results, not the bare rate-shopping refusal', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'FHA lenders in Broward County' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
});

// ============================================================================
// INSURANCE
// ============================================================================

// TH-DISCOVERY-002B superseded these two cases: InsuranceTrustHub's real local-directory query is
// now wired into specialist-execution/v2 (OFFICE_LOCATION geography intent, live-verified via
// /api/specialist-execution/v2 returning real Boca-area agencies for both ZIP 33431 and Palm Beach
// county). Boca Raton no longer needs the statewide-broadening detour -- it gets real local
// evidence directly. The state-broadening consent path remains available as a fallback (still
// covered by th-search-r1-018.test.ts for a geography the local directory doesn't recognize) but
// is no longer the expected outcome for a supported FL launch county.
test('BOCA RATON FLAGSHIP: "insurance company in boca raton fl" reaches real local-directory evidence, not a statewide detour', async () => {
  const r = await orchestrateUntilSupported('insurance company in boca raton fl');
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
  assert.ok((r.result?.rows.length ?? 0) <= 10, 'shown rows must be bounded regardless of total');
  assert.match(r.result?.consumerMessage ?? '', /Palm Beach County/i, 'the recorded local grain must be disclosed');
  assert.doesNotMatch(r.result?.consumerMessage ?? '', /every customer|countywide service/i, 'a directory record must never be inflated into a service-territory claim');
  assert.ok(r.result?.rows[0]?.destination?.href, 'a canonical profile destination must be present');
});

test('BOCA RATON FLAGSHIP: "insurance agency in boca raton fl" (unambiguous agency wording) reaches the same real local-directory evidence', async () => {
  const r = await orchestrateUntilSupported('insurance agency in boca raton fl');
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((r.result?.total ?? 0) > 0);
});

test('HOMEOWNERS FLAGSHIP: "homeowners insurance agencies in Florida" discloses the product-specialization gap instead of silently ignoring "homeowners"', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'homeowners insurance agencies in Florida' } });
  assert.equal(r.result?.resultState, 'SUPPORTED_RESULTS');
  assert.match(r.result?.consumerMessage ?? '', /homeowners/i, '"homeowners" must be acknowledged, not silently dropped');
  assert.match(r.result?.limitations.join(' ') ?? '', /not established/i);
  assert.ok((r.result?.rows.length ?? 0) <= 10, 'rows shown must stay bounded regardless of the honest total');
});

test('INSURANCE: "insurance companies in Florida" (state-level, ambiguous wording, no local geography) is unaffected by the Boca Raton entity-class fix', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance companies in Florida' } });
  assert.equal(r.result?.resultState, 'UNSUPPORTED_CAPABILITY');
});

test('CARRIER BRAND: "State Farm agent near me" routes to the insurance hub with an honest limitation, never a raw routing error', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'State Farm agent near me' } });
  assert.equal(r.session.hub, 'insurance');
  assert.notEqual(r.result, undefined, 'must not fall out of guided research entirely');
  assert.doesNotMatch(JSON.stringify(r.result), /appointed with state farm/i, 'no fabricated carrier appointment');
});

// TH-DISCOVERY-RESET-001: geography broadening now happens automatically before this even reaches
// the specialist -- but producer mass-listing publication remains a genuine, deliberate,
// geography-independent restriction (not a suppression bug RESULTS FIRST should override):
// InsuranceTrustHub never publishes producer mass cohorts at any geography grain, only exact NPN
// lookups. Auto-broadening to Florida still correctly hits this same restriction.
test('PRODUCER DISCOVERY: "insurance producer in Palm Beach County" auto-broadens geography, but producer mass-listing restriction remains a genuine, unaffected policy', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance producer in Palm Beach County' } });
  assert.equal(r.result?.resultState, 'PUBLICATION_RESTRICTED');
  assert.equal(r.session.executionScope.reasonCodes.includes('AUTOMATIC_BROADENING'), true, 'geography still auto-broadens even though the specialist then declines to publish a producer cohort');
});

test('EXACT IDENTIFIER: "NAIC code 10064" remains exact, unaffected by Discovery changes', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'NAIC code 10064' } });
  assert.equal(r.result?.resultState, 'EXACT_IDENTITY');
});

test('EDUCATIONAL: "difference between insurance agency and insurer" is a HOW_TO/EXPLAINER question, not an entity lookup', () => {
  const plan = planAskResearch('difference between insurance agency and insurer');
  assert.equal(plan.intent, 'EXPLAINER');
  assert.notEqual(plan.intent, 'ENTITY_LOOKUP_MISSING_IDENTITY');
  // The educational answer itself is delivered by the concierge (/api/chat) path, which already
  // answers this correctly and thoroughly (verified live in production; see TH-DISCOVERY-002
  // closeout) -- /api/guided-research is a structured search-result interface and correctly
  // declines to force a specialist search for a definitional question rather than fabricating one.
});

test('AMBIGUOUS INTENT: "moving company insurance Florida" asks one concise clarification, never a giant provider cohort from a vague phrase', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'moving company insurance Florida' } });
  assert.equal(r.session.researchPlan.intent, 'MULTI_HUB_JOURNEY');
  assert.deepEqual([...r.session.researchPlan.candidateHubs].sort(), ['insurance', 'move']);
  assert.equal(r.result, undefined, 'no specialist should have been dispatched for a materially ambiguous cross-hub phrase');
});
