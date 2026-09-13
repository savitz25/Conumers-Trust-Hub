#!/usr/bin/env node
/**
 * ATH-IL-001 six-hub Illinois release/QA probe. Not used at runtime.
 * Compares normalized public URLs to the trusted specialist origins.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'data/network/illinois-publication-manifest.json');

const HUBS = [
  { hub_id: 'contractor', url: 'https://www.contractortrusthub.com/illinois', expect: /illinois|roofing|idfpr/i },
  { hub_id: 'move', url: 'https://www.movetrusthub.com/illinois', expect: /illinois|household|icc|ilcc/i },
  { hub_id: 'senior', url: 'https://www.seniortrusthub.com/illinois', expect: /illinois|nursing|idph|cms/i },
  { hub_id: 'lender', url: 'https://www.lendertrusthub.com/illinois', expect: /illinois|hmda|mortgage/i },
  { hub_id: 'insurance', url: 'https://www.insurancetrusthub.com/illinois', expect: /illinois|idoi|insurance/i },
  { hub_id: 'investor', url: 'https://www.investortrusthub.com/illinois', expect: /illinois|adviser|iapd|investment/i },
];

function normalizePublicUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `https://${url.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

function samePage(actual, expected) {
  const left = normalizePublicUrl(actual);
  const right = normalizePublicUrl(expected);
  return Boolean(left && right && left === right);
}

async function probe(expectedUrl, expect) {
  try {
    const res = await fetch(expectedUrl, { redirect: 'follow', headers: { 'User-Agent': 'ATH-IL-001/1.0' } });
    const html = await res.text();
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    const robots = html.match(/name="robots" content="([^"]+)"/)?.[1] ?? null;
    const xRobots = res.headers.get('x-robots-tag');
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? null;
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const looks404 = res.status === 404 || /page not found|404/i.test(title || '') || /page not found/i.test(h1);
    const sso = /sso-api|vercel.com\/login/i.test(res.url) || (/sso-api|vercel.com\/login/i.test(html.slice(0, 2000)) && /vercel.com\/login/i.test(res.url));
    const noindex = /noindex/i.test(robots || '') || /noindex/i.test(xRobots || '');
    const headlineOk = expect.test(h1) || expect.test(title || '');
    const finalMatches = samePage(res.url, expectedUrl);
    const canonicalMatches = samePage(canonical, expectedUrl);
    const ok =
      res.status === 200 &&
      !looks404 &&
      finalMatches &&
      canonicalMatches &&
      !noindex &&
      Boolean(headlineOk) &&
      !sso;
    return {
      http_status: res.status,
      expected_url: expectedUrl,
      final_url: res.url,
      ok,
      canonical,
      robots,
      x_robots_tag: xRobots,
      title,
      headline: h1,
      intended_intelligence_page: canonicalMatches && !looks404,
      headline_ok: Boolean(headlineOk),
      not_noindex: !noindex,
      selfCanonical: canonicalMatches,
      sso,
      fingerprint_method:
        'Public HTML confirms intended state-page identity. Snapshot fingerprint is taken from the accepted specialist repository artifact at the certified release SHA, not recomputed from HTML.',
    };
  } catch (err) {
    return { http_status: null, ok: false, expected_url: expectedUrl, error: String(err) };
  }
}

const verifiedAt = new Date().toISOString();
const hubs = [];
for (const hub of HUBS) {
  const result = await probe(hub.url, hub.expect);
  hubs.push({ hub_id: hub.hub_id, url: hub.url, verified_at: verifiedAt, ...result });
  console.log(`${hub.hub_id.padEnd(12)} ${result.http_status ?? 'ERR'} ${result.ok ? 'OK' : 'FAIL'} ${hub.url}`);
}

const missing = HUBS.filter((h) => !hubs.find((r) => r.hub_id === h.hub_id && r.ok && r.http_status === 200)).map(
  (h) => h.hub_id,
);
const passed = missing.length === 0;
const out = {
  verified_at: verifiedAt,
  release_gate_passed: passed,
  required_hubs: HUBS.map((h) => h.hub_id),
  missing,
  blocker: passed ? null : `Specialist Illinois pages failed: ${missing.join(', ')}`,
  fingerprint_method:
    'Accepted specialist snapshot artifact at certified repository SHA. Not recomputed from public HTML.',
  hubs,
};

if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  out.manifest_version = manifest.version ?? null;
}

writeFileSync(join(root, 'data/network/illinois-verification.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ release_gate_passed: passed, missing, verified_at: verifiedAt }, null, 2));
if (!passed) process.exitCode = 1;
