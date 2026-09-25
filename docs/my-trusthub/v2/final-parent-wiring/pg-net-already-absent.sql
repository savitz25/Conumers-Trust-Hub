-- READ ONLY. Certifies an isolated preview that is already in the required
-- pg_net-absent state. It does not install pg_net and it does not drop anything.
-- It must not be recorded as V23_PG_NET_DISABLE_PASS.
begin isolation level serializable read only;
set local row_security=off;
do $$ declare
 cron_dep boolean:=false;
begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
   raise exception 'Independently pinned isolated project attestation required'; end if;
 if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where not t.tgisinternal and (case when p.prokind in ('f','p','w') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end
     or n.nspname='supabase_functions' and p.proname='http_request')) then
   raise exception 'Database webhook or non-internal trigger depends on pg_net'; end if;
 if to_regclass('cron.job') is not null then
   execute $q$select exists(select 1 from cron.job where command ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)')$q$ into cron_dep;
 end if;
 if cron_dep then
   raise exception 'Scheduled job depends on pg_net'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','auth','consumer','network','ops','v23_private')
   and case when p.prokind in ('f','p','w') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end) then
   raise exception 'Application-owned function depends on pg_net'; end if;
 if exists(select 1 from pg_extension where extname='pg_net') then
   raise exception 'Already-absent path refuses installed pg_net'; end if;
 if to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') is not null
   or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null
   or to_regprocedure('net.http_delete(text,jsonb,jsonb,integer,jsonb)') is not null
   or to_regclass('net.http_request_queue') is not null
   or to_regclass('net._http_response') is not null then
   raise exception 'pg_net HTTP routine or relation remains'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='net')
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net')
   or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='net') then
   raise exception 'Object remains in schema net'; end if;
 if to_regnamespace('net') is not null then
   raise exception 'schema net remains'; end if;
end $$;
select 'V23_PG_NET_ALREADY_ABSENT_PASS' result;
rollback;
