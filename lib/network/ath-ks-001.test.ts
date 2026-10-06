import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildNetworkAskPlan } from './ask-plan.ts';
import { planAskResearch } from './research-planner.ts';
import { parseNetworkAsk } from './ask-parse.ts';
import { KS_PUBLICATION_MANIFEST, ksRefusal, ksReleaseGatePassed, queryLooksLikeKansas } from './ks-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow, askStateSitemapEntries, listAskNetworkStates } from './published-ask-states.ts';
import { listRecentAskStates } from './recent-ask-states.ts';
import { normalizedPublishedStatePath } from './published-state-path.ts';

test('Kansas appends to the current catalog and all network counts derive from its length', () => {
  assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === 'kansas' && state.code === 'KS'));
  for (const slug of ['iowa', 'nebraska', 'new-mexico', 'utah', 'missouri', 'arkansas', 'oklahoma']) {
    assert.ok(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.slug === slug), slug);
  }
  assert.equal(listAskNetworkStates().length, ASK_PUBLISHED_STATE_CATALOG.length);
  assert.match(askStateExplorerEyebrow(), new RegExp(`^${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer$`));
  assert.equal(askStateSitemapEntries().filter((entry) => entry.path === '/kansas').length, 1);
  assert.equal(normalizedPublishedStatePath('/Kansas'), '/kansas');
  assert.equal(normalizedPublishedStatePath('/kansas'), null);
  assert.equal(normalizedPublishedStatePath('/kansas/wichita'), null);
  assert.ok(listRecentAskStates().some((state) => state.slug === 'kansas'));
});

test('Kansas gateway release gate preserves exactly six specialist populations without a combined count', () => {
  assert.equal(ksReleaseGatePassed(), true);
  assert.equal(KS_PUBLICATION_MANIFEST.scope, 'STATE_LEVEL_ONLY');
  assert.equal(KS_PUBLICATION_MANIFEST.cross_hub_record_total, null);
  assert.equal(KS_PUBLICATION_MANIFEST.graph_writes, 0);
  assert.deepEqual(KS_PUBLICATION_MANIFEST.hubs.map((hub) => hub.hub_id), ['move', 'contractor', 'lender', 'insurance', 'senior', 'investor']);
  for (const hub of KS_PUBLICATION_MANIFEST.hubs) {
    assert.equal(hub.capability_summary, hub.summary);
    assert.match(hub.production_sha, /^[a-f0-9]{40}$/i);
    assert.equal(new URL(hub.url).pathname, '/kansas');
  }
  const gateway = readFileSync('components/kansas-network-gateway.tsx', 'utf8');
  assert.match(gateway, /manifest\.hubs\.map/);
  assert.match(gateway, /Kansas-specific provider searches are not executed by Ask/);
  assert.match(readFileSync('app/kansas/page.tsx', 'utf8'), /noIndex: !ksReleaseGatePassed\(\)/);
  assert.doesNotMatch(JSON.stringify(KS_PUBLICATION_MANIFEST), /AggregateRating|Trust Score/);
});

test('Kansas research and rankings fail closed without inventing local or cross-hub results', () => {
  assert.equal(parseNetworkAsk('household goods movers in Kansas').geography?.stateCode, 'KS');
  assert.equal(parseNetworkAsk('mortgage company in KS').geography?.stateCode, 'KS');
  assert.equal(queryLooksLikeKansas('contractor in Kansas'), true);
  assert.equal(queryLooksLikeKansas('contractor in Kentucky'), false);
  for (const query of ['best Kansas contractor', 'How many licensed providers are in Kansas?', 'Kansas mortgage company license']) {
    const plan = planAskResearch(query);
    assert.equal(plan.executionAllowed, false, query);
    assert.equal(plan.requestedGeography?.stateCode, 'KS', query);
    assert.match(ksRefusal(query) ?? '', /does not rank|undefined|does not run/i, query);
  }
  assert.match(ksRefusal('How many licensed providers are in Kansas?') ?? '', /No result here does not mean that no record exists/i);
  assert.equal(planAskResearch('best Kansas mover').primaryHub, 'move');
  const result = buildNetworkAskPlan('Kansas mortgage company license');
  assert.equal(result.hubs[0]?.hubId, 'lender');
  assert.equal(result.hubs[0]?.destination, undefined);
  assert.equal(result.hubs[0]?.mode, 'fail_closed');
  assert.equal(ksRefusal('best contractor'), undefined);
});
