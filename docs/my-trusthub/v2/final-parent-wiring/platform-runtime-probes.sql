-- PREPARED ONLY. Fresh myth_v23_parent_preview login on a pinned preview session.
-- Independently pin xkkiicsassizmakcvxml outside SQL. No admin SET ROLE workaround.
-- postgres must not run this file and must not be granted myth_v23_authorizer to reach it.
-- Supply retained Phase 4 v23.binding_id and v23.network_entity_id before execution.
begin isolation level serializable read only;
do $$ declare target record; statement text; begin
 if current_database()<>'postgres'
   or current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
   or session_user<>'myth_v23_parent_preview' or current_user<>session_user then
   raise exception 'Fresh independently pinned runtime login required'; end if;
 if to_regnamespace('net') is not null or exists(select 1 from pg_extension where extname='pg_net')
   or has_schema_privilege(current_user,'extensions','USAGE') then
   raise exception 'Runtime platform schema USAGE remains'; end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='extensions' and c.relname in ('pg_stat_statements','pg_stat_statements_info'))<>2 then
   raise exception 'Reviewed platform probe targets missing'; end if;
 for target in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='extensions' and c.relname in ('pg_stat_statements','pg_stat_statements_info') loop
   begin
     execute format('select 1 from %I.%I limit 0',target.nspname,target.relname);
   exception when insufficient_privilege then continue;
   end;
   raise exception 'Unexpected schema-qualified runtime access: %.%',target.nspname,target.relname;
 end loop;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('auth','consumer','network','ops','v23_private','public')
     and c.relkind in ('r','p','v','m','f')
     and case when c.relkind in ('r','p','v','m','f') then
       has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') else false end) then
   raise exception 'Runtime TrustHub raw access remains'; end if;
 begin execute 'select v23_private.preview_ports_ready()';
 exception when insufficient_privilege then
   return;
 end;
 raise exception 'Runtime directly executed authorizer wrapper';
end $$;
set local role myth_v23_authorizer;
do $$ declare resolved record; begin
 if v23_private.preview_ports_ready() is distinct from true then
   raise exception 'Required private ports are not ready as authorizer'; end if;
 if nullif(current_setting('v23.binding_id',true),'') is null
   or nullif(current_setting('v23.network_entity_id',true),'') is null then
   raise exception 'Retained Phase 4 binding inputs required'; end if;
 if (select count(*) from v23_private.preview_move_binding())<>1 then
   raise exception 'Private resolver must return exactly one binding'; end if;
 select * into strict resolved from v23_private.preview_move_binding();
 if resolved.id is distinct from nullif(current_setting('v23.binding_id',true),'')::uuid
   or resolved.network_entity_id is distinct from nullif(current_setting('v23.network_entity_id',true),'')::uuid
   or resolved.binding_status is distinct from 'accepted' then
   raise exception 'Private resolver disagrees with approved forward identity'; end if;
end $$;
reset role;
set local role myth_v23_executor;
do $$ begin
 if current_user<>'myth_v23_executor' then raise exception 'Executor role unavailable'; end if;
end $$;
reset role;
do $$ begin
 begin execute 'set local role myth_v23_cleanup';
 exception when insufficient_privilege then return;
 end;
 raise exception 'Unrelated SET ROLE accepted';
end $$;
select 'V23_PLATFORM_RUNTIME_PROBES_PASS' as result;
commit;
