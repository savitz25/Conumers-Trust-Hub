begin;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

-- P16 already owns Alert storage, deterministic templates, fanout, and read state.
-- This additive migration supplies the approved v2 presentation rows and the
-- least-privilege server runtime that drains accepted pending events.
insert into network.consumer_alert_templates(
  template_key,version,headline,body,disclosure,governance_status,approved_by,effective_from
) values (
  'license_status_changed',1,
  'Florida DBPR license status changed',
  'The Florida DBPR license status in this Watch changed. Review the previous and current values below.',
  'This reflects a change in the watched public record. It is not a recommendation or verdict.',
  'approved','stage5_parent_closeout',statement_timestamp()
)
on conflict (template_key,version) do update set
  governance_status='approved',approved_by='stage5_parent_closeout',effective_to=null;

insert into network.consumer_source_presentations(
  source_key,display_name,confirmation_ref,governance_status,approved_by
) values (
  'fl.dbpr.verify_licensee','Florida DBPR Verify a Licensee',
  'https://www.myfloridalicense.com/wl11.asp?mode=1&search=LicNbr',
  'approved','stage5_parent_closeout'
)
on conflict (source_key) do update set
  display_name=excluded.display_name,
  confirmation_ref=excluded.confirmation_ref,
  governance_status='approved',approved_by='stage5_parent_closeout';

do $$
begin
  if not exists (select 1 from pg_roles where rolname='myth_alert_runtime') then
    create role myth_alert_runtime nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 2;
  end if;
end
$$;

create or replace function ops.alert_fanout_pending_events(p_limit integer default 20)
returns table(change_event_id uuid)
language sql
stable
security definer
set search_path=pg_catalog,network,ops
as $$
  select e.id
  from network.network_change_events e
  join network.alert_severity_rules r on r.id=e.severity_rule_id
  where e.status='active' and e.fanout_status='pending'
    and r.enabled and r.governance_status='approved'
  order by e.observed_at,e.id
  limit least(greatest(coalesce(p_limit,20),1),100)
$$;

revoke all on function ops.alert_fanout_pending_events(integer) from public,anon,authenticated;
grant usage on schema ops,network,consumer to myth_alert_runtime;
grant execute on function ops.alert_fanout_pending_events(integer),consumer.fanout_change_event(uuid) to myth_alert_runtime;

-- Read-only consumer detail projection of the governed event values. The
-- existing P16 detail RPC remains stable; this additive RPC lets the UI show
-- prior/current normalized values without exposing raw source payloads.
create or replace function consumer.get_alert_change_values(p_alert_id uuid)
returns table(
  alert_id uuid,previous_value jsonb,current_value jsonb,
  source_as_of timestamptz,observed_at timestamptz,checked_at timestamptz,
  event_state text,correction_of_event_id uuid,retraction_reason text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,network,consumer,ops
as $$
declare subject uuid:=consumer.require_user();
begin
  return query
  select a.id,e.previous_material_value,e.new_material_value,e.source_as_of,e.observed_at,
    cp.last_success_at,e.status,e.correction_of_event_id,e.retraction_reason
  from consumer.consumer_alerts a
  join network.network_change_events e on e.id=a.change_event_id
  join ops.source_feed_checkpoints cp on cp.id=e.checkpoint_id
  where a.id=p_alert_id and a.user_id=subject;
end;
$$;

revoke all on function consumer.get_alert_change_values(uuid) from public,anon;
grant execute on function consumer.get_alert_change_values(uuid) to authenticated,myth_consumer_api;

commit;
