import assert from 'node:assert/strict';
import test from 'node:test';
import { planAskResearch } from './research-planner.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { orchestrateGuidedResearch } from '../guided-research/orchestrator.ts';

type Expected = {
  query: string;
  intent: ReturnType<typeof planAskResearch>['intent'];
  hub?: ReturnType<typeof planAskResearch>['primaryHub'];
  entityClass?: string;
  identifier?: string;
  executable?: boolean;
};

const golden: Expected[] = [
  { query: 'mover in tampa bay florida', intent: 'COHORT_BROWSE', hub: 'move', entityClass: 'mover', executable: false },
  { query: 'How do I check if a moving company is licensed?', intent: 'HOW_TO', hub: 'move', executable: false },
  { query: 'USDOT 125563', intent: 'IDENTIFIER_LOOKUP', hub: 'move', identifier: '125563', executable: true },
  { query: 'Is this moving company licensed?', intent: 'ENTITY_LOOKUP_MISSING_IDENTITY', hub: 'move', executable: false },
  { query: "Is my lender's NMLS number valid?", intent: 'ENTITY_LOOKUP_MISSING_IDENTITY', hub: 'lender', executable: false },
  { query: 'NMLS 3030', intent: 'IDENTIFIER_LOOKUP', hub: 'lender', identifier: '3030', executable: true },
  { query: 'What should I look for on a Loan Estimate besides the rate?', intent: 'HOW_TO', hub: 'lender', executable: false },
  { query: 'mortgage lenders in Texas', intent: 'COHORT_BROWSE', hub: 'lender', executable: true },
  { query: 'How do I verify an insurance agent is real?', intent: 'HOW_TO', hub: 'insurance', executable: false },
  { query: 'Which auto insurance companies are licensed in Florida?', intent: 'COHORT_BROWSE', hub: 'insurance', executable: true },
  { query: 'Which auto insurance company is best in Florida?', intent: 'RECOMMENDATION_REQUEST', hub: 'insurance', executable: true },
  { query: 'Is this insurance agent licensed?', intent: 'ENTITY_LOOKUP_MISSING_IDENTITY', hub: 'insurance', executable: false },
  { query: 'nursing homes near Boca Raton Florida', intent: 'COHORT_BROWSE', hub: 'senior', entityClass: 'nursing_home', executable: true },
  { query: 'Is this home health agency Medicare certified?', intent: 'ENTITY_LOOKUP_MISSING_IDENTITY', hub: 'senior', executable: false },
  { query: 'What do CMS star ratings actually mean?', intent: 'EXPLAINER', hub: 'senior', executable: false },
  { query: 'What are the best nursing homes near Atlanta for my father?', intent: 'RECOMMENDATION_REQUEST', hub: 'senior', executable: true },
  { query: 'I need a licensed roofer in Fort Lauderdale Florida', intent: 'COHORT_BROWSE', hub: 'contractor', entityClass: 'roofing_contractor', executable: true },
  { query: 'Show active roofing contractors in Broward County Florida', intent: 'COHORT_BROWSE', hub: 'contractor', executable: true },
  { query: "How do I check if a contractor's license is active in California?", intent: 'HOW_TO', hub: 'contractor', executable: false },
  { query: 'Is this contractor licensed?', intent: 'ENTITY_LOOKUP_MISSING_IDENTITY', hub: 'contractor', executable: false },
  { query: 'Is this financial advisor registered with the SEC?', intent: 'ENTITY_LOOKUP_MISSING_IDENTITY', hub: 'investor', executable: false },
  { query: 'registered investment advisers in West Palm Beach Florida', intent: 'COHORT_BROWSE', hub: 'investor', executable: true },
  { query: 'CRD 166089', intent: 'IDENTIFIER_LOOKUP', hub: 'investor', identifier: '166089', executable: true },
  { query: 'What should I read on Form ADV?', intent: 'HOW_TO', hub: 'investor', executable: false },
  { query: "I'm buying a house in Broward and need to research my lender, insurance and contractor.", intent: 'MULTI_HUB_JOURNEY', executable: false },
];

test('ASK-INTEL-001A golden query corpus produces safe structured plans', () => {
  for (const expected of golden) {
    const plan = planAskResearch(expected.query);
    assert.equal(plan.intent, expected.intent, expected.query);
    if (expected.hub) assert.equal(plan.primaryHub, expected.hub, expected.query);
    if (expected.entityClass) assert.equal(plan.entityClass?.id, expected.entityClass, expected.query);
    if (expected.identifier) assert.equal(plan.identifier?.value, expected.identifier, expected.query);
    assert.equal(plan.executionAllowed, expected.executable, expected.query);
    if (plan.intent !== 'ENTITY_LOOKUP') assert.equal(plan.entityName, undefined, expected.query);
  }
});

test('Tampa Bay remains requested region scope and never becomes identity evidence', () => {
  const plan = planAskResearch('mover in tampa bay florida');
  assert.equal(plan.intent, 'COHORT_BROWSE');
  assert.equal(plan.primaryHub, 'move');
  assert.equal(plan.entityClass?.id, 'mover');
  assert.equal(plan.entityName, undefined);
  assert.equal(plan.requestedGeography?.raw.toLowerCase(), 'tampa bay florida');
  assert.equal(plan.requestedGeography?.display, 'Tampa Bay, Florida');
  assert.equal(plan.requestedGeography?.resolution, 'UNRESOLVED');
  assert.equal(plan.normalizedGeography, undefined);
  assert.deepEqual(plan.missingSlots, ['geography']);
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.executionMode, 'CLARIFY');
  assert.equal(parseNetworkAsk('mover in tampa bay florida').queryClassification.type, 'COHORT');
  assert.equal(parseNetworkAsk('mover in tampa bay florida').queryClassification.residualName, 'bay');
});

test('adversarial lowercase and short-form variants do not manufacture names', () => {
  const variants = [
    'good mover boca', 'roofer near ft lauderdale licensed', 'nmls 3030 legit?',
    'nursing home for dad boca', 'is this guy really a financial adviser',
    'insurance guy licensed florida', 'mover tampa bay', 'movers tampa fl',
  ];
  for (const query of variants) {
    const plan = planAskResearch(query);
    assert.notEqual(plan.intent, 'ENTITY_LOOKUP', query);
    assert.equal(plan.entityName, undefined, query);
  }
});

test('planner validation repairs contradictory geographic identity plans', () => {
  const planned = planAskResearch('mover in tampa bay florida', {
    proposedIntent: 'ENTITY_LOOKUP', proposedEntityName: 'Tampa',
  });
  assert.equal(planned.intent, 'COHORT_BROWSE');
  assert.equal(planned.entityName, undefined);
  assert.equal(planned.executionAllowed, false);
  assert.ok(planned.reasonCodes.includes('IDENTITY_CONTRADICTS_GEOGRAPHY'));
});

test('Guided Research execution gate blocks unsafe planner outcomes', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error('specialist must not be called'); }) as typeof fetch;
  try {
    for (const query of [
      'mover in tampa bay florida',
      'How do I check if a moving company is licensed?',
      'Is this financial advisor registered with the SEC?',
      'Is this home health agency Medicare certified?',
    ]) {
      calls = 0;
      const response = await orchestrateGuidedResearch({ action: { type: 'START', question: query } });
      assert.equal(response.session.phase, 'CLARIFY', query);
      assert.equal(response.session.researchPlan.executionAllowed, false, query);
      assert.equal(response.diagnostics.specialistCalls, 0, query);
      assert.equal(calls, 0, query);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
