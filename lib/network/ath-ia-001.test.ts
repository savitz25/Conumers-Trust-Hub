import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { planAskResearch } from './research-planner.ts';
import { IA_PUBLICATION_MANIFEST, iaReleaseGatePassed, iaSpecialistUrl } from './ia-network.ts';
import { askStateSitemapEntries, listGatedAskStates } from './published-ask-states.ts';

test('Iowa gateway publishes six verified specialist links and no combined census', () => {
  assert.equal(iaReleaseGatePassed(), true);
  assert.equal(IA_PUBLICATION_MANIFEST.hubs.length, 6);
  assert.equal(IA_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(IA_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(listGatedAskStates().filter((state) => state.code === 'IA').length, 1);
  assert.equal(askStateSitemapEntries().filter((state) => state.path === '/iowa').length, 1);
  for (const hub of IA_PUBLICATION_MANIFEST.hubs) {
    assert.equal(hub.url, iaSpecialistUrl(hub.hub_id as Parameters<typeof iaSpecialistUrl>[0]));
  }
});

test('Iowa research recognizes specialist identifiers but fails closed in Ask', () => {
  for (const [query, hub] of [
    ['Iowa household goods mover USDOT 1234567', 'move'],
    ['Iowa contractor registration C123456', 'contractor'],
    ['Iowa mortgage broker NMLS 123456', 'lender'],
    ['Iowa insurer NAIC 12345', 'insurance'],
    ['Iowa assisted living certification S12345', 'senior'],
    ['Iowa investment adviser CRD 12345', 'investor'],
  ] as const) {
    const research = planAskResearch(query);
    assert.equal(research.primaryHub, hub, query);
    assert.equal(research.requestedGeography?.stateCode, 'IA', query);
    assert.equal(research.executionAllowed, false, query);
    const answer = buildNetworkAskPlan(query);
    assert.equal(answer.hubs[0]?.hubId, hub, query);
    assert.equal(answer.hubs[0]?.destination, undefined, query);
  }
});

test('Iowa rankings and aggregate totals fail closed without capturing other states', () => {
  for (const query of ['best Iowa insurance company', 'combined total of Iowa providers']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
  }
  assert.notEqual(planAskResearch('Oklahoma contractor').requestedGeography?.stateCode, 'IA');
});
