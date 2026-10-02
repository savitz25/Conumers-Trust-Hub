-- MY TRUSTHUB V2 PRODUCTION HANDOFF — ASK ROLLBACK (parent ports only).
-- Target qvvxvbcdmbjzrgvwjatw. Operator session. Removes ONLY the prod_* ports,
-- the production runtime login and reader role created by 02/04. It does NOT
-- remove the foundation (01), the Hindman binding (03), any Saved row, any
-- receipt in ops.v23_profile_runtime_records, or anything in consumer/network.
-- Turning the Vercel flag MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED off is the
-- first rollback; this file is the second, for a clean re-apply.
begin;
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw'
     or current_setting('v23.rollback_authorized',true) is distinct from 'true' then
    raise exception 'Explicit production rollback authorization required';
  end if;
end $$;
-- Quiesce first (flag off, deploy settled). Then drop in dependency order.
drop function if exists v23_private.prod_ports_ready();
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
drop function if exists v23_private.prod_session_authority_ready();
drop function if exists v23_private.prod_issue_context(jsonb,uuid,uuid);
drop function if exists v23_private.prod_saved(uuid,uuid);
drop function if exists v23_private.prod_projects(uuid,uuid);
drop function if exists v23_private.prod_session_live(uuid,uuid);
drop function if exists v23_private.prod_session_bind(uuid,uuid,bigint,bytea);
drop function if exists v23_private.prod_session_install_mac(bytea);
drop function if exists v23_private.prod_session_mac_matches(text,bytea,bytea);
drop table if exists v23_private.prod_session_attestations;
drop table if exists v23_private.prod_session_mac;
reset role;
revoke myth_v23_foundation from current_user granted by current_user;
revoke execute on function consumer.list_cross_hub_project_summaries(integer) from myth_v23_foundation;
revoke execute on function consumer.list_saved_entities() from myth_v23_foundation;
revoke execute on function ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text),
 ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text) from myth_v23_foundation;
grant myth_v23_prod_reader to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_prod_reader;
drop function if exists v23_private.prod_move_binding();
reset role;
revoke myth_v23_prod_reader from current_user granted by current_user;
drop policy if exists prod_exact_move_binding on network.network_entity_bindings;
drop policy if exists prod_exact_move_entity on network.network_entities;
revoke all on network.network_entities,network.network_entity_bindings from myth_v23_prod_reader;
revoke usage on schema network,v23_private from myth_v23_prod_reader;
drop role if exists myth_v23_prod_reader;
grant myth_v23_browser_store to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_browser_store;
drop function if exists v23_private.prod_confirmation(text,text,jsonb);
reset role;
revoke myth_v23_browser_store from current_user granted by current_user;
drop table if exists v23_private.prod_transport_records;
drop table if exists v23_private.prod_deployment_pin;
drop table if exists v23_private.prod_security_before;
revoke myth_v23_authorizer,myth_v23_executor from myth_v23_parent_prod;
drop role if exists myth_v23_parent_prod;
do $$ begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='v23_private' and p.proname like 'prod_%')
     or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='v23_private' and c.relname like 'prod_%')
     or exists(select 1 from pg_roles where rolname in ('myth_v23_parent_prod','myth_v23_prod_reader')) then
    raise exception 'V23_PROD_ROLLBACK_FAIL';
  end if;
  raise notice 'V23_PROD_ROLLBACK_PASS';
end $$;
commit;
