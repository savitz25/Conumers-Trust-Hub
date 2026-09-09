import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908122551_my_trusthub_watch_capabilities.sql");
const rollback = read("supabase/rollback/20260908122551_my_trusthub_watch_capabilities.down.sql");
const seed = read("supabase/seeds/p14_watch_capabilities_validation.sql");
const sqlTests = read("supabase/tests/p14_watch_capabilities.sql");
const contract = read("lib/my-trusthub/cross-hub-contract.ts");
const fixture = JSON.parse(read("lib/my-trusthub/watch-capabilities.fixture.json"));
const registry = JSON.parse(read("lib/my-trusthub/hub-registry.json"));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const tables = [
  "network.watch_capabilities",
  "network.watch_capability_events",
  "consumer.consumer_watches",
  "consumer.consumer_watch_coverage",
  "consumer.consumer_watch_events",
];
for (const table of tables) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "network.propose_watch_capability",
  "network.set_watch_capability_state",
  "consumer.watch_capability_eligibility_reason",
  "consumer.list_available_watch_capabilities",
  "consumer.start_watch",
  "consumer.pause_watch",
  "consumer.resume_watch",
  "consumer.stop_watch",
  "consumer.restart_watch",
  "consumer.add_watch_coverage",
  "consumer.remove_watch_coverage",
  "consumer.get_watch",
  "consumer.get_watch_coverage",
  "consumer.get_cross_hub_entity_watch_state",
  "consumer.stop_watch_and_remove_saved_entity",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

for (let id = 1; id <= 62; id += 1) {
  expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}

expect(fixture.version === "mytrusthub-watch-capabilities/validation-v1", "fixture version drift");
expect(fixture.environment === "validation_only", "fixture must remain non-production");
expect(fixture.sourceCheckStatus === "not_available", "fixture must not claim source checks");
expect(fixture.capabilities.length === 8, "accepted fixture must contain eight explicit grains");
expect(new Set(fixture.capabilities.map((item) => item.hub)).size === 6, "fixture must cover six specialist hubs");
for (const item of fixture.capabilities) {
  expect(seed.includes(item.key), `SQL validation seed missing ${item.key}`);
}
for (const hub of registry.hubs) {
  expect(hub.scopes.includes("watch:read") && hub.scopes.includes("watch:write"), `${hub.key} missing narrow Watch scopes`);
}

for (const typeName of [
  "WatchStatus","WatchCapability","WatchCoverage","WatchState",
  "AvailableCapability","StartWatchRequest","ModifyCoverageRequest",
]) expect(contract.includes(typeName), `typed contract missing ${typeName}`);
expect(contract.includes("/v1/my/saved/:savedId/watch-capabilities"), "available capability endpoint missing");
expect(contract.includes('resumePolicy: "next_accepted_observation"'), "pause catch-up policy missing");
expect(migration.includes("source_check_status"), "honest source-check placeholder missing");
expect(migration.includes("Monitoring source connection not yet active in this environment"), "source connection disclosure missing");
expect(migration.includes("consumer_watch_events_watch_idx"), "Watch event foreign key index missing");
expect(!migration.match(/create table\s+(consumer\.consumer_alerts|network\.source_observations|network\.network_change_events)/i), "P14 created a deferred observation/Alert table");

for (const prior of [
  "network.network_entities","consumer.consumer_profiles","ops.consumer_identity_links",
  "consumer.consumer_saved_entities","consumer.consumer_projects","consumer.consumer_notes",
  "ops.consumer_auth_handoffs","ops.consumer_context_handoffs",
]) expect(!rollback.includes(`drop table if exists ${prior}`), `P14 rollback removes prior foundation ${prior}`);

if (failures.length) {
  console.error(`P14 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P14 foundation static contract: PASS");
