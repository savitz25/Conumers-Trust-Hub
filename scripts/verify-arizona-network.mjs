#!/usr/bin/env node
/**
 * ATH-AZ-FINAL required live specialist probe. Insurance/Move are research paths.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'data/network/arizona-publication-manifest.json'), 'utf8'),
);

const REQUIRED = manifest.release_gate.required_live_specialist_arizona_pages;

const EXPECTED_HEADLINE = {
  contractor: /arizona contractor/i,
  senior: /arizona senior/i,
  lender: /arizona mortgage|arizona lending/i,
  investor: /arizona investment/i,
};

async function probe(url, hubId) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    const robots = html.match(/name="robots" content="([^"]+)"/)?.[1] ?? null;
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? null;
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const looks404 = /page not found|404/i.test(title || '') || /page not found/i.test(h1);
    const selfCanonical = /\/arizona\/?$/i.test(canonical || '');
    const noindex = /noindex/i.test(robots || '');
    const headlineOk = EXPECTED_HEADLINE[hubId]?.test(h1) || EXPECTED_HEADLINE[hubId]?.test(title || '');
    return {
      http_status: res.status,
      ok: res.status === 200 && !looks404 && selfCanonical && !noindex && Boolean(headlineOk),
      canonical,
      robots,
      title,
      headline: h1,
      selfCanonical,
    };
  } catch (err) {
    return { http_status: null, ok: false, error: String(err) };
  }
}

const verifiedAt = new Date().toISOString();
const hubs = [];
for (const hub of manifest.hubs) {
  if (!REQUIRED.includes(hub.hub_id)) continue;
  const result = await probe(hub.canonical_state_url, hub.hub_id);
  hubs.push({ hub_id: hub.hub_id, url: hub.canonical_state_url, ...result });
}
const missing = hubs.filter((h) => !h.ok).map((h) => h.hub_id);
const passed = missing.length === 0;
const out = { ticket: 'ATH-AZ-FINAL', verified_at: verifiedAt, passed, missing, hubs };
writeFileSync(join(root, 'data/network/arizona-verification.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
if (!passed) process.exitCode = 2;
