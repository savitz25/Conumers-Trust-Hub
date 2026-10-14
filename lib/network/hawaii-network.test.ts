import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/hawaii-publication-manifest.json' with { type: 'json' };
import { ASK_PUBLISHED_STATE_CATALOG, askPublishedStatewideSlugs } from './published-ask-states.ts';
import { hiReleaseGatePassed, hiSpecialistUrl } from './hawaii-network.ts';

test('Hawaii Ask gateway preserves six specialist grains and rejects combined measures', () => {
  const page = readFileSync('app/hawaii/page.tsx', 'utf8');
  const component = readFileSync('components/hawaii-network-gateway.tsx', 'utf8');
  assert.equal(hiReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0 && /^[a-f0-9]{40}$/.test(hub.production_sha)), true);
  assert.equal(hiSpecialistUrl('move'), 'https://www.movetrusthub.com/hawaii');
  assert.equal(hiSpecialistUrl('senior'), 'https://www.seniortrusthub.com/hawaii');
  assert.equal(manifest.hubs.some((hub) => hub.url.includes('lendertrusthub.com/hawaii')), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.match(page, /path: '\/hawaii'/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /provider rankings/);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.code === 'HI' && state.slug === 'hawaii').length, 1);
  assert.equal(askPublishedStatewideSlugs().filter((slug) => slug === 'hawaii').length, 1);
});
