import { join } from 'node:path';
import { Pool } from 'pg';
import { loadEnvFile } from './load-env.mjs';
import { applyCustomerMigrations } from '../lib/customer/migrate.ts';

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel-audit.local'));

const url = process.env.neon_tech_database || process.env.ASK_DATABASE_URL;
if (!url) {
  console.error('neon_tech_database or ASK_DATABASE_URL is required.');
  process.exit(1);
}

const connectionString = url.replace(/&?channel_binding=require/g, '');
const pool = new Pool({
  connectionString,
  ssl: /neon|supabase|sslmode=require|pooler/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

const client = await pool.connect();
try {
  await client.query("SELECT set_config('ath.app_role', 'server', true)");
  await applyCustomerMigrations({ query: (text, params) => client.query(text, params) });
  console.log('Ask customer migrations applied to Neon customer database.');
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error('migration_failed', message.replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://[redacted]@'));
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
