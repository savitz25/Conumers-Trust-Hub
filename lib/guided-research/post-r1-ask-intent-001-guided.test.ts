/**
 * POST-R1-ASK-INTENT-001 Section G: the Guided Research session/action-validity defect.
 *
 * CARE_CHOICES (session.ts) has always rendered "Assisted living" and "Memory care" as
 * clickable SELECT_CHOICE options whenever a senior-hub session reaches CLARIFY with
 * missingFields:['providerClass'] outside the CARE_TASK flow (e.g. the "grandma" fallback,
 * or any senior-hub session with no pre-detected provider class). Clicking either of those
 * two system-generated choices used to throw Error('invalid_choice') in orchestrator.ts's
 * afterChoice -- a valid, system-offered action immediately invalidating its own session,
 * exactly the class of defect this ticket section describes. Fixed to return an honest
 * CLARIFY (CMS Care Compare does not source these two classes) instead of throwing.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';
import { createGuidedSession } from './session.ts';

test('Section G: selecting "Assisted living" from CARE_CHOICES (non-CARE_TASK session) no longer throws invalid_choice', async () => {
  const start = createGuidedSession('need help finding a home for my grandma')!;
  assert.ok(!start.researchPlan.reasonCodes.includes('CARE_TASK'), 'test assumes the non-CARE_TASK path');
  assert.ok(start.availableChoices.some((c) => c.value === 'assisted_living'), 'Assisted living must actually be offered as a choice');
  const selected = await orchestrateGuidedResearch({ session: start, action: { type: 'SELECT_CHOICE', value: 'assisted_living' } });
  assert.equal(selected.session.phase, 'CLARIFY');
  assert.equal(selected.session.providerClass, undefined, 'must never claim an unsourced provider class as executable');
  assert.match(selected.session.nextAction ?? '', /Assisted Living.*CMS Care Compare/i);
});

test('Section G: selecting "Memory care" from CARE_CHOICES (non-CARE_TASK session) no longer throws invalid_choice', async () => {
  const start = createGuidedSession('need help finding a home for my grandma')!;
  const selected = await orchestrateGuidedResearch({ session: start, action: { type: 'SELECT_CHOICE', value: 'memory_care' } });
  assert.equal(selected.session.phase, 'CLARIFY');
  assert.equal(selected.session.providerClass, undefined);
  assert.match(selected.session.nextAction ?? '', /Memory Care.*CMS Care Compare/i);
});

test('Section G: the 3 supported care classes are unaffected by the assisted_living/memory_care fix', async () => {
  const start = createGuidedSession('need help finding a home for my grandma')!;
  const selected = await orchestrateGuidedResearch({ session: start, action: { type: 'SELECT_CHOICE', value: 'nursing_home' } });
  assert.equal(selected.session.providerClass, 'nursing_home');
  assert.equal(selected.session.phase, 'COLLECT');
});

test('Section G: a session-level senior-hub session created directly from "memory care in orlando" resolves honestly, not via a thrown error', () => {
  // Routed via the pre-existing CARE_TASK path (care-task.ts's planCareResearch), which already
  // handled memory_care/assisted_living honestly before this ticket -- confirms that path was
  // never the source of the defect, only the non-CARE_TASK CARE_CHOICES click-through was.
  const session = createGuidedSession('memory care in orlando');
  assert.ok(session, 'must produce a session, not null/not_guided_query');
  assert.equal(session?.hub, 'senior');
  assert.equal(session?.providerClass, undefined);
  assert.equal(session?.phase, 'CLARIFY');
  assert.match(session?.nextAction ?? '', /state-specific sources/i);
});
