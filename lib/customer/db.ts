import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { customerLog } from './log';
import { applyCustomerMigrations as applyMigrations, enableAppRole } from './migrate';
import type { SqlClient } from './sql';
import { selectAskDatabaseUrl } from './database-selection';
import { withDeferredPublicReadInvalidation } from './public-read-invalidate';
import { runTransaction } from './db-tx';
import { DbUnavailableError } from './db-unavailable';
import * as Sentry from '@sentry/nextjs';

export { DbUnavailableError, isDbUnavailableError, serviceUnavailableResponse } from './db-unavailable';

export type { SqlClient };
export { applyMigrations as applyCustomerMigrations, enableAppRole };

let pool: Pool | null = null;

export function askDatabaseUrl(): string | undefined {
  return selectAskDatabaseUrl(process.env);
}

export { selectAskDatabaseUrl };

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = askDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      'Ask customer database is not configured. Set neon_tech_database or ASK_DATABASE_URL to the Ask-owned Neon Postgres URL. Do not use ContractorTrustHub DATABASE_URL.'
    );
  }
  const needsSsl =
    /supabase|neon|sslmode=require|amazonaws|pooler/i.test(connectionString) ||
    process.env.PGSSLMODE === 'require' ||
    process.env.VERCEL === '1';
  pool = new Pool({
    connectionString,
    max: process.env.VERCEL ? 1 : 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 12_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  pool.on('error', (err) => {
    customerLog('db_idle_error', { message: err.message }, 'error');
  });
  return pool;
}

export async function withAskTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withDeferredPublicReadInvalidation(() => runAskTx(fn));
}

/**
 * ATH-SENTRY-P2 — one bounded Sentry signal per instance per minute for expected availability failures
 * (fingerprinted so an outage is one issue, not thousands), plus one structured log line per failed
 * transaction. Neither carries the provider message, host, URL or SQL. Unexpected DB errors are untouched:
 * they still propagate raw to the caller and to Sentry's request-error capture as before.
 */
const DB_UNAVAILABLE_SENTRY_INTERVAL_MS = 60_000;
let lastDbUnavailableSignalAt = 0;

function signalDbUnavailable(error: DbUnavailableError): void {
  customerLog('db_unavailable', { reason: error.reason, sqlstate: error.sqlstate, errno: error.errno, phase: error.phase }, 'error');
  const now = Date.now();
  if (now - lastDbUnavailableSignalAt < DB_UNAVAILABLE_SENTRY_INTERVAL_MS) return;
  lastDbUnavailableSignalAt = now;
  try {
    Sentry.captureMessage('db_unavailable', { level: 'warning', fingerprint: ['db_unavailable'], tags: { db_reason: error.reason, db_phase: error.phase, db_sqlstate: error.sqlstate ?? 'none' } });
  } catch { /* observability must never change the failure */ }
}

/** Test seam only: resets the Sentry throttle window. */
export function __resetDbUnavailableSignalForTests(): void { lastDbUnavailableSignalAt = 0; }

async function runAskTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return runTransaction(getPool(), (client) => fn(client as PoolClient), {
    onUnavailable: signalDbUnavailable,
    onAuthorizationFailure: (message) => customerLog('db_authorization_failure', { message }, 'error'),
  });
}

export async function pingAskDatabase(): Promise<void> {
  await withAskTx(async (client) => {
    await client.query('SELECT 1');
  });
}
