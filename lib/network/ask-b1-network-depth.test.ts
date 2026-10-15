import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ASK_PUBLISHED_STATE_CATALOG } from './published-ask-states.ts';
import { listRecentAskStates } from './recent-ask-states.ts';

const home = readFileSync('components/network-intelligence-home.tsx', 'utf8');

test('recent states come from the catalog tail and carry manifest-owned highlights', () => {
  const recent = listRecentAskStates();
  assert.equal(recent.length, 4);
  const tail = ASK_PUBLISHED_STATE_CATALOG.slice(-4).map((state) => state.slug).reverse();
  assert.deepEqual(recent.map((state) => state.slug), tail);
  for (const state of recent) {
    assert.equal(state.href, `/${state.slug}`);
    assert.ok(state.highlights.length > 0 && state.highlights.length <= 3);
  }
});

test('homepage network counts are derived, not repeated literals', () => {
  assert.match(home, /id="network-depth"/);
  assert.match(home, /id="state-explorer"/);
  assert.match(home, /href="#state-explorer"/);
  assert.match(home, /const stateCount = stateCoverage\.length/);
  assert.doesNotMatch(home, /\b(?:24|Six|six) (?:network )?states?\b/);
  assert.doesNotMatch(home, /24 state gateways/);
  assert.match(home, /not a complete license roster/i);
  assert.match(home, /states with uneven hub depth/);
  assert.match(home, /Published specialist pages/);
});

test('recent limited-evidence states can show a counted manifest grain', () => {
  const southDakota = listRecentAskStates().find((state) => state.slug === 'south-dakota');
  assert.ok(southDakota);
  assert.match(southDakota.highlights.map((item) => item.summary).join(' '), /22 domestic company observations/);
  assert.match(readFileSync('components/south-dakota-network-gateway.tsx', 'utf8'), /\{hub\.grain\}/);
  assert.match(readFileSync('components/ohio-network-gateway.tsx', 'utf8'), /strip\.display/);
});
