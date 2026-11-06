/**
 * Single-body path for schema/migrations/020_ath_research_service_inquiries.sql.
 *
 * The broad customer migrator splits that file into separate statements.
 * This script sends the certified LF file as one simple query inside one
 * transaction on the Neon direct connection. Nothing in this draft runs it.
 *
 *   ATH_020_TARGET_URL=postgres://… node --experimental-strip-types scripts/research-services-020-apply.ts verify
 *   ATH_020_TARGET_URL=postgres://… node --experimental-strip-types scripts/research-services-020-apply.ts rehearse
 *   ATH_020_TARGET_URL=postgres://… node --experimental-strip-types scripts/research-services-020-apply.ts apply --confirm=APPLY-020-1fb96942b480
 *
 * verify   : read-only schema check.
 * rehearse : apply the body and roll back.
 * apply    : commit only when the schema was absent and the body verifies.
 *            A schema that is already complete is left unchanged.
 */
import {
  MIGRATION_020_CONFIRM,
  MIGRATION_020_SHA256,
  assertDirectDatabaseUrl,
  readMigration020File,
  runMigration020,
  type Migration020Client,
  type Migration020Mode,
} from '../lib/customer/research-020-body.ts';

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]');
}

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error('020 apply does not run on Vercel');
  const [mode, ...flags] = process.argv.slice(2);
  if (mode !== 'verify' && mode !== 'rehearse' && mode !== 'apply') {
    throw new Error('usage: verify | rehearse | apply --confirm=APPLY-020-<sha12>');
  }
  const url = process.env.ATH_020_TARGET_URL || '';
  if (!url) throw new Error('ATH_020_TARGET_URL is required');
  assertDirectDatabaseUrl(url);
  const { sql, sha256 } = readMigration020File();
  if (mode === 'apply' && !flags.includes(`--confirm=${MIGRATION_020_CONFIRM}`)) {
    throw new Error(`apply requires --confirm=${MIGRATION_020_CONFIRM}`);
  }
  const { default: pg } = await import('pg');
  const needsSsl = /supabase|neon|sslmode=require|amazonaws|pooler/i.test(url);
  const client = new pg.Client({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  const db: Migration020Client = {
    query: async (text, params) => ({ rows: (await client.query(text, params ?? [])).rows }),
    exec: async (text) => { await client.query(text); },
  };
  try {
    const result = await runMigration020(db, mode as Migration020Mode, sql);
    console.log(JSON.stringify({
      mode,
      sha256,
      executed: result.executed,
      committed: result.committed,
      complete: result.state.complete,
      absent: result.state.absent,
    }));
    if (mode === 'verify') process.exitCode = result.state.complete ? 0 : result.state.absent ? 3 : 4;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && /research-services-020-apply\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(publicError(error));
    process.exitCode = 1;
  });
}

export { MIGRATION_020_SHA256 };
