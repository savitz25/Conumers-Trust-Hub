create or replace function consumer.fanout_change_event(p_change_event_id uuid)
returns table(matching_watches integer,alerts_created integer,duplicates_skipped integer,outcome text)
language plpgsql
security definer
set search_path=pg_catalog,network,consumer,ops
as $$
declare
  actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  event network.network_change_events%rowtype;
  event_rule network.alert_severity_rules%rowtype;
  template network.consumer_alert_templates%rowtype;
  match record;
  inserted_id uuid;
  project_snapshot jsonb;
begin
  if actor_role not in ('myth_alert_fanout','myth_p15_dbpr_runtime') then
    raise exception 'Alert fanout authorization required' using errcode='insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('alert-fanout:'||p_change_event_id::text,0));
  select * into event from network.network_change_events where id=p_change_event_id for update;
  if event.id is null then raise exception 'change event not found' using errcode='no_data_found'; end if;
  matching_watches:=0; alerts_created:=0; duplicates_skipped:=0;
  perform ops.record_alert_fanout_audit(event.id,'received');
  if event.status<>'active' or event.fanout_status<>'pending' then
    perform ops.record_alert_fanout_audit(event.id,'suppressed',0,0,0,
      case when event.status<>'active' then 'EVENT_NOT_ACTIVE' else 'FANOUT_NOT_PENDING' end);
    outcome:=case when event.status<>'active' then 'suppressed' else 'already_complete' end;
    return next;
    return;
  end if;
  select * into event_rule from network.alert_severity_rules where id=event.severity_rule_id;
  select * into template from network.consumer_alert_templates t
  where t.template_key=event_rule.safe_template_key
    and t.governance_status='approved' and t.effective_from<=statement_timestamp()
    and (t.effective_to is null or t.effective_to>statement_timestamp())
  order by t.version desc
  limit 1;
  if template.template_key is null then
    perform ops.record_alert_fanout_audit(event.id,'error',0,0,0,'TEMPLATE_UNAVAILABLE');
    outcome:='template_unavailable';
    return next;
    return;
  end if;

  for match in
    select w.id as watch_id,w.user_id,w.saved_entity_id
    from consumer.consumer_watches w
    join consumer.consumer_saved_entities s on s.id=w.saved_entity_id and s.user_id=w.user_id
    join consumer.consumer_watch_coverage c on c.watch_id=w.id
    where w.status='active' and c.status='enabled' and s.removed_at is null
      and c.capability_id=event.capability_id and c.capability_version=event.capability_version
      and network.resolve_canonical_entity(s.network_entity_id)=event.network_entity_id
      and event.observed_at>=greatest(w.resume_boundary_at,c.enabled_at)
  loop
    matching_watches:=matching_watches+1;
    select jsonb_build_object(
      'projects',coalesce(jsonb_agg(jsonb_build_object(
        'project_ref',p.id,'name',p.name,'status',p.status
      ) order by p.name,p.id),'[]'::jsonb),
      'captured_at',statement_timestamp()
    ) into project_snapshot
    from consumer.consumer_project_saved_entities m
    join consumer.consumer_projects p on p.id=m.project_id and p.user_id=match.user_id
    where m.saved_entity_id=match.saved_entity_id and m.removed_at is null;

    inserted_id:=null;
    insert into consumer.consumer_alerts(
      user_id,watch_id,change_event_id,template_key,template_version,severity,project_context_snapshot,
      source_as_of,observed_at
    ) values(
      match.user_id,match.watch_id,event.id,template.template_key,template.version,event.severity,project_snapshot,
      event.source_as_of,event.observed_at
    ) on conflict(watch_id,change_event_id) do nothing
    returning id into inserted_id;
    if inserted_id is null then duplicates_skipped:=duplicates_skipped+1;
    else alerts_created:=alerts_created+1;
    end if;
  end loop;
  update network.network_change_events set fanout_status='complete' where id=event.id;
  perform ops.record_alert_fanout_audit(event.id,'completed',matching_watches,alerts_created,duplicates_skipped);
  outcome:='complete';
  return next;
end;
$$;
