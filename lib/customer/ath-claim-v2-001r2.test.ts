/**
 * ATH-CLAIM-V2-001R2 — correction/patch pass on top of the V2 + R foundation.
 *   Q1 — the receipt cookie is a signed, domain-separated envelope; every tamper and the pre-Q1 unsigned
 *        shape fail closed.
 *   Q2 — acquisition source is trusted ONLY from inside the signed handoff payload; a query string is never
 *        read; a hub/token that doesn't sign it gets 'unknown', never a default of 'organic'.
 *   Q7 — ONE open review session per claim (not per reviewer); any final decision or a needs_info atomically
 *        closes it; a different reviewer is blocked while one is open; no timer survives a decision.
 * PGlite only. No production connection.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { ClaimError, CustomerPlatform } from './store.ts';
import { mintHandoffToken } from './handoff.ts';
import { encodeClaimReceipt, decodeClaimReceipt } from './claim-receipt.ts';
import { hmacSha256 } from './crypto.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord } from './types.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-claim-v2-001r2-handoff-secret-32-characters-min';
const CONTRACTOR: CustomerProfileRecord = { id: '22222222-2222-4222-8222-222222222222', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc020000-r2-roofing', displayName: 'R2 Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC020000', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc020000-r2-roofing' };
const directory: CustomerProfileDirectory = { async getExact(p) { return p.hub_id === 'contractor' && p.native_profile_id === CONTRACTOR.id ? CONTRACTOR : null; } };
function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: new Date('2026-09-23T14:00:00Z') };
  const platform = new CustomerPlatform({ sql, cth: directory, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: SECRET, staffEmails: ['staffa@asktrusthub.com', 'staffb@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  return { db, sql, platform, clock };
}
const mint = (nonce: string, acquisitionSource?: string, now = new Date('2026-09-23T13:59:00Z')) => mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: CONTRACTOR.id, slug: CONTRACTOR.slug, externalKey: CONTRACTOR.externalKey, sourceSystem: CONTRACTOR.sourceSystem, homeState: 'FL', identifierNamespace: 'credential', entityClass: 'contractor', canonicalProfileUrl: CONTRACTOR.canonicalUrl, displayName: CONTRACTOR.displayName, version: 2, now, nonce, acquisitionSource }).token;
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }

// ---------------------------------------------------------------- Q1
test('Q1: the receipt cookie is a signed envelope; every listed tamper and the pre-Q1 unsigned shape are rejected', () => {
  const secret = 'ath-claim-v2-001r2-receipt-test-secret-32-chars-x';
  const otherSecret = 'a-completely-different-secret-32-characters-min-x';
  const receipt = { token: 'abc.def', receiptId: 'r'.repeat(24), source: 'organic' as const, receivedAt: 1700000000000 };
  const encoded = encodeClaimReceipt(receipt, secret);
  assert.deepEqual(decodeClaimReceipt(encoded, secret), receipt, 'a valid envelope round-trips');
  const dot = encoded.lastIndexOf('.');
  const body = encoded.slice(0, dot);
  const sig = encoded.slice(dot + 1);
  const reEncode = (fields: Partial<{ t: string; r: string; s: string; a: number }>) =>
    Buffer.from(JSON.stringify({ t: receipt.token, r: receipt.receiptId, s: receipt.source, a: receipt.receivedAt, ...fields }), 'utf8').toString('base64url');

  // receiptId tamper
  assert.equal(decodeClaimReceipt(`${reEncode({ r: 's'.repeat(24) })}.${sig}`, secret), null, 'receiptId tamper rejected');
  // source tamper
  assert.equal(decodeClaimReceipt(`${reEncode({ s: 'manual_outreach' })}.${sig}`, secret), null, 'source tamper rejected');
  // receivedAt tamper
  assert.equal(decodeClaimReceipt(`${reEncode({ a: 999 })}.${sig}`, secret), null, 'receivedAt tamper rejected');
  // body tamper (structural: flip the last character of the base64url body, keep the old signature)
  const flippedBody = body.slice(0, -1) + (body.at(-1) === 'A' ? 'B' : 'A');
  assert.equal(decodeClaimReceipt(`${flippedBody}.${sig}`, secret), null, 'body tamper rejected');
  // signature tamper
  const flippedSig = sig.slice(0, -1) + (sig.at(-1) === 'A' ? 'B' : 'A');
  assert.equal(decodeClaimReceipt(`${body}.${flippedSig}`, secret), null, 'signature tamper rejected');
  // wrong key entirely (what a forgery without the server secret would produce)
  assert.equal(decodeClaimReceipt(encoded, otherSecret), null, 'wrong secret rejected');
  // unsigned legacy candidate: the pre-Q1 cookie was bare base64url JSON with no "." at all
  const legacyUnsigned = reEncode({});
  assert.equal(decodeClaimReceipt(legacyUnsigned, secret), null, 'a pre-Q1 unsigned cookie never verifies');
  assert.equal(legacyUnsigned.includes('.'), false, 'sanity: base64url never contains a dot, so this really is the old shape');
  // domain separation from handoff signing: an unprefixed HMAC over the same body (what handoff.ts computes)
  // must not double as a valid receipt signature.
  const handoffStyleSig = hmacSha256(secret, body);
  assert.notEqual(handoffStyleSig, sig);
  assert.equal(decodeClaimReceipt(`${body}.${handoffStyleSig}`, secret), null, 'a handoff-style signature does not verify as a receipt signature');
  // oversized and empty inputs still fail closed
  assert.equal(decodeClaimReceipt('a'.repeat(5000), secret), null);
  assert.equal(decodeClaimReceipt('', secret), null);
  assert.equal(decodeClaimReceipt(undefined, secret), null);
});

// ---------------------------------------------------------------- Q2
test('Q2: acquisition source is authenticated from the signed handoff payload only, never a query string', async () => {
  const { db, platform } = await boot();
  const bare = mint('q2-bare'); // no acquisitionSource signed at all
  assert.equal((await platform.receiveHandoff(bare)).acquisitionSource, 'unknown', 'a hub/token that signs nothing is unknown, never organic by default');
  assert.equal((await platform.receiveHandoff(mint('q2-organic', 'organic'))).acquisitionSource, 'organic');
  assert.equal((await platform.receiveHandoff(mint('q2-garbage', 'not-a-real-source'))).acquisitionSource, 'unknown', 'an unrecognized signed value sanitizes to unknown, never crashes');
  // internal_test is reachable ONLY by a trusted server-side caller minting directly (exactly what this test
  // does) -- never through a public HTTP boundary that could take it from a browser.
  assert.equal((await platform.receiveHandoff(mint('q2-internal', 'internal_test'))).acquisitionSource, 'internal_test');
  assert.equal((await platform.receiveHandoff(mint('q2-manual', 'manual_outreach'))).acquisitionSource, 'manual_outreach');
  await db.close();
});

test('Q2: the accept route trusts receiveHandoff, never a query string; the sanitize-and-trust helper is removed, not just unused', () => {
  const route = readFileSync('app/api/customer/claim/accept/route.ts', 'utf8');
  assert.doesNotMatch(route, /searchParams\.get\(['"]source['"]\)/, 'no query-string source is ever read');
  assert.doesNotMatch(route, /specialistDeclaredSource/);
  assert.match(route, /received\.acquisitionSource/, 'source comes from the authenticated receiveHandoff() result');
  const funnel = readFileSync('lib/customer/claim-v2-funnel.ts', 'utf8');
  assert.doesNotMatch(funnel, /export (function|const) specialistDeclaredSource|export const SPECIALIST_DECLARABLE_SOURCES/, 'the sanitize-and-trust helper is removed, not just unused (a doc comment may still name it)');
  const types = readFileSync('lib/customer/types.ts', 'utf8');
  assert.match(types, /acquisition_source\?:\s*string/, 'acquisition_source lives inside the signed HandoffPayload');
});

// ---------------------------------------------------------------- Q7
test('Q7: one open review session total per claim; a different reviewer is blocked; every decision path atomically closes it', async () => {
  const { db, sql, platform, clock } = await boot();
  await platform.receiveHandoff(mint('q7-nonce'));
  const confirmed = await platform.confirmClaimIntent({ token: mint('q7-nonce'), receiptId: 'receipt-q7-0123456789abcdef', acquisitionSource: 'organic' });
  const owner = await signup(platform, 'q7-owner@r2-roofing.example');
  const claim = await platform.submitClaim({ sessionToken: owner.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  const staffA = await signup(platform, 'staffa@asktrusthub.com');
  const staffB = await signup(platform, 'staffb@asktrusthub.com');

  const startedA = await platform.startReviewSession({ sessionToken: staffA.sessionToken, claimId: claim.claimId, evidenceReady: true });
  assert.equal(startedA.created, true);
  // A different reviewer is blocked while A's session is open.
  await assert.rejects(() => platform.startReviewSession({ sessionToken: staffB.sessionToken, claimId: claim.claimId }), (e: unknown) => e instanceof ClaimError && e.code === 'review_in_progress');
  // The SAME reviewer re-posting is idempotent (a double-click), not a duplicate/violation.
  const againA = await platform.startReviewSession({ sessionToken: staffA.sessionToken, claimId: claim.claimId });
  assert.equal(againA.created, false); assert.equal(againA.sessionId, startedA.sessionId);
  const openCount = async () => Number((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_review_sessions WHERE claim_id=$1 AND ended_at IS NULL`, [claim.claimId])).rows[0].n);
  assert.equal(await openCount(), 1);

  // needs_info atomically closes the active timer.
  clock.now = new Date(clock.now.getTime() + 3 * 60 * 1000);
  await platform.staffDecide({ sessionToken: staffA.sessionToken, claimId: claim.claimId, decision: 'needs_info', evidenceCodes: ['CORPORATE_OFFICER_MATCH'], evidenceNote: 'Synthetic Q7 test: requesting one more independent check.', internalRationale: 'Synthetic Q7 test rationale.', claimantMessage: 'Synthetic Q7 test message asking for more information.', reasonCategory: 'AUTHORITY_EVIDENCE_MISSING' });
  assert.equal(await openCount(), 0, 'needs_info closes the active timer');

  // Responsibility returns to staff (a different reviewer this time) -> resumes, does not restart, and reopens
  // exactly one new session; the prior one stays closed (no accumulation of open timers).
  const startedB = await platform.startReviewSession({ sessionToken: staffB.sessionToken, claimId: claim.claimId });
  assert.equal(startedB.created, true);
  assert.notEqual(startedB.sessionId, startedA.sessionId);
  assert.equal(await openCount(), 1);

  // The final decision closes it again.
  clock.now = new Date(clock.now.getTime() + 2 * 60 * 1000);
  await platform.staffDecide({ sessionToken: staffB.sessionToken, claimId: claim.claimId, decision: 'approve', evidenceCodes: ['CORPORATE_OFFICER_MATCH', 'COMPANY_DOMAIN_CONTROL'], evidenceNote: 'Synthetic Q7 test: independent officer record and authenticated domain control.', internalRationale: 'Synthetic Q7 test approval rationale.', claimantMessage: 'Synthetic Q7 test approval message.', reasonCategory: 'AUTHORITY_VERIFIED' });
  assert.equal(await openCount(), 0, 'the final decision closes any open timer');
  const totalSessions = Number((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_review_sessions WHERE claim_id=$1`, [claim.claimId])).rows[0].n);
  assert.equal(totalSessions, 2, 'exactly two sessions total (A, then B) -- no duplicates from the idempotent retry or from closing');
  // No timer keeps accumulating after the decision: the claim is no longer in an openable status.
  await assert.rejects(() => platform.startReviewSession({ sessionToken: staffA.sessionToken, claimId: claim.claimId }), (e: unknown) => e instanceof ClaimError && e.code === 'invalid_transition');
  assert.equal(await openCount(), 0);

  const migrationSql = readFileSync('schema/migrations/019_ath_claim_v2_foundation.sql', 'utf8');
  assert.match(migrationSql, /CREATE UNIQUE INDEX IF NOT EXISTS ath_claim_review_sessions_one_open_per_claim\s*\n\s*ON ath_claim_review_sessions \(claim_id\) WHERE ended_at IS NULL/);
  assert.doesNotMatch(migrationSql, /ON ath_claim_review_sessions \(claim_id, reviewer_user_id\) WHERE ended_at IS NULL/, 'the old per-reviewer invariant must not still be the live constraint');
  await db.close();
});

// ---------------------------------------------------------------- Q8
test('Q8: the V2 claim IP rate-limit buckets never store or log the raw IP', async () => {
  const { db, sql, platform } = await boot();
  const ip = '203.0.113.199';
  await platform.receiveHandoff(mint('q8-nonce'), { ip });
  const rows = await sql.query<{ rate_key: string }>(`SELECT rate_key FROM ath_rate_events WHERE bucket='handoff_ip'`);
  assert.equal(rows.rows.length, 1);
  assert.notEqual(rows.rows[0].rate_key, ip, 'the raw IP is never the durable storage key for a V2 IP bucket');
  assert.ok(rows.rows[0].rate_key.length >= 32, 'the storage key is an opaque digest, not a short/reversible value');
  // Same IP -> same digest (rate limiting still works correctly on the keyed digest).
  await platform.receiveHandoff(mint('q8-nonce-2'), { ip });
  const rows2 = await sql.query<{ rate_key: string }>(`SELECT DISTINCT rate_key FROM ath_rate_events WHERE bucket='handoff_ip'`);
  assert.equal(rows2.rows.length, 1, 'the same IP always maps to the same opaque key');
  // A different IP maps to a different digest (an unkeyed hash of an IPv4 address would still be reversible by
  // enumeration; a keyed HMAC digest is not, and this proves it is at least IP-distinguishing, not a constant).
  await platform.receiveHandoff(mint('q8-nonce-3'), { ip: '203.0.113.200' });
  const rows3 = await sql.query<{ rate_key: string }>(`SELECT DISTINCT rate_key FROM ath_rate_events WHERE bucket='handoff_ip'`);
  assert.equal(rows3.rows.length, 2);

  const store = readFileSync('lib/customer/store.ts', 'utf8');
  assert.match(store, /hitRateLimit\('handoff_ip', ctx\.ip, 30, 15 \* 60 \* 1000, \{ redactKey: true \}\)/, 'the V2 receipt IP bucket redacts');
  assert.match(store, /hitRateLimit\('claim_continue_ip', input\.ctx\.ip, 10, 15 \* 60 \* 1000, \{ redactKey: true \}\)/, 'the V2 Continue IP bucket redacts');
  // The other buckets (email, staff ids, org ids -- none of them a raw client IP) are untouched: this was
  // deliberately scoped to the V2 IP buckets only, not a general rewrite of rate-limit logging.
  assert.match(store, /hitRateLimit\('auth_link_email', email, 5, 15 \* 60 \* 1000\);/, 'unrelated buckets keep their exact prior call shape');
  assert.match(store, /customerLog\('rate_limited', opts\?\.redactKey \? \{ bucket, result: 'blocked', windowMs, max \} : \{ bucket, key \}, 'warn'\);/, 'the redacted branch logs bucket/result/coarse context only, never the raw key');
  await db.close();
});
