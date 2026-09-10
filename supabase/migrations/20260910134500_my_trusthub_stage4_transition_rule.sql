-- A deterministic source event only; consumer Alerts remain disabled.
begin;
insert into network.alert_severity_rules(capability_id,capability_version,classifier_key,rule_version,rule_priority,event_type,severity,safe_template_key,governance_status,enabled,effective_from,approved_by)
select id,version,'status_transition',1,100,'license_status_changed','P2','license_status_changed','approved',true,effective_from,'stage4_parent_closeout'
from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=1
on conflict(capability_id,rule_version,event_type,rule_priority) do nothing;
create or replace function ops.run_dbpr_poll(p_run text,p_started timestamptz,p_retrieved timestamptz,p_source_as_of timestamptz,p_rows jsonb,p_failure text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,ops,network as $$
declare cap uuid; checkpoint uuid; target record; submitted record; evaluated record; row_value jsonb;
  expected integer; checked integer:=0; changed integer:=0; quarantined integer:=0; health text;
begin
  -- No caller-supplied capability, source, namespace, SQL, or consumer identity.
  perform pg_advisory_xact_lock(hashtextextended('stage4:dbpr:poll',0));
  select id into strict cap from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=1 and enabled and governance_status='approved';
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>1000 or octet_length(p_rows::text)>262144 then raise exception 'INVALID_POLL_INPUT'; end if;
  if p_failure is not null and p_failure not in ('SOURCE_FETCH_FAILED','SOURCE_SCHEMA_INVALID','SOURCE_IDENTITY_MISSING','SOURCE_CLOCK_UNKNOWN') then raise exception 'INVALID_POLL_FAILURE'; end if;
  if p_started is null or p_retrieved is null or p_retrieved<p_started or p_retrieved>statement_timestamp()+interval '1 minute' then raise exception 'INVALID_POLL_CLOCK'; end if;
  select count(*) into expected from ops.dbpr_poll_targets();
  checkpoint:=ops.start_source_checkpoint(cap,p_run,'FL',expected,p_started);
  select health_status into health from ops.source_feed_checkpoints where id=checkpoint and run_status<>'running';
  if found then return jsonb_build_object('checkpoint',checkpoint,'deduplicated',true,'health',health); end if;
  if p_failure is not null or p_source_as_of is null or jsonb_array_length(p_rows)<>expected then
    health:=ops.complete_source_checkpoint(checkpoint,'failed',p_retrieved,p_source_as_of,p_retrieved,0,'failed',
      case when p_failure='SOURCE_SCHEMA_INVALID' then 'invalid' else 'unknown' end,
      coalesce(p_failure,'SOURCE_IDENTITY_MISSING'),'The authoritative source check could not be completed. No-change assurance is unavailable.');
    return jsonb_build_object('checkpoint',checkpoint,'health',health,'checked',0,'changes',0);
  end if;
  for target in select * from ops.dbpr_poll_targets() loop
    if (select count(*) from jsonb_array_elements(p_rows) r where r->>'credential'=target.credential)<>1 then raise exception 'INVALID_POLL_IDENTITY'; end if;
  end loop;
  health:=ops.complete_source_checkpoint(checkpoint,'succeeded',p_retrieved,p_source_as_of,p_retrieved,expected,'complete','compatible');
  for target in select * from ops.dbpr_poll_targets() loop
    select r into row_value from jsonb_array_elements(p_rows) r where r->>'credential'=target.credential;
    if row_value - array['credential','status'] <> '{}'::jsonb then raise exception 'INVALID_POLL_FIELDS'; end if;
    select * into submitted from network.submit_source_observation(target.binding_id,cap,checkpoint,target.credential,
      jsonb_build_object('status',row_value->>'status'),p_source_as_of,null,p_retrieved,null,null,
      'contractor.fl.dbpr.license_status/v1','https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv',null);
    select * into evaluated from network.accept_source_observation(submitted.observation_id);
    checked:=checked+1;
    if evaluated.change_event_id is not null then changed:=changed+1; end if;
    if evaluated.observation_status in ('quarantined','rejected') or evaluated.evaluation_status='quarantined' then quarantined:=quarantined+1; end if;
  end loop;
  select health_status into health from ops.source_feed_checkpoints where id=checkpoint;
  return jsonb_build_object('checkpoint',checkpoint,'health',health,'checked',checked,'changes',changed,'quarantined',quarantined);
end;
$$;

commit;
