/**
 * ATH-CLAIM-V2-FLNJ-001R1 — Ask-hosted durable claim-start preflight.
 * Pure verification + PGlite store tests always; a real-Postgres concurrency proof when ATH_PREFLIGHT_REAL_PG_URL
 * points at a localhost server (throwaway database, created and dropped). No production connection.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform } from './store.ts';
import { CLAIM_START_DURABLE_POLICY, CLAIM_START_PREFLIGHT_DOMAIN, opaqueClaimStartBucket, signClaimStartPreflight, verifyClaimStartPreflight } from './claim-start-preflight.ts';
import { hmacSha256 } from './crypto.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-claim-v2-flnj-001r1-preflight-secret-32chars';
const NOW = new Date('2026-09-24T20:00:00Z');
const PROFILE = '56a3f4c5-885d-4dd0-9c54-fe1f501bb7d4';
const body = (o: Partial<{ v: unknown; ts: unknown; rid: unknown; bucket: unknown; profileId: unknown }> = {}) =>
  JSON.stringify({ v: 1, ts: Math.floor(NOW.getTime() / 1000), rid: 'request-id-0123456789abcdef', bucket: opaqueClaimStartBucket(SECRET, '203.0.113.9'), profileId: PROFILE, ...o });

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: NOW };
  const platform = new CustomerPlatform({ sql, cth: { async getExact() { return null; } } as never, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: SECRET, staffEmails: ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  return { db, sql, platform, clock };
}
const digest = (bucket: string) => opaqueClaimStartBucket(SECRET, bucket);
const rid = () => `rid-${randomUUID().replace(/-/g, '')}`;

test('J/K: signature is checked over the raw body before parsing; bad HMAC, wrong domain, stale, malformed and misconfigured all fail closed with no DB touch', () => {
  const raw = body();
  const good = signClaimStartPreflight(SECRET, raw);
  assert.equal(verifyClaimStartPreflight(SECRET, raw, good, NOW).ok, true);
  assert.equal(good, hmacSha256(SECRET, `${CLAIM_START_PREFLIGHT_DOMAIN}:${raw}`), 'domain-separated message');
  assert.notEqual(good, hmacSha256(SECRET, raw), 'never the handoff-token message');
  const fail = (secret: string, r: unknown, sig: unknown, code: string, now = NOW) => { const v = verifyClaimStartPreflight(secret, r, sig, now); assert.equal(v.ok, false, code); if (!v.ok) assert.equal(v.code, code); };
  fail(SECRET, raw, 'A'.repeat(43), 'bad_signature');
  fail(SECRET, raw, hmacSha256(SECRET, raw), 'bad_signature');
  fail(SECRET, raw, hmacSha256('x'.repeat(40), `${CLAIM_START_PREFLIGHT_DOMAIN}:${raw}`), 'bad_signature');
  fail(SECRET, raw + ' ', good, 'bad_signature');
  fail('', raw, good, 'misconfigured'); fail('short', raw, good, 'misconfigured');
  fail(SECRET, '', good, 'malformed'); fail(SECRET, 'x'.repeat(2000), signClaimStartPreflight(SECRET, 'x'.repeat(2000)), 'malformed');
  const signed = (o: Record<string, unknown>) => { const r = body(o); return [r, signClaimStartPreflight(SECRET, r)] as const; };
  for (const [name, o] of [['v', { v: 2 }], ['rid', { rid: 'short' }], ['bucket', { bucket: '203.0.113.9' }], ['bucket-len', { bucket: 'A'.repeat(42) }], ['uuid', { profileId: 'not-a-uuid' }], ['ts', { ts: 'now' }]] as Array<[string, Record<string, unknown>]>) { const [r, sig] = signed(o); fail(SECRET, r, sig, 'malformed', NOW); void name; }
  const [staleBody, staleSig] = signed({ ts: Math.floor(NOW.getTime() / 1000) - 61 }); fail(SECRET, staleBody, staleSig, 'stale');
  const [futureBody, futureSig] = signed({ ts: Math.floor(NOW.getTime() / 1000) + 61 }); fail(SECRET, futureBody, futureSig, 'stale');
  const [edgeBody, edgeSig] = signed({ ts: Math.floor(NOW.getTime() / 1000) - 60 }); assert.equal(verifyClaimStartPreflight(SECRET, edgeBody, edgeSig, NOW).ok, true);
  const route = readFileSync('app/api/internal/claim/start-preflight/route.ts', 'utf8');
  assert.match(route, /verifyClaimStartPreflight\(process\.env\.ATH_HANDOFF_SECRET \|\| '', raw, request\.headers\.get\('x-ath-preflight-signature'\)\)/);
  assert.ok(route.indexOf('verifyClaimStartPreflight(') < route.indexOf('withPlatform('), 'verification precedes any database work');
  assert.match(route, /status: 405/); assert.match(route, /no-store/);
});

test('C/D/E: durable per-bucket (5/15m), per-bucket+profile (3/15m) and hourly (20/60m) bounds; replay refused; nothing but rate events written', async () => {
  const { db, sql, platform, clock } = await boot();
  const b = digest('203.0.113.9');
  const p2 = '11111111-1111-4111-8111-111111111111';
  // profile bound: 3 for one profile, then the 4th is refused while another profile still passes (aggregate has room)
  for (let i = 0; i < 3; i += 1) assert.equal((await platform.claimStartPreflight({ bucketDigest: b, profileId: PROFILE, requestId: rid() })).allowed, true);
  const p = await platform.claimStartPreflight({ bucketDigest: b, profileId: PROFILE, requestId: rid() });
  assert.equal(p.allowed, false); if (!p.allowed) { assert.equal(p.reason, 'per_bucket_profile'); assert.equal(p.retryAfterSeconds, 900); }
  for (let i = 0; i < 2; i += 1) assert.equal((await platform.claimStartPreflight({ bucketDigest: b, profileId: p2, requestId: rid() })).allowed, true);
  const a = await platform.claimStartPreflight({ bucketDigest: b, profileId: '22222222-2222-4222-8222-222222222222', requestId: rid() });
  assert.equal(a.allowed, false); if (!a.allowed) assert.equal(a.reason, 'per_bucket');
  // Hourly bound is a ROLLING 60-minute cap: across 16-minute steps the aggregate window keeps re-opening, but no
  // 60-minute window ever admits more than 20, and a saturated window admits exactly 20.
  const admittedAt: number[] = Array.from({ length: 5 }, () => NOW.getTime());
  for (let step = 0; step < 6; step += 1) {
    clock.now = new Date(clock.now.getTime() + 16 * 60 * 1000);
    for (let i = 0; i < 5; i += 1) { const d = await platform.claimStartPreflight({ bucketDigest: b, profileId: randomUUID(), requestId: rid() }); if (d.allowed) admittedAt.push(clock.now.getTime()); else assert.match(d.reason, /^per_bucket(_hourly)?$/); }
  }
  const windowMax = Math.max(...admittedAt.map((t) => admittedAt.filter((u) => u > t - 60 * 60 * 1000 && u <= t).length));
  assert.equal(windowMax, CLAIM_START_DURABLE_POLICY.perBucketHourly.max, `rolling-hour maximum (${windowMax})`);
  assert.ok(admittedAt.length > CLAIM_START_DURABLE_POLICY.perBucketHourly.max, 'admissions resume once the oldest events age out of the hour');
  // replay: same request id inside the window is refused even for a fresh bucket
  const fresh = digest('198.51.100.1'); const sameRid = rid();
  assert.equal((await platform.claimStartPreflight({ bucketDigest: fresh, profileId: PROFILE, requestId: sameRid })).allowed, true);
  const replay = await platform.claimStartPreflight({ bucketDigest: fresh, profileId: PROFILE, requestId: sameRid });
  assert.equal(replay.allowed, false); if (!replay.allowed) assert.equal(replay.reason, 'replay');
  // M / I: no intents, claims, grants; only opaque rate keys, never the bucket or an IP
  for (const t of ['ath_claim_intents', 'ath_claims', 'ath_management_grants', 'ath_audit_events']) assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ${t}`)).rows[0].n, '0', t);
  const keys = (await sql.query<{ bucket: string; rate_key: string }>(`SELECT bucket, rate_key FROM ath_rate_events`)).rows;
  assert.ok(keys.length > 0);
  for (const k of keys) { assert.match(k.bucket, /^claim_start_(rid|bucket|profile|hourly)$/); assert.doesNotMatch(k.rate_key, /203\.0\.113|198\.51\.100|::|\//); assert.notEqual(k.rate_key, b); assert.match(k.rate_key, /^[A-Za-z0-9_-]{43}$/); }
  await db.close();
});

test('G/H: bucket privacy — IPv4 and IPv6 /64 buckets become fixed-length keyed digests; two IPv6 hosts in one /64 share a digest; different /64s do not', () => {
  const d4 = digest('203.0.113.9'); assert.match(d4, /^[A-Za-z0-9_-]{43}$/); assert.doesNotMatch(d4, /203/);
  assert.equal(digest('2001:db8:aaaa:1::/64'), digest('2001:db8:aaaa:1::/64'));
  assert.notEqual(digest('2001:db8:aaaa:1::/64'), digest('2001:db8:aaaa:2::/64'));
  assert.notEqual(digest('203.0.113.9'), hmacSha256(SECRET, '203.0.113.9'), 'domain-separated from any other keyed use of the secret');
});

const REAL_PG = process.env.ATH_PREFLIGHT_REAL_PG_URL;
test('F: real Postgres — 24 concurrent transactions across simulated isolates admit exactly the configured limits', { skip: REAL_PG ? false : 'set ATH_PREFLIGHT_REAL_PG_URL=postgres://user@127.0.0.1:<port>/postgres' }, async () => {
  const admin = new URL(REAL_PG!); assert.ok(['127.0.0.1', 'localhost'].includes(admin.hostname));
  const dbName = `ath_preflight_${Date.now()}`;
  const a = new pg.Client({ connectionString: admin.toString() }); await a.connect(); await a.query(`CREATE DATABASE ${dbName}`);
  const target = new URL(admin.toString()); target.pathname = `/${dbName}`;
  const setup = new pg.Client({ connectionString: target.toString() }); await setup.connect();
  await applyCustomerMigrations({ query: async (t, p) => ({ rows: (await setup.query(t, p ?? [])).rows }), exec: async (t) => { await setup.query(t); } });
  await setup.end();
  const run = async (bucket: string, profileId: string) => {
    const c = new pg.Client({ connectionString: target.toString() }); await c.connect();
    try {
      await c.query('BEGIN'); await c.query("SELECT set_config('ath.app_role','server',true)");
      const platform = new CustomerPlatform({ sql: { query: async (t, p) => ({ rows: (await c.query(t, p ?? [])).rows }) }, cth: { async getExact() { return null; } } as never, mailer: async () => ({ sent: false }), handoffSecret: SECRET, staffEmails: [], siteUrl: 'https://www.asktrusthub.com' });
      const d = await platform.claimStartPreflight({ bucketDigest: digest(bucket), profileId, requestId: rid() });
      await c.query('COMMIT'); return d;
    } finally { await c.end(); }
  };
  try {
    const burst = await Promise.all(Array.from({ length: 24 }, (_, i) => run('203.0.113.77', i % 2 ? PROFILE : '11111111-1111-4111-8111-111111111111')));
    const allowed = burst.filter((d) => d.allowed).length;
    assert.equal(allowed, CLAIM_START_DURABLE_POLICY.perBucket.max, `aggregate 5 admitted out of 24 concurrent (got ${allowed})`);
    const perProfile = await Promise.all(Array.from({ length: 12 }, () => run('198.51.100.5', PROFILE)));
    assert.equal(perProfile.filter((d) => d.allowed).length, CLAIM_START_DURABLE_POLICY.perBucketProfile.max, 'profile bound under concurrency');
    const other = await Promise.all(Array.from({ length: 8 }, () => run('2001:db8:ffff:1::/64', randomUUID())));
    assert.equal(other.filter((d) => d.allowed).length, CLAIM_START_DURABLE_POLICY.perBucket.max, 'independent /64 bucket');
  } finally {
    await a.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`); await a.end();
  }
});
