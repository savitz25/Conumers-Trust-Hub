-- Stage 4: parent-only P13 Save broker and exact FL DBPR P15 runtime.
-- Passwords are provisioned separately as SCRAM verifiers, never in Git.
begin;
create role myth_p13_save_runtime nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role myth_p15_dbpr_runtime nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema ops to myth_p13_save_runtime, myth_p15_dbpr_runtime;
alter role myth_p13_save_runtime set statement_timeout = '10s';
alter role myth_p15_dbpr_runtime set statement_timeout = '30s';

create table ops.consumer_save_handoffs (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references ops.consumer_browser_handoff_intents(id),
  canonical_user_id uuid not null references auth.users(id) on delete cascade,
  binding_id uuid not null references network.network_entity_bindings(id),
  issuer_hub text not null check (issuer_hub = 'contractor'),
  audience_hub text not null check (audience_hub = 'ask'),
  code_hash text unique check (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  consumed_at timestamptz
);
alter table ops.consumer_save_handoffs enable row level security;
revoke all on ops.consumer_save_handoffs from public,anon,authenticated;
comment on table ops.consumer_save_handoffs is 'P13 entity Save intent, tied to destination-prepared auth intent. No consumer identity is returned to the specialist. Raw codes and browser state are never stored.';

create function ops.prepare_contractor_save(p_intent text,p_state text,p_nonce text,p_user uuid)
returns void language plpgsql security definer set search_path=pg_catalog,ops,network as $$
declare binding_id uuid; intent_id uuid;
begin
  select b.id into strict binding_id from network.network_entity_bindings b
  where b.hub='contractor' and b.specialist_entity_type='contractor_profile'
    and b.specialist_entity_id='0001ac38-0c96-4e2f-8bf6-9ab243f7b79b'
    and b.identifier_namespace='fl.dbpr.license' and b.source_identifier='CCC1332036'
    and b.jurisdiction='FL' and b.binding_status='accepted' and b.valid_to is null;
  intent_id:=ops.create_browser_handoff_intent('auth',p_intent,'ask','https://www.asktrusthub.com',
    '/my/saved',p_state,p_nonce,'production',p_user::text);
  insert into ops.consumer_save_handoffs(intent_id,canonical_user_id,binding_id,issuer_hub,audience_hub)
    values(intent_id,p_user,binding_id,'contractor','ask');
end;
$$;

create function ops.issue_contractor_save(p_intent text,p_code text,p_issuer text,p_audience text)
returns void language plpgsql security definer set search_path=pg_catalog,ops as $$
declare intent ops.consumer_browser_handoff_intents%rowtype;
begin
  if p_issuer is distinct from 'contractor' or p_audience is distinct from 'ask' then raise exception 'INVALID_AUDIENCE'; end if;
  select i.* into intent from ops.consumer_browser_handoff_intents i
    where i.intent_code_hash=ops.hash_handoff_secret(p_intent) for update;
  if intent.id is null or intent.audience_hub<>p_audience then raise exception 'INVALID_STATE'; end if;
  if intent.expires_at<=statement_timestamp() then raise exception 'HANDOFF_EXPIRED'; end if;
  if intent.status<>'issued' then raise exception 'HANDOFF_ALREADY_USED'; end if;
  update ops.consumer_save_handoffs set code_hash=ops.hash_handoff_secret(p_code)
    where intent_id=intent.id and issuer_hub=p_issuer and audience_hub=p_audience and code_hash is null;
  if not found then raise exception 'HANDOFF_ALREADY_USED'; end if;
end;
$$;

create function ops.consume_contractor_save(p_code text,p_state text,p_nonce text,p_user uuid,p_issuer text,p_audience text)
returns uuid language plpgsql security definer set search_path=pg_catalog,ops,network as $$
declare handoff ops.consumer_save_handoffs%rowtype; intent ops.consumer_browser_handoff_intents%rowtype;
begin
  select * into handoff from ops.consumer_save_handoffs where code_hash=ops.hash_handoff_secret(p_code) for update;
  if handoff.id is null then raise exception 'INVALID_STATE'; end if;
  if handoff.issuer_hub is distinct from p_issuer or handoff.audience_hub is distinct from p_audience then raise exception 'INVALID_AUDIENCE'; end if;
  if handoff.canonical_user_id is distinct from p_user then raise exception 'INVALID_STATE'; end if;
  select * into intent from ops.consumer_browser_handoff_intents where id=handoff.intent_id for update;
  if intent.expires_at<=statement_timestamp() then raise exception 'HANDOFF_EXPIRED'; end if;
  if handoff.consumed_at is not null or intent.status<>'issued' then raise exception 'HANDOFF_ALREADY_USED'; end if;
  if intent.browser_state_hash<>ops.hash_handoff_secret(p_state) or intent.nonce_hash<>ops.hash_handoff_secret(p_nonce) then raise exception 'INVALID_STATE'; end if;
  if not exists(select 1 from network.network_entity_bindings where id=handoff.binding_id and binding_status='accepted' and valid_to is null) then raise exception 'ENTITY_REVIEW_REQUIRED'; end if;
  update ops.consumer_save_handoffs set consumed_at=statement_timestamp() where id=handoff.id;
  update ops.consumer_browser_handoff_intents set status='consumed',consumed_at=statement_timestamp() where id=intent.id;
  insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action) values('intent',intent.id,'consumed');
  return handoff.binding_id;
end;
$$;
revoke all on function ops.prepare_contractor_save(text,text,text,uuid),ops.issue_contractor_save(text,text,text,text),ops.consume_contractor_save(text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function ops.prepare_contractor_save(text,text,text,uuid),ops.issue_contractor_save(text,text,text,text),ops.consume_contractor_save(text,text,text,uuid,text,text) to myth_p13_save_runtime;

create function ops.dbpr_poll_targets()
returns table(binding_id uuid,credential text)
language sql stable security definer set search_path=pg_catalog,network,consumer as $$
  select distinct b.id,b.source_identifier from network.network_entity_bindings b
  join consumer.consumer_saved_entities s on s.network_entity_id=b.network_entity_id and s.removed_at is null
  join consumer.consumer_watches w on w.saved_entity_id=s.id and w.status='active'
  join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.status='enabled'
  join network.watch_capabilities cap on cap.id=c.capability_id and cap.version=c.capability_version
  where cap.capability_key='contractor.fl.dbpr.license_status' and cap.version=1
    and cap.enabled and cap.watch_eligible and cap.governance_status='approved'
    and b.hub='contractor' and b.identifier_namespace='fl.dbpr.license' and b.jurisdiction='FL'
    and b.binding_status='accepted' and b.valid_to is null
    and network.binding_is_watch_eligible(b.id,statement_timestamp());
$$;

create function ops.run_dbpr_poll(p_run text,p_started timestamptz,p_retrieved timestamptz,p_source_as_of timestamptz,p_rows jsonb,p_failure text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,ops,network as $$
declare cap uuid; checkpoint uuid; target record; submitted record; evaluated record; row_value jsonb;
  expected integer; checked integer:=0; changed integer:=0; quarantined integer:=0; health text;
begin
  -- No caller-supplied capability, source, namespace, SQL, or consumer identity.
  perform pg_advisory_xact_lock(hashtextextended('stage4:dbpr:poll',0));
  select id into strict cap from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=1 and enabled and governance_status='approved';
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 or octet_length(p_rows::text)>262144 then raise exception 'INVALID_POLL_INPUT'; end if;
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
revoke all on function ops.dbpr_poll_targets(),ops.run_dbpr_poll(text,timestamptz,timestamptz,timestamptz,jsonb,text) from public,anon,authenticated;
grant execute on function ops.dbpr_poll_targets(),ops.run_dbpr_poll(text,timestamptz,timestamptz,timestamptz,jsonb,text) to myth_p15_dbpr_runtime;
comment on role myth_p13_save_runtime is 'Parent production only; exactly three P13 Contractor Save functions. No table grants, consumer reads, general broker membership, or identity merging.';
comment on role myth_p15_dbpr_runtime is 'Parent daily poll only; exact certified DBPR targets and one bounded P15 ingest/detect function. No table grants, consumer reads, capability governance, quarantine release, or Alert fanout.';
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
    when 'myth_p15_dbpr_runtime' then 'contractor'
    when 'myth_source_ingestor_senior' then 'senior'
    when 'myth_source_ingestor_investor' then 'investor'
    else null end;
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
  if actor_role not in ('myth_change_detector','myth_p15_dbpr_runtime') then
    raise exception 'change detector authorization required' using errcode='insufficient_privilege';
  end if;
  select * into candidate from network.source_observations where id=p_observation_id for update;
  if candidate.id is null then raise exception 'observation not found' using errcode='no_data_found'; end if;
  if actor_role='myth_p15_dbpr_runtime' and not exists(select 1 from network.watch_capabilities where id=candidate.capability_id and capability_key='contractor.fl.dbpr.license_status' and version=1) then raise exception 'DBPR scope required' using errcode='insufficient_privilege'; end if;
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
