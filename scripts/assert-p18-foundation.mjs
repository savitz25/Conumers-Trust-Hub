import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908190000_my_trusthub_saved_sessions.sql");
const rollback = read("supabase/rollback/20260908190000_my_trusthub_saved_sessions.down.sql");
const seed = read("supabase/seeds/p18_saved_sessions_validation.sql");
const sqlTests = read("supabase/tests/p18_saved_sessions.sql");
const contract = read("lib/my-trusthub/session-contract.ts");
const crossHub = read("lib/my-trusthub/cross-hub-contract.ts");
const registry = read("lib/my-trusthub/hub-registry.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const table of [
  "network.consumer_session_schemas",
  "network.consumer_session_schema_migrations",
  "consumer.consumer_saved_sessions",
  "consumer.consumer_project_saved_sessions",
  "consumer.consumer_session_events",
  "ops.consumer_session_resume_handoffs",
  "consumer.consumer_guest_session_imports",
  "consumer.consumer_guest_session_import_items",
]) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "network.propose_consumer_session_schema",
  "network.set_consumer_session_schema_status",
  "network.register_consumer_session_schema_migration",
  "consumer.save_session",
  "consumer.update_saved_session",
  "consumer.add_saved_session_to_project",
  "consumer.remove_saved_session_from_project",
  "consumer.archive_saved_session",
  "consumer.restore_saved_session",
  "consumer.remove_saved_session",
  "consumer.mark_saved_session_resumed",
  "consumer.apply_saved_session_schema_migration",
  "consumer.get_saved_session_for_resume",
  "consumer.list_saved_session_summaries",
  "consumer.list_continue_sessions",
  "ops.create_session_resume_handoff",
  "ops.consume_session_resume_handoff",
  "consumer.preview_guest_session_import",
  "consumer.commit_guest_session_import",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

for (let id = 1; id <= 72; id += 1) {
  expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}

for (const typeName of [
  "SavedSession","SavedSessionType","SessionSchema","SessionStatus","SessionSummary",
  "SaveSessionRequest","UpdateSessionRequest","ResumeSession","SessionProjectMembership",
  "GuestSessionItem","MyTrustHubSessionService",
]) expect(contract.includes(typeName), `typed session contract missing ${typeName}`);

expect(migration.includes("unique(user_id,create_idempotency_key)"), "create idempotency missing");
expect(migration.includes("primary key(project_id,saved_session_id)"), "many-to-many membership identity missing");
expect(migration.includes("SESSION_MIGRATION_ADAPTER_REQUIRED"), "version migration boundary missing");
expect(migration.includes("status='read_only'"), "read-only legacy preservation missing");
expect(migration.includes("octet_length(p_payload::text)>262144"), "guest 256 KiB cap missing");
expect(migration.includes("session_json_has_prohibited_content"), "prohibited content screening missing");
expect(migration.includes("ops.hash_handoff_secret(p_raw_code)"), "resume code not hashed at rest");
expect(!migration.match(/\b(resume_url|external_url)\b/i), "arbitrary resume URL column introduced");
expect(migration.includes("ops.normalize_return_path(p_target_hub,p_return_path)"), "P13 return-path allowlist not reused");
expect(seed.includes("lender.piti/v1") && seed.includes("move.inventory/v1"), "cross-hub fixture schemas missing");
expect(seed.includes("no diagnoses or medical records") && seed.includes("Research-only"), "sensitive-context fixture rules missing");
expect(crossHub.includes("saveSession") && crossHub.includes("getSessionForResume"), "cross-hub session API missing");
expect((registry.match(/"session:read"/g) || []).length === 7, "session read scope missing for a hub");
expect((registry.match(/"session:write"/g) || []).length === 7, "session write scope missing for a hub");

for (const prior of [
  "network.network_entities","consumer.consumer_saved_entities","consumer.consumer_projects",
  "ops.consumer_auth_handoffs","network.watch_capabilities","consumer.consumer_watches",
  "network.source_observations","network.network_change_events","consumer.consumer_alerts",
  "consumer.consumer_notification_preferences","ops.consumer_alert_deliveries",
]) expect(!rollback.includes(`drop table if exists ${prior}`), `P18 rollback removes prior foundation ${prior}`);

if (failures.length) {
  console.error(`P18 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P18 foundation static contract: PASS");
