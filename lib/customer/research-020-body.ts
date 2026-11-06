import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Certified LF bytes of schema/migrations/020_ath_research_service_inquiries.sql. */
export const MIGRATION_020_SHA256 = '1fb96942b48049581cc07e6596c04709c78ad376dbba0a369accd532cf60b1c4';
export const MIGRATION_020_BYTES = 4544;
export const MIGRATION_020_CONFIRM = `APPLY-020-${MIGRATION_020_SHA256.slice(0, 12)}`;

export const MIGRATION_020_PATH = join(process.cwd(), 'schema/migrations/020_ath_research_service_inquiries.sql');

export type Migration020Client = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  /** One simple query, with no bind parameters. */
  exec(sql: string): Promise<void>;
};

export type Migration020Mode = 'verify' | 'rehearse' | 'apply';

export type Migration020State = {
  present: boolean;
  rls: boolean;
  forced: boolean;
  trigger: boolean;
  policy: boolean;
  fingerprintIndex: boolean;
  notificationIndex: boolean;
  noBrowserGrants: boolean;
  complete: boolean;
  absent: boolean;
};

export type Migration020Result = {
  state: Migration020State;
  executed: boolean;
  committed: boolean;
};

const VERIFY_SQL = `SELECT
  (to_regclass('public.ath_research_service_inquiries') IS NOT NULL) AS present,
  COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.ath_research_service_inquiries')), false) AS rls,
  COALESCE((SELECT c.relforcerowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.ath_research_service_inquiries')), false) AS forced,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ath_research_service_inquiries_updated_at') AS updated_at_trigger,
  EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'ath_server_all'
      AND polrelid = to_regclass('public.ath_research_service_inquiries')
  ) AS server_policy,
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ath_research_service_inquiries_fingerprint_idx') AS fingerprint_idx,
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ath_research_service_inquiries_notification_idx') AS notification_idx,
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'ath_research_service_inquiries'
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  ) AS no_browser_grants`;

export function readMigration020(sql: string): { sql: string; sha256: string } {
  const normalized = sql.replace(/\r\n/g, '\n');
  return { sql: normalized, sha256: createHash('sha256').update(normalized).digest('hex') };
}

export function certifiedMigration020(sql: string): string {
  const read = readMigration020(sql);
  if (read.sha256 !== MIGRATION_020_SHA256 || Buffer.byteLength(read.sql) !== MIGRATION_020_BYTES) {
    throw new Error(`020 file hash ${read.sha256} does not match the certified ${MIGRATION_020_SHA256}`);
  }
  return read.sql;
}

export function readMigration020File(): { sql: string; sha256: string } {
  const sql = certifiedMigration020(readFileSync(MIGRATION_020_PATH, 'utf8'));
  return { sql, sha256: MIGRATION_020_SHA256 };
}

/** Host only. The pooled Neon host cannot take this multi-statement body. */
export function databaseHost(url: string): string {
  const match = /^postgres(?:ql)?:\/\/(?:[^@/?#]+@)?([^/?#]+)/i.exec(url.trim());
  const host = match?.[1]?.replace(/:\d+$/, '').toLowerCase() ?? '';
  if (!host) throw new Error('020 target URL is not a direct database host');
  return host;
}

export function assertDirectDatabaseUrl(url: string): string {
  const host = databaseHost(url);
  if (host.includes('pooler')) throw new Error('020 requires the Neon direct connection');
  return host;
}

function flag(value: unknown): boolean {
  return value === true;
}

function stateFrom(row: Record<string, unknown>): Migration020State {
  const present = flag(row.present);
  const rls = flag(row.rls);
  const forced = flag(row.forced);
  const trigger = flag(row.updated_at_trigger);
  const policy = flag(row.server_policy);
  const fingerprintIndex = flag(row.fingerprint_idx);
  const notificationIndex = flag(row.notification_idx);
  const noBrowserGrants = flag(row.no_browser_grants);
  const complete = present && rls && forced && trigger && policy && fingerprintIndex && notificationIndex && noBrowserGrants;
  const absent = !present && !trigger && !policy && !fingerprintIndex && !notificationIndex;
  return { present, rls, forced, trigger, policy, fingerprintIndex, notificationIndex, noBrowserGrants, complete, absent };
}

async function verifyMigration020(client: Migration020Client): Promise<Migration020State> {
  const result = await client.query(VERIFY_SQL);
  const row = result.rows[0];
  if (!row) throw new Error('020 verification returned no row');
  return stateFrom(row);
}

/**
 * Sends the certified 020 file as one SQL body.
 * A complete schema is left unchanged. A partial schema is not repaired.
 * rehearse rolls back. apply commits only when the file was executed and the
 * following read matches the expected schema.
 */
export async function runMigration020(
  client: Migration020Client,
  mode: Migration020Mode,
  fileSql: string,
): Promise<Migration020Result> {
  const body = certifiedMigration020(fileSql);
  if (mode === 'verify') {
    return { state: await verifyMigration020(client), executed: false, committed: false };
  }

  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL lock_timeout = '3s'`);
    await client.query(`SET LOCAL statement_timeout = '60s'`);
    const before = await verifyMigration020(client);
    if (before.complete) {
      await client.query('ROLLBACK');
      return { state: before, executed: false, committed: false };
    }
    if (!before.absent) throw new Error('020 schema is partial; this path does not repair a drifted table');
    await client.exec(body);
    const after = await verifyMigration020(client);
    if (!after.complete) throw new Error('020 verification failed after the body was sent');
    if (mode === 'apply') {
      await client.query('COMMIT');
      return { state: after, executed: true, committed: true };
    }
    await client.query('ROLLBACK');
    return { state: after, executed: true, committed: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
