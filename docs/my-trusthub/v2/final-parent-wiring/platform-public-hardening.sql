-- PREPARED ONLY: xkkiicsassizmakcvxml. No hosted execution under this ticket.
-- Independently pin direct TLS host outside SQL; the project GUC is attestation only.
-- Separate steward authorization, ON_ERROR_STOP, maintenance window and a fresh
-- owner-authorized connection are required. Do not escalate on permission errors.
-- Drain runtime connections BEFORE this operation (including cached query plans).
-- The only persistent mutation is REVOKE USAGE ON SCHEMA net FROM PUBLIC.
begin isolation level serializable;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $$
declare actual_acl jsonb;
begin
 if current_database()<>'postgres'
   or current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
   or current_setting('v23.platform_public_hardening_authorized',true) is distinct from 'true'
   or current_setting('v23.closeout_writers_drained',true) is distinct from 'true' then
   raise exception 'Separate isolated platform ACL authorization and drained writers required'; end if;
 if exists(select 1 from pg_stat_activity where usename='myth_v23_parent_preview') then
   raise exception 'Drain runtime connections before platform ACL change'; end if;
 if not exists(select 1 from pg_roles where rolname='myth_v23_parent_preview') then
   raise exception 'Reviewed preview runtime required before hardening'; end if;
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
 if actual_acl is distinct from '[["PUBLIC","supabase_admin","USAGE",false],["anon","supabase_admin","USAGE",false],["authenticated","supabase_admin","USAGE",false],["postgres","supabase_admin","USAGE",false],["service_role","supabase_admin","USAGE",false],["supabase_admin","supabase_admin","CREATE",false],["supabase_admin","supabase_admin","USAGE",false],["supabase_functions_admin","supabase_admin","USAGE",false]]'::jsonb then
   raise exception 'Unreviewed net schema ACL baseline'; end if;

 -- No application routine or trigger may rely on PUBLIC net access.
 -- The existing platform event trigger and unused webhook entry point are
 -- inspected separately; neither is an application consumer.
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where p.prokind in ('f','p') and n.nspname not in ('pg_catalog','information_schema','net')
   and not (n.nspname='supabase_functions' and p.proname='http_request')
   and not (n.nspname='extensions' and p.proname='grant_pg_net_access' and p.prorettype='event_trigger'::regtype)
   and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
   and p.prosrc ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)') then
   raise exception 'Unreviewed application pg_net dependency'; end if;
 if exists(with recursive routines(oid) as (
   select tgfoid from pg_trigger where not tgisinternal
   union
   select d.refobjid from routines r join pg_depend d on d.classid='pg_proc'::regclass
     and d.objid=r.oid and d.refclassid='pg_proc'::regclass
 ) select 1 from routines r join pg_proc p on p.oid=r.oid join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='net' or n.nspname='supabase_functions' and p.proname='http_request'
     or p.prosrc ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)') then
   raise exception 'Unreviewed pg_net trigger/webhook dependency'; end if;
 revoke usage on schema net from public;
 -- Exact reviewed 2026-09-22 ACL: owner supabase_admin; no grant options.
 select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type)
 into actual_acl from pg_namespace n cross join lateral aclexplode(n.nspacl) a where n.nspname='net';
 if actual_acl is distinct from '[["anon","supabase_admin","USAGE",false],["authenticated","supabase_admin","USAGE",false],["postgres","supabase_admin","USAGE",false],["service_role","supabase_admin","USAGE",false],["supabase_admin","supabase_admin","CREATE",false],["supabase_admin","supabase_admin","USAGE",false],["supabase_functions_admin","supabase_admin","USAGE",false]]'::jsonb then
   raise exception 'Unreviewed net schema ACL baseline'; end if;

 if exists(select 1 from unnest(array['supabase_admin','supabase_functions_admin','postgres','anon','authenticated','service_role']) role_name
   where not has_schema_privilege(role_name,'net','USAGE')) then
   raise exception 'Explicit platform role net USAGE lost'; end if;
 if has_schema_privilege('myth_v23_parent_preview','net','USAGE') then
   raise exception 'Runtime net schema access remains'; end if;
end $$;
select 'V23_PLATFORM_PUBLIC_HARDENING_PASS' as result;
commit;
