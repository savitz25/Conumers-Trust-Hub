import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/maine-publication-manifest.json' with { type: 'json' };
import { meReleaseGatePassed, meSpecialistUrl } from './maine-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askPublishedStatewideSlugs, askStateExplorerEyebrow } from './published-ask-states.ts';

test('Maine Ask gateway exposes six live specialists with no combined total', () => {
  const page = readFileSync('app/maine/page.tsx', 'utf8');
  const component = readFileSync('components/maine-network-gateway.tsx', 'utf8');
  assert.equal(meReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0), true);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(meSpecialistUrl('move'), 'https://www.movetrusthub.com/moving-to/maine');
  assert.equal(manifest.hubs.some((hub) => hub.url.includes('seniortrusthub.com/maine')), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.equal(askPublishedStatewideSlugs().filter((slug) => slug === 'maine').length, 1);
  assert.equal(askStateExplorerEyebrow(), `${ASK_PUBLISHED_STATE_CATALOG.length}-state network explorer`);
  assert.match(page, /path: '\/maine'/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /Open \{hub\.hub_name\} Maine/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /Trust Scores, provider rankings/);
  assert.deepEqual(ASK_PUBLISHED_STATE_CATALOG.at(-1), {
    code: 'ME', slug: 'maine', name: 'Maine', gate: meReleaseGatePassed,
  });
});
