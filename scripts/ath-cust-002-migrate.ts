import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { loadEnvFile } from './load-env.mjs';
import { splitSqlStatements } from '../lib/customer/migrate.ts';

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel-audit.local'));

const url = process.env.neon_tech_database || process.env.ASK_DATABASE_URL;
if (!url) {
  console.error('neon_tech_database or ASK_DATABASE_URL is required.');
  process.exit(1);
}

const connectionString = url.replace(/&?channel_binding=require/g, '');
const sql = readFileSync(join(process.cwd(), 'schema/migrations/001_ath_customer_platform.sql'), 'utf8');
const pool = new Pool({
  connectionString,
  ssl: /neon|supabase|sslmode=require|pooler/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

const client = await pool.connect();
try {
  await client.query("SELECT set_config('ath.app_role', 'server', true)");
  for (const stmt of splitSqlStatements(sql)) {
    try {
      await client.query(stmt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/pgcrypto|extension/i.test(stmt) && /already exists|not available/i.test(message)) {
        continue;
      }
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 120);
      throw new Error(`${message} :: ${preview}`);
    }
  }
  console.log('ATH-CUST-002 migrations applied to Ask Neon customer database.');
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('migration_failed', message.replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://[redacted]@'));
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
