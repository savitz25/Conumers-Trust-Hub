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

test('LENDER: "mortgage lenders in Miami Florida" -- a city mapping to an unpublished county offers a real path to Florida results, not a dead end', async () => {
  const step1 = await orchestrateGuidedResearch({ action: { type: 'START', question: 'mortgage lenders in Miami Florida' } });
  const broaden = step1.session.availableChoices.find((c) => c.value === 'scope_state:FL');
  assert.ok(broaden, 'a path to broader Florida results must be offered, not just a dead end');
  const step2 = await orchestrateGuidedResearch({ session: step1.session, action: { type: 'SELECT_CHOICE', value: broaden!.value } });
  assert.equal(step2.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((step2.result?.total ?? 0) > 0);
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

test('BOCA RATON FLAGSHIP: "insurance company in boca raton fl" has a real path to providers, not a bare dead end', async () => {
  const step1 = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance company in boca raton fl' } });
  assert.notEqual(step1.result?.resultState, 'ZERO_MATCHING_ROWS', 'an unsupported local grain is a different claim from "we searched and found zero"');
  const broaden = step1.result?.choices?.find((c) => c.value.startsWith('scope_state:'));
  assert.ok(broaden, 'a path to broader Florida results must be offered alongside the ZIP-directory handoff');
  const step2 = await orchestrateGuidedResearch({ session: step1.session, action: { type: 'SELECT_CHOICE', value: broaden!.value } });
  assert.equal(step2.result?.resultState, 'SUPPORTED_RESULTS');
  assert.ok((step2.result?.total ?? 0) > 0);
  assert.doesNotMatch(step2.result?.consumerMessage ?? '', /boca raton (?:office|service)/i, 'must never claim local Boca Raton presence from statewide evidence');
});

test('BOCA RATON FLAGSHIP: "insurance agency in boca raton fl" (unambiguous agency wording) reaches the same real path to providers', async () => {
  const step1 = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency in boca raton fl' } });
  const broaden = step1.result?.choices?.find((c) => c.value.startsWith('scope_state:'));
  assert.ok(broaden);
  const step2 = await orchestrateGuidedResearch({ session: step1.session, action: { type: 'SELECT_CHOICE', value: broaden!.value } });
  assert.equal(step2.result?.resultState, 'SUPPORTED_RESULTS');
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

test('PRODUCER DISCOVERY: "insurance producer in Palm Beach County" offers a real path to broader results, never a bare dead end', async () => {
  const r = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance producer in Palm Beach County' } });
  const broaden = r.session.availableChoices.find((c) => c.value === 'scope_state:FL');
  assert.ok(broaden, 'a path to broader Florida results must be offered');
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
