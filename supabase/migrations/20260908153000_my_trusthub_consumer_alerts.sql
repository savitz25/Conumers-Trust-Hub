-- My TrustHub P16: consumer Alerts, health-qualified Watch checks, and
-- consumer-safe Watch observation history.
-- Apply only after P11B-P15. This migration sends no notification and connects
-- no live source.

begin;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

comment on role myth_alert_fanout is
  'Parent-only Alert fanout worker. It may create Alerts from eligible P15 events but cannot send notifications or mutate consumer research.';

create table network.consumer_alert_templates (
  template_key text not null check (template_key ~ '^[a-z][a-z0-9_.:-]{2,127}$'),
  version integer not null check (version > 0),
  headline text not null check (char_length(btrim(headline)) between 1 and 180),
  body text not null check (char_length(btrim(body)) between 1 and 800),
  disclosure text not null default 'Extracts can lag. This is not a TrustHub verdict.'
    check (char_length(btrim(disclosure)) between 1 and 500),
  governance_status text not null default 'draft'
    check (governance_status in ('draft','review_required','approved','disabled','retired')),
  approved_by text null,
  effective_from timestamptz not null,
  effective_to timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key(template_key,version),
  check (effective_to is null or effective_to > effective_from),
  check ((governance_status='approved' and approved_by is not null) or governance_status<>'approved')
);

comment on table network.consumer_alert_templates is
  'Parent-reviewed deterministic consumer copy selected by a P15 severity rule. No freeform alert generation is permitted.';

create table network.consumer_source_presentations (
  source_key text primary key check (source_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  confirmation_ref text not null check (char_length(btrim(confirmation_ref)) between 1 and 300),
  governance_status text not null default 'draft'
    check (governance_status in ('draft','review_required','approved','disabled','retired')),
  approved_by text null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((governance_status='approved' and approved_by is not null) or governance_status<>'approved')
);

comment on table network.consumer_source_presentations is
  'Consumer-safe source organization names and controlled official confirmation references. It stores no regulator payload.';

create table consumer.consumer_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watch_id uuid not null references consumer.consumer_watches(id) on delete restrict,
  change_event_id uuid not null references network.network_change_events(id) on delete restrict,
  template_key text not null,
  template_version integer not null check (template_version>0),
  severity text not null check (severity in ('P0','P1','P2')),
  status text not null default 'unread' check (status in ('unread','read')),
  project_context_snapshot jsonb not null default '{"projects":[]}'::jsonb
    check (
      jsonb_typeof(project_context_snapshot)='object'
      and jsonb_typeof(project_context_snapshot->'projects')='array'
      and octet_length(project_context_snapshot::text)<=16384
    ),
  source_as_of timestamptz null,
  observed_at timestamptz not null,
  surfaced_at timestamptz not null default statement_timestamp(),
  read_at timestamptz null,
  row_version bigint not null default 1 check (row_version>0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  foreign key(template_key,template_version)
    references network.consumer_alert_templates(template_key,version) on delete restrict,
  unique(watch_id,change_event_id),
  check ((status='unread' and read_at is null) or (status='read' and read_at is not null))
);

create index consumer_alerts_user_time_idx
  on consumer.consumer_alerts(user_id,surfaced_at desc,id);
create index consumer_alerts_user_status_idx
  on consumer.consumer_alerts(user_id,status,surfaced_at desc);
create index consumer_alerts_watch_idx
  on consumer.consumer_alerts(watch_id,surfaced_at desc);
create index consumer_alerts_change_event_idx
  on consumer.consumer_alerts(change_event_id);
create index consumer_alerts_template_idx
  on consumer.consumer_alerts(template_key,template_version);

comment on table consumer.consumer_alerts is
  'One private consumer Alert per Watch and exact material change event. Read state changes attention only; history remains durable.';
comment on column consumer.consumer_alerts.project_context_snapshot is
  'Minimal Project name/status context captured at surfacing. Multiple Projects never duplicate the Alert.';

create table ops.consumer_alert_fanout_audit (
  id bigint generated always as identity primary key,
  change_event_id uuid not null references network.network_change_events(id) on delete restrict,
  action text not null check (action in ('received','completed','suppressed','event_released','error')),
  matching_watch_count integer not null default 0 check (matching_watch_count>=0),
  alerts_created integer not null default 0 check (alerts_created>=0),
  duplicates_skipped integer not null default 0 check (duplicates_skipped>=0),
  reason_code text null check (reason_code is null or reason_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail)='object' and octet_length(detail::text)<=4096),
  actor text not null,
  occurred_at timestamptz not null default statement_timestamp()
);

create index consumer_alert_fanout_audit_event_idx
  on ops.consumer_alert_fanout_audit(change_event_id,occurred_at desc);

comment on table ops.consumer_alert_fanout_audit is
  'Server-only Alert fanout counts and decisions. It never stores private notes or raw source payloads.';

create trigger consumer_alert_templates_set_updated_at
before update on network.consumer_alert_templates
for each row execute function network.set_updated_at();
create trigger consumer_source_presentations_set_updated_at
before update on network.consumer_source_presentations
for each row execute function network.set_updated_at();
create trigger consumer_alerts_set_updated_at
before update on consumer.consumer_alerts
for each row execute function network.set_updated_at();

create or replace function network.enforce_consumer_alert_template_version()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog
as $$
begin
  if old.governance_status in ('approved','disabled','retired') and (
    new.template_key is distinct from old.template_key
    or new.version is distinct from old.version
    or new.headline is distinct from old.headline
    or new.body is distinct from old.body
    or new.disclosure is distinct from old.disclosure
  ) then
    raise exception 'approved consumer Alert copy is immutable; create a new template version'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger consumer_alert_templates_immutable
before update on network.consumer_alert_templates
for each row execute function network.enforce_consumer_alert_template_version();

create or replace function consumer.enforce_alert_integrity()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,network,consumer
as $$
declare
  owned_watch consumer.consumer_watches%rowtype;
  event network.network_change_events%rowtype;
  canonical_entity uuid;
begin
  select * into owned_watch from consumer.consumer_watches where id=new.watch_id;
  select * into event from network.network_change_events where id=new.change_event_id;
  if owned_watch.id is null or event.id is null or owned_watch.user_id<>new.user_id then
    raise exception 'Alert owner, Watch, and event must resolve' using errcode='integrity_constraint_violation';
  end if;
  select network.resolve_canonical_entity(s.network_entity_id) into canonical_entity
  from consumer.consumer_saved_entities s
  where s.id=owned_watch.saved_entity_id;
  if canonical_entity is distinct from event.network_entity_id
    or not exists(
      select 1 from consumer.consumer_watch_coverage c
      where c.watch_id=owned_watch.id and c.capability_id=event.capability_id
        and c.capability_version=event.capability_version and c.status='enabled'
        and event.observed_at>=c.enabled_at
    )
    or event.observed_at<owned_watch.resume_boundary_at
    or not exists(
      select 1 from network.alert_severity_rules r
      join network.consumer_alert_templates t
        on t.template_key=new.template_key and t.version=new.template_version
      where r.id=event.severity_rule_id and r.safe_template_key=new.template_key
        and t.governance_status='approved'
    )
    or new.severity<>event.severity
    or new.source_as_of is distinct from event.source_as_of
    or new.observed_at<>event.observed_at then
    raise exception 'Alert does not match exact Watch coverage and source event'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger consumer_alerts_integrity
before insert or update of user_id,watch_id,change_event_id,template_key,template_version,severity,source_as_of,observed_at
on consumer.consumer_alerts
for each row execute function consumer.enforce_alert_integrity();

create or replace function ops.record_alert_fanout_audit(
  p_change_event_id uuid,
  p_action text,
  p_matching integer default 0,
  p_created integer default 0,
  p_duplicates integer default 0,
  p_reason text default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,ops
as $$
begin
  insert into ops.consumer_alert_fanout_audit(
    change_event_id,action,matching_watch_count,alerts_created,duplicates_skipped,
    reason_code,detail,actor
  ) values(
    p_change_event_id,p_action,p_matching,p_created,p_duplicates,p_reason,
    coalesce(p_detail,'{}'::jsonb),coalesce(nullif(current_setting('role',true),'none'),session_user::text)
  );
end;
$$;

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
  if actor_role<>'myth_alert_fanout' then
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

create or replace function network.approve_change_event_for_fanout(
  p_change_event_id uuid,p_reason text
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,network,ops
as $$
declare
  actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  event network.network_change_events%rowtype;
  checkpoint ops.source_feed_checkpoints%rowtype;
begin
  if actor_role<>'myth_monitoring_operator' then
    raise exception 'monitoring operator authorization required' using errcode='insufficient_privilege';
  end if;
  if p_reason is null or char_length(btrim(p_reason))<3 then
    raise exception 'controlled release reason required' using errcode='invalid_parameter_value';
  end if;
  select * into event from network.network_change_events where id=p_change_event_id for update;
  if event.id is null then raise exception 'change event not found' using errcode='no_data_found'; end if;
  select * into checkpoint from ops.source_feed_checkpoints where id=event.checkpoint_id;
  if event.status not in ('suppressed','quarantined') or checkpoint.mass_change_status<>'released' then
    raise exception 'event is not eligible for controlled release' using errcode='integrity_constraint_violation';
  end if;
  update network.network_change_events
  set status='active',fanout_status='pending'
  where id=event.id;
  perform ops.record_alert_fanout_audit(event.id,'event_released',0,0,0,null,
    jsonb_build_object('reason',btrim(p_reason),'original_observed_at',event.observed_at));
end;
$$;

create or replace function consumer.set_alert_read_state(
  p_alert_id uuid,p_read boolean,p_expected_row_version bigint
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare
  subject uuid:=consumer.require_user();
  current_alert consumer.consumer_alerts%rowtype;
  next_version bigint;
  target_status text:=case when p_read then 'read' else 'unread' end;
begin
  select * into current_alert from consumer.consumer_alerts
  where id=p_alert_id and user_id=subject for update;
  if current_alert.id is null then raise exception 'Alert not found' using errcode='42501'; end if;
  if current_alert.status=target_status then return current_alert.row_version; end if;
  if current_alert.row_version<>p_expected_row_version then
    raise exception 'ALERT_STALE' using errcode='serialization_failure';
  end if;
  update consumer.consumer_alerts a
  set status=target_status,read_at=case when p_read then statement_timestamp() else null end,
      row_version=a.row_version+1
  where a.id=p_alert_id returning a.row_version into next_version;
  return next_version;
end;
$$;

create or replace function consumer.enrich_alert_project_context(
  p_snapshot jsonb,p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,consumer
as $$
  select jsonb_build_object(
    'projects',coalesce(jsonb_agg(
      item || jsonb_build_object('current_status',coalesce(p.status,item->>'status'))
      order by item->>'name',item->>'project_ref'
    ),'[]'::jsonb),
    'captured_at',p_snapshot->'captured_at'
  )
  from jsonb_array_elements(coalesce(p_snapshot->'projects','[]'::jsonb)) item
  left join consumer.consumer_projects p
    on p.id=(item->>'project_ref')::uuid and p.user_id=p_user_id;
$$;

create or replace function consumer.mark_all_alerts_read()
returns integer
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); changed integer;
begin
  update consumer.consumer_alerts a
  set status='read',read_at=statement_timestamp(),row_version=a.row_version+1
  where a.user_id=subject and a.status='unread';
  get diagnostics changed=row_count;
  return changed;
end;
$$;

create or replace function consumer.list_alerts(
  p_severity text default null,p_unread_only boolean default false,
  p_limit integer default 25,p_before timestamptz default null
)
returns table(
  alert_id uuid,severity text,read_state text,headline text,hub text,
  entity_name text,official_as_of timestamptz,observed_at timestamptz,
  surfaced_at timestamptz,source_organization text,project_context jsonb,
  event_state text,row_version bigint
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer
as $$
declare subject uuid:=consumer.require_user(); bounded_limit integer:=least(greatest(coalesce(p_limit,25),1),100);
begin
  if p_severity is not null and p_severity not in ('P0','P1','P2') then
    raise exception 'invalid Alert severity filter' using errcode='invalid_parameter_value';
  end if;
  return query
  select a.id,a.severity,a.status,t.headline,cap.hub,e.canonical_name,
    a.source_as_of,a.observed_at,a.surfaced_at,coalesce(src.display_name,cap.source_key),
    consumer.enrich_alert_project_context(a.project_context_snapshot,subject),ce.status,a.row_version
  from consumer.consumer_alerts a
  join network.network_change_events ce on ce.id=a.change_event_id
  join network.network_entities e on e.id=ce.network_entity_id
  join network.watch_capabilities cap on cap.id=ce.capability_id and cap.version=ce.capability_version
  join network.consumer_alert_templates t on t.template_key=a.template_key and t.version=a.template_version
  left join network.consumer_source_presentations src on src.source_key=cap.source_key and src.governance_status='approved'
  where a.user_id=subject and (p_severity is null or a.severity=p_severity)
    and (not p_unread_only or a.status='unread')
    and (p_before is null or a.surfaced_at<p_before)
  order by a.surfaced_at desc,a.id
  limit bounded_limit;
end;
$$;

create or replace function consumer.get_alert_detail(p_alert_id uuid)
returns table(
  alert_id uuid,severity text,read_state text,event_state text,correction_notice text,
  hub text,entity_name text,identifier text,what_changed text,detail_body text,
  official_as_of timestamptz,checked_at timestamptz,observed_at timestamptz,
  source_organization text,source_confirmation_ref text,project_context jsonb,
  coverage_id uuid,capability_id uuid,capability_version integer,watched_grain text,
  coverage_display_name text,why_received text,disclosure text,row_version bigint
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer,ops
as $$
declare subject uuid:=consumer.require_user();
begin
  return query
  select a.id,a.severity,a.status,ce.status,
    case when ce.status='retracted' then 'The source corrected or retracted this previously surfaced event. The original Alert remains in your history.' else null end,
    cap.hub,e.canonical_name,b.source_identifier,t.headline,t.body,a.source_as_of,
    cp.last_success_at,a.observed_at,coalesce(src.display_name,cap.source_key),src.confirmation_ref,
    consumer.enrich_alert_project_context(a.project_context_snapshot,subject),c.id,cap.id,cap.version,cap.grain_key,cap.display_name,
    'You asked My TrustHub to Watch supported public-record changes for this record.',t.disclosure,a.row_version
  from consumer.consumer_alerts a
  join consumer.consumer_watches w on w.id=a.watch_id
  join consumer.consumer_saved_entities s on s.id=w.saved_entity_id
  left join network.network_entity_bindings b on b.id=s.source_binding_id
  join network.network_change_events ce on ce.id=a.change_event_id
  join network.network_entities e on e.id=ce.network_entity_id
  join network.watch_capabilities cap on cap.id=ce.capability_id and cap.version=ce.capability_version
  join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.capability_id=ce.capability_id and c.capability_version=ce.capability_version
  join network.consumer_alert_templates t on t.template_key=a.template_key and t.version=a.template_version
  join ops.source_feed_checkpoints cp on cp.id=ce.checkpoint_id
  left join network.consumer_source_presentations src on src.source_key=cap.source_key and src.governance_status='approved'
  where a.id=p_alert_id and a.user_id=subject;
end;
$$;

create or replace function consumer.get_watch_coverage_checks(p_saved_entity_id uuid)
returns table(
  coverage_id uuid,capability_id uuid,capability_key text,capability_version integer,
  coverage_display_name text,source_organization text,health_status text,
  last_successful_check timestamptz,source_as_of timestamptz,check_state text,
  alert_count integer,unread_alert_count integer,coverage_disclosure text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer,ops
as $$
declare subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype;
begin
  select * into saved from consumer.consumer_saved_entities
  where id=p_saved_entity_id and user_id=subject;
  if saved.id is null then raise exception 'Saved entity not found' using errcode='42501'; end if;
  return query
  with health as (
    select * from consumer.get_watch_source_health(saved.id)
  ), rows as (
    select c.id coverage_id,c.capability_id,cap.capability_key,c.capability_version,
      cap.display_name,coalesce(src.display_name,cap.source_key) source_name,
      h.health_status,h.last_successful_check,h.source_as_of,
      network.resolve_canonical_entity(saved.network_entity_id) canonical_entity,
      (select o.change_evaluation_status from network.source_observations o
       where o.network_entity_id=network.resolve_canonical_entity(saved.network_entity_id)
         and o.capability_id=c.capability_id and o.capability_version=c.capability_version
         and o.observation_status='accepted'
       order by o.sequence_effective_at desc,o.observed_at desc nulls last limit 1) latest_evaluation,
      network.coverage_no_change_eligible(c.id,statement_timestamp()) no_change,
      (select count(*)::integer from consumer.consumer_alerts a
       join network.network_change_events ce on ce.id=a.change_event_id
       where a.watch_id=w.id and ce.capability_id=c.capability_id
         and ce.capability_version=c.capability_version and ce.status='active') alert_total,
      (select count(*)::integer from consumer.consumer_alerts a
       join network.network_change_events ce on ce.id=a.change_event_id
       where a.watch_id=w.id and a.status='unread' and ce.capability_id=c.capability_id
         and ce.capability_version=c.capability_version and ce.status='active') unread_total,
      exists(select 1 from network.network_change_events ce
       where ce.network_entity_id=network.resolve_canonical_entity(saved.network_entity_id)
         and ce.capability_id=c.capability_id and ce.capability_version=c.capability_version
         and ce.status='active'
         and ce.observed_at>=greatest(w.resume_boundary_at,c.enabled_at)) has_material
    from consumer.consumer_watches w
    join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.status='enabled'
    join network.watch_capabilities cap on cap.id=c.capability_id and cap.version=c.capability_version
    join health h on h.coverage_id=c.id
    left join network.consumer_source_presentations src on src.source_key=cap.source_key and src.governance_status='approved'
    where w.saved_entity_id=saved.id
  )
  select r.coverage_id,r.capability_id,r.capability_key,r.capability_version,r.display_name,
    r.source_name,r.health_status,r.last_successful_check,r.source_as_of,
    case
      when r.health_status in ('delayed','degraded','unknown') then r.health_status
      when r.has_material then 'material_change'
      when r.no_change then 'no_change'
      when r.latest_evaluation='baseline' then 'baseline_only'
      else 'unknown'
    end,r.alert_total,r.unread_total,
    'No material change detected applies only to the public records included in this Watch coverage.'
  from rows r;
end;
$$;

create or replace function consumer.get_watch_summary(p_saved_entity_id uuid)
returns table(
  summary_state text,health_status text,alert_count integer,unread_alert_count integer,
  all_enabled_coverage_no_change boolean
)
language plpgsql
stable
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype;
begin
  select * into saved from consumer.consumer_saved_entities where id=p_saved_entity_id and user_id=subject;
  if saved.id is null then raise exception 'Saved entity not found' using errcode='42501'; end if;
  return query
  with checks as (select * from consumer.get_watch_coverage_checks(saved.id)), agg as (
    select count(*) coverage_count,
      coalesce(sum(c.alert_count),0)::integer alert_total,
      coalesce(sum(c.unread_alert_count),0)::integer unread_total,
      bool_and(c.check_state='no_change') no_change,
      max(case c.health_status when 'current' then 0 when 'delayed' then 1 when 'degraded' then 2 else 3 end) worst
    from checks c
  )
  select case
      when a.alert_total>0 then 'needs_attention'
      when a.worst=1 then 'delayed'
      when a.worst=2 then 'degraded'
      when a.worst=3 or a.coverage_count=0 then 'unknown'
      when a.no_change then 'current_no_change'
      else 'baseline_only'
    end,
    case a.worst when 0 then 'current' when 1 then 'delayed' when 2 then 'degraded' else 'unknown' end,
    a.alert_total,a.unread_total,coalesce(a.no_change,false)
  from agg a;
end;
$$;

create or replace function consumer.get_watch_observation_history(
  p_saved_entity_id uuid,p_limit integer default 50
)
returns table(
  occurred_at timestamptz,entry_type text,title text,capability_key text,
  source_organization text,alert_id uuid,event_state text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer
as $$
declare subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype;
  bounded_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
begin
  select * into saved from consumer.consumer_saved_entities where id=p_saved_entity_id and user_id=subject;
  if saved.id is null then raise exception 'Saved entity not found' using errcode='42501'; end if;
  return query
  with watch_row as (
    select w.id from consumer.consumer_watches w where w.saved_entity_id=saved.id
  ), history as (
    select we.occurred_at,we.event_type,
      case we.event_type
        when 'started' then 'Watch started' when 'paused' then 'Watch paused'
        when 'resumed' then 'Watch resumed' when 'stopped' then 'Watch stopped'
        when 'coverage_added' then 'Watch coverage added'
        when 'coverage_removed' then 'Watch coverage removed'
        when 'capability_retired' then 'Watch coverage retired'
        else 'Watch updated' end title,
      cap.capability_key,null::text source_name,null::uuid alert_id,null::text event_state
    from consumer.consumer_watch_events we
    join watch_row w on w.id=we.watch_id
    left join network.watch_capabilities cap on cap.id=we.capability_id
    union all
    select a.surfaced_at,
      case when ce.status='retracted' then 'source_correction' else 'material_change_surfaced' end,
      case when ce.status='retracted' then 'Source correction recorded' else t.headline end,
      cap.capability_key,coalesce(src.display_name,cap.source_key),a.id,ce.status
    from consumer.consumer_alerts a
    join watch_row w on w.id=a.watch_id
    join network.network_change_events ce on ce.id=a.change_event_id
    join network.watch_capabilities cap on cap.id=ce.capability_id
    join network.consumer_alert_templates t on t.template_key=a.template_key and t.version=a.template_version
    left join network.consumer_source_presentations src on src.source_key=cap.source_key and src.governance_status='approved'
    union all
    select c.last_successful_check,'source_checked_no_change','No material change detected',
      c.capability_key,c.source_organization,null::uuid,'active'
    from consumer.get_watch_coverage_checks(saved.id) c
    where c.check_state='no_change' and c.last_successful_check is not null
  )
  select h.occurred_at,h.event_type,h.title,h.capability_key,h.source_name,h.alert_id,h.event_state
  from history h
  order by h.occurred_at desc,h.event_type
  limit bounded_limit;
end;
$$;

create or replace function consumer.get_alerts_overview()
returns table(
  total_alerts integer,unread_alerts integer,p0_unread integer,p1_unread integer,p2_unread integer,
  all_read boolean,has_monitoring_health_issue boolean
)
language plpgsql
stable
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user();
begin
  return query
  with alert_counts as (
    select count(*)::integer total,count(*) filter(where status='unread')::integer unread,
      count(*) filter(where status='unread' and severity='P0')::integer p0,
      count(*) filter(where status='unread' and severity='P1')::integer p1,
      count(*) filter(where status='unread' and severity='P2')::integer p2
    from consumer.consumer_alerts where user_id=subject
  ), health as (
    select exists(
      select 1 from consumer.consumer_saved_entities s
      join consumer.consumer_watches w on w.saved_entity_id=s.id and w.status='active'
      cross join lateral consumer.get_watch_source_health(s.id) h
      where s.user_id=subject and s.removed_at is null and h.health_status<>'current'
    ) issue
  )
  select a.total,a.unread,a.p0,a.p1,a.p2,(a.total>0 and a.unread=0),h.issue
  from alert_counts a cross join health h;
end;
$$;

create or replace function consumer.get_cross_hub_entity_alert_state(p_network_entity_id uuid)
returns table(
  has_unread_alert boolean,alert_count integer,latest_severity text,
  latest_event_state text,latest_headline text,latest_alert_id uuid,latest_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer
as $$
declare subject uuid:=consumer.require_user(); canonical_id uuid:=network.resolve_canonical_entity(p_network_entity_id);
begin
  if not exists(
    select 1 from consumer.consumer_saved_entities s
    where s.user_id=subject and s.removed_at is null
      and network.resolve_canonical_entity(s.network_entity_id)=canonical_id
  ) then return; end if;
  return query
  with own_alerts as (
    select a.* from consumer.consumer_alerts a
    join consumer.consumer_watches w on w.id=a.watch_id
    join consumer.consumer_saved_entities s on s.id=w.saved_entity_id
    join network.network_change_events ce on ce.id=a.change_event_id
    where a.user_id=subject and network.resolve_canonical_entity(s.network_entity_id)=canonical_id
  ), latest as (
    select oa.id,oa.severity,oa.observed_at,oa.template_key,oa.template_version,ce.status event_state
    from own_alerts oa
    join network.network_change_events ce on ce.id=oa.change_event_id
    order by oa.surfaced_at desc,oa.id limit 1
  )
  select exists(select 1 from own_alerts where status='unread'),
    least((select count(*) from own_alerts),100)::integer,l.severity,l.event_state,t.headline,l.id,l.observed_at
  from (select true) seed
  left join latest l on true
  left join network.consumer_alert_templates t
    on t.template_key=l.template_key and t.version=l.template_version;
end;
$$;

alter table network.consumer_alert_templates enable row level security;
alter table network.consumer_alert_templates force row level security;
alter table network.consumer_source_presentations enable row level security;
alter table network.consumer_source_presentations force row level security;
alter table consumer.consumer_alerts enable row level security;
alter table consumer.consumer_alerts force row level security;
alter table ops.consumer_alert_fanout_audit enable row level security;
alter table ops.consumer_alert_fanout_audit force row level security;

create policy consumer_alert_templates_governor_all
on network.consumer_alert_templates for all to myth_capability_governor
using(true) with check(true);
create policy consumer_source_presentations_governor_all
on network.consumer_source_presentations for all to myth_capability_governor
using(true) with check(true);
create policy consumer_alerts_select_own
on consumer.consumer_alerts for select to authenticated
using((select auth.uid())=user_id);

revoke all on table network.consumer_alert_templates from public,anon,authenticated;
revoke all on table network.consumer_source_presentations from public,anon,authenticated;
revoke all on table consumer.consumer_alerts from public,anon,authenticated;
revoke all on table ops.consumer_alert_fanout_audit from public,anon,authenticated;

grant select,insert,update on network.consumer_alert_templates,network.consumer_source_presentations
  to myth_capability_governor;
grant select on consumer.consumer_alerts to authenticated;

grant usage on schema consumer,network,ops to myth_alert_fanout;
grant execute on function consumer.fanout_change_event(uuid) to myth_alert_fanout;
grant execute on function network.approve_change_event_for_fanout(uuid,text) to myth_monitoring_operator;

grant execute on function consumer.set_alert_read_state(uuid,boolean,bigint),
  consumer.mark_all_alerts_read(),
  consumer.list_alerts(text,boolean,integer,timestamptz),
  consumer.get_alert_detail(uuid),
  consumer.get_watch_coverage_checks(uuid),
  consumer.get_watch_summary(uuid),
  consumer.get_watch_observation_history(uuid,integer),
  consumer.get_alerts_overview(),
  consumer.get_cross_hub_entity_alert_state(uuid)
to authenticated,myth_consumer_api;

update ops.consumer_hub_registry r
set allowed_scopes=r.allowed_scopes||array['alert:read']
where not('alert:read'=any(r.allowed_scopes));

revoke all on function network.enforce_consumer_alert_template_version() from public;
revoke all on function consumer.enforce_alert_integrity() from public;
revoke all on function ops.record_alert_fanout_audit(uuid,text,integer,integer,integer,text,jsonb) from public;
revoke all on function consumer.fanout_change_event(uuid) from public;
revoke all on function network.approve_change_event_for_fanout(uuid,text) from public;
revoke all on function consumer.set_alert_read_state(uuid,boolean,bigint) from public;
revoke all on function consumer.enrich_alert_project_context(jsonb,uuid) from public;
revoke all on function consumer.mark_all_alerts_read() from public;
revoke all on function consumer.list_alerts(text,boolean,integer,timestamptz) from public;
revoke all on function consumer.get_alert_detail(uuid) from public;
revoke all on function consumer.get_watch_coverage_checks(uuid) from public;
revoke all on function consumer.get_watch_summary(uuid) from public;
revoke all on function consumer.get_watch_observation_history(uuid,integer) from public;
revoke all on function consumer.get_alerts_overview() from public;
revoke all on function consumer.get_cross_hub_entity_alert_state(uuid) from public;

commit;
