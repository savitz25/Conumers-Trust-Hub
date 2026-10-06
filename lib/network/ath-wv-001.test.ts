import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNetworkAsk } from './ask-parse.ts';
import { planAskResearch } from './research-planner.ts';
import { WV_PUBLICATION_MANIFEST, queryLooksLikeWestVirginia, wvRefusal, wvReleaseGatePassed } from './wv-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries, listAskNetworkStates } from './published-ask-states.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';

test('West Virginia appends after the current catalog and derives the network count', () => {
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.at(-1)?.slug, 'west-virginia');
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.at(-1)?.code, 'WV');
  for (const slug of ['idaho', 'kansas', 'nebraska', 'iowa', 'new-mexico', 'utah']) {
    assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === slug), slug);
  }
  assert.equal(listAskNetworkStates().length, ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(), new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  assert.equal(wvReleaseGatePassed(), true);
  assert.equal(WV_PUBLICATION_MANIFEST.contract, 'ath-wv-network-release-v1');
  assert.equal(WV_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(WV_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.equal(WV_PUBLICATION_MANIFEST.scope, 'STATE_LEVEL_ONLY');
  assert.equal(new Set(WV_PUBLICATION_MANIFEST.hubs.map((hub) => hub.hub_id)).size, 6);
  for (const hub of WV_PUBLICATION_MANIFEST.hubs) assert.equal(hub.capability_summary, hub.summary);
  assert.equal(askStateSitemapEntries().filter((entry) => entry.path === '/west-virginia').length, 1);
  assert.equal(normalizedPublishedStatePath('/West-Virginia'), '/west-virginia');
  assert.equal(normalizedPublishedStatePath('/west-virginia'), null);
  assert.equal(normalizedPublishedStatePath('/west-virginia/charleston'), null);
  assert.doesNotMatch(JSON.stringify(WV_PUBLICATION_MANIFEST), /AggregateRating|1,?125|1,?137|3,?041|\b486\b|\b490\b/);
});

test('West Virginia geography requires the state and does not capture Virginia or a city', () => {
  assert.equal(parseNetworkAsk('household goods movers in West Virginia').geography?.stateCode, 'WV');
  assert.equal(parseNetworkAsk('movers in wv').geography?.stateCode, 'WV');
  assert.equal(parseNetworkAsk('movers in WV').geography?.stateCode, 'WV');
  assert.equal(queryLooksLikeWestVirginia('contractor wv'), false);
  assert.equal(queryLooksLikeWestVirginia('contractor WV'), false);
  assert.equal(queryLooksLikeWestVirginia('contractor Charleston'), false);
  assert.equal(queryLooksLikeWestVirginia('contractor Morgantown'), false);
  assert.equal(queryLooksLikeWestVirginia('contractor Huntington'), false);
  assert.equal(queryLooksLikeWestVirginia('movers in Virginia'), false);
  assert.equal(parseNetworkAsk('movers in Virginia').geography?.stateCode, 'VA');
  assert.equal(parseNetworkAsk('contractors in id').geography?.stateCode, 'ID');
  assert.equal(parseNetworkAsk('contractor in Kansas').geography?.stateCode, 'KS');
  assert.equal(planAskResearch('best West Virginia contractor').executionAllowed, false);
  assert.match(wvRefusal('best West Virginia contractor') ?? '', /does not rank/i);
  assert.match(wvRefusal('how many contractors in West Virginia') ?? '', /undefined/i);
  assert.match(wvRefusal('how many providers in WV') ?? '', /undefined/i);
  assert.match(wvRefusal('how many senior facilities in West Virginia') ?? '', /undefined/i);
  assert.equal(wvRefusal('best contractor'), undefined);
  const movers = planAskResearch('household goods mover in wv');
  assert.equal(movers.executionAllowed, false);
  assert.equal(movers.primaryHub, 'move');
  assert.equal(planAskResearch('West Virginia mortgage companies').primaryHub, 'lender');
  assert.equal(planAskResearch('West Virginia elevator inspectors').primaryHub, 'contractor');
  assert.equal(planAskResearch('West Virginia nursing homes').executionAllowed, false);
  assert.equal(planAskResearch('West Virginia nursing homes').primaryHub, 'senior');
});
