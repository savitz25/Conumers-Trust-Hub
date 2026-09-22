/**
 * POST-R1-ASK-INTENT-001R — targeted fixes found during live browser QA of PR #193.
 *
 * The Post-R1 interpretation fixes in POST-R1-ASK-INTENT-001 were verified against
 * `parseNetworkAsk`/`buildNetworkAskPlan` directly, but the live guided-research UI actually
 * runs through a THIRD, independent classification layer (`research-planner.ts`'s
 * `planAskResearch`/`inferHubs`/`explicitEntityName`, and `care-task.ts`'s `careLocation`),
 * which the original ticket's fixes never reached. Browser QA against the real preview exposed
 * three concrete gaps this file guards against.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { planAskResearch } from './research-planner.ts';

test('research-planner entityName: "is rocket mortgage legit" extracts "rocket mortgage" (was undefined, forced the guided UI to re-ask for the lender name it was just given)', () => {
  const p = planAskResearch('is rocket mortgage legit');
  assert.equal(p.entityName, 'rocket mortgage');
  assert.deepEqual(p.candidateHubs, ['lender']);
});

test('research-planner entityName: "is abbey delray south medicare certified" extracts "abbey delray south"', () => {
  const p = planAskResearch('is abbey delray south medicare certified');
  assert.equal(p.entityName, 'abbey delray south');
  assert.deepEqual(p.candidateHubs, ['senior']);
});

test('research-planner entityName: qualifier-stripping only fires when a wrapper was actually stripped (no change to ordinary queries)', () => {
  const p = planAskResearch('roofers in broward county');
  assert.equal(p.entityName, undefined);
});

test('research-planner inferHubs: "medicare supplement agent in ohio" is insurance-only -- bare "Medicare" must never add SeniorTrustHub as a candidate hub', () => {
  const p = planAskResearch('medicare supplement agent in ohio');
  assert.deepEqual(p.candidateHubs, ['insurance']);
  assert.ok(!p.candidateHubs.includes('senior'), 'WRONG_VERTICAL: SeniorTrustHub must not be offered merely because the query contains "Medicare"');
});

test('research-planner inferHubs: "Medicare certified" (no "supplement") still reaches SeniorTrustHub -- the guard is scoped to "Medicare supplement/Medigap" only', () => {
  const p = planAskResearch('is this nursing home medicare certified');
  assert.ok(p.candidateHubs.includes('senior'));
});

test('care-task careLocation (via planAskResearch): "home health agencies in miami dade county" resolves the explicit county mention to FL state (was UNRESOLVED, dead-ending the guided UI on "choose a state")', () => {
  const p = planAskResearch('home health agencies in miami dade county');
  assert.equal(p.requestedGeography?.resolution, 'RESOLVED');
  assert.equal(p.requestedGeography?.stateCode, 'FL');
  assert.equal(p.requestedGeography?.county, 'Miami-Dade');
});

test('care-task careLocation: Broward/Palm Beach explicit-county resolution (pre-existing) is unaffected by generalizing to all 67 FL counties', () => {
  const broward = planAskResearch('nursing homes in broward county');
  assert.equal(broward.requestedGeography?.stateCode, 'FL');
  assert.equal(broward.requestedGeography?.county, 'Broward');
  const palm = planAskResearch('hospice in palm beach county');
  assert.equal(palm.requestedGeography?.stateCode, 'FL');
  assert.equal(palm.requestedGeography?.county, 'Palm Beach');
});

test('care-task careLocation: a non-FL county mention stays unresolved rather than being guessed', () => {
  const p = planAskResearch('nursing homes in cook county');
  assert.notEqual(p.requestedGeography?.stateCode, 'FL');
});
