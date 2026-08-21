/**
 * SHARE-003 metadata contract — Ask Trust Hub.
 * Run: node scripts/assert-share-003.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const failures = [];
const assert = (cond, msg) => {
  if (!cond) failures.push(msg);
};

for (const rel of [
  'app/network/share-og/route.tsx',
  'app/guides/[slug]/share-og/route.tsx',
  'app/journeys/[slug]/share-og/route.tsx',
]) {
  assert(existsSync(join(root, rel)), `${rel} exists`);
}

const network = read('app/network/page.tsx');
const guide = read('app/guides/[slug]/page.tsx');
const journey = read('app/journeys/[slug]/page.tsx');
const helper = read('lib/og/ask-share-og.ts');
const model = read('lib/seo/share-card-model.ts');
const card = read('lib/og/ask-share-card.tsx');
const shareHub = read('lib/seo/share-hub.ts');

assert(network.includes('shareRouteOgImage'), 'network uses contextual OG');
assert(guide.includes('shareRouteOgImage'), 'guides use contextual OG');
assert(journey.includes('shareRouteOgImage'), 'journeys use contextual OG');
assert(helper.includes('ask-trust-hub-social-card.png'), 'fallback is SHARE-002 PNG');
assert(!/google|places\.googleapis/i.test(helper), 'no Google Places');
assert(!/no complaints|fully verified|trusted|approved/i.test(model), 'no endorsement copy');
assert(card.includes('asktrusthub.com'), 'Ask domain on card');
assert(!card.includes('movetrusthub.com'), 'no Move domain URL on card');
assert(shareHub.includes('shareRouteOgImage'), 'stable share-og helper');
assert(shareHub.includes('www.asktrusthub.com'), 'canonical host pinned');
assert(!existsSync(join(root, 'app/share/[id]/page.tsx')), 'no SHARE-004 snapshot routes');

if (failures.length) {
  console.error('SHARE-003 Ask assertions failed:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('SHARE-003 Ask assertions passed.');
