import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { arReleaseGatePassed, AR_PUBLICATION_MANIFEST, arSpecialistUrl } from './ar-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries, listAskNetworkStates, listGatedAskStates } from './published-ask-states.ts';

test('Arkansas publishes six verified specialist gateways with separate grains', () => {
  assert.equal(arReleaseGatePassed(), true);
  assert.equal(AR_PUBLICATION_MANIFEST.hubs.length, 6);
  assert.equal(AR_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(AR_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(listGatedAskStates().filter((state) => state.code === 'AR').length, 1);
  assert.equal(askStateSitemapEntries().filter((state) => state.path === '/arkansas').length, 1);
  assert.equal(listAskNetworkStates().length, ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(), new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  assert.equal(JSON.stringify(AR_PUBLICATION_MANIFEST).includes('19,229'), false);
  assert.equal(JSON.stringify(AR_PUBLICATION_MANIFEST).includes('1,658'), false);
  assert.equal(JSON.stringify(AR_PUBLICATION_MANIFEST).includes('206,044'), false);
  assert.equal(JSON.stringify(AR_PUBLICATION_MANIFEST).includes('13,458'), false);
  assert.equal(JSON.stringify(AR_PUBLICATION_MANIFEST).includes('Trust Score'), false);
  for (const hub of AR_PUBLICATION_MANIFEST.hubs) assert.equal(hub.url, arSpecialistUrl(hub.hub_id as Parameters<typeof arSpecialistUrl>[0]));
});

test('Arkansas search hands off without creating a provider cohort', () => {
  for (const [query, hub] of [
    ['Arkansas household goods mover USDOT 1234567', 'move'],
    ['commercial contractor Arkansas', 'contractor'],
    ['Arkansas mortgage company NMLS 123456', 'lender'],
    ['how many mortgage applications in Arkansas', 'lender'],
    ['Arkansas insurer NAIC 12345', 'insurance'],
    ['Arkansas nursing facility DHS', 'senior'],
    ['Arkansas investment adviser CRD 12345', 'investor'],
    ['mortgage broker in AR NMLS 123456', 'lender'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.requestedGeography?.stateCode, 'AR', query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.executionAllowed, true, query);
    assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, arSpecialistUrl(hub), query);
  }
  assert.equal(parseNetworkAsk('Arkansas mortgage company NMLS 123456').identifier?.family.hubId, 'lender');
});

test('Arkansas rankings and combined totals fail closed; other states retain geography', () => {
  for (const query of ['best Arkansas insurance company', 'how many contractors in Arkansas', 'how many providers in Arkansas', 'how many senior facilities in Arkansas', 'combined total of Arkansas providers']) {
    const plan = planAskResearch(query);
    assert.equal(plan.requestedGeography?.stateCode, 'AR', query);
    assert.equal(plan.executionAllowed, false, query);
  }
  assert.notEqual(planAskResearch('in arizona').requestedGeography?.stateCode, 'AR');
  assert.notEqual(planAskResearch('nursing home Fayetteville').requestedGeography?.stateCode, 'AR');
  assert.notEqual(planAskResearch('Oklahoma contractor').requestedGeography?.stateCode, 'AR');
  assert.notEqual(planAskResearch('Missouri household goods mover').requestedGeography?.stateCode, 'AR');
  assert.notEqual(planAskResearch('Utah investment adviser').requestedGeography?.stateCode, 'AR');
  assert.notEqual(planAskResearch('Mississippi nursing home').requestedGeography?.stateCode, 'AR');
});
