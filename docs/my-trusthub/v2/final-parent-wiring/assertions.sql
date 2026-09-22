-- PREPARED ONLY. Independently pin isolated host; supply IDs/provenance from
-- the approved forward result via v23.binding_id, v23.network_entity_id and
-- v23.binding_provenance_ref. Inspector must have complete identity visibility.
-- ON_ERROR_STOP (or equivalent) is mandatory. No observational success path.
begin isolation level serializable read only;
set local row_security=off;
do $$
declare r record; b network.network_entity_bindings%rowtype; e network.network_entities%rowtype; f text; actual_acl jsonb;
begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
   raise exception 'Independently pinned isolated project required'; end if;
 select * into strict r from pg_roles where rolname='myth_v23_parent_preview';
 if not r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole
   or r.rolreplication or r.rolconnlimit<>6 or r.rolvaliduntil is not null
   or (select array_agg(x order by x) from unnest(r.rolconfig) x) is distinct from
     array['idle_in_transaction_session_timeout=10s','lock_timeout=3s','statement_timeout=5s'] then
   raise exception 'Unexpected runtime role attributes/settings'; end if;
 if exists(select 1 from pg_db_role_setting where setrole=r.oid and setdatabase<>0) then
   raise exception 'Unexpected database-specific login settings'; end if;
 if (select count(*) from pg_auth_members where member=r.oid)<>2
   or exists(select 1 from pg_auth_members m join pg_roles g on g.oid=m.roleid where m.member=r.oid and
     (g.rolname not in ('myth_v23_authorizer','myth_v23_executor') or m.admin_option or m.inherit_option or not m.set_option)) then
   raise exception 'Unexpected runtime memberships'; end if;
 -- Supabase may administer the login through one reverse membership. This
 -- does not grant the runtime any additional outgoing membership. Local
 -- PostgreSQL may have no such row. Never revoke this platform-managed grant.
 if (select count(*) from pg_auth_members where roleid=r.oid)>1
   or exists(select 1 from pg_auth_members m
     left join pg_roles member_role on member_role.oid=m.member
     left join pg_roles grantor_role on grantor_role.oid=m.grantor
     where m.roleid=r.oid and (member_role.rolname is distinct from 'postgres'
       or grantor_role.rolname is distinct from 'supabase_admin'
       or m.admin_option is distinct from true
       or m.inherit_option is distinct from false
       or m.set_option is distinct from false)) then
   raise exception 'Unexpected reverse membership in runtime login'; end if;
 if (select count(*) from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor',
     'myth_v23_preview_reader','myth_v23_foundation','myth_v23_browser_store'))<>5
   or exists(select 1 from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor',
     'myth_v23_preview_reader','myth_v23_foundation','myth_v23_browser_store') and
     (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
   raise exception 'Missing or unsafe execution/function-owner role'; end if;
 if exists(select 1 from pg_auth_members where member in (select oid from pg_roles where rolname in
     ('myth_v23_authorizer','myth_v23_executor','myth_v23_preview_reader','myth_v23_foundation','myth_v23_browser_store'))) then
   raise exception 'Unexpected nested membership'; end if;
 -- Direct ACLs are forbidden even when schema USAGE currently masks them.
 if exists(
   select 1 from pg_class c cross join lateral aclexplode(nullif(c.relacl,'{}'::aclitem[])) a where a.grantee=r.oid
   union all select 1 from pg_attribute c cross join lateral aclexplode(nullif(c.attacl,'{}'::aclitem[])) a where a.grantee=r.oid
   union all select 1 from pg_proc c cross join lateral aclexplode(nullif(c.proacl,'{}'::aclitem[])) a where a.grantee=r.oid
   union all select 1 from pg_namespace c cross join lateral aclexplode(nullif(c.nspacl,'{}'::aclitem[])) a where a.grantee=r.oid
   union all select 1 from pg_database c cross join lateral aclexplode(nullif(c.datacl,'{}'::aclitem[])) a where a.grantee=r.oid
   union all select 1 from pg_default_acl c cross join lateral aclexplode(nullif(c.defaclacl,'{}'::aclitem[])) a where a.grantee=r.oid
 ) then raise exception 'Unexpected direct runtime grants'; end if;
 if exists(select 1 from pg_namespace where nspowner=r.oid) or exists(select 1 from pg_proc where proowner=r.oid)
   or exists(select 1 from pg_class where relowner=r.oid) then raise exception 'Runtime login owns an object'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and c.relkind in ('r','p','v','m','f')
   -- Preserve latent PUBLIC grants as failures in our security-sensitive schemas.
   -- Elsewhere an object ACL is reachable only through schema USAGE.
   and (n.nspname in ('auth','consumer','network','ops','v23_private','public')
     or has_schema_privilege(r.oid,n.oid,'USAGE'))
   and case when c.relkind in ('r','p','v','m','f') then
     (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) else false end) then
   raise exception 'Raw table/column access without SET ROLE'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname not like 'pg_%' and c.relkind='S'
   and (n.nspname in ('auth','consumer','network','ops','v23_private','public')
     or has_schema_privilege(r.oid,n.oid,'USAGE'))
   and case when c.relkind='S' then has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') else false end) then
   raise exception 'Raw sequence access without SET ROLE'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='extensions' and c.relname in ('pg_stat_statements','pg_stat_statements_info'))
   and has_schema_privilege(r.oid,'extensions','USAGE') then
   raise exception 'Runtime pg_stat schema access'; end if;
 -- Local PostgreSQL may have no pg_net. If either component is present the
 -- complete reviewed, hardened baseline is mandatory; this is no allowlist.
 if to_regnamespace('net') is not null or exists(select 1 from pg_extension where extname='pg_net') then
 if (select pg_get_userbyid(nspowner) from pg_namespace where nspname='net') is distinct from 'supabase_admin'
   or (select count(*) from pg_extension where extname='pg_net' and extversion='0.20.4'
     and pg_get_userbyid(extowner)='supabase_admin')<>1 then
   raise exception 'Unreviewed pg_net schema owner/extension baseline'; end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.objsubid=0
     and d.refclassid='pg_extension'::regclass and d.deptype='e'
   join pg_extension ext on ext.oid=d.refobjid
   where n.nspname='net' and c.relname in ('_http_response','http_request_queue')
     and c.relkind='r' and pg_get_userbyid(c.relowner)='supabase_admin' and ext.extname='pg_net')<>2 then
   raise exception 'Required pg_net table ownership/extension membership differs'; end if;
 -- Exact reviewed 2026-09-22 ACL: owner supabase_admin; no grant options.
 select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type)
 into actual_acl from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='net';
 if actual_acl is distinct from '[["anon","supabase_admin","USAGE",false],["authenticated","supabase_admin","USAGE",false],["postgres","supabase_admin","USAGE",false],["service_role","supabase_admin","USAGE",false],["supabase_admin","supabase_admin","CREATE",false],["supabase_admin","supabase_admin","USAGE",false],["supabase_functions_admin","supabase_admin","USAGE",false]]'::jsonb then
   raise exception 'Unreviewed net schema ACL baseline'; end if;
 if has_schema_privilege(r.oid,'net','USAGE') then raise exception 'Runtime net schema access'; end if;
 if exists(select 1 from unnest(array['supabase_admin','supabase_functions_admin','postgres','anon','authenticated','service_role']) role_name
   where not has_schema_privilege(role_name,'net','USAGE')) then
   raise exception 'Explicit platform role net USAGE lost'; end if;
 end if;
 foreach f in array array[
   'v23_private.preview_ports_ready()','v23_private.preview_confirmation(text,text,jsonb)',
   'v23_private.preview_session_live(uuid,uuid)','v23_private.preview_move_binding()',
   'v23_private.preview_projects(uuid,uuid)','v23_private.preview_saved(uuid,uuid)',
   'v23_private.preview_issue_context(jsonb,uuid,uuid)','v23_private.authority()',
   'v23_private.save_profile(uuid)','v23_private.add_project(uuid,uuid)','v23_private.consume_context(jsonb)'] loop
   if to_regprocedure(f) is null then raise exception 'Required private port missing: %',f; end if;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='v23_private' and p.proname like 'preview_%'
   and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')
     or exists(select 1 from aclexplode(nullif(coalesce(p.proacl,acldefault('f',p.proowner)),'{}'::aclitem[])) a where a.grantee=0 and a.privilege_type='EXECUTE'))) then
   raise exception 'Public private-preview wrapper execution'; end if;
 if (select count(*) from v23_private.preview_deployment_pin)<>1 or not exists(
   select 1 from v23_private.preview_deployment_pin where singleton and project_ref='xkkiicsassizmakcvxml'
   and version='v23-parent-wiring/1'
   and ask_origin='https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app'
   and move_origin='https://move-trust-hub-git-mth-v2-3-move-par-71a0b3-savitz25-s-projects.vercel.app') then
   raise exception 'Exact deployment pin required'; end if;
 if (select count(*) from ops.consumer_hub_registry where hub_key in ('ask','move'))<>2
   or exists(select 1 from ops.consumer_hub_registry registry cross join v23_private.preview_deployment_pin pin
     where registry.hub_key in ('ask','move') and registry.staging_origins is distinct from
       array[case registry.hub_key when 'ask' then pin.ask_origin else pin.move_origin end]) then
   raise exception 'Exact Ask/Move staging origins required'; end if;
 select * into strict b from network.network_entity_bindings
   where id=nullif(current_setting('v23.binding_id',true),'')::uuid;
 select * into strict e from network.network_entities
   where id=nullif(current_setting('v23.network_entity_id',true),'')::uuid;
 if (b.network_entity_id,b.hub,b.specialist_entity_type,b.specialist_entity_id,b.identifier_namespace,
     b.source_identifier,b.source_identifier_normalized,b.jurisdiction,b.binding_status,b.provenance_ref)
   is distinct from (e.id,'move','mover','usdot-1002530','fmcsa.usdot','1002530','1002530','US','accepted',
     nullif(current_setting('v23.binding_provenance_ref',true),''))
   or b.valid_from>statement_timestamp() or b.valid_to is not null then
   raise exception 'Exact current accepted forward binding required'; end if;
 if (e.entity_type,e.canonical_name,e.primary_hub,e.jurisdiction,e.status,e.canonical_public_profile_ref)
   is distinct from ('organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US','active',
     '/companies/hindman-isaacs-moving-storage-inc') then
   raise exception 'Exact active canonical entity required'; end if;
 if (select count(*) from network.network_entity_bindings where hub='move' and specialist_entity_id='usdot-1002530'
   and binding_status='accepted' and valid_from<=statement_timestamp()
   and (valid_to is null or valid_to>statement_timestamp()))<>1 then
   raise exception 'Exactly one accepted current Move binding required'; end if;
 if (select count(*) from network.network_entities where primary_hub='move' and
   (canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC'
    or canonical_public_profile_ref='/companies/hindman-isaacs-moving-storage-inc'))<>1 then
   raise exception 'Exactly one canonical Move identity required'; end if;
 -- Check across class, jurisdiction AND hub for the regulator ID. Foundation
 -- exclusions alone are narrower and cannot substitute for this assertion.
 if exists(select 1 from network.network_entity_bindings other where other.id<>b.id and other.binding_status='accepted'
   and (other.hub='move' and other.specialist_entity_id='usdot-1002530'
     or other.identifier_namespace='fmcsa.usdot' and other.source_identifier_normalized='1002530')
   and tstzrange(other.valid_from,other.valid_to,'[)') && tstzrange(b.valid_from,b.valid_to,'[)')) then
   raise exception 'Overlapping accepted Move/regulator binding'; end if;
 if exists(select 1 from network.network_entity_redirects where from_entity_id=e.id or to_entity_id=e.id) then
   raise exception 'Forward identity must not participate in a merge/redirect'; end if;
 if exists(select 1 from information_schema.tables where table_schema in ('consumer','ops','network','v23_private')
   and table_name ~* '(watch|alert)') then raise exception 'Unexpected Watch/Alert relations'; end if;
end $$;
-- Actual runtime denial probes run separately in platform-runtime-probes.sql
-- through a fresh runtime LOGIN connection. The inspector's platform-managed
-- reverse membership intentionally has SET=false; do not broaden it.
set local role myth_v23_authorizer;
set local row_security=on;
do $$ declare resolved record; begin
 if v23_private.preview_ports_ready() is distinct from true then
   raise exception 'Required private ports are not ready as authorizer'; end if;
 if (select count(*) from v23_private.preview_move_binding())<>1 then
   raise exception 'Private resolver must return exactly one binding'; end if;
 select * into strict resolved from v23_private.preview_move_binding();
 if resolved.id is distinct from nullif(current_setting('v23.binding_id',true),'')::uuid
   or resolved.network_entity_id is distinct from nullif(current_setting('v23.network_entity_id',true),'')::uuid
   or resolved.binding_status is distinct from 'accepted' then
   raise exception 'Private resolver disagrees with approved forward identity'; end if;
end $$;
reset role;
select 'V23_PARENT_PACKET_ASSERTIONS_PASS' as result;
commit;
