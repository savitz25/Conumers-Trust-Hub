-- READ ONLY. Run on an independently pinned xkkiicsassizmakcvxml connection.
-- Any exception is a STOP. The result contains counts only, never request data.
begin isolation level serializable read only;
set local row_security=off;
do $$ declare cron_dep boolean:=false; begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
   raise exception 'Independently pinned isolated project attestation required'; end if;
 if (select count(*) from pg_extension where extname='pg_net')<>1 or to_regnamespace('net') is null then
   raise exception 'Expected installed pg_net baseline is absent or ambiguous'; end if;
 if to_regclass('net.http_request_queue') is null or to_regclass('net._http_response') is null then
   raise exception 'Expected pg_net queue/response relations missing'; end if;
 if (select count(*) from net.http_request_queue)<>0 then
   raise exception 'Pending pg_net requests must drain before disable'; end if;
 -- pg_get_functiondef raises 42809 for aggregates and window functions. CASE calls it
 -- only for ordinary functions and procedures, whose bodies this gate can inspect.
 if exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where not t.tgisinternal and (case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end
     or n.nspname='supabase_functions' and p.proname='http_request')) then
   raise exception 'Database webhook or non-internal trigger depends on pg_net'; end if;
 if to_regclass('cron.job') is not null then
   execute $q$select exists(select 1 from cron.job where command ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)')$q$ into cron_dep;
 end if;
 if cron_dep then
   raise exception 'Scheduled job depends on pg_net'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','auth','consumer','network','ops','v23_private')
   and case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) ~* '(net\s*\.|pg_net|supabase_functions\s*\.\s*http_request)' else false end) then
   raise exception 'Application-owned function depends on pg_net'; end if;
 if exists(select 1 from pg_extension ext
   join pg_depend member on member.refclassid='pg_extension'::regclass and member.refobjid=ext.oid and member.deptype='e'
   join pg_depend dependent on dependent.refclassid=member.classid and dependent.refobjid=member.objid
   where ext.extname='pg_net' and dependent.deptype='n'
     and not exists(select 1 from pg_depend own where own.classid=dependent.classid and own.objid=dependent.objid
       and own.refclassid='pg_extension'::regclass and own.refobjid=ext.oid and own.deptype='e')) then
   raise exception 'External catalog dependency would make DROP EXTENSION unsafe'; end if;
end $$;
select (select count(*) from net.http_request_queue) pending_requests,
       (select count(*) from net._http_response) transient_responses,
       (select extversion from pg_extension where extname='pg_net') installed_version,
       'V23_PG_NET_PREFLIGHT_PASS' result;
rollback;
