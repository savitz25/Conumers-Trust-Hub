import test from 'node:test';
import assert from 'node:assert/strict';
import { planAskResearch } from './research-planner.ts';
import { resolveResearchScope } from './research-scope.ts';
import { decideAskExecution } from './execution-decision.ts';
import { IDENTIFIER_FAMILIES } from './identifiers.ts';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { assembleNetworkAnswerWithSpecialist } from './ask-plan.ts';
import { createGuidedSession } from '../guided-research/session.ts';

async function withMockFetch(payload: Record<string, unknown>, run: () => Promise<void>) {
  const original = globalThis.fetch;
  const context = process.env.NODE_TEST_CONTEXT;
  delete process.env.NODE_TEST_CONTEXT;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
    if (context) process.env.NODE_TEST_CONTEXT = context;
  }
}

// --- Bug #1: Lender NMLS/LEI identifier resolution must be live, not a stale handoff. ---

test('R1-016 Bug #1: NMLS and LEI are registered live on lender-ask-v1', () => {
  assert.equal(IDENTIFIER_FAMILIES.find((f) => f.id === 'nmls')?.live, true);
  assert.equal(IDENTIFIER_FAMILIES.find((f) => f.id === 'lei')?.live, true);
  assert.equal(HUB_CAPABILITY_REGISTRY.lender.identifierLookup, 'live');
});

test('R1-016 Bug #1: NMLS identifier query routes to a live lender-ask-v1 execute call', () => {
  const plan = planAskResearch('NMLS 3030');
  const scope = resolveResearchScope(plan);
  assert.equal(plan.intent, 'IDENTIFIER_LOOKUP');
  assert.equal(plan.primaryHub, 'lender');
  assert.equal(plan.executionAllowed, true);
  assert.equal(scope.executionAllowed, true);
});

// --- Bug #2: a genuine exact-identifier miss must downgrade to NO_CONFIDENT_MATCH, ---
// --- never render as a false EXACT_IDENTITY hit with zero results.                 ---

test('R1-016 Bug #2: Lender NMLS miss downgrades EXACT_IDENTITY to NO_CONFIDENT_MATCH', async () => {
  await withMockFetch(
    { contract: 'lender-ask-v1', query: { mode: 'entity' }, headline: 'No match', rows: [] },
    async () => {
      const answer = await assembleNetworkAnswerWithSpecialist('NMLS 9999999');
      assert.equal(answer.resultClass, 'NO_CONFIDENT_MATCH');
      assert.equal(answer.identityResolutionClass, 'NO_CONFIDENT_MATCH');
      assert.equal(answer.options?.length ?? 0, 0);
      assert.match(answer.noResult?.headline ?? '', /NMLS 9999999/);
      assert.doesNotMatch(answer.noResult?.headline ?? '', /NMLS NMLS/);
    },
  );
});

test('R1-016 Bug #2: a real Lender NMLS hit is not downgraded (no false negative)', async () => {
  await withMockFetch(
    {
      contract: 'lender-ask-v1',
      query: { mode: 'entity' },
      headline: 'Rocket Mortgage',
      rows: [{ displayName: 'Rocket Mortgage', metric: 1, identityStatus: 'matched' }],
    },
    async () => {
      const answer = await assembleNetworkAnswerWithSpecialist('NMLS 3030');
      assert.equal(answer.resultClass, 'EXACT_IDENTITY');
      assert.notEqual(answer.options?.length ?? 0, 0);
    },
  );
});

// --- Bug #3: entity-name / journey queries must actually reach and execute the ---
// --- correctly-routed specialist, not fall through to a blanket refusal.      ---

test('R1-016 Bug #3: a bare multi-word company name is recognized as an entity lookup', () => {
  const decision = decideAskExecution('JK Moving Services');
  assert.equal(decision.mode, 'SINGLE_SPECIALIST');
  assert.equal(decision.executionAllowed, true);
  assert.equal(decision.plan.intent, 'ENTITY_LOOKUP');
  assert.equal(decision.plan.entityName, 'JK Moving Services');
  assert.equal(decision.plan.primaryHub, 'move');
});

test('R1-016 Bug #3: a company name embedded in a route/journey sentence still executes an identity lookup', () => {
  const decision = decideAskExecution('Can JK Moving handle my move from Virginia to Florida?');
  assert.equal(decision.mode, 'SINGLE_SPECIALIST');
  assert.equal(decision.executionAllowed, true);
  assert.equal(decision.plan.intent, 'ENTITY_LOOKUP');
  assert.equal(decision.plan.entityName, 'JK Moving');
  assert.match(decision.scope.disclosure ?? '', /route or service-territory capability/i);
});

test('R1-016 Bug #3: a pure route/service-territory cohort question (no named company) stays a disclosed clarification, not silently blocked', () => {
  const decision = decideAskExecution('moving from Miami Florida to New York City');
  assert.equal(decision.plan.executionAllowed, true);
  assert.equal(decision.mode, 'CLARIFICATION');
  assert.equal(decision.executionAllowed, false);
  assert.equal(decision.scope.resolutionState, 'CAPABILITY_UNSUPPORTED');
  assert.ok(decision.scope.disclosure, 'route cohort clarification must carry a disclosure, not a blank refusal');
});

// --- Bug #3 also lived in the guided-research session state machine -- a third, ---
// --- independent classifier that powers the real /ask page -- which unconditionally ---
// --- discarded any identity name whenever route language ("from X to Y") was present. ---

test('R1-016 Bug #3 (guided session): a company name embedded in a route sentence reaches EXECUTE with the identity preserved', () => {
  const session = createGuidedSession('Can JK Moving handle my move from Virginia to Florida?');
  assert.equal(session?.phase, 'EXECUTE');
  assert.equal(session?.hub, 'move');
  assert.equal(session?.identityName, 'JK Moving');
});

test('R1-016 Bug #3 (guided session): a bare company name still reaches EXECUTE with the identity preserved', () => {
  const session = createGuidedSession('JK Moving Services');
  assert.equal(session?.phase, 'EXECUTE');
  assert.equal(session?.identityName, 'JK Moving Services');
});

test('R1-016 Bug #3 (guided session): a pure route/service query with no named company still executes a cohort search, not an identity lookup', () => {
  const session = createGuidedSession('moving from Miami Florida to New York City');
  assert.equal(session?.phase, 'EXECUTE');
  assert.equal(session?.identityName, undefined);
  assert.equal(session?.moveMode, 'mover');
});

// --- Regression guards: the entity-name heuristic must not reinterpret malformed ---
// --- identifier probes or adversarial "make up a value" prompts as real names.  ---

test('R1-016 regression: malformed identifier-shaped input stays a blocked missing-identity clarification', () => {
  for (const q of ['NAIC ABCD', 'CBC ABC']) {
    const decision = decideAskExecution(q);
    assert.equal(decision.mode, 'CLARIFICATION', q);
    assert.equal(decision.plan.intent, 'ENTITY_LOOKUP_MISSING_IDENTITY', q);
  }
});

test('R1-016 regression: an instruction to fabricate a value is not treated as a real entity lookup', () => {
  const decision = decideAskExecution('Make up a license number for ABC Roofing');
  assert.equal(decision.mode, 'CLARIFICATION');
  assert.equal(decision.plan.intent, 'ENTITY_LOOKUP_MISSING_IDENTITY');
});

test('R1-016 regression: previously-working cohort and identifier queries are unaffected', () => {
  const cases: Array<[string, string]> = [
    ['USDOT 3244649', 'move'],
    ['lenders in New Jersey', 'lender'],
    ['roofers in Broward County', 'contractor'],
    ['nursing homes in Austin Texas', 'senior'],
  ];
  for (const [q, hub] of cases) {
    const decision = decideAskExecution(q);
    assert.equal(decision.mode, 'SINGLE_SPECIALIST', q);
    assert.equal(decision.plan.primaryHub, hub, q);
  }
});
