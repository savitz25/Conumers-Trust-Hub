import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';

const ASK = 'http://127.0.0.1:3100';
const OUT = join(process.cwd(), 'artifacts', 'ask-search-009');
const ALLOWED = new Set(['src', 'journey', 'state', 'county', 'intent', 'entity', 'category', 'city', 'zip', 'sid']);
const FORBIDDEN_EXTERNAL = /google(apis)?\.com|places\.googleapis|openai\.com|anthropic\.com|api\.x\.ai|nominatim|mapbox|opencagedata/i;

const flows = [
  { hub: 'move', query: 'movers in Keansburg NJ', port: 3101, profile: /^\/companies\/[a-z0-9-]+/i },
  { hub: 'lender', query: 'mortgage companies in Florida', port: 3102, profile: /^\/lenders\/[a-z0-9-]+/i },
  { hub: 'insurance', query: 'auto insurance agencies Texas', port: 3103, profile: /^\/providers\/[a-z0-9-]+/i },
  { hub: 'contractor', query: 'roofers Miami FL', port: 3104, profile: /^\/contractors\/[a-z0-9-]+/i },
  { hub: 'senior', query: 'skilled nursing facilities Miami FL', port: 3105, profile: /^\/facility\/cms\//i },
  { hub: 'investor', query: 'RIA Boca Raton', port: 3106, profile: /^\/firm\/[a-z0-9-]+/i },
] as const;

type RecordRow = {
  viewport: string;
  hub: string;
  askUrl: string;
  directUrl: string;
  viewMoreUrl: string;
  receivingUrl: string;
  profileUrl: string;
  backUrl: string;
  statuses: Record<string, number>;
  overflow: Record<string, number>;
};

const failures: string[] = [];
const records: RecordRow[] = [];
const external = new Set<string>();
const consoleErrors: string[] = [];

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failures.push(message);
    console.error(`FAIL ${message}`);
  } else {
    console.log(`PASS ${message}`);
  }
}

function assertAllowlist(raw: string, label: string) {
  const url = new URL(raw);
  for (const key of url.searchParams.keys()) check(ALLOWED.has(key), `${label}: allowlisted ${key}`);
  check(!url.searchParams.has('q') && !url.searchParams.has('query'), `${label}: no raw query`);
}

function localize(raw: string, port: number) {
  const url = new URL(raw);
  return `http://127.0.0.1:${port}${url.pathname}${url.search}`;
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(600);
}

async function snap(page: Page, viewport: string, name: string) {
  const dir = join(OUT, viewport);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 1, `${viewport}/${name}: horizontal overflow ${overflow}px`);
  return overflow;
}

async function firstProfileHref(page: Page, pattern: RegExp) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els.filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      }).map((el) => (el as HTMLAnchorElement).getAttribute('href') || '').filter(Boolean)
    );
    const href = hrefs.find((candidate) => {
      try { return pattern.test(new URL(candidate, page.url()).pathname); } catch { return false; }
    });
    if (href) return href;
    await page.waitForTimeout(500);
  }
  return undefined;
}

async function firstBackHref(page: Page) {
  const links = await page.locator('a[href]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
      href: (node as HTMLAnchorElement).getAttribute('href') || '',
    }))
  );
  return links.find((link) => /back/i.test(link.text) && link.href)?.href || null;
}

async function clickHref(page: Page, href: string) {
  const before = page.url();
  await page.locator('a[href]').evaluateAll((links, target) => {
    const link = links.find((candidate) => (candidate as HTMLAnchorElement).getAttribute('href') === target);
    if (!link) throw new Error(`Profile link disappeared before click: ${target}`);
    (link as HTMLAnchorElement).click();
  }, href);
  await page.waitForURL((url) => url.toString() !== before, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
}

async function runViewport(viewport: string, width: number, height: number) {
  const browser = await chromium.launch({ headless: true });

  for (const flow of flows) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`${viewport}: ${msg.text()}`);
    });
    page.on('response', (response) => {
      const url = response.url();
      if (response.status() >= 400 && !/\/_vercel\/insights\/|\/favicon\.ico(?:\?|$)/.test(url)) failures.push(`${viewport}: HTTP ${response.status()} ${url}`);
    });
    page.on('request', (request) => {
      const url = request.url();
      if (FORBIDDEN_EXTERNAL.test(url)) external.add(url);
    });
    const statuses: Record<string, number> = {};
    const overflow: Record<string, number> = {};
    const askUrl = `${ASK}/search?q=${encodeURIComponent(flow.query)}`;
    const askResponse = await page.goto(askUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    statuses.ask = askResponse?.status() || 0;
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => /Top Matches|No verified matches|not supported|We need a bit more detail/i.test(document.body.innerText), null, { timeout: 45_000 });
    check(statuses.ask === 200, `${viewport}/${flow.hub}: Ask HTTP 200`);
    const cardCount = await page.locator('[data-search-card]').count();
    check(cardCount > 0, `${viewport}/${flow.hub}: Top Matches present`);
    overflow.ask = await snap(page, viewport, `${flow.hub}-01-ask`);

    if (cardCount === 0) continue;

    const directUrl = await page.locator('[data-search-card] a[href]').first().getAttribute('href');
    const viewMoreUrl = await page.getByRole('link', { name: /View More Results/i }).getAttribute('href');
    check(!!directUrl, `${viewport}/${flow.hub}: direct destination generated`);
    check(!!viewMoreUrl, `${viewport}/${flow.hub}: View More generated`);
    if (!directUrl || !viewMoreUrl) continue;
    assertAllowlist(directUrl, `${viewport}/${flow.hub}/direct`);
    assertAllowlist(viewMoreUrl, `${viewport}/${flow.hub}/view-more`);

    const directLocal = localize(directUrl, flow.port);
    const directResponse = await page.request.get(directLocal, { timeout: 60_000 });
    statuses.direct = directResponse?.status() || 0;
    check(statuses.direct === 200, `${viewport}/${flow.hub}: direct profile HTTP 200`);

    const receivingLocal = localize(viewMoreUrl, flow.port);
    const receiveResponse = await page.goto(receivingLocal, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    statuses.receiving = receiveResponse?.status() || 0;
    await settle(page);
    const receivingContextUrl = page.url();
    check(statuses.receiving === 200, `${viewport}/${flow.hub}: receiving HTTP 200`);
    check(page.url() !== directLocal, `${viewport}/${flow.hub}: receiving state distinct from direct profile`);
    const profileHref = await firstProfileHref(page, flow.profile);
    check(!!profileHref, `${viewport}/${flow.hub}: receiving result has profile`);
    overflow.receiving = await snap(page, viewport, `${flow.hub}-02-receiving`);
    if (!profileHref) continue;
    const expectedProfileUrl = new URL(profileHref, page.url()).toString();
    await clickHref(page, profileHref);
    const profileUrl = page.url();
    statuses.profile = 200;
    await settle(page);
    if (flow.hub === 'contractor') {
      await page.waitForFunction(() => !/Loading Trust Report/i.test(document.body.innerText), null, { timeout: 30_000 });
    }
    check(new URL(profileUrl).pathname === new URL(expectedProfileUrl).pathname, `${viewport}/${flow.hub}: receiving profile navigation succeeded`);
    overflow.profile = await snap(page, viewport, `${flow.hub}-03-profile`);

    const backHref = await firstBackHref(page);
    check(!!backHref, `${viewport}/${flow.hub}: Back to Results present`);
    let backUrl = '';
    if (backHref) {
      await clickHref(page, backHref);
      await settle(page);
      backUrl = page.url();
      check(new URL(backUrl).port === String(flow.port), `${viewport}/${flow.hub}: Back stays on specialist RC`);
      check(backUrl !== profileUrl, `${viewport}/${flow.hub}: Back leaves profile`);
      check(new URL(backUrl).pathname === new URL(receivingContextUrl).pathname, `${viewport}/${flow.hub}: Back restores receiving route`);
      check(!/Loading Trust Report/i.test(await page.locator('body').innerText()), `${viewport}/${flow.hub}: Back target fully loads`);
      overflow.back = await snap(page, viewport, `${flow.hub}-04-back`);
    }

    records.push({
      viewport,
      hub: flow.hub,
      askUrl,
      directUrl,
      viewMoreUrl,
      receivingUrl: receivingLocal,
      profileUrl,
      backUrl,
      statuses,
      overflow,
    });
    await context.close();
  }
  await browser.close();
}

mkdirSync(OUT, { recursive: true });
await runViewport('desktop-1440x1000', 1440, 1000);
await runViewport('mobile-390x844', 390, 844);
check(external.size === 0, `forbidden external calls: ${external.size}`);

const report = { task: 'ASK-SEARCH-009.1', generatedAt: new Date().toISOString(), failures, consoleErrors, external: [...external], records };
writeFileSync(join(OUT, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ failures: failures.length, records: records.length, external: external.size }, null, 2));
if (failures.length) process.exit(1);
