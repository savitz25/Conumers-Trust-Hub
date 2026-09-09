import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908153000_my_trusthub_consumer_alerts.sql");
const rollback = read("supabase/rollback/20260908153000_my_trusthub_consumer_alerts.down.sql");
const seed = read("supabase/seeds/p16_consumer_alerts_validation.sql");
const sqlTests = read("supabase/tests/p16_consumer_alerts.sql");
const contract = read("lib/my-trusthub/alert-contract.ts");
const crossHub = read("lib/my-trusthub/cross-hub-contract.ts");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const table of [
  "network.consumer_alert_templates",
  "network.consumer_source_presentations",
  "consumer.consumer_alerts",
  "ops.consumer_alert_fanout_audit",
]) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "consumer.fanout_change_event",
  "network.approve_change_event_for_fanout",
  "consumer.set_alert_read_state",
  "consumer.mark_all_alerts_read",
  "consumer.list_alerts",
  "consumer.get_alert_detail",
  "consumer.get_watch_coverage_checks",
  "consumer.get_watch_summary",
  "consumer.get_watch_observation_history",
  "consumer.get_alerts_overview",
  "consumer.get_cross_hub_entity_alert_state",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

for (let id = 1; id <= 67; id += 1) {
  expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}

for (const typeName of [
  "ConsumerAlert","AlertDetail","AlertSeverity","AlertReadState",
  "WatchCheckState","CoverageCheckState","WatchObservationHistoryEntry",
  "WatchSummaryState","EntityAlertState","AlertsOverview",
]) expect(contract.includes(typeName), `typed Alert contract missing ${typeName}`);

expect(migration.includes("unique(watch_id,change_event_id)"), "Alert uniqueness missing");
expect(migration.includes("consumer_alerts_template_idx"), "Alert template foreign-key index missing");
expect(migration.includes("c.capability_version=event.capability_version"), "exact coverage version match missing");
expect(migration.includes("event.observed_at>=greatest(w.resume_boundary_at,c.enabled_at)"), "Watch/coverage boundary missing");
expect(migration.includes("network.coverage_no_change_eligible"), "P15 no-change gate not reused");
expect(migration.includes("health_status in ('delayed','degraded','unknown')"), "unhealthy coverage precedence missing");
expect(migration.includes("ce.status='active'"), "active-event qualification missing");
expect(migration.includes("source_as_of") && migration.includes("observed_at") && migration.includes("last_successful_check"), "source clocks collapsed");
expect(migration.includes("event.status<>'active' or event.fanout_status<>'pending'"), "suppression gate missing");
expect(migration.includes("Source correction recorded") && migration.includes("status='retracted'"), "retraction history missing");
expect(migration.includes("project_context_snapshot"), "Project context snapshot missing");
expect(migration.includes("least((select count(*) from own_alerts),100)"), "cross-hub Alert count is not bounded");
expect(migration.includes("alert:read"), "cross-hub Alert scope missing");
expect(seed.includes("validation-fixture"), "validation seed governance marker missing");
expect(seed.includes("Extracts can lag. This is not a TrustHub verdict."), "required disclosure missing");
expect(crossHub.includes("getEntityAlertState") && crossHub.includes("entityAlertState"), "narrow cross-hub Alert contract missing");
expect(!migration.match(/delivered_email_at|send_email|notification_delivery/i), "P16 crossed into notification delivery");

for (const prior of [
  "network.network_entities","consumer.consumer_saved_entities","consumer.consumer_projects",
  "ops.consumer_auth_handoffs","network.watch_capabilities","consumer.consumer_watches",
  "consumer.consumer_watch_coverage","network.source_observations","network.network_change_events",
]) expect(!rollback.includes(`drop table if exists ${prior}`), `P16 rollback removes prior foundation ${prior}`);

if (failures.length) {
  console.error(`P16 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P16 foundation static contract: PASS");
