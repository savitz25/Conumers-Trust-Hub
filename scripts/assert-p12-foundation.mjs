import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260907190000_my_trusthub_saved_projects_guest_import.sql");
const rollback = read("supabase/rollback/20260907190000_my_trusthub_saved_projects_guest_import.down.sql");
const tests = read("supabase/tests/p12_saved_projects_guest_import.sql");
const contract = read("lib/my-trusthub/contracts.ts");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const p12Tables = [
  "consumer.consumer_saved_entities",
  "consumer.consumer_projects",
  "consumer.consumer_project_saved_entities",
  "consumer.consumer_notes",
  "consumer.consumer_guest_imports",
  "consumer.consumer_guest_import_items",
];

for (const table of p12Tables) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback does not remove ${table}`);
}

for (const operation of [
  "consumer.save_entity",
  "consumer.remove_saved_entity",
  "consumer.create_project",
  "consumer.update_project",
  "consumer.archive_project",
  "consumer.restore_project",
  "consumer.add_saved_entity_to_project",
  "consumer.remove_saved_entity_from_project",
  "consumer.create_note",
  "consumer.update_note",
  "consumer.delete_note",
  "consumer.preview_guest_import",
  "consumer.commit_guest_import",
  "consumer.list_saved_entities",
  "consumer.list_projects",
]) expect(migration.includes(`function ${operation}`), `missing operation ${operation}`);

expect(migration.includes("unique (user_id, network_entity_id)"), "durable Save uniqueness missing");
expect(migration.includes("primary key (project_id, saved_entity_id)"), "durable membership uniqueness missing");
expect(migration.includes("Project and Saved entity must belong to the same consumer"), "cross-owner membership guard missing");
expect(migration.includes("Saved entity still belongs to one or more Projects"), "safe removal conflict missing");
expect(migration.includes("mytrusthub-guest/v1"), "guest schema version missing");
expect(migration.includes("262144"), "256 KB guest limit missing");
expect(migration.includes("interval '90 days'"), "90-day guest retention bound missing");
expect(migration.includes("request_fingerprint"), "guest idempotency fingerprint missing");
expect(migration.includes("not_selected"), "guest consent outcome missing");
expect(migration.includes("consumer_guest_import_items_network_entity_idx"), "guest item network-entity index missing");
expect(!migration.match(/create table\s+consumer\.consumer_(watches|alerts|saved_sessions|project_decisions)/i), "P13+ table created early");
expect(!migration.match(/insert\s+into\s+network\./i), "consumer operations write network state");

for (let id = 1; id <= 54; id += 1) {
  // 12a and 31a are supplemental; every numbered acceptance family still appears.
  expect(tests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}
expect(tests.includes("'12a "), "SQL matrix supplemental concurrency case 12a missing");
expect(tests.includes("'31a "), "SQL matrix supplemental review-required import case 31a missing");
expect(contract.includes('MY_TRUSTHUB_GUEST_VERSION = "mytrusthub-guest/v1"'), "TypeScript guest version drift");
expect(contract.includes("MY_TRUSTHUB_GUEST_MAX_BYTES = 256 * 1024"), "TypeScript guest size drift");
expect(contract.includes("MY_TRUSTHUB_GUEST_MAX_AGE_DAYS = 90"), "TypeScript guest retention drift");

// P12 rollback must leave the P11 root and registry untouched.
for (const p11Object of ["network.network_entities", "consumer.consumer_profiles", "ops.consumer_identity_links"]) {
  expect(!rollback.includes(`drop table if exists ${p11Object}`), `P12 rollback removes P11 object ${p11Object}`);
}

if (failures.length) {
  console.error(`P12 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("P12 foundation static contract: PASS");
