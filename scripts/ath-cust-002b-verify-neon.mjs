import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === '[SENSITIVE]') continue;
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.vercel-audit.local'));

const raw = process.env.neon_tech_database || process.env.ASK_DATABASE_URL;
if (!raw) {
  console.error('missing_neon_url');
  process.exit(1);
}

const connectionString = raw.replace(/&?channel_binding=require/g, '');
const hostLooksNeon = /neon\.tech/i.test(connectionString);
const hostLooksCth = /contractor|supabase\.co|ca-central-1/i.test(connectionString);

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const redact = (s) => String(s).replace(/postgresql:\/\/[^@\s]+@/gi, 'postgresql://[redacted]@');

try {
  const client = await pool.connect();
  try {
    const ping = await client.query(
      `SELECT current_database() AS db, current_user AS db_user, inet_server_port() AS port, version() AS version`
    );
    await client.query("SELECT set_config('ath.app_role', 'server', true)");
    const tables = await client.query(`
      SELECT c.relname AS name,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS rls_force
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'ath_%'
       ORDER BY 1
    `);
    const indexes = await client.query(`
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname = 'public' AND tablename LIKE 'ath_%'
       ORDER BY 1
    `);
    const uniques = await client.query(`
      SELECT indexname
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename LIKE 'ath_%'
         AND indexdef ILIKE '%UNIQUE%'
       ORDER BY 1
    `);
    const fns = await client.query(`
      SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname LIKE 'ath_%'
       ORDER BY 1
    `);
    let rlsDenied = false;
    try {
      await client.query("SELECT set_config('ath.app_role', '', true)");
      await client.query('SELECT 1 FROM ath_users LIMIT 1');
    } catch {
      rlsDenied = true;
    }
    await client.query("SELECT set_config('ath.app_role', 'server', true)");
    const counts = {};
    for (const row of tables.rows) {
      const c = await client.query(`SELECT COUNT(*)::text AS n FROM ${row.name}`);
      counts[row.name] = c.rows[0].n;
    }
    console.log(
      JSON.stringify(
        {
          connected: true,
          provider_host_is_neon: hostLooksNeon,
          provider_host_is_not_cth_evidence: !hostLooksCth,
          database: ping.rows[0].db,
          db_user: ping.rows[0].db_user,
          server_port: ping.rows[0].port,
          postgres_family: String(ping.rows[0].version).split(',')[0],
          ath_tables: tables.rows,
          ath_table_count: tables.rows.length,
          unique_indexes: uniques.rows.map((r) => r.indexname),
          index_count: indexes.rows.length,
          functions: fns.rows.map((r) => r.proname),
          rls_denies_without_app_role: rlsDenied,
          row_counts: counts,
        },
        null,
        2
      )
    );
  } finally {
    client.release();
  }
} catch (err) {
  console.error('connection_failed', redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
} finally {
  await pool.end();
}
