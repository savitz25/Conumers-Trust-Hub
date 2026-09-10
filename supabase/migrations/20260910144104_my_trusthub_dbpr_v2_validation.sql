-- Reject metadata/status mismatches before accepting any scoped input.
begin;
create function network.dbpr_v2_status_matches(p_value jsonb)
returns boolean language sql immutable security invoker set search_path=pg_catalog as $$
 select cardinality(parts) between 1 and 2
  and p_value->>'primary_status'=case lower(btrim(parts[1]))
   when 'current' then 'current' when 'delinquent' then 'delinquent'
   when 'null & void' then 'null_and_void' when 'null and void' then 'null_and_void'
   when 'involuntary inactive' then 'involuntarily_inactive' when 'involuntarily inactive' then 'involuntarily_inactive' end
  and p_value->>'secondary_status'=case when cardinality(parts)=1 then 'not_reported' else case lower(btrim(parts[2]))
   when 'active' then 'active' when 'inactive' then 'inactive'
   when 'voluntary inactive' then 'voluntarily_inactive' when 'voluntarily inactive' then 'voluntarily_inactive'
   when 'involuntary inactive' then 'involuntarily_inactive' when 'involuntarily inactive' then 'involuntarily_inactive' end end
 from (select string_to_array(regexp_replace(p_value->>'official_status','\s+',' ','g'),',') parts) parsed;
$$;
revoke all on function network.dbpr_v2_status_matches(jsonb) from public,anon,authenticated;

create or replace function ops.run_dbpr_v2_poll(p_run text,p_started timestamptz,p_completed timestamptz,p_rows jsonb,p_failure text default null)
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
    if network.dbpr_v2_status_matches(item) is not true then raise exception 'INVALID_POLL_STATUS'; end if;
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
commit;
