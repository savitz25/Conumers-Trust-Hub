import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/rhode-island-publication-manifest.json' with { type: 'json' };
import { riReleaseGatePassed, riSpecialistUrl } from './rhode-island-network.ts';
import { ASK_PUBLISHED_STATE_CATALOG, askPublishedStatewideSlugs } from './published-ask-states.ts';

test('Rhode Island Ask gateway links six live specialist sources without a combined census', () => {
  const page = readFileSync('app/rhode-island/page.tsx', 'utf8');
  const component = readFileSync('components/rhode-island-network-gateway.tsx', 'utf8');
  assert.equal(riReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0 && /^[a-f0-9]{40}$/.test(hub.production_sha)), true);
  assert.equal(riSpecialistUrl('move'), 'https://www.movetrusthub.com/rhode-island');
  assert.equal(riSpecialistUrl('senior'), 'https://www.seniortrusthub.com/rhode-island');
  assert.equal(manifest.hubs.some((hub) => hub.url.includes('lendertrusthub.com/rhode-island')), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.match(page, /path: '\/rhode-island'/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /Combined Rhode Island totals/);
  assert.equal(ASK_PUBLISHED_STATE_CATALOG.filter((state) => state.code === 'RI' && state.slug === 'rhode-island').length, 1);
  assert.equal(askPublishedStatewideSlugs().filter((slug) => slug === 'rhode-island').length, 1);
});
