import { chromium } from 'playwright';

const origin = process.env.ASK_ORIGIN || 'http://127.0.0.1:3011';
const browser = await chromium.launch({ headless: true });

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(origin + '/', { waitUntil: 'networkidle' });
const mobile = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.th-header-mobile-actions button')].map((b) => {
    const r = b.getBoundingClientRect();
    return { label: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) };
  });
  return { btns, overflowX: document.documentElement.scrollWidth > innerWidth + 1 };
});
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(300);
const drawer = await page.evaluate(() => {
  const el = document.querySelector('.th-drawer');
  const current = el?.querySelector('[aria-current]');
  return {
    hasNetworkHeading: /ASK TRUST HUB NETWORK/i.test(el?.textContent || ''),
    currentText: current?.textContent?.replace(/\s+/g, ' ').slice(0, 100) || null,
    ariaCurrent: current?.getAttribute('aria-current') || null,
  };
});
await ctx.close();

const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dp = await desk.newPage();
await dp.goto(origin + '/', { waitUntil: 'networkidle' });
const a11y = await dp.evaluate(() => {
  const skip = !!document.querySelector('a.th-skip');
  const main = !!document.querySelector('#main-content');
  const headerRows = document.querySelectorAll('header .th-header-inner').length;
  const knowledgeInHeader = /Knowledge\s*&\s*concierge/i.test(
    document.querySelector('header')?.innerText || ''
  );
  return { skip, main, headerRows, knowledgeInHeader };
});
const meta = await dp.evaluate(() => ({
  canonical: document.querySelector('link[rel=canonical]')?.href,
  ogTitle: document.querySelector('meta[property="og:title"]')?.content,
  title: document.title,
}));
await desk.close();
await browser.close();

const touchOk = mobile.btns.every((b) => b.w >= 44 && b.h >= 44);
const report = {
  mobile,
  drawer,
  a11y,
  meta,
  pass: {
    touchTargets: touchOk,
    noOverflow: !mobile.overflowX,
    networkHeading: drawer.hasNetworkHeading,
    ariaCurrent: drawer.ariaCurrent === 'page',
    skipLink: a11y.skip,
    mainLandmark: a11y.main,
    singleHeaderRow: a11y.headerRows === 1,
    noKnowledgeLabel: !a11y.knowledgeInHeader,
    canonical: meta.canonical === 'https://www.asktrusthub.com/',
  },
};
console.log(JSON.stringify(report, null, 2));
const failed = Object.entries(report.pass).filter(([, v]) => !v);
if (failed.length) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('a11y/mobile verify passed');
