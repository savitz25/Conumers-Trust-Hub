-- Separate recovery operation for isolated preview only. This recreates pg_net
-- with current platform defaults; it cannot restore lost transient queue/response
-- contents and intentionally leaves V2-3 assertions failing until reconciled.
begin isolation level serializable;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
   or current_setting('v23.pg_net_reenable_authorized',true) is distinct from 'true' then
   raise exception 'Separate isolated pg_net re-enable authorization required'; end if;
 if exists(select 1 from pg_extension where extname='pg_net') or to_regnamespace('net') is not null then
   raise exception 'Re-enable requires clean absent baseline'; end if;
end $$;
create extension pg_net;
do $$ begin
 if (select count(*) from pg_extension where extname='pg_net')<>1 or to_regnamespace('net') is null
   or to_regclass('net.http_request_queue') is null or to_regclass('net._http_response') is null then
   raise exception 'Platform-default pg_net recreation incomplete'; end if;
end $$;
select 'V23_PG_NET_REENABLE_PASS_REQUIRES_V23_RECONCILIATION' result;
commit;
