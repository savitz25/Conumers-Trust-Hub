import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { loadEnvFile } from './load-env.mjs';
import type { SqlClient } from '../lib/customer/sql.ts';
import { listResearchInquiries, retryResearchInquiryNotifications } from '../lib/research-services/operator.ts';
import { createInquiryMailer } from '../lib/research-services/notify.ts';

if (process.env.RESEARCH_SERVICES_OPERATOR !== '1') {
  console.error('Set RESEARCH_SERVICES_OPERATOR=1 before listing or retrying inquiries. The list command prints personal information in this terminal.');
  process.exit(1);
}

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel-audit.local'));

const url = process.env.neon_tech_database || process.env.ASK_DATABASE_URL;
if (!url) {
  console.error('neon_tech_database or ASK_DATABASE_URL is required.');
  process.exit(1);
}

const command = process.argv.includes('retry') ? 'retry' : 'list';
const send = process.argv.includes('--send');
const connectionString = url.replace(/&?channel_binding=require/g, '');
const pool = new Pool({
  connectionString,
  max: 1,
  ssl: /neon|supabase|sslmode=require|pooler/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

async function transaction<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('ath.app_role', 'server', true)");
    const result = await fn(asSql(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

function asSql(client: PoolClient): SqlClient {
  return {
    async query<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return { rows: result.rows as T[] };
    },
  };
}

function redact(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[redacted]@');
}

try {
  if (command === 'list') {
    const statusArg = process.argv.find((arg) => arg.startsWith('--status='))?.slice('--status='.length);
    const status = statusArg === 'pending' || statusArg === 'sending' || statusArg === 'sent' || statusArg === 'failed' ? statusArg : undefined;
    const rows = await transaction((sql) => listResearchInquiries(sql, { status }));
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  } else {
    const results = await retryResearchInquiryNotifications({
      transaction,
      mailer: createInquiryMailer(process.env),
      now: () => new Date(),
      send,
    });
    process.stdout.write(`${JSON.stringify({ send, inboxDeliveryVerified: false, results }, null, 2)}\n`);
  }
} catch (error) {
  console.error('research_inquiries_failed', redact(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
