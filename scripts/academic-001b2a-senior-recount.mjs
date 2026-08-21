/**
 * Academic 001B.2A — SELECT-only Senior warehouse recount.
 * Loads CARE_DATABASE_URL from care-trust-hub env files without printing secrets.
 * Never writes. Uses READ ONLY transaction.
 *
 * Run from a directory where `pg` is installed (care-trust-hub/apps/web):
 *   node C:\Users\makei\consumers-trust-hub\scripts\academic-001b2a-senior-recount.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const careRoot = path.resolve("C:/Users/makei/care-trust-hub");
loadEnvFile(path.join(careRoot, "apps/web/.env.local"));
loadEnvFile(path.join(careRoot, "apps/web/.env"));
loadEnvFile(path.join(careRoot, ".env.local"));
loadEnvFile(path.join(careRoot, "services/ingest/.env.local"));

function preferSessionPooler(raw) {
  try {
    const u = new URL(raw);
    if (u.hostname.includes("pooler.supabase.com") && u.port === "6543") {
      u.port = "5432";
      return { url: u.toString(), rewritten_from_transaction_pooler: true };
    }
    return { url: raw, rewritten_from_transaction_pooler: false };
  } catch {
    return { url: raw, rewritten_from_transaction_pooler: false };
  }
}

const rawUrl = process.env.CARE_DATABASE_URL || process.env.DATABASE_URL;
if (!rawUrl) {
  console.log(
    JSON.stringify({
      database_reachable: false,
      reason: "CARE_DATABASE_URL not present in process env or ignored local env files",
      query_mode: "NOT_ATTEMPTED",
    })
  );
  process.exit(2);
}

const poolerChoice = preferSessionPooler(rawUrl);
const url = poolerChoice.url;

const sslMode = process.env.CARE_DATABASE_SSL || "require";
const ssl =
  sslMode === "disable"
    ? false
    : sslMode === "verify-full"
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false };

function redactUrlMeta() {
  try {
    const u = new URL(url);
    const kind = u.hostname.includes("pooler.supabase.com")
      ? u.port === "6543"
        ? "supabase_transaction_pooler"
        : "supabase_session_pooler"
      : u.hostname.startsWith("db.") && u.hostname.endsWith(".supabase.co")
        ? "supabase_direct"
        : "other";
    return {
      host_kind: kind,
      port_present: Boolean(u.port),
      ssl_mode: sslMode,
      rewritten_from_transaction_pooler: poolerChoice.rewritten_from_transaction_pooler,
    };
  } catch {
    return { host_kind: "unparseable", ssl_mode: sslMode };
  }
}

const queries = {
  txn_read_only: "SELECT current_setting('transaction_read_only') AS transaction_read_only",
  identity_base: `SELECT
    (SELECT COUNT(*)::bigint FROM provider) AS provider_rows,
    (SELECT COUNT(*)::bigint FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN') AS cms_ccn_identifier_rows,
    (SELECT COUNT(DISTINCT identifier_value)::bigint FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN') AS distinct_cms_ccns_all,
    (SELECT COUNT(*)::bigint FROM facility_snapshot) AS facility_snapshot_rows`,
  current_snapshot: `WITH current_ingest AS (
    SELECT ir.id AS ingest_run_id, sr.id AS source_release_id, sr.release_key,
           sr.source_modified_at, sr.source_release_date, sr.retrieved_at, ir.completed_at
    FROM source_dataset sd
    JOIN source_release sr ON sr.source_dataset_id = sd.id
    JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
    WHERE sd.dataset_key = 'nursing-home-provider-information'
    ORDER BY sr.source_modified_at DESC NULLS LAST,
             sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
             ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
    LIMIT 1
  ),
  current_snapshots AS (
    SELECT fs.provider_id, pi.identifier_value AS ccn, fs.overall_rating,
           fs.health_inspection_rating, fs.staffing_rating, fs.quality_measure_rating
    FROM current_ingest ci
    JOIN facility_snapshot fs
      ON fs.source_release_id = ci.source_release_id AND fs.ingest_run_id = ci.ingest_run_id
    JOIN provider_identifier pi
      ON pi.provider_id = fs.provider_id
     AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
  )
  SELECT
    (SELECT release_key FROM current_ingest) AS current_release_key,
    (SELECT source_modified_at FROM current_ingest) AS current_source_modified_at,
    (SELECT retrieved_at FROM current_ingest) AS current_retrieved_at,
    (SELECT COUNT(*)::bigint FROM current_snapshots) AS current_snapshot_rows,
    (SELECT COUNT(DISTINCT ccn)::bigint FROM current_snapshots) AS distinct_current_ccns,
    (SELECT COUNT(*)::bigint FROM (SELECT ccn FROM current_snapshots GROUP BY ccn HAVING COUNT(*) > 1) d) AS duplicate_current_ccn_groups,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE overall_rating IS NOT NULL) AS overall_present,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE overall_rating IS NULL) AS overall_null,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE health_inspection_rating IS NOT NULL) AS health_present,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE health_inspection_rating IS NULL) AS health_null,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE staffing_rating IS NOT NULL) AS staffing_present,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE staffing_rating IS NULL) AS staffing_null,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE quality_measure_rating IS NOT NULL) AS qm_present,
    (SELECT COUNT(*)::bigint FROM current_snapshots WHERE quality_measure_rating IS NULL) AS qm_null`,
  inspections: `SELECT COUNT(*)::bigint AS inspection_event_rows,
    COUNT(DISTINCT provider_id)::bigint AS inspection_distinct_providers,
    MIN(survey_date)::text AS inspection_min_survey_date,
    MAX(survey_date)::text AS inspection_max_survey_date
    FROM inspection_event`,
  deficiencies: `SELECT COUNT(*)::bigint AS deficiency_rows,
    COUNT(DISTINCT provider_id)::bigint AS deficiency_distinct_providers,
    COUNT(*) FILTER (WHERE inspection_event_id IS NOT NULL)::bigint AS deficiency_linked_inspection,
    COUNT(*) FILTER (WHERE inspection_event_id IS NULL)::bigint AS deficiency_unlinked_inspection,
    MIN(survey_date)::text AS deficiency_min_survey_date,
    MAX(survey_date)::text AS deficiency_max_survey_date
    FROM deficiency_finding`,
  enforcement: `SELECT COUNT(*)::bigint AS penalty_rows,
    COUNT(*) FILTER (WHERE penalty_type = 'Fine')::bigint AS penalty_fine_rows,
    COUNT(*) FILTER (WHERE penalty_type = 'Payment Denial')::bigint AS penalty_payment_denial_rows,
    COUNT(DISTINCT provider_id)::bigint AS penalty_distinct_providers,
    SUM(fine_amount) FILTER (WHERE penalty_type = 'Fine')::text AS sum_fine_amount,
    MIN(penalty_date)::text AS penalty_min_date,
    MAX(penalty_date)::text AS penalty_max_date
    FROM penalty_enforcement`,
  staffing_quarters: `SELECT COUNT(*)::bigint AS pbj_quarter_rows,
    COUNT(DISTINCT ccn)::bigint AS pbj_distinct_ccns,
    COUNT(DISTINCT source_quarter)::bigint AS pbj_distinct_quarters,
    MIN(source_quarter) AS pbj_earliest_quarter,
    MAX(source_quarter) AS pbj_latest_quarter
    FROM pbj_staffing_quarter_summary`,
  staffing_daily_audit: `SELECT COUNT(*)::bigint AS pbj_daily_rows_audit_only FROM pbj_staffing_day`,
  ownership: `SELECT COUNT(*)::bigint AS ownership_relationship_rows,
    COUNT(*) FILTER (WHERE op.party_kind = 'organization')::bigint AS ownership_org_party_rows,
    COUNT(*) FILTER (WHERE op.party_kind = 'individual')::bigint AS ownership_individual_party_rows,
    COUNT(DISTINCT por.provider_id)::bigint AS ownership_distinct_providers,
    COUNT(DISTINCT por.ownership_party_id) FILTER (WHERE op.party_kind = 'organization')::bigint AS distinct_org_parties_used,
    COUNT(DISTINCT por.ownership_party_id) FILTER (WHERE op.party_kind = 'individual')::bigint AS distinct_individual_parties_used
    FROM provider_ownership_relationship por
    LEFT JOIN ownership_party op ON op.id = por.ownership_party_id`,
  ownership_parties: `SELECT
    COUNT(*) FILTER (WHERE party_kind='organization')::bigint AS ownership_party_org,
    COUNT(*) FILTER (WHERE party_kind='individual')::bigint AS ownership_party_individual
    FROM ownership_party`,
  org_relationships: `SELECT COUNT(*)::bigint AS organization_relationship_rows FROM organization_relationship`,
  chow: `SELECT COUNT(*)::bigint AS ownership_change_event_rows,
    MIN(effective_date)::text AS chow_min_effective,
    MAX(effective_date)::text AS chow_max_effective
    FROM ownership_change_event`,
  chains: `SELECT (SELECT COUNT(*)::bigint FROM cms_chain) AS cms_chain_rows,
    COUNT(*)::bigint AS cms_chain_provider_rows,
    COUNT(DISTINCT provider_id) FILTER (WHERE provider_id IS NOT NULL)::bigint AS chain_distinct_providers,
    COUNT(DISTINCT chain_id)::bigint AS chain_distinct_ids
    FROM cms_chain_provider`,
  provenance: `SELECT sd.dataset_key,
    COUNT(DISTINCT sr.id)::bigint AS source_release_rows,
    COUNT(ir.id) FILTER (WHERE ir.status='succeeded')::bigint AS succeeded_ingest_runs
    FROM source_dataset sd
    LEFT JOIN source_release sr ON sr.source_dataset_id = sd.id
    LEFT JOIN ingest_run ir ON ir.source_release_id = sr.id
    GROUP BY sd.dataset_key ORDER BY sd.dataset_key`,
  history: `SELECT COUNT(*)::bigint AS facility_history_event_rows,
    COUNT(DISTINCT provider_id)::bigint AS history_distinct_providers
    FROM facility_history_event`,
  history_families: `SELECT event_family, COUNT(*)::bigint AS n FROM facility_history_event GROUP BY event_family ORDER BY event_family`,
  published_state: `SELECT COUNT(*)::bigint AS published_state_claim_rows FROM published_state_claim`,
  published_state_by_state: `SELECT
    CASE
      WHEN resolver_reference LIKE '%:ca-%' THEN 'CA'
      WHEN resolver_reference LIKE '%:ny-%' THEN 'NY'
      WHEN resolver_reference LIKE '%:tx-%' THEN 'TX'
      ELSE 'OTHER'
    END AS state_code,
    COUNT(*)::bigint AS claim_rows,
    COUNT(DISTINCT provider_id)::bigint AS facilities
    FROM published_state_claim
    GROUP BY 1 ORDER BY 1`,
};

async function main() {
  const meta = redactUrlMeta();
  const client = new Client({
    connectionString: url,
    ssl,
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SET TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '180s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const ro = await client.query("SELECT current_setting('transaction_read_only') AS v");
    const out = {
      database_reachable: true,
      ssl: Boolean(ssl),
      query_mode: "SELECT_ONLY_READ_ONLY_TRANSACTION",
      connection_meta: meta,
      transaction_read_only: ro.rows[0].v,
      counted_at: new Date().toISOString(),
      results: {},
      missing_relations: [],
      errors: [],
    };

    for (const [name, sql] of Object.entries(queries)) {
      try {
        const res = await client.query(sql);
        out.results[name] = res.rows;
      } catch (err) {
        const code = err && err.code;
        const msg = err && err.message ? String(err.message).replace(url, "[redacted]") : String(err);
        if (code === "42P01") {
          out.missing_relations.push({ query: name, message: msg });
        } else {
          out.errors.push({ query: name, code, message: msg });
        }
      }
    }

    await client.query("ROLLBACK");
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    const safe = msg.replace(/postgresql:\/\/[^\s]+/gi, "[redacted]");
    console.log(
      JSON.stringify({
        database_reachable: false,
        ssl: Boolean(ssl),
        query_mode: "FAILED_BEFORE_SELECT",
        connection_meta: meta,
        error: safe,
      })
    );
    process.exit(3);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

await main();
