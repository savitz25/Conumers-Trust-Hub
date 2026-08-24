import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';

const ASK = 'http://127.0.0.1:3100';
const flows = [
  ['move', 'movers in Keansburg NJ', 3101, /^\/companies\//, false],
  ['move', 'licensed movers around 07734', 3101, /^\/companies\//, false],
  ['lender', 'mortgage companies in Florida', 3102, /^\/lenders\//, true],
  ['lender', 'FHA lenders Tampa', 3102, /^\/lenders\//, false],
  ['insurance', 'auto insurance agencies Texas', 3103, /^\/providers\//, false],
  ['insurance', 'insurance agencies Dallas TX', 3103, /^\/providers\//, false],
  ['contractor', 'roofers Miami FL', 3104, /^\/contractors\//, false],
  ['contractor', 'HVAC contractors Tampa FL', 3104, /^\/contractors\//, false],
  ['contractor', 'general contractors Orlando FL', 3104, /^\/contractors\//, false],
  ['senior', 'skilled nursing facilities Miami FL', 3105, /^\/facility\/cms\//, false],
  ['senior', 'nursing facilities New Jersey', 3105, /^\/facility\/cms\//, false],
  ['investor', 'RIA Boca Raton', 3106, /^\/firm\//, false],
  ['investor', 'registered investment advisers Florida', 3106, /^\/firm\//, false],
] as const;

function localize(raw: string, port: number) {
  const url = new URL(raw);
  return `http://127.0.0.1:${port}${url.pathname}${url.search}`;
}

async function visibleLinkIndex(page: Page, predicate: (text: string, path: string) => boolean) {
  const links = await page.locator('a[href]:visible').evaluateAll((nodes) => nodes.map((node) => ({
    text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
    href: (node as HTMLAnchorElement).getAttribute('href') || '',
  })));
  return links.findIndex((link) => {
    try { return predicate(link.text, new URL(link.href, page.url()).pathname); } catch { return false; }
  });
}

async function waitForVisibleLinkIndex(page: Page, predicate: (text: string, path: string) => boolean) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const index = await visibleLinkIndex(page, predicate);
    if (index >= 0) return index;
    await page.waitForTimeout(500);
  }
  return -1;
}

const browser = await chromium.launch({ headless: true });
const failures: string[] = [];
const records: unknown[] = [];

for (const [hub, query, port, profilePattern, keyboard] of flows) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  console.log(`RUN ${hub}: ${query}${keyboard ? ' (keyboard)' : ''}`);
  const askResponse = await page.goto(`${ASK}/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => /Top Matches/i.test(document.body.innerText), null, { timeout: 30_000 });
  const direct = await page.locator('[data-search-card] a[href]').first().getAttribute('href');
  const viewMore = await page.getByRole('link', { name: /View More Results/i }).getAttribute('href');
  if (askResponse?.status() !== 200 || !direct || !viewMore) { failures.push(`${query}: Ask destinations missing`); continue; }
  const directStatus = (await page.request.get(localize(direct, port), { timeout: 60_000 })).status();
  const receiveResponse = await page.goto(localize(viewMore, port), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(keyboard ? 3_000 : 4_000);
  const receivingUrl = page.url();
  const profileIndex = await waitForVisibleLinkIndex(page, (_text, path) => profilePattern.test(path));
  if (profileIndex < 0) { failures.push(`${query}: preloaded profile missing`); continue; }
  const profileLink = page.locator('a[href]:visible').nth(profileIndex);
  console.log(`  receiving=${receivingUrl} profileHref=${await profileLink.getAttribute('href')}`);
  if (keyboard) {
    await profileLink.focus();
    await profileLink.press('Enter');
  } else {
    await profileLink.evaluate((element) => (element as HTMLAnchorElement).click());
  }
  await page.waitForURL((url) => url.toString() !== receivingUrl, { timeout: 30_000 });
  await page.waitForTimeout(3_000);
  const profileUrl = page.url();
  const backIndex = await waitForVisibleLinkIndex(page, (text) => /back/i.test(text));
  if (backIndex < 0) { failures.push(`${query}: Back control missing`); continue; }
  const backLink = page.locator('a[href]:visible').nth(backIndex);
  if (keyboard) {
    await backLink.focus();
    await backLink.press('Enter');
  } else {
    await backLink.evaluate((element) => (element as HTMLAnchorElement).click());
  }
  await page.waitForURL((url) => url.toString() !== profileUrl, { timeout: 30_000 });
  await page.waitForTimeout(800);
  const backUrl = page.url();
  const ok = directStatus === 200 && receiveResponse?.status() === 200 && new URL(backUrl).port === String(port) && new URL(backUrl).pathname !== new URL(profileUrl).pathname;
  if (!ok) failures.push(`${query}: route/profile/Back contract failed`);
  records.push({ hub, query, keyboard, directStatus, receivingUrl, profileUrl, backUrl, ok });
}

await browser.close();
const out = join(process.cwd(), 'artifacts', 'ask-search-009');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'required-e2e-matrix.json'), `${JSON.stringify({ task: 'ASK-SEARCH-009.1', failures, records }, null, 2)}\n`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`ASK-SEARCH-009 required E2E matrix PASS (${records.length}/${flows.length}; keyboard flow included).`);
