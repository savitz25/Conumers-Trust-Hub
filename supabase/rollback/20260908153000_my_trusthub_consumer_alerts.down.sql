-- Roll back P16 only. P11-P15 identity, research, handoff, Watch, and source
-- observation/change foundations remain intact.

begin;

revoke execute on function consumer.fanout_change_event(uuid) from myth_alert_fanout;
revoke execute on function network.approve_change_event_for_fanout(uuid,text) from myth_monitoring_operator;
revoke execute on function consumer.set_alert_read_state(uuid,boolean,bigint),
  consumer.mark_all_alerts_read(),
  consumer.list_alerts(text,boolean,integer,timestamptz),
  consumer.get_alert_detail(uuid),
  consumer.get_watch_coverage_checks(uuid),
  consumer.get_watch_summary(uuid),
  consumer.get_watch_observation_history(uuid,integer),
  consumer.get_alerts_overview(),
  consumer.get_cross_hub_entity_alert_state(uuid)
from authenticated,myth_consumer_api;

update ops.consumer_hub_registry
set allowed_scopes=array_remove(allowed_scopes,'alert:read')
where 'alert:read'=any(allowed_scopes);

drop function if exists consumer.get_cross_hub_entity_alert_state(uuid);
drop function if exists consumer.get_alerts_overview();
drop function if exists consumer.get_watch_observation_history(uuid,integer);
drop function if exists consumer.get_watch_summary(uuid);
drop function if exists consumer.get_watch_coverage_checks(uuid);
drop function if exists consumer.get_alert_detail(uuid);
drop function if exists consumer.list_alerts(text,boolean,integer,timestamptz);
drop function if exists consumer.mark_all_alerts_read();
drop function if exists consumer.enrich_alert_project_context(jsonb,uuid);
drop function if exists consumer.set_alert_read_state(uuid,boolean,bigint);
drop function if exists network.approve_change_event_for_fanout(uuid,text);
drop function if exists consumer.fanout_change_event(uuid);
drop function if exists ops.record_alert_fanout_audit(uuid,text,integer,integer,integer,text,jsonb);

drop table if exists ops.consumer_alert_fanout_audit;
drop table if exists consumer.consumer_alerts;
drop table if exists network.consumer_source_presentations;
drop table if exists network.consumer_alert_templates;

drop function if exists consumer.enforce_alert_integrity();
drop function if exists network.enforce_consumer_alert_template_version();

revoke usage on schema consumer,network,ops from myth_alert_fanout;
comment on role myth_alert_fanout is
  'Reserved least-privilege Alert fanout role; P16 is not installed.';

commit;
