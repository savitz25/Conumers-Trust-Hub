-- PREPARED ONLY: xkkiicsassizmakcvxml. No hosted execution under this ticket.
-- Independently pin direct TLS host outside SQL; the project GUC is attestation only.
-- Separate steward authorization, ON_ERROR_STOP, maintenance window and a fresh
-- owner-authorized connection are required. Do not escalate on permission errors.
-- Drain runtime connections BEFORE this operation (including cached query plans).
-- Rollback restores ONLY reviewed PUBLIC schema USAGE; runtime must already be absent.
begin isolation level serializable;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $$
declare actual_acl jsonb;
begin
 if current_database()<>'postgres'
   or current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
   or current_setting('v23.platform_public_rollback_authorized',true) is distinct from 'true'
   or current_setting('v23.closeout_writers_drained',true) is distinct from 'true' then
   raise exception 'Separate isolated platform ACL authorization and drained writers required'; end if;
 if exists(select 1 from pg_stat_activity where usename='myth_v23_parent_preview') then
   raise exception 'Drain runtime connections before platform ACL change'; end if;
 if exists(select 1 from pg_roles where rolname='myth_v23_parent_preview') then
   raise exception 'Remove preview runtime before restoring PUBLIC net USAGE'; end if;
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


 grant usage on schema net to public;
 -- Exact reviewed 2026-09-22 ACL: owner supabase_admin; no grant options.
 select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type)
 into actual_acl from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='net';
 if actual_acl is distinct from '[["PUBLIC","supabase_admin","USAGE",false],["anon","supabase_admin","USAGE",false],["authenticated","supabase_admin","USAGE",false],["postgres","supabase_admin","USAGE",false],["service_role","supabase_admin","USAGE",false],["supabase_admin","supabase_admin","CREATE",false],["supabase_admin","supabase_admin","USAGE",false],["supabase_functions_admin","supabase_admin","USAGE",false]]'::jsonb then
   raise exception 'Unreviewed net schema ACL baseline'; end if;

 if exists(select 1 from unnest(array['supabase_admin','supabase_functions_admin','postgres','anon','authenticated','service_role']) role_name
   where not has_schema_privilege(role_name,'net','USAGE')) then
   raise exception 'Explicit platform role net USAGE lost'; end if;

end $$;
select 'V23_PLATFORM_PUBLIC_ROLLBACK_PASS' as result;
commit;
