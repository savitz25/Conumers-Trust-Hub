/**
 * ATH-CLAIM-V2-001R — migration 019 lifecycle on an ephemeral database (Section 4).
 *
 *   pre-019 fixture (legacy intent + legacy claim) → apply 019 → V2 flow → apply 019.down → legacy rows
 *   byte-identical, V2 columns gone → re-apply 019 → V2 flow again.
 *
 * Runs on in-memory PGlite only. Never touches a real database.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { enableAppRole } from './migrate.ts';
import { CustomerPlatform, ClaimError } from './store.ts';
import { mintHandoffToken } from './handoff.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord } from './types.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-claim-v2-001r-migration-secret-32-chars-min';
const CONTRACTOR: CustomerProfileRecord = { id: '11111111-1111-4111-8111-111111111111', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc015082-acme-roofing', displayName: 'Acme Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC015082', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc015082-acme-roofing' };
const directory: CustomerProfileDirectory = { async getExact(p) { return p.hub_id === 'contractor' && p.native_profile_id === CONTRACTOR.id ? CONTRACTOR : null; } };
const UP = readFileSync('schema/migrations/019_ath_claim_v2_foundation.sql', 'utf8');
const DOWN = readFileSync('schema/migrations/019_ath_claim_v2_foundation.down.sql', 'utf8');
const V2_INTENT_COLUMNS = ['intent_origin', 'acquisition_source', 'confirmed_at', 'receipt_hash'];
const V2_CLAIM_COLUMNS = ['acquisition_source', 'review_started_at', 'review_decided_at', 'evidence_ready_at_first_review', 'human_review_active_seconds'];

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(text) { await db.exec(text); } }; }
/** Same application path production tooling and the V2 suite use (whole file through exec; pgcrypto tolerated). */
async function apply(sql: SqlClient, text: string) { try { await sql.exec!(text); } catch { await sql.exec!(text.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, '')); } }
async function applyThrough018(sql: SqlClient) {
  const dir = join(process.cwd(), 'schema/migrations');
  const files = readdirSync(dir).filter((n) => /^\d+_.*\.sql$/.test(n) && !n.endsWith('.down.sql') && !n.startsWith('019_')).sort();
  for (const f of files) await apply(sql, readFileSync(join(dir, f), 'utf8'));
}
async function columns(sql: SqlClient, table: string) { return new Set((await sql.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [table])).rows.map((r) => r.column_name)); }
async function tableExists(sql: SqlClient, table: string) { return (await sql.query<{ n: string }>(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name=$1`, [table])).rows[0].n === '1'; }
function platformFor(sql: SqlClient, clock: { now: Date }) { return new CustomerPlatform({ sql, cth: directory, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: SECRET, staffEmails: ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now }); }
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }
const mint = (nonce: string) => mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: CONTRACTOR.id, slug: CONTRACTOR.slug, externalKey: CONTRACTOR.externalKey, sourceSystem: CONTRACTOR.sourceSystem, homeState: 'FL', identifierNamespace: 'credential', entityClass: 'contractor', canonicalProfileUrl: CONTRACTOR.canonicalUrl, displayName: CONTRACTOR.displayName, version: 2, now: new Date('2026-09-23T13:59:00Z'), nonce }).token;

/** Full V2 flow: explicit Continue → auth → submit → reviewer timer → human approval → active grant → revoke. */
async function v2Flow(sql: SqlClient, clock: { now: Date }, label: string) {
  const platform = platformFor(sql, clock);
  const token = mint(`${label}-nonce`);
  await platform.receiveHandoff(token);
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: `receipt-${label}-0123456789abcdef`, acquisitionSource: 'internal_test' });
  assert.equal(confirmed.created, true);
  const user = await signup(platform, `${label}-owner@acme-roofing.example`);
  const claim = await platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  await platform.startReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId, evidenceReady: true });
  clock.now = new Date(clock.now.getTime() + 5 * 60 * 1000);
  await platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', evidenceCodes: ['CORPORATE_OFFICER_MATCH', 'COMPANY_DOMAIN_CONTROL'], evidenceNote: 'Synthetic lifecycle test: independent officer record and authenticated domain control.', internalRationale: 'Synthetic lifecycle test approval on an ephemeral database.', claimantMessage: 'Synthetic lifecycle test approval message for the claimant.', reasonCategory: 'AUTHORITY_VERIFIED' });
  const timing = await platform.reviewTiming(staff.sessionToken, claim.claimId);
  assert.equal(timing.humanReviewActiveSeconds, 5 * 60); assert.equal(timing.acquisitionSource, 'internal_test'); assert.ok(timing.reviewDecidedAt);
  const grant = (await sql.query<{ id: string }>(`SELECT id FROM ath_management_grants WHERE status='active' AND granted_from_claim_id=$1`, [claim.claimId])).rows[0];
  assert.ok(grant, 'active grant');
  await platform.revokeGrant({ sessionToken: staff.sessionToken, grantId: grant.id, reason: 'Synthetic lifecycle test revocation on an ephemeral database.' });
  assert.equal(await platform.publicBusinessProfile('contractor', CONTRACTOR.id), null);
  return { claimId: claim.claimId, intentId: confirmed.intentId };
}

test('Section 4: pre-019 fixture -> apply 019 -> V2 flow -> down -> re-apply -> V2 flow; legacy rows never change', async () => {
  const db = new PGlite(); const sql = asSql(db);
  await applyThrough018(sql);
  await enableAppRole(sql);
  // --- pre-migration fixture: a legacy passive intent and a legacy claim row, exactly as production holds them.
  assert.equal((await columns(sql, 'ath_claim_intents')).has('intent_origin'), false, 'fixture is pre-019');
  await sql.query(`INSERT INTO ath_claim_intents (nonce,payload,expires_at,created_at) VALUES ('legacy-1','{"v":1,"hub_id":"contractor"}'::jsonb,'2025-01-01T00:00:00Z','2024-12-31T23:45:00Z')`);
  const legacyColumnsBefore = [...await columns(sql, 'ath_claim_intents')].sort();
  const snapshot = async () => (await sql.query<Record<string, unknown>>(`SELECT id,nonce,payload::text,expires_at::text,consumed_at,created_at::text FROM ath_claim_intents WHERE nonce='legacy-1'`)).rows[0];
  const legacyBefore = await snapshot();
  // --- pre-019 behaviour of the V2 code: the passive receipt (which reads no V2 column) still works; the durable
  //     Continue and everything after it fails closed on the missing schema instead of writing partial rows.
  const clock = { now: new Date('2026-09-23T14:00:00Z') };
  const pre = platformFor(sql, clock);
  const preToken = mint('pre-019-nonce');
  await pre.receiveHandoff(preToken);
  await assert.rejects(() => pre.confirmClaimIntent({ token: preToken, receiptId: 'receipt-pre-0123456789abcdef', acquisitionSource: 'organic' }), (e: unknown) => e instanceof ClaimError && e.code === 'schema_not_ready', 'V2 code deployed ahead of 019 must fail closed, not crash');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_intents`)).rows[0].n, '1', 'no partial write before the schema exists');

  // --- apply 019 (idempotent: twice).
  await apply(sql, UP); await apply(sql, UP);
  for (const c of V2_INTENT_COLUMNS) assert.ok((await columns(sql, 'ath_claim_intents')).has(c), c);
  for (const c of V2_CLAIM_COLUMNS) assert.ok((await columns(sql, 'ath_claims')).has(c), c);
  assert.equal(await tableExists(sql, 'ath_claim_review_sessions'), true);
  const legacyAfterUp = (await sql.query<Record<string, unknown>>(`SELECT intent_origin,acquisition_source,confirmed_at,receipt_hash FROM ath_claim_intents WHERE nonce='legacy-1'`)).rows[0];
  assert.deepEqual(legacyAfterUp, { intent_origin: 'legacy_passive', acquisition_source: 'unknown', confirmed_at: null, receipt_hash: null }, 'historical intent gets honest defaults, never an invented source');
  assert.deepEqual(await snapshot(), legacyBefore, 'historical intent columns byte-identical after up');
  // constraints are real
  await assert.rejects(() => sql.query(`UPDATE ath_claim_intents SET acquisition_source='affiliate' WHERE nonce='legacy-1'`), /check|violates/i);
  await assert.rejects(() => sql.query(`UPDATE ath_claim_intents SET intent_origin='bot' WHERE nonce='legacy-1'`), /check|violates/i);

  // --- V2 flow #1
  const first = await v2Flow(sql, clock, 'first');
  const sessions = (await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_review_sessions WHERE claim_id=$1`, [first.claimId])).rows[0].n;
  assert.equal(sessions, '1');
  // one open session per reviewer per claim is enforced by the partial unique index
  const reviewer = (await sql.query<{ id: string }>(`SELECT reviewer_user_id AS id FROM ath_claim_review_sessions LIMIT 1`)).rows[0].id;
  await sql.query(`INSERT INTO ath_claim_review_sessions (claim_id, reviewer_user_id) VALUES ($1,$2)`, [first.claimId, reviewer]);
  await assert.rejects(() => sql.query(`INSERT INTO ath_claim_review_sessions (claim_id, reviewer_user_id) VALUES ($1,$2)`, [first.claimId, reviewer]), /unique|duplicate/i);

  // --- rollback (documented data loss: V2 columns + the review-session table; nothing else)
  await apply(sql, DOWN);
  assert.equal(await tableExists(sql, 'ath_claim_review_sessions'), false);
  for (const c of V2_INTENT_COLUMNS) assert.equal((await columns(sql, 'ath_claim_intents')).has(c), false, `${c} removed`);
  for (const c of V2_CLAIM_COLUMNS) assert.equal((await columns(sql, 'ath_claims')).has(c), false, `${c} removed`);
  assert.deepEqual([...await columns(sql, 'ath_claim_intents')].sort(), legacyColumnsBefore, 'schema returns to the pre-019 column set');
  assert.deepEqual(await snapshot(), legacyBefore, 'historical intent byte-identical after down');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claims WHERE id=$1`, [first.claimId])).rows[0].n, '1', 'claims created under V2 survive rollback (only the added columns are dropped)');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_intents WHERE id=$1`, [first.intentId])).rows[0].n, '1', 'V2 intents survive rollback');

  // --- re-apply and run the flow again
  await apply(sql, UP);
  assert.equal((await sql.query<{ o: string }>(`SELECT intent_origin AS o FROM ath_claim_intents WHERE id=$1`, [first.intentId])).rows[0].o, 'legacy_passive', 'after a rollback the re-applied default is honest: origin of pre-existing rows is unknown, so legacy_passive');
  await v2Flow(sql, clock, 'second');
  assert.deepEqual(await snapshot(), legacyBefore, 'historical intent byte-identical after re-apply and a second V2 flow');
  await db.close();
});
