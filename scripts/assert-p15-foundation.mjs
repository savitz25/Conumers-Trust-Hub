import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908134944_my_trusthub_source_observations.sql");
const rollback = read("supabase/rollback/20260908134944_my_trusthub_source_observations.down.sql");
const seed = read("supabase/seeds/p15_monitoring_validation.sql");
const sqlTests = read("supabase/tests/p15_source_observations.sql");
const contract = read("lib/my-trusthub/monitoring-contract.ts");
const crossHub = read("lib/my-trusthub/cross-hub-contract.ts");
const fixture = JSON.parse(read("lib/my-trusthub/monitoring.fixture.json"));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const tables = [
  "network.watch_capability_observation_contracts",
  "network.alert_severity_rules",
  "ops.source_feed_checkpoints",
  "network.source_observations",
  "network.network_change_events",
  "ops.source_monitoring_events",
];
for (const table of tables) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "ops.start_source_checkpoint",
  "ops.complete_source_checkpoint",
  "ops.evaluate_checkpoint_health",
  "network.submit_source_observation",
  "network.accept_source_observation",
  "network.set_capability_monitoring_state",
  "ops.release_source_quarantine",
  "network.retract_change_event",
  "network.coverage_no_change_eligible",
  "consumer.get_watch_source_health",
  "consumer.get_watch_health",
  "network.list_matching_active_watch_coverage",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

for (let id = 1; id <= 64; id += 1) {
  expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}

expect(sqlTests.includes("function pg_temp.p15_at"), "P15 matrix transaction clock helper missing");
expect(sqlTests.includes("transaction_timestamp() + p_offset"), "P15 matrix does not use one transaction-stable clock anchor");
expect(!/2026-09-(?:07|08|10)/.test(sqlTests), "P15 matrix retains date-sensitive freshness timestamps");
expect(seed.includes("interval '2 hours'"), "P15 production freshness contract was weakened");
expect(sqlTests.includes("p15_at(interval '93990 seconds')"), "P15 delayed fixture no longer exceeds freshness threshold");
expect(sqlTests.includes("p15_at(interval '-46410 seconds')"), "P15 out-of-order historical fixture missing");
expect((sqlTests.match(/p15_at\(interval '-3210 seconds'\)/g) ?? []).length >= 3, "P15 same-effective-time fixture clocks drifted");

for (const semanticCase of [
  "Successful complete run becomes current",
  "Stale success becomes delayed",
  "Partial completeness becomes degraded",
  "No valid run becomes unknown",
  "First observation creates baseline only",
  "Current complete baseline no-change is eligible",
  "Active material change makes no-change ineligible",
  "Out-of-order older observation does not become latest",
  "Same-time conflicting value quarantined",
  "Mass-change threshold triggers guard",
]) expect(sqlTests.includes(semanticCase), `P15 clock correction lost semantic case: ${semanticCase}`);

for (const typeName of [
  "SourceHealthStatus","CompletenessStatus","SchemaStatus","ObservationStatus",
  "SourceObservation","SourceCheckpoint","ChangeEvent","EventSeverity",
  "CoverageSourceHealth","WatchHealth",
]) expect(contract.includes(typeName), `typed monitoring contract missing ${typeName}`);

expect(fixture.version === "mytrusthub-monitoring/validation-v1", "fixture version drift");
expect(fixture.environment === "validation_only" && fixture.livePolling === false, "fixture must remain non-production");
expect(fixture.capabilities.length === 8, "fixture must cover eight Phase 1 grains");
expect(fixture.observations.length === 8, "fixture must include eight deterministic observation envelopes");
expect(fixture.observations.every((item) => fixture.capabilities.includes(item.capability)), "observation fixture capability drift");
expect(JSON.stringify(fixture.healthOrder) === JSON.stringify(["current","delayed","degraded","unknown"]), "health order drift");
expect(seed.includes("validation-fixture"), "validation seed governance marker missing");
expect(migration.includes("source_as_of") && migration.includes("published_at") && migration.includes("retrieved_at") && migration.includes("observed_at") && migration.includes("snapshot_as_of") && migration.includes("generated_at"), "clock semantics collapsed");
expect(migration.includes("mass_change_status") && migration.includes("MASS_CHANGE_DETECTED"), "mass-change guard missing");
expect(migration.includes("same_effective_time_conflict"), "same-time conflict quarantine missing");
expect(migration.includes("late_historical"), "late observation handling missing");
expect(migration.includes("next_accepted_observation") || read("supabase/migrations/20260908122551_my_trusthub_watch_capabilities.sql").includes("next_accepted_observation"), "pause boundary contract missing");
expect(crossHub.includes("watchSourceHealth"), "narrow cross-hub source health endpoint missing");
expect(!migration.match(/create table\s+consumer\.consumer_alerts/i), "P15 created consumer Alerts");

for (const prior of [
  "network.network_entities","consumer.consumer_saved_entities","consumer.consumer_projects",
  "ops.consumer_auth_handoffs","network.watch_capabilities","consumer.consumer_watches",
  "consumer.consumer_watch_coverage",
]) expect(!rollback.includes(`drop table if exists ${prior}`), `P15 rollback removes prior foundation ${prior}`);

if (failures.length) {
  console.error(`P15 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P15 foundation static contract: PASS");
