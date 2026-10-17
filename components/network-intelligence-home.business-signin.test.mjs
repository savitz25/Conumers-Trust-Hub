import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const home = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'network-intelligence-home.tsx'),
  'utf8',
);

test('homepage business control keeps /manage and does not claim to open the consumer account', () => {
  assert.equal(home.includes('Open My Trust Hub account'), false);
  assert.match(home, /href="\/manage" data-analytics-event="network_account_click"/);
  assert.match(home, /title="Business sign-in for claimed profiles">Business sign-in<\/Link>/);
  assert.match(home, /Find an eligible profile to claim/);
});
