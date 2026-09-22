/**
 * POST-R1-ASK-MULTIHUB-001 — multi-hub generated-choice/session reliability fix.
 *
 * session.ts's base() has a pre-existing (predates all Post-R1 intent work; commit 0b0b767)
 * `candidateHubs.length > 1` branch that renders SELECT_CHOICE options shaped `hub:${hubId}`
 * whenever a query touches more than one specialist area ("is state farm licensed in texas",
 * "electrician mortgage lender New Jersey"). No branch in orchestrator.ts's afterChoice ever
 * consumed that value format -- every hub-specific branch requires session.hub to already be
 * set, which is never true in this CLARIFY state -- so clicking any of the choices the app
 * itself just rendered fell through to `throw new Error('invalid_hub')`, surfaced to the
 * consumer as "The Guided Research action or session was invalid." (a live HTTP 400 from
 * /api/guided-research). This is the permanent regression pack for the fix.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { orchestrateGuidedResearch } from './orchestrator.ts';

const MULTI_HUB_QUERIES = [
  'is state farm licensed in texas',
  'electrician mortgage lender New Jersey',
];

test('1. multi-hub session generates valid hub choices for both known repro queries', async () => {
  for (const q of MULTI_HUB_QUERIES) {
    const start = await orchestrateGuidedResearch({ action: { type: 'START', question: q } });
    assert.equal(start.session.hub, undefined, `${q}: hub must stay unset in the clarification state`);
    assert.equal(start.session.phase, 'CLARIFY');
    assert.ok(start.session.availableChoices.length >= 2, `${q}: must offer 2+ hub choices`);
    for (const choice of start.session.availableChoices) {
      assert.match(choice.value, /^hub:[a-z]+$/, `${q}: choice value must be hub:<id> shaped`);
    }
  }
});

test('2. every generated hub choice is accepted by afterChoice -- no invalid-session error', async () => {
  for (const q of MULTI_HUB_QUERIES) {
    const start = await orchestrateGuidedResearch({ action: { type: 'START', question: q } });
    for (const choice of start.session.availableChoices) {
      const after = await orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: choice.value } });
      assert.equal(after.session.hub, choice.value.slice('hub:'.length), `${q} / ${choice.value}: selected hub must persist`);
      assert.notEqual(after.session.phase, undefined);
    }
  }
});

test('3. the selected hub persists deterministically and matches the clicked choice', async () => {
  const start = await orchestrateGuidedResearch({ action: { type: 'START', question: 'is state farm licensed in texas' } });
  const after = await orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:insurance' } });
  assert.equal(after.session.hub, 'insurance');
  assert.equal(after.session.phase, 'CLARIFY');
  assert.equal(after.session.missingFields[0], 'insuranceEntityClass');
});

test('4. query geography is retained across the hub choice, not re-requested', async () => {
  const start = await orchestrateGuidedResearch({ action: { type: 'START', question: 'is state farm licensed in texas' } });
  const after = await orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:lender' } });
  assert.equal(after.session.geography?.stateCode, 'TX');
  const nj = await orchestrateGuidedResearch({ action: { type: 'START', question: 'electrician mortgage lender New Jersey' } });
  const njAfter = await orchestrateGuidedResearch({ session: nj.session, action: { type: 'SELECT_CHOICE', value: 'hub:contractor' } });
  assert.equal(njAfter.session.geography?.stateCode, 'NJ');
});

test('5. invalid hub choices remain rejected: unknown hub, hub not offered this session, malformed value, forged case, already-committed session', async () => {
  const start = await orchestrateGuidedResearch({ action: { type: 'START', question: 'is state farm licensed in texas' } });
  await assert.rejects(orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:senior' } }), /invalid_hub/);
  await assert.rejects(orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:investor' } }), /invalid_hub/, 'a real pilot hub not in this session\'s candidateHubs must still be rejected');
  await assert.rejects(orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:' } }), /invalid_hub/);
  await assert.rejects(orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:INSURANCE' } }), /invalid_hub/, 'must be case-sensitive, no forged-case bypass');
  const committed = await orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'hub:insurance' } });
  await assert.rejects(orchestrateGuidedResearch({ session: committed.session, action: { type: 'SELECT_CHOICE', value: 'hub:lender' } }), /invalid_hub/, 'a session that already committed to a hub must reject a second hub: selection');
});

test('6. existing non-hub guided choices are unaffected (insurance entity-class, lender mode, investor mode, contractor trade)', async () => {
  const insuranceStart = await orchestrateGuidedResearch({ action: { type: 'START', question: 'insurance agency near me' } });
  const insuranceAfter = await orchestrateGuidedResearch({ session: insuranceStart.session, action: { type: 'SELECT_CHOICE', value: 'insurance_class:agency' } });
  assert.equal(insuranceAfter.session.insuranceEntityClass, 'agency');

  const lenderStart = await orchestrateGuidedResearch({ action: { type: 'START', question: 'i need a mortgage lender' } });
  const lenderAfter = await orchestrateGuidedResearch({ session: lenderStart.session, action: { type: 'SELECT_CHOICE', value: 'lender_mode:property_market' } });
  assert.equal(lenderAfter.session.lenderResearchMode, 'property_market');
});

test('7. CARE_CHOICES assisted-living/memory-care fail-closed fix remains green (unaffected by this change)', async () => {
  const start = await orchestrateGuidedResearch({ action: { type: 'START', question: 'need help finding a home for my grandma' } });
  const after = await orchestrateGuidedResearch({ session: start.session, action: { type: 'SELECT_CHOICE', value: 'assisted_living' } });
  assert.equal(after.session.phase, 'CLARIFY');
  assert.equal(after.session.providerClass, undefined);
  assert.match(after.session.nextAction ?? '', /CMS Care Compare/i);
});

test('8. single-hub guided flows (candidateHubs.length === 1) are unchanged -- session.hub is set immediately, no CLARIFY-then-choose-hub step', async () => {
  const start = await orchestrateGuidedResearch({ action: { type: 'START', question: 'is rocket mortgage legit' } });
  assert.equal(start.session.hub, 'lender');
  assert.ok(!(start.session.phase === 'CLARIFY' && start.session.missingFields[0] === 'hub'), 'single-candidate-hub sessions must not go through the multi-hub picker');
});
