import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { okReleaseGatePassed, OK_PUBLICATION_MANIFEST, okSpecialistUrl, queryLooksLikeOklahoma } from './ok-network.ts';
import { askStateSitemapEntries, listGatedAskStates, ASK_PUBLISHED_STATE_CATALOG } from './published-ask-states.ts';

test('Oklahoma publishes six verified specialist gateways with separate grains', () => {
  assert.equal(okReleaseGatePassed(), true);
  assert.equal(OK_PUBLICATION_MANIFEST.hubs.length, 6);
  assert.equal(OK_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(OK_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(listGatedAskStates().filter((state) => state.code === 'OK').length, 1);
  assert.equal(askStateSitemapEntries().filter((state) => state.path === '/oklahoma').length, 1);
  assert.equal(listGatedAskStates().at(-1)?.code, 'OK');
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.length, listGatedAskStates().length);
  for (const hub of OK_PUBLICATION_MANIFEST.hubs) assert.equal(hub.url, okSpecialistUrl(hub.hub_id as Parameters<typeof okSpecialistUrl>[0]));
  assert.doesNotMatch(JSON.stringify(OK_PUBLICATION_MANIFEST), /3,873|4,862|1,882|AggregateRating|Trust Score/);
});

test('Oklahoma search hands off without creating a provider cohort', () => {
  for (const [query, hub] of [
    ['Oklahoma household goods mover USDOT 1234567', 'move'],
    ['Oklahoma electrical contractor license', 'contractor'],
    ['Oklahoma mortgage broker NMLS 123456', 'lender'],
    ['Oklahoma insurer NAIC 12345', 'insurance'],
    ['Oklahoma assisted living OSDH', 'senior'],
    ['Oklahoma investment adviser CRD 12345', 'investor'],
    ['mortgage broker in OK NMLS 123456', 'lender'],
  ] as const) {
    const plan = planAskResearch(query);
    assert.equal(plan.primaryHub, hub, query);
    assert.equal(plan.requestedGeography?.stateCode, 'OK', query);
    assert.equal(buildNetworkAskPlan(query).hubs[0]?.destination, okSpecialistUrl(hub), query);
  }
  assert.equal(parseNetworkAsk('Oklahoma mortgage broker NMLS 123456').identifier?.family.hubId, 'lender');
});

test('Oklahoma rankings and bare ok fail closed; other states retain geography', () => {
  for (const query of ['best Oklahoma insurance company', 'combined total of Oklahoma providers']) {
    assert.equal(planAskResearch(query).executionAllowed, false, query);
  }
  assert.equal(queryLooksLikeOklahoma('ok'), false);
  assert.equal(queryLooksLikeOklahoma('in ok'), true);
  assert.notEqual(planAskResearch('in ar household goods').requestedGeography?.stateCode, 'OK');
  assert.notEqual(planAskResearch('Mississippi nursing home').requestedGeography?.stateCode, 'OK');
  assert.notEqual(planAskResearch('Missouri contractor').requestedGeography?.stateCode, 'OK');
  assert.notEqual(planAskResearch('Arkansas investment adviser').requestedGeography?.stateCode, 'OK');
  assert.notEqual(planAskResearch('Utah mortgage lender').requestedGeography?.stateCode, 'OK');
});
