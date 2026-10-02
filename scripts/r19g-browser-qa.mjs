import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/makei/AppData/Roaming/npm/node_modules/artillery/node_modules/playwright/index.js");
const BASE = "http://localhost:3777";

async function search(page, query) {
  await page.goto(`${BASE}/ask`, { waitUntil: "load" });
  const input = page.locator('input[name="q"]').first();
  await input.click();
  await input.fill("");
  await input.type(query, { delay: 5 });
  await input.press("Enter");
  await page.waitForTimeout(2500);
  return page.locator("body").innerText();
}
function has(t, s) { return t.includes(s); }

const browser = await chromium.launch();
const results = {};

for (const [label, width, height] of [["1280", 1280, 900], ["390", 390, 844], ["320", 320, 568]]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  const cases = [
    "Abbey Delray South",
    "A Holly Patterson Extended Care Facility",
    "FFIII Houston SNF Tenant",
    "ADAMS COUNTY MANOR",
    "5 star nursing homes",
    "Zzyzx Nonexistent Care Facility LLC",
  ];
  const caseResults = {};
  for (const q of cases) {
    const text = await search(page, q);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    caseResults[q] = {
      hasSeniorTrustHub: has(text, "SeniorTrustHub"),
      overflow,
      snippet: text.slice(text.indexOf("SeniorTrustHub") - 50 > 0 ? text.indexOf("SeniorTrustHub") - 50 : 0, text.indexOf("SeniorTrustHub") + 400),
    };
  }
  results[label] = { caseResults, errors };

  // Back/Forward/refresh on the last successful named-provider result (ADAMS COUNTY MANOR)
  await search(page, "ADAMS COUNTY MANOR");
  const urlAfter = page.url();
  await page.goBack(); await page.waitForTimeout(500);
  await page.goForward(); await page.waitForTimeout(500);
  const forwardText = await page.locator("body").innerText();
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1500);
  const reloadText = await page.locator("body").innerText();
  results[label].backForward = {
    urlConsistent: urlAfter === page.url(),
    forwardHasAdams: has(forwardText, "ADAMS COUNTY MANOR") || has(forwardText, "366143"),
    reloadHasAdams: has(reloadText, "ADAMS COUNTY MANOR") || has(reloadText, "366143"),
  };

  await ctx.close();
}

await browser.close();
const fs = await import("node:fs");
fs.mkdirSync("docs/qa/th-search-r1-019g", { recursive: true });
fs.writeFileSync("docs/qa/th-search-r1-019g/browser-qa.json", JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
