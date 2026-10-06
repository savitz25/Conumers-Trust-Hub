import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { nmRefusal, nmReleaseGatePassed, NM_PUBLICATION_MANIFEST, queryLooksLikeNewMexico } from './nm-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries, listAskNetworkStates } from './published-ask-states.ts';

test('New Mexico appends one gateway and derives the explorer count', () => {
  assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === 'new-mexico'));
  for (const slug of ['missouri', 'oklahoma', 'arkansas', 'utah']) {
    assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === slug));
  }
  assert.equal(listAskNetworkStates().length, ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(), new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  assert.equal(nmReleaseGatePassed(), true);
  assert.equal(NM_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(NM_PUBLICATION_MANIFEST.graph_writes, 0);
  for (const hub of NM_PUBLICATION_MANIFEST.hubs) assert.equal(hub.capability_summary, hub.summary);
  assert.ok(askStateSitemapEntries().some((entry) => entry.path === '/new-mexico'));
  assert.equal(parseNetworkAsk('New Mexico household goods mover').geography?.stateCode, 'NM');
  assert.equal(parseNetworkAsk('nursing homes in NM').geography?.stateCode, 'NM');
  assert.equal(queryLooksLikeNewMexico('nm contractor'), false);
  assert.equal(queryLooksLikeNewMexico('best mover nm'), false);
  const plan = planAskResearch('Find CRD 123456 in New Mexico');
  assert.equal(plan.executionAllowed, false);
  assert.equal(plan.primaryHub, 'investor');
  assert.match(nmRefusal('Who is the best New Mexico contractor?')!, /does not rank or recommend/i);
  assert.match(nmRefusal('How many licensed providers are in New Mexico?')!, /combined New Mexico provider total is undefined/i);
  assert.equal(nmRefusal('best contractor'), undefined);
  assert.doesNotMatch(JSON.stringify(NM_PUBLICATION_MANIFEST), /AggregateRating|Trust Score|"52"|"114"/);
});
