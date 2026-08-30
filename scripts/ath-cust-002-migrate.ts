import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { loadEnvFile } from './load-env.mjs';

loadEnvFile(join(process.cwd(), '.env.local'));

const url = process.env.ASK_DATABASE_URL;
if (!url) {
  console.error('ASK_DATABASE_URL is required to apply Ask customer migrations.');
  process.exit(1);
}

const sql = readFileSync(join(process.cwd(), 'schema/migrations/001_ath_customer_platform.sql'), 'utf8');
const pool = new Pool({
  connectionString: url,
  ssl: /supabase|neon|sslmode=require|pooler/i.test(url) ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('ath.app_role', 'server', true)");
  await client.query(sql);
  await client.query('COMMIT');
  console.log('ATH-CUST-002 migrations applied.');
} catch (err) {
  await client.query('ROLLBACK');
  console.error(err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
