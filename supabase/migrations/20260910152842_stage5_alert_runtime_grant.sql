begin;
grant execute on function ops.alert_fanout_pending_events(integer),consumer.fanout_change_event(uuid) to myth_p15_dbpr_runtime;
commit;
