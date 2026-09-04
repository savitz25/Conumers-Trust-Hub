#!/usr/bin/env node
/**
 * ATH-TX-002 six-hub Texas release/QA probe. Not used at runtime.
 * Any one specialist failure fails the gate. Do not weaken this gate.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'data/network/texas-publication-manifest.json'), 'utf8'),
);

const REQUIRED = ['move', 'lender', 'insurance', 'senior', 'contractor', 'investor'];

const EXPECTED_HEADLINE = {
  move: /texas moving|household-goods/i,
  lender: /texas mortgage|texas lending/i,
  insurance: /texas insurance/i,
  senior: /texas senior/i,
  contractor: /texas contractor/i,
  investor: /texas investment/i,
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
    const selfCanonical = /\/texas\/?$/i.test(canonical || '');
    const noindex = /noindex/i.test(robots || '');
    const headlineOk = EXPECTED_HEADLINE[hubId]?.test(h1) || EXPECTED_HEADLINE[hubId]?.test(title || '');
    return {
      http_status: res.status,
      ok: res.status === 200 && !looks404 && selfCanonical && !noindex && Boolean(headlineOk),
      canonical,
      robots,
      title,
      headline: h1,
      intended_intelligence_page: selfCanonical && !looks404,
      headline_ok: Boolean(headlineOk),
      not_noindex: !noindex,
    };
  } catch (err) {
    return { http_status: null, ok: false, error: String(err) };
  }
}

const verifiedAt = new Date().toISOString();
const hubs = [];
for (const hub of manifest.hubs) {
  const result = await probe(hub.canonical_state_url, hub.hub_id);
  hubs.push({
    hub_id: hub.hub_id,
    url: hub.canonical_state_url,
    publication_status: hub.publication_status,
    verified_at: verifiedAt,
    ...result,
  });
  console.log(
    `${hub.hub_id.padEnd(12)} ${result.http_status ?? 'ERR'} ${result.ok ? 'OK' : 'FAIL'} ${hub.canonical_state_url}`,
  );
}

const missing = REQUIRED.filter((id) => !hubs.find((h) => h.hub_id === id && h.ok && h.http_status === 200));
const passed = missing.length === 0;
const out = {
  verified_at: verifiedAt,
  release_gate_passed: passed,
  missing,
  blocker: passed ? null : missing.join(','),
  hubs,
};
writeFileSync(join(root, 'data/network/texas-verification.json'), JSON.stringify(out, null, 2) + '\n');
console.log(passed ? 'SIX-HUB GATE PASS' : `SIX-HUB GATE FAIL missing=${missing.join(',')}`);
if (!passed) process.exitCode = 2;
