import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });

async function sideBySide(beforeRel, afterRel, outName, label, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const beforeUrl = pathToFileURL(join(root, beforeRel)).href;
  const afterUrl = pathToFileURL(join(root, afterRel)).href;
  await page.setContent(`<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0}
    body{font-family:Inter,system-ui,sans-serif;background:#0a2540;color:#fff;padding:16px}
    h1{font-size:18px;margin-bottom:12px;letter-spacing:.04em}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    figure{margin:0;background:#132a4a;border-radius:12px;overflow:hidden}
    figcaption{padding:10px 12px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8}
    img{width:100%;display:block;background:#fff}
  </style></head><body>
    <h1>${label}</h1>
    <div class="grid">
      <figure><figcaption>OLD ASK · Before</figcaption><img src="${beforeUrl}"/></figure>
      <figure><figcaption>NEW ASK · After</figcaption><img src="${afterUrl}"/></figure>
    </div>
  </body></html>`);
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.min(Math.max(h + 24, 600), 1800) });
  await page.screenshot({ path: join(root, outName), type: 'jpeg', quality: 82, fullPage: true });
  await ctx.close();
}

await sideBySide(
  'before/desktop-1440.jpg',
  'after/desktop-1440.jpg',
  'compare-desktop-1440.jpg',
  'OLD ASK vs NEW ASK · Desktop 1440',
  { width: 1600, height: 1000 }
);
await sideBySide(
  'before/mobile-390.jpg',
  'after/mobile-390.jpg',
  'compare-mobile-390.jpg',
  'OLD ASK vs NEW ASK · Mobile 390',
  { width: 900, height: 1000 }
);
await sideBySide(
  'before/header-desktop.png',
  'after/header-desktop.png',
  'compare-header-desktop.jpg',
  'OLD ASK vs NEW ASK · Header',
  { width: 1400, height: 420 }
);

const hop = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const hp = await hop.newPage();
await hp.goto(pathToFileURL(join(root, 'hub-hop.html')).href, { waitUntil: 'networkidle' });
await hp.waitForTimeout(400);
await hp.screenshot({ path: join(root, 'hub-hop-board.jpg'), type: 'jpeg', quality: 82, fullPage: true });
await hop.close();

const cmp = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const cp = await cmp.newPage();
await cp.goto(pathToFileURL(join(root, 'compare.html')).href, { waitUntil: 'networkidle' });
await cp.waitForTimeout(600);
await cp.screenshot({ path: join(root, 'compare-board.jpg'), type: 'jpeg', quality: 72, fullPage: true });
await cmp.close();

await browser.close();
console.log('composites ok');
