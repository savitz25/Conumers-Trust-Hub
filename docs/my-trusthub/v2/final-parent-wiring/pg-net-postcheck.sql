begin isolation level serializable read only;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then raise exception 'Isolated project attestation required'; end if;
 if exists(select 1 from pg_extension where extname='pg_net') or to_regnamespace('net') is not null
   or to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') is not null
   or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null
   or to_regprocedure('net.http_delete(text,jsonb,jsonb,integer,jsonb)') is not null
   or to_regclass('net.http_request_queue') is not null or to_regclass('net._http_response') is not null then
   raise exception 'pg_net or schema net remains'; end if;
end $$;
select 'V23_PG_NET_ABSENT_PASS' result;
rollback;
