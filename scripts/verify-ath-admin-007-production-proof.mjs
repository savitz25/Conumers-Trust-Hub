import pg from 'pg';

const { Client } = pg;
const url = process.env.ATH_ADMIN007_DB_URL;
const buildId = process.env.SEARCH_BUILD_ID;
if (!url) throw new Error('ATH_ADMIN007_DB_URL required');
if (!/^[0-9a-f]{40}$/.test(buildId ?? '')) throw new Error('SEARCH_BUILD_ID must be a full commit SHA');

const client = new Client({ connectionString: url });
await client.connect();
try {
  const result = await client.query(`WITH build_runs AS (
      SELECT * FROM ath_search_canary_runs WHERE build_id=$1
    ), proof_window AS (
      SELECT min(started_at) started_at,max(completed_at) completed_at FROM build_runs
    )
    SELECT
      (SELECT count(*)::int FROM build_runs) canary_runs,
      (SELECT count(DISTINCT run_group_id)::int FROM build_runs) run_groups,
      (SELECT count(*)::int FROM build_runs WHERE run_kind='RELEASE') release_runs,
      (SELECT count(*)::int FROM build_runs WHERE run_kind='QUICK') quick_runs,
      (SELECT count(*)::int FROM build_runs WHERE status='PASS') passed,
      (SELECT count(*)::int FROM build_runs WHERE status<>'PASS') not_passed,
      (SELECT count(*)::int FROM ath_search_release_evaluations WHERE build_id=$1) release_evaluations,
      (SELECT gate_state FROM ath_search_release_evaluations WHERE build_id=$1 ORDER BY evaluated_at DESC LIMIT 1) latest_gate,
      (SELECT count(*)::int FROM ath_search_incidents WHERE status IN('OPEN','ACKNOWLEDGED')) open_incidents,
      (SELECT count(*)::int FROM ath_product_events p,proof_window w
        WHERE p.event_name='search_terminal_outcome'
          AND p.created_at BETWEEN w.started_at AND w.completed_at) real_search_events_in_proof_window
  `,[buildId]);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await client.end();
}
