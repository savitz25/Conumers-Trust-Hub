-- My TrustHub P15: normalized source observations, source health, deterministic
-- material-change detection, and Watch-aware matching. Apply only after P11-P14.
-- This migration intentionally creates no consumer Alerts or delivery behavior.

begin;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

do $$
declare role_name text;
begin
  foreach role_name in array array[
    'myth_source_ingestor_move',
    'myth_source_ingestor_lender',
    'myth_source_ingestor_insurance',
    'myth_source_ingestor_contractor',
    'myth_source_ingestor_senior',
    'myth_source_ingestor_investor',
    'myth_monitoring_operator'
  ] loop
    if not exists(select 1 from pg_catalog.pg_roles where rolname=role_name) then
      execute format('create role %I nologin noinherit',role_name);
    end if;
  end loop;
end;
$$;

comment on role myth_source_ingestor is
  'Parent group reserved for source-ingestion infrastructure; P15 hub roles use only narrow functions.';
comment on role myth_change_detector is
  'Parent change detector that accepts validated observations and creates deterministic network events.';
comment on role myth_alert_fanout is
  'Reserved for P16; P15 grants no observation, event, checkpoint, or consumer-table privileges.';
comment on role myth_notification_delivery is
  'Reserved for later delivery work; P15 grants no privileges.';
comment on role myth_monitoring_operator is
  'Parent operator for quarantine release, capability kill switches, and sourced event corrections.';

create table network.watch_capability_observation_contracts (
  capability_id uuid primary key references network.watch_capabilities(id) on delete restrict,
  capability_version integer not null check (capability_version > 0),
  normalized_schema_version text not null check (normalized_schema_version ~ '^[a-z0-9][a-z0-9._/-]{0,63}$'),
  material_field_keys text[] not null check (cardinality(material_field_keys) between 1 and 32),
  allowed_material_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(allowed_material_values)='object' and octet_length(allowed_material_values::text)<=8192),
  classifier_key text not null check (classifier_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  classifier_version integer not null check (classifier_version > 0),
  freshness_grace interval not null default interval '0 seconds' check (freshness_grace >= interval '0 seconds'),
  minimum_completeness_ratio numeric(6,5) not null default 0.95000
    check (minimum_completeness_ratio > 0 and minimum_completeness_ratio <= 1),
  mass_change_threshold integer not null default 1000 check (mass_change_threshold > 0),
  monitoring_status text not null default 'current'
    check (monitoring_status in ('current','degraded','quarantined','disabled')),
  monitoring_reason text null check (monitoring_reason is null or char_length(btrim(monitoring_reason)) <= 500),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on table network.watch_capability_observation_contracts is
  'Parent-approved normalized schema, material fields, classifier, freshness, and anomaly policy for one immutable capability version.';

create table network.alert_severity_rules (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references network.watch_capabilities(id) on delete restrict,
  capability_version integer not null check (capability_version > 0),
  classifier_key text not null check (classifier_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  rule_version integer not null check (rule_version > 0),
  rule_priority integer not null default 100 check (rule_priority between 1 and 10000),
  previous_material_value jsonb null,
  new_material_value jsonb null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  severity text not null check (severity in ('P0','P1','P2')),
  safe_template_key text not null check (safe_template_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  governance_status text not null default 'draft'
    check (governance_status in ('draft','review_required','approved','disabled','retired')),
  enabled boolean not null default false,
  effective_from timestamptz not null,
  effective_to timestamptz null,
  approved_by text null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(capability_id,rule_version,event_type,rule_priority),
  check (effective_to is null or effective_to > effective_from),
  check ((governance_status='approved' and approved_by is not null) or governance_status<>'approved'),
  check (governance_status='approved' or not enabled)
);

create index alert_severity_rules_lookup_idx
  on network.alert_severity_rules(capability_id,capability_version,classifier_key,rule_priority)
  where governance_status='approved' and enabled;

comment on table network.alert_severity_rules is
  'Versioned deterministic transition rules. Severity applies only to the source event, never to the entity.';

create table ops.source_feed_checkpoints (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references network.watch_capabilities(id) on delete restrict,
  capability_version integer not null check (capability_version > 0),
  source_key text not null check (source_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  jurisdiction text not null check (char_length(btrim(jurisdiction)) between 1 and 100),
  jurisdiction_key text generated always as (lower(btrim(jurisdiction))) stored,
  run_id text not null check (char_length(btrim(run_id)) between 1 and 160),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  run_status text not null default 'running' check (run_status in ('running','succeeded','failed')),
  started_at timestamptz not null,
  completed_at timestamptz null,
  last_success_at timestamptz null,
  source_as_of timestamptz null,
  retrieved_at timestamptz null,
  expected_record_count bigint null check (expected_record_count is null or expected_record_count >= 0),
  observed_record_count bigint null check (observed_record_count is null or observed_record_count >= 0),
  material_change_count integer not null default 0 check (material_change_count >= 0),
  completeness_status text not null default 'unknown'
    check (completeness_status in ('complete','partial','failed','unknown')),
  schema_status text not null default 'unknown'
    check (schema_status in ('compatible','changed','invalid','unknown')),
  health_status text not null default 'unknown'
    check (health_status in ('current','delayed','degraded','unknown')),
  mass_change_status text not null default 'none'
    check (mass_change_status in ('none','detected','released')),
  error_code text null check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  error_summary text null check (error_summary is null or char_length(btrim(error_summary)) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(source_key,capability_id,capability_version,jurisdiction_key,run_id),
  check (completed_at is null or completed_at >= started_at),
  check (run_status='running' or completed_at is not null)
);

create index source_feed_checkpoints_capability_time_idx
  on ops.source_feed_checkpoints(capability_id,completed_at desc nulls last);
create index source_feed_checkpoints_source_time_idx
  on ops.source_feed_checkpoints(source_key,jurisdiction_key,started_at desc);

comment on table ops.source_feed_checkpoints is
  'Operational source-run health. It stores counts, clocks, and status only; never secrets or raw regulator payloads.';

create table network.source_observations (
  id uuid primary key default gen_random_uuid(),
  original_network_entity_id uuid not null references network.network_entities(id) on delete restrict,
  network_entity_id uuid not null references network.network_entities(id) on delete restrict,
  entity_binding_id uuid not null references network.network_entity_bindings(id) on delete restrict,
  capability_id uuid not null references network.watch_capabilities(id) on delete restrict,
  capability_version integer not null check (capability_version > 0),
  source_key text not null check (source_key ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  grain_key text not null check (grain_key ~ '^[a-z][a-z0-9_.:-]{1,159}$'),
  source_record_key text null check (source_record_key is null or char_length(btrim(source_record_key)) <= 300),
  normalized_value jsonb not null check (jsonb_typeof(normalized_value)='object' and octet_length(normalized_value::text) <= 32768),
  material_value jsonb not null check (jsonb_typeof(material_value)='object'),
  normalized_fingerprint text not null check (normalized_fingerprint ~ '^[a-f0-9]{64}$'),
  material_fingerprint text not null check (material_fingerprint ~ '^[a-f0-9]{64}$'),
  observation_fingerprint text not null unique check (observation_fingerprint ~ '^[a-f0-9]{64}$'),
  observation_status text not null default 'candidate'
    check (observation_status in ('candidate','accepted','quarantined','superseded','rejected')),
  change_evaluation_status text not null default 'pending'
    check (change_evaluation_status in ('pending','baseline','no_change','event_created','classifier_missing','late_historical','quarantined','rejected')),
  quarantine_reason text null check (quarantine_reason is null or char_length(btrim(quarantine_reason)) <= 500),
  source_as_of timestamptz null,
  published_at timestamptz null,
  retrieved_at timestamptz not null,
  observed_at timestamptz null,
  snapshot_as_of timestamptz null,
  generated_at timestamptz null,
  sequence_effective_at timestamptz not null,
  ingest_run_id uuid not null references ops.source_feed_checkpoints(id) on delete restrict,
  provenance_ref text not null check (char_length(btrim(provenance_ref)) between 1 and 500),
  schema_version text not null check (schema_version ~ '^[a-z0-9][a-z0-9._/-]{0,63}$'),
  created_at timestamptz not null default statement_timestamp(),
  check ((observation_status in ('quarantined','rejected')) = (quarantine_reason is not null))
);

create index source_observations_entity_capability_latest_idx
  on network.source_observations(network_entity_id,capability_id,sequence_effective_at desc,observed_at desc nulls last)
  where observation_status='accepted';
create index source_observations_capability_status_idx
  on network.source_observations(capability_id,observation_status,created_at desc);
create index source_observations_checkpoint_idx
  on network.source_observations(ingest_run_id);
create index source_observations_binding_idx
  on network.source_observations(entity_binding_id);
create index source_observations_original_entity_idx
  on network.source_observations(original_network_entity_id);

comment on table network.source_observations is
  'Minimal normalized monitoring envelope. All source clocks remain distinct; raw vertical evidence stays in the specialist system.';
comment on column network.source_observations.sequence_effective_at is
  'Ordering key derived as source_as_of, then published_at, then snapshot_as_of, then retrieved_at; source clock columns remain independently stored.';

create table network.network_change_events (
  id uuid primary key default gen_random_uuid(),
  network_entity_id uuid not null references network.network_entities(id) on delete restrict,
  capability_id uuid not null references network.watch_capabilities(id) on delete restrict,
  capability_version integer not null check (capability_version > 0),
  checkpoint_id uuid not null references ops.source_feed_checkpoints(id) on delete restrict,
  previous_observation_id uuid not null references network.source_observations(id) on delete restrict,
  new_observation_id uuid not null references network.source_observations(id) on delete restrict,
  severity_rule_id uuid not null references network.alert_severity_rules(id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.:-]{1,127}$'),
  previous_material_value jsonb not null,
  new_material_value jsonb not null,
  source_as_of timestamptz null,
  observed_at timestamptz not null,
  severity text not null check (severity in ('P0','P1','P2')),
  severity_rule_version integer not null check (severity_rule_version > 0),
  event_fingerprint text not null unique check (event_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null default 'active'
    check (status in ('active','suppressed','quarantined','retracted')),
  fanout_status text not null default 'pending'
    check (fanout_status in ('pending','complete','not_applicable')),
  correction_of_event_id uuid null references network.network_change_events(id) on delete restrict,
  retraction_reason text null check (retraction_reason is null or char_length(btrim(retraction_reason)) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  check ((status='retracted') = (retraction_reason is not null))
);

create index network_change_events_entity_capability_idx
  on network.network_change_events(network_entity_id,capability_id,observed_at desc);
create index network_change_events_capability_active_idx
  on network.network_change_events(capability_id,observed_at desc)
  where status='active';
create index network_change_events_checkpoint_idx
  on network.network_change_events(checkpoint_id);
create index network_change_events_previous_observation_idx
  on network.network_change_events(previous_observation_id);
create index network_change_events_new_observation_idx
  on network.network_change_events(new_observation_id);
create index network_change_events_rule_idx
  on network.network_change_events(severity_rule_id);
create index network_change_events_correction_idx
  on network.network_change_events(correction_of_event_id)
  where correction_of_event_id is not null;

comment on table network.network_change_events is
  'One idempotent, deterministic material transition. Severity classifies this event only and never classifies the entity.';

create table ops.source_monitoring_events (
  id bigint generated always as identity primary key,
  action text not null check (action in (
    'checkpoint_started','checkpoint_completed','checkpoint_degraded','schema_drift',
    'record_count_collapse','candidate_submitted','observation_accepted','observation_quarantined',
    'observation_rejected','late_observation','same_time_conflict','change_created',
    'mass_change_detected','capability_kill_switch','quarantine_released','event_retracted'
  )),
  capability_id uuid null references network.watch_capabilities(id) on delete restrict,
  checkpoint_id uuid null references ops.source_feed_checkpoints(id) on delete restrict,
  observation_id uuid null references network.source_observations(id) on delete restrict,
  change_event_id uuid null references network.network_change_events(id) on delete restrict,
  actor text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object' and octet_length(details::text)<=8192),
  occurred_at timestamptz not null default statement_timestamp()
);

create index source_monitoring_events_capability_time_idx
  on ops.source_monitoring_events(capability_id,occurred_at desc);
create index source_monitoring_events_checkpoint_idx
  on ops.source_monitoring_events(checkpoint_id)
  where checkpoint_id is not null;
create index source_monitoring_events_observation_idx
  on ops.source_monitoring_events(observation_id)
  where observation_id is not null;
create index source_monitoring_events_change_idx
  on ops.source_monitoring_events(change_event_id)
  where change_event_id is not null;

comment on table ops.source_monitoring_events is
  'Minimal server-only audit linking source runs, observation acceptance/quarantine, and material events. Routine reads are not logged.';

create trigger watch_capability_observation_contracts_set_updated_at
before update on network.watch_capability_observation_contracts
for each row execute function network.set_updated_at();
create trigger alert_severity_rules_set_updated_at
before update on network.alert_severity_rules
for each row execute function network.set_updated_at();
create trigger source_feed_checkpoints_set_updated_at
before update on ops.source_feed_checkpoints
for each row execute function network.set_updated_at();

create or replace function network.enforce_observation_contract_version()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,network
as $$
declare registry_version integer;
begin
  select version into registry_version from network.watch_capabilities where id=new.capability_id;
  if registry_version is null or registry_version<>new.capability_version then
    raise exception 'observation contract capability version mismatch' using errcode='integrity_constraint_violation';
  end if;
  if tg_op='UPDATE' and (
    new.capability_id is distinct from old.capability_id
    or new.capability_version is distinct from old.capability_version
    or new.normalized_schema_version is distinct from old.normalized_schema_version
    or new.material_field_keys is distinct from old.material_field_keys
    or new.allowed_material_values is distinct from old.allowed_material_values
    or new.classifier_key is distinct from old.classifier_key
    or new.classifier_version is distinct from old.classifier_version
  ) then
    raise exception 'approved observation contract semantics are immutable; version the capability'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger watch_capability_observation_contract_version
before insert or update on network.watch_capability_observation_contracts
for each row execute function network.enforce_observation_contract_version();

create or replace function network.enforce_severity_rule_version()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,network
as $$
declare registry_version integer;
begin
  select version into registry_version from network.watch_capabilities where id=new.capability_id;
  if registry_version is null or registry_version<>new.capability_version then
    raise exception 'severity rule capability version mismatch' using errcode='integrity_constraint_violation';
  end if;
  if tg_op='UPDATE' and old.governance_status in ('approved','disabled','retired') and (
    new.capability_id is distinct from old.capability_id
    or new.capability_version is distinct from old.capability_version
    or new.classifier_key is distinct from old.classifier_key
    or new.rule_version is distinct from old.rule_version
    or new.previous_material_value is distinct from old.previous_material_value
    or new.new_material_value is distinct from old.new_material_value
    or new.event_type is distinct from old.event_type
    or new.severity is distinct from old.severity
    or new.safe_template_key is distinct from old.safe_template_key
  ) then
    raise exception 'approved severity rule semantics are immutable; create a new rule version'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger alert_severity_rules_version
before insert or update on network.alert_severity_rules
for each row execute function network.enforce_severity_rule_version();

create or replace function network.p15_ingestor_hub()
returns text
language sql
stable
security invoker
set search_path=pg_catalog
as $$
  select case coalesce(nullif(current_setting('role',true),'none'),session_user::text)
    when 'myth_source_ingestor_move' then 'move'
    when 'myth_source_ingestor_lender' then 'lender'
    when 'myth_source_ingestor_insurance' then 'insurance'
    when 'myth_source_ingestor_contractor' then 'contractor'
    when 'myth_source_ingestor_senior' then 'senior'
    when 'myth_source_ingestor_investor' then 'investor'
    else null end;
$$;

create or replace function network.extract_material_value(p_value jsonb,p_keys text[])
returns jsonb
language sql
immutable
security invoker
set search_path=pg_catalog
as $$
  select coalesce(jsonb_object_agg(k,p_value->k order by k),'{}'::jsonb)
  from unnest(p_keys) as k
  where p_value ? k;
$$;

create or replace function ops.record_source_monitoring_event(
  p_action text,
  p_capability_id uuid default null,
  p_checkpoint_id uuid default null,
  p_observation_id uuid default null,
  p_change_event_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,network,ops
as $$
declare event_id bigint;
begin
  insert into ops.source_monitoring_events(
    action,capability_id,checkpoint_id,observation_id,change_event_id,actor,details
  ) values(
    p_action,p_capability_id,p_checkpoint_id,p_observation_id,p_change_event_id,
    network.request_actor(),coalesce(p_details,'{}'::jsonb)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function ops.start_source_checkpoint(
  p_capability_id uuid,
  p_run_id text,
  p_jurisdiction text,
  p_expected_record_count bigint,
  p_started_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,network,ops,extensions
as $$
declare
  ingestor_hub text:=network.p15_ingestor_hub();
  capability network.watch_capabilities%rowtype;
  request_hash text;
  existing ops.source_feed_checkpoints%rowtype;
  checkpoint_id uuid;
begin
  select * into capability from network.watch_capabilities where id=p_capability_id;
  if capability.id is null or ingestor_hub is null or capability.hub<>ingestor_hub then
    raise exception 'source ingestor is not authorized for capability' using errcode='insufficient_privilege';
  end if;
  if p_run_id is null or btrim(p_run_id)='' or p_started_at is null then
    raise exception 'run id and start time are required' using errcode='invalid_parameter_value';
  end if;
  request_hash:=encode(digest(concat_ws('|',p_capability_id::text,capability.version::text,btrim(p_run_id),lower(btrim(p_jurisdiction)),coalesce(p_expected_record_count::text,'null'),p_started_at::text),'sha256'),'hex');

  select * into existing
  from ops.source_feed_checkpoints
  where source_key=capability.source_key and capability_id=capability.id
    and capability_version=capability.version and jurisdiction_key=lower(btrim(p_jurisdiction))
    and run_id=btrim(p_run_id);
  if existing.id is not null then
    if existing.request_fingerprint<>request_hash then
      raise exception 'checkpoint idempotency conflict' using errcode='integrity_constraint_violation';
    end if;
    return existing.id;
  end if;

  insert into ops.source_feed_checkpoints(
    capability_id,capability_version,source_key,jurisdiction,run_id,request_fingerprint,
    started_at,expected_record_count
  ) values(
    capability.id,capability.version,capability.source_key,btrim(p_jurisdiction),btrim(p_run_id),
    request_hash,p_started_at,p_expected_record_count
  ) returning id into checkpoint_id;
  perform ops.record_source_monitoring_event('checkpoint_started',capability.id,checkpoint_id);
  return checkpoint_id;
end;
$$;

create or replace function ops.complete_source_checkpoint(
  p_checkpoint_id uuid,
  p_run_status text,
  p_completed_at timestamptz,
  p_source_as_of timestamptz,
  p_retrieved_at timestamptz,
  p_observed_record_count bigint,
  p_completeness_status text,
  p_schema_status text,
  p_error_code text default null,
  p_error_summary text default null
)
returns text
language plpgsql
security definer
set search_path=pg_catalog,network,ops
as $$
declare
  ingestor_hub text:=network.p15_ingestor_hub();
  checkpoint ops.source_feed_checkpoints%rowtype;
  capability network.watch_capabilities%rowtype;
  contract network.watch_capability_observation_contracts%rowtype;
  effective_completeness text:=p_completeness_status;
  effective_schema text:=p_schema_status;
  effective_health text;
  effective_error text:=p_error_code;
  effective_summary text:=p_error_summary;
  ratio numeric;
begin
  select * into checkpoint from ops.source_feed_checkpoints where id=p_checkpoint_id for update;
  if checkpoint.id is null then raise exception 'checkpoint not found' using errcode='no_data_found'; end if;
  select * into capability from network.watch_capabilities where id=checkpoint.capability_id;
  select * into contract from network.watch_capability_observation_contracts where capability_id=checkpoint.capability_id;
  if ingestor_hub is null or capability.hub<>ingestor_hub then
    raise exception 'source ingestor is not authorized for checkpoint' using errcode='insufficient_privilege';
  end if;
  if checkpoint.run_status<>'running' then
    if checkpoint.run_status=p_run_status
      and checkpoint.completed_at=p_completed_at
      and checkpoint.observed_record_count is not distinct from p_observed_record_count then
      return checkpoint.health_status;
    end if;
    raise exception 'checkpoint completion conflict' using errcode='integrity_constraint_violation';
  end if;
  if p_run_status not in ('succeeded','failed')
    or p_completeness_status not in ('complete','partial','failed','unknown')
    or p_schema_status not in ('compatible','changed','invalid','unknown') then
    raise exception 'invalid checkpoint status' using errcode='invalid_parameter_value';
  end if;
  if checkpoint.expected_record_count is not null and checkpoint.expected_record_count>0
     and p_observed_record_count is not null then
    ratio:=p_observed_record_count::numeric/checkpoint.expected_record_count::numeric;
    if ratio<contract.minimum_completeness_ratio then
      effective_completeness:='partial';
      effective_error:='RECORD_COUNT_COLLAPSE';
      effective_summary:='Observed record count fell below the approved completeness threshold.';
    end if;
  end if;
  effective_health:=case
    when p_run_status='succeeded' and effective_completeness='complete' and effective_schema='compatible'
      then 'current'
    when p_run_status='failed' and checkpoint.last_success_at is null then 'unknown'
    else 'degraded' end;

  update ops.source_feed_checkpoints set
    run_status=p_run_status,completed_at=p_completed_at,
    last_success_at=case when effective_health='current' then p_completed_at else last_success_at end,
    source_as_of=p_source_as_of,retrieved_at=p_retrieved_at,
    observed_record_count=p_observed_record_count,completeness_status=effective_completeness,
    schema_status=effective_schema,health_status=effective_health,
    error_code=effective_error,error_summary=effective_summary
  where id=p_checkpoint_id;

  perform ops.record_source_monitoring_event(
    case when effective_health='current' then 'checkpoint_completed' else 'checkpoint_degraded' end,
    checkpoint.capability_id,p_checkpoint_id,null,null,
    jsonb_build_object('health',effective_health,'completeness',effective_completeness,'schema',effective_schema)
  );
  if effective_schema<>'compatible' then
    update network.watch_capability_observation_contracts
    set monitoring_status='degraded',monitoring_reason='Source schema requires operator review.'
    where capability_id=checkpoint.capability_id;
    perform ops.record_source_monitoring_event('schema_drift',checkpoint.capability_id,p_checkpoint_id);
  elsif effective_error='RECORD_COUNT_COLLAPSE' then
    update network.watch_capability_observation_contracts
    set monitoring_status='degraded',monitoring_reason='Source record-count completeness requires operator review.'
    where capability_id=checkpoint.capability_id;
    perform ops.record_source_monitoring_event('record_count_collapse',checkpoint.capability_id,p_checkpoint_id);
  end if;
  return effective_health;
end;
$$;

create or replace function ops.evaluate_checkpoint_health(
  p_checkpoint_id uuid,
  p_at timestamptz default statement_timestamp()
)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,network,ops
as $$
declare checkpoint ops.source_feed_checkpoints%rowtype; capability network.watch_capabilities%rowtype; contract network.watch_capability_observation_contracts%rowtype;
begin
  select * into checkpoint from ops.source_feed_checkpoints where id=p_checkpoint_id;
  if checkpoint.id is null then return 'unknown'; end if;
  if checkpoint.health_status<>'current' then return checkpoint.health_status; end if;
  select * into capability from network.watch_capabilities where id=checkpoint.capability_id;
  select * into contract from network.watch_capability_observation_contracts where capability_id=checkpoint.capability_id;
  if checkpoint.last_success_at is null or contract.capability_id is null then return 'unknown'; end if;
  if checkpoint.last_success_at + capability.freshness_expectation + contract.freshness_grace < p_at then return 'delayed'; end if;
  return 'current';
end;
$$;

create or replace function network.submit_source_observation(
  p_binding_id uuid,
  p_capability_id uuid,
  p_checkpoint_id uuid,
  p_source_record_key text,
  p_normalized_value jsonb,
  p_source_as_of timestamptz,
  p_published_at timestamptz,
  p_retrieved_at timestamptz,
  p_snapshot_as_of timestamptz,
  p_generated_at timestamptz,
  p_schema_version text,
  p_provenance_ref text,
  p_claimed_normalized_fingerprint text default null
)
returns table(observation_id uuid,observation_status text,deduplicated boolean)
language plpgsql
security definer
set search_path=pg_catalog,network,ops,extensions
as $$
declare
  ingestor_hub text:=network.p15_ingestor_hub();
  capability network.watch_capabilities%rowtype;
  contract network.watch_capability_observation_contracts%rowtype;
  binding network.network_entity_bindings%rowtype;
  checkpoint ops.source_feed_checkpoints%rowtype;
  canonical_entity uuid;
  material jsonb;
  normalized_hash text;
  material_hash text;
  observation_hash text;
  sequence_at timestamptz;
  initial_status text:='candidate';
  reason text;
  existing_id uuid;
  invalid_allowed_value boolean:=false;
begin
  select * into capability from network.watch_capabilities where id=p_capability_id;
  select * into contract from network.watch_capability_observation_contracts where capability_id=p_capability_id;
  select * into binding from network.network_entity_bindings where id=p_binding_id;
  select * into checkpoint from ops.source_feed_checkpoints where id=p_checkpoint_id;
  if capability.id is null or contract.capability_id is null or binding.id is null or checkpoint.id is null then
    raise exception 'observation reference unresolved' using errcode='foreign_key_violation';
  end if;
  if ingestor_hub is null or capability.hub<>ingestor_hub or binding.hub<>ingestor_hub then
    raise exception 'source ingestor is not authorized for source' using errcode='insufficient_privilege';
  end if;
  if checkpoint.capability_id<>capability.id or checkpoint.capability_version<>capability.version
    or checkpoint.source_key<>capability.source_key then
    raise exception 'source checkpoint does not match capability' using errcode='integrity_constraint_violation';
  end if;
  if binding.identifier_namespace<>capability.identifier_namespace
    or lower(checkpoint.jurisdiction)<>lower(capability.jurisdiction_scope)
    or lower(coalesce(binding.jurisdiction,''))<>lower(capability.jurisdiction_scope) then
    raise exception 'binding or jurisdiction does not match capability' using errcode='integrity_constraint_violation';
  end if;
  if p_retrieved_at is null or p_normalized_value is null or jsonb_typeof(p_normalized_value)<>'object' then
    raise exception 'normalized object and retrieved time are required' using errcode='invalid_parameter_value';
  end if;

  canonical_entity:=network.resolve_canonical_entity(binding.network_entity_id);
  sequence_at:=coalesce(p_source_as_of,p_published_at,p_snapshot_as_of,p_retrieved_at);
  material:=network.extract_material_value(p_normalized_value,contract.material_field_keys);
  normalized_hash:=encode(digest(p_normalized_value::text,'sha256'),'hex');
  material_hash:=encode(digest(material::text,'sha256'),'hex');

  if exists(select 1 from unnest(contract.material_field_keys) k where not(p_normalized_value ? k))
     or p_schema_version<>contract.normalized_schema_version then
    initial_status:='quarantined'; reason:='schema_drift';
  end if;
  select exists(
    select 1 from jsonb_each(contract.allowed_material_values) allowed
    where jsonb_typeof(allowed.value)='array'
      and not (allowed.value @> jsonb_build_array(p_normalized_value->allowed.key))
  ) into invalid_allowed_value;
  if invalid_allowed_value then
    initial_status:='quarantined'; reason:='invalid_material_value';
  end if;
  if p_provenance_ref is null or btrim(p_provenance_ref)='' then
    initial_status:='rejected'; reason:='missing_provenance';
  elsif p_claimed_normalized_fingerprint is not null
    and p_claimed_normalized_fingerprint<>normalized_hash then
    initial_status:='rejected'; reason:='normalized_fingerprint_mismatch';
  elsif p_source_as_of is not null and p_source_as_of>p_retrieved_at+interval '1 day' then
    initial_status:='quarantined'; reason:='impossible_source_clock';
  elsif binding.binding_status<>'accepted' or not network.binding_is_watch_eligible(binding.id,p_retrieved_at) then
    initial_status:='quarantined'; reason:='identity_review_required';
  elsif capability.governance_status<>'approved' or not capability.enabled or not capability.watch_eligible
     or contract.monitoring_status<>'current' then
    initial_status:='quarantined'; reason:='capability_unavailable';
  end if;

  observation_hash:=encode(digest(concat_ws('|',canonical_entity::text,capability.id::text,
    capability.version::text,capability.source_key,coalesce(p_source_record_key,''),
    sequence_at::text,normalized_hash),'sha256'),'hex');

  select id into existing_id from network.source_observations where observation_fingerprint=observation_hash;
  if existing_id is not null then
    return query select existing_id,(select o.observation_status from network.source_observations o where o.id=existing_id),true;
    return;
  end if;

  insert into network.source_observations(
    original_network_entity_id,network_entity_id,entity_binding_id,capability_id,capability_version,
    source_key,grain_key,source_record_key,normalized_value,material_value,
    normalized_fingerprint,material_fingerprint,observation_fingerprint,observation_status,
    change_evaluation_status,quarantine_reason,source_as_of,published_at,retrieved_at,
    snapshot_as_of,generated_at,sequence_effective_at,ingest_run_id,provenance_ref,schema_version
  ) values(
    binding.network_entity_id,canonical_entity,binding.id,capability.id,capability.version,
    capability.source_key,capability.grain_key,p_source_record_key,p_normalized_value,material,
    normalized_hash,material_hash,observation_hash,initial_status,
    case when initial_status='candidate' then 'pending' when initial_status='rejected' then 'rejected' else 'quarantined' end,
    reason,p_source_as_of,p_published_at,p_retrieved_at,p_snapshot_as_of,p_generated_at,
    sequence_at,checkpoint.id,coalesce(nullif(btrim(p_provenance_ref),''),'[missing]'),p_schema_version
  ) returning id into observation_id;

  if initial_status in ('quarantined','rejected') then
    update ops.source_feed_checkpoints
    set health_status=case when initial_status='rejected' and last_success_at is null then 'unknown' else 'degraded' end,
        schema_status=case when reason in ('schema_drift','invalid_material_value') then 'changed' else schema_status end,
        error_code=upper(reason),error_summary='Observation was not accepted for monitoring.'
    where id=checkpoint.id;
    if reason in ('schema_drift','invalid_material_value') then
      update network.watch_capability_observation_contracts
      set monitoring_status='degraded',monitoring_reason='Normalized source schema or values require operator review.'
      where capability_id=capability.id;
    end if;
  end if;
  perform ops.record_source_monitoring_event(
    case when initial_status='candidate' then 'candidate_submitted'
      when initial_status='rejected' then 'observation_rejected' else 'observation_quarantined' end,
    capability.id,checkpoint.id,observation_id,null,jsonb_build_object('reason',reason)
  );
  observation_status:=initial_status;
  deduplicated:=false;
  return next;
end;
$$;

create or replace function network.accept_source_observation(p_observation_id uuid)
returns table(observation_id uuid,observation_status text,evaluation_status text,change_event_id uuid)
language plpgsql
security definer
set search_path=pg_catalog,network,ops,extensions
as $$
declare
  actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  candidate network.source_observations%rowtype;
  previous network.source_observations%rowtype;
  same_time network.source_observations%rowtype;
  checkpoint ops.source_feed_checkpoints%rowtype;
  contract network.watch_capability_observation_contracts%rowtype;
  rule network.alert_severity_rules%rowtype;
  event_hash text;
  event_status text:='active';
  event_id uuid;
  change_count integer;
begin
  if actor_role<>'myth_change_detector' then
    raise exception 'change detector authorization required' using errcode='insufficient_privilege';
  end if;
  select * into candidate from network.source_observations where id=p_observation_id for update;
  if candidate.id is null then raise exception 'observation not found' using errcode='no_data_found'; end if;
  if candidate.observation_status<>'candidate' then
    return query select candidate.id,candidate.observation_status,candidate.change_evaluation_status,
      (select e.id from network.network_change_events e where e.new_observation_id=candidate.id limit 1);
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(candidate.network_entity_id::text||':'||candidate.capability_id::text,0));
  select * into checkpoint from ops.source_feed_checkpoints where id=candidate.ingest_run_id for update;
  select * into contract from network.watch_capability_observation_contracts where capability_id=candidate.capability_id;
  if ops.evaluate_checkpoint_health(checkpoint.id,statement_timestamp())<>'current'
    or checkpoint.completeness_status<>'complete' or checkpoint.schema_status<>'compatible'
    or checkpoint.mass_change_status='detected' or contract.monitoring_status<>'current' then
    update network.source_observations set observation_status='quarantined',
      change_evaluation_status='quarantined',quarantine_reason='source_not_current'
    where id=candidate.id;
    perform ops.record_source_monitoring_event('observation_quarantined',candidate.capability_id,checkpoint.id,candidate.id,null,jsonb_build_object('reason','source_not_current'));
    return query select candidate.id,'quarantined'::text,'quarantined'::text,null::uuid;
    return;
  end if;
  if not network.binding_is_watch_eligible(candidate.entity_binding_id,candidate.retrieved_at) then
    update network.source_observations set observation_status='quarantined',change_evaluation_status='quarantined',quarantine_reason='identity_review_required' where id=candidate.id;
    perform ops.record_source_monitoring_event('observation_quarantined',candidate.capability_id,checkpoint.id,candidate.id,null,jsonb_build_object('reason','identity_review_required'));
    return query select candidate.id,'quarantined'::text,'quarantined'::text,null::uuid;
    return;
  end if;

  select * into same_time from network.source_observations o
  where o.network_entity_id=candidate.network_entity_id and o.capability_id=candidate.capability_id
    and o.capability_version=candidate.capability_version and o.observation_status='accepted'
    and o.sequence_effective_at=candidate.sequence_effective_at
  order by o.observed_at desc limit 1;
  if same_time.id is not null then
    if same_time.material_fingerprint<>candidate.material_fingerprint then
      update network.source_observations set observation_status='quarantined',change_evaluation_status='quarantined',quarantine_reason='same_effective_time_conflict' where id=candidate.id;
      update ops.source_feed_checkpoints set health_status='degraded',error_code='SAME_TIME_CONFLICT',error_summary='Conflicting material values share one effective source time.' where id=checkpoint.id;
      update network.watch_capability_observation_contracts set monitoring_status='degraded',monitoring_reason='Conflicting values require operator review.' where capability_id=candidate.capability_id;
      perform ops.record_source_monitoring_event('same_time_conflict',candidate.capability_id,checkpoint.id,candidate.id,null);
      return query select candidate.id,'quarantined'::text,'quarantined'::text,null::uuid;
      return;
    end if;
    update network.source_observations set observation_status='superseded',change_evaluation_status='late_historical',observed_at=statement_timestamp() where id=candidate.id;
    return query select candidate.id,'superseded'::text,'late_historical'::text,null::uuid;
    return;
  end if;

  select * into previous from network.source_observations o
  where o.network_entity_id=candidate.network_entity_id and o.capability_id=candidate.capability_id
    and o.capability_version=candidate.capability_version and o.observation_status='accepted'
  order by o.sequence_effective_at desc,o.observed_at desc limit 1;

  if previous.id is not null and candidate.sequence_effective_at<previous.sequence_effective_at then
    update network.source_observations set observation_status='superseded',change_evaluation_status='late_historical',observed_at=statement_timestamp() where id=candidate.id;
    perform ops.record_source_monitoring_event('late_observation',candidate.capability_id,checkpoint.id,candidate.id);
    return query select candidate.id,'superseded'::text,'late_historical'::text,null::uuid;
    return;
  end if;
  if previous.id is null then
    update network.source_observations set observation_status='accepted',change_evaluation_status='baseline',observed_at=statement_timestamp() where id=candidate.id;
    perform ops.record_source_monitoring_event('observation_accepted',candidate.capability_id,checkpoint.id,candidate.id,null,jsonb_build_object('evaluation','baseline'));
    return query select candidate.id,'accepted'::text,'baseline'::text,null::uuid;
    return;
  end if;
  if previous.material_fingerprint=candidate.material_fingerprint then
    update network.source_observations set observation_status='accepted',change_evaluation_status='no_change',observed_at=statement_timestamp() where id=candidate.id;
    perform ops.record_source_monitoring_event('observation_accepted',candidate.capability_id,checkpoint.id,candidate.id,null,jsonb_build_object('evaluation','no_change'));
    return query select candidate.id,'accepted'::text,'no_change'::text,null::uuid;
    return;
  end if;

  select * into rule from network.alert_severity_rules r
  where r.capability_id=candidate.capability_id and r.capability_version=candidate.capability_version
    and r.classifier_key=contract.classifier_key and r.governance_status='approved' and r.enabled
    and r.effective_from<=candidate.sequence_effective_at
    and (r.effective_to is null or r.effective_to>candidate.sequence_effective_at)
    and (r.previous_material_value is null or r.previous_material_value=previous.material_value)
    and (r.new_material_value is null or r.new_material_value=candidate.material_value)
  order by r.rule_priority asc,r.rule_version desc limit 1;
  if rule.id is null then
    update network.source_observations set observation_status='accepted',change_evaluation_status='classifier_missing',observed_at=statement_timestamp() where id=candidate.id;
    update ops.source_feed_checkpoints set health_status='degraded',error_code='CLASSIFIER_MISSING',error_summary='Material transition has no approved classifier rule.' where id=checkpoint.id;
    update network.watch_capability_observation_contracts set monitoring_status='degraded',monitoring_reason='Material transition requires classifier review.' where capability_id=candidate.capability_id;
    return query select candidate.id,'accepted'::text,'classifier_missing'::text,null::uuid;
    return;
  end if;

  update ops.source_feed_checkpoints set material_change_count=material_change_count+1
    where id=checkpoint.id returning material_change_count into change_count;
  if change_count>contract.mass_change_threshold then
    event_status:='quarantined';
    update ops.source_feed_checkpoints set mass_change_status='detected',health_status='degraded',
      error_code='MASS_CHANGE_DETECTED',error_summary='Material-change count exceeded the approved run threshold.'
    where id=checkpoint.id;
    update network.watch_capability_observation_contracts set monitoring_status='quarantined',monitoring_reason='Mass-change guard requires parent operator review.' where capability_id=candidate.capability_id;
    update network.network_change_events set status='suppressed',fanout_status='not_applicable'
      where checkpoint_id=checkpoint.id and status='active';
    perform ops.record_source_monitoring_event('mass_change_detected',candidate.capability_id,checkpoint.id,candidate.id);
  end if;

  update network.source_observations set observation_status='accepted',
    change_evaluation_status=case when event_status='active' then 'event_created' else 'quarantined' end,
    observed_at=statement_timestamp()
  where id=candidate.id;
  candidate.observed_at:=statement_timestamp();
  event_hash:=encode(digest(concat_ws('|',candidate.network_entity_id::text,candidate.capability_id::text,
    candidate.capability_version::text,previous.material_fingerprint,candidate.material_fingerprint,
    candidate.sequence_effective_at::text,rule.id::text,rule.rule_version::text),'sha256'),'hex');
  insert into network.network_change_events(
    network_entity_id,capability_id,capability_version,checkpoint_id,
    previous_observation_id,new_observation_id,severity_rule_id,event_type,
    previous_material_value,new_material_value,source_as_of,observed_at,severity,
    severity_rule_version,event_fingerprint,status,fanout_status
  ) values(
    candidate.network_entity_id,candidate.capability_id,candidate.capability_version,checkpoint.id,
    previous.id,candidate.id,rule.id,rule.event_type,previous.material_value,candidate.material_value,
    candidate.source_as_of,statement_timestamp(),rule.severity,rule.rule_version,event_hash,event_status,
    case when event_status='active' then 'pending' else 'not_applicable' end
  ) on conflict(event_fingerprint) do update set event_fingerprint=excluded.event_fingerprint
  returning id into event_id;
  perform ops.record_source_monitoring_event('change_created',candidate.capability_id,checkpoint.id,candidate.id,event_id,jsonb_build_object('status',event_status,'severity',rule.severity));
  return query select candidate.id,'accepted'::text,
    case when event_status='active' then 'event_created' else 'quarantined' end,event_id;
end;
$$;

create or replace function network.set_capability_monitoring_state(
  p_capability_id uuid,
  p_monitoring_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,network,ops
as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
begin
  if actor_role<>'myth_monitoring_operator' then
    raise exception 'monitoring operator authorization required' using errcode='insufficient_privilege';
  end if;
  if p_monitoring_status not in ('current','degraded','quarantined','disabled')
     or (p_monitoring_status<>'current' and (p_reason is null or btrim(p_reason)='')) then
    raise exception 'valid state and reason required' using errcode='invalid_parameter_value';
  end if;
  update network.watch_capability_observation_contracts
  set monitoring_status=p_monitoring_status,
      monitoring_reason=case when p_monitoring_status='current' then null else btrim(p_reason) end
  where capability_id=p_capability_id;
  if not found then raise exception 'observation contract not found' using errcode='no_data_found'; end if;
  if p_monitoring_status<>'current' then
    update network.network_change_events
    set status='suppressed',fanout_status='not_applicable'
    where capability_id=p_capability_id and status='active' and fanout_status='pending';
  end if;
  perform ops.record_source_monitoring_event('capability_kill_switch',p_capability_id,null,null,null,
    jsonb_build_object('monitoring_status',p_monitoring_status,'reason',p_reason));
end;
$$;

create or replace function ops.release_source_quarantine(
  p_checkpoint_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,network,ops
as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); checkpoint ops.source_feed_checkpoints%rowtype;
begin
  if actor_role<>'myth_monitoring_operator' then
    raise exception 'monitoring operator authorization required' using errcode='insufficient_privilege';
  end if;
  if p_reason is null or char_length(btrim(p_reason))<3 then
    raise exception 'release reason required' using errcode='invalid_parameter_value';
  end if;
  select * into checkpoint from ops.source_feed_checkpoints where id=p_checkpoint_id for update;
  if checkpoint.id is null then raise exception 'checkpoint not found' using errcode='no_data_found'; end if;
  if checkpoint.run_status<>'succeeded' or checkpoint.completeness_status<>'complete' or checkpoint.schema_status<>'compatible' then
    raise exception 'checkpoint facts are not safe for release' using errcode='integrity_constraint_violation';
  end if;
  update ops.source_feed_checkpoints set health_status='current',mass_change_status='released',error_code=null,error_summary=null where id=checkpoint.id;
  update network.watch_capability_observation_contracts set monitoring_status='current',monitoring_reason=null where capability_id=checkpoint.capability_id;
  perform ops.record_source_monitoring_event('quarantine_released',checkpoint.capability_id,checkpoint.id,null,null,jsonb_build_object('reason',btrim(p_reason)));
end;
$$;

create or replace function network.retract_change_event(
  p_change_event_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,network,ops
as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); changed network.network_change_events%rowtype;
begin
  if actor_role<>'myth_monitoring_operator' then
    raise exception 'monitoring operator authorization required' using errcode='insufficient_privilege';
  end if;
  if p_reason is null or char_length(btrim(p_reason))<3 then raise exception 'retraction reason required' using errcode='invalid_parameter_value'; end if;
  update network.network_change_events set status='retracted',fanout_status='not_applicable',retraction_reason=btrim(p_reason)
    where id=p_change_event_id and status<>'retracted' returning * into changed;
  if changed.id is null then raise exception 'active event not found' using errcode='no_data_found'; end if;
  perform ops.record_source_monitoring_event('event_retracted',changed.capability_id,changed.checkpoint_id,changed.new_observation_id,changed.id,jsonb_build_object('reason',btrim(p_reason)));
end;
$$;

create or replace function network.coverage_no_change_eligible(
  p_coverage_id uuid,
  p_at timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer,ops
as $$
declare
  coverage consumer.consumer_watch_coverage%rowtype;
  watched consumer.consumer_watches%rowtype;
  saved consumer.consumer_saved_entities%rowtype;
  capability network.watch_capabilities%rowtype;
  contract network.watch_capability_observation_contracts%rowtype;
  checkpoint ops.source_feed_checkpoints%rowtype;
  latest network.source_observations%rowtype;
  canonical_entity uuid;
begin
  select * into coverage from consumer.consumer_watch_coverage where id=p_coverage_id;
  if coverage.id is null or coverage.status<>'enabled' then return false; end if;
  select * into watched from consumer.consumer_watches where id=coverage.watch_id;
  if watched.id is null or watched.status<>'active' then return false; end if;
  select * into saved from consumer.consumer_saved_entities where id=watched.saved_entity_id and removed_at is null;
  if saved.id is null then return false; end if;
  canonical_entity:=network.resolve_canonical_entity(saved.network_entity_id);
  select * into capability from network.watch_capabilities where id=coverage.capability_id;
  select * into contract from network.watch_capability_observation_contracts where capability_id=coverage.capability_id;
  if capability.governance_status<>'approved' or not capability.enabled or not capability.watch_eligible
     or contract.monitoring_status<>'current' then return false; end if;
  select * into checkpoint from ops.source_feed_checkpoints c
    where c.capability_id=coverage.capability_id and c.capability_version=coverage.capability_version
    order by c.completed_at desc nulls last,c.created_at desc limit 1;
  if checkpoint.id is null or ops.evaluate_checkpoint_health(checkpoint.id,p_at)<>'current'
     or checkpoint.completeness_status<>'complete' or checkpoint.schema_status<>'compatible'
     or checkpoint.mass_change_status='detected' then return false; end if;
  select * into latest from network.source_observations o
    where o.network_entity_id=canonical_entity and o.capability_id=coverage.capability_id
      and o.capability_version=coverage.capability_version and o.observation_status='accepted'
    order by o.sequence_effective_at desc,o.observed_at desc limit 1;
  if latest.id is null or latest.ingest_run_id<>checkpoint.id or latest.change_evaluation_status<>'no_change' then return false; end if;
  if exists(select 1 from network.network_change_events e
    where e.network_entity_id=canonical_entity and e.capability_id=coverage.capability_id
      and e.capability_version=coverage.capability_version and e.status='active' and e.fanout_status='pending') then return false; end if;
  return true;
end;
$$;

create or replace function consumer.get_watch_source_health(p_saved_entity_id uuid)
returns table(
  coverage_id uuid,capability_key text,capability_version integer,source_key text,
  health_status text,last_successful_check timestamptz,source_as_of timestamptz,
  completeness_status text,schema_status text,monitoring_status text,no_change_eligible boolean
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer,ops
as $$
declare subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype;
begin
  select * into saved from consumer.consumer_saved_entities where id=p_saved_entity_id and user_id=subject and removed_at is null;
  if saved.id is null then raise exception 'Saved entity not found' using errcode='no_data_found'; end if;
  return query
  select c.id,cap.capability_key,c.capability_version,cap.source_key,
    case when contract.monitoring_status<>'current' then 'degraded'
         else ops.evaluate_checkpoint_health(checkpoint.id,statement_timestamp()) end,
    checkpoint.last_success_at,checkpoint.source_as_of,
    coalesce(checkpoint.completeness_status,'unknown'),coalesce(checkpoint.schema_status,'unknown'),
    coalesce(contract.monitoring_status,'disabled'),network.coverage_no_change_eligible(c.id,statement_timestamp())
  from consumer.consumer_watches w
  join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.status='enabled'
  join network.watch_capabilities cap on cap.id=c.capability_id and cap.version=c.capability_version
  left join network.watch_capability_observation_contracts contract on contract.capability_id=c.capability_id
  left join lateral(
    select cp.* from ops.source_feed_checkpoints cp
    where cp.capability_id=c.capability_id and cp.capability_version=c.capability_version
    order by cp.completed_at desc nulls last,cp.created_at desc limit 1
  ) checkpoint on true
  where w.saved_entity_id=saved.id;
end;
$$;

create or replace function consumer.get_watch_health(p_saved_entity_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,consumer
as $$
declare result text;
begin
  select case max(case h.health_status when 'current' then 0 when 'delayed' then 1 when 'degraded' then 2 else 3 end)
    when 0 then 'current' when 1 then 'delayed' when 2 then 'degraded' else 'unknown' end
  into result from consumer.get_watch_source_health(p_saved_entity_id) h;
  return coalesce(result,'unknown');
end;
$$;

create or replace function network.list_matching_active_watch_coverage(p_change_event_id uuid)
returns table(watch_id uuid,coverage_id uuid,user_id uuid,resume_boundary_at timestamptz)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer
as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); event network.network_change_events%rowtype;
begin
  if actor_role<>'myth_change_detector' then
    raise exception 'change detector authorization required' using errcode='insufficient_privilege';
  end if;
  select * into event from network.network_change_events where id=p_change_event_id and status='active' and fanout_status='pending';
  if event.id is null then return; end if;
  return query
  select w.id,c.id,w.user_id,w.resume_boundary_at
  from consumer.consumer_watches w
  join consumer.consumer_saved_entities s on s.id=w.saved_entity_id and s.removed_at is null
  join consumer.consumer_watch_coverage c on c.watch_id=w.id
  where w.status='active' and c.status='enabled'
    and c.capability_id=event.capability_id and c.capability_version=event.capability_version
    and network.resolve_canonical_entity(s.network_entity_id)=event.network_entity_id
    and event.observed_at>=w.resume_boundary_at;
end;
$$;

alter table network.watch_capability_observation_contracts enable row level security;
alter table network.watch_capability_observation_contracts force row level security;
alter table network.alert_severity_rules enable row level security;
alter table network.alert_severity_rules force row level security;
alter table ops.source_feed_checkpoints enable row level security;
alter table ops.source_feed_checkpoints force row level security;
alter table network.source_observations enable row level security;
alter table network.source_observations force row level security;
alter table network.network_change_events enable row level security;
alter table network.network_change_events force row level security;
alter table ops.source_monitoring_events enable row level security;
alter table ops.source_monitoring_events force row level security;

create policy observation_contracts_governor_all
on network.watch_capability_observation_contracts
for all to myth_capability_governor
using (true) with check (true);
create policy severity_rules_governor_all
on network.alert_severity_rules
for all to myth_capability_governor
using (true) with check (true);

revoke all on table network.watch_capability_observation_contracts from public,anon,authenticated;
revoke all on table network.alert_severity_rules from public,anon,authenticated;
revoke all on table ops.source_feed_checkpoints from public,anon,authenticated;
revoke all on table network.source_observations from public,anon,authenticated;
revoke all on table network.network_change_events from public,anon,authenticated;
revoke all on table ops.source_monitoring_events from public,anon,authenticated;

grant usage on schema network,ops to myth_capability_governor,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_move,myth_source_ingestor_lender,myth_source_ingestor_insurance,
  myth_source_ingestor_contractor,myth_source_ingestor_senior,myth_source_ingestor_investor;
grant select,insert,update on network.watch_capability_observation_contracts,network.alert_severity_rules to myth_capability_governor;

grant execute on function consumer.get_watch_source_health(uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.get_watch_health(uuid) to authenticated,myth_consumer_api;
grant execute on function network.accept_source_observation(uuid) to myth_change_detector;
grant execute on function network.list_matching_active_watch_coverage(uuid) to myth_change_detector;
grant execute on function network.set_capability_monitoring_state(uuid,text,text) to myth_monitoring_operator;
grant execute on function ops.release_source_quarantine(uuid,text) to myth_monitoring_operator;
grant execute on function network.retract_change_event(uuid,text) to myth_monitoring_operator;

grant execute on function ops.start_source_checkpoint(uuid,text,text,bigint,timestamptz),
  ops.complete_source_checkpoint(uuid,text,timestamptz,timestamptz,timestamptz,bigint,text,text,text,text),
  network.submit_source_observation(uuid,uuid,uuid,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text)
to myth_source_ingestor_move,myth_source_ingestor_lender,myth_source_ingestor_insurance,
   myth_source_ingestor_contractor,myth_source_ingestor_senior,myth_source_ingestor_investor;

revoke all on function network.enforce_observation_contract_version() from public;
revoke all on function network.enforce_severity_rule_version() from public;
revoke all on function network.p15_ingestor_hub() from public;
revoke all on function network.extract_material_value(jsonb,text[]) from public;
revoke all on function ops.record_source_monitoring_event(text,uuid,uuid,uuid,uuid,jsonb) from public;
revoke all on function ops.start_source_checkpoint(uuid,text,text,bigint,timestamptz) from public;
revoke all on function ops.complete_source_checkpoint(uuid,text,timestamptz,timestamptz,timestamptz,bigint,text,text,text,text) from public;
revoke all on function ops.evaluate_checkpoint_health(uuid,timestamptz) from public;
revoke all on function network.submit_source_observation(uuid,uuid,uuid,text,jsonb,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text) from public;
revoke all on function network.accept_source_observation(uuid) from public;
revoke all on function network.set_capability_monitoring_state(uuid,text,text) from public;
revoke all on function ops.release_source_quarantine(uuid,text) from public;
revoke all on function network.retract_change_event(uuid,text) from public;
revoke all on function network.coverage_no_change_eligible(uuid,timestamptz) from public;
revoke all on function consumer.get_watch_source_health(uuid) from public;
revoke all on function consumer.get_watch_health(uuid) from public;
revoke all on function network.list_matching_active_watch_coverage(uuid) from public;

commit;
