import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260908190000_my_trusthub_saved_sessions.sql");
const adapter = read("lib/my-trusthub/production-adapter.ts");
const actions = read("app/my/actions.ts");
const saved = read("app/my/saved/page.tsx");
const detail = read("app/my/sessions/[sessionId]/page.tsx");
const flags = read("lib/my-trusthub/feature-flags.ts");
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };

check(flags.includes("MY_TRUSTHUB_SESSIONS_ENABLED"), "dedicated session flag exists");
check(adapter.includes('rpc("save_session"') && adapter.includes('rpc("update_saved_session"'), "P18 save/update RPCs used");
check(adapter.includes('rpc("list_saved_session_summaries"'), "bounded P18 summary read model used");
check(adapter.includes('rpc("get_saved_session_for_resume"'), "P18 resume validation used");
check(adapter.includes('rpc("preview_guest_session_import"') && adapter.includes('rpc("commit_guest_session_import"'), "P18 guest import used");
check(actions.includes('schemaKey: "move.inventory/v1"') && actions.includes('schemaVersion: 1'), "explicit schema version used");
check(actions.includes("room_counts") && actions.includes("estimated_cubic_feet"), "reviewed Move inventory fields emitted");
check(!actions.match(/access_token|refresh_token|password|api_key|bank_account|card_number/), "actions do not accept sensitive fields");
check(saved.includes("Save a moving inventory session") && saved.includes("Continue research"), "Saved UX integrates sessions");
check(detail.includes("Resume in Move Trust Hub is not available yet"), "unconnected resume is honest");
check(detail.includes("Your saved research was preserved unchanged"), "unsupported versions preserve research");
check(migration.includes("SESSION_PAYLOAD_PROHIBITED_CONTENT") && migration.includes("session_json_has_prohibited_content"), "sensitive-field rejection preserved");
check(migration.includes("HANDOFF_ALREADY_USED") && migration.includes("status='consumed'"), "handoff replay protection preserved");
check(migration.includes("primary key(project_id,saved_session_id)"), "many-to-many membership preserved");
check(!actions.match(/consumer_watches|consumer_alerts|source_observation/), "no Watch or Alert side effects");

console.log(`My TrustHub Stage 3 assertions: ${passed}/15 PASS`);
