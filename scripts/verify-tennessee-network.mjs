#!/usr/bin/env node
/**
 * ATH-TN-001 six-hub Tennessee release probe. Not used at runtime.
 * Probes each specialist /tennessee page live and records the frozen release identity next to it.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'data/network/tennessee-publication-manifest.json');

const HUBS = [
  { hub_id: 'move', url: 'https://www.movetrusthub.com/tennessee', expect: /tennessee moving|household goods|intrastate/i,
    production_serving_sha: 'b72c3c0aabf0813358a8f622be68f4b2fe4302a4',
    serving_proof: 'GitHub Production deployment SHA equals certified SHA; the live page data-build-id equals the certified SHA.' },
  { hub_id: 'lender', url: 'https://www.lendertrusthub.com/tennessee', expect: /tennessee mortgage|nmls|lending/i,
    production_serving_sha: '54b11a9c12bf03042f1bb3ff1af60a0005d6d04a',
    serving_proof: "Vercel 'lender-trust-hub' commit status on 54b11a9 is success and the live page prints fingerprint prefix cb713c0a5551. The repo's GitHub Deployments feed stopped at 945be89 (2026-09-02) and is not used as proof." },
  { hub_id: 'contractor', url: 'https://www.contractortrusthub.com/tennessee', expect: /tennessee contractor|licensing/i,
    production_serving_sha: 'b2d6e847cafc47348ccb7a31f71ae0a72fc7ea61',
    serving_proof: 'Production serves later main b2d6e84 (ATH-CLAIM-V2-FLNJ-001 #96); the compare d36047b...b2d6e84 changes no Tennessee file, so the certified Tennessee release is unchanged.' },
  { hub_id: 'insurance', url: 'https://www.insurancetrusthub.com/tennessee', expect: /tennessee insurance|naic|tdci/i,
    production_serving_sha: 'a52b69d53e408d18f3ef5d64f38d40e57f8e1c41',
    serving_proof: 'GitHub Production deployment 6663613599 SHA equals the certified merge SHA; the live page prints fingerprint prefix bb82b021809e. C-B3 TN-INS-001 Production certificate passed 76/76 (2026-09-25).' },
  { hub_id: 'senior', url: 'https://www.seniortrusthub.com/tennessee', expect: /tennessee senior|nursing|hfc/i,
    production_serving_sha: 'e5ba724a9209422e15c80c4d112afba1cd57b1f8',
    serving_proof: 'GitHub Production deployment SHA equals certified SHA.' },
  { hub_id: 'investor', url: 'https://www.investortrusthub.com/tennessee', expect: /tennessee investment|adviser|securities/i,
    production_serving_sha: '506ba754a21105c309c87757b8f57fdb41e39b34',
    serving_proof: 'GitHub Production deployment SHA equals certified SHA.' },
];

const UA = { 'User-Agent': 'ATH-TN-001/1.0' };

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
    for (const path of ['/Tennessee', '/TENNESSEE']) {
      const r = await fetch(origin + path, { redirect: 'manual', headers: UA });
      const loc = r.headers.get('location');
      mixed[path] = [r.status, loc ? new URL(loc, origin).pathname : null];
    }
    const city = await fetch(`${origin}/tennessee/nashville`, { redirect: 'manual', headers: UA });
    const sitemapOccurrences = await countSitemapLoc(origin, `${origin}/tennessee`);
    // Schema only: a visible "No AggregateRating" disclaimer is not rating markup.
    const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    const rating = /"aggregateRating"|"ratingValue"|"reviewRating"/.test(ld);
    const mixedOk = Object.values(mixed).every(([status, path]) => status === 308 && path === '/tennessee');
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
      city_route_status: { '/tennessee/nashville': city.status },
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
  blocker: passed ? null : `Specialist Tennessee pages failed: ${[...missing, ...pending].join(', ')}`,
  fingerprint_method: 'Accepted specialist snapshot artifact at certified repository SHA. Not recomputed from public HTML.',
  hubs,
};

writeFileSync(join(root, 'data/network/tennessee-verification.json'), `${JSON.stringify(out, null, 2)}\n`);
if (passed) {
  manifest.release_gate.passed = true;
  manifest.release_gate.blocker = null;
  manifest.release_gate.verified_at = verifiedAt;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(JSON.stringify({ release_gate_passed: passed, missing, pending, verified_at: verifiedAt }, null, 2));
if (!passed) process.exitCode = 1;
