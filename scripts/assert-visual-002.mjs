/**
 * VISUAL-002 Ask reference shell — source contract.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const failures = [];
const assert = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const tokens = read('lib/design/trusthub-visual-standard.ts');
const markGeom = read('lib/design/trusthub-mark-geometry.ts');
const standardMd = read('docs/trusthub-network-visual-standard-v1.md');
const hubHop = read('docs/artifacts/visual-002/hub-hop.html');
const askMark = read('components/ask-network-mark.tsx');
const css = read('app/globals.css');
const nav = read('components/navbar.tsx');
const logo = read('components/brand-logo.tsx');
const switcher = read('components/switch-hub-menu.tsx');
const registry = read('lib/network/registry.ts');
const layout = read('app/layout.tsx');

assert(tokens.includes('2026.08.21-visual-v1'), 'chassis version');
assert(tokens.includes('TH_MARK_GEOMETRY_VERSION'), 'mark geometry version exported');
assert(markGeom.includes('immutable network geometry'), 'canonical mark rule string');
assert(markGeom.includes("contractor") && markGeom.includes('too_heavy'), 'contractor flagged too_heavy');
assert(markGeom.includes('correctionRequired: true'), 'correction flags present');
assert(standardMd.includes('## G2. CANONICAL TRUSTHUB MARK GEOMETRY'), 'standard §G2 present');
assert(standardMd.includes('ASSET CORRECTION REQUIRED'), 'contractor correction documented');
assert(askMark.includes('strokeWidth="2.4"'), 'canonical Ask mark stroke 2.4');
assert(askMark.includes('r="2.5"'), 'canonical outer dots r=2.5');
assert(hubHop.includes('stroke-width="2.4"'), 'hub-hop uses canonical stroke');
assert(hubHop.includes('contractor'), 'hub-hop includes Contractor row');
assert(!hubHop.includes('background:#F5C518">C</div>'), 'hub-hop does not use letter-tile marks');
assert(css.includes('--th-header-desktop: 69px'), '69px desktop header');
assert(css.includes('--th-header-tablet: 65px'), '65px tablet');
assert(css.includes('--th-header-mobile: 57px'), '57px mobile');
assert(css.includes('--th-logo-desktop: 36px'), '36px logo slot');
assert(css.includes('--th-control: 44px'), '44px controls');
assert(css.includes('--th-radius-control: 12px'), '12px control radius');
assert(css.includes('--th-shell-max: 1200px'), '1200 shell');
assert(css.includes('height: var(--th-control)'), 'control height not min-height');
assert(!css.includes('py-2.5 text-sm font-semibold text-white') || css.includes('--th-control'), 'ask-cta not 60px padding');
assert(nav.includes('Knowledge') === false, 'Knowledge & concierge removed from header');
assert(nav.includes('th-header'), 'reference header class');
assert(nav.includes('variant="embedded"'), 'Switch Hub in drawer');
assert(nav.includes('th-header-actions'), 'desktop actions cluster');
assert(logo.includes('AskNetworkMark'), 'tight SVG mark');
assert(logo.includes('th-logo-wordmark'), 'HTML wordmark not tagline PNG');
assert(switcher.includes('switcherEntries()'), 'registry order');
assert(switcher.includes('hub.switcherLabel'), 'canonical blurbs');
assert(!switcher.includes("from '@/lib/design/ask-design-system'"), 'does not import Ask marketing blurbs');
assert(switcher.includes('Current'), 'Current label');
assert(switcher.includes('aria-current'), 'aria-current');
assert(registry.includes("'ask'") && registry.includes("'investor'"), 'full hub order');
assert(layout.includes('data-th-chassis'), 'chassis stamp');
assert(layout.includes('id="main-content"'), 'skip target');
assert(nav.includes('th-skip'), 'skip link');

const order = ["'ask'", "'move'", "'lender'", "'insurance'", "'contractor'", "'senior'", "'investor'"];
let last = -1;
for (const id of order) {
  const i = registry.indexOf(`id: ${id}`);
  assert(i > last, `registry order ${id}`);
  last = i;
}

if (failures.length) {
  console.error('VISUAL-002 assertions failed:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('VISUAL-002 Ask reference-shell assertions passed.');
