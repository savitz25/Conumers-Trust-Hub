/**
 * VISUAL-001 production capture — measurements + hub-hop screenshots.
 * Read-only against canonical hosts. Does not mutate production.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(outDir, 'desktop'), { recursive: true });
mkdirSync(join(outDir, 'mobile'), { recursive: true });
mkdirSync(join(outDir, 'headers'), { recursive: true });

const HUBS = [
  { id: 'ask', host: 'www.asktrusthub.com', home: '/', extra: ['/network', '/guides/verify-usdot-number'] },
  { id: 'move', host: 'www.movetrusthub.com', home: '/', extra: ['/companies/1-800-pack-rat', '/local-movers/florida'] },
  { id: 'lender', host: 'www.lendertrusthub.com', home: '/', extra: ['/lenders/pacific-trust-mortgage'] },
  { id: 'insurance', host: 'www.insurancetrusthub.com', home: '/', extra: ['/carriers/humana', '/tools/coverage-compass'] },
  { id: 'contractor', host: 'www.contractortrusthub.com', home: '/', extra: ['/florida'] },
  { id: 'senior', host: 'www.seniortrusthub.com', home: '/', extra: ['/facility/harbor-pines'] },
  { id: 'investor', host: 'www.investortrusthub.com', home: '/', extra: ['/research', '/firm/northbridge-ledger-advisors'] },
];

const MEASURE_JS = () => {
  const pick = (sels) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      id: el.id || null,
      className: typeof el.className === 'string' ? el.className.slice(0, 160) : '',
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      font: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      color: cs.color,
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
      border: cs.border,
      padding: cs.padding,
      gap: cs.gap,
      display: cs.display,
    };
  };
  const header = pick(['header', '[data-site-header]', 'nav[aria-label="Main"]', '.site-header', '[role="banner"]']);
  const logo = pick(['header a img', 'header img', 'header svg', 'a[href="/"] img', 'a[href="/"] svg']);
  const logoLink = pick(['header a[href="/"]', 'a[aria-label*="Trust Hub" i]', 'header a']);
  const nav = pick(['header nav', 'nav']);
  const navLinks = [...document.querySelectorAll('header nav a, header a')].slice(0, 16).map((a) => ({
    text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48),
    ...box(a),
  }));
  const buttons = [...document.querySelectorAll('header button, header a[class*="btn"], header a[class*="Button"]')]
    .slice(0, 12)
    .map((el) => ({ text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), ...box(el) }));
  const h1 = document.querySelector('h1');
  const h2 = document.querySelector('h2');
  const bodyP = document.querySelector('main p, article p, p');
  const input = document.querySelector('input:not([type="hidden"])');
  const card = pick(['[class*="card"]', 'article', '.rounded-2xl', '.rounded-xl']);
  const footer = document.querySelector('footer');
  const main = document.querySelector('main') || document.querySelector('[role="main"]');
  const maxW = (() => {
    const el = main || document.querySelector('.container, .container-page, [class*="max-w"]');
    return el ? Math.round(el.getBoundingClientRect().width) : null;
  })();
  const gutter = (() => {
    const el = main || header;
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().left);
  })();
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    title: document.title,
    header: box(header),
    logo: box(logo),
    logoLink: box(logoLink),
    nav: box(nav),
    navLinks,
    buttons,
    h1: box(h1),
    h2: box(h2),
    bodyP: box(bodyP),
    input: box(input),
    card: box(card),
    footer: box(footer),
    main: box(main),
    contentWidth: maxW,
    leftGutter: gutter,
    bodyFont: getComputedStyle(document.body).fontFamily,
    bodySize: getComputedStyle(document.body).fontSize,
  };
};

async function shot(page, path, { fullPage = false, clip = null, type = 'jpeg', quality = 72 } = {}) {
  const opts = { path, type, quality };
  if (clip) opts.clip = clip;
  else opts.fullPage = fullPage;
  if (type === 'png') delete opts.quality;
  await page.screenshot(opts);
}

async function measurePage(page, url) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(900);
  const data = await page.evaluate(MEASURE_JS);
  data.status = resp ? resp.status() : null;
  data.url = url;
  return data;
}

const report = { capturedAt: new Date().toISOString(), hubs: {} };

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      userAgent:
        viewport.name === 'mobile'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    for (const hub of HUBS) {
      const home = `https://${hub.host}${hub.home}`;
      console.log(`${viewport.name} ${hub.id} ${home}`);
      try {
        const m = await measurePage(page, home);
        report.hubs[hub.id] ??= {};
        report.hubs[hub.id][viewport.name] = { home: m };
        await shot(page, join(outDir, viewport.name, `${hub.id}-home.jpg`), { fullPage: false });
        await shot(page, join(outDir, viewport.name, `${hub.id}-home-full.jpg`), {
          fullPage: true,
          quality: 58,
        });
        if (m.header) {
          await shot(page, join(outDir, 'headers', `${hub.id}-${viewport.name}.png`), {
            type: 'png',
            clip: {
              x: 0,
              y: 0,
              width: viewport.width,
              height: Math.min(Math.max(m.header.h + 8, 56), 160),
            },
          });
        }
        // Switch Hub open attempt
        const opened = await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('button, a, [role="button"]')];
          const t = nodes.find((el) => /switch hub/i.test(el.textContent || '') || /switch hub/i.test(el.getAttribute('aria-label') || ''));
          if (!t) return false;
          t.click();
          return true;
        });
        if (opened) {
          await page.waitForTimeout(400);
          await shot(page, join(outDir, viewport.name, `${hub.id}-switch-hub.jpg`), { fullPage: false, quality: 70 });
          await page.keyboard.press('Escape').catch(() => {});
        }
        if (viewport.name === 'mobile') {
          const menu = await page.evaluate(() => {
            const nodes = [...document.querySelectorAll('button, [aria-label]')];
            const t = nodes.find((el) => {
              const a = (el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '');
              return /menu|open navigation|open menu/i.test(a);
            });
            if (!t) return false;
            t.click();
            return true;
          });
          if (menu) {
            await page.waitForTimeout(450);
            await shot(page, join(outDir, 'mobile', `${hub.id}-nav-open.jpg`), { fullPage: false, quality: 70 });
            await page.keyboard.press('Escape').catch(() => {});
          }
        }
        if (viewport.name === 'desktop' && hub.extra?.[0]) {
          const extraUrl = `https://${hub.host}${hub.extra[0]}`;
          try {
            const em = await measurePage(page, extraUrl);
            report.hubs[hub.id].desktop.inner = em;
            await shot(page, join(outDir, 'desktop', `${hub.id}-inner.jpg`), { fullPage: false, quality: 68 });
          } catch (err) {
            report.hubs[hub.id].desktop.innerError = String(err);
          }
        }
      } catch (err) {
        console.error(`FAIL ${hub.id} ${viewport.name}`, err);
        report.hubs[hub.id] ??= {};
        report.hubs[hub.id][`${viewport.name}Error`] = String(err);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(outDir, 'measurements.json'), JSON.stringify(report, null, 2));
console.log('Wrote', join(outDir, 'measurements.json'));
