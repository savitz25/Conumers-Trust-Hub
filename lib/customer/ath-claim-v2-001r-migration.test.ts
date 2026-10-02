/**
 * ATH-CLAIM-V2-001R — migration 019 lifecycle on an ephemeral database (Section 4).
 *
 *   pre-019 fixture (legacy intent + legacy claim) → apply 019 → V2 flow → apply 019.down → legacy rows
 *   byte-identical, V2 columns gone → re-apply 019 → V2 flow again.
 *
 * Runs on in-memory PGlite always. ATH-CLAIM-V2-001R4 (Section 5) also runs the identical lifecycle on a REAL
 * isolated Postgres when ATH_019_REAL_PG_URL points at a localhost server (a throwaway database is created and
 * dropped); any non-localhost URL is refused. Never touches a shared or production database.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
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
const V2_CLAIM_COLUMNS = ['acquisition_source', 'review_started_at', 'review_decided_at', 'evidence_ready_at_first_review', 'human_review_active_seconds', 'needs_info_entered_at', 'needs_info_paused_business_hours'];

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

const LEGACY_CLAIM_SNAPSHOT = `SELECT id,org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email,attestation::text,submitted_at::text,reviewed_at,decision_reason,created_at::text,updated_at::text FROM ath_claims WHERE id='c1a10000-0000-4000-8000-000000000019'`;
/** A pre-019 submitted claim exactly as production holds them (the two historical Contractor claims are this shape). */
async function insertLegacyClaim(sql: SqlClient) {
  await sql.query(`INSERT INTO ath_users (id,email,email_normalized,status) VALUES ('a1a10000-0000-4000-8000-000000000019','legacy-owner@example.test','legacy-owner@example.test','active')`);
  await sql.query(`INSERT INTO ath_organizations (id,display_name) VALUES ('b1a10000-0000-4000-8000-000000000019','Legacy Org 019')`);
  await sql.query(`INSERT INTO ath_hub_profiles (id,hub_id,native_profile_id,native_slug,native_credential_key,native_source_system,home_state,display_name_snapshot) VALUES ('d1a10000-0000-4000-8000-000000000019','contractor','44444444-4444-4444-8444-444444444444','legacy-roofing','CBC000019','fl_dbpr','FL','Legacy Roofing')`);
  await sql.query(`INSERT INTO ath_claims (id,org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email,submitted_at,created_at,updated_at) VALUES ('c1a10000-0000-4000-8000-000000000019','b1a10000-0000-4000-8000-000000000019','d1a10000-0000-4000-8000-000000000019','a1a10000-0000-4000-8000-000000000019','submitted','manual_review','owner',false,'2026-09-10T15:00:00Z','2026-09-10T15:00:00Z','2026-09-10T15:00:00Z')`);
}

async function lifecycle(sql: SqlClient) {
  await applyThrough018(sql);
  await enableAppRole(sql);
  // --- pre-migration fixture: a legacy passive intent and a legacy claim row, exactly as production holds them.
  assert.equal((await columns(sql, 'ath_claim_intents')).has('intent_origin'), false, 'fixture is pre-019');
  await sql.query(`INSERT INTO ath_claim_intents (nonce,payload,expires_at,created_at) VALUES ('legacy-1','{"v":1,"hub_id":"contractor"}'::jsonb,'2025-01-01T00:00:00Z','2024-12-31T23:45:00Z')`);
  const legacyColumnsBefore = [...await columns(sql, 'ath_claim_intents')].sort();
  const snapshot = async () => (await sql.query<Record<string, unknown>>(`SELECT id,nonce,payload::text,expires_at::text,consumed_at,created_at::text FROM ath_claim_intents WHERE nonce='legacy-1'`)).rows[0];
  const legacyBefore = await snapshot();
  await insertLegacyClaim(sql);
  const legacyClaimBefore = (await sql.query<Record<string, unknown>>(LEGACY_CLAIM_SNAPSHOT)).rows[0];
  assert.ok(legacyClaimBefore, 'pre-019 legacy submitted claim fixture');
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
  // Existing claims stay valid with honest V2 defaults: unknown source, no review timestamps, no fake clock.
  const legacyClaimV2 = (await sql.query<Record<string, unknown>>(`SELECT acquisition_source,review_started_at,review_decided_at,evidence_ready_at_first_review,human_review_active_seconds,needs_info_entered_at,needs_info_paused_business_hours::text AS paused FROM ath_claims WHERE id='c1a10000-0000-4000-8000-000000000019'`)).rows[0];
  assert.deepEqual(legacyClaimV2, { acquisition_source: 'unknown', review_started_at: null, review_decided_at: null, evidence_ready_at_first_review: null, human_review_active_seconds: 0, needs_info_entered_at: null, paused: '0' });
  assert.deepEqual((await sql.query<Record<string, unknown>>(LEGACY_CLAIM_SNAPSHOT)).rows[0], legacyClaimBefore, 'legacy claim byte-identical after up');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claims WHERE acquisition_source<>'unknown'`)).rows[0].n, '0', 'no fake source attribution on historical claims');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_intents WHERE acquisition_source<>'unknown' OR intent_origin<>'legacy_passive'`)).rows[0].n, '0', 'no fake source/origin on historical intents');
  // constraints are real
  await assert.rejects(() => sql.query(`UPDATE ath_claim_intents SET acquisition_source='affiliate' WHERE nonce='legacy-1'`), /check|violates/i);
  await assert.rejects(() => sql.query(`UPDATE ath_claim_intents SET intent_origin='bot' WHERE nonce='legacy-1'`), /check|violates/i);

  // --- V2 flow #1
  const first = await v2Flow(sql, clock, 'first');
  const sessions = (await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_review_sessions WHERE claim_id=$1`, [first.claimId])).rows[0].n;
  assert.equal(sessions, '1');
  // Q7: ONE open session TOTAL per claim (not per reviewer) is enforced by the partial unique index.
  const reviewer = (await sql.query<{ id: string }>(`SELECT reviewer_user_id AS id FROM ath_claim_review_sessions LIMIT 1`)).rows[0].id;
  const otherUser = (await sql.query<{ id: string }>(`SELECT id FROM ath_users WHERE email_normalized=$1`, [`first-owner@acme-roofing.example`])).rows[0].id;
  await sql.query(`INSERT INTO ath_claim_review_sessions (claim_id, reviewer_user_id) VALUES ($1,$2)`, [first.claimId, reviewer]);
  await assert.rejects(() => sql.query(`INSERT INTO ath_claim_review_sessions (claim_id, reviewer_user_id) VALUES ($1,$2)`, [first.claimId, reviewer]), /unique|duplicate/i, 'same reviewer, same claim: blocked');
  await assert.rejects(() => sql.query(`INSERT INTO ath_claim_review_sessions (claim_id, reviewer_user_id) VALUES ($1,$2)`, [first.claimId, otherUser]), /unique|duplicate/i, 'Q7: a DIFFERENT reviewer is also blocked while any session on this claim is open');
  await sql.query(`UPDATE ath_claim_review_sessions SET ended_at=now() WHERE claim_id=$1 AND ended_at IS NULL`, [first.claimId]);

  // --- rollback (documented data loss: V2 columns + the review-session table; nothing else)
  await apply(sql, DOWN);
  assert.equal(await tableExists(sql, 'ath_claim_review_sessions'), false);
  for (const c of V2_INTENT_COLUMNS) assert.equal((await columns(sql, 'ath_claim_intents')).has(c), false, `${c} removed`);
  for (const c of V2_CLAIM_COLUMNS) assert.equal((await columns(sql, 'ath_claims')).has(c), false, `${c} removed`);
  assert.deepEqual([...await columns(sql, 'ath_claim_intents')].sort(), legacyColumnsBefore, 'schema returns to the pre-019 column set');
  assert.deepEqual(await snapshot(), legacyBefore, 'historical intent byte-identical after down');
  assert.deepEqual((await sql.query<Record<string, unknown>>(LEGACY_CLAIM_SNAPSHOT)).rows[0], legacyClaimBefore, 'legacy claim byte-identical after down');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claims WHERE id=$1`, [first.claimId])).rows[0].n, '1', 'claims created under V2 survive rollback (only the added columns are dropped)');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_intents WHERE id=$1`, [first.intentId])).rows[0].n, '1', 'V2 intents survive rollback');

  // --- re-apply and run the flow again
  await apply(sql, UP);
  assert.equal((await sql.query<{ o: string }>(`SELECT intent_origin AS o FROM ath_claim_intents WHERE id=$1`, [first.intentId])).rows[0].o, 'legacy_passive', 'after a rollback the re-applied default is honest: origin of pre-existing rows is unknown, so legacy_passive');
  await v2Flow(sql, clock, 'second');
  assert.deepEqual(await snapshot(), legacyBefore, 'historical intent byte-identical after re-apply and a second V2 flow');
  assert.deepEqual((await sql.query<Record<string, unknown>>(LEGACY_CLAIM_SNAPSHOT)).rows[0], legacyClaimBefore, 'legacy claim byte-identical after re-apply and a second V2 flow');
  assert.equal((await sql.query<{ s: string }>(`SELECT acquisition_source AS s FROM ath_claims WHERE id='c1a10000-0000-4000-8000-000000000019'`)).rows[0].s, 'unknown');
  assert.equal((await sql.query<{ n: string }>(`SELECT count(*)::text n FROM pg_indexes WHERE indexname='ath_claim_review_sessions_one_open_per_claim'`)).rows[0].n, '1', 'exactly one one-open-session index after re-apply');
}

test('Section 4: pre-019 fixture -> apply 019 -> V2 flow -> down -> re-apply -> V2 flow; legacy rows never change', async () => {
  const db = new PGlite();
  await lifecycle(asSql(db));
  await db.close();
});

const REAL_PG = process.env.ATH_019_REAL_PG_URL;
test('R4 Section 5: the same lifecycle on a REAL isolated Postgres (throwaway database)', { skip: REAL_PG ? false : 'set ATH_019_REAL_PG_URL=postgres://user@127.0.0.1:<port>/postgres to run' }, async () => {
  const admin = new URL(REAL_PG!);
  assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(admin.hostname), 'refusing a non-localhost database');
  const dbName = `ath019_r4_${Date.now()}`;
  const adminClient = new pg.Client({ connectionString: admin.toString() });
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE ${dbName}`);
  const target = new URL(admin.toString()); target.pathname = `/${dbName}`;
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  try {
    const version = (await client.query<{ v: string }>(`SELECT current_setting('server_version') AS v`)).rows[0].v;
    assert.ok(Number(version.split('.')[0]) >= 14, `real Postgres ${version}`);
    const sql: SqlClient = { async query(text, params) { const r = await client.query(text, params ?? []); return { rows: r.rows as Record<string, unknown>[] }; }, async exec(text) { await client.query(text); } };
    await lifecycle(sql);
  } finally {
    await client.end();
    await adminClient.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await adminClient.end();
  }
});

test('R4 Section 6: narrow 019 apply path — verify absent, rehearse rolls back, apply commits + verifies, idempotent, hash-pinned', async () => {
  const { verify019, run019, read019, MIGRATION_019_SHA256 } = await import('../../scripts/claim-v2-019-apply.ts');
  assert.equal(read019().sha256, MIGRATION_019_SHA256, 'committed 019 matches the certified hash');
  const db = new PGlite(); const sql = asSql(db);
  await applyThrough018(sql);
  const db019 = { query: async (t: string, p?: unknown[]) => ({ rows: (await db.query(t, p ?? [])).rows as Record<string, unknown>[] }), exec: async (t: string) => { await db.exec(t); } };
  assert.equal((await verify019(db019)).absent, true);
  const rehearsal = await run019(db019, 'rehearse');
  assert.equal(rehearsal.after.complete, true); assert.equal(rehearsal.committed, false);
  assert.equal((await verify019(db019)).absent, true, 'rehearsal leaves no change');
  const applied = await run019(db019, 'apply');
  assert.equal(applied.committed, true); assert.equal((await verify019(db019)).complete, true);
  const again = await run019(db019, 'apply');
  assert.equal(again.before.complete, true); assert.equal(again.after.complete, true, 'idempotent');
  const script = readFileSync('scripts/claim-v2-019-apply.ts', 'utf8');
  assert.match(script, /SET LOCAL lock_timeout = '3s'/); assert.match(script, /--confirm=APPLY-019-/);
  await db.close();
});
