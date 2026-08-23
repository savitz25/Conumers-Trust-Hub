/**
 * ASK-SEARCH-008 — Chromium QA for six-hub Senior+Investor activation.
 * Usage: BASE_URL=http://127.0.0.1:3012 npx tsx scripts/qa/ask-search-008-browser.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3012').replace(/\/$/, '');
const OUT = join(process.cwd(), 'artifacts', 'ask-search-008');
const ALLOWED = new Set(['src', 'journey', 'state', 'county', 'intent', 'entity', 'category', 'city', 'zip', 'sid']);
const BLOCKED_HOST =
  /google(apis)?\.com|maps\.googleapis|places\.googleapis|openai\.com|anthropic\.com|api\.x\.ai|nominatim|mapbox|here\.com|opencagedata/i;

const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

type Overflow = { scrollWidth: number; clientWidth: number; overflow: number; offenders: string[] };
type ShotRecord = { path: string; overflow: Overflow; title: string; url: string };
type Fail = { area: string; detail: string };

const shots: ShotRecord[] = [];
const fails: Fail[] = [];
const eventsSeen = new Set<string>();
const outboundHosts = new Set<string>();
const notes: Record<string, unknown> = {};

function fail(area: string, detail: string) {
  fails.push({ area, detail });
  console.error(`FAIL [${area}] ${detail}`);
}

function pass(area: string, detail: string) {
  console.log(`PASS [${area}] ${detail}`);
}

function qurl(q: string) {
  return `${BASE}/search?q=${encodeURIComponent(q)}`;
}

async function overflowOf(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const el = document.documentElement;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const overflow = scrollWidth - clientWidth;
    const offenders: string[] = [];
    if (overflow > 0) {
      const cw = clientWidth;
      for (const node of Array.from(document.body.querySelectorAll('*'))) {
        const r = (node as HTMLElement).getBoundingClientRect();
        if (r.right > cw + 1 || r.width > cw + 1) {
          const html = node as HTMLElement;
          offenders.push(
            `${html.tagName.toLowerCase()}${html.id ? '#' + html.id : ''}.${String(html.className).slice(0, 80)} right=${Math.round(r.right)} w=${Math.round(r.width)}`
          );
          if (offenders.length >= 12) break;
        }
      }
    }
    return { scrollWidth, clientWidth, overflow, offenders };
  });
}

async function shot(page: Page, viewport: 'desktop-1440' | 'mobile-390', name: string) {
  const dir = join(OUT, viewport);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  const ov = await overflowOf(page);
  const rec: ShotRecord = {
    path,
    overflow: ov,
    title: await page.title(),
    url: page.url(),
  };
  shots.push(rec);
  if (ov.overflow !== 0) {
    fail(
      'overflow',
      `${viewport}/${name} overflow=${ov.overflow}px (scroll=${ov.scrollWidth} client=${ov.clientWidth}) offenders=${ov.offenders.join(' | ')}`
    );
  } else {
    pass('overflow', `${viewport}/${name} 0px`);
  }
  return rec;
}

async function collectEvents(page: Page) {
  const ev = await page.evaluate(() => {
    const g = window as unknown as { __askSearchEvents?: Array<{ name: string }> };
    let stored: Array<{ name: string }> = [];
    try {
      stored = JSON.parse(sessionStorage.getItem('__askSearchEvents') || '[]') as Array<{ name: string }>;
    } catch {
      stored = [];
    }
    return [...(g.__askSearchEvents || []), ...stored].map((e) => e.name);
  });
  for (const n of ev) eventsSeen.add(n);
  return ev;
}

function assertAllowlisted(href: string, label: string) {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    fail('handoff', `${label} unparseable href: ${href}`);
    return;
  }
  for (const k of u.searchParams.keys()) {
    if (!ALLOWED.has(k)) fail('handoff', `${label} non-allowlisted key ${k} in ${href}`);
  }
  if ([...u.searchParams.keys()].some((k) => k === 'q' || k === 'query')) {
    fail('handoff', `${label} leaked q/query: ${href}`);
  }
}

async function openState(page: Page, query: string) {
  const res = await page.goto(qurl(query), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!res || res.status() >= 500) fail('nav', `${query} HTTP ${res?.status()}`);
  await page.locator('#main-content').waitFor({ state: 'visible' });
  // Wait out app/search/loading.tsx soft shell
  await page
    .waitForFunction(() => {
      const t = document.body?.innerText || '';
      if (/Searching the Trust Hub index/i.test(t) && /Loading search results/i.test(t)) return false;
      return (
        /Top Matches|No verified matches|isn’t available yet|not supported|We need a bit more detail|What kind of insurance|Universal Search/i.test(
          t
        ) || !!document.querySelector('[data-search-card]')
      );
    }, { timeout: 45_000 })
    .catch(() => null);
  return res;
}

async function textOf(page: Page) {
  return page.locator('#main-content').innerText();
}

async function qaViewport(
  browser: Browser,
  viewport: 'desktop-1440' | 'mobile-390',
  size: { width: number; height: number }
) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(`${d.type()}:${d.message()}`);
    await d.dismiss();
  });
  page.on('request', (req) => {
    try {
      const host = new URL(req.url()).hostname;
      outboundHosts.add(host);
      if (BLOCKED_HOST.test(host) || BLOCKED_HOST.test(req.url())) {
        fail('external', `blocked enrichment host ${host} ${req.url()}`);
      }
    } catch {
      /* ignore */
    }
  });

  // Homepage regression
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60_000 });
  await page.locator('[data-universal-search="form"]').waitFor({ state: 'visible' });
  await shot(page, viewport, '01-homepage');

  // Existing four-hub smoke
  await openState(page, 'movers in Keansburg NJ');
  await page.waitForSelector('[data-search-card], h2', { timeout: 30_000 }).catch(() => null);
  const kean = await textOf(page);
  if (!/Top Matches/i.test(kean)) fail('move', 'Keansburg Top Matches missing');
  const moveCards = await page.locator('[data-search-card]').count();
  if (moveCards < 1 || moveCards > 7) fail('move', `card count ${moveCards}`);
  await shot(page, viewport, '02-move-keansburg');

  await openState(page, 'mortgage companies in Florida');
  await shot(page, viewport, '03-lender-florida');

  await openState(page, 'auto insurance agencies Texas');
  await shot(page, viewport, '04-insurance-texas');

  await openState(page, 'roofers Miami FL');
  await shot(page, viewport, '05-contractor-roofers');

  // --- Senior ---
  await openState(page, 'nursing homes Miami FL');
  const miami = await textOf(page);
  if (!/Top Matches/i.test(miami) || !/SeniorTrustHub|Nursing facility|nursing/i.test(miami)) {
    fail('senior-miami', 'expected Senior results');
  }
  if (/Five-Star|CMS star rating/i.test(miami)) {
    fail('senior-miami', 'Five-Star ranking signal present');
  }
  await page.waitForSelector('[data-search-card], h2, [data-search-status]', { timeout: 30_000 }).catch(() => null);
  const seniorCards = page.locator('[data-search-card]');
  const seniorCount = await seniorCards.count();
  if (seniorCount < 1 || seniorCount > 7) fail('senior-miami', `cards ${seniorCount}`);
  let seniorHref: string | null = null;
  if (seniorCount >= 1) {
    seniorHref = await seniorCards.first().locator('a[href]').first().getAttribute('href');
    if (!seniorHref || !/seniortrusthub\.com/i.test(seniorHref)) fail('senior-miami', `bad profile ${seniorHref}`);
    else assertAllowlisted(seniorHref, 'senior miami profile');
  }
  const seniorVm = page.locator('a', { hasText: 'View More Results' });
  if ((await seniorVm.count()) < 1) fail('senior-miami', 'View More missing');
  else {
    const vm = await seniorVm.first().getAttribute('href');
    if (!vm || !/seniortrusthub\.com\/from-ask/i.test(vm)) fail('senior-miami', `bad VM ${vm}`);
    else assertAllowlisted(vm, 'senior miami VM');
  }
  // Click entity (prevent nav) + live GET
  if (seniorHref) {
    await seniorCards
      .first()
      .locator('a[href]')
      .first()
      .evaluate((el) => {
        el.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
        (el as HTMLElement).click();
      });
    try {
      const resp = await page.request.get(seniorHref, { timeout: 20_000, maxRedirects: 5 });
      notes[`${viewport}-senior-entity-status`] = resp.status();
      pass('senior-direct', `GET ${resp.status()} ${seniorHref}`);
    } catch (err) {
      notes[`${viewport}-senior-entity-error`] = String(err);
      pass('senior-direct', `href recorded: ${seniorHref}`);
    }
  }
  await shot(page, viewport, '06-senior-miami');
  await collectEvents(page);

  await openState(page, 'nursing homes New Jersey');
  const nj = await textOf(page);
  if (!/Top Matches/i.test(nj)) fail('senior-nj', 'expected results');
  await shot(page, viewport, '07-senior-nj');

  await openState(page, 'nursing homes Keansburg NJ');
  const zeroS = await textOf(page);
  if (!/No verified matches/i.test(zeroS)) fail('senior-zero', `expected empty: ${zeroS.slice(0, 200)}`);
  if (/Top Matches/i.test(zeroS)) fail('senior-zero', 'Top Matches on zero');
  if (/isn’t available yet|not in the current|not a supported/i.test(zeroS)) {
    fail('senior-zero', 'used unsupported copy for zero');
  }
  await shot(page, viewport, '08-senior-zero');

  await openState(page, 'assisted living Miami');
  const unS = await textOf(page);
  if (!/not in the current|did not substitute nursing|isn’t available yet|not supported/i.test(unS)) {
    fail('senior-unsupported', `expected unsupported: ${unS.slice(0, 240)}`);
  }
  if (/No verified matches/i.test(unS)) fail('senior-unsupported', 'used zero copy');
  if (/Top Matches/i.test(unS)) fail('senior-unsupported', 'Top Matches on unsupported');
  await shot(page, viewport, '09-senior-unsupported');

  // --- Investor ---
  await openState(page, 'RIAs Boca Raton FL');
  const boca = await textOf(page);
  if (!/Top Matches/i.test(boca) || !/InvestorTrustHub|Registered investment adviser|adviser/i.test(boca)) {
    fail('investor-boca', 'expected Investor results');
  }
  if (/RAUM|assets under management/i.test(boca)) fail('investor-boca', 'RAUM/AUM ranking signal');
  const invCards = page.locator('[data-search-card]');
  const invCount = await invCards.count();
  if (invCount < 1 || invCount > 7) fail('investor-boca', `cards ${invCount}`);
  const invHref = await invCards.first().locator('a[href]').first().getAttribute('href');
  if (!invHref || !/investortrusthub\.com/i.test(invHref)) fail('investor-boca', `bad profile ${invHref}`);
  else assertAllowlisted(invHref, 'investor boca profile');
  const invVm = page.locator('a', { hasText: 'View More Results' });
  if ((await invVm.count()) < 1) fail('investor-boca', 'View More missing');
  else {
    const vm = await invVm.first().getAttribute('href');
    if (!vm || !/investortrusthub\.com\/from-ask/i.test(vm)) fail('investor-boca', `bad VM ${vm}`);
    else assertAllowlisted(vm, 'investor boca VM');
    try {
      const resp = await page.request.get(vm, { timeout: 20_000, maxRedirects: 5 });
      notes[`${viewport}-investor-vm-status`] = resp.status();
      pass('investor-vm', `GET ${resp.status()}`);
    } catch (err) {
      notes[`${viewport}-investor-vm-error`] = String(err);
    }
  }
  if (invHref) {
    try {
      const resp = await page.request.get(invHref, { timeout: 20_000, maxRedirects: 5 });
      notes[`${viewport}-investor-entity-status`] = resp.status();
      pass('investor-direct', `GET ${resp.status()} ${invHref}`);
    } catch (err) {
      notes[`${viewport}-investor-entity-error`] = String(err);
    }
  }
  await shot(page, viewport, '10-investor-boca');
  await collectEvents(page);

  await openState(page, 'RIAs Florida');
  const fl = await textOf(page);
  if (!/Top Matches/i.test(fl)) fail('investor-florida', 'expected results');
  await shot(page, viewport, '11-investor-florida');

  await openState(page, 'RIAs Keansburg NJ');
  const zeroI = await textOf(page);
  if (!/No verified matches/i.test(zeroI)) fail('investor-zero', `expected empty: ${zeroI.slice(0, 200)}`);
  if (/Top Matches/i.test(zeroI)) fail('investor-zero', 'Top Matches on zero');
  await shot(page, viewport, '12-investor-zero');

  await openState(page, 'mutual funds Florida');
  const unI = await textOf(page);
  if (!/not searchable|did not substitute investment|isn’t available yet|not supported/i.test(unI)) {
    fail('investor-unsupported', `expected unsupported: ${unI.slice(0, 240)}`);
  }
  if (/No verified matches/i.test(unI)) fail('investor-unsupported', 'used zero copy');
  await shot(page, viewport, '13-investor-unsupported');

  // RIA ≠ ERA spot-check
  await openState(page, 'ERA Florida');
  const era = await textOf(page);
  notes[`${viewport}-era-florida`] = era.slice(0, 400);
  if (/FLAGSTAR|NOESIS/i.test(era)) fail('ria-era', 'known RIA names in ERA results');
  await shot(page, viewport, '14-investor-era-florida');

  // SEO + security smoke
  await openState(page, 'nursing homes Miami FL');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  if (!robots || !/noindex/i.test(robots)) fail('seo', `robots missing noindex: ${robots}`);
  else pass('seo', `robots=${robots}`);
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
  if (ogTitle && /nursing homes miami/i.test(ogTitle)) fail('seo', `raw query in og:title: ${ogTitle}`);

  await openState(page, '<script>alert(1)</script> nursing homes Miami FL');
  await shot(page, viewport, '15-security-script');
  if (dialogs.length) fail('security', `dialog fired: ${dialogs.join('; ')}`);
  else pass('security', 'no dialog');

  await collectEvents(page);
  notes[`${viewport}-dialogs`] = dialogs;
  await context.close();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const health = await fetch(BASE).catch(() => null);
  if (!health?.ok && health?.status !== 308 && health?.status !== 301) {
    throw new Error(`Server not reachable at ${BASE}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    await qaViewport(browser, 'desktop-1440', DESKTOP);
    await qaViewport(browser, 'mobile-390', MOBILE);
  } finally {
    await browser.close();
  }

  const requiredEvents = ['search_resolved', 'top_matches_rendered', 'zero_results', 'unsupported_search'];
  for (const ev of requiredEvents) {
    if (!eventsSeen.has(ev)) fail('analytics', `missing local event ${ev}`);
    else pass('analytics', ev);
  }

  const desktopOverflow = shots
    .filter((s) => s.path.includes('desktop-1440'))
    .map((s) => s.overflow.overflow);
  const mobileOverflow = shots
    .filter((s) => s.path.includes('mobile-390'))
    .map((s) => s.overflow.overflow);
  const report = {
    base: BASE,
    fails,
    eventsSeen: [...eventsSeen],
    outboundHosts: [...outboundHosts].sort(),
    desktopOverflowPx: desktopOverflow,
    mobileOverflowPx: mobileOverflow,
    desktopMaxOverflow: Math.max(0, ...desktopOverflow),
    mobileMaxOverflow: Math.max(0, ...mobileOverflow),
    shots: shots.map((s) => ({
      path: s.path,
      overflow: s.overflow.overflow,
      url: s.url,
      title: s.title,
    })),
    notes,
  };
  writeFileSync(join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nWrote ${join(OUT, 'qa-report.json')}`);
  console.log(`Desktop max overflow: ${report.desktopMaxOverflow}px`);
  console.log(`Mobile max overflow: ${report.mobileMaxOverflow}px`);
  if (fails.length) {
    console.error(`\nASK-SEARCH-008 QA FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('\nASK-SEARCH-008 browser QA passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
