/**
 * TH-P0-NETWORK-DISCLOSURE-01 regression guard.
 *
 * Confirmed live production contradiction (fixed by this ticket):
 *   /promise and /who-we-are described the network with a stale hub count
 *   ("three unaffiliated companies", "the four domains") that no longer
 *   matches the current six-specialist-hub network (Move, Lender, Insurance,
 *   Contractor, Senior, Investor) under Ask Trust Hub.
 *
 *   node --experimental-strip-types --test lib/network/th-p0-network-disclosure-01.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function read(p: string): string {
  return readFileSync(join(process.cwd(), p), 'utf8');
}

test('the six specialist hubs are all named in the canonical ownership line', () => {
  const src = read('lib/network/standard-version.ts');
  for (const hub of ['Move', 'Lender', 'Insurance', 'Contractor', 'Senior', 'Investor']) {
    assert.match(src, new RegExp(hub));
  }
});

test('/promise no longer names a stale hub count', () => {
  const src = read('app/promise/page.tsx');
  assert.doesNotMatch(src, /three unaffiliated companies/i);
  assert.doesNotMatch(src, /\b(three|four)\b.*(domains|hubs|companies)/i);
});

test('/who-we-are no longer names a stale hub count', () => {
  const src = read('app/who-we-are/page.tsx');
  assert.doesNotMatch(src, /the four domains/i);
  assert.doesNotMatch(src, /\b(three|four)\b.*(domains|hubs|companies)/i);
  assert.match(src, /Move, Lender, Insurance, Contractor, Senior, and Investor/);
});
