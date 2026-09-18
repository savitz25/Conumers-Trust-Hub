import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizedPublishedStatePath } from './published-state-path.ts';

test('PA-REL-001 mixed-case statewide paths normalize', () => {
  assert.equal(normalizedPublishedStatePath('/Pennsylvania'), '/pennsylvania');
  assert.equal(normalizedPublishedStatePath('/PENNSYLVANIA'), '/pennsylvania');
  assert.equal(normalizedPublishedStatePath('/PeNnSyLvAnIa'), '/pennsylvania');
  assert.equal(normalizedPublishedStatePath('/pennsylvania'), null);
  assert.equal(normalizedPublishedStatePath('/Pennsylvania/philadelphia'), null);
  assert.equal(normalizedPublishedStatePath('/North-Carolina'), '/north-carolina');
  assert.equal(normalizedPublishedStatePath('/NORTH-CAROLINA'), '/north-carolina');
  assert.equal(normalizedPublishedStatePath('/NoRtH-CaRoLiNa'), '/north-carolina');
  assert.equal(normalizedPublishedStatePath('/north-carolina'), null);
  assert.equal(normalizedPublishedStatePath('/North-Carolina/charlotte'), null);
  assert.equal(normalizedPublishedStatePath('/Ohio'), '/ohio');
  assert.equal(normalizedPublishedStatePath('/OHIO'), '/ohio');
  assert.equal(normalizedPublishedStatePath('/oHiO'), '/ohio');
  assert.equal(normalizedPublishedStatePath('/ohio'), null);
  assert.equal(normalizedPublishedStatePath('/Ohio/columbus'), null);
  assert.equal(normalizedPublishedStatePath('/ask'), null);
});

test('PA-REL-001 proxy issues 308 and footer/sitemap stay lowercase', () => {
  const proxy = readFileSync('proxy.ts', 'utf8');
  assert.match(proxy, /normalizedPublishedStatePath/);
  assert.match(proxy, /308/);
  assert.match(proxy, /\/:path/);
  const footer = readFileSync('components/footer.tsx', 'utf8');
  assert.match(footer, /\/pennsylvania/);
  assert.doesNotMatch(footer, /href: '\/Pennsylvania'/);
  const sitemap = readFileSync('app/sitemap.ts', 'utf8');
  assert.match(sitemap, /path: '\/pennsylvania'/);
  assert.doesNotMatch(sitemap, /\/Pennsylvania/);
});
