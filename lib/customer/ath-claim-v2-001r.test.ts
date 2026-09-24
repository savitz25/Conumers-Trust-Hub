/**
 * ATH-CLAIM-V2-001R — reconciliation hardening on top of the V2 foundation.
 *   - multi-tab receipt binding for the explicit Continue
 *   - auth return after the handoff/intent expired fails closed to recovery, never to a stale intent
 *   - readiness levels describe reality (an un-run real-owner canary is IMPLEMENTED, not CERTIFIED)
 *   - the schema guard is wired into every V2 write path
 * PGlite only. No production connection.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform } from './store.ts';
import { mintHandoffToken } from './handoff.ts';
import { receiptMatchesConfirmation } from './claim-receipt.ts';
import { claimAcceptErrorCode } from './auth-error-code.ts';
import { sixHubReadinessReport } from './claim-v2-readiness.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord } from './types.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-claim-v2-001r-handoff-secret-32-characters-min';
const CONTRACTOR: CustomerProfileRecord = { id: '11111111-1111-4111-8111-111111111111', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc015082-acme-roofing', displayName: 'Acme Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC015082', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc015082-acme-roofing' };
const directory: CustomerProfileDirectory = { async getExact(p) { return p.hub_id === 'contractor' && p.native_profile_id === CONTRACTOR.id ? CONTRACTOR : null; } };
function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: new Date('2026-09-23T14:00:00Z') };
  const platform = new CustomerPlatform({ sql, cth: directory, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: SECRET, staffEmails: ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  return { db, sql, platform, clock };
}
const mint = (nonce: string, now = new Date('2026-09-23T13:59:00Z')) => mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: CONTRACTOR.id, slug: CONTRACTOR.slug, externalKey: CONTRACTOR.externalKey, sourceSystem: CONTRACTOR.sourceSystem, homeState: 'FL', identifierNamespace: 'credential', entityClass: 'contractor', canonicalProfileUrl: CONTRACTOR.canonicalUrl, displayName: CONTRACTOR.displayName, version: 2, now, nonce }).token;
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }

test('multi-tab: the Continue form is bound to the receipt it rendered; a stale tab cannot confirm a newer receipt', () => {
  const current = { token: 'a.b', receiptId: 'r'.repeat(24), source: 'organic' as const, receivedAt: 1 };
  assert.equal(receiptMatchesConfirmation(current, 'r'.repeat(24)), true);
  assert.equal(receiptMatchesConfirmation(current, 's'.repeat(24)), false, 'a different receipt id (an older tab) does not confirm');
  assert.equal(receiptMatchesConfirmation(current, undefined), false, 'a form without the binding never confirms');
  assert.equal(receiptMatchesConfirmation(current, ''), false);
  assert.equal(receiptMatchesConfirmation(null, 'r'.repeat(24)), false, 'no receipt in the browser never confirms');
  const route = readFileSync('app/api/customer/claim/confirm/route.ts', 'utf8');
  assert.match(route, /receiptMatchesConfirmation\(receipt, form\?\.get\('confirmation'\)\)/);
  assert.match(route, /receipt_mismatch/);
  const form = readFileSync('app/claim/continue/claim-continue-confirm.tsx', 'utf8');
  assert.match(form, /<input type="hidden" name="confirmation" value=\{confirmationKey\} \/>/);
  const page = readFileSync('app/claim/continue/page.tsx', 'utf8');
  assert.match(page, /confirmationKey=\{receipt!\.receiptId\}/);
});

test('auth return after expiration: an expired token cannot be confirmed and an expired intent renders recovery, never a stale identity', async () => {
  const { db, sql, platform, clock } = await boot();
  const token = mint('expiry-nonce');
  await platform.receiveHandoff(token);
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: 'receipt-expiry-0123456789abcdef', acquisitionSource: 'organic' });
  assert.ok(await platform.intentPreview(confirmed.intentId));
  // ATH-CLAIM-V2-001R4 (#11): after an explicit Continue the durable intent lives 60 min from Continue, so a
  // return at +16 min (past the 15-min handoff token) is still valid...
  clock.now = new Date(clock.now.getTime() + 16 * 60 * 1000);
  assert.ok(await platform.intentPreview(confirmed.intentId), 'intent survives the 15-min token inside the continuation window');
  // ...but it is bounded: past the continuation window the intent is expired and fails closed.
  clock.now = new Date(clock.now.getTime() + 45 * 60 * 1000);
  assert.equal(await platform.intentPreview(confirmed.intentId), null, 'expired intent is not previewed');
  const user = await signup(platform, 'owner@acme-roofing.example');
  await assert.rejects(() => platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true }), (e: unknown) => e instanceof Error && /expired|missing_intent/.test((e as { code?: string }).code ?? e.message));
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claims`)).rows[0].n, '0');
  // Pressing Continue again with the expired receipt/token fails closed too.
  await assert.rejects(() => platform.confirmClaimIntent({ token, receiptId: 'receipt-expiry-0123456789abcdef', acquisitionSource: 'organic' }), (e: unknown) => (e as { code?: string }).code === 'expired');
  assert.equal(claimAcceptErrorCode('expired'), 'HANDOFF_EXPIRED');
  assert.equal(claimAcceptErrorCode('schema_not_ready'), 'SPECIALIST_VALIDATION_UNAVAILABLE', 'code ahead of schema is a bounded, retryable recovery state');
  await db.close();
});

test('readiness: Contractor R8 is IMPLEMENTED (pending a real owner canary), never CERTIFIED by fiat; CANARY stays the ceiling', () => {
  const contractor = sixHubReadinessReport().find((r) => r.hub === 'contractor')!;
  assert.equal(contractor.requirements.R8_REAL_OWNER_CANARY.level, 'IMPLEMENTED');
  assert.equal(contractor.requirements.R9_REVIEW_CAPACITY.level, 'IMPLEMENTED');
  assert.equal(contractor.recommendedRolloutState, 'CANARY');
  assert.deepEqual(contractor.blocking, ['R8_REAL_OWNER_CANARY', 'R9_REVIEW_CAPACITY']);
});

test('schema guard is wired into every V2 write path and the queue snapshot', () => {
  const store = readFileSync('lib/customer/store.ts', 'utf8');
  for (const fn of ['async confirmClaimIntent(', 'async intentPreview(', 'async startReviewSession(', 'async stopReviewSession(', 'async reviewTiming(', 'async reviewQueueReminders(', 'private async stampReviewTiming(', 'async launchOpsSnapshot(']) {
    const at = store.indexOf(fn);
    assert.ok(at > 0, fn);
    const body = store.slice(at, at + 900);
    // R4 (#7): stampReviewTiming guards with the non-throwing probe so a pre-019 staff decision degrades to legacy
    // mode instead of failing; every other V2 path still fails closed.
    const guard = fn === 'private async stampReviewTiming(' ? /claimV2SchemaReady\(\)/ : /assertClaimV2Schema\(\)/;
    assert.match(body, guard, `${fn} guards on migration 019`);
  }
});
