begin;
create or replace function ops.issue_contractor_save(p_intent text,p_code text,p_issuer text,p_audience text)
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
create or replace function ops.consume_contractor_save(p_code text,p_state text,p_nonce text,p_user uuid,p_issuer text,p_audience text)
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
