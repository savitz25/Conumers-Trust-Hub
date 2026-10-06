import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { planAskResearch } from './research-planner.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { NE_PUBLICATION_MANIFEST, neRefusal, neReleaseGatePassed, queryLooksLikeNebraska } from './ne-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries, listAskNetworkStates } from './published-ask-states.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';

test('Nebraska appends after the current catalog and derives the network count', () => {
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.at(-1)?.slug, 'nebraska');
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.at(-1)?.code, 'NE');
  for (const slug of ['iowa', 'new-mexico', 'utah', 'arkansas', 'oklahoma', 'missouri']) {
    assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === slug), slug);
  }
  assert.equal(listAskNetworkStates().length, ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(), new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  assert.equal(neReleaseGatePassed(), true);
  assert.equal(NE_PUBLICATION_MANIFEST.contract, 'ath-ne-network-release-v1');
  assert.equal(NE_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(NE_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(NE_PUBLICATION_MANIFEST.scope, 'STATE_LEVEL_ONLY');
  assert.equal(new Set(NE_PUBLICATION_MANIFEST.hubs.map((hub) => hub.hub_id)).size, 6);
  for (const hub of NE_PUBLICATION_MANIFEST.hubs) assert.equal(hub.capability_summary, hub.summary);
  assert.equal(askStateSitemapEntries().filter((entry) => entry.path === '/nebraska').length, 1);
  assert.equal(normalizedPublishedStatePath('/Nebraska'), '/nebraska');
  assert.equal(normalizedPublishedStatePath('/nebraska'), null);
  assert.equal(normalizedPublishedStatePath('/nebraska/omaha'), null);
  assert.equal(normalizedPublishedStatePath('/nebraska/lincoln'), null);
});

test('Nebraska geography requires the state and does not capture Nevada or a city', () => {
  assert.equal(parseNetworkAsk('household goods movers in Nebraska').geography?.stateCode, 'NE');
  assert.equal(parseNetworkAsk('movers in NE').geography?.stateCode, 'NE');
  assert.equal(queryLooksLikeNebraska('movers in Nevada'), false);
  assert.equal(queryLooksLikeNebraska('contractor Omaha'), false);
  assert.equal(queryLooksLikeNebraska('contractor Lincoln'), false);
  assert.equal(queryLooksLikeNebraska('contractor in Iowa'), false);
  assert.equal(planAskResearch('Oklahoma contractor').requestedGeography?.stateCode, 'OK');
  assert.notEqual(planAskResearch('New Mexico nursing homes').requestedGeography?.stateCode, 'NE');
});

test('Nebraska rankings and population questions fail closed', () => {
  for (const query of [
    'best Nebraska contractor',
    'how many contractors in Nebraska',
    'how many providers in NE',
    'how many senior facilities in Nebraska',
  ]) {
    const research = planAskResearch(query);
    assert.equal(research.executionAllowed, false, query);
    assert.match(neRefusal(query) ?? '', /does not rank|undefined/i, query);
    assert.equal(research.requestedGeography?.stateCode, 'NE', query);
  }
});

test('A Nebraska class question names one specialist and does not execute a search', () => {
  const research = planAskResearch('Nebraska household goods mover ML-01');
  assert.equal(research.primaryHub, 'move');
  assert.equal(research.executionAllowed, false);
  const answer = buildNetworkAskPlan('Nebraska mortgage banker licenses');
  assert.equal(answer.hubs[0]?.hubId, 'lender');
  assert.equal(answer.hubs[0]?.destination, undefined);
});
