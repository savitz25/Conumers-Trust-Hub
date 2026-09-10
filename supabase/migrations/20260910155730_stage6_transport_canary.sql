create table if not exists ops.consumer_notification_transport_canaries(
  id uuid primary key default gen_random_uuid(),
  classification text not null check(classification='test/canary'),
  recipient_hash text not null,
  provider_message_ref text null,
  status text not null check(status in ('accepted','failed')),
  failure_class text null,
  created_at timestamptz not null default statement_timestamp()
);
alter table ops.consumer_notification_transport_canaries enable row level security;
alter table ops.consumer_notification_transport_canaries force row level security;
revoke all on table ops.consumer_notification_transport_canaries from public,anon,authenticated;
create or replace function ops.record_transport_canary(p_recipient_hash text,p_status text,p_provider_ref text,p_failure_class text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,ops as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); v_id uuid;
begin
  if actor_role<>'myth_notification_delivery' then raise exception 'notification worker authorization required' using errcode='insufficient_privilege'; end if;
  insert into ops.consumer_notification_transport_canaries(classification,recipient_hash,provider_message_ref,status,failure_class)
  values('test/canary',p_recipient_hash,p_provider_ref,p_status,p_failure_class) returning id into v_id;
  return v_id;
end; $$;
grant execute on function ops.record_transport_canary(text,text,text,text) to myth_notification_delivery;
revoke all on function ops.record_transport_canary(text,text,text,text) from public;
