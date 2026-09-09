-- My TrustHub P19: private decisions, immutable Research Snapshots, export,
-- and consumer-workspace deletion. Validation-only until separately approved.
begin;

alter table network.consumer_session_schemas
  add column export_policy text not null default 'summary_only'
    check(export_policy in ('full','redacted','summary_only')),
  add column export_redacted_keys text[] not null default '{}'::text[];

create table consumer.consumer_project_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references consumer.consumer_projects(id) on delete cascade,
  decision_type text not null check(decision_type in (
    'selected_provider','still_deciding','not_proceeding','completed_without_provider','other'
  )),
  private_note text null check(private_note is null or char_length(btrim(private_note)) between 1 and 4000),
  idempotency_key uuid not null,
  request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default statement_timestamp(),
  superseded_at timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check(row_version>0),
  unique(user_id,idempotency_key)
);
create index consumer_project_decisions_project_time_idx
  on consumer.consumer_project_decisions(project_id,recorded_at desc);
create unique index consumer_project_decisions_current_idx
  on consumer.consumer_project_decisions(project_id) where superseded_at is null;

comment on table consumer.consumer_project_decisions is
  'Append-only private consumer checkpoints. Selection is not endorsement, ranking, review, certification, or public provider state.';

create table consumer.consumer_project_decision_entities (
  decision_id uuid not null references consumer.consumer_project_decisions(id) on delete cascade,
  saved_entity_id uuid not null references consumer.consumer_saved_entities(id) on delete restrict,
  category text not null check(category in ('lender','insurance','contractor','move','senior','investor','other')),
  selected_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  primary key(decision_id,saved_entity_id,category)
);
create index consumer_project_decision_entities_saved_idx
  on consumer.consumer_project_decision_entities(saved_entity_id,decision_id);

create table consumer.consumer_research_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references consumer.consumer_projects(id) on delete cascade,
  decision_id uuid null unique references consumer.consumer_project_decisions(id) on delete cascade,
  snapshot_version text not null check(snapshot_version='mytrusthub-research-snapshot/v1'),
  snapshot_payload jsonb not null check(jsonb_typeof(snapshot_payload)='object' and octet_length(snapshot_payload::text)<=262144),
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default statement_timestamp()
);
create index consumer_research_snapshots_project_time_idx
  on consumer.consumer_research_snapshots(project_id,created_at desc);
create index consumer_research_snapshots_user_time_idx
  on consumer.consumer_research_snapshots(user_id,created_at desc);

comment on table consumer.consumer_research_snapshots is
  'Immutable private decision-time Research Snapshot. It stores stable references and minimal display facts, never full regulator datasets or certification claims.';

create table consumer.consumer_project_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references consumer.consumer_projects(id) on delete cascade,
  event_type text not null check(event_type in (
    'created','saved_entity_added','saved_entity_removed','session_added','session_removed',
    'watch_started','alert_surfaced','decision_recorded','snapshot_created',
    'completed','archived','reopened'
  )),
  saved_entity_id uuid null references consumer.consumer_saved_entities(id) on delete set null,
  saved_session_id uuid null references consumer.consumer_saved_sessions(id) on delete set null,
  watch_id uuid null references consumer.consumer_watches(id) on delete set null,
  alert_id uuid null references consumer.consumer_alerts(id) on delete set null,
  decision_id uuid null references consumer.consumer_project_decisions(id) on delete set null,
  idempotency_key uuid null,
  event_payload jsonb not null default '{}'::jsonb check(jsonb_typeof(event_payload)='object' and octet_length(event_payload::text)<=4096),
  occurred_at timestamptz not null default statement_timestamp()
);
create unique index consumer_project_events_idempotency_idx
  on consumer.consumer_project_events(user_id,idempotency_key) where idempotency_key is not null;
create index consumer_project_events_project_time_idx
  on consumer.consumer_project_events(project_id,occurred_at desc);
create index consumer_project_events_saved_entity_idx
  on consumer.consumer_project_events(saved_entity_id) where saved_entity_id is not null;
create index consumer_project_events_saved_session_idx
  on consumer.consumer_project_events(saved_session_id) where saved_session_id is not null;
create index consumer_project_events_watch_idx
  on consumer.consumer_project_events(watch_id) where watch_id is not null;
create index consumer_project_events_alert_idx
  on consumer.consumer_project_events(alert_id) where alert_id is not null;
create index consumer_project_events_decision_idx
  on consumer.consumer_project_events(decision_id) where decision_id is not null;

create table ops.consumer_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  export_version text not null check(export_version='mytrusthub-export/v1'),
  idempotency_key uuid not null,
  status text not null default 'queued' check(status in ('queued','processing','completed','failed','expired','cancelled')),
  requested_at timestamptz not null default statement_timestamp(),
  started_at timestamptz null,
  completed_at timestamptz null,
  expires_at timestamptz null,
  artifact_ref text null check(artifact_ref is null or artifact_ref ~ '^exports/[A-Za-z0-9/_-]{1,240}$'),
  artifact_hash text null check(artifact_hash is null or artifact_hash ~ '^[a-f0-9]{64}$'),
  assigned_worker_ref text null check(assigned_worker_ref is null or char_length(btrim(assigned_worker_ref)) between 1 and 100),
  lease_token_hash text null check(lease_token_hash is null or lease_token_hash ~ '^[a-f0-9]{64}$'),
  error_code text null check(error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check(row_version>0),
  unique(user_id,idempotency_key),
  check((status='completed')=(completed_at is not null)),
  check(status<>'completed' or (expires_at is not null and artifact_ref is not null and artifact_hash is not null))
);
create index consumer_export_jobs_user_time_idx on ops.consumer_export_jobs(user_id,requested_at desc);
create index consumer_export_jobs_queue_idx on ops.consumer_export_jobs(status,requested_at) where status in ('queued','processing');

create table ops.consumer_destructive_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check(purpose='delete_consumer_workspace'),
  code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'issued' check(status in ('issued','consumed','expired','revoked')),
  issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  check(expires_at>issued_at and expires_at<=issued_at+interval '10 minutes')
);
create index consumer_destructive_confirmations_user_idx on ops.consumer_destructive_confirmations(user_id,issued_at desc);

create table ops.consumer_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  subject_hash text not null check(subject_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key uuid not null,
  status text not null default 'grace_period' check(status in ('requested','grace_period','processing','completed','failed','cancelled')),
  requested_at timestamptz not null default statement_timestamp(),
  grace_expires_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  retention_expires_at timestamptz null,
  assigned_worker_ref text null check(assigned_worker_ref is null or char_length(btrim(assigned_worker_ref)) between 1 and 100),
  lease_token_hash text null check(lease_token_hash is null or lease_token_hash ~ '^[a-f0-9]{64}$'),
  failure_code text null check(failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check(row_version>0),
  unique(user_id,idempotency_key),
  check(status<>'completed' or completed_at is not null)
);
create index consumer_deletion_jobs_user_time_idx on ops.consumer_deletion_jobs(user_id,requested_at desc);
create index consumer_deletion_jobs_queue_idx on ops.consumer_deletion_jobs(status,grace_expires_at) where status in ('grace_period','processing','failed');
create unique index consumer_deletion_jobs_one_active_idx on ops.consumer_deletion_jobs(user_id)
  where user_id is not null and status in ('requested','grace_period','processing','failed');

create table ops.consumer_deletion_steps (
  deletion_job_id uuid not null references ops.consumer_deletion_jobs(id) on delete cascade,
  step_order smallint not null check(step_order between 1 and 6),
  step_key text not null check(step_key in (
    'suppress_delivery_handoffs','delete_notifications_alerts','delete_decisions_snapshots',
    'delete_sessions_notes_projects','delete_watches_saves','delete_profile_identity_links'
  )),
  status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  started_at timestamptz null,
  completed_at timestamptz null,
  last_error_code text null check(last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  updated_at timestamptz not null default statement_timestamp(),
  primary key(deletion_job_id,step_key),
  unique(deletion_job_id,step_order)
);

create trigger consumer_project_decisions_set_updated_at before update on consumer.consumer_project_decisions
for each row execute function network.set_updated_at();
create trigger consumer_export_jobs_set_updated_at before update on ops.consumer_export_jobs
for each row execute function network.set_updated_at();
create trigger consumer_deletion_jobs_set_updated_at before update on ops.consumer_deletion_jobs
for each row execute function network.set_updated_at();

create or replace function consumer.enforce_decision_append_only()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if new.id<>old.id or new.user_id<>old.user_id or new.project_id<>old.project_id
    or new.decision_type<>old.decision_type or new.private_note is distinct from old.private_note
    or new.idempotency_key<>old.idempotency_key or new.request_fingerprint<>old.request_fingerprint
    or new.recorded_at<>old.recorded_at or new.created_at<>old.created_at
    or old.superseded_at is not null or new.superseded_at is null
    or new.row_version<>old.row_version+1 then
    raise exception 'DECISION_APPEND_ONLY' using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;
revoke all on function consumer.enforce_decision_append_only() from public;
create trigger consumer_project_decisions_append_only before update on consumer.consumer_project_decisions
for each row execute function consumer.enforce_decision_append_only();

create or replace function consumer.reject_snapshot_update()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception 'RESEARCH_SNAPSHOT_IMMUTABLE' using errcode='integrity_constraint_violation';
end;
$$;
revoke all on function consumer.reject_snapshot_update() from public;
create trigger consumer_research_snapshots_immutable before update on consumer.consumer_research_snapshots
for each row execute function consumer.reject_snapshot_update();

create or replace function consumer.enforce_decision_selection_ownership()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare d consumer.consumer_project_decisions%rowtype; s consumer.consumer_saved_entities%rowtype;
begin
  select * into d from consumer.consumer_project_decisions where id=new.decision_id;
  select * into s from consumer.consumer_saved_entities where id=new.saved_entity_id;
  if d.id is null or s.id is null or d.user_id<>s.user_id or s.removed_at is not null then
    raise exception 'DECISION_ENTITY_OWNERSHIP_CONFLICT' using errcode='integrity_constraint_violation';
  end if;
  if not exists(select 1 from consumer.consumer_project_saved_entities m
    where m.project_id=d.project_id and m.saved_entity_id=s.id and m.removed_at is null) then
    raise exception 'DECISION_ENTITY_PROJECT_MEMBERSHIP_REQUIRED' using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;
revoke all on function consumer.enforce_decision_selection_ownership() from public;
create trigger consumer_project_decision_entities_ownership before insert on consumer.consumer_project_decision_entities
for each row execute function consumer.enforce_decision_selection_ownership();

create or replace function consumer.build_project_research_snapshot(p_project_id uuid,p_decision_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,network,consumer,ops as $$
declare subject uuid:=consumer.require_user(); p consumer.consumer_projects%rowtype;
  d consumer.consumer_project_decisions%rowtype; result jsonb;
begin
  select * into p from consumer.consumer_projects where id=p_project_id and user_id=subject;
  select * into d from consumer.consumer_project_decisions where id=p_decision_id and project_id=p.id and user_id=subject;
  if p.id is null or d.id is null then raise exception 'PROJECT_DECISION_NOT_FOUND' using errcode='no_data_found'; end if;
  select jsonb_build_object(
    'snapshot_version','mytrusthub-research-snapshot/v1',
    'project',jsonb_build_object('project_id',p.id,'name',p.name,'life_event_type',p.life_event_type,
      'status',p.status,'location_context',p.location_context,'target_date',p.target_date,
      'completed_at',p.completed_at,'archived_at',p.archived_at),
    'decision',jsonb_build_object('decision_id',d.id,'decision_type',d.decision_type,
      'recorded_at',d.recorded_at,'private_note',d.private_note),
    'selected_entities',coalesce((select jsonb_agg(jsonb_build_object(
      'saved_entity_id',de.saved_entity_id,'network_entity_id_at_snapshot',s.network_entity_id,
      'canonical_name_at_snapshot',ne.canonical_name,'category',de.category,
      'identifier_namespace',b.identifier_namespace,'source_identifier',b.source_identifier,
      'identity_resolution_state',s.identity_resolution_state) order by de.category,de.saved_entity_id)
      from consumer.consumer_project_decision_entities de
      join consumer.consumer_saved_entities s on s.id=de.saved_entity_id
      join network.network_entities ne on ne.id=s.network_entity_id
      left join network.network_entity_bindings b on b.id=s.source_binding_id
      where de.decision_id=d.id),'[]'::jsonb),
    'saved_entities',coalesce((select jsonb_agg(jsonb_build_object(
      'saved_entity_id',s.id,'network_entity_id_at_snapshot',s.network_entity_id,
      'canonical_name_at_snapshot',ne.canonical_name,'identity_resolution_state',s.identity_resolution_state,
      'membership_added_at',m.added_at) order by s.id)
      from consumer.consumer_project_saved_entities m
      join consumer.consumer_saved_entities s on s.id=m.saved_entity_id and s.removed_at is null
      join network.network_entities ne on ne.id=s.network_entity_id
      where m.project_id=p.id and m.removed_at is null),'[]'::jsonb),
    'watches',coalesce((select jsonb_agg(jsonb_build_object(
      'watch_id',w.id,'saved_entity_id',w.saved_entity_id,'status',w.status,
      'coverage',coalesce((select jsonb_agg(jsonb_build_object(
        'coverage_id',c.id,'capability_id',c.capability_id,'capability_key',cap.capability_key,
        'capability_version',c.capability_version,'source_key',cap.source_key,'grain_key',cap.grain_key,
        'status',c.status) order by c.id)
        from consumer.consumer_watch_coverage c join network.watch_capabilities cap on cap.id=c.capability_id
        where c.watch_id=w.id),'[]'::jsonb)) order by w.id)
      from consumer.consumer_project_saved_entities m
      join consumer.consumer_watches w on w.saved_entity_id=m.saved_entity_id
      where m.project_id=p.id and m.removed_at is null),'[]'::jsonb),
    'source_checks',coalesce((select jsonb_agg(jsonb_build_object(
      'coverage_id',c.id,'capability_id',c.capability_id,'capability_version',c.capability_version,
      'source_key',cap.source_key,'health_status',case when cp.id is null then 'unknown' else ops.evaluate_checkpoint_health(cp.id,d.recorded_at) end,
      'last_successful_check',cp.last_success_at,'source_as_of',cp.source_as_of,
      'completeness_status',coalesce(cp.completeness_status,'unknown'),
      'schema_status',coalesce(cp.schema_status,'unknown'),
      'no_change_qualified',network.coverage_no_change_eligible(c.id,d.recorded_at)) order by c.id)
      from consumer.consumer_project_saved_entities m
      join consumer.consumer_watches w on w.saved_entity_id=m.saved_entity_id
      join consumer.consumer_watch_coverage c on c.watch_id=w.id
      join network.watch_capabilities cap on cap.id=c.capability_id
      left join lateral(select x.* from ops.source_feed_checkpoints x
        where x.capability_id=c.capability_id and x.capability_version=c.capability_version
        order by x.completed_at desc nulls last,x.created_at desc limit 1) cp on true
      where m.project_id=p.id and m.removed_at is null),'[]'::jsonb),
    'alerts',coalesce((select jsonb_agg(jsonb_build_object(
      'alert_id',a.id,'watch_id',a.watch_id,'change_event_id',a.change_event_id,
      'severity',a.severity,'read_state',a.status,'event_state_at_snapshot',ce.status,
      'capability_id',ce.capability_id,'capability_version',ce.capability_version,
      'source_as_of',a.source_as_of,'observed_at',a.observed_at,'surfaced_at',a.surfaced_at) order by a.surfaced_at,a.id)
      from consumer.consumer_project_saved_entities m
      join consumer.consumer_watches w on w.saved_entity_id=m.saved_entity_id
      join consumer.consumer_alerts a on a.watch_id=w.id
      join network.network_change_events ce on ce.id=a.change_event_id
      where m.project_id=p.id and m.removed_at is null),'[]'::jsonb),
    'saved_sessions',coalesce((select jsonb_agg(jsonb_build_object(
      'saved_session_id',s.id,'hub',s.hub,'session_type',s.session_type,
      'schema_key',s.schema_key,'schema_version',s.schema_version,'summary',s.summary,
      'status',s.status,'updated_at',s.updated_at) order by s.id)
      from consumer.consumer_project_saved_sessions m
      join consumer.consumer_saved_sessions s on s.id=m.saved_session_id
      where m.project_id=p.id and m.removed_at is null),'[]'::jsonb),
    'disclosure','This is a record of your My TrustHub research state. It is not a certification, background check, recommendation, or endorsement.'
  ) into result;
  return result;
end;
$$;
revoke all on function consumer.build_project_research_snapshot(uuid,uuid) from public;

create or replace function consumer.record_project_decision(
  p_project_id uuid,p_decision_type text,p_private_note text,p_selections jsonb,p_idempotency_key uuid
)
returns table(decision_id uuid,snapshot_id uuid,created boolean)
language plpgsql security definer set search_path=pg_catalog,network,consumer,extensions as $$
declare subject uuid:=consumer.require_user(); p consumer.consumer_projects%rowtype;
  existing consumer.consumer_project_decisions%rowtype; v_decision uuid; v_snapshot uuid;
  v_payload jsonb; v_fp text; item jsonb;
begin
  p_selections:=coalesce(p_selections,'[]'::jsonb);
  if p_decision_type not in ('selected_provider','still_deciding','not_proceeding','completed_without_provider','other')
    then raise exception 'DECISION_TYPE_INVALID' using errcode='invalid_parameter_value'; end if;
  if p_private_note is not null and char_length(btrim(p_private_note)) not between 1 and 4000
    then raise exception 'DECISION_NOTE_INVALID' using errcode='check_violation'; end if;
  if jsonb_typeof(p_selections)<>'array' or jsonb_array_length(p_selections)>20
    then raise exception 'DECISION_SELECTIONS_INVALID' using errcode='check_violation'; end if;
  if (p_decision_type='selected_provider')<>(jsonb_array_length(p_selections)>0)
    then raise exception 'DECISION_SELECTION_REQUIREMENT_MISMATCH' using errcode='check_violation'; end if;
  if exists(select 1 from jsonb_array_elements(p_selections) x(value) where jsonb_typeof(x.value)<>'object'
    or exists(select 1 from jsonb_object_keys(x.value) k where k not in ('saved_entity_id','category'))
    or not(x.value?'saved_entity_id' and x.value?'category')
    or x.value->>'category' not in ('lender','insurance','contractor','move','senior','investor','other'))
    then raise exception 'DECISION_SELECTIONS_INVALID' using errcode='check_violation'; end if;
  select * into p from consumer.consumer_projects where id=p_project_id and user_id=subject for update;
  if p.id is null then raise exception 'PROJECT_NOT_FOUND' using errcode='no_data_found'; end if;
  v_fp:=encode(digest(jsonb_build_object('project_id',p_project_id,'type',p_decision_type,
    'note',p_private_note,'selections',p_selections)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(subject::text||':'||p_idempotency_key::text,0));
  select * into existing from consumer.consumer_project_decisions where user_id=subject and idempotency_key=p_idempotency_key;
  if existing.id is not null then
    if existing.request_fingerprint<>v_fp then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='unique_violation'; end if;
    select s.id into v_snapshot from consumer.consumer_research_snapshots s where s.decision_id=existing.id;
    return query select existing.id,v_snapshot,false; return;
  end if;
  update consumer.consumer_project_decisions d set superseded_at=statement_timestamp(),
    updated_at=statement_timestamp(),row_version=d.row_version+1
    where d.project_id=p.id and d.superseded_at is null;
  insert into consumer.consumer_project_decisions(user_id,project_id,decision_type,private_note,idempotency_key,request_fingerprint)
    values(subject,p.id,p_decision_type,case when p_private_note is null then null else btrim(p_private_note) end,p_idempotency_key,v_fp)
    returning id into v_decision;
  for item in select value from jsonb_array_elements(p_selections) loop
    insert into consumer.consumer_project_decision_entities(decision_id,saved_entity_id,category)
    values(v_decision,(item->>'saved_entity_id')::uuid,item->>'category');
  end loop;
  v_payload:=consumer.build_project_research_snapshot(p.id,v_decision);
  insert into consumer.consumer_research_snapshots(user_id,project_id,decision_id,snapshot_version,snapshot_payload,fingerprint)
    values(subject,p.id,v_decision,'mytrusthub-research-snapshot/v1',v_payload,encode(digest(v_payload::text,'sha256'),'hex'))
    returning id into v_snapshot;
  insert into consumer.consumer_project_events(user_id,project_id,event_type,decision_id,idempotency_key,event_payload)
    values(subject,p.id,'decision_recorded',v_decision,p_idempotency_key,jsonb_build_object('decision_type',p_decision_type));
  insert into consumer.consumer_project_events(user_id,project_id,event_type,decision_id,event_payload)
    values(subject,p.id,'snapshot_created',v_decision,jsonb_build_object('snapshot_id',v_snapshot,'snapshot_version','mytrusthub-research-snapshot/v1'));
  return query select v_decision,v_snapshot,true;
end;
$$;
revoke all on function consumer.record_project_decision(uuid,text,text,jsonb,uuid) from public;

create or replace function consumer.verify_research_snapshot(p_snapshot_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog,consumer,extensions as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_research_snapshots%rowtype;
begin
  select * into s from consumer.consumer_research_snapshots where id=p_snapshot_id and user_id=subject;
  if s.id is null then return false; end if;
  return s.fingerprint=encode(digest(s.snapshot_payload::text,'sha256'),'hex');
end;
$$;
revoke all on function consumer.verify_research_snapshot(uuid) from public;

create or replace function consumer.complete_project(
  p_project_id uuid,
  p_decision_id uuid,
  p_expected_row_version bigint,
  p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare
  v_subject uuid:=consumer.require_user();
  v_version bigint;
  v_existing_version bigint;
begin
  select (event_payload->>'row_version')::bigint into v_existing_version
  from consumer.consumer_project_events
  where user_id=v_subject and idempotency_key=p_idempotency_key and event_type='completed';
  if v_existing_version is not null then return v_existing_version; end if;

  if not exists(
    select 1 from consumer.consumer_project_decisions d
    join consumer.consumer_research_snapshots s on s.decision_id=d.id
    where d.id=p_decision_id and d.project_id=p_project_id and d.user_id=v_subject
      and d.superseded_at is null and d.decision_type<>'still_deciding'
  ) then
    raise exception 'COMPLETION_DECISION_REQUIRED' using errcode='check_violation';
  end if;

  update consumer.consumer_projects p
  set status='completed',completed_at=statement_timestamp(),archived_at=null,row_version=p.row_version+1
  where p.id=p_project_id and p.user_id=v_subject and p.status='active'
    and p.row_version=p_expected_row_version
  returning p.row_version into v_version;
  if v_version is null then raise exception 'PROJECT_NOT_FOUND_OR_STALE' using errcode='serialization_failure'; end if;

  insert into consumer.consumer_project_events(user_id,project_id,event_type,decision_id,idempotency_key,event_payload)
  values(v_subject,p_project_id,'completed',p_decision_id,p_idempotency_key,jsonb_build_object('row_version',v_version));
  return v_version;
end;
$$;
revoke all on function consumer.complete_project(uuid,uuid,bigint,uuid) from public;

create or replace function consumer.archive_project(p_project_id uuid,p_expected_row_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare v_subject uuid:=consumer.require_user(); v_version bigint; v_previous text;
begin
  select status into v_previous from consumer.consumer_projects
  where id=p_project_id and user_id=v_subject and row_version=p_expected_row_version for update;
  if v_previous not in ('active','completed') then
    raise exception 'PROJECT_NOT_FOUND_OR_STALE' using errcode='serialization_failure';
  end if;
  update consumer.consumer_projects p set status='archived',archived_at=statement_timestamp(),row_version=p.row_version+1
  where p.id=p_project_id returning p.row_version into v_version;
  insert into consumer.consumer_project_events(user_id,project_id,event_type,event_payload)
  values(v_subject,p_project_id,'archived',jsonb_build_object('previous_status',v_previous,'row_version',v_version));
  return v_version;
end;
$$;
revoke all on function consumer.archive_project(uuid,bigint) from public;

create or replace function consumer.restore_project(p_project_id uuid,p_expected_row_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare v_subject uuid:=consumer.require_user(); v_version bigint;
begin
  update consumer.consumer_projects p
  set status='active',archived_at=null,completed_at=null,row_version=p.row_version+1
  where p.id=p_project_id and p.user_id=v_subject and p.status='archived' and p.row_version=p_expected_row_version
  returning p.row_version into v_version;
  if v_version is null then raise exception 'PROJECT_NOT_FOUND_OR_STALE' using errcode='serialization_failure'; end if;
  insert into consumer.consumer_project_events(user_id,project_id,event_type,event_payload)
  values(v_subject,p_project_id,'reopened',jsonb_build_object('previous_status','archived','row_version',v_version));
  return v_version;
end;
$$;
revoke all on function consumer.restore_project(uuid,bigint) from public;

create or replace function consumer.reopen_project(p_project_id uuid,p_expected_row_version bigint,p_idempotency_key uuid)
returns bigint language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare v_subject uuid:=consumer.require_user(); v_version bigint; v_previous text; v_existing bigint;
begin
  select (event_payload->>'row_version')::bigint into v_existing from consumer.consumer_project_events
  where user_id=v_subject and idempotency_key=p_idempotency_key and event_type='reopened';
  if v_existing is not null then return v_existing; end if;
  select status into v_previous from consumer.consumer_projects
  where id=p_project_id and user_id=v_subject and row_version=p_expected_row_version for update;
  if v_previous not in ('completed','archived') then
    raise exception 'PROJECT_NOT_FOUND_OR_STALE' using errcode='serialization_failure';
  end if;
  update consumer.consumer_projects p set status='active',completed_at=null,archived_at=null,row_version=p.row_version+1
  where p.id=p_project_id returning p.row_version into v_version;
  insert into consumer.consumer_project_events(user_id,project_id,event_type,idempotency_key,event_payload)
  values(v_subject,p_project_id,'reopened',p_idempotency_key,jsonb_build_object('previous_status',v_previous,'row_version',v_version));
  return v_version;
end;
$$;
revoke all on function consumer.reopen_project(uuid,bigint,uuid) from public;

create or replace function consumer.list_project_decisions(p_project_id uuid)
returns setof consumer.consumer_project_decisions
language sql stable security definer set search_path=pg_catalog,consumer as $$
  select d.* from consumer.consumer_project_decisions d
  where d.project_id=p_project_id and d.user_id=consumer.require_user()
  order by d.recorded_at desc,d.id desc
$$;
revoke all on function consumer.list_project_decisions(uuid) from public;

create or replace function consumer.get_research_snapshot(p_snapshot_id uuid)
returns consumer.consumer_research_snapshots
language sql stable security definer set search_path=pg_catalog,consumer as $$
  select s from consumer.consumer_research_snapshots s
  where s.id=p_snapshot_id and s.user_id=consumer.require_user()
$$;
revoke all on function consumer.get_research_snapshot(uuid) from public;

create or replace function consumer.get_specialist_decision_context(
  p_project_id uuid,p_saved_entity_id uuid,p_hub text
)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,consumer as $$
declare v_subject uuid:=consumer.require_user(); v_result jsonb;
begin
  perform consumer.assert_session_actor(p_hub,'decision:read');
  select jsonb_build_object(
    'project_ref',p.id,'saved_ref',s.id,'selected',de.saved_entity_id is not null,
    'label',case when de.saved_entity_id is not null then 'Selected for this Project' else null end,
    'decision_type',d.decision_type,'category',de.category,'recorded_at',d.recorded_at
  ) into v_result
  from consumer.consumer_projects p
  join consumer.consumer_saved_entities s on s.id=p_saved_entity_id and s.user_id=v_subject
  left join consumer.consumer_project_decisions d on d.project_id=p.id and d.user_id=v_subject and d.superseded_at is null
  left join consumer.consumer_project_decision_entities de on de.decision_id=d.id and de.saved_entity_id=s.id
  where p.id=p_project_id and p.user_id=v_subject
    and exists(select 1 from consumer.consumer_project_saved_entities m
      where m.project_id=p.id and m.saved_entity_id=s.id and m.removed_at is null);
  return v_result;
end;
$$;
revoke all on function consumer.get_specialist_decision_context(uuid,uuid,text) from public;

create or replace function consumer.capture_project_created_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
begin
  insert into consumer.consumer_project_events(user_id,project_id,event_type,event_payload)
  values(new.user_id,new.id,'created',jsonb_build_object('life_event_type',new.life_event_type));
  return new;
end;
$$;
revoke all on function consumer.capture_project_created_event() from public;
create trigger consumer_projects_capture_created
after insert on consumer.consumer_projects for each row execute function consumer.capture_project_created_event();

create or replace function consumer.capture_saved_membership_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare v_user uuid; v_event text;
begin
  select user_id into v_user from consumer.consumer_projects where id=new.project_id;
  v_event:=case when new.removed_at is null then 'saved_entity_added' else 'saved_entity_removed' end;
  if tg_op='INSERT' or old.removed_at is distinct from new.removed_at then
    insert into consumer.consumer_project_events(user_id,project_id,event_type,saved_entity_id,event_payload)
    values(v_user,new.project_id,v_event,new.saved_entity_id,'{}');
  end if;
  return new;
end;
$$;
revoke all on function consumer.capture_saved_membership_event() from public;
create trigger consumer_project_saved_entities_capture_event
after insert or update of removed_at on consumer.consumer_project_saved_entities
for each row execute function consumer.capture_saved_membership_event();

create or replace function consumer.capture_session_membership_event()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare v_user uuid; v_event text;
begin
  select user_id into v_user from consumer.consumer_projects where id=new.project_id;
  v_event:=case when new.removed_at is null then 'session_added' else 'session_removed' end;
  if tg_op='INSERT' or old.removed_at is distinct from new.removed_at then
    insert into consumer.consumer_project_events(user_id,project_id,event_type,saved_session_id,event_payload)
    values(v_user,new.project_id,v_event,new.saved_session_id,'{}');
  end if;
  return new;
end;
$$;
revoke all on function consumer.capture_session_membership_event() from public;
create trigger consumer_project_saved_sessions_capture_event
after insert or update of removed_at on consumer.consumer_project_saved_sessions
for each row execute function consumer.capture_session_membership_event();

create or replace function consumer.capture_watch_started_events()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
begin
  insert into consumer.consumer_project_events(user_id,project_id,event_type,watch_id,event_payload)
  select new.user_id,m.project_id,'watch_started',new.id,'{}'::jsonb
  from consumer.consumer_project_saved_entities m
  where m.saved_entity_id=new.saved_entity_id and m.removed_at is null;
  return new;
end;
$$;
revoke all on function consumer.capture_watch_started_events() from public;
create trigger consumer_watches_capture_started
after insert on consumer.consumer_watches for each row execute function consumer.capture_watch_started_events();

create or replace function consumer.capture_alert_surfaced_events()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
begin
  insert into consumer.consumer_project_events(user_id,project_id,event_type,alert_id,event_payload)
  select new.user_id,m.project_id,'alert_surfaced',new.id,jsonb_build_object('severity',new.severity)
  from consumer.consumer_watches w join consumer.consumer_project_saved_entities m on m.saved_entity_id=w.saved_entity_id
  where w.id=new.watch_id and m.removed_at is null;
  return new;
end;
$$;
revoke all on function consumer.capture_alert_surfaced_events() from public;
create trigger consumer_alerts_capture_surfaced
after insert on consumer.consumer_alerts for each row execute function consumer.capture_alert_surfaced_events();

create or replace function network.set_consumer_session_export_policy(
  p_schema_key text,p_version integer,p_export_policy text,p_redacted_keys text[] default '{}'
)
returns void language plpgsql security definer set search_path=pg_catalog,network as $$
declare v_actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if v_actor<>'myth_session_governor' then raise exception 'SESSION_GOVERNOR_REQUIRED' using errcode='insufficient_privilege'; end if;
  if p_export_policy not in ('full','redacted','summary_only') then raise exception 'EXPORT_POLICY_INVALID' using errcode='invalid_parameter_value'; end if;
  update network.consumer_session_schemas s
  set export_policy=p_export_policy,export_redacted_keys=coalesce(p_redacted_keys,'{}')
  where s.schema_key=p_schema_key and s.version=p_version;
  if not found then raise exception 'SESSION_SCHEMA_NOT_FOUND' using errcode='no_data_found'; end if;
end;
$$;
revoke all on function network.set_consumer_session_export_policy(text,integer,text,text[]) from public;

create or replace function consumer.request_export(p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog,consumer,ops as $$
declare v_subject uuid:=consumer.require_user(); v_job uuid;
begin
  if not exists(select 1 from consumer.consumer_profiles where user_id=v_subject) then
    raise exception 'CONSUMER_WORKSPACE_NOT_FOUND' using errcode='no_data_found';
  end if;
  insert into ops.consumer_export_jobs(user_id,export_version,idempotency_key)
  values(v_subject,'mytrusthub-export/v1',p_idempotency_key)
  on conflict(user_id,idempotency_key) do update set user_id=excluded.user_id
  returning id into v_job;
  return v_job;
end;
$$;
revoke all on function consumer.request_export(uuid) from public;

create or replace function consumer.get_export_status(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,consumer,ops as $$
  select jsonb_build_object('export_ref',j.id,'version',j.export_version,'status',
    case when j.status='completed' and j.expires_at<=statement_timestamp() then 'expired' else j.status end,
    'requested_at',j.requested_at,'completed_at',j.completed_at,'expires_at',j.expires_at,
    'artifact_available',j.status='completed' and j.expires_at>statement_timestamp())
  from ops.consumer_export_jobs j where j.id=p_job_id and j.user_id=consumer.require_user()
$$;
revoke all on function consumer.get_export_status(uuid) from public;

create or replace function ops.claim_consumer_export_job(
  p_job_id uuid,p_worker_ref text,p_lease_token text
)
returns boolean language plpgsql security definer set search_path=pg_catalog,ops,extensions as $$
declare v_actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if v_actor<>'myth_export_worker' then raise exception 'EXPORT_WORKER_REQUIRED' using errcode='insufficient_privilege'; end if;
  update ops.consumer_export_jobs j set status='processing',started_at=coalesce(started_at,statement_timestamp()),
    assigned_worker_ref=p_worker_ref,lease_token_hash=encode(digest(p_lease_token,'sha256'),'hex'),row_version=j.row_version+1
  where j.id=p_job_id and j.status in ('queued','failed');
  return found;
end;
$$;
revoke all on function ops.claim_consumer_export_job(uuid,text,text) from public;

create or replace function ops.assert_export_job_lease(p_job_id uuid,p_lease_token text)
returns ops.consumer_export_jobs language plpgsql stable security definer set search_path=pg_catalog,ops,extensions as $$
declare v_job ops.consumer_export_jobs%rowtype; v_actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if v_actor<>'myth_export_worker' then raise exception 'EXPORT_WORKER_REQUIRED' using errcode='insufficient_privilege'; end if;
  select * into v_job from ops.consumer_export_jobs j where j.id=p_job_id and j.status='processing'
    and j.lease_token_hash=encode(digest(p_lease_token,'sha256'),'hex');
  if v_job.id is null then raise exception 'EXPORT_JOB_LEASE_INVALID' using errcode='insufficient_privilege'; end if;
  return v_job;
end;
$$;
revoke all on function ops.assert_export_job_lease(uuid,text) from public;

create or replace function ops.build_consumer_export_bundle(p_job_id uuid,p_lease_token text)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,network,consumer,ops as $$
declare v_job ops.consumer_export_jobs%rowtype; v_bundle jsonb;
begin
  v_job:=ops.assert_export_job_lease(p_job_id,p_lease_token);
  select jsonb_build_object(
    'manifest',jsonb_build_object('version','mytrusthub-export/v1','export_ref',v_job.id,
      'requested_at',v_job.requested_at,'sections',jsonb_build_array(
        'profile','projects','saved_entities','project_memberships','private_notes','watches','watch_coverage',
        'alerts','notification_preferences','watch_notification_overrides','saved_sessions','session_project_memberships',
        'decisions','research_snapshots','guest_import_receipts','project_events','recent_research')),
    'profile',(select jsonb_build_object('preferred_zip',p.preferred_zip,'research_memory_enabled',p.research_memory_enabled,
      'created_at',p.created_at,'updated_at',p.updated_at) from consumer.consumer_profiles p where p.user_id=v_job.user_id),
    'notification_preferences',(select to_jsonb(n)-array['user_id','created_at','updated_at'] from consumer.consumer_notification_preferences n where n.user_id=v_job.user_id),
    'watch_notification_overrides',coalesce((select jsonb_agg(to_jsonb(o) order by o.watch_id,o.severity)
      from consumer.consumer_watch_notification_overrides o join consumer.consumer_watches w on w.id=o.watch_id where w.user_id=v_job.user_id),'[]'),
    'projects',coalesce((select jsonb_agg(to_jsonb(p)-'user_id'-'creation_key' order by p.created_at,p.id) from consumer.consumer_projects p where p.user_id=v_job.user_id),'[]'),
    'saved_entities',coalesce((select jsonb_agg(jsonb_build_object('saved_ref',s.id,'network_entity_ref',s.network_entity_id,
      'canonical_name',ne.canonical_name,'source_hub',s.source_hub,'identity_resolution_state',s.identity_resolution_state,
      'saved_at',s.saved_at,'removed_at',s.removed_at) order by s.saved_at,s.id)
      from consumer.consumer_saved_entities s join network.network_entities ne on ne.id=s.network_entity_id where s.user_id=v_job.user_id),'[]'),
    'project_memberships',coalesce((select jsonb_agg(to_jsonb(m) order by m.project_id,m.saved_entity_id)
      from consumer.consumer_project_saved_entities m join consumer.consumer_projects p on p.id=m.project_id where p.user_id=v_job.user_id),'[]'),
    'private_notes',coalesce((select jsonb_agg(to_jsonb(n)-'user_id' order by n.created_at,n.id) from consumer.consumer_notes n where n.user_id=v_job.user_id),'[]'),
    'watches',coalesce((select jsonb_agg(to_jsonb(w)-'user_id' order by w.created_at,w.id) from consumer.consumer_watches w where w.user_id=v_job.user_id),'[]'),
    'watch_coverage',coalesce((select jsonb_agg(to_jsonb(c) order by c.watch_id,c.id) from consumer.consumer_watch_coverage c join consumer.consumer_watches w on w.id=c.watch_id where w.user_id=v_job.user_id),'[]'),
    'alerts',coalesce((select jsonb_agg(jsonb_build_object('alert_ref',a.id,'watch_ref',a.watch_id,'change_event_ref',a.change_event_id,
      'severity',a.severity,'read_state',a.status,'project_context_snapshot',a.project_context_snapshot,
      'source_as_of',a.source_as_of,'observed_at',a.observed_at,
      'surfaced_at',a.surfaced_at,'event_status',e.status,'capability_ref',e.capability_id,'capability_version',e.capability_version)
      order by a.surfaced_at,a.id) from consumer.consumer_alerts a join network.network_change_events e on e.id=a.change_event_id where a.user_id=v_job.user_id),'[]'),
    'saved_sessions',coalesce((select jsonb_agg(jsonb_build_object('session_ref',s.id,'hub',s.hub,'session_type',s.session_type,
      'schema_key',s.schema_key,'schema_version',s.schema_version,'status',s.status,'summary',s.summary,
      'payload',case r.export_policy when 'full' then s.payload when 'redacted' then s.payload-r.export_redacted_keys else null end,
      'export_policy',r.export_policy,'created_at',s.created_at,'updated_at',s.updated_at,'last_resumed_at',s.last_resumed_at) order by s.created_at,s.id)
      from consumer.consumer_saved_sessions s join network.consumer_session_schemas r on r.schema_key=s.schema_key and r.version=s.schema_version
      where s.user_id=v_job.user_id),'[]'),
    'session_project_memberships',coalesce((select jsonb_agg(to_jsonb(m) order by m.project_id,m.saved_session_id)
      from consumer.consumer_project_saved_sessions m join consumer.consumer_saved_sessions s on s.id=m.saved_session_id
      where s.user_id=v_job.user_id),'[]'),
    'decisions',coalesce((select jsonb_agg(to_jsonb(d)-'user_id'-'idempotency_key'-'request_fingerprint' order by d.recorded_at,d.id)
      from consumer.consumer_project_decisions d where d.user_id=v_job.user_id),'[]'),
    'research_snapshots',coalesce((select jsonb_agg(to_jsonb(s)-'user_id' order by s.created_at,s.id) from consumer.consumer_research_snapshots s where s.user_id=v_job.user_id),'[]'),
    'guest_import_receipts',jsonb_build_object(
      'saved_entities',coalesce((select jsonb_agg(to_jsonb(g)-'user_id'-'idempotency_key' order by g.created_at,g.id) from consumer.consumer_guest_imports g where g.user_id=v_job.user_id),'[]'),
      'saved_sessions',coalesce((select jsonb_agg(to_jsonb(g)-'user_id'-'idempotency_key' order by g.created_at,g.id) from consumer.consumer_guest_session_imports g where g.user_id=v_job.user_id),'[]')),
    'project_events',coalesce((select jsonb_agg(to_jsonb(e)-'user_id'-'idempotency_key' order by e.occurred_at,e.id) from consumer.consumer_project_events e where e.user_id=v_job.user_id),'[]'),
    'recent_research','[]'::jsonb,
    'exclusions',jsonb_build_array('authentication secrets','Business Manager data','raw regulator datasets','identity confidence','delivery provider internals')
  ) into v_bundle;
  return v_bundle;
end;
$$;
revoke all on function ops.build_consumer_export_bundle(uuid,text) from public;

create or replace function ops.complete_consumer_export_job(
  p_job_id uuid,p_lease_token text,p_artifact_ref text
)
returns text language plpgsql security definer set search_path=pg_catalog,ops,extensions as $$
declare v_bundle jsonb; v_hash text;
begin
  perform ops.assert_export_job_lease(p_job_id,p_lease_token);
  if p_artifact_ref!~'^exports/[A-Za-z0-9/_-]{1,240}$' then raise exception 'EXPORT_ARTIFACT_REF_INVALID' using errcode='invalid_parameter_value'; end if;
  v_bundle:=ops.build_consumer_export_bundle(p_job_id,p_lease_token);
  v_hash:=encode(digest(v_bundle::text,'sha256'),'hex');
  update ops.consumer_export_jobs j set status='completed',completed_at=statement_timestamp(),
    expires_at=statement_timestamp()+interval '7 days',artifact_ref=p_artifact_ref,artifact_hash=v_hash,
    lease_token_hash=null,row_version=j.row_version+1 where j.id=p_job_id;
  return v_hash;
end;
$$;
revoke all on function ops.complete_consumer_export_job(uuid,text,text) from public;

create or replace function ops.fail_consumer_export_job(p_job_id uuid,p_lease_token text,p_error_code text)
returns void language plpgsql security definer set search_path=pg_catalog,ops as $$
begin
  perform ops.assert_export_job_lease(p_job_id,p_lease_token);
  update ops.consumer_export_jobs j set status='failed',error_code=p_error_code,lease_token_hash=null,row_version=j.row_version+1 where j.id=p_job_id;
end;
$$;
revoke all on function ops.fail_consumer_export_job(uuid,text,text) from public;

create or replace function ops.issue_consumer_destructive_confirmation(
  p_user_id uuid,p_raw_code text
)
returns uuid language plpgsql security definer set search_path=pg_catalog,ops,consumer,extensions as $$
declare v_id uuid; v_actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if v_actor<>'myth_deletion_worker' then raise exception 'DELETION_WORKER_REQUIRED' using errcode='insufficient_privilege'; end if;
  if not exists(select 1 from consumer.consumer_profiles where user_id=p_user_id) then
    raise exception 'CONSUMER_WORKSPACE_NOT_FOUND' using errcode='no_data_found';
  end if;
  insert into ops.consumer_destructive_confirmations(user_id,purpose,code_hash,expires_at)
  values(p_user_id,'delete_consumer_workspace',encode(digest(p_raw_code,'sha256'),'hex'),statement_timestamp()+interval '10 minutes')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function ops.issue_consumer_destructive_confirmation(uuid,text) from public;

create or replace function consumer.request_workspace_deletion(
  p_confirmation_code text,p_idempotency_key uuid
)
returns uuid language plpgsql security definer set search_path=pg_catalog,consumer,ops,extensions as $$
declare v_subject uuid:=consumer.require_user(); v_confirmation uuid; v_job uuid;
begin
  if not exists(select 1 from consumer.consumer_profiles where user_id=v_subject) then
    raise exception 'CONSUMER_WORKSPACE_NOT_FOUND' using errcode='no_data_found';
  end if;
  select id into v_job from ops.consumer_deletion_jobs
  where user_id=v_subject and idempotency_key=p_idempotency_key;
  if v_job is not null then return v_job; end if;
  select id into v_job from ops.consumer_deletion_jobs
  where user_id=v_subject and status in ('requested','grace_period','processing','failed') order by requested_at desc limit 1;
  if v_job is not null then return v_job; end if;
  update ops.consumer_destructive_confirmations c set status='consumed',consumed_at=statement_timestamp()
  where c.user_id=v_subject and c.purpose='delete_consumer_workspace' and c.status='issued'
    and c.expires_at>statement_timestamp() and c.code_hash=encode(digest(p_confirmation_code,'sha256'),'hex')
  returning c.id into v_confirmation;
  if v_confirmation is null then raise exception 'DELETION_CONFIRMATION_INVALID' using errcode='insufficient_privilege'; end if;
  insert into ops.consumer_deletion_jobs(user_id,subject_hash,idempotency_key,status,grace_expires_at)
  values(v_subject,encode(digest(v_subject::text,'sha256'),'hex'),p_idempotency_key,'grace_period',statement_timestamp()+interval '7 days')
  returning id into v_job;
  insert into ops.consumer_deletion_steps(deletion_job_id,step_order,step_key) values
    (v_job,1,'suppress_delivery_handoffs'),(v_job,2,'delete_notifications_alerts'),
    (v_job,3,'delete_decisions_snapshots'),(v_job,4,'delete_sessions_notes_projects'),
    (v_job,5,'delete_watches_saves'),(v_job,6,'delete_profile_identity_links');
  update ops.consumer_alert_deliveries set status='cancelled',delivered_at=null,
    failed_at=null,suppressed_at=null,next_attempt_at=null where user_id=v_subject and status in ('pending','processing');
  return v_job;
end;
$$;
revoke all on function consumer.request_workspace_deletion(text,uuid) from public;

create or replace function consumer.cancel_workspace_deletion(p_job_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,consumer,ops as $$
declare v_subject uuid:=consumer.require_user();
begin
  update ops.consumer_deletion_jobs j set status='cancelled',row_version=j.row_version+1
  where j.id=p_job_id and j.user_id=v_subject and j.status='grace_period'
    and j.grace_expires_at>statement_timestamp();
  return found;
end;
$$;
revoke all on function consumer.cancel_workspace_deletion(uuid) from public;

create or replace function consumer.get_workspace_deletion_status(p_job_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,consumer,ops as $$
  select jsonb_build_object('deletion_ref',j.id,'status',j.status,'requested_at',j.requested_at,
    'grace_expires_at',j.grace_expires_at,'completed_at',j.completed_at)
  from ops.consumer_deletion_jobs j where j.id=p_job_id and j.user_id=consumer.require_user()
$$;
revoke all on function consumer.get_workspace_deletion_status(uuid) from public;

create or replace function ops.claim_consumer_deletion_job(
  p_job_id uuid,p_worker_ref text,p_lease_token text
)
returns boolean language plpgsql security definer set search_path=pg_catalog,ops,extensions as $$
declare v_actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if v_actor<>'myth_deletion_worker' then raise exception 'DELETION_WORKER_REQUIRED' using errcode='insufficient_privilege'; end if;
  update ops.consumer_deletion_jobs j set status='processing',started_at=coalesce(started_at,statement_timestamp()),
    assigned_worker_ref=p_worker_ref,lease_token_hash=encode(digest(p_lease_token,'sha256'),'hex'),row_version=j.row_version+1
  where j.id=p_job_id and (j.status='failed' or (j.status='grace_period' and j.grace_expires_at<=statement_timestamp()));
  return found;
end;
$$;
revoke all on function ops.claim_consumer_deletion_job(uuid,text,text) from public;

create or replace function ops.assert_deletion_job_lease(p_job_id uuid,p_lease_token text)
returns ops.consumer_deletion_jobs language plpgsql stable security definer set search_path=pg_catalog,ops,extensions as $$
declare v_job ops.consumer_deletion_jobs%rowtype; v_actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if v_actor<>'myth_deletion_worker' then raise exception 'DELETION_WORKER_REQUIRED' using errcode='insufficient_privilege'; end if;
  select * into v_job from ops.consumer_deletion_jobs j where j.id=p_job_id and j.status='processing'
    and j.lease_token_hash=encode(digest(p_lease_token,'sha256'),'hex');
  if v_job.id is null then raise exception 'DELETION_JOB_LEASE_INVALID' using errcode='insufficient_privilege'; end if;
  return v_job;
end;
$$;
revoke all on function ops.assert_deletion_job_lease(uuid,text) from public;

create or replace function ops.run_consumer_deletion_step(
  p_job_id uuid,p_lease_token text,p_step_key text
)
returns boolean language plpgsql security definer
set search_path=pg_catalog,network,consumer,ops as $$
declare v_job ops.consumer_deletion_jobs%rowtype; v_order smallint;
begin
  v_job:=ops.assert_deletion_job_lease(p_job_id,p_lease_token);
  select step_order into v_order from ops.consumer_deletion_steps
  where deletion_job_id=p_job_id and step_key=p_step_key for update;
  if v_order is null then raise exception 'DELETION_STEP_INVALID' using errcode='invalid_parameter_value'; end if;
  if exists(select 1 from ops.consumer_deletion_steps where deletion_job_id=p_job_id and step_order<v_order and status<>'completed') then
    raise exception 'DELETION_STEP_OUT_OF_ORDER' using errcode='check_violation';
  end if;
  if exists(select 1 from ops.consumer_deletion_steps where deletion_job_id=p_job_id and step_key=p_step_key and status='completed') then return false; end if;
  update ops.consumer_deletion_steps set status='processing',attempt_count=attempt_count+1,
    started_at=coalesce(started_at,statement_timestamp()),last_error_code=null where deletion_job_id=p_job_id and step_key=p_step_key;

  case p_step_key
    when 'suppress_delivery_handoffs' then
      update ops.consumer_auth_handoffs set status='revoked' where canonical_user_id=v_job.user_id and status='issued';
      update ops.consumer_context_handoffs set status='revoked' where canonical_user_id=v_job.user_id and status='issued';
      update ops.consumer_session_resume_handoffs set status='revoked' where canonical_user_id=v_job.user_id and status='issued';
      update consumer.consumer_watches set status='stopped',stopped_at=coalesce(stopped_at,statement_timestamp()),
        paused_at=null,row_version=row_version+1 where user_id=v_job.user_id and status in ('active','paused');
      update ops.consumer_alert_deliveries set status='cancelled',delivered_at=null,
        failed_at=null,suppressed_at=null,next_attempt_at=null where user_id=v_job.user_id and status in ('pending','processing');
      update ops.consumer_export_jobs set status='cancelled',completed_at=null,expires_at=null,artifact_ref=null,artifact_hash=null,
        lease_token_hash=null,row_version=row_version+1 where user_id=v_job.user_id and status<>'cancelled';
    when 'delete_notifications_alerts' then
      delete from ops.consumer_alert_deliveries where user_id=v_job.user_id;
      delete from consumer.consumer_notification_events where user_id=v_job.user_id;
      delete from consumer.consumer_alerts where user_id=v_job.user_id;
      delete from consumer.consumer_notification_preferences where user_id=v_job.user_id;
    when 'delete_decisions_snapshots' then
      delete from consumer.consumer_project_events where user_id=v_job.user_id;
      delete from consumer.consumer_research_snapshots where user_id=v_job.user_id;
      delete from consumer.consumer_project_decisions where user_id=v_job.user_id;
    when 'delete_sessions_notes_projects' then
      delete from ops.consumer_session_resume_handoffs where canonical_user_id=v_job.user_id;
      delete from consumer.consumer_guest_session_imports where user_id=v_job.user_id;
      delete from consumer.consumer_session_events where user_id=v_job.user_id;
      delete from consumer.consumer_project_saved_sessions m using consumer.consumer_projects p where m.project_id=p.id and p.user_id=v_job.user_id;
      delete from consumer.consumer_saved_sessions where user_id=v_job.user_id;
      delete from consumer.consumer_notes where user_id=v_job.user_id;
    when 'delete_watches_saves' then
      delete from consumer.consumer_watch_events where user_id=v_job.user_id;
      delete from consumer.consumer_watch_coverage c using consumer.consumer_watches w where c.watch_id=w.id and w.user_id=v_job.user_id;
      delete from consumer.consumer_watches where user_id=v_job.user_id;
      delete from consumer.consumer_guest_imports where user_id=v_job.user_id;
      delete from consumer.consumer_project_saved_entities m using consumer.consumer_projects p where m.project_id=p.id and p.user_id=v_job.user_id;
      delete from consumer.consumer_projects where user_id=v_job.user_id;
      delete from consumer.consumer_saved_entities where user_id=v_job.user_id;
    when 'delete_profile_identity_links' then
      delete from ops.consumer_identity_link_attempts where canonical_user_id=v_job.user_id;
      delete from ops.consumer_identity_links where canonical_user_id=v_job.user_id;
      delete from consumer.consumer_profiles where user_id=v_job.user_id;
    else raise exception 'DELETION_STEP_INVALID' using errcode='invalid_parameter_value';
  end case;
  update ops.consumer_deletion_steps set status='completed',completed_at=statement_timestamp()
  where deletion_job_id=p_job_id and step_key=p_step_key;
  return true;
end;
$$;
revoke all on function ops.run_consumer_deletion_step(uuid,text,text) from public;

create or replace function ops.complete_consumer_deletion_job(p_job_id uuid,p_lease_token text)
returns void language plpgsql security definer set search_path=pg_catalog,ops as $$
begin
  perform ops.assert_deletion_job_lease(p_job_id,p_lease_token);
  if exists(select 1 from ops.consumer_deletion_steps where deletion_job_id=p_job_id and status<>'completed') then
    raise exception 'DELETION_STEPS_INCOMPLETE' using errcode='check_violation';
  end if;
  update ops.consumer_deletion_jobs j set status='completed',completed_at=statement_timestamp(),
    retention_expires_at=statement_timestamp()+interval '30 days',lease_token_hash=null,row_version=j.row_version+1 where j.id=p_job_id;
end;
$$;
revoke all on function ops.complete_consumer_deletion_job(uuid,text) from public;

create or replace function ops.block_alert_during_workspace_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog,ops as $$
begin
  if exists(select 1 from ops.consumer_deletion_jobs where user_id=new.user_id and status in ('requested','grace_period','processing','completed')) then return null; end if;
  return new;
end;
$$;
revoke all on function ops.block_alert_during_workspace_deletion() from public;
create trigger consumer_alerts_block_workspace_deletion before insert on consumer.consumer_alerts
for each row execute function ops.block_alert_during_workspace_deletion();

create or replace function ops.block_delivery_during_workspace_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog,ops as $$
begin
  if exists(select 1 from ops.consumer_deletion_jobs where user_id=new.user_id and status in ('requested','grace_period','processing','completed')) then return null; end if;
  return new;
end;
$$;
revoke all on function ops.block_delivery_during_workspace_deletion() from public;
create trigger consumer_deliveries_block_workspace_deletion before insert on ops.consumer_alert_deliveries
for each row execute function ops.block_delivery_during_workspace_deletion();

create or replace function ops.block_deleted_workspace_recreation()
returns trigger language plpgsql security definer set search_path=pg_catalog,ops as $$
begin
  if exists(select 1 from ops.consumer_deletion_jobs where user_id=new.user_id and status='completed') then
    raise exception 'CONSUMER_WORKSPACE_DELETED' using errcode='insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke all on function ops.block_deleted_workspace_recreation() from public;
create trigger consumer_profiles_block_deleted_recreation before insert on consumer.consumer_profiles
for each row execute function ops.block_deleted_workspace_recreation();

alter table consumer.consumer_project_decisions enable row level security;
alter table consumer.consumer_project_decisions force row level security;
alter table consumer.consumer_project_decision_entities enable row level security;
alter table consumer.consumer_project_decision_entities force row level security;
alter table consumer.consumer_research_snapshots enable row level security;
alter table consumer.consumer_research_snapshots force row level security;
alter table consumer.consumer_project_events enable row level security;
alter table consumer.consumer_project_events force row level security;
alter table ops.consumer_export_jobs enable row level security;
alter table ops.consumer_export_jobs force row level security;
alter table ops.consumer_destructive_confirmations enable row level security;
alter table ops.consumer_destructive_confirmations force row level security;
alter table ops.consumer_deletion_jobs enable row level security;
alter table ops.consumer_deletion_jobs force row level security;
alter table ops.consumer_deletion_steps enable row level security;
alter table ops.consumer_deletion_steps force row level security;

create policy consumer_project_decisions_own_select on consumer.consumer_project_decisions
for select to authenticated using((select auth.uid())=user_id);
create policy consumer_project_decision_entities_own_select on consumer.consumer_project_decision_entities
for select to authenticated using(exists(select 1 from consumer.consumer_project_decisions d
  where d.id=decision_id and d.user_id=(select auth.uid())));
create policy consumer_research_snapshots_own_select on consumer.consumer_research_snapshots
for select to authenticated using((select auth.uid())=user_id);
create policy consumer_project_events_own_select on consumer.consumer_project_events
for select to authenticated using((select auth.uid())=user_id);

grant select on consumer.consumer_project_decisions,consumer.consumer_project_decision_entities,
  consumer.consumer_research_snapshots,consumer.consumer_project_events to authenticated;
grant execute on function consumer.record_project_decision(uuid,text,text,jsonb,uuid),
  consumer.verify_research_snapshot(uuid),consumer.complete_project(uuid,uuid,bigint,uuid),
  consumer.archive_project(uuid,bigint),consumer.restore_project(uuid,bigint),
  consumer.reopen_project(uuid,bigint,uuid),consumer.list_project_decisions(uuid),
  consumer.get_research_snapshot(uuid),consumer.request_export(uuid),consumer.get_export_status(uuid),
  consumer.request_workspace_deletion(text,uuid),consumer.cancel_workspace_deletion(uuid),
  consumer.get_workspace_deletion_status(uuid)
to authenticated,myth_consumer_api;

update ops.consumer_hub_registry
set allowed_scopes=array_append(allowed_scopes,'decision:read')
where not ('decision:read'=any(allowed_scopes));

grant usage on schema consumer to myth_bff_move,myth_bff_lender,myth_bff_insurance,
  myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant execute on function consumer.get_specialist_decision_context(uuid,uuid,text)
to myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

grant usage on schema network to myth_session_governor;
grant execute on function network.set_consumer_session_export_policy(text,integer,text,text[]) to myth_session_governor;

grant usage on schema ops to myth_export_worker;
grant execute on function ops.claim_consumer_export_job(uuid,text,text),
  ops.build_consumer_export_bundle(uuid,text),ops.complete_consumer_export_job(uuid,text,text),
  ops.fail_consumer_export_job(uuid,text,text) to myth_export_worker;

grant usage on schema ops to myth_deletion_worker;
grant execute on function ops.issue_consumer_destructive_confirmation(uuid,text),
  ops.claim_consumer_deletion_job(uuid,text,text),ops.run_consumer_deletion_step(uuid,text,text),
  ops.complete_consumer_deletion_job(uuid,text) to myth_deletion_worker;

comment on role myth_export_worker is
  'P19 export worker: leased, user-scoped bundle construction and job finalization only; no direct consumer table grants.';
comment on role myth_deletion_worker is
  'P19 deletion worker: purpose-bound confirmation and leased, checkpointed consumer-workspace deletion only; shared network and business state remain outside its functions.';

comment on table ops.consumer_export_jobs is
  'Private export orchestration metadata. Artifacts expire after seven days and use authenticated opaque storage references, never public URLs.';
comment on table ops.consumer_deletion_jobs is
  'Checkpointed consumer-workspace deletion with a seven-day grace period. Canonical auth and separate Business Manager authorization are outside this deletion scope.';
comment on column ops.consumer_deletion_jobs.retention_expires_at is
  'Operational job metadata defaults to 30-day retention after completion, then must be purged or pseudonymized subject to launch legal/privacy review.';

commit;
