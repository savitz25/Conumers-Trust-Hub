import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/montana-publication-manifest.json' with { type: 'json' };
import { mtReleaseGatePassed, mtSpecialistUrl } from './montana-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askStateExplorerEyebrow } from './published-ask-states.ts';

test('Montana Ask gateway links six specialists with source grains and no combined total', () => {
  const page = readFileSync('app/montana/page.tsx', 'utf8');
  const component = readFileSync('components/montana-network-gateway.tsx', 'utf8');
  assert.equal(mtReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(mtSpecialistUrl('investor'), 'https://www.investortrusthub.com/montana');
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.slug === 'montana').length, 1);
  assert.match(component, /ASK_PUBLISHED_STATE_CATALOG\.length/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /Ratings, Trust Scores, provider rankings/);
  assert.match(page, /path: '\/montana'/);
  assert.match(askStateExplorerEyebrow(), /^\d+-state network explorer$/);
});
