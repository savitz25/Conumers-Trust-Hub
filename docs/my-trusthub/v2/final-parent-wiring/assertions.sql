-- Read-only assertions AFTER separately authorized application. No credentials.
begin read only;
do $$ declare r record; n integer; begin
 select * into strict r from pg_roles where rolname='myth_v23_parent_preview';
 if not r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication then raise exception 'unsafe runtime role'; end if;
 select count(*) into n from pg_auth_members where member=r.oid;
 if n<>2 or exists(select 1 from pg_auth_members m join pg_roles g on g.oid=m.roleid where m.member=r.oid and
   (g.rolname not in ('myth_v23_authorizer','myth_v23_executor') or m.admin_option or m.inherit_option or not m.set_option)) then raise exception 'unsafe memberships'; end if;
 if exists(select 1 from pg_auth_members where member in (select oid from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor'))) then raise exception 'unexpected nested membership'; end if;
 if exists(select 1 from information_schema.role_table_grants where grantee='myth_v23_parent_preview') then raise exception 'direct table grants'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('consumer','auth','network','ops','v23_private')
   and c.relkind='r' and (has_table_privilege('myth_v23_parent_preview',c.oid,'SELECT') or has_table_privilege('myth_v23_parent_preview',c.oid,'INSERT')
    or has_table_privilege('myth_v23_parent_preview',c.oid,'UPDATE') or has_table_privilege('myth_v23_parent_preview',c.oid,'DELETE'))) then raise exception 'login can reach raw tables without SET ROLE'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='v23_private' and p.proname like 'preview_%'
   and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then raise exception 'public private-port access'; end if;
 if exists(select 1 from pg_roles where rolname in ('myth_v23_preview_reader','myth_v23_foundation','myth_v23_browser_store') and (rolcanlogin or rolsuper or rolbypassrls)) then raise exception 'unsafe function owner'; end if;
 if not exists(select 1 from v23_private.preview_deployment_pin where project_ref='xkkiicsassizmakcvxml' and version='v23-parent-wiring/1') then raise exception 'deployment pin'; end if;
 if exists(select 1 from ops.consumer_hub_registry registry join v23_private.preview_deployment_pin pin on true
   where registry.hub_key in ('ask','move') and registry.staging_origins<>array[case registry.hub_key when 'ask' then pin.ask_origin else pin.move_origin end]) then raise exception 'registry origin mismatch'; end if;
 if exists(select 1 from information_schema.tables where table_schema in ('consumer','ops') and table_name ~* '(watch|alert)') then raise exception 'unexpected Watch/Alert relations'; end if;
end $$;
-- Exact identity must be singular and accepted before runtime activation.
select b.id,b.network_entity_id,b.hub,b.specialist_entity_type,b.specialist_entity_id,b.identifier_namespace,b.source_identifier,b.binding_status,b.jurisdiction,
 e.entity_type,e.canonical_name from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id
 where b.hub='move' and b.specialist_entity_id='usdot-1002530';
select 'ASSERTIONS PASS; inspect binding identity and independently pinned host' as result;
commit;
