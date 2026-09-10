create or replace function ops.get_alert_private_path(p_delivery_id uuid)
returns text language sql stable security definer set search_path=pg_catalog,ops
as $$ select '/my/alerts/'||alert_id::text from ops.consumer_alert_deliveries where id=p_delivery_id; $$;
grant execute on function ops.get_alert_private_path(uuid) to myth_notification_delivery;
revoke all on function ops.get_alert_private_path(uuid) from public;
