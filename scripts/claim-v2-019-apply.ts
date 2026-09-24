/**
 * ATH-CLAIM-V2-001R4 — narrow, single-file apply/verify path for migration 019 ONLY.
 *
 * Do NOT use the broad `applyCustomerMigrations` replay (non-transactional, every file) for the Production 019
 * rollout. This script touches exactly one file, inside one transaction, with a short lock timeout, and verifies
 * the resulting schema before COMMIT. Founder-executed; nothing in the ticket that introduced it ran it against
 * Production.
 *
 *   ATH_019_TARGET_URL=postgres://… node --experimental-strip-types scripts/claim-v2-019-apply.ts verify
 *   ATH_019_TARGET_URL=postgres://… node --experimental-strip-types scripts/claim-v2-019-apply.ts rehearse
 *   ATH_019_TARGET_URL=postgres://… node --experimental-strip-types scripts/claim-v2-019-apply.ts apply --confirm=APPLY-019-<sha12>
 *
 * verify   : read-only schema check (exit 0 = 019 fully present, 3 = not applied, 4 = partial / drifted).
 * rehearse : BEGIN → lock_timeout 3s → apply 019 → verify → ROLLBACK (proves it applies; leaves no change).
 * apply    : same, then COMMIT. Requires --confirm=APPLY-019-<first 12 hex of the file's sha256>.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MIGRATION_019_PATH = join(process.cwd(), 'schema/migrations/019_ath_claim_v2_foundation.sql');
/** sha256 of the committed (LF) file; a CRLF checkout is normalised before hashing. */
export const MIGRATION_019_SHA256 = 'a82b9e5b58fda527edbafb5592155f6ed38b99821f816319fb6506756d7a5475';

export type Db019 = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Multi-statement execution (pg simple query / PGlite exec). */
  exec(text: string): Promise<void>;
};

export type Verify019 = {
  intentColumns: number; claimColumns: number; reviewSessions: boolean; oneOpenIndex: boolean;
  checks: number; rlsForced: boolean; complete: boolean; absent: boolean;
};

export function read019(): { sql: string; sha256: string } {
  const sql = readFileSync(MIGRATION_019_PATH, 'utf8').replace(/\r\n/g, '\n');
  return { sql, sha256: createHash('sha256').update(sql).digest('hex') };
}

export async function verify019(db: Db019): Promise<Verify019> {
  const row = (await db.query<Record<string, unknown>>(`SELECT
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name='ath_claim_intents' AND column_name IN ('intent_origin','acquisition_source','confirmed_at','receipt_hash')) AS intent_columns,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_name='ath_claims' AND column_name IN ('acquisition_source','review_started_at','review_decided_at','evidence_ready_at_first_review','human_review_active_seconds','needs_info_entered_at','needs_info_paused_business_hours')) AS claim_columns,
    (to_regclass('public.ath_claim_review_sessions') IS NOT NULL) AS review_sessions,
    EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ath_claim_review_sessions_one_open_per_claim') AS one_open_index,
    (SELECT count(*)::int FROM pg_constraint WHERE conname IN ('ath_claim_intents_origin_check','ath_claim_intents_source_check','ath_claims_acquisition_source_check','ath_claims_human_review_seconds_check','ath_claims_needs_info_paused_check')) AS checks,
    COALESCE((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.ath_claim_review_sessions')), false) AS rls_forced`)).rows[0];
  const v = {
    intentColumns: Number(row.intent_columns), claimColumns: Number(row.claim_columns), reviewSessions: row.review_sessions === true,
    oneOpenIndex: row.one_open_index === true, checks: Number(row.checks), rlsForced: row.rls_forced === true,
  };
  const complete = v.intentColumns === 4 && v.claimColumns === 7 && v.reviewSessions && v.oneOpenIndex && v.checks === 5 && v.rlsForced;
  const absent = v.intentColumns === 0 && v.claimColumns === 0 && !v.reviewSessions && !v.oneOpenIndex && v.checks === 0;
  return { ...v, complete, absent };
}

export async function run019(db: Db019, mode: 'rehearse' | 'apply'): Promise<{ before: Verify019; after: Verify019; committed: boolean }> {
  const { sql, sha256 } = read019();
  if (sha256 !== MIGRATION_019_SHA256) throw new Error(`019 file hash ${sha256} does not match the certified ${MIGRATION_019_SHA256}`);
  await db.query('BEGIN');
  try {
    await db.query(`SET LOCAL lock_timeout = '3s'`);
    await db.query(`SET LOCAL statement_timeout = '60s'`);
    const before = await verify019(db);
    await db.exec(sql);
    const after = await verify019(db);
    if (!after.complete) throw new Error(`019 verification failed after apply: ${JSON.stringify(after)}`);
    if (mode === 'apply') { await db.query('COMMIT'); return { before, after, committed: true }; }
    await db.query('ROLLBACK');
    return { before, after, committed: false };
  } catch (e) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw e;
  }
}

async function main() {
  const [mode, ...flags] = process.argv.slice(2);
  const url = process.env.ATH_019_TARGET_URL || '';
  if (!url) throw new Error('ATH_019_TARGET_URL is required');
  if (!['verify', 'rehearse', 'apply'].includes(mode)) throw new Error('usage: verify | rehearse | apply --confirm=APPLY-019-<sha12>');
  const { sha256 } = read019();
  if (mode === 'apply' && !flags.includes(`--confirm=APPLY-019-${sha256.slice(0, 12)}`)) {
    throw new Error(`apply requires --confirm=APPLY-019-${sha256.slice(0, 12)}`);
  }
  const { default: pg } = await import('pg');
  const needsSsl = /supabase|neon|sslmode=require|amazonaws|pooler/i.test(url);
  const client = new pg.Client({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const db: Db019 = { query: async (t, p) => ({ rows: (await client.query(t, p ?? [])).rows }), exec: async (t) => { await client.query(t); } };
  try {
    if (mode === 'verify') {
      const v = await verify019(db);
      console.log(JSON.stringify({ mode, sha256, ...v }));
      process.exitCode = v.complete ? 0 : v.absent ? 3 : 4;
      return;
    }
    const r = await run019(db, mode as 'rehearse' | 'apply');
    console.log(JSON.stringify({ mode, sha256, committed: r.committed, before: r.before, after: r.after }));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && /claim-v2-019-apply\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
