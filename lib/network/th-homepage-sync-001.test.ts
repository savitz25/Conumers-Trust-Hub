import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ASK_PUBLISHED_STATE_CATALOG,
  askPublishedStatewideSlugs,
  askStateExplorerEyebrow,
  askStateFooterLinks,
  askStatePlaceEntries,
  askStateSitemapEntries,
  listAskNetworkStates,
  listGatedAskStates,
} from './published-ask-states.ts';
import { ASK_NETWORK_STATES } from '../network-metrics/network-evidence.ts';
import { PUBLISHED_STATEWIDE_SLUGS } from './published-state-path.ts';
import { listPlaceLensIndex } from './place-lens.ts';

const CATALOG_FILE = 'lib/network/published-ask-states.ts';

test('Ask homepage/footer/sitemap/Places derive from the canonical published-state catalog', () => {
  const catalogSlugs = ASK_PUBLISHED_STATE_CATALOG.map((state) => state.slug);
  assert.deepEqual(listAskNetworkStates().map((state) => state.slug), catalogSlugs);
  assert.deepEqual(ASK_NETWORK_STATES.map((state) => state.slug), catalogSlugs);
  assert.deepEqual(PUBLISHED_STATEWIDE_SLUGS, catalogSlugs);
  assert.deepEqual(askPublishedStatewideSlugs(), catalogSlugs);
  const gated = listGatedAskStates();
  assert.ok(gated.some((state) => state.slug === 'ohio'));
  assert.ok(gated.some((state) => state.slug === 'oregon'));
  assert.ok(gated.some((state) => state.slug === 'pennsylvania'));
  assert.ok(gated.some((state) => state.slug === 'north-carolina'));
  assert.deepEqual(
    askStateFooterLinks().map((link) => link.href),
    gated.filter((state) => state.slug !== 'florida').map((state) => state.href),
  );
  assert.deepEqual(
    askStateSitemapEntries().map((entry) => entry.path),
    gated.filter((state) => state.slug !== 'florida').map((state) => state.href),
  );
  for (const state of gated.filter((row) => row.slug !== 'florida')) {
    assert.ok(listPlaceLensIndex().some((item) => item.href === state.href), state.href);
  }
  assert.match(askStateExplorerEyebrow(), /Sixteen-state network explorer/);
});

test('discovery surfaces do not keep a second Ask state slug list', () => {
  const surfaces = [
    'app/sitemap.ts',
    'components/footer.tsx',
    'app/places/page.tsx',
    'lib/network/place-lens.ts',
    'lib/network/published-state-path.ts',
    'lib/network-metrics/network-evidence.ts',
    'components/network-intelligence-home.tsx',
  ];
  for (const file of surfaces) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /'north-carolina',\s*'ohio',\s*'oregon',\s*'pennsylvania'/,
      `${file} must not contain a duplicated slug array`,
    );
    if (file !== CATALOG_FILE) {
      assert.match(
        text,
        /published-ask-states|askStateFooterLinks|askStateSitemapEntries|askStatePlaceEntries|askPublishedStatewideSlugs|listAskNetworkStates|askStateExplorerEyebrow|ASK_NETWORK_STATES|listPlaceLensIndex/,
        `${file} must import the canonical catalog or a catalog-derived helper`,
      );
    }
  }
});

test('next-state simulation: catalog helpers would publish a gated slug without editing discovery files', () => {
  const simulated = [...listGatedAskStates(), { code: 'XX', slug: 'example-state', name: 'Example', href: '/example-state' }];
  const footer = simulated.filter((state) => state.slug !== 'florida').map((state) => state.href);
  const sitemap = footer;
  assert.ok(footer.includes('/example-state'));
  assert.ok(sitemap.includes('/example-state'));
  assert.equal(footer.includes('/ohio'), true);
  const catalog = readFileSync(CATALOG_FILE, 'utf8');
  assert.match(catalog, /ASK_PUBLISHED_STATE_CATALOG/);
  assert.doesNotMatch(readFileSync('app/sitemap.ts', 'utf8'), /example-state/);
  assert.doesNotMatch(readFileSync('components/footer.tsx', 'utf8'), /example-state/);
});
