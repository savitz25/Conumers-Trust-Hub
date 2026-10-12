import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import manifest from '../../data/network/delaware-publication-manifest.json' with { type: 'json' };
import { deReleaseGatePassed, deSpecialistUrl } from './delaware-network.ts';

test('Delaware Ask gateway links six production sources without cross-hub totals', () => {
  const page = readFileSync('app/delaware/page.tsx', 'utf8');
  const component = readFileSync('components/delaware-network-gateway.tsx', 'utf8');
  assert.equal(deReleaseGatePassed(), true);
  assert.equal(manifest.hubs.length, 6);
  assert.equal(new Set(manifest.hubs.map((hub) => hub.hub_id)).size, 6);
  assert.equal(manifest.hubs.every((hub) => hub.sources.length > 0 && hub.production_sha.length === 40), true);
  assert.equal(deSpecialistUrl('move'), 'https://www.movetrusthub.com/moving-to/delaware');
  assert.equal(deSpecialistUrl('senior'), 'https://www.seniortrusthub.com/delaware');
  assert.equal(manifest.hubs.some((hub) => hub.url.includes('lendertrusthub.com/delaware')), true);
  assert.equal(manifest.publication_limits.cross_hub_record_total, null);
  assert.equal(manifest.publication_limits.cross_hub_record_total_status, 'REJECTED');
  assert.equal(manifest.publication_limits.ratings, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.trust_score, 'NOT_ESTABLISHED');
  assert.equal(manifest.publication_limits.ask_graph_writes, 0);
  assert.match(page, /path: '\/delaware'/);
  assert.match(component, /manifest\.hubs\.map/);
  assert.match(component, /Open \{hub\.hub_name\} Delaware/);
  assert.match(component, /NOT_ACQUIRED/);
  assert.match(component, /Trust Scores, provider rankings/);
});
