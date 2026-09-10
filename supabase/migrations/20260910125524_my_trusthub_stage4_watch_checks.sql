begin;
create function consumer.get_watch_check_details(p_saved_entity_id uuid)
returns table(capability_id uuid,identifier_namespace text,source_identifier text,checked_at timestamptz,last_successful_check timestamptz,error_code text)
language plpgsql stable security definer set search_path=pg_catalog,network,consumer,ops as $$
declare subject uuid:=consumer.require_user();
begin
  if not exists(select 1 from consumer.consumer_saved_entities where id=p_saved_entity_id and user_id=subject and removed_at is null) then raise exception 'Saved entity not found' using errcode='no_data_found'; end if;
  return query
  select distinct cap.id,b.identifier_namespace,b.source_identifier,cp.retrieved_at,
    (select max(prior.last_success_at) from ops.source_feed_checkpoints prior where prior.capability_id=cap.id),cp.error_code
  from consumer.consumer_saved_entities s
  join consumer.consumer_watches w on w.saved_entity_id=s.id
  join consumer.consumer_watch_coverage c on c.watch_id=w.id and c.status='enabled'
  join network.watch_capabilities cap on cap.id=c.capability_id and cap.version=c.capability_version
  join network.network_entity_bindings b on b.network_entity_id=s.network_entity_id and b.identifier_namespace=cap.identifier_namespace and b.binding_status='accepted' and b.valid_to is null
  left join lateral(select * from ops.source_feed_checkpoints p where p.capability_id=cap.id order by p.completed_at desc nulls last,p.created_at desc limit 1) cp on true
  where s.id=p_saved_entity_id and s.user_id=subject;
end;
$$;
revoke all on function consumer.get_watch_check_details(uuid) from public,anon;
grant execute on function consumer.get_watch_check_details(uuid) to authenticated;
-- Daily execution freshness must not imply source publication freshness. Keep
-- the governed 45-day source expectation, but detect a missed daily poll in 2d.
create or replace function ops.evaluate_checkpoint_health(p_checkpoint_id uuid,p_at timestamptz default statement_timestamp())
returns text language plpgsql stable security definer set search_path=pg_catalog,network,ops as $$
declare checkpoint ops.source_feed_checkpoints%rowtype; capability network.watch_capabilities%rowtype; contract network.watch_capability_observation_contracts%rowtype;
begin
  select * into checkpoint from ops.source_feed_checkpoints where id=p_checkpoint_id;
  if checkpoint.id is null then return 'unknown'; end if;
  if checkpoint.health_status<>'current' then return checkpoint.health_status; end if;
  select * into capability from network.watch_capabilities where id=checkpoint.capability_id;
  select * into contract from network.watch_capability_observation_contracts where capability_id=checkpoint.capability_id;
  if checkpoint.last_success_at is null or contract.capability_id is null then return 'unknown'; end if;
  if capability.capability_key='contractor.fl.dbpr.license_status' and capability.version=1 and capability.source_connection_state='configured' then
    if checkpoint.source_as_of is null then return 'unknown'; end if;
    if checkpoint.last_success_at+interval '2 days'<p_at or checkpoint.source_as_of+capability.freshness_expectation+contract.freshness_grace<p_at then return 'delayed'; end if;
  elsif checkpoint.last_success_at+capability.freshness_expectation+contract.freshness_grace<p_at then return 'delayed'; end if;
  return 'current';
end;
$$;
commit;
