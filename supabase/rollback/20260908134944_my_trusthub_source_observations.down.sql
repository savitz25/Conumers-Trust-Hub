-- Roll back P15 only. P11-P14 identity, Saved/Project, handoff, and Watch
-- subscription foundations remain intact.

begin;

revoke execute on function consumer.get_watch_source_health(uuid) from authenticated,myth_consumer_api;
revoke execute on function consumer.get_watch_health(uuid) from authenticated,myth_consumer_api;
revoke execute on function network.accept_source_observation(uuid) from myth_change_detector;
revoke execute on function network.list_matching_active_watch_coverage(uuid) from myth_change_detector;
revoke execute on function network.set_capability_monitoring_state(uuid,text,text) from myth_monitoring_operator;
revoke execute on function ops.release_source_quarantine(uuid,text) from myth_monitoring_operator;
revoke execute on function network.retract_change_event(uuid,text) from myth_monitoring_operator;

revoke execute on function ops.start_source_checkpoint(uuid,text,text,bigint,timestamptz),
  ops.complete_source_checkpoint(uuid,text,timestamptz,timestamptz,timestamptz,bigint,text,text,text,text),
  network.submit_source_observation(uuid,uuid,uuid,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text)
from myth_source_ingestor_move,myth_source_ingestor_lender,myth_source_ingestor_insurance,
     myth_source_ingestor_contractor,myth_source_ingestor_senior,myth_source_ingestor_investor;

drop function if exists consumer.get_watch_health(uuid);
drop function if exists consumer.get_watch_source_health(uuid);
drop function if exists network.coverage_no_change_eligible(uuid,timestamptz);
drop function if exists network.list_matching_active_watch_coverage(uuid);
drop function if exists network.retract_change_event(uuid,text);
drop function if exists ops.release_source_quarantine(uuid,text);
drop function if exists network.set_capability_monitoring_state(uuid,text,text);
drop function if exists network.accept_source_observation(uuid);
drop function if exists network.submit_source_observation(uuid,uuid,uuid,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text);
drop function if exists ops.evaluate_checkpoint_health(uuid,timestamptz);
drop function if exists ops.complete_source_checkpoint(uuid,text,timestamptz,timestamptz,timestamptz,bigint,text,text,text,text);
drop function if exists ops.start_source_checkpoint(uuid,text,text,bigint,timestamptz);
drop function if exists ops.record_source_monitoring_event(text,uuid,uuid,uuid,uuid,jsonb);
drop function if exists network.extract_material_value(jsonb,text[]);
drop function if exists network.p15_ingestor_hub();

drop table if exists ops.source_monitoring_events;
drop table if exists network.network_change_events;
drop table if exists network.source_observations;
drop table if exists ops.source_feed_checkpoints;
drop table if exists network.alert_severity_rules;
drop table if exists network.watch_capability_observation_contracts;

drop function if exists network.enforce_severity_rule_version();
drop function if exists network.enforce_observation_contract_version();

revoke usage on schema network,ops from myth_monitoring_operator,
  myth_source_ingestor_move,myth_source_ingestor_lender,myth_source_ingestor_insurance,
  myth_source_ingestor_contractor,myth_source_ingestor_senior,myth_source_ingestor_investor;

drop role if exists myth_monitoring_operator;
drop role if exists myth_source_ingestor_move;
drop role if exists myth_source_ingestor_lender;
drop role if exists myth_source_ingestor_insurance;
drop role if exists myth_source_ingestor_contractor;
drop role if exists myth_source_ingestor_senior;
drop role if exists myth_source_ingestor_investor;

commit;
