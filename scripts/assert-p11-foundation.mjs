import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const migration = read("supabase/migrations/20260907160000_my_trusthub_identity_foundation.sql");
const rollback = read("supabase/rollback/20260907160000_my_trusthub_identity_foundation.down.sql");
const sqlTests = read("supabase/tests/p11_identity_foundation.sql");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const schema of ["network", "consumer", "ops"]) {
  expect(migration.includes(`create schema if not exists ${schema}`), `missing ${schema} schema`);
  expect(rollback.includes(`drop schema if exists ${schema} cascade`), `rollback does not remove ${schema}`);
}

for (const table of [
  "network.network_entities",
  "network.network_entity_bindings",
  "network.network_entity_redirects",
  "network.identity_governance_events",
  "consumer.consumer_profiles",
  "ops.consumer_identity_links",
  "ops.consumer_identity_link_events",
]) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
}

for (const deferredTable of [
  "consumer.consumer_saved_entities",
  "consumer.consumer_projects",
  "consumer.consumer_watches",
  "consumer.consumer_alerts",
]) {
  expect(!migration.includes(`create table ${deferredTable}`), `P12+ table created early: ${deferredTable}`);
}

expect(migration.includes("exclude using gist"), "accepted-identifier overlap guard missing");
expect(migration.includes("network.binding_is_watch_eligible"), "Watch-eligibility guard missing");
expect(migration.includes("binding_status = 'accepted'"), "accepted binding requirement missing");
expect(migration.includes("Email-only matching is prohibited"), "email-only identity linking is not prohibited");
expect(!migration.includes("'email_match',"), "email matching appears as an allowed verification method");
expect(migration.includes("network.create_entity_redirect"), "governed redirect function missing");
expect(migration.includes("ops.link_legacy_consumer_identity"), "governed legacy-link function missing");
expect(migration.includes("revoke all on schema network from public, anon, authenticated"), "network schema broad revoke missing");
expect(migration.includes("revoke all on schema consumer from public, anon, authenticated"), "consumer schema broad revoke missing");
expect(migration.includes("revoke all on schema ops from public, anon, authenticated"), "ops schema broad revoke missing");

for (const testId of [
  "1 Consumer A", "2 Consumer A", "3 Consumer A", "4 Consumer A", "5 Anonymous", "6 Anonymous",
  "7 Business-only", "8 Dual-role", "9 Dual-role", "10 Browser user", "11 Browser user",
  "12 Approved specialist", "13 Specialist-scoped", "14 Consumer has no network",
  "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10",
  "L1", "L2", "L3", "L4", "L5", "L6",
]) {
  expect(sqlTests.includes(`'${testId}`), `SQL matrix case ${testId} missing`);
}

expect(packageJson.name === packageLock.name, "package-lock package name is stale");
expect(packageJson.version === packageLock.version, "package-lock package version is stale");
expect(
  JSON.stringify(packageJson.dependencies) === JSON.stringify(packageLock.packages[""].dependencies),
  "package.json and package-lock root dependencies differ",
);
expect(!migration.match(/create table\s+(consumer\.)?(consumer_)?(saved|projects?|watches?|alerts?)/i), "migration exceeds P11 table boundary");

// Client-visible secrets are also checked in the build output during branch validation.
const publicServiceRoleName = ["NEXT_PUBLIC", "SUPABASE", "SERVICE_ROLE_KEY"].join("_");
expect(!read(".env.example").includes(publicServiceRoleName), "public service-role variable declared");

if (failures.length) {
  console.error(`P11 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("P11 foundation static contract: PASS");
