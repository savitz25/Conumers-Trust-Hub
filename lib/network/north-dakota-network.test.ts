import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/north-dakota-publication-manifest.json' with { type: 'json' };
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow } from './published-ask-states.ts';
import { ndReleaseGatePassed } from './north-dakota-network.ts';

const specialistUrls: Record<string, string> = {
  move: 'https://www.movetrusthub.com/north-dakota',
  contractor: 'https://www.contractortrusthub.com/north-dakota',
  lender: 'https://www.lendertrusthub.com/north-dakota',
  insurance: 'https://www.insurancetrusthub.com/north-dakota',
  senior: 'https://www.seniortrusthub.com/north-dakota',
  investor: 'https://www.investortrusthub.com/north-dakota',
};

test('North Dakota Ask gateway preserves six specialist grains and rejects cross-hub totals', () => {
  const page = readFileSync('app/north-dakota/page.tsx', 'utf8');
  const component = readFileSync('components/north-dakota-network-gateway.tsx', 'utf8');
  assert.equal(ndReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.deepEqual(manifest.hubs.map((hub) => hub.hub_id).sort(), ['contractor', 'insurance', 'investor', 'lender', 'move', 'senior']);
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0 && hub.production_sha.length === 40), true);
  assert.equal(manifest.hubs.every((hub) => hub.grain.length > 0 && hub.clock.length > 0 && hub.gap.length > 0), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.slug === 'north-dakota').length, 1);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.some((state) => state.code === 'AK' && state.slug === 'alaska'), true);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.length, new Set(ASK_PUBLISHED_STATE_CATALOG.map((state) => state.slug)).size);
  assert.match(component, /ASK_PUBLISHED_STATE_CATALOG\.length/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /does not combine them into a provider total/);
  assert.match(component, /Trust Scores, rankings/);
  assert.match(page, /path: '\/north-dakota'/);
  assert.match(askStateExplorerEyebrow(), /^\d+-state network explorer$/);
  for (const hub of manifest.hubs) assert.equal(hub.url, specialistUrls[hub.hub_id]);
});
