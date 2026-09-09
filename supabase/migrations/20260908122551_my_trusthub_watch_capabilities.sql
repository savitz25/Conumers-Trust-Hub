-- My TrustHub P14: versioned Watch capability registry, one durable Watch per
-- Saved entity, and explicit consumer-selected coverage instances.
-- Apply only after P11B, P12, and P13. This migration intentionally creates no
-- source observations, change events, Alerts, source-check state, or delivery.

begin;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

do $$
declare role_name text;
begin
  foreach role_name in array array[
    'myth_capability_governor',
    'myth_capability_proposer_move',
    'myth_capability_proposer_lender',
    'myth_capability_proposer_insurance',
    'myth_capability_proposer_contractor',
    'myth_capability_proposer_senior',
    'myth_capability_proposer_investor'
  ] loop
    if not exists(select 1 from pg_catalog.pg_roles where rolname=role_name) then
      execute format('create role %I nologin noinherit',role_name);
    end if;
  end loop;
end;
$$;

comment on role myth_capability_governor is
  'Parent/Ask role that approves, enables, disables, and retires Watch capabilities.';
comment on role myth_capability_proposer_move is 'Move may propose, but cannot approve, Watch capabilities.';
comment on role myth_capability_proposer_lender is 'Lender may propose, but cannot approve, Watch capabilities.';
comment on role myth_capability_proposer_insurance is 'Insurance may propose, but cannot approve, Watch capabilities.';
comment on role myth_capability_proposer_contractor is 'Contractor may propose, but cannot approve, Watch capabilities.';
comment on role myth_capability_proposer_senior is 'Senior may propose, but cannot approve, Watch capabilities.';
comment on role myth_capability_proposer_investor is 'Investor may propose, but cannot approve, Watch capabilities.';

create table network.watch_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null check (capability_key ~ '^[a-z][a-z0-9_.]{4,159}$'),
  version integer not null check (version > 0),
  hub text not null check (hub in ('move','lender','insurance','contractor','senior','investor')),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  jurisdiction_scope text not null check (char_length(btrim(jurisdiction_scope)) between 1 and 100),
  identifier_namespace text not null check (identifier_namespace ~ '^[a-z0-9][a-z0-9_.:-]{1,127}$'),
  source_key text not null check (source_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  grain_key text not null check (grain_key ~ '^[a-z][a-z0-9_.:-]{1,159}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  consumer_description text not null check (char_length(btrim(consumer_description)) between 1 and 500),
  governance_status text not null default 'draft'
    check (governance_status in ('draft','review_required','approved','disabled','retired')),
  enabled boolean not null default false,
  watch_eligible boolean not null default false,
  source_connection_state text not null default 'not_connected'
    check (source_connection_state in ('not_connected','validation_only','configured','live')),
  freshness_expectation interval not null check (freshness_expectation > interval '0 seconds'),
  coverage_notes text null check (coverage_notes is null or char_length(btrim(coverage_notes)) <= 1000),
  coverage_limitations text[] not null default '{}'::text[]
    check (cardinality(coverage_limitations) <= 20),
  effective_from timestamptz not null,
  effective_to timestamptz null,
  proposed_by text not null default network.request_actor(),
  approved_by text null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(capability_key,version),
  check (effective_to is null or effective_to > effective_from),
  check (
    (governance_status='approved' and approved_by is not null)
    or governance_status<>'approved'
  ),
  check (governance_status='approved' or not enabled),
  check (governance_status='approved' or not watch_eligible)
);

create index watch_capabilities_eligibility_idx
  on network.watch_capabilities(hub,entity_type,jurisdiction_scope,identifier_namespace,effective_from)
  where governance_status='approved' and enabled and watch_eligible;
create index watch_capabilities_key_versions_idx
  on network.watch_capabilities(capability_key,version desc);

comment on table network.watch_capabilities is
  'Parent-governed, versioned declarations of one source/grain that may be offered for explicit consumer Watch coverage. A row does not claim a live source connection.';
comment on column network.watch_capabilities.version is
  'Material semantic changes require a new version; subscribed versions are never reinterpreted or silently upgraded.';
comment on column network.watch_capabilities.source_connection_state is
  'Operational readiness declaration only. P14 has no source check or freshness facts.';

create table network.watch_capability_events (
  id bigint generated always as identity primary key,
  capability_id uuid not null references network.watch_capabilities(id) on delete restrict,
  action text not null check (action in ('proposed','approved','disabled','retired','eligibility_changed','metadata_updated')),
  actor text not null,
  previous_state jsonb null,
  new_state jsonb not null,
  occurred_at timestamptz not null default statement_timestamp()
);

create index watch_capability_events_capability_idx
  on network.watch_capability_events(capability_id,occurred_at desc);

comment on table network.watch_capability_events is
  'Append-only parent governance history for capability proposals and lifecycle changes.';

create or replace function network.enforce_watch_capability_version_immutability()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog
as $$
begin
  if old.governance_status in ('approved','disabled','retired') and (
    new.capability_key is distinct from old.capability_key
    or new.version is distinct from old.version
    or new.hub is distinct from old.hub
    or new.entity_type is distinct from old.entity_type
    or new.jurisdiction_scope is distinct from old.jurisdiction_scope
    or new.identifier_namespace is distinct from old.identifier_namespace
    or new.source_key is distinct from old.source_key
    or new.grain_key is distinct from old.grain_key
    or new.display_name is distinct from old.display_name
    or new.consumer_description is distinct from old.consumer_description
  ) then
    raise exception 'approved capability semantics are immutable; create a new version'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

revoke all on function network.enforce_watch_capability_version_immutability() from public;

create trigger watch_capabilities_semantic_immutability
before update on network.watch_capabilities
for each row execute function network.enforce_watch_capability_version_immutability();

create or replace function network.audit_watch_capability()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,network
as $$
declare event_action text;
begin
  event_action:=case
    when tg_op='INSERT' then case when new.governance_status='review_required' then 'proposed' else 'metadata_updated' end
    when old.governance_status is distinct from new.governance_status then new.governance_status
    when old.watch_eligible is distinct from new.watch_eligible then 'eligibility_changed'
    else 'metadata_updated'
  end;
  insert into network.watch_capability_events(capability_id,action,actor,previous_state,new_state)
  values(
    new.id,event_action,network.request_actor(),
    case when tg_op='UPDATE' then jsonb_build_object(
      'governance_status',old.governance_status,'enabled',old.enabled,'watch_eligible',old.watch_eligible,
      'source_connection_state',old.source_connection_state,'effective_to',old.effective_to
    ) else null end,
    jsonb_build_object(
      'governance_status',new.governance_status,'enabled',new.enabled,'watch_eligible',new.watch_eligible,
      'source_connection_state',new.source_connection_state,'effective_to',new.effective_to
    )
  );
  return new;
end;
$$;

revoke all on function network.audit_watch_capability() from public;

create trigger watch_capabilities_audit
after insert or update on network.watch_capabilities
for each row execute function network.audit_watch_capability();

create or replace function network.capability_proposer_hub()
returns text
language sql
stable
security invoker
set search_path=pg_catalog
as $$
  select case coalesce(nullif(current_setting('role',true),'none'),session_user::text)
    when 'myth_capability_proposer_move' then 'move'
    when 'myth_capability_proposer_lender' then 'lender'
    when 'myth_capability_proposer_insurance' then 'insurance'
    when 'myth_capability_proposer_contractor' then 'contractor'
    when 'myth_capability_proposer_senior' then 'senior'
    when 'myth_capability_proposer_investor' then 'investor'
    else null end;
$$;

create or replace function network.propose_watch_capability(
  p_capability_key text,p_version integer,p_hub text,p_entity_type text,
  p_jurisdiction_scope text,p_identifier_namespace text,p_source_key text,p_grain_key text,
  p_display_name text,p_consumer_description text,p_freshness_expectation interval,
  p_coverage_notes text default null,p_coverage_limitations text[] default '{}'::text[],
  p_effective_from timestamptz default statement_timestamp()
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,network
as $$
declare proposer_hub text; new_id uuid;
begin
  proposer_hub:=network.capability_proposer_hub();
  if proposer_hub is null or proposer_hub<>p_hub then
    raise exception 'capability proposer is not authorized for this hub' using errcode='insufficient_privilege';
  end if;
  insert into network.watch_capabilities(
    capability_key,version,hub,entity_type,jurisdiction_scope,identifier_namespace,
    source_key,grain_key,display_name,consumer_description,governance_status,
    enabled,watch_eligible,source_connection_state,freshness_expectation,
    coverage_notes,coverage_limitations,effective_from
  ) values(
    p_capability_key,p_version,p_hub,p_entity_type,p_jurisdiction_scope,p_identifier_namespace,
    p_source_key,p_grain_key,btrim(p_display_name),btrim(p_consumer_description),'review_required',
    false,false,'not_connected',p_freshness_expectation,p_coverage_notes,p_coverage_limitations,p_effective_from
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function network.propose_watch_capability(text,integer,text,text,text,text,text,text,text,text,interval,text,text[],timestamptz) from public;

create table consumer.consumer_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_entity_id uuid not null unique references consumer.consumer_saved_entities(id) on delete restrict,
  status text not null check (status in ('active','paused','stopped')),
  resume_policy text not null default 'next_accepted_observation'
    check (resume_policy='next_accepted_observation'),
  started_at timestamptz not null default statement_timestamp(),
  paused_at timestamptz null,
  resumed_at timestamptz null,
  resume_boundary_at timestamptz not null default statement_timestamp(),
  stopped_at timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version>0),
  check (
    (status='active' and stopped_at is null)
    or (status='paused' and paused_at is not null and stopped_at is null)
    or (status='stopped' and stopped_at is not null)
  )
);

create index consumer_watches_user_status_idx
  on consumer.consumer_watches(user_id,status,updated_at desc);

comment on table consumer.consumer_watches is
  'One durable Watch per Saved entity, independent of every Project membership. Save and Watch remain separate actions.';
comment on column consumer.consumer_watches.resume_policy is
  'V1 does not fan out retroactive Alerts for the intentional pause window; resume starts at the next accepted observation boundary.';

create table consumer.consumer_watch_coverage (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references consumer.consumer_watches(id) on delete restrict,
  capability_id uuid not null references network.watch_capabilities(id) on delete restrict,
  capability_version integer not null check (capability_version>0),
  status text not null check (status in ('enabled','paused_by_capability','disabled','retired')),
  enabled_at timestamptz not null default statement_timestamp(),
  disabled_at timestamptz null,
  disabled_reason text null check (disabled_reason is null or char_length(btrim(disabled_reason))<=300),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(watch_id,capability_id),
  check (
    (status='enabled' and disabled_at is null and disabled_reason is null)
    or (status<>'enabled' and disabled_at is not null and disabled_reason is not null)
  )
);

create index consumer_watch_coverage_capability_idx
  on consumer.consumer_watch_coverage(capability_id,watch_id);
create index consumer_watch_coverage_watch_status_idx
  on consumer.consumer_watch_coverage(watch_id,status);

comment on table consumer.consumer_watch_coverage is
  'Durable, explicit consumer selection of one immutable capability version. New registry grains and versions are never auto-added.';

create table consumer.consumer_watch_events (
  id bigint generated always as identity primary key,
  watch_id uuid not null references consumer.consumer_watches(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'started','paused','resumed','stopped','restarted',
    'coverage_added','coverage_removed','capability_unavailable','capability_retired'
  )),
  capability_id uuid null references network.watch_capabilities(id) on delete restrict,
  idempotency_key uuid null,
  request_fingerprint text null check (request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{32}$'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=4096),
  occurred_at timestamptz not null default statement_timestamp()
);

create unique index consumer_watch_events_idempotency_uidx
  on consumer.consumer_watch_events(user_id,idempotency_key)
  where idempotency_key is not null;
create index consumer_watch_events_user_time_idx
  on consumer.consumer_watch_events(user_id,occurred_at desc);
create index consumer_watch_events_watch_idx
  on consumer.consumer_watch_events(watch_id);
create index consumer_watch_events_capability_idx
  on consumer.consumer_watch_events(capability_id)
  where capability_id is not null;

comment on table consumer.consumer_watch_events is
  'Lightweight private Watch lifecycle/coverage audit. Routine reads and future source checks are not logged here.';

create trigger consumer_watches_set_updated_at
before update on consumer.consumer_watches
for each row execute function network.set_updated_at();
create trigger consumer_watch_coverage_set_updated_at
before update on consumer.consumer_watch_coverage
for each row execute function network.set_updated_at();

create or replace function consumer.enforce_watch_ownership()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare saved_owner uuid; saved_removed timestamptz;
begin
  select s.user_id,s.removed_at into saved_owner,saved_removed
  from consumer.consumer_saved_entities s where s.id=new.saved_entity_id;
  if saved_owner is null or saved_owner<>new.user_id then
    raise exception 'Watch and Saved entity must belong to the same consumer'
      using errcode='integrity_constraint_violation';
  end if;
  if tg_op='INSERT' and saved_removed is not null then
    raise exception 'removed Saved entity cannot be Watched' using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

revoke all on function consumer.enforce_watch_ownership() from public;

create trigger consumer_watches_ownership
before insert or update on consumer.consumer_watches
for each row execute function consumer.enforce_watch_ownership();

create or replace function consumer.enforce_coverage_capability_version()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,network
as $$
declare registry_version integer;
begin
  select c.version into registry_version from network.watch_capabilities c where c.id=new.capability_id;
  if registry_version is null or registry_version<>new.capability_version then
    raise exception 'coverage must preserve the selected capability version'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

revoke all on function consumer.enforce_coverage_capability_version() from public;

create trigger consumer_watch_coverage_version
before insert or update on consumer.consumer_watch_coverage
for each row execute function consumer.enforce_coverage_capability_version();

create or replace function consumer.watch_capability_eligibility_reason(
  p_saved_entity_id uuid,
  p_capability_id uuid,
  p_at timestamptz default statement_timestamp()
)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer
as $$
declare
  saved consumer.consumer_saved_entities%rowtype;
  capability network.watch_capabilities%rowtype;
  terminal_id uuid;
  terminal_type text;
begin
  select s.* into saved from consumer.consumer_saved_entities s
  where s.id=p_saved_entity_id and s.removed_at is null;
  if not found then return 'SAVED_NOT_FOUND'; end if;

  select c.* into capability from network.watch_capabilities c where c.id=p_capability_id;
  if not found then return 'CAPABILITY_NOT_FOUND'; end if;

  if saved.source_binding_id is null
    or not network.binding_is_watch_eligible(saved.source_binding_id,p_at) then
    return 'IDENTITY_REQUIRES_REVIEW';
  end if;

  terminal_id:=network.resolve_canonical_entity(saved.network_entity_id);
  select e.entity_type into terminal_type from network.network_entities e
  where e.id=terminal_id and e.status='active';
  if terminal_type is null then return 'ENTITY_UNRESOLVED'; end if;

  if capability.governance_status<>'approved' then return 'CAPABILITY_NOT_APPROVED'; end if;
  if not capability.enabled then return 'CAPABILITY_DISABLED'; end if;
  if not capability.watch_eligible then return 'CAPABILITY_NOT_WATCH_ELIGIBLE'; end if;
  if capability.source_connection_state='not_connected' then return 'SOURCE_CONNECTION_NOT_CONFIGURED'; end if;
  if capability.effective_from>p_at
    or (capability.effective_to is not null and capability.effective_to<=p_at) then
    return 'CAPABILITY_OUTSIDE_EFFECTIVE_PERIOD';
  end if;
  if capability.entity_type<>terminal_type then return 'CAPABILITY_NOT_APPLICABLE'; end if;

  if not exists(
    select 1 from network.network_entity_bindings b
    where network.resolve_canonical_entity(b.network_entity_id)=terminal_id
      and b.hub=capability.hub
      and b.identifier_namespace=capability.identifier_namespace
      and b.binding_status='accepted'
      and b.valid_from<=p_at and (b.valid_to is null or b.valid_to>p_at)
      and (
        capability.jurisdiction_scope='*'
        or upper(capability.jurisdiction_scope)=upper(coalesce(nullif(b.jurisdiction,''),'*'))
      )
  ) then return 'CAPABILITY_NOT_APPLICABLE'; end if;

  return null;
end;
$$;

revoke all on function consumer.watch_capability_eligibility_reason(uuid,uuid,timestamptz) from public;

create or replace function consumer.list_available_watch_capabilities(p_saved_entity_id uuid)
returns table(
  capability_id uuid,
  capability_key text,
  capability_version integer,
  display_name text,
  consumer_description text,
  source_key text,
  grain_key text,
  coverage_notes text,
  coverage_limitations text[],
  freshness_expectation interval,
  eligible boolean,
  unavailable_reason text,
  source_check_status text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer
as $$
declare subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype; source_hub text;
begin
  select s.* into saved from consumer.consumer_saved_entities s
  where s.id=p_saved_entity_id and s.user_id=subject and s.removed_at is null;
  if not found then raise exception 'SAVED_NOT_FOUND' using errcode='42501'; end if;
  select b.hub into source_hub from network.network_entity_bindings b where b.id=saved.source_binding_id;

  return query
  select c.id,c.capability_key,c.version,c.display_name,c.consumer_description,
    c.source_key,c.grain_key,c.coverage_notes,c.coverage_limitations,c.freshness_expectation,
    reason.reason is null,reason.reason,'not_available'::text
  from network.watch_capabilities c
  cross join lateral (
    select consumer.watch_capability_eligibility_reason(saved.id,c.id,statement_timestamp()) as reason
  ) reason
  where c.hub=source_hub
  order by c.capability_key,c.version;
end;
$$;

revoke all on function consumer.list_available_watch_capabilities(uuid) from public;

create or replace function consumer.record_watch_event(
  p_watch_id uuid,p_event_type text,p_capability_id uuid default null,
  p_idempotency_key uuid default null,p_fingerprint text default null,p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare owner_id uuid; event_id bigint;
begin
  select w.user_id into owner_id from consumer.consumer_watches w where w.id=p_watch_id;
  if owner_id is null then raise exception 'WATCH_NOT_FOUND' using errcode='no_data_found'; end if;
  insert into consumer.consumer_watch_events(
    watch_id,user_id,event_type,capability_id,idempotency_key,request_fingerprint,metadata
  ) values(p_watch_id,owner_id,p_event_type,p_capability_id,p_idempotency_key,p_fingerprint,p_metadata)
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function consumer.record_watch_event(uuid,text,uuid,uuid,text,jsonb) from public;

create or replace function consumer.start_watch(
  p_saved_entity_id uuid,p_capability_ids uuid[],p_idempotency_key uuid
)
returns table(watch_id uuid,created boolean,row_version bigint)
language plpgsql
security definer
set search_path=pg_catalog,consumer,network
as $$
declare
  subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype;
  existing consumer.consumer_watches%rowtype; cap_id uuid; requested_count integer;
  request_fingerprint text; prior_event consumer.consumer_watch_events%rowtype; new_watch_id uuid;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  requested_count:=coalesce(cardinality(p_capability_ids),0);
  if requested_count not between 1 and 20
    or requested_count<>(select count(distinct x) from unnest(p_capability_ids) x) then
    raise exception 'one to twenty distinct capabilities required' using errcode='check_violation';
  end if;
  request_fingerprint:=md5(array_to_string(array(select x::text from unnest(p_capability_ids) x order by x::text),','));
  select s.* into saved from consumer.consumer_saved_entities s
  where s.id=p_saved_entity_id and s.user_id=subject and s.removed_at is null;
  if not found then raise exception 'SAVED_NOT_FOUND' using errcode='42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(subject::text||':watch:'||saved.id::text,0));
  select e.* into prior_event from consumer.consumer_watch_events e
  where e.user_id=subject and e.idempotency_key=p_idempotency_key limit 1;
  if found then
    if prior_event.event_type<>'started' or prior_event.request_fingerprint<>request_fingerprint then
      raise exception 'idempotency key reused with different Watch request' using errcode='integrity_constraint_violation';
    end if;
    select w.* into existing from consumer.consumer_watches w where w.id=prior_event.watch_id;
    return query select existing.id,false,existing.row_version;
    return;
  end if;

  select w.* into existing from consumer.consumer_watches w where w.saved_entity_id=saved.id for update;
  if found then
    if existing.status='stopped' then
      raise exception 'WATCH_RESTART_REQUIRED' using errcode='integrity_constraint_violation';
    end if;
    raise exception 'WATCH_ALREADY_EXISTS' using errcode='integrity_constraint_violation';
  end if;

  foreach cap_id in array p_capability_ids loop
    if consumer.watch_capability_eligibility_reason(saved.id,cap_id,statement_timestamp()) is not null then
      raise exception 'CAPABILITY_NOT_ELIGIBLE' using errcode='check_violation';
    end if;
  end loop;

  insert into consumer.consumer_watches(user_id,saved_entity_id,status)
  values(subject,saved.id,'active') returning id into new_watch_id;
  insert into consumer.consumer_watch_coverage(watch_id,capability_id,capability_version,status)
  select new_watch_id,c.id,c.version,'enabled' from network.watch_capabilities c
  where c.id=any(p_capability_ids);
  perform consumer.record_watch_event(new_watch_id,'started',null,p_idempotency_key,request_fingerprint,
    jsonb_build_object('coverage_count',requested_count,'resulting_row_version',1));
  return query select new_watch_id,true,1::bigint;
end;
$$;

revoke all on function consumer.start_watch(uuid,uuid[],uuid) from public;

create or replace function consumer.pause_watch(
  p_watch_id uuid,p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); current_watch consumer.consumer_watches%rowtype; next_version bigint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  select w.* into current_watch from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject for update;
  if not found then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  if current_watch.status='paused' then return current_watch.row_version; end if;
  if current_watch.status<>'active' then raise exception 'WATCH_STATE_CONFLICT' using errcode='integrity_constraint_violation'; end if;
  if current_watch.row_version<>p_expected_row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  update consumer.consumer_watches w set status='paused',paused_at=statement_timestamp(),
    row_version=w.row_version+1 where w.id=p_watch_id returning w.row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'paused',null,p_idempotency_key,null,
    jsonb_build_object('resulting_row_version',next_version));
  return next_version;
end;
$$;

create or replace function consumer.resume_watch(
  p_watch_id uuid,p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); current_watch consumer.consumer_watches%rowtype; next_version bigint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  select w.* into current_watch from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject for update;
  if not found then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  if current_watch.status='active' then return current_watch.row_version; end if;
  if current_watch.status<>'paused' then raise exception 'WATCH_STATE_CONFLICT' using errcode='integrity_constraint_violation'; end if;
  if current_watch.row_version<>p_expected_row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  if not exists(select 1 from consumer.consumer_watch_coverage c where c.watch_id=p_watch_id and c.status='enabled') then
    raise exception 'COVERAGE_REQUIRED' using errcode='check_violation';
  end if;
  update consumer.consumer_watches w set status='active',paused_at=null,resumed_at=statement_timestamp(),
    resume_boundary_at=statement_timestamp(),row_version=w.row_version+1
  where w.id=p_watch_id returning w.row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'resumed',null,p_idempotency_key,null,
    jsonb_build_object('resulting_row_version',next_version,'catch_up','none'));
  return next_version;
end;
$$;

create or replace function consumer.stop_watch(
  p_watch_id uuid,p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); current_watch consumer.consumer_watches%rowtype; next_version bigint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  select w.* into current_watch from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject for update;
  if not found then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  if current_watch.status='stopped' then return current_watch.row_version; end if;
  if current_watch.row_version<>p_expected_row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  update consumer.consumer_watches w set status='stopped',stopped_at=statement_timestamp(),paused_at=null,
    row_version=w.row_version+1 where w.id=p_watch_id returning w.row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'stopped',null,p_idempotency_key,null,
    jsonb_build_object('resulting_row_version',next_version));
  return next_version;
end;
$$;

revoke all on function consumer.pause_watch(uuid,bigint,uuid) from public;
revoke all on function consumer.resume_watch(uuid,bigint,uuid) from public;
revoke all on function consumer.stop_watch(uuid,bigint,uuid) from public;

create or replace function consumer.add_watch_coverage(
  p_watch_id uuid,p_capability_id uuid,p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer,network
as $$
declare subject uuid:=consumer.require_user(); current_watch consumer.consumer_watches%rowtype;
  current_coverage consumer.consumer_watch_coverage%rowtype; registry_version integer; next_version bigint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  select w.* into current_watch from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject for update;
  if not found then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  if current_watch.status='stopped' then raise exception 'WATCH_RESTART_REQUIRED' using errcode='integrity_constraint_violation'; end if;
  select c.* into current_coverage from consumer.consumer_watch_coverage c
  where c.watch_id=p_watch_id and c.capability_id=p_capability_id;
  if found and current_coverage.status='enabled' then return current_watch.row_version; end if;
  if current_watch.row_version<>p_expected_row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  if consumer.watch_capability_eligibility_reason(current_watch.saved_entity_id,p_capability_id,statement_timestamp()) is not null then
    raise exception 'CAPABILITY_NOT_ELIGIBLE' using errcode='check_violation';
  end if;
  select c.version into registry_version from network.watch_capabilities c where c.id=p_capability_id;
  insert into consumer.consumer_watch_coverage(watch_id,capability_id,capability_version,status)
  values(p_watch_id,p_capability_id,registry_version,'enabled')
  on conflict(watch_id,capability_id) do update set
    capability_version=excluded.capability_version,status='enabled',enabled_at=statement_timestamp(),
    disabled_at=null,disabled_reason=null;
  update consumer.consumer_watches w set row_version=w.row_version+1
  where w.id=p_watch_id returning w.row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'coverage_added',p_capability_id,p_idempotency_key,null,
    jsonb_build_object('resulting_row_version',next_version));
  return next_version;
end;
$$;

create or replace function consumer.remove_watch_coverage(
  p_watch_id uuid,p_capability_id uuid,p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); current_watch consumer.consumer_watches%rowtype;
  current_status text; enabled_count integer; next_version bigint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  select w.* into current_watch from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject for update;
  if not found then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  select c.status into current_status from consumer.consumer_watch_coverage c
  where c.watch_id=p_watch_id and c.capability_id=p_capability_id for update;
  if current_status is null or current_status<>'enabled' then return current_watch.row_version; end if;
  if current_watch.row_version<>p_expected_row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  select count(*) into enabled_count from consumer.consumer_watch_coverage c
  where c.watch_id=p_watch_id and c.status='enabled';
  if current_watch.status in ('active','paused') and enabled_count<=1 then
    raise exception 'COVERAGE_REQUIRED' using errcode='check_violation';
  end if;
  update consumer.consumer_watch_coverage c set status='disabled',disabled_at=statement_timestamp(),
    disabled_reason='consumer_removed' where c.watch_id=p_watch_id and c.capability_id=p_capability_id;
  update consumer.consumer_watches w set row_version=w.row_version+1
  where w.id=p_watch_id returning w.row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'coverage_removed',p_capability_id,p_idempotency_key,null,
    jsonb_build_object('resulting_row_version',next_version));
  return next_version;
end;
$$;

create or replace function consumer.restart_watch(
  p_watch_id uuid,p_capability_ids uuid[],p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer,network
as $$
declare subject uuid:=consumer.require_user(); current_watch consumer.consumer_watches%rowtype;
  cap_id uuid; requested_count integer; request_fingerprint text; next_version bigint; changed record;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  requested_count:=coalesce(cardinality(p_capability_ids),0);
  if requested_count not between 1 and 20
    or requested_count<>(select count(distinct x) from unnest(p_capability_ids) x) then
    raise exception 'one to twenty distinct capabilities required' using errcode='check_violation';
  end if;
  request_fingerprint:=md5(array_to_string(array(select x::text from unnest(p_capability_ids) x order by x::text),','));
  select w.* into current_watch from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject for update;
  if not found then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  if current_watch.status<>'stopped' then raise exception 'WATCH_STATE_CONFLICT' using errcode='integrity_constraint_violation'; end if;
  if current_watch.row_version<>p_expected_row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  foreach cap_id in array p_capability_ids loop
    if consumer.watch_capability_eligibility_reason(current_watch.saved_entity_id,cap_id,statement_timestamp()) is not null then
      raise exception 'CAPABILITY_NOT_ELIGIBLE' using errcode='check_violation';
    end if;
  end loop;

  for changed in
    update consumer.consumer_watch_coverage c set status='disabled',disabled_at=statement_timestamp(),
      disabled_reason='not_selected_on_restart'
    where c.watch_id=p_watch_id and c.status='enabled' and not(c.capability_id=any(p_capability_ids))
    returning c.capability_id
  loop
    perform consumer.record_watch_event(p_watch_id,'coverage_removed',changed.capability_id,null,null,
      jsonb_build_object('reason','restart_selection'));
  end loop;
  foreach cap_id in array p_capability_ids loop
    if exists(select 1 from consumer.consumer_watch_coverage c where c.watch_id=p_watch_id and c.capability_id=cap_id and c.status<>'enabled') then
      update consumer.consumer_watch_coverage c set status='enabled',enabled_at=statement_timestamp(),
        disabled_at=null,disabled_reason=null where c.watch_id=p_watch_id and c.capability_id=cap_id;
      perform consumer.record_watch_event(p_watch_id,'coverage_added',cap_id,null,null,
        jsonb_build_object('reason','restart_selection'));
    elsif not exists(select 1 from consumer.consumer_watch_coverage c where c.watch_id=p_watch_id and c.capability_id=cap_id) then
      insert into consumer.consumer_watch_coverage(watch_id,capability_id,capability_version,status)
      select p_watch_id,c.id,c.version,'enabled' from network.watch_capabilities c where c.id=cap_id;
      perform consumer.record_watch_event(p_watch_id,'coverage_added',cap_id,null,null,
        jsonb_build_object('reason','restart_selection'));
    end if;
  end loop;
  update consumer.consumer_watches w set status='active',stopped_at=null,paused_at=null,
    resumed_at=statement_timestamp(),resume_boundary_at=statement_timestamp(),row_version=w.row_version+1
  where w.id=p_watch_id returning w.row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'restarted',null,p_idempotency_key,request_fingerprint,
    jsonb_build_object('coverage_count',requested_count,'resulting_row_version',next_version));
  return next_version;
end;
$$;

revoke all on function consumer.add_watch_coverage(uuid,uuid,bigint,uuid) from public;
revoke all on function consumer.remove_watch_coverage(uuid,uuid,bigint,uuid) from public;
revoke all on function consumer.restart_watch(uuid,uuid[],bigint,uuid) from public;

create or replace function network.set_watch_capability_state(
  p_capability_id uuid,p_governance_status text,p_enabled boolean,p_watch_eligible boolean,
  p_source_connection_state text,p_effective_to timestamptz default null
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,network,consumer
as $$
begin
  if p_governance_status not in ('approved','disabled','retired') then
    raise exception 'invalid governed capability state' using errcode='check_violation';
  end if;
  if p_governance_status<>'approved' and (p_enabled or p_watch_eligible) then
    raise exception 'disabled or retired capability cannot be eligible' using errcode='check_violation';
  end if;
  update network.watch_capabilities c set
    governance_status=p_governance_status,enabled=p_enabled,watch_eligible=p_watch_eligible,
    source_connection_state=p_source_connection_state,effective_to=p_effective_to,
    approved_by=case when p_governance_status='approved' then network.request_actor() else c.approved_by end
  where c.id=p_capability_id;
  if not found then raise exception 'capability not found' using errcode='no_data_found'; end if;
end;
$$;

revoke all on function network.set_watch_capability_state(uuid,text,boolean,boolean,text,timestamptz) from public;

create or replace function consumer.get_watch(p_saved_entity_id uuid)
returns table(
  watch_id uuid,watch_status text,row_version bigint,resume_policy text,resume_boundary_at timestamptz,
  enabled_coverage_count integer,historical_coverage_count integer,limited_coverage boolean,
  source_check_status text,source_check_message text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,consumer,network
as $$
declare subject uuid:=consumer.require_user(); owned_watch consumer.consumer_watches%rowtype;
begin
  select w.* into owned_watch from consumer.consumer_watches w
  join consumer.consumer_saved_entities s on s.id=w.saved_entity_id
  where s.id=p_saved_entity_id and s.user_id=subject;
  if not found then return; end if;
  return query select owned_watch.id,owned_watch.status,owned_watch.row_version,
    owned_watch.resume_policy,owned_watch.resume_boundary_at,
    (select count(*)::integer from consumer.consumer_watch_coverage c where c.watch_id=owned_watch.id and c.status='enabled'),
    (select count(*)::integer from consumer.consumer_watch_coverage c where c.watch_id=owned_watch.id),
    exists(
      select 1 from consumer.consumer_watch_coverage c join network.watch_capabilities wc on wc.id=c.capability_id
      where c.watch_id=owned_watch.id and cardinality(wc.coverage_limitations)>0
    ),
    'not_available'::text,'Monitoring source connection not yet active in this environment'::text;
end;
$$;

create or replace function consumer.get_watch_coverage(p_watch_id uuid)
returns table(
  coverage_id uuid,capability_id uuid,capability_key text,capability_version integer,
  display_name text,source_key text,grain_key text,coverage_status text,
  coverage_notes text,coverage_limitations text[],disabled_reason text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,consumer,network
as $$
declare subject uuid:=consumer.require_user();
begin
  if not exists(select 1 from consumer.consumer_watches w where w.id=p_watch_id and w.user_id=subject) then
    raise exception 'WATCH_NOT_FOUND' using errcode='42501';
  end if;
  return query select cov.id,cap.id,cap.capability_key,cov.capability_version,
    cap.display_name,cap.source_key,cap.grain_key,cov.status,
    cap.coverage_notes,cap.coverage_limitations,cov.disabled_reason
  from consumer.consumer_watch_coverage cov
  join network.watch_capabilities cap on cap.id=cov.capability_id
  where cov.watch_id=p_watch_id order by cov.created_at;
end;
$$;

create or replace function consumer.get_cross_hub_entity_watch_state(p_network_entity_id uuid)
returns table(
  network_entity_id uuid,saved boolean,saved_entity_id uuid,watch_id uuid,watch_status text,
  enabled_coverage_count integer,available_capability_count integer,coverage_summary jsonb,
  source_check_status text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,consumer,network
as $$
declare subject uuid:=consumer.require_user(); canonical uuid; saved_row consumer.consumer_saved_entities%rowtype;
  watch_row consumer.consumer_watches%rowtype;
begin
  canonical:=network.resolve_canonical_entity(p_network_entity_id);
  if canonical is null then raise exception 'ENTITY_UNRESOLVED' using errcode='22023'; end if;
  select s.* into saved_row from consumer.consumer_saved_entities s
  where s.user_id=subject and s.removed_at is null
    and network.resolve_canonical_entity(s.network_entity_id)=canonical limit 1;
  if saved_row.id is not null then
    select w.* into watch_row from consumer.consumer_watches w where w.saved_entity_id=saved_row.id;
  end if;
  return query select canonical,saved_row.id is not null,saved_row.id,watch_row.id,watch_row.status,
    coalesce((select count(*)::integer from consumer.consumer_watch_coverage c where c.watch_id=watch_row.id and c.status='enabled'),0),
    case when saved_row.id is null then 0 else coalesce((
      select count(*)::integer from consumer.list_available_watch_capabilities(saved_row.id) a where a.eligible
    ),0) end,
    coalesce((select jsonb_agg(jsonb_build_object(
      'capability_key',cap.capability_key,'version',cov.capability_version,
      'display_name',cap.display_name,'status',cov.status,'source',cap.source_key
    ) order by cap.capability_key)
    from consumer.consumer_watch_coverage cov join network.watch_capabilities cap on cap.id=cov.capability_id
    where cov.watch_id=watch_row.id),'[]'::jsonb),
    'not_available'::text;
end;
$$;

revoke all on function consumer.get_watch(uuid) from public;
revoke all on function consumer.get_watch_coverage(uuid) from public;
revoke all on function consumer.get_cross_hub_entity_watch_state(uuid) from public;

-- P14 extends P12 unsave semantics. Active and paused Watches must be stopped
-- explicitly; a stopped Watch remains as durable history and permits removal.
create or replace function consumer.remove_saved_entity(
  p_saved_entity_id uuid,
  p_expected_row_version bigint
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); next_version bigint;
begin
  if exists(
    select 1 from consumer.consumer_watches w
    where w.saved_entity_id=p_saved_entity_id and w.user_id=subject and w.status in ('active','paused')
  ) then
    raise exception 'Saved entity has an active or paused Watch; stop it before removing'
      using errcode='integrity_constraint_violation';
  end if;
  if exists(
    select 1 from consumer.consumer_project_saved_entities m
    join consumer.consumer_saved_entities s on s.id=m.saved_entity_id
    where m.saved_entity_id=p_saved_entity_id and s.user_id=subject and m.removed_at is null
  ) then
    raise exception 'Saved entity still belongs to one or more Projects'
      using errcode='integrity_constraint_violation';
  end if;
  update consumer.consumer_saved_entities s
  set removed_at=statement_timestamp(),row_version=s.row_version+1
  where s.id=p_saved_entity_id and s.user_id=subject and s.removed_at is null
    and s.row_version=p_expected_row_version
  returning s.row_version into next_version;
  if next_version is null then
    raise exception 'Saved entity not found or stale row version' using errcode='serialization_failure';
  end if;
  return next_version;
end;
$$;

create or replace function consumer.stop_watch_and_remove_saved_entity(
  p_watch_id uuid,p_watch_expected_version bigint,p_saved_expected_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare subject uuid:=consumer.require_user(); saved_id uuid; ignored_version bigint; removed_version bigint;
begin
  select w.saved_entity_id into saved_id from consumer.consumer_watches w
  where w.id=p_watch_id and w.user_id=subject;
  if saved_id is null then raise exception 'WATCH_NOT_FOUND' using errcode='42501'; end if;
  ignored_version:=consumer.stop_watch(p_watch_id,p_watch_expected_version,p_idempotency_key);
  removed_version:=consumer.remove_saved_entity(saved_id,p_saved_expected_version);
  return removed_version;
end;
$$;

revoke all on function consumer.stop_watch_and_remove_saved_entity(uuid,bigint,bigint,uuid) from public;

-- Capability withdrawal changes the truth of existing coverage without erasing
-- what the consumer selected. Reapproval never silently re-enables those rows.
create or replace function network.propagate_watch_capability_state()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,network,consumer
as $$
declare coverage_state text; coverage_reason text; affected record;
begin
  if new.governance_status='approved' and new.enabled and new.watch_eligible then
    return new;
  end if;
  coverage_state:=case when new.governance_status='retired' then 'retired' else 'paused_by_capability' end;
  coverage_reason:=case when new.governance_status='retired' then 'capability_retired' else 'capability_unavailable' end;
  for affected in
    update consumer.consumer_watch_coverage c set status=coverage_state,
      disabled_at=statement_timestamp(),disabled_reason=coverage_reason
    where c.capability_id=new.id and c.status='enabled'
    returning c.watch_id,c.capability_id
  loop
    perform consumer.record_watch_event(affected.watch_id,
      case when coverage_state='retired' then 'capability_retired' else 'capability_unavailable' end,
      affected.capability_id,null,null,jsonb_build_object('governance_status',new.governance_status));
  end loop;
  return new;
end;
$$;

revoke all on function network.propagate_watch_capability_state() from public;

create trigger watch_capabilities_propagate_unavailability
after update on network.watch_capabilities
for each row
when (
  old.governance_status is distinct from new.governance_status
  or old.enabled is distinct from new.enabled
  or old.watch_eligible is distinct from new.watch_eligible
)
execute function network.propagate_watch_capability_state();

alter table network.watch_capabilities enable row level security;
alter table network.watch_capabilities force row level security;
alter table network.watch_capability_events enable row level security;
alter table network.watch_capability_events force row level security;
alter table consumer.consumer_watches enable row level security;
alter table consumer.consumer_watches force row level security;
alter table consumer.consumer_watch_coverage enable row level security;
alter table consumer.consumer_watch_coverage force row level security;
alter table consumer.consumer_watch_events enable row level security;
alter table consumer.consumer_watch_events force row level security;

create policy watch_capabilities_governor_all on network.watch_capabilities
for all to myth_capability_governor using(true) with check(true);
create policy watch_capability_events_governor_read on network.watch_capability_events
for select to myth_capability_governor using(true);

create policy consumer_watches_select_own on consumer.consumer_watches
for select to authenticated using ((select auth.uid())=user_id);
create policy consumer_watch_coverage_select_own on consumer.consumer_watch_coverage
for select to authenticated using (exists(
  select 1 from consumer.consumer_watches w
  where w.id=watch_id and w.user_id=(select auth.uid())
));
create policy consumer_watch_events_select_own on consumer.consumer_watch_events
for select to authenticated using ((select auth.uid())=user_id);

revoke all on table network.watch_capabilities from public,anon,authenticated;
revoke all on table network.watch_capability_events from public,anon,authenticated;
revoke all on table consumer.consumer_watches from public,anon,authenticated;
revoke all on table consumer.consumer_watch_coverage from public,anon,authenticated;
revoke all on table consumer.consumer_watch_events from public,anon,authenticated;

grant usage on schema network to myth_capability_governor,
  myth_capability_proposer_move,myth_capability_proposer_lender,
  myth_capability_proposer_insurance,myth_capability_proposer_contractor,
  myth_capability_proposer_senior,myth_capability_proposer_investor;
grant select,insert,update on network.watch_capabilities to myth_capability_governor;
grant select on network.watch_capability_events to myth_capability_governor;
grant execute on function network.set_watch_capability_state(uuid,text,boolean,boolean,text,timestamptz)
  to myth_capability_governor;
grant execute on function network.propose_watch_capability(text,integer,text,text,text,text,text,text,text,text,interval,text,text[],timestamptz)
  to myth_capability_proposer_move,myth_capability_proposer_lender,
     myth_capability_proposer_insurance,myth_capability_proposer_contractor,
     myth_capability_proposer_senior,myth_capability_proposer_investor;

grant select on consumer.consumer_watches,consumer.consumer_watch_coverage,consumer.consumer_watch_events
  to authenticated;
grant execute on function consumer.list_available_watch_capabilities(uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.start_watch(uuid,uuid[],uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.pause_watch(uuid,bigint,uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.resume_watch(uuid,bigint,uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.stop_watch(uuid,bigint,uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.restart_watch(uuid,uuid[],bigint,uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.add_watch_coverage(uuid,uuid,bigint,uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.remove_watch_coverage(uuid,uuid,bigint,uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.get_watch(uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.get_watch_coverage(uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.get_cross_hub_entity_watch_state(uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.stop_watch_and_remove_saved_entity(uuid,bigint,bigint,uuid)
  to authenticated,myth_consumer_api;

-- P13 BFF identities gain only the two Watch scopes; table access remains denied.
update ops.consumer_hub_registry r
set allowed_scopes=r.allowed_scopes||array['watch:read','watch:write']
where not(array['watch:read','watch:write']<@r.allowed_scopes);

revoke all on function network.capability_proposer_hub() from public;
revoke all on function network.set_watch_capability_state(uuid,text,boolean,boolean,text,timestamptz) from public;
revoke all on function consumer.remove_saved_entity(uuid,bigint) from public;

commit;
