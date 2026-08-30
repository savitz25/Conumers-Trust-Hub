import 'server-only';
import { Pool, type PoolClient } from 'pg';
import { customerLog } from './log';
import { applyCustomerMigrations as applyMigrations, enableAppRole } from './migrate';
import type { SqlClient } from './sql';

export type { SqlClient };
export { applyMigrations as applyCustomerMigrations, enableAppRole };

let pool: Pool | null = null;

export function askDatabaseUrl(): string | undefined {
  return process.env.ASK_DATABASE_URL || undefined;
}

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = askDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      'ASK_DATABASE_URL is not set. Ask customer data must use an Ask-owned Postgres database, not ContractorTrustHub.'
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
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('ath.app_role', 'server', true)");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/row-level security|permission denied|ath.app_role/i.test(message)) {
      customerLog('db_authorization_failure', { message }, 'error');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function pingAskDatabase(): Promise<void> {
  await withAskTx(async (client) => {
    await client.query('SELECT 1');
  });
}
