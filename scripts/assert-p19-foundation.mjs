import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908210000_my_trusthub_decisions_export_delete.sql");
const rollback = read("supabase/rollback/20260908210000_my_trusthub_decisions_export_delete.down.sql");
const seed = read("supabase/seeds/p19_decision_export_delete_validation.sql");
const sqlTests = read("supabase/tests/p19_decisions_export_delete.sql");
const contract = read("lib/my-trusthub/lifecycle-contract.ts");
const sessionContract = read("lib/my-trusthub/session-contract.ts");
const crossHub = read("lib/my-trusthub/cross-hub-contract.ts");
const registry = read("lib/my-trusthub/hub-registry.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const table of [
  "consumer.consumer_project_decisions",
  "consumer.consumer_project_decision_entities",
  "consumer.consumer_research_snapshots",
  "consumer.consumer_project_events",
  "ops.consumer_export_jobs",
  "ops.consumer_destructive_confirmations",
  "ops.consumer_deletion_jobs",
  "ops.consumer_deletion_steps",
]) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "consumer.record_project_decision",
  "consumer.build_project_research_snapshot",
  "consumer.verify_research_snapshot",
  "consumer.complete_project",
  "consumer.reopen_project",
  "consumer.list_project_decisions",
  "consumer.get_research_snapshot",
  "consumer.get_specialist_decision_context",
  "consumer.request_export",
  "consumer.get_export_status",
  "ops.claim_consumer_export_job",
  "ops.build_consumer_export_bundle",
  "ops.complete_consumer_export_job",
  "consumer.request_workspace_deletion",
  "consumer.cancel_workspace_deletion",
  "consumer.get_workspace_deletion_status",
  "ops.claim_consumer_deletion_job",
  "ops.run_consumer_deletion_step",
  "ops.complete_consumer_deletion_job",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

for (let id = 1; id <= 97; id += 1) {
  expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}

for (const typeName of [
  "ProjectDecision","DecisionType","DecisionEntitySelection","ResearchSnapshot",
  "ResearchSnapshotVersion","ExportRequest","ExportStatus","ExportManifest",
  "DeletionRequest","DeletionStatus","ProjectLifecycleState","MyTrustHubLifecycleService",
]) expect(contract.includes(typeName), `typed lifecycle contract missing ${typeName}`);

expect(migration.includes("mytrusthub-research-snapshot/v1"), "snapshot version missing");
expect(migration.includes("mytrusthub-export/v1"), "export version missing");
expect(migration.includes("RESEARCH_SNAPSHOT_IMMUTABLE"), "snapshot update guard missing");
expect(migration.includes("DECISION_APPEND_ONLY"), "append-only decision guard missing");
expect(migration.includes("status='stopped'"), "deletion Watch stop missing");
expect(migration.includes("interval '7 days'"), "seven-day lifecycle defaults missing");
expect(migration.includes("interval '30 days'"), "operational retention boundary missing");
expect(migration.includes("artifact_ref ~ '^exports/"), "opaque artifact reference constraint missing");
expect(migration.includes("export_policy when 'full'"), "session export classification missing");
expect(migration.includes("current_user<>'myth_export_worker'") === false, "worker authorization should survive SECURITY DEFINER");
expect(migration.includes("v_actor<>'myth_export_worker'"), "export worker actor check missing");
expect(migration.includes("v_actor<>'myth_deletion_worker'"), "deletion worker actor check missing");
expect(seed.includes("lender.piti/v1") && seed.includes("summary_only"), "restricted financial export policy missing");
expect(sessionContract.includes("SessionExportPolicy"), "session export type missing");
expect(crossHub.includes("getPrivateDecisionContext"), "narrow specialist decision context missing");
expect((registry.match(/"decision:read"/g) || []).length === 7, "decision read scope missing for a hub");

for (const prior of [
  "network.network_entities","consumer.consumer_saved_entities","consumer.consumer_projects",
  "ops.consumer_auth_handoffs","network.watch_capabilities","consumer.consumer_watches",
  "network.source_observations","network.network_change_events","consumer.consumer_alerts",
  "consumer.consumer_notification_preferences","ops.consumer_alert_deliveries",
  "consumer.consumer_saved_sessions",
]) expect(!rollback.includes(`drop table if exists ${prior}`), `P19 rollback removes prior foundation ${prior}`);

if (failures.length) {
  console.error(`P19 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P19 foundation static contract: PASS");
