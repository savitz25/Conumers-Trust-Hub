/**
 * SHARE-002 metadata contract — Ask Trust Hub.
 * Run: node scripts/assert-share-002.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const readBin = (rel) => readFileSync(join(root, rel));

const failures = [];
function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function pngSize(rel) {
  const buf = readBin(rel);
  if (buf.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') {
    throw new Error(`${rel} is not a PNG`);
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const shareHub = read('lib/seo/share-hub.ts');
const metadata = read('lib/seo/metadata.ts');
const layout = read('app/layout.tsx');
const networkPage = read('app/network/page.tsx');
const brand = read('lib/brand.ts');

assert(shareHub.includes("id: 'ask'"), 'SHARE_HUB.id is ask');
assert(shareHub.includes("host: 'www.asktrusthub.com'"), 'SHARE_HUB.host is www.asktrusthub.com');
assert(
  shareHub.includes("origin: 'https://www.asktrusthub.com'"),
  'SHARE_HUB.origin is https://www.asktrusthub.com',
);
assert(
  shareHub.includes("ogImagePath: '/og/ask-trust-hub-social-card.png'"),
  'SHARE_HUB uses production social-card PNG',
);
assert(shareHub.includes('ogWidth: 1200'), 'SHARE_HUB.ogWidth is 1200');
assert(shareHub.includes('ogHeight: 630'), 'SHARE_HUB.ogHeight is 630');
assert(shareHub.includes("twitterCard: 'summary_large_image'"), 'twitter large card');
assert(shareHub.includes('independent consumer research network'), 'meaningful og alt');
assert(shareHub.includes('isForbiddenShareHost'), 'forbidden-host helper present');
assert(shareHub.includes('movetrusthub.com'), 'foreign host list includes Move');
assert(shareHub.includes('lendertrusthub.com'), 'foreign host list includes Lender');

assert(metadata.includes("from '@/lib/seo/share-hub'"), 'metadata imports SHARE_HUB');
assert(shareHub.includes('export function resolveShareOrigin'), 'resolveShareOrigin is exported');
assert(metadata.includes('resolveShareOrigin'), 'metadata pins origin via resolveShareOrigin');
assert(metadata.includes('SHARE_HUB.twitterCard'), 'twitter card comes from SHARE_HUB');
assert(metadata.includes('summary_large_image') || metadata.includes('SHARE_HUB.twitterCard'), 'large twitter card');
assert(!metadata.includes('og-default.png'), 'metadata does not reference stale og-default.png');
assert(!metadata.includes('localhost'), 'metadata source has no localhost');
assert(!metadata.includes('127.0.0.1'), 'metadata source has no 127.0.0.1');
assert(!metadata.includes('.vercel.app'), 'metadata source has no vercel.app');
assert(!/https:\/\/www\.(move|insurance|lender|contractor|senior|investor)trusthub\.com/.test(metadata), 'metadata does not hardcode another Hub origin');

assert(layout.includes('rootLayoutMetadata'), 'layout uses rootLayoutMetadata');
assert(networkPage.includes('createPageMetadata'), 'network page uses createPageMetadata');
assert(brand.includes("url: 'https://www.asktrusthub.com'"), 'brand canonical is Ask');

const card = pngSize('public/og/ask-trust-hub-social-card.png');
assert(card.width === 1200 && card.height === 630, `social card is 1200×630, got ${card.width}×${card.height}`);

const tsxAndTs = ['lib/seo/metadata.ts', 'lib/seo/share-hub.ts', 'app/layout.tsx', 'app/network/page.tsx'];
for (const rel of tsxAndTs) {
  const src = read(rel);
  assert(!src.includes('og-default.png'), `${rel} does not reference og-default.png`);
}

if (failures.length) {
  console.error('SHARE-002 Ask assertions failed:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('SHARE-002 Ask assertions passed (host, 1200×630 PNG, twitter large, no localhost, no stale og-default).');
