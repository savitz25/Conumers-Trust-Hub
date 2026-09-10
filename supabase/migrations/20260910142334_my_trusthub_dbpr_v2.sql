-- Stage 4: exact DBPR lookup is a NEW capability version. No subscription writes.
begin;

alter table network.watch_capability_observation_contracts
  add column source_contract jsonb not null default '{}'::jsonb
  check(jsonb_typeof(source_contract)='object' and octet_length(source_contract::text)<=8192);
comment on column network.watch_capability_observation_contracts.source_contract is
  'Immutable versioned source, clock, normalization and provenance semantics. Existing contracts retain their original semantics.';

create or replace function network.enforce_observation_contract_version()
returns trigger language plpgsql security definer set search_path=pg_catalog,network as $$
declare registry_version integer;
begin
  select version into registry_version from network.watch_capabilities where id=new.capability_id;
  if registry_version is null or registry_version<>new.capability_version then raise exception 'observation contract capability version mismatch' using errcode='integrity_constraint_violation'; end if;
  if tg_op='UPDATE' and (
    new.capability_id is distinct from old.capability_id or new.capability_version is distinct from old.capability_version
    or new.normalized_schema_version is distinct from old.normalized_schema_version
    or new.material_field_keys is distinct from old.material_field_keys
    or new.allowed_material_values is distinct from old.allowed_material_values
    or new.classifier_key is distinct from old.classifier_key or new.classifier_version is distinct from old.classifier_version
    or new.source_contract is distinct from old.source_contract
  ) then raise exception 'approved observation contract semantics are immutable; version the capability' using errcode='integrity_constraint_violation'; end if;
  return new;
end;
$$;

insert into network.watch_capabilities(
  capability_key,version,hub,entity_type,jurisdiction_scope,identifier_namespace,source_key,grain_key,
  display_name,consumer_description,governance_status,enabled,watch_eligible,source_connection_state,
  freshness_expectation,coverage_notes,coverage_limitations,effective_from,proposed_by,approved_by
) values (
  'contractor.fl.dbpr.license_status',2,'contractor','organization','FL','fl.dbpr.license','fl.dbpr.verify_licensee','license_status',
  'Florida DBPR exact license status','Check the exact Florida DBPR construction license number, preserving its primary and secondary status.',
  'approved',true,true,'configured',interval '1 day',
  'Current license status is checked daily through DBPR Verify a Licensee, using the exact license number. The bulk extract is secondary discovery data only. DBPR does not publish a record-as-of timestamp on this lookup; checked-at is reported separately.',
  array['Discipline','Sunbiz records','Local building permits','Civil lawsuits','Private reviews','Insurance cancellation'],
  '2026-09-10T00:00:00Z','stage4_exact_lookup_v2','stage4_user_authorized_source_contract'
);
insert into network.watch_capability_observation_contracts(
  capability_id,capability_version,normalized_schema_version,material_field_keys,allowed_material_values,
  classifier_key,classifier_version,freshness_grace,minimum_completeness_ratio,mass_change_threshold,
  monitoring_status,monitoring_reason,source_contract
)
select id,2,'contractor.fl.dbpr.license_status/v2',array['primary_status','secondary_status'],
  '{"primary_status":["current","delinquent","null_and_void","involuntarily_inactive"],"secondary_status":["active","inactive","voluntarily_inactive","involuntarily_inactive","not_reported"]}'::jsonb,
  'dbpr_status_pair_transition',1,interval '1 day',1,1000,'current',null,
  '{"version":2,"primary_source":"https://www.myfloridalicense.com/wl11.asp?mode=1&search=LicNbr","lookup":"Board 06; exact full license number; unique official detail identity","secondary_source":"https://www2.myfloridalicense.com/sto/file_download/extracts//CONSTRUCTIONLICENSE_1.csv","secondary_use":"discovery only; absence never implies license status","source_as_of_policy":"null when DBPR does not publish a record timestamp; never use page render clock","sequence_policy":"retrieved_at for undated live lookup, not a claimed source-effective date","health_policy":"complete compatible exact lookup within two days; independent of license status","normalization":"primary and secondary status are separate material fields; unsupported values quarantine","permitted_metadata":["official_status","source_url","source_record_key"],"schema":"contractor.fl.dbpr.license_status/v2","consent_version":"dbpr-exact-lookup-v2/2026-09-10"}'::jsonb
from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=2;
insert into network.alert_severity_rules(capability_id,capability_version,classifier_key,rule_version,rule_priority,event_type,severity,safe_template_key,governance_status,enabled,effective_from,approved_by)
select id,2,'dbpr_status_pair_transition',1,100,'license_status_changed','P2','license_status_changed','approved',true,effective_from,'stage4_exact_lookup_v2'
from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=2;

create function consumer.upgrade_dbpr_watch(
  p_watch_id uuid,p_from_capability_id uuid,p_to_capability_id uuid,p_expected_row_version bigint,
  p_idempotency_key uuid,p_consent_version text
)
returns bigint language plpgsql security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user(); watched consumer.consumer_watches%rowtype;
  old_coverage consumer.consumer_watch_coverage%rowtype; receipt consumer.consumer_watch_events%rowtype;
  request_hash text; next_version bigint;
begin
  if p_consent_version is distinct from 'dbpr-exact-lookup-v2/2026-09-10' or p_idempotency_key is null then raise exception 'EXPLICIT_VERSION_CONSENT_REQUIRED' using errcode='invalid_parameter_value'; end if;
  request_hash:=md5(concat_ws('|',p_watch_id,p_from_capability_id,p_to_capability_id,p_consent_version));
  select * into watched from consumer.consumer_watches where id=p_watch_id and user_id=subject for update;
  if watched.id is null then raise exception 'WATCH_NOT_FOUND' using errcode='insufficient_privilege'; end if;
  select * into receipt from consumer.consumer_watch_events where user_id=subject and idempotency_key=p_idempotency_key;
  if receipt.id is not null then
    if receipt.watch_id<>p_watch_id or receipt.request_fingerprint is distinct from request_hash then raise exception 'CONSENT_IDEMPOTENCY_CONFLICT' using errcode='integrity_constraint_violation'; end if;
    return (receipt.metadata->>'resulting_row_version')::bigint;
  end if;
  if watched.status not in ('active','paused') then raise exception 'WATCH_RESTART_REQUIRED' using errcode='integrity_constraint_violation'; end if;
  if p_expected_row_version is distinct from watched.row_version then raise exception 'WATCH_STALE' using errcode='serialization_failure'; end if;
  select * into old_coverage from consumer.consumer_watch_coverage where watch_id=p_watch_id and capability_id=p_from_capability_id and status='enabled' for update;
  if old_coverage.id is null or not exists(
    select 1 from network.watch_capabilities old_cap,network.watch_capabilities new_cap
    where old_cap.id=p_from_capability_id and new_cap.id=p_to_capability_id
      and old_cap.capability_key='contractor.fl.dbpr.license_status' and old_cap.version=1
      and new_cap.capability_key=old_cap.capability_key and new_cap.version=2
      and new_cap.source_key='fl.dbpr.verify_licensee'
  ) then raise exception 'INVALID_VERSION_UPGRADE' using errcode='check_violation'; end if;
  if consumer.watch_capability_eligibility_reason(watched.saved_entity_id,p_to_capability_id,statement_timestamp()) is not null then raise exception 'CAPABILITY_NOT_ELIGIBLE' using errcode='check_violation'; end if;
  if exists(select 1 from consumer.consumer_watch_coverage where watch_id=p_watch_id and capability_id=p_to_capability_id and status='enabled') then raise exception 'VERSION_ALREADY_SELECTED' using errcode='integrity_constraint_violation'; end if;
  insert into consumer.consumer_watch_coverage(watch_id,capability_id,capability_version,status)
  values(p_watch_id,p_to_capability_id,2,'enabled')
  on conflict(watch_id,capability_id) do update set status='enabled',enabled_at=statement_timestamp(),disabled_at=null,disabled_reason=null;
  update consumer.consumer_watch_coverage set status='disabled',disabled_at=statement_timestamp(),disabled_reason='consumer_upgraded_to_version_2' where id=old_coverage.id;
  update consumer.consumer_watches set row_version=row_version+1 where id=p_watch_id returning row_version into next_version;
  perform consumer.record_watch_event(p_watch_id,'coverage_removed',p_from_capability_id,null,null,
    jsonb_build_object('reason','explicit_version_upgrade','to_capability_id',p_to_capability_id,'consent_version',p_consent_version));
  perform consumer.record_watch_event(p_watch_id,'coverage_added',p_to_capability_id,p_idempotency_key,request_hash,
    jsonb_build_object('reason','explicit_version_upgrade','from_capability_id',p_from_capability_id,'from_version',1,'to_version',2,'consent_version',p_consent_version,'resulting_row_version',next_version));
  return next_version;
end;
$$;
revoke all on function consumer.upgrade_dbpr_watch(uuid,uuid,uuid,bigint,uuid,text) from public,anon;
grant execute on function consumer.upgrade_dbpr_watch(uuid,uuid,uuid,bigint,uuid,text) to authenticated;

create function ops.dbpr_v2_poll_targets()
returns table(binding_id uuid,credential text)
language sql stable security definer set search_path=pg_catalog,network,consumer as $$
  select distinct b.id,b.source_identifier from network.network_entity_bindings b
  join consumer.consumer_saved_entities s on s.source_binding_id=b.id and s.removed_at is null
  join consumer.consumer_watches w on w.saved_entity_id=s.id and w.status='active'
  join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.status='enabled'
  join network.watch_capabilities cap on cap.id=c.capability_id and cap.version=c.capability_version
  where cap.capability_key='contractor.fl.dbpr.license_status' and cap.version=2 and cap.source_key='fl.dbpr.verify_licensee'
    and cap.enabled and cap.watch_eligible and cap.governance_status='approved'
    and b.hub='contractor' and b.identifier_namespace='fl.dbpr.license' and b.jurisdiction='FL'
    and b.binding_status='accepted' and b.valid_to is null
    and network.binding_is_watch_eligible(b.id,statement_timestamp());
$$;
revoke all on function ops.dbpr_v2_poll_targets() from public,anon,authenticated;
grant execute on function ops.dbpr_v2_poll_targets() to myth_p15_dbpr_runtime;

create function ops.run_dbpr_v2_poll(p_run text,p_started timestamptz,p_completed timestamptz,p_rows jsonb,p_failure text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,ops,network as $$
declare cap uuid; checkpoint uuid; target record; submitted record; evaluated record; item jsonb;
  expected integer; checked integer:=0; changed integer:=0; quarantined integer:=0; health text; retrieved timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('stage4:dbpr:v2:poll',0));
  select id into strict cap from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=2 and source_key='fl.dbpr.verify_licensee' and enabled and governance_status='approved';
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>20 or octet_length(p_rows::text)>65536 then raise exception 'INVALID_POLL_INPUT'; end if;
  if p_failure is not null and p_failure not in ('SOURCE_FETCH_FAILED','SOURCE_SCHEMA_INVALID','SOURCE_IDENTITY_MISSING','SOURCE_IDENTITY_AMBIGUOUS','SOURCE_CAPACITY_EXCEEDED') then raise exception 'INVALID_POLL_FAILURE'; end if;
  if p_started is null or p_completed is null or p_completed<p_started or p_completed>statement_timestamp()+interval '1 minute' then raise exception 'INVALID_POLL_CLOCK'; end if;
  select count(*) into expected from ops.dbpr_v2_poll_targets();
  if expected=0 then return jsonb_build_object('outcome','no_certified_targets','checked',0,'changes',0); end if;
  checkpoint:=ops.start_source_checkpoint(cap,p_run,'FL',expected,p_started);
  select health_status into health from ops.source_feed_checkpoints where id=checkpoint and run_status<>'running';
  if found then return jsonb_build_object('checkpoint',checkpoint,'deduplicated',true,'health',health); end if;
  if p_failure is not null or jsonb_array_length(p_rows)<>expected then
    health:=ops.complete_source_checkpoint(checkpoint,'failed',p_completed,null,p_completed,0,'failed',
      case when p_failure='SOURCE_SCHEMA_INVALID' then 'invalid' else 'unknown' end,
      coalesce(p_failure,'SOURCE_IDENTITY_MISSING'),'The exact DBPR lookup could not be completed. No-change assurance is unavailable.');
    return jsonb_build_object('checkpoint',checkpoint,'health',health,'checked',0,'changes',0);
  end if;
  for target in select * from ops.dbpr_v2_poll_targets() loop
    if (select count(*) from jsonb_array_elements(p_rows) r where r->>'credential'=target.credential)<>1 then raise exception 'INVALID_POLL_IDENTITY'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_rows) loop
    if item - array['credential','primary_status','secondary_status','official_status','source_url','source_as_of','retrieved_at'] <> '{}'::jsonb
      or not(item ?& array['credential','primary_status','secondary_status','official_status','source_url','source_as_of','retrieved_at'])
      or item->'source_as_of' is distinct from 'null'::jsonb
      or jsonb_typeof(item->'credential') is distinct from 'string'
      or item->>'credential' !~ '^[A-Z]{3}[0-9]{7}$'
      or jsonb_typeof(item->'official_status') is distinct from 'string' or char_length(item->>'official_status') not between 1 and 120
      or jsonb_typeof(item->'source_url') is distinct from 'string'
      or item->>'source_url' !~ '^https://www[.]myfloridalicense[.]com/portalsearches/VerifyLicensee/LicenseDetail[?]ID=[A-F0-9]{16,128}$'
      then raise exception 'INVALID_POLL_FIELDS'; end if;
    retrieved:=(item->>'retrieved_at')::timestamptz;
    if retrieved is null or retrieved<p_started or retrieved>p_completed then raise exception 'INVALID_POLL_CLOCK'; end if;
  end loop;
  -- The approved v2 source exposes no record publication timestamp. Preserve NULL.
  health:=ops.complete_source_checkpoint(checkpoint,'succeeded',p_completed,null,p_completed,expected,'complete','compatible');
  for target in select * from ops.dbpr_v2_poll_targets() loop
    select r into item from jsonb_array_elements(p_rows) r where r->>'credential'=target.credential;
    select * into submitted from network.submit_source_observation(target.binding_id,cap,checkpoint,target.credential,
      jsonb_build_object('primary_status',item->>'primary_status','secondary_status',item->>'secondary_status','official_status',item->>'official_status'),
      null,null,(item->>'retrieved_at')::timestamptz,null,null,'contractor.fl.dbpr.license_status/v2',item->>'source_url',null);
    select * into evaluated from network.accept_source_observation(submitted.observation_id);
    checked:=checked+1;
    if evaluated.change_event_id is not null and not submitted.deduplicated then changed:=changed+1; end if;
    if evaluated.observation_status in ('quarantined','rejected') or evaluated.evaluation_status='quarantined' then quarantined:=quarantined+1; end if;
  end loop;
  select ops.evaluate_checkpoint_health(checkpoint,statement_timestamp()) into health;
  return jsonb_build_object('checkpoint',checkpoint,'health',health,'checked',checked,'changes',changed,'quarantined',quarantined);
end;
$$;
revoke all on function ops.run_dbpr_v2_poll(text,timestamptz,timestamptz,jsonb,text) from public,anon,authenticated;
grant execute on function ops.run_dbpr_v2_poll(text,timestamptz,timestamptz,jsonb,text) to myth_p15_dbpr_runtime;

-- More narrow, owner-checked UI projection; raw observations remain private.
create function consumer.get_dbpr_watch_status(p_saved_entity_id uuid)
returns table(capability_id uuid,primary_status text,secondary_status text,official_status text,source_url text,source_as_of timestamptz,retrieved_at timestamptz,observed_at timestamptz,evaluation_status text)
language plpgsql stable security definer set search_path=pg_catalog,network,consumer as $$
declare subject uuid:=consumer.require_user(); saved consumer.consumer_saved_entities%rowtype;
begin
  select * into saved from consumer.consumer_saved_entities where id=p_saved_entity_id and user_id=subject and removed_at is null;
  if saved.id is null then raise exception 'Saved entity not found' using errcode='no_data_found'; end if;
  return query select cap.id,o.normalized_value->>'primary_status',o.normalized_value->>'secondary_status',o.normalized_value->>'official_status',o.provenance_ref,o.source_as_of,o.retrieved_at,o.observed_at,o.change_evaluation_status
  from consumer.consumer_watches w
  join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.status='enabled'
  join network.watch_capabilities cap on cap.id=c.capability_id and cap.version=c.capability_version
  left join lateral(select obs.* from network.source_observations obs where obs.network_entity_id=network.resolve_canonical_entity(saved.network_entity_id) and obs.capability_id=cap.id and obs.capability_version=2 and obs.observation_status='accepted' order by obs.sequence_effective_at desc,obs.observed_at desc limit 1) o on true
  where w.saved_entity_id=saved.id and cap.capability_key='contractor.fl.dbpr.license_status' and cap.version=2;
end;
$$;
revoke all on function consumer.get_dbpr_watch_status(uuid) from public,anon;
grant execute on function consumer.get_dbpr_watch_status(uuid) to authenticated;

-- Additional compatibility-preserving P15 function definitions appended below.

-- Existing P15 behavior is retained for every capability except the explicit v2 lookup failure policy.
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
  exact_lookup boolean;
begin
  select * into checkpoint from ops.source_feed_checkpoints where id=p_checkpoint_id for update;
  if checkpoint.id is null then raise exception 'checkpoint not found' using errcode='no_data_found'; end if;
  select * into capability from network.watch_capabilities where id=checkpoint.capability_id;
  select * into contract from network.watch_capability_observation_contracts where capability_id=checkpoint.capability_id and (not exact_lookup or monitoring_status<>'quarantined');
  exact_lookup:=capability.capability_key='contractor.fl.dbpr.license_status' and capability.version=2 and capability.source_key='fl.dbpr.verify_licensee';
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
     and p_observed_record_count is not null and (not exact_lookup or p_run_status='succeeded') then
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
    when p_run_status='failed' and checkpoint.last_success_at is null
      and (not exact_lookup or not exists(select 1 from ops.source_feed_checkpoints prior where prior.capability_id=capability.id and prior.last_success_at is not null)) then 'unknown'
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
  -- A transient exact-lookup failure changes check health, not the approved schema.
  if effective_schema<>'compatible' and (not exact_lookup or effective_schema in ('changed','invalid')) then
    update network.watch_capability_observation_contracts
    set monitoring_status='degraded',monitoring_reason='Source schema requires operator review.'
    where capability_id=checkpoint.capability_id and (not exact_lookup or monitoring_status<>'quarantined');
    perform ops.record_source_monitoring_event('schema_drift',checkpoint.capability_id,p_checkpoint_id);
  elsif effective_error='RECORD_COUNT_COLLAPSE' and (not exact_lookup or p_run_status='succeeded') then
    update network.watch_capability_observation_contracts
    set monitoring_status='degraded',monitoring_reason='Source record-count completeness requires operator review.'
    where capability_id=checkpoint.capability_id and (not exact_lookup or monitoring_status<>'quarantined');
    perform ops.record_source_monitoring_event('record_count_collapse',checkpoint.capability_id,p_checkpoint_id);
  end if;
  return effective_health;
end;
$$;

-- The existing scoped runtime may accept only DBPR v1/v2 through its wrappers.
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
  if actor_role not in ('myth_change_detector','myth_p15_dbpr_runtime') then
    raise exception 'change detector authorization required' using errcode='insufficient_privilege';
  end if;
  select * into candidate from network.source_observations where id=p_observation_id for update;
  if candidate.id is null then raise exception 'observation not found' using errcode='no_data_found'; end if;
  if actor_role='myth_p15_dbpr_runtime' and not exists(select 1 from network.watch_capabilities where id=candidate.capability_id and capability_key='contractor.fl.dbpr.license_status' and version in (1,2) and (version=1 or source_key='fl.dbpr.verify_licensee')) then raise exception 'DBPR scope required' using errcode='insufficient_privilege'; end if;
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

commit;
