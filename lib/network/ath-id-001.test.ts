import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { idRefusal, idReleaseGatePassed, ID_PUBLICATION_MANIFEST, queryLooksLikeIdaho } from './id-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries, listAskNetworkStates } from './published-ask-states.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';

test('Idaho appends after the current catalog and derives the network count', () => {
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.at(-1)?.slug, 'idaho');
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.at(-1)?.code, 'ID');
  for (const slug of ['nebraska', 'iowa', 'new-mexico', 'utah', 'arkansas', 'oklahoma', 'missouri']) {
    assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === slug), slug);
  }
  assert.equal(listAskNetworkStates().length, ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(), new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  assert.equal(idReleaseGatePassed(), true);
  assert.equal(ID_PUBLICATION_MANIFEST.contract, 'ath-id-network-release-v1');
  assert.equal(ID_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(ID_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(ID_PUBLICATION_MANIFEST.scope, 'STATE_LEVEL_ONLY');
  for (const hub of ID_PUBLICATION_MANIFEST.hubs) assert.equal(hub.capability_summary, hub.summary);
  assert.equal(askStateSitemapEntries().filter((entry) => entry.path === '/idaho').length, 1);
  assert.equal(normalizedPublishedStatePath('/Idaho'), '/idaho');
  assert.equal(normalizedPublishedStatePath('/idaho'), null);
  assert.equal(normalizedPublishedStatePath('/idaho/boise'), null);
});

test('Idaho geography requires the state name or in id and ignores a bare id token', () => {
  assert.equal(parseNetworkAsk('household goods movers in Idaho').geography?.stateCode, 'ID');
  assert.equal(parseNetworkAsk('contractors in id').geography?.stateCode, 'ID');
  assert.equal(parseNetworkAsk('contractors in ID').geography?.stateCode, 'ID');
  assert.equal(queryLooksLikeIdaho('contractor id'), false);
  assert.equal(queryLooksLikeIdaho('contractor ID'), false);
  assert.equal(queryLooksLikeIdaho('contractor Boise'), false);
  assert.notEqual(parseNetworkAsk('contractor id').geography?.stateCode, 'ID');
  assert.equal(planAskResearch('Who is the best Idaho contractor?').executionAllowed, false);
  assert.match(idRefusal('Who is the best Idaho contractor?')!, /does not rank or recommend/i);
  assert.match(idRefusal('How many licensed providers are in Idaho?')!, /combined Idaho provider total is undefined/i);
  assert.equal(idRefusal('best contractor'), undefined);
  assert.equal(planAskResearch('Nebraska contractor').requestedGeography?.stateCode, 'NE');
  assert.equal(planAskResearch('Iowa nursing homes').requestedGeography?.stateCode, 'IA');
  const plan = planAskResearch('Find CRD 123456 in Idaho');
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.primaryHub, 'investor');
  assert.equal(planAskResearch('mortgage lenders in Idaho').primaryHub, 'lender');
  assert.equal(planAskResearch('household goods movers in Idaho').primaryHub, 'move');
  assert.ok(ID_PUBLICATION_MANIFEST.hubs.every((hub) => hub.url.endsWith('/idaho')));
  assert.doesNotMatch(JSON.stringify(ID_PUBLICATION_MANIFEST), /AggregateRating|"107"|"108"/);
});
