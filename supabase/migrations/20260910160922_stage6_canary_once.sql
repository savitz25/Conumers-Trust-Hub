create or replace function ops.transport_canary_needed()
returns boolean language sql stable security definer set search_path=pg_catalog,ops
as $$ select not exists(select 1 from ops.consumer_notification_transport_canaries where classification='test/canary' and status='accepted'); $$;
grant execute on function ops.transport_canary_needed() to myth_notification_delivery;
revoke all on function ops.transport_canary_needed() from public;
