-- P14 compensating rollback. P11B, P12, and P13 remain intact.

begin;

update ops.consumer_hub_registry r
set allowed_scopes=array_remove(array_remove(r.allowed_scopes,'watch:read'),'watch:write');

drop function if exists consumer.stop_watch_and_remove_saved_entity(uuid,bigint,bigint,uuid);
drop function if exists consumer.get_cross_hub_entity_watch_state(uuid);
drop function if exists consumer.get_watch_coverage(uuid);
drop function if exists consumer.get_watch(uuid);
drop function if exists consumer.restart_watch(uuid,uuid[],bigint,uuid);
drop function if exists consumer.remove_watch_coverage(uuid,uuid,bigint,uuid);
drop function if exists consumer.add_watch_coverage(uuid,uuid,bigint,uuid);
drop function if exists consumer.stop_watch(uuid,bigint,uuid);
drop function if exists consumer.resume_watch(uuid,bigint,uuid);
drop function if exists consumer.pause_watch(uuid,bigint,uuid);
drop function if exists consumer.start_watch(uuid,uuid[],uuid);
drop function if exists consumer.record_watch_event(uuid,text,uuid,uuid,text,jsonb);
drop function if exists consumer.list_available_watch_capabilities(uuid);
drop function if exists consumer.watch_capability_eligibility_reason(uuid,uuid,timestamptz);

drop trigger if exists watch_capabilities_propagate_unavailability on network.watch_capabilities;
drop function if exists network.propagate_watch_capability_state();
drop function if exists network.set_watch_capability_state(uuid,text,boolean,boolean,text,timestamptz);

drop table if exists consumer.consumer_watch_events;
drop table if exists consumer.consumer_watch_coverage;
drop table if exists consumer.consumer_watches;

drop function if exists consumer.enforce_coverage_capability_version();
drop function if exists consumer.enforce_watch_ownership();

drop trigger if exists watch_capabilities_audit on network.watch_capabilities;
drop trigger if exists watch_capabilities_semantic_immutability on network.watch_capabilities;
drop function if exists network.audit_watch_capability();
drop function if exists network.enforce_watch_capability_version_immutability();
drop function if exists network.propose_watch_capability(text,integer,text,text,text,text,text,text,text,text,interval,text,text[],timestamptz);
drop function if exists network.capability_proposer_hub();
drop table if exists network.watch_capability_events;
drop table if exists network.watch_capabilities;

-- Restore the exact P12 unsave contract: Project membership is the only
-- conflict because Watch tables no longer exist after this rollback.
create or replace function consumer.remove_saved_entity(
  p_saved_entity_id uuid,
  p_expected_row_version bigint
)
returns bigint
language plpgsql
security definer
set search_path=pg_catalog,consumer
as $$
declare
  subject uuid:=consumer.require_user();
  next_version bigint;
begin
  if exists(
    select 1 from consumer.consumer_project_saved_entities m
    join consumer.consumer_saved_entities s on s.id=m.saved_entity_id
    where m.saved_entity_id=p_saved_entity_id
      and s.user_id=subject
      and m.removed_at is null
  ) then
    raise exception 'Saved entity still belongs to one or more Projects'
      using errcode='integrity_constraint_violation';
  end if;

  update consumer.consumer_saved_entities s
  set removed_at=statement_timestamp(),row_version=s.row_version+1
  where s.id=p_saved_entity_id
    and s.user_id=subject
    and s.removed_at is null
    and s.row_version=p_expected_row_version
  returning s.row_version into next_version;

  if next_version is null then
    raise exception 'Saved entity not found or stale row version'
      using errcode='serialization_failure';
  end if;
  return next_version;
end;
$$;

revoke all on function consumer.remove_saved_entity(uuid,bigint) from public;
grant execute on function consumer.remove_saved_entity(uuid,bigint) to authenticated;

revoke usage on schema network from myth_capability_governor,
  myth_capability_proposer_move,myth_capability_proposer_lender,
  myth_capability_proposer_insurance,myth_capability_proposer_contractor,
  myth_capability_proposer_senior,myth_capability_proposer_investor;

do $$
declare role_name text;
begin
  foreach role_name in array array[
    'myth_capability_proposer_move','myth_capability_proposer_lender',
    'myth_capability_proposer_insurance','myth_capability_proposer_contractor',
    'myth_capability_proposer_senior','myth_capability_proposer_investor',
    'myth_capability_governor'
  ] loop
    if exists(select 1 from pg_catalog.pg_roles where rolname=role_name) then
      execute format('drop role %I',role_name);
    end if;
  end loop;
end;
$$;

commit;
