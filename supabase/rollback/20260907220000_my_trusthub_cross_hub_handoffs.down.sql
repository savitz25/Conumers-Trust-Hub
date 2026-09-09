-- P13-only compensating rollback. P11B and P12 remain intact.

begin;

drop function if exists consumer.list_cross_hub_project_summaries(integer);
drop function if exists consumer.get_cross_hub_entity_states_batch(uuid[]);
drop function if exists consumer.get_cross_hub_entity_state(uuid);

drop function if exists ops.assert_bff_scope(text,text);
drop function if exists ops.start_consumer_identity_link_attempt(uuid,text,text,text,text,text);
drop function if exists ops.clear_consumer_context(uuid,uuid,text);
drop function if exists ops.consume_consumer_context_handoff(text,uuid,text,text,text,text,text);
drop function if exists ops.create_consumer_context_handoff(text,uuid,uuid,text,text,jsonb,uuid,text);
drop function if exists ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text);
drop function if exists ops.create_legacy_consumer_auth_handoff(text,text,text,text,text,text,uuid,text);
drop function if exists ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text);
drop function if exists ops.resolve_linked_consumer(text,text,text);
drop function if exists ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text);
drop function if exists ops.valid_context_payload(jsonb);
drop function if exists ops.consume_rate_limit(text,text,integer,interval);
drop function if exists ops.normalize_return_path(text,text);
drop function if exists ops.origin_allowed(text,text,text);
drop function if exists ops.hash_handoff_secret(text);

drop table if exists ops.consumer_handoff_events;
drop table if exists ops.consumer_identity_link_attempts;
drop table if exists ops.consumer_context_handoffs;
drop table if exists ops.consumer_auth_handoffs;
drop table if exists ops.consumer_browser_handoff_intents;
drop table if exists ops.consumer_rate_limit_events;
drop table if exists ops.consumer_security_controls;
drop table if exists ops.consumer_hub_registry;

revoke usage on schema consumer from myth_consumer_api;
revoke usage on schema ops from myth_handoff_broker,myth_bff_ask,myth_bff_move,
  myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

do $$
declare role_name text;
begin
  foreach role_name in array array[
    'myth_bff_investor','myth_bff_senior','myth_bff_contractor',
    'myth_bff_insurance','myth_bff_lender','myth_bff_move','myth_bff_ask',
    'myth_consumer_api','myth_handoff_broker'
  ] loop
    if exists(select 1 from pg_roles where rolname=role_name) then
      execute format('drop role %I',role_name);
    end if;
  end loop;
end;
$$;

commit;
