-- PREPARED ONLY. Disable preview ingress and drain its six DB connections first.
-- Host must be independently pinned. Stops if login has active sessions or if
-- registry changed since this packet. Preserves ALL P12 research and receipts.
begin;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then raise exception 'isolated authorization required'; end if;
 if exists(select 1 from pg_stat_activity where usename='myth_v23_parent_preview') then raise exception 'drain parent login first'; end if;
 if exists(select 1 from ops.consumer_hub_registry r join v23_private.preview_deployment_pin p on true
   where r.hub_key in ('ask','move') and r.staging_origins<>array[case r.hub_key when 'ask' then p.ask_origin else p.move_origin end]) then raise exception 'concurrent registry change; review teardown'; end if;
end $$;
alter role myth_v23_parent_preview nologin password null;
revoke myth_v23_authorizer,myth_v23_executor from myth_v23_parent_preview;
drop role myth_v23_parent_preview;
update ops.consumer_hub_registry r set staging_origins=b.staging_origins from v23_private.preview_registry_before b where b.hub_key=r.hub_key;
drop function v23_private.preview_ports_ready();
grant myth_v23_browser_store,myth_v23_preview_reader,myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_browser_store;
drop function v23_private.preview_confirmation(text,text,jsonb);
reset role;
set local role myth_v23_preview_reader;
drop function v23_private.preview_move_binding();
reset role;
set local role myth_v23_foundation;
drop function v23_private.preview_projects(uuid,uuid);
drop function v23_private.preview_saved(uuid,uuid);
drop function v23_private.preview_issue_context(jsonb,uuid,uuid);
drop function v23_private.preview_session_live(uuid,uuid);
reset role;
revoke myth_v23_browser_store,myth_v23_preview_reader,myth_v23_foundation from current_user granted by current_user;
drop policy preview_exact_live_session on auth.sessions;
revoke select(id,user_id,not_after) on auth.sessions from myth_v23_foundation;
revoke execute on function consumer.list_cross_hub_project_summaries(integer),consumer.list_saved_entities(),
 ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text),ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text) from myth_v23_foundation;
drop policy preview_exact_move_binding on network.network_entity_bindings;
drop policy preview_exact_move_entity on network.network_entities;
revoke select on network.network_entities,network.network_entity_bindings from myth_v23_preview_reader;
revoke usage on schema network,v23_private from myth_v23_preview_reader;
drop role myth_v23_preview_reader;
-- Ephemeral source links/current-session proofs/P13 issuance metadata only.
-- Existing browser confirmations and ops runtime receipts are left intact.
drop table v23_private.preview_transport_records;
drop table v23_private.preview_registry_before;
drop table v23_private.preview_deployment_pin;
commit;
-- Binding lifecycle is a separate steward operation; do not delete its identity
-- or any Saved research. Retire only the exact IDs returned by the approved
-- creation, with fresh preconditions and a separate authorization.
