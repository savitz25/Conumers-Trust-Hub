import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908180000_my_trusthub_notification_delivery.sql");
const rollback = read("supabase/rollback/20260908180000_my_trusthub_notification_delivery.down.sql");
const seed = read("supabase/seeds/p17_notification_delivery_validation.sql");
const sqlTests = read("supabase/tests/p17_notification_delivery.sql");
const contract = read("lib/my-trusthub/notification-contract.ts");
const crossHub = read("lib/my-trusthub/cross-hub-contract.ts");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const table of [
  "network.consumer_notification_templates",
  "consumer.consumer_notification_preferences",
  "consumer.consumer_watch_notification_overrides",
  "consumer.consumer_notification_events",
  "ops.consumer_alert_deliveries",
  "ops.consumer_alert_delivery_attempts",
]) {
  expect(migration.includes(`create table ${table}`), `missing ${table}`);
  expect(migration.includes(`alter table ${table} enable row level security`), `RLS not enabled for ${table}`);
  expect(migration.includes(`alter table ${table} force row level security`), `RLS not forced for ${table}`);
  expect(rollback.includes(`drop table if exists ${table}`), `rollback misses ${table}`);
}

for (const operation of [
  "consumer.get_notification_preferences",
  "consumer.update_notification_preferences",
  "consumer.set_watch_notification_override",
  "consumer.remove_watch_notification_override",
  "consumer.get_watch_notification_overrides",
  "consumer.email_delivery_enabled",
  "ops.enqueue_alert_delivery",
  "ops.delivery_still_eligible",
  "ops.process_mock_p0_email",
  "ops.get_p0_email_payload",
  "consumer.get_digest_eligibility",
  "consumer.get_periodic_watch_summary_eligibility",
]) expect(migration.includes(`function ${operation}`), `missing ${operation}`);

for (let id = 1; id <= 70; id += 1) {
  expect(sqlTests.includes(`'${id} `), `SQL matrix case ${id} missing`);
}

for (const typeName of [
  "NotificationPreferences","WatchNotificationOverride","DeliveryChannel","DeliveryStatus",
  "AlertDelivery","P0EmailPayload","DigestEligibility","WatchSummaryEligibility",
  "NotificationTransport","createDeterministicMockTransport",
]) expect(contract.includes(typeName), `typed notification contract missing ${typeName}`);

expect(migration.includes("p0_email_enabled boolean not null default true"), "P0 default drift");
expect(migration.includes("p1_digest_enabled boolean not null default true"), "P1 default drift");
expect(migration.includes("p2_digest_enabled boolean not null default false"), "P2 default drift");
expect(migration.includes("periodic_watch_summary_enabled boolean not null default true"), "Watch summary default drift");
expect(migration.includes("and coalesce((select o.enabled"), "global-and-override precedence missing");
expect(migration.includes("unique(alert_id,channel,delivery_type,template_key,template_version,delivery_window_key)"), "logical delivery uniqueness missing");
expect(migration.includes("unique(delivery_id,attempt_number)"), "attempt uniqueness missing");
expect(migration.includes("event.status<>'active'"), "event retraction/suppression gate missing");
expect(migration.includes("w.status<>'active'"), "Watch lifecycle send-time gate missing");
expect(migration.includes("consumer.get_watch_coverage_checks"), "summary does not reuse P16 no-change truth");
expect(migration.includes("check_state='no_change'"), "health-qualified no-change count missing");
expect(migration.includes("'/my/notifications'"), "parent-side manage-notifications destination missing");
expect(seed.includes("validation-fixture") && seed.includes("This is not a TrustHub verdict."), "reviewed validation template missing");
expect(contract.includes('mode: "mock" | "sandbox" | "production"'), "transport boundary missing");
expect(!crossHub.match(/consumerEmail|deliveryHistory|notificationPreferences/i), "specialist cross-hub contract exposes private delivery data");
expect(!migration.match(/resend|postmark|sendgrid|smtp|aws_ses|ses_client/i), "P17 locked or invoked a live provider");

for (const prior of [
  "network.network_entities","consumer.consumer_saved_entities","consumer.consumer_projects",
  "ops.consumer_auth_handoffs","network.watch_capabilities","consumer.consumer_watches",
  "network.source_observations","network.network_change_events","consumer.consumer_alerts",
]) expect(!rollback.includes(`drop table if exists ${prior}`), `P17 rollback removes prior foundation ${prior}`);

if (failures.length) {
  console.error(`P17 foundation static contract failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("P17 foundation static contract: PASS");
