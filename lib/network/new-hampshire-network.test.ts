import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/new-hampshire-publication-manifest.json' with { type: 'json' };
import { nhReleaseGatePassed, nhSpecialistUrl } from './new-hampshire-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askPublishedStatewideSlugs, askStateExplorerEyebrow } from './published-ask-states.ts';

test('New Hampshire Ask gateway exposes six live specialists without combined totals', () => {
  const page = readFileSync('app/new-hampshire/page.tsx', 'utf8');
  const component = readFileSync('components/new-hampshire-network-gateway.tsx', 'utf8');
  assert.equal(nhReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(nhSpecialistUrl('move'), 'https://www.movetrusthub.com/moving-to/new-hampshire');
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(askPublishedStatewideSlugs().filter((slug) => slug === 'new-hampshire').length, 1);
  assert.equal(askStateExplorerEyebrow(), `${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer`);
  assert.match(page, /path: '\/new-hampshire'/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /Open \{hub\.hub_name\} New Hampshire/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /Trust Scores, provider rankings/);
  assert.deepEqual(ASK_PUBLISHED_STATE_CATALOG.find((state) => state.slug === 'new-hampshire'), {
    code: 'NH', slug: 'new-hampshire', name: 'New Hampshire', gate: nhReleaseGatePassed,
  });
});
