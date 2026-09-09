import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

let checks = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(`P20D-PREP assertion failed: ${message}`);
}

function read(path) {
  return readFileSync(path, "utf8");
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const requiredRoutes = [
  "app/my/page.tsx",
  "app/my/sign-in/page.tsx",
  "app/my/saved/page.tsx",
  "app/my/projects/page.tsx",
  "app/my/projects/[projectId]/page.tsx",
  "app/auth/callback/route.ts",
];
const forbiddenRoutes = [
  "app/consumer-lab",
  "app/my/watches",
  "app/my/alerts",
  "app/my/notifications",
  "app/my/you",
  "app/v1/my",
];

for (const path of requiredRoutes) {
  assert(existsSync(path), `required route missing: ${path}`);
}
for (const path of forbiddenRoutes) {
  assert(!existsSync(path), `forbidden Stage 1 route present: ${path}`);
}

const runtimeFiles = [
  ...filesUnder("app/my"),
  ...filesUnder("app/auth"),
  ...filesUnder("components/my-trusthub"),
  "lib/my-trusthub/canary-access.ts",
  "lib/my-trusthub/feature-flags.ts",
  "lib/my-trusthub/page-data.ts",
  "lib/my-trusthub/production-adapter.ts",
  "lib/my-trusthub/runtime-config.ts",
  ...filesUnder("lib/supabase"),
  "proxy.ts",
].filter((path) => existsSync(path));
const runtimeSource = runtimeFiles.map((path) => read(path)).join("\n");

assert(!/consumer-lab|Boca|fictional provider/i.test(runtimeSource), "fixture/demo dependency in runtime");
assert(!/user_metadata|raw_user_meta_data/.test(runtimeSource), "user-editable metadata used by runtime");
assert(!/MY_TRUSTHUB_SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(runtimeSource), "admin secret referenced by runtime");
assert(!/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE)/.test(runtimeSource), "secret-shaped public variable");

const canary = read("lib/my-trusthub/canary-access.ts");
assert(
  canary.includes("approvedByTrustedClaim && (approvedById || approvedByEmail)"),
  "trusted app_metadata and approved identity are not both required",
);
assert(canary.includes("user.app_metadata?.my_trusthub_canary === true"), "trusted canary claim missing");

const actions = read("app/my/actions.ts");
assert(actions.includes("shouldCreateUser: flags.MY_TRUSTHUB_SIGNUP_ENABLED && !canaryOnly"), "canary OTP creation gate changed");
assert(actions.includes('assertMyTrustHubFeature("MY_TRUSTHUB_SAVED_ENABLED")'), "Save gate missing");
assert(actions.includes('assertMyTrustHubFeature("MY_TRUSTHUB_PROJECTS_ENABLED")'), "Project gate missing");

const adapter = read("lib/my-trusthub/production-adapter.ts");
for (const contract of [
  'this.rpc("save_entity"',
  "p_creation_key:",
  'this.rpc("add_saved_entity_to_project"',
  'this.rpc("remove_saved_entity_from_project"',
  'this.rpc("restore_project"',
]) {
  assert(adapter.includes(contract), `Stage 1 database contract missing: ${contract}`);
}
for (const forbiddenCapability of [
  "start_watch",
  "list_alerts",
  "request_export",
  "commit_guest_import",
  "record_project_decision",
]) {
  assert(!adapter.includes(forbiddenCapability), `later-stage adapter capability present: ${forbiddenCapability}`);
}

const flags = read("lib/my-trusthub/feature-flags.ts");
for (const key of [
  "MY_TRUSTHUB_ENABLED",
  "MY_TRUSTHUB_SIGNUP_ENABLED",
  "MY_TRUSTHUB_SAVED_ENABLED",
  "MY_TRUSTHUB_PROJECTS_ENABLED",
  "MY_TRUSTHUB_WATCH_ENABLED",
  "MY_TRUSTHUB_ALERTS_ENABLED",
  "MY_TRUSTHUB_EMAIL_ENABLED",
  "MY_TRUSTHUB_EXPORT_ENABLED",
  "MY_TRUSTHUB_DELETE_ENABLED",
  "MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED",
  "MY_TRUSTHUB_SOURCE_MONITORING_ENABLED",
]) {
  assert(flags.includes(`"${key}"`), `feature flag missing: ${key}`);
}
assert(flags.includes("master && enabled(process.env[key])"), "dependent flags do not require master gate");

const createScript = read("scripts/create-my-trusthub-canary.mjs");
for (const adminCall of [
  "auth.admin.listUsers",
  "auth.admin.createUser",
  "auth.admin.updateUserById",
  "app_metadata",
  "my_trusthub_canary: true",
]) {
  assert(createScript.includes(adminCall), `Auth Admin script missing: ${adminCall}`);
}
assert(!/auth\.users|insert\s+into/i.test(createScript), "Auth script contains direct auth.users SQL");
assert(!/user_metadata/.test(createScript), "Auth script writes user_metadata");
assert(!/console\.(log|error)\([^)]*secret/i.test(createScript), "Auth script may log secret");

const nextConfig = read("next.config.ts");
for (const header of [
  "private, no-store",
  "Vary",
  "X-Robots-Tag",
  "Referrer-Policy",
]) {
  assert(nextConfig.includes(header), `private route header missing: ${header}`);
}

assert(read("package.json").includes('"next": "16.3.3"'), "current production Next.js baseline not retained");
assert(existsSync("proxy.ts") && !existsSync("middleware.ts"), "Next.js 16 proxy convention not used");

console.log(`P20D-PREP static assertions: ${checks}/${checks} PASS`);
console.log(
  `Runtime files reviewed: ${runtimeFiles.map((path) => relative(".", path)).length}`,
);
