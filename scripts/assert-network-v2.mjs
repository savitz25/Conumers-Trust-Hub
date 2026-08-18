/**
 * Network V2 contract assertions — no extra test runner.
 * Run: node scripts/assert-network-v2.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const EXPECTED_IDS = ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'];
const EXPECTED_URLS = {
  move: 'https://www.movetrusthub.com',
  lender: 'https://www.lendertrusthub.com',
  insurance: 'https://www.insurancetrusthub.com',
  contractor: 'https://www.contractortrusthub.com',
  senior: 'https://www.seniortrusthub.com',
  investor: 'https://www.investortrusthub.com',
};

const failures = [];
function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

const registry = read('lib/network/registry.ts');
const hubs = read('lib/hubs.ts');
const version = read('lib/network/standard-version.ts');
const networkPage = read('app/network/page.tsx');
const ownership = read('lib/network/standard-version.ts');
const schemas = read('lib/seo/schemas.ts');
const situations = read('lib/situations.ts');
const contractorHub = hubs.includes("id: 'contractor'");
const contractorFloridaOnly =
  /Florida DBPR/.test(hubs) && !/Multi-state contractor/.test(hubs);

assert(registry.includes("2026.08.18-network-v2"), 'registry version');
assert(version.includes('ASK_NETWORK_CONTRACT_VERSION'), 'standard version imports contract');
assert(
  ownership.includes('Move, Lender, Insurance, Contractor, Senior, and Investor Trust Hub'),
  'long ownership names all six'
);
assert(ownership.includes('Common ownership · Separated research and listing order · No paid placements'), 'short ownership');

for (const id of EXPECTED_IDS) {
  assert(new RegExp(`id: '${id}'`).test(hubs) || registry.includes(`'${id}'`), `hub id ${id}`);
  assert(registry.includes(EXPECTED_URLS[id]), `canonical ${id}`);
  assert(networkPage.includes(`  ${id}:`) || networkPage.includes(`'${id}'`) || hubs.includes(`id: '${id}'`), `/network knows ${id}`);
}

assert(schemas.includes('subOrganization'), 'structured data has subOrganization');
assert(schemas.includes('TRUST_HUBS.map'), 'schema maps TRUST_HUBS (all specialists)');
assert(situations.includes("id: 'aging-parent'"), 'router supports Senior');
assert(situations.includes("id: 'investment-firm'"), 'router supports Investor');
assert(situations.includes("id: 'hire-contractor'"), 'router supports Contractor');
assert(!contractorFloridaOnly, 'Contractor overall copy is not Florida-only');
assert(hubs.includes('Multi-state contractor'), 'Contractor multi-state wording');
assert(registry.includes("'ask'"), 'ask parent id present');
assert(!registry.includes('fetch('), 'no runtime fetch of network config');

if (failures.length) {
  console.error('Network V2 assertions failed:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('Network V2 assertions passed (6 specialists, canonicals, ownership, router, schema).');
