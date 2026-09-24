/**
 * ATH-CLAIM-V2-FLNJ-001R1 — EXPLICIT CONTINUE IDEMPOTENCY (double-intent P1).
 * Contract: one browser receipt + one logical Continue -> exactly ONE durable intent, even when the specialist
 * minted two tokens for that one click. Security contract (nonce/replay/expiry) unchanged. PGlite; no network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform } from './store.ts';
import { HandoffError, mintHandoffToken, peekHandoffIdentity } from './handoff.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord } from './types.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-claim-v2-flnj-001r1-continue-secret-32chars';
const FL: CustomerProfileRecord = { id: '11111111-1111-4111-8111-111111111111', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc015082-acme-roofing', displayName: 'Acme Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC015082', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc015082-acme-roofing' };
const NJ: CustomerProfileRecord = { id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1', hubId: 'contractor', entityClass: 'contractor', slug: 'nj-nj-hic-13vh00000001-example-improvements-llc', displayName: 'Example Improvements LLC', isThin: false, publicationEligible: true, homeState: 'NJ', licenseState: 'NJ', externalKey: 'NJ-HIC:13VH00000001', sourceSystem: 'nj_dca', canonicalUrl: 'https://www.contractortrusthub.com/contractors/nj-nj-hic-13vh00000001-example-improvements-llc' };
const directory: CustomerProfileDirectory = { async getExact(p) { return [FL, NJ].find((x) => x.hubId === p.hub_id && x.id === p.native_profile_id) ?? null; } };

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: new Date('2026-09-24T14:00:00Z') };
  const platform = new CustomerPlatform({ sql, cth: directory, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: SECRET, staffEmails: ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  return { db, sql, platform, clock };
}
const mint = (p: CustomerProfileRecord, nonce: string) => mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: p.id, slug: p.slug, externalKey: p.externalKey, sourceSystem: p.sourceSystem, homeState: p.homeState, identifierNamespace: 'credential', entityClass: 'contractor', canonicalProfileUrl: p.canonicalUrl, displayName: p.displayName, version: 2, now: new Date('2026-09-24T13:59:00Z'), nonce }).token;
const intents = async (sql: SqlClient) => (await sql.query<{ id: string; nonce: string }>(`SELECT id, nonce FROM ath_claim_intents ORDER BY created_at`)).rows;
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }

test('1/3/4/5: sequential double-click and an identical network retry (same token, same receipt) resolve to ONE intent id', async () => {
  const { db, sql, platform } = await boot();
  const token = mint(FL, 'dbl-1'); const receipt = 'receipt-dbl-0123456789abcdef';
  await platform.receiveHandoff(token);
  const a = await platform.confirmClaimIntent({ token, receiptId: receipt, acquisitionSource: 'organic' });
  const b = await platform.confirmClaimIntent({ token, receiptId: receipt, acquisitionSource: 'organic' }); // double-click
  const c = await platform.confirmClaimIntent({ token, receiptId: receipt, acquisitionSource: 'organic' }); // network retry
  assert.equal(a.created, true); assert.equal(b.created, false); assert.equal(c.created, false);
  assert.equal(a.intentId, b.intentId); assert.equal(a.intentId, c.intentId);
  assert.equal((await intents(sql)).length, 1);
  await db.close();
});

test('2/4/5: two CONCURRENT Continue requests for one receipt create one intent and both callers get the same id', async () => {
  const { db, sql, platform } = await boot();
  const token = mint(FL, 'conc-1'); const receipt = 'receipt-conc-0123456789abcdef';
  const results = await Promise.all(Array.from({ length: 6 }, () => platform.confirmClaimIntent({ token, receiptId: receipt, acquisitionSource: 'organic' })));
  assert.equal(new Set(results.map((r) => r.intentId)).size, 1);
  assert.equal(results.filter((r) => r.created).length, 1);
  assert.equal((await intents(sql)).length, 1);
  await db.close();
});

test('P1 shape: specialist minted TWO tokens for one click; same browser receipt (or held intent cookie) -> still ONE intent; then exactly one claim', async () => {
  const { db, sql, platform } = await boot();
  const t1 = mint(FL, 'mint-1'); const t2 = mint(FL, 'mint-2'); // two different nonces, same exact profile
  const receipt = 'receipt-same-browser-0123456789';
  await platform.receiveHandoff(t1); await platform.receiveHandoff(t2);
  const first = await platform.confirmClaimIntent({ token: t1, receiptId: receipt, acquisitionSource: 'organic' });
  // 0.7 s later the browser continues again carrying the FRESH token but the same receipt id
  const second = await platform.confirmClaimIntent({ token: t2, receiptId: receipt, acquisitionSource: 'organic' });
  assert.equal(second.created, false); assert.equal(second.intentId, first.intentId);
  // …or carrying only the held intent cookie (receipt already cleared by the first Continue) with a new receipt id
  const third = await platform.confirmClaimIntent({ token: t2, receiptId: 'receipt-new-0123456789abcdef', existingIntentId: first.intentId, acquisitionSource: 'organic' });
  assert.equal(third.created, false); assert.equal(third.intentId, first.intentId);
  const rows = await intents(sql); assert.equal(rows.length, 1); assert.equal(rows[0].nonce, 'mint-1', 'the second token nonce is never recorded');
  // 6: submission remains exactly one claim
  const owner = await signup(platform, 'owner@acme-roofing.example');
  const claim = await platform.submitClaim({ sessionToken: owner.sessionToken, intentId: first.intentId, relationshipType: 'owner', credentialAttestation: 'CBC015082', authorized: true });
  await assert.rejects(() => platform.submitClaim({ sessionToken: owner.sessionToken, intentId: first.intentId, relationshipType: 'owner', credentialAttestation: 'CBC015082', authorized: true }));
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claims`)).rows[0].n, '1'); void claim;
  // after consumption a fresh Continue for the same profile is a NEW intent (the held one is consumed, not reused)
  const t3 = mint(FL, 'mint-3');
  const fourth = await platform.confirmClaimIntent({ token: t3, receiptId: receipt, existingIntentId: first.intentId, acquisitionSource: 'organic' });
  assert.equal(fourth.created, true); assert.notEqual(fourth.intentId, first.intentId);
  await db.close();
});

test('7: different receipt or different handoff keeps the existing security contract — no incorrect collapse, replay still fails closed, passive receipt still 0, expiry unchanged', async () => {
  const { db, sql, platform, clock } = await boot();
  const t1 = mint(FL, 'sec-1');
  for (let i = 0; i < 20; i += 1) await platform.receiveHandoff(t1);
  assert.equal((await intents(sql)).length, 0, 'passive receipt creates nothing');
  const a = await platform.confirmClaimIntent({ token: t1, receiptId: 'receipt-browser-A-0123456789', acquisitionSource: 'organic' });
  // another browser (different receipt) presenting the SAME token: replay -> fails closed, no second intent
  await assert.rejects(() => platform.confirmClaimIntent({ token: t1, receiptId: 'receipt-browser-B-0123456789', acquisitionSource: 'organic' }), (e: unknown) => e instanceof HandoffError && e.code === 'reused_nonce');
  // another browser with its OWN token for the same profile is a legitimately separate intent (competing claim path)
  const b = await platform.confirmClaimIntent({ token: mint(FL, 'sec-2'), receiptId: 'receipt-browser-B-0123456789', acquisitionSource: 'organic' });
  assert.equal(b.created, true); assert.notEqual(b.intentId, a.intentId);
  // same browser, DIFFERENT profile: not collapsed
  const c = await platform.confirmClaimIntent({ token: mint(NJ, 'sec-3'), receiptId: 'receipt-browser-A-0123456789', existingIntentId: a.intentId, acquisitionSource: 'organic' });
  assert.equal(c.created, true); assert.notEqual(c.intentId, a.intentId);
  // a forged/foreign existingIntentId cannot hijack: must match receipt OR be the held id for the same profile
  const d = await platform.confirmClaimIntent({ token: mint(FL, 'sec-4'), receiptId: 'receipt-browser-C-0123456789', existingIntentId: '99999999-9999-4999-8999-999999999999', acquisitionSource: 'organic' });
  assert.equal(d.created, true);
  // expiry unchanged: an expired token cannot Continue even with a held intent id
  clock.now = new Date('2026-09-24T14:20:00Z');
  await assert.rejects(() => platform.confirmClaimIntent({ token: mint(FL, 'sec-5'), receiptId: 'receipt-browser-A-0123456789', existingIntentId: a.intentId }), (e: unknown) => e instanceof HandoffError && e.code === 'expired');
  assert.equal((await intents(sql)).length, 4);
  await db.close();
});

test('wiring: accept keeps a same-profile receipt id and held intent; confirm passes the held intent; the peek never authenticates', () => {
  const accept = readFileSync('app/api/customer/claim/accept/route.ts', 'utf8');
  assert.match(accept, /const receiptId = sameProfile && priorReceipt \? priorReceipt\.receiptId : randomToken\(24\);/);
  assert.match(accept, /if \(!keepIntent\) await clearIntentCookie\(\);/);
  const confirm = readFileSync('app/api/customer/claim/confirm/route.ts', 'utf8');
  assert.match(confirm, /existingIntentId, ctx \}\)/);
  const store = readFileSync('lib/customer/store.ts', 'utf8');
  assert.match(store, /pg_advisory_xact_lock\(hashtext\(\$1\)\)`, \[`claim_continue:\$\{receiptHash\}`\]/);
  const id = peekHandoffIdentity(mint(NJ, 'peek-1'));
  assert.deepEqual(id, { hub_id: 'contractor', native_profile_id: NJ.id });
  assert.equal(peekHandoffIdentity('garbage'), null); assert.equal(peekHandoffIdentity(''), null);
});

// ---- real Postgres proof: separate connections, separate transactions, true concurrency (PGlite is one connection)
const REAL_PG = process.env.ATH_PREFLIGHT_REAL_PG_URL;
test('real Postgres — concurrent Continues on separate connections (same token, and the two-mint P1 shape) yield exactly ONE intent', { skip: REAL_PG ? false : 'set ATH_PREFLIGHT_REAL_PG_URL=postgres://user@127.0.0.1:<port>/postgres' }, async () => {
  const pg = await import('pg');
  const admin = new URL(REAL_PG!); assert.ok(['127.0.0.1', 'localhost'].includes(admin.hostname));
  const dbName = `ath_continue_${Date.now()}`;
  const a = new pg.default.Client({ connectionString: admin.toString() }); await a.connect(); await a.query(`CREATE DATABASE ${dbName}`);
  const target = new URL(admin.toString()); target.pathname = `/${dbName}`;
  const setup = new pg.default.Client({ connectionString: target.toString() }); await setup.connect();
  await applyCustomerMigrations({ query: async (t, p) => ({ rows: (await setup.query(t, p ?? [])).rows }), exec: async (t) => { await setup.query(t); } });
  const count = async () => Number((await setup.query(`SELECT count(*)::int n FROM ath_claim_intents`)).rows[0].n);
  const run = async (token: string, receiptId: string, existingIntentId?: string) => {
    const c = new pg.default.Client({ connectionString: target.toString() }); await c.connect();
    try {
      await c.query('BEGIN'); await c.query("SELECT set_config('ath.app_role','server',true)");
      const platform = new CustomerPlatform({ sql: { query: async (t, p) => ({ rows: (await c.query(t, p ?? [])).rows }) }, cth: directory, mailer: async () => ({ sent: false }), handoffSecret: SECRET, staffEmails: [], siteUrl: 'https://www.asktrusthub.com', now: () => new Date('2026-09-24T14:00:00Z') });
      const r = await platform.confirmClaimIntent({ token, receiptId, existingIntentId, acquisitionSource: 'organic' });
      await c.query('COMMIT'); return r;
    } finally { await c.end(); }
  };
  try {
    // (2) same token, same receipt, 8 truly concurrent transactions
    const t1 = mint(FL, 'pg-same-1');
    const same = await Promise.all(Array.from({ length: 8 }, () => run(t1, 'receipt-pg-same-0123456789abcdef')));
    assert.equal(new Set(same.map((r) => r.intentId)).size, 1); assert.equal(same.filter((r) => r.created).length, 1); assert.equal(await count(), 1);
    // P1 shape: eight DIFFERENT tokens (specialist minted repeatedly for one click), one browser receipt, concurrent
    const many = await Promise.all(Array.from({ length: 8 }, (_, i) => run(mint(NJ, `pg-multi-${i}`), 'receipt-pg-multi-0123456789abcde')));
    assert.equal(new Set(many.map((r) => r.intentId)).size, 1, 'all eight callers resolve to the same intent'); assert.equal(many.filter((r) => r.created).length, 1); assert.equal(await count(), 2);
    // different browsers (different receipts, own tokens) are NOT collapsed
    const other = await Promise.all(Array.from({ length: 3 }, (_, i) => run(mint(FL, `pg-other-${i}`), `receipt-pg-other-${i}-0123456789abc`)));
    assert.equal(new Set(other.map((r) => r.intentId)).size, 3); assert.equal(await count(), 5);
  } finally {
    await setup.end(); await a.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`); await a.end();
  }
});
