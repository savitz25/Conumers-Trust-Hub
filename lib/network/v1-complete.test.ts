import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HUB_CAPABILITY_REGISTRY } from './capability-registry.ts';
import { V1_PRINCIPLES, V1_SPECIALISTS, V1_STATUS, V1_VERDICT } from './v1-complete.ts';
import { buildNetworkAskPlan } from './ask-plan.ts';

test('V1 architecture lock matches the live capability registry', () => {
  assert.equal(V1_STATUS, 'ASKTRUSTHUB INTELLIGENCE NETWORK V1 — COMPLETE');
  assert.equal(
    V1_VERDICT,
    'ASKTRUSTHUB INTELLIGENCE NETWORK V1 COMPLETE — 6/6 SPECIALISTS LIVE / EXECUTE',
  );
  assert.equal(V1_PRINCIPLES.length, 15);

  for (const [hubId, expected] of Object.entries(V1_SPECIALISTS)) {
    const rec = HUB_CAPABILITY_REGISTRY[hubId as keyof typeof HUB_CAPABILITY_REGISTRY];
    assert.equal(rec.askStatus, expected.askStatus, hubId);
    assert.equal(rec.federatedExecution, expected.federatedExecution, hubId);
    assert.equal(rec.structuredAskUrl, expected.structuredAskUrl, hubId);
    if (expected.askContract) {
      assert.equal(rec.askContract, expected.askContract, hubId);
    } else {
      assert.equal(rec.askContract, undefined, hubId);
    }
  }
});

test('V1 principles remain locked: no Trust Score, no paid ranking, fail closed', () => {
  assert.ok(V1_PRINCIPLES.includes('No universal Trust Score.'));
  assert.ok(V1_PRINCIPLES.includes('Paid status never changes evidence/ranking/conclusions.'));
  assert.ok(V1_PRINCIPLES.includes('Unsupported questions fail closed.'));
  assert.ok(V1_PRINCIPLES.includes('Natural language does not generate underlying regulatory facts.'));
  const blob = JSON.stringify(buildNetworkAskPlan('Who is the best provider in the network?'));
  assert.doesNotMatch(blob, /Trust Score/);
  assert.equal(buildNetworkAskPlan('Who is the best provider in the network?').hubs.length, 0);
});
