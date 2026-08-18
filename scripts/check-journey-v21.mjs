/**
 * Network V2.1 journey eligibility / PII / destination asserts (Ask).
 * Source-level so it does not require tsx. Run: node scripts/check-journey-v21.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pathGen = readFileSync(join(root, 'lib/orchestration/path-generator.ts'), 'utf8');
const links = readFileSync(join(root, 'lib/orchestration/journey-links.ts'), 'utf8');
const situations = readFileSync(join(root, 'lib/situations.ts'), 'utf8');
const journeysDoc = readFileSync(join(root, 'docs/ASK-NETWORK-JOURNEYS.md'), 'utf8');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  }
}

function sliceCase(id) {
  const start = pathGen.indexOf(`case '${id}'`);
  assert(start >= 0, `missing case ${id}`);
  const next = pathGen.indexOf('case \'', start + 8);
  return pathGen.slice(start, next > 0 ? next : undefined);
}

const buy = sliceCase('buy_local');
assert(buy.includes("'lender'"), 'buy_local includes lender');
assert(buy.includes("'insurance'"), 'buy_local includes insurance');
assert(!buy.includes("'move'"), 'buy_local does not force move');
assert(!buy.includes("'contractor'"), 'buy_local does not force contractor');

const rent = sliceCase('move_rent');
assert(rent.includes("'move'"), 'move_rent includes move');
assert(!rent.includes("'lender'"), 'move_rent has no lender step');

const senior = sliceCase('aging_parent');
assert(senior.includes("'senior'"), 'aging_parent includes senior');
assert(!senior.includes("'insurance'"), 'aging_parent does not force insurance');
assert(!senior.includes("'move'"), 'aging_parent does not force move');

const invest = sliceCase('investing_research');
assert(invest.includes("'investor'"), 'investing includes investor');
assert(invest.includes('buildInvestorDeepLink'), 'investing uses investor deep link');
assert(!invest.includes('buildLenderDeepLink'), 'investing has no lender handoff');

assert(situations.includes("situationId: 'pure_move'"), 'relocating-work uses pure_move not forced buy');
assert(situations.includes('Research investment firm regulatory evidence'), 'Ask→Investor framing');
assert(journeysDoc.includes('home_buy'), 'taxonomy documents home_buy alias');
assert(links.includes("p.set('src'"), 'journey query writes src');
assert(!links.includes("p.set('email'"), 'journey query does not write email');
assert(!links.includes("p.set('phone'"), 'journey query does not write phone');

if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('Ask V2.1 journey checks passed');
