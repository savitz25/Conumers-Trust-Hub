#!/usr/bin/env node
/**
 * ATH-VA-NET-001 six-hub Virginia release/QA probe. Not used at runtime.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'data/network/virginia-publication-manifest.json');

const HUBS = [
  { hub_id: 'contractor', url: 'https://www.contractortrusthub.com/virginia', expect: /virginia contractor|class a|dpor/i },
  { hub_id: 'move', url: 'https://www.movetrusthub.com/virginia', expect: /virginia moving|household|hhg|dmv/i },
  { hub_id: 'senior', url: 'https://www.seniortrusthub.com/virginia', expect: /virginia senior|assisted living/i },
  { hub_id: 'lender', url: 'https://www.lendertrusthub.com/virginia', expect: /virginia mortgage|virginia lending|scc/i },
  { hub_id: 'investor', url: 'https://www.investortrusthub.com/virginia', expect: /virginia investment|adviser/i },
  { hub_id: 'insurance', url: 'https://www.insurancetrusthub.com/virginia', expect: /virginia insurance/i },
];

async function probe(url, expect) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'ATH-VA-NET-001/1.0' } });
    const html = await res.text();
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    const robots = html.match(/name="robots" content="([^"]+)"/)?.[1] ?? null;
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? null;
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const looks404 = /page not found|404/i.test(title || '') || /page not found/i.test(h1);
    const sso = /sso-api|vercel.com\/login/i.test(html.slice(0, 2000)) && res.url.includes('vercel.com/login');
    const selfCanonical = /\/virginia\/?$/i.test(canonical || '');
    const noindex = /noindex/i.test(robots || '');
    const headlineOk = expect.test(h1) || expect.test(title || '');
    return {
      http_status: res.status,
      final_url: res.url,
      ok: res.status === 200 && !looks404 && selfCanonical && !noindex && Boolean(headlineOk) && !sso,
      canonical,
      robots,
      title,
      headline: h1,
      intended_intelligence_page: selfCanonical && !looks404,
      headline_ok: Boolean(headlineOk),
      not_noindex: !noindex,
      selfCanonical,
      sso,
    };
  } catch (err) {
    return { http_status: null, ok: false, error: String(err) };
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
  blocker: passed ? null : `Specialist Virginia pages failed: ${missing.join(', ')}`,
  hubs,
};

if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  out.manifest_version = manifest.version ?? null;
}

writeFileSync(join(root, 'data/network/virginia-verification.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ release_gate_passed: passed, missing, verified_at: verifiedAt }, null, 2));
if (!passed) process.exitCode = 1;
