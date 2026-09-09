import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260907220000_my_trusthub_cross_hub_handoffs.sql");
const rollback = read("supabase/rollback/20260907220000_my_trusthub_cross_hub_handoffs.down.sql");
const sqlTests = read("supabase/tests/p13_cross_hub_handoffs.sql");
const typedContract = read("lib/my-trusthub/cross-hub-contract.ts");
const security = read("lib/my-trusthub/cross-hub-security.mjs");
const registry = JSON.parse(read("lib/my-trusthub/hub-registry.json"));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const p13Tables = [
  "ops.consumer_hub_registry",
  "ops.consumer_security_controls",
  "ops.consumer_rate_limit_events",
  "ops.consumer_browser_handoff_intents",
  "ops.consumer_auth_handoffs",
  "ops.consumer_context_handoffs",
  "ops.consumer_identity_link_attempts",
  "ops.consumer_handoff_events",
];
for (const table of p13Tables) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "ops.create_browser_handoff_intent",
  "ops.create_consumer_auth_handoff",
  "ops.create_legacy_consumer_auth_handoff",
  "ops.consume_consumer_auth_handoff",
  "ops.create_consumer_context_handoff",
  "ops.consume_consumer_context_handoff",
  "ops.clear_consumer_context",
  "ops.resolve_linked_consumer",
  "ops.start_consumer_identity_link_attempt",
  "consumer.get_cross_hub_entity_state",
  "consumer.get_cross_hub_entity_states_batch",
  "consumer.list_cross_hub_project_summaries",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

expect(registry.version === "mytrusthub-hubs/v1", "registry version drift");
expect(registry.hubs.length === 7, "registry must contain Ask and six specialists");
expect(registry.batchLimit === 50, "batch limit drift");
for (const hub of registry.hubs) {
  expect(migration.includes(`'${hub.key}'`), `SQL registry missing ${hub.key}`);
  expect(migration.includes(hub.serviceIdentity), `SQL service identity missing ${hub.key}`);
}

for (let id = 1; id <= 58; id += 1) expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
expect(typedContract.includes('MY_TRUSTHUB_API_PREFIX = "/v1/my"'), "versioned API prefix missing");
expect(typedContract.includes("IDENTITY_LINK_REQUIRED"), "safe error contract missing");
expect(security.includes('"Referrer-Policy": "no-referrer"'), "handoff referrer policy missing");
expect(security.includes("timingSafeEqual"), "constant-time CSRF comparison missing");
expect(!migration.match(/create table\s+consumer\.consumer_(watches|alerts)/i), "Watch/Alert table created early");
expect(!typedContract.includes("SUPABASE_SERVICE_ROLE_KEY"), "service secret name leaked into typed contract");
expect(!security.includes("SUPABASE_SERVICE_ROLE_KEY"), "service secret referenced by security contract");
for (const p11p12 of [
  "network.network_entities","consumer.consumer_profiles","ops.consumer_identity_links",
  "consumer.consumer_saved_entities","consumer.consumer_projects","consumer.consumer_notes",
]) expect(!rollback.includes(`drop table if exists ${p11p12}`), `P13 rollback removes ${p11p12}`);

if (failures.length) {
  console.error(`P13 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P13 foundation static contract: PASS");
