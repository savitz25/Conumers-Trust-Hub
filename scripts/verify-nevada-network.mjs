#!/usr/bin/env node
/**
 * ATH-NV-001 six-hub Nevada release probe. Not used at runtime.
 * Probes each specialist /nevada page live and records the frozen release identity next to it.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'data/network/nevada-publication-manifest.json');

const HUBS = [
  { hub_id: 'move', url: 'https://www.movetrusthub.com/nevada', expect: /nevada moving|household goods/i,
    production_serving_sha: 'd0dddb4e93ec1e5557e0fa006ae020cc2407b2e8',
    serving_proof: 'GitHub Production deployment 6667128434 SHA equals the certified merge SHA and is the latest Production deployment.' },
  { hub_id: 'lender', url: 'https://www.lendertrusthub.com/nevada', expect: /nevada mortgage|lending/i,
    production_serving_sha: 'a8dafcda82b5e2c561aa38ffd5fad60f097c226d',
    serving_proof: "GitHub deployment 6668864799 (environment 'Production – lender-trust-hub') is a8dafcd. The Nevada data release is c6970df (#57); #58 (a8dafcd) changes only two lines of the Nevada component for keyboard focus and leaves the snapshot and fingerprint unchanged." },
  { hub_id: 'contractor', url: 'https://www.contractortrusthub.com/nevada', expect: /nevada contractor/i,
    production_serving_sha: 'c6835be2c61b98fdaf5959d507a22a78f56ab615',
    serving_proof: 'GitHub Production deployment 6666815483 SHA equals the certified merge SHA and is the latest Production deployment.' },
  { hub_id: 'insurance', url: 'https://www.insurancetrusthub.com/nevada', expect: /nevada insurance/i,
    production_serving_sha: '9bd835860b68507546deb0392bd5d261e327eaeb',
    serving_proof: 'GitHub Production deployment 6667227150 SHA equals the certified merge SHA and is the latest Production deployment.' },
  { hub_id: 'senior', url: 'https://www.seniortrusthub.com/nevada', expect: /nevada senior/i,
    production_serving_sha: '234c6b09a019da362b1c383418d13e3715a5fbca',
    serving_proof: 'GitHub Production deployment 6668830016 SHA equals the certified merge SHA and is the latest Production deployment.' },
  { hub_id: 'investor', url: 'https://www.investortrusthub.com/nevada', expect: /nevada investment|adviser|securities/i,
    production_serving_sha: '68fa8d10ccc2fe71e61ca078ef26d79a0ea44b15',
    serving_proof: 'GitHub Production deployment 6668334156 SHA equals the certified merge SHA and is the latest Production deployment.' },
];

const UA = { 'User-Agent': 'ATH-NV-001/1.0' };

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

/** Counts exact <loc> entries, following a sitemap index into its child sitemaps. */
async function countSitemapLoc(origin, target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`<loc>${escaped}</loc>`, 'g');
  const index = await (await fetch(`${origin}/sitemap.xml`, { headers: UA })).text();
  if (!/<sitemapindex/i.test(index)) return (index.match(exact) || []).length;
  let count = 0;
  for (const [, child] of index.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)) {
    const body = await (await fetch(child, { headers: UA })).text();
    count += (body.match(exact) || []).length;
  }
  return count;
}

async function probe(expectedUrl, expect) {
  const origin = new URL(expectedUrl).origin;
  try {
    const res = await fetch(expectedUrl, { redirect: 'follow', headers: UA });
    const html = await res.text();
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? null;
    const robots = html.match(/name="robots" content="([^"]+)"/)?.[1] ?? null;
    const xRobots = res.headers.get('x-robots-tag');
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? null;
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const looks404 = res.status === 404 || /page not found|404/i.test(title || '') || /page not found/i.test(h1);
    const sso = /sso-api|vercel.com\/login/i.test(res.url);
    const headlineOk = expect.test(h1) || expect.test(title || '');
    const canonicalMatches = samePage(canonical, expectedUrl);
    const noindex = /noindex/i.test(robots || '') || /noindex/i.test(xRobots || '');
    const mixed = {};
    for (const path of ['/Nevada', '/NEVADA']) {
      const r = await fetch(origin + path, { redirect: 'manual', headers: UA });
      const loc = r.headers.get('location');
      mixed[path] = [r.status, loc ? new URL(loc, origin).pathname : null];
    }
    const city = await fetch(`${origin}/nevada/las-vegas`, { redirect: 'manual', headers: UA });
    const sitemapOccurrences = await countSitemapLoc(origin, `${origin}/nevada`);
    // Schema only: a visible "No AggregateRating" disclaimer is not rating markup.
    const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    const rating = /"aggregateRating"|"ratingValue"|"reviewRating"/.test(ld);
    const mixedOk = Object.values(mixed).every(([status, path]) => status === 308 && path === '/nevada');
    const ok = res.status === 200 && !looks404 && samePage(res.url, expectedUrl) && canonicalMatches && !noindex && headlineOk && !sso &&
      mixedOk && city.status === 404 && sitemapOccurrences === 1 && !rating;
    return {
      http_status: res.status,
      expected_url: expectedUrl,
      final_url: res.url,
      ok,
      canonical,
      robots,
      x_robots_tag: xRobots,
      headline: h1 || title,
      intended_intelligence_page: canonicalMatches && !looks404,
      headline_ok: Boolean(headlineOk),
      not_noindex: !noindex,
      selfCanonical: canonicalMatches,
      sso,
      mixed_case_redirects: mixed,
      city_route_status: { '/nevada/las-vegas': city.status },
      sitemap_occurrences: sitemapOccurrences,
      rating_schema: rating,
    };
  } catch (err) {
    return { http_status: null, ok: false, expected_url: expectedUrl, error: String(err) };
  }
}

const verifiedAt = new Date().toISOString();
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { hubs: [] };
const hubs = [];
for (const hub of HUBS) {
  const result = await probe(hub.url, hub.expect);
  const accepted = (manifest.hubs || []).find((row) => row.hub_id === hub.hub_id);
  hubs.push({
    hub_id: hub.hub_id,
    url: hub.url,
    verified_at: verifiedAt,
    ...result,
    snapshot_version: accepted?.snapshot_version ?? null,
    fingerprint: accepted?.fingerprint ?? null,
    certified_release_sha: accepted?.certified_release_sha ?? null,
    production_serving_sha: hub.production_serving_sha,
    serving_proof: hub.serving_proof,
    specialist_status: accepted?.specialist_status ?? null,
  });
  console.log(`${hub.hub_id.padEnd(12)} ${result.http_status ?? 'ERR'} ${result.ok ? 'OK' : 'FAIL'} ${hub.url}`);
}

const missing = hubs.filter((row) => !(row.ok && row.http_status === 200)).map((row) => row.hub_id);
const pending = hubs.filter((row) => row.specialist_status !== 'CLOSED_PRODUCTION_VERIFIED').map((row) => row.hub_id);
const passed = missing.length === 0 && pending.length === 0;
const out = {
  verified_at: verifiedAt,
  release_gate_passed: passed,
  required_hubs: HUBS.map((h) => h.hub_id),
  missing,
  pending_certificates: pending,
  blocker: passed ? null : `Specialist Nevada pages failed: ${[...missing, ...pending].join(', ')}`,
  fingerprint_method: 'Accepted specialist snapshot artifact at certified repository SHA. Not recomputed from public HTML.',
  hubs,
};

writeFileSync(join(root, 'data/network/nevada-verification.json'), `${JSON.stringify(out, null, 2)}\n`);
if (passed) {
  manifest.release_gate.passed = true;
  manifest.release_gate.blocker = null;
  manifest.release_gate.verified_at = verifiedAt;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(JSON.stringify({ release_gate_passed: passed, missing, pending, verified_at: verifiedAt }, null, 2));
if (!passed) process.exitCode = 1;
