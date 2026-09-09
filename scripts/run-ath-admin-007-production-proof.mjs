import pg from 'pg';

const { Client } = pg;
const url = process.env.ATH_ADMIN007_DB_URL;
const buildId = process.env.SEARCH_BUILD_ID;

if (!url) throw new Error('ATH_ADMIN007_DB_URL required');
if (!/^[0-9a-f]{40}$/.test(buildId ?? '')) throw new Error('SEARCH_BUILD_ID must be a full commit SHA');

const { runSearchCanarySuite } = await import('../lib/control-plane/search-reliability.ts');
const client = new Client({ connectionString: url });
await client.connect();

try {
  const before = await client.query(`SELECT
    count(*) FILTER (WHERE event_name='search_terminal_outcome')::int AS real_search_events,
    (SELECT count(*)::int FROM ath_search_canary_runs) AS canary_runs
    FROM ath_product_events`);

  await client.query('BEGIN');
  await client.query("SELECT set_config('ath.app_role','server',true)");
  const release = await runSearchCanarySuite(client, 'RELEASE', buildId);
  const quick = await runSearchCanarySuite(client, 'QUICK', buildId);
  await client.query('COMMIT');

  const after = await client.query(`SELECT
    count(*) FILTER (WHERE event_name='search_terminal_outcome')::int AS real_search_events,
    (SELECT count(*)::int FROM ath_search_canary_runs) AS canary_runs,
    (SELECT count(*)::int FROM ath_search_release_evaluations) AS release_evaluations,
    (SELECT count(*)::int FROM ath_search_incidents WHERE status IN ('OPEN','ACKNOWLEDGED')) AS open_incidents
    FROM ath_product_events`);

  console.log(JSON.stringify({ before: before.rows[0], release, quick, after: after.rows[0] }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
