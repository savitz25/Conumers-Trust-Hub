-- Roll back P17 only. P11-P16 identity, research, handoff, Watch, source,
-- change-event, and consumer Alert foundations remain intact.

begin;

revoke execute on function ops.enqueue_alert_delivery(uuid,uuid),
  ops.process_mock_p0_email(uuid,text,timestamptz),ops.get_p0_email_payload(uuid)
from myth_notification_delivery;

revoke execute on function consumer.get_notification_preferences(),
  consumer.update_notification_preferences(boolean,boolean,boolean,boolean,text,time,bigint,uuid),
  consumer.set_watch_notification_override(uuid,text,boolean,uuid),
  consumer.remove_watch_notification_override(uuid,text,uuid),
  consumer.get_watch_notification_overrides(uuid),
  consumer.get_digest_eligibility(date),
  consumer.get_periodic_watch_summary_eligibility()
from authenticated,myth_consumer_api;

drop function if exists consumer.get_periodic_watch_summary_eligibility();
drop function if exists consumer.get_digest_eligibility(date);
drop function if exists ops.get_p0_email_payload(uuid);
drop function if exists ops.process_mock_p0_email(uuid,text,timestamptz);
drop function if exists ops.delivery_still_eligible(uuid);
drop function if exists ops.enqueue_alert_delivery(uuid,uuid);
drop function if exists ops.notification_retry_delay(integer);
drop function if exists ops.consumer_email_is_deliverable(uuid);
drop function if exists consumer.email_delivery_enabled(uuid,uuid,text);
drop function if exists consumer.get_watch_notification_overrides(uuid);
drop function if exists consumer.remove_watch_notification_override(uuid,text,uuid);
drop function if exists consumer.set_watch_notification_override(uuid,text,boolean,uuid);
drop function if exists consumer.update_notification_preferences(boolean,boolean,boolean,boolean,text,time,bigint,uuid);
drop function if exists consumer.get_notification_preferences();
drop function if exists consumer.notification_preferences_json(consumer.consumer_notification_preferences);

drop trigger if exists consumer_profiles_create_notification_preferences on consumer.consumer_profiles;
drop function if exists consumer.create_default_notification_preferences();

drop table if exists ops.consumer_alert_delivery_attempts;
drop table if exists ops.consumer_alert_deliveries;
drop table if exists consumer.consumer_notification_events;
drop table if exists consumer.consumer_watch_notification_overrides;
drop table if exists consumer.consumer_notification_preferences;
drop table if exists network.consumer_notification_templates;

drop function if exists network.enforce_notification_template_version();

revoke usage on schema consumer,network,ops from myth_notification_delivery;
comment on role myth_notification_delivery is
  'Reserved least-privilege notification delivery role; P17 is not installed.';

commit;
