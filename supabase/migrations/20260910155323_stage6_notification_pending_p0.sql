create or replace function ops.pending_p0_deliveries(p_limit integer default 50)
returns table(delivery_id uuid)
language sql stable security definer set search_path=pg_catalog,ops
as $$ select id from ops.consumer_alert_deliveries where status='pending' and delivery_type='p0_immediate' order by created_at,id limit greatest(coalesce(p_limit,50),1); $$;
grant execute on function ops.pending_p0_deliveries(integer) to myth_notification_delivery;
revoke all on function ops.pending_p0_deliveries(integer) from public;
