import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { moReleaseGatePassed, MO_PUBLICATION_MANIFEST, moSpecialistUrl } from './mo-network.ts';
import { askStateSitemapEntries, listGatedAskStates } from './published-ask-states.ts';

test('Missouri publishes six verified specialist gateways with separate grains', () => {
  assert.equal(moReleaseGatePassed(), true);
  assert.equal(MO_PUBLICATION_MANIFEST.hubs.length, 6);
  assert.equal(MO_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(MO_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(listGatedAskStates().filter((state) => state.code === 'MO').length, 1);
  assert.equal(askStateSitemapEntries().filter((state) => state.path === '/missouri').length, 1);
  for (const hub of MO_PUBLICATION_MANIFEST.hubs) assert.equal(hub.url, moSpecialistUrl(hub.hub_id as Parameters<typeof moSpecialistUrl>[0]));
});

test('Missouri search hands off without creating a provider cohort', () => {
  for (const [query, hub] of [
    ['Missouri household goods mover USDOT 1234567', 'move'],
    ['Missouri electrical contractor license', 'contractor'],
    ['Missouri mortgage broker NMLS 123456', 'lender'],
    ['Missouri insurer NAIC 12345', 'insurance'],
    ['Missouri assisted living DHSS', 'senior'],
    ['Missouri investment adviser CRD 12345', 'investor'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.requestedGeography?.stateCode, 'MO', query);
    assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, moSpecialistUrl(hub), query);
  }
  assert.equal(parseNetworkAsk('Missouri mortgage broker NMLS 123456').identifier?.family.hubId, 'lender');
});

test('Missouri rankings and combined totals fail closed; other states retain geography', () => {
  for (const query of ['best Missouri insurance company', 'combined total of Missouri providers']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
  }
  assert.notEqual(planAskResearch('Mississippi nursing home').requestedGeography?.stateCode, 'MO');
  assert.notEqual(planAskResearch('Oklahoma contractor').requestedGeography?.stateCode, 'MO');
});
