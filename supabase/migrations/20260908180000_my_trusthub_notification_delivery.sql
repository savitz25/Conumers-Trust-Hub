-- My TrustHub P17: notification preferences, per-Watch delivery overrides,
-- delivery ledger, and a deterministic mock-only P0 email transport contract.
-- Apply only after P11B-P16. This migration sends no external email.

begin;

set local search_path=pg_catalog,public,extensions,network,consumer,ops;

comment on role myth_notification_delivery is
  'Parent-only transactional notification worker. P17 permits narrow ledger/template operations and no external provider access.';

create table network.consumer_notification_templates (
  template_key text not null check(template_key ~ '^[a-z][a-z0-9_.:-]{2,127}$'),
  version integer not null check(version>0),
  channel text not null check(channel='email'),
  use_case text not null check(use_case in ('p0_immediate','p1_digest','p2_digest','watch_summary','correction')),
  severity text null check(severity is null or severity in ('P0','P1','P2')),
  subject_template text not null check(char_length(btrim(subject_template)) between 1 and 200),
  body_template text not null check(char_length(btrim(body_template)) between 1 and 5000),
  disclosure text not null default 'Extracts can lag. This is not a TrustHub verdict.'
    check(char_length(btrim(disclosure)) between 1 and 500),
  enabled boolean not null default false,
  governance_status text not null default 'draft'
    check(governance_status in ('draft','review_required','approved','disabled','retired')),
  approved_by text null,
  effective_from timestamptz not null,
  effective_to timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key(template_key,version),
  check(effective_to is null or effective_to>effective_from),
  check((governance_status='approved' and approved_by is not null) or governance_status<>'approved'),
  check(governance_status='approved' or not enabled),
  check(
    (use_case='p0_immediate' and severity='P0')
    or (use_case='p1_digest' and severity='P1')
    or (use_case='p2_digest' and severity='P2')
    or (use_case in ('watch_summary','correction') and severity is null)
  )
);

comment on table network.consumer_notification_templates is
  'Parent-reviewed, versioned transactional notification copy. Freeform and AI-generated delivery content is prohibited.';

create table consumer.consumer_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  p0_email_enabled boolean not null default true,
  p1_digest_enabled boolean not null default true,
  p2_digest_enabled boolean not null default false,
  periodic_watch_summary_enabled boolean not null default true,
  timezone text not null default 'UTC'
    check(char_length(btrim(timezone)) between 1 and 100),
  digest_time_local time not null default time '08:00:00',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check(row_version>0)
);

comment on table consumer.consumer_notification_preferences is
  'Private transactional delivery preferences. They never mutate Watch coverage, Alert severity, or public evidence.';
comment on column consumer.consumer_notification_preferences.timezone is
  'Consumer-selected IANA timezone. UTC is the deterministic fallback; IP geolocation is never used.';

create table consumer.consumer_watch_notification_overrides (
  watch_id uuid not null references consumer.consumer_watches(id) on delete cascade,
  channel text not null check(channel='email'),
  severity text not null check(severity in ('P0','P1','P2')),
  enabled boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check(row_version>0),
  primary key(watch_id,channel,severity)
);

comment on table consumer.consumer_watch_notification_overrides is
  'Per-Watch email delivery override. A true override cannot elevate a globally disabled channel; in-app Alert creation is unaffected.';

create table consumer.consumer_notification_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  watch_id uuid null references consumer.consumer_watches(id) on delete cascade,
  event_type text not null check(event_type in ('preferences_updated','override_set','override_removed')),
  idempotency_key uuid not null,
  previous_state jsonb null check(previous_state is null or jsonb_typeof(previous_state)='object'),
  new_state jsonb null check(new_state is null or jsonb_typeof(new_state)='object'),
  occurred_at timestamptz not null default statement_timestamp(),
  unique(user_id,idempotency_key)
);

create index consumer_notification_events_user_time_idx
  on consumer.consumer_notification_events(user_id,occurred_at desc);
create index consumer_notification_events_watch_idx
  on consumer.consumer_notification_events(watch_id,occurred_at desc)
  where watch_id is not null;

create table ops.consumer_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references consumer.consumer_alerts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check(channel='email'),
  delivery_type text not null check(delivery_type in ('p0_immediate','p1_digest','p2_digest','watch_summary','correction')),
  template_key text not null,
  template_version integer not null check(template_version>0),
  delivery_window_key text not null check(char_length(btrim(delivery_window_key)) between 1 and 100),
  status text not null check(status in ('pending','processing','delivered','failed','suppressed','cancelled')),
  idempotency_key uuid not null unique,
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  first_attempt_at timestamptz null,
  last_attempt_at timestamptz null,
  next_attempt_at timestamptz null,
  delivered_at timestamptz null,
  failed_at timestamptz null,
  suppressed_at timestamptz null,
  provider_message_ref text null check(provider_message_ref is null or char_length(provider_message_ref)<=300),
  failure_class text null check(failure_class is null or failure_class in (
    'transient','permanent','suppressed','invalid_destination','provider_error','rate_limited'
  )),
  error_code text null check(error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  recipient_hash text null check(recipient_hash is null or recipient_hash ~ '^[a-f0-9]{64}$'),
  preference_snapshot jsonb not null check(jsonb_typeof(preference_snapshot)='object'),
  override_snapshot jsonb not null check(jsonb_typeof(override_snapshot)='object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  foreign key(template_key,template_version)
    references network.consumer_notification_templates(template_key,version) on delete restrict,
  unique(alert_id,channel,delivery_type,template_key,template_version,delivery_window_key),
  check((status='delivered')=(delivered_at is not null)),
  check((status='suppressed')=(suppressed_at is not null)),
  check(status<>'delivered' or provider_message_ref is not null)
);

create index consumer_alert_deliveries_user_time_idx
  on ops.consumer_alert_deliveries(user_id,created_at desc);
create index consumer_alert_deliveries_alert_idx
  on ops.consumer_alert_deliveries(alert_id,created_at desc);
create index consumer_alert_deliveries_pending_idx
  on ops.consumer_alert_deliveries(status,next_attempt_at,created_at)
  where status in ('pending','failed');
create index consumer_alert_deliveries_template_idx
  on ops.consumer_alert_deliveries(template_key,template_version);

create table ops.consumer_alert_delivery_attempts (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references ops.consumer_alert_deliveries(id) on delete cascade,
  attempt_number integer not null check(attempt_number between 1 and 5),
  outcome text not null check(outcome in ('delivered','transient_failure','permanent_failure','invalid_destination','provider_error','rate_limited')),
  failure_class text null check(failure_class is null or failure_class in (
    'transient','permanent','invalid_destination','provider_error','rate_limited'
  )),
  provider_message_ref text null check(provider_message_ref is null or char_length(provider_message_ref)<=300),
  error_code text null check(error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  attempted_at timestamptz not null,
  worker_ref text not null,
  unique(delivery_id,attempt_number)
);

create index consumer_alert_delivery_attempts_delivery_idx
  on ops.consumer_alert_delivery_attempts(delivery_id,attempted_at desc);

create trigger consumer_notification_templates_set_updated_at
before update on network.consumer_notification_templates
for each row execute function network.set_updated_at();
create trigger consumer_notification_preferences_set_updated_at
before update on consumer.consumer_notification_preferences
for each row execute function network.set_updated_at();
create trigger consumer_watch_notification_overrides_set_updated_at
before update on consumer.consumer_watch_notification_overrides
for each row execute function network.set_updated_at();
create trigger consumer_alert_deliveries_set_updated_at
before update on ops.consumer_alert_deliveries
for each row execute function network.set_updated_at();

create or replace function network.enforce_notification_template_version()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if old.governance_status in ('approved','disabled','retired') and (
    new.template_key is distinct from old.template_key or new.version is distinct from old.version
    or new.channel is distinct from old.channel or new.use_case is distinct from old.use_case
    or new.severity is distinct from old.severity or new.subject_template is distinct from old.subject_template
    or new.body_template is distinct from old.body_template or new.disclosure is distinct from old.disclosure
  ) then
    raise exception 'approved notification template is immutable; create a new version'
      using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger consumer_notification_templates_immutable
before update on network.consumer_notification_templates
for each row execute function network.enforce_notification_template_version();

create or replace function consumer.create_default_notification_preferences()
returns trigger language plpgsql security definer set search_path=pg_catalog,consumer as $$
begin
  insert into consumer.consumer_notification_preferences(user_id) values(new.user_id)
  on conflict(user_id) do nothing;
  return new;
end;
$$;

create trigger consumer_profiles_create_notification_preferences
after insert on consumer.consumer_profiles
for each row execute function consumer.create_default_notification_preferences();

insert into consumer.consumer_notification_preferences(user_id)
select p.user_id from consumer.consumer_profiles p
on conflict(user_id) do nothing;

create or replace function consumer.notification_preferences_json(p consumer.consumer_notification_preferences)
returns jsonb language sql immutable security invoker set search_path=pg_catalog as $$
  select jsonb_build_object(
    'p0_email_enabled',p.p0_email_enabled,
    'p1_digest_enabled',p.p1_digest_enabled,
    'p2_digest_enabled',p.p2_digest_enabled,
    'periodic_watch_summary_enabled',p.periodic_watch_summary_enabled,
    'timezone',p.timezone,
    'digest_time_local',p.digest_time_local,
    'row_version',p.row_version
  );
$$;

create or replace function consumer.get_notification_preferences()
returns table(
  p0_email_enabled boolean,p1_digest_enabled boolean,p2_digest_enabled boolean,
  periodic_watch_summary_enabled boolean,timezone text,digest_time_local time,row_version bigint
)
language plpgsql stable security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user();
begin
  return query select p.p0_email_enabled,p.p1_digest_enabled,p.p2_digest_enabled,
    p.periodic_watch_summary_enabled,p.timezone,p.digest_time_local,p.row_version
  from consumer.consumer_notification_preferences p where p.user_id=subject;
end;
$$;

create or replace function consumer.update_notification_preferences(
  p_p0_email_enabled boolean,p_p1_digest_enabled boolean,p_p2_digest_enabled boolean,
  p_periodic_watch_summary_enabled boolean,p_timezone text,p_digest_time_local time,
  p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); current_pref consumer.consumer_notification_preferences%rowtype;
  before_state jsonb; next_version bigint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  if exists(select 1 from consumer.consumer_notification_events e where e.user_id=subject and e.idempotency_key=p_idempotency_key) then
    select row_version into next_version from consumer.consumer_notification_preferences where user_id=subject;
    return next_version;
  end if;
  if p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'invalid IANA timezone' using errcode='invalid_parameter_value';
  end if;
  select * into current_pref from consumer.consumer_notification_preferences where user_id=subject for update;
  if current_pref.user_id is null then raise exception 'consumer notification preferences not found' using errcode='no_data_found'; end if;
  if current_pref.row_version<>p_expected_row_version then raise exception 'PREFERENCES_STALE' using errcode='serialization_failure'; end if;
  before_state:=consumer.notification_preferences_json(current_pref);
  update consumer.consumer_notification_preferences p set
    p0_email_enabled=p_p0_email_enabled,p1_digest_enabled=p_p1_digest_enabled,
    p2_digest_enabled=p_p2_digest_enabled,periodic_watch_summary_enabled=p_periodic_watch_summary_enabled,
    timezone=p_timezone,digest_time_local=coalesce(p_digest_time_local,time '08:00:00'),row_version=p.row_version+1
  where p.user_id=subject returning p.row_version into next_version;
  insert into consumer.consumer_notification_events(user_id,event_type,idempotency_key,previous_state,new_state)
  select subject,'preferences_updated',p_idempotency_key,before_state,consumer.notification_preferences_json(p)
  from consumer.consumer_notification_preferences p where p.user_id=subject;
  return next_version;
end;
$$;

create or replace function consumer.set_watch_notification_override(
  p_watch_id uuid,p_severity text,p_enabled boolean,p_idempotency_key uuid
)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); current_override consumer.consumer_watch_notification_overrides%rowtype;
  next_version bigint; before_state jsonb;
begin
  if p_severity not in ('P0','P1','P2') then raise exception 'invalid severity' using errcode='invalid_parameter_value'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  if not exists(select 1 from consumer.consumer_watches w where w.id=p_watch_id and w.user_id=subject) then
    raise exception 'Watch not found' using errcode='42501';
  end if;
  if exists(select 1 from consumer.consumer_notification_events e where e.user_id=subject and e.idempotency_key=p_idempotency_key) then
    return coalesce((select o.row_version from consumer.consumer_watch_notification_overrides o
      where o.watch_id=p_watch_id and o.channel='email' and o.severity=p_severity),0);
  end if;
  select * into current_override from consumer.consumer_watch_notification_overrides o
    where o.watch_id=p_watch_id and o.channel='email' and o.severity=p_severity for update;
  before_state:=case when current_override.watch_id is null then null else jsonb_build_object('enabled',current_override.enabled,'row_version',current_override.row_version) end;
  insert into consumer.consumer_watch_notification_overrides(watch_id,channel,severity,enabled)
  values(p_watch_id,'email',p_severity,p_enabled)
  on conflict(watch_id,channel,severity) do update set enabled=excluded.enabled,row_version=consumer.consumer_watch_notification_overrides.row_version+1
  returning row_version into next_version;
  insert into consumer.consumer_notification_events(user_id,watch_id,event_type,idempotency_key,previous_state,new_state)
  values(subject,p_watch_id,'override_set',p_idempotency_key,before_state,jsonb_build_object('channel','email','severity',p_severity,'enabled',p_enabled,'row_version',next_version));
  return next_version;
end;
$$;

create or replace function consumer.remove_watch_notification_override(
  p_watch_id uuid,p_severity text,p_idempotency_key uuid
)
returns boolean
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); removed consumer.consumer_watch_notification_overrides%rowtype;
begin
  if p_severity not in ('P0','P1','P2') then raise exception 'invalid severity' using errcode='invalid_parameter_value'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  if not exists(select 1 from consumer.consumer_watches w where w.id=p_watch_id and w.user_id=subject) then
    raise exception 'Watch not found' using errcode='42501';
  end if;
  if exists(select 1 from consumer.consumer_notification_events e where e.user_id=subject and e.idempotency_key=p_idempotency_key) then return true; end if;
  delete from consumer.consumer_watch_notification_overrides o
  where o.watch_id=p_watch_id and o.channel='email' and o.severity=p_severity returning * into removed;
  insert into consumer.consumer_notification_events(user_id,watch_id,event_type,idempotency_key,previous_state,new_state)
  values(subject,p_watch_id,'override_removed',p_idempotency_key,
    case when removed.watch_id is null then null else jsonb_build_object('channel','email','severity',p_severity,'enabled',removed.enabled,'row_version',removed.row_version) end,
    null);
  return true;
end;
$$;

create or replace function consumer.get_watch_notification_overrides(p_watch_id uuid)
returns table(channel text,severity text,enabled boolean,row_version bigint)
language plpgsql stable security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user();
begin
  if not exists(select 1 from consumer.consumer_watches w where w.id=p_watch_id and w.user_id=subject) then
    raise exception 'Watch not found' using errcode='42501';
  end if;
  return query select o.channel,o.severity,o.enabled,o.row_version
  from consumer.consumer_watch_notification_overrides o where o.watch_id=p_watch_id order by o.severity;
end;
$$;

create or replace function consumer.email_delivery_enabled(
  p_user_id uuid,p_watch_id uuid,p_severity text
)
returns boolean
language sql stable security definer set search_path=pg_catalog,consumer as $$
  select case p_severity
    when 'P0' then p.p0_email_enabled
    when 'P1' then p.p1_digest_enabled
    when 'P2' then p.p2_digest_enabled
    else false end
    and coalesce((select o.enabled from consumer.consumer_watch_notification_overrides o
      where o.watch_id=p_watch_id and o.channel='email' and o.severity=p_severity),true)
  from consumer.consumer_notification_preferences p where p.user_id=p_user_id;
$$;

comment on function consumer.email_delivery_enabled(uuid,uuid,text) is
  'Global consent is authoritative. A per-Watch false tightens it; true cannot elevate a globally disabled channel.';

create or replace function ops.consumer_email_is_deliverable(p_user_id uuid)
returns boolean
language sql stable security definer set search_path=pg_catalog,auth as $$
  select coalesce(u.email_confirmed_at is not null
    and u.email is not null
    and u.email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$',false)
  from auth.users u where u.id=p_user_id;
$$;

create or replace function ops.notification_retry_delay(p_attempt integer)
returns interval
language sql immutable security invoker set search_path=pg_catalog as $$
  select case greatest(p_attempt,1)
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '30 minutes'
    when 4 then interval '2 hours'
    else interval '8 hours' end;
$$;

create or replace function ops.enqueue_alert_delivery(p_alert_id uuid,p_idempotency_key uuid)
returns table(delivery_id uuid,delivery_status text,outcome text)
language plpgsql security definer set search_path=pg_catalog,network,consumer,ops,auth,extensions as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  a consumer.consumer_alerts%rowtype; w consumer.consumer_watches%rowtype;
  event network.network_change_events%rowtype; pref consumer.consumer_notification_preferences%rowtype;
  template network.consumer_notification_templates%rowtype; override_enabled boolean;
  v_delivery_type text; v_window_key text; allowed boolean; suppress_reason text; user_email text;
  inserted_id uuid; existing_id uuid; existing_status text;
begin
  if actor_role<>'myth_notification_delivery' then raise exception 'notification worker authorization required' using errcode='insufficient_privilege'; end if;
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  select * into a from consumer.consumer_alerts where id=p_alert_id;
  if a.id is null then raise exception 'Alert not found' using errcode='no_data_found'; end if;
  select * into w from consumer.consumer_watches where id=a.watch_id;
  select * into event from network.network_change_events where id=a.change_event_id;
  select * into pref from consumer.consumer_notification_preferences where user_id=a.user_id;
  if pref.user_id is null then raise exception 'notification preferences not found' using errcode='no_data_found'; end if;
  select email into user_email from auth.users where id=a.user_id;

  v_delivery_type:=case a.severity when 'P0' then 'p0_immediate' when 'P1' then 'p1_digest' else 'p2_digest' end;
  v_window_key:=case when a.severity='P0' then 'immediate'
    else to_char(a.surfaced_at at time zone pref.timezone,'YYYY-MM-DD') end;
  select * into template from network.consumer_notification_templates t
  where t.channel='email' and t.use_case=v_delivery_type and t.severity=a.severity
    and t.enabled and t.governance_status='approved'
    and t.effective_from<=statement_timestamp() and (t.effective_to is null or t.effective_to>statement_timestamp())
  order by t.version desc limit 1;
  if template.template_key is null then
    outcome:='template_unavailable'; delivery_id:=null; delivery_status:=null; return next; return;
  end if;
  select o.enabled into override_enabled from consumer.consumer_watch_notification_overrides o
    where o.watch_id=w.id and o.channel='email' and o.severity=a.severity;

  allowed:=coalesce(consumer.email_delivery_enabled(a.user_id,w.id,a.severity),false);
  suppress_reason:=case
    when event.status<>'active' then 'ALERT_EVENT_NOT_ACTIVE'
    when w.status<>'active' then 'WATCH_NOT_ACTIVE'
    when not allowed then 'PREFERENCE_DISABLED'
    when not coalesce(ops.consumer_email_is_deliverable(a.user_id),false) then 'INVALID_DESTINATION'
    else null end;

  insert into ops.consumer_alert_deliveries(
    alert_id,user_id,channel,delivery_type,template_key,template_version,delivery_window_key,
    status,idempotency_key,suppressed_at,failure_class,error_code,recipient_hash,
    preference_snapshot,override_snapshot
  ) values(
    a.id,a.user_id,'email',v_delivery_type,template.template_key,template.version,v_window_key,
    case when suppress_reason is null then 'pending' else 'suppressed' end,p_idempotency_key,
    case when suppress_reason is null then null else statement_timestamp() end,
    case when suppress_reason='INVALID_DESTINATION' then 'invalid_destination'
         when suppress_reason is not null then 'suppressed' else null end,
    suppress_reason,
    case when user_email is null then null else encode(digest(lower(user_email),'sha256'),'hex') end,
    jsonb_build_object(
      'p0_email_enabled',pref.p0_email_enabled,'p1_digest_enabled',pref.p1_digest_enabled,
      'p2_digest_enabled',pref.p2_digest_enabled,'periodic_watch_summary_enabled',pref.periodic_watch_summary_enabled,
      'timezone',pref.timezone,'digest_time_local',pref.digest_time_local,'row_version',pref.row_version
    ),
    jsonb_build_object('present',override_enabled is not null,'enabled',override_enabled,'effective_enabled',allowed)
  )
  on conflict(alert_id,channel,delivery_type,template_key,template_version,delivery_window_key) do nothing
  returning id,status into inserted_id,existing_status;
  if inserted_id is null then
    select d.id,d.status into existing_id,existing_status from ops.consumer_alert_deliveries d
    where d.alert_id=a.id and d.channel='email' and d.delivery_type=v_delivery_type
      and d.template_key=template.template_key and d.template_version=template.version
      and d.delivery_window_key=v_window_key;
    delivery_id:=existing_id; delivery_status:=existing_status; outcome:='already_enqueued';
  else
    delivery_id:=inserted_id; delivery_status:=existing_status;
    outcome:=case when existing_status='suppressed' then lower(suppress_reason) when a.severity='P0' then 'p0_queued' else 'digest_queued' end;
  end if;
  return next;
end;
$$;

create or replace function ops.delivery_still_eligible(p_delivery_id uuid)
returns table(eligible boolean,reason text)
language plpgsql stable security definer set search_path=pg_catalog,network,consumer,ops as $$
declare d ops.consumer_alert_deliveries%rowtype; a consumer.consumer_alerts%rowtype;
  w consumer.consumer_watches%rowtype; event network.network_change_events%rowtype;
begin
  select * into d from ops.consumer_alert_deliveries where id=p_delivery_id;
  if d.id is null then return; end if;
  select * into a from consumer.consumer_alerts where id=d.alert_id;
  select * into w from consumer.consumer_watches where id=a.watch_id;
  select * into event from network.network_change_events where id=a.change_event_id;
  eligible:=true; reason:=null;
  if d.status in ('delivered','suppressed','cancelled') then eligible:=false; reason:='DELIVERY_TERMINAL';
  elsif event.status<>'active' then eligible:=false; reason:='ALERT_EVENT_NOT_ACTIVE';
  elsif w.status<>'active' then eligible:=false; reason:='WATCH_NOT_ACTIVE';
  elsif not coalesce(consumer.email_delivery_enabled(a.user_id,w.id,a.severity),false) then eligible:=false; reason:='PREFERENCE_DISABLED';
  elsif not coalesce(ops.consumer_email_is_deliverable(a.user_id),false) then eligible:=false; reason:='INVALID_DESTINATION';
  elsif not exists(select 1 from network.consumer_notification_templates t
    where t.template_key=d.template_key and t.version=d.template_version
      and t.governance_status='approved' and t.enabled
      and t.effective_from<=statement_timestamp() and (t.effective_to is null or t.effective_to>statement_timestamp()))
    then eligible:=false; reason:='TEMPLATE_UNAVAILABLE';
  end if;
  return next;
end;
$$;

create or replace function ops.process_mock_p0_email(
  p_delivery_id uuid,p_mock_outcome text,p_now timestamptz default statement_timestamp()
)
returns table(delivery_status text,process_outcome text,attempt_number integer)
language plpgsql security definer set search_path=pg_catalog,network,consumer,ops as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text);
  d ops.consumer_alert_deliveries%rowtype; gate record; attempt integer; failure text;
  terminal boolean:=false; provider_ref text;
begin
  if actor_role<>'myth_notification_delivery' then raise exception 'notification worker authorization required' using errcode='insufficient_privilege'; end if;
  if p_mock_outcome not in ('success','transient_failure','permanent_failure','invalid_destination','provider_error','rate_limited') then
    raise exception 'invalid mock outcome' using errcode='invalid_parameter_value';
  end if;
  select * into d from ops.consumer_alert_deliveries where id=p_delivery_id for update;
  if d.id is null then raise exception 'delivery not found' using errcode='no_data_found'; end if;
  if d.delivery_type<>'p0_immediate' then
    delivery_status:=d.status; process_outcome:='digest_not_immediate'; attempt_number:=d.attempt_count; return next; return;
  end if;
  if d.status='delivered' then
    delivery_status:=d.status; process_outcome:='already_delivered'; attempt_number:=d.attempt_count; return next; return;
  end if;
  if d.status in ('suppressed','cancelled') then
    delivery_status:=d.status; process_outcome:='not_eligible'; attempt_number:=d.attempt_count; return next; return;
  end if;
  if d.status='failed' and (d.next_attempt_at is null or d.next_attempt_at>p_now) then
    delivery_status:=d.status; process_outcome:='retry_not_due'; attempt_number:=d.attempt_count; return next; return;
  end if;
  select * into gate from ops.delivery_still_eligible(d.id);
  if not coalesce(gate.eligible,false) then
    update ops.consumer_alert_deliveries set status='suppressed',suppressed_at=p_now,
      failed_at=null,next_attempt_at=null,failure_class=case when gate.reason='INVALID_DESTINATION' then 'invalid_destination' else 'suppressed' end,
      error_code=gate.reason where id=d.id;
    delivery_status:='suppressed'; process_outcome:=lower(gate.reason); attempt_number:=d.attempt_count; return next; return;
  end if;
  attempt:=d.attempt_count+1;
  if attempt>5 then
    update ops.consumer_alert_deliveries set status='failed',failed_at=p_now,next_attempt_at=null,
      failure_class='permanent',error_code='MAX_ATTEMPTS' where id=d.id;
    delivery_status:='failed'; process_outcome:='max_attempts'; attempt_number:=d.attempt_count; return next; return;
  end if;
  provider_ref:=case when p_mock_outcome='success' then 'mock:p17:'||d.id::text||':'||attempt::text else null end;
  failure:=case p_mock_outcome
    when 'transient_failure' then 'transient' when 'permanent_failure' then 'permanent'
    when 'invalid_destination' then 'invalid_destination' when 'provider_error' then 'provider_error'
    when 'rate_limited' then 'rate_limited' else null end;
  terminal:=p_mock_outcome in ('permanent_failure','invalid_destination') or attempt>=5;
  insert into ops.consumer_alert_delivery_attempts(
    delivery_id,attempt_number,outcome,failure_class,provider_message_ref,error_code,attempted_at,worker_ref
  ) values(
    d.id,attempt,case when p_mock_outcome='success' then 'delivered' else p_mock_outcome end,
    failure,provider_ref,case when p_mock_outcome='success' then null else upper(p_mock_outcome) end,
    p_now,actor_role
  );
  if p_mock_outcome='success' then
    update ops.consumer_alert_deliveries set status='delivered',attempt_count=attempt,
      first_attempt_at=coalesce(first_attempt_at,p_now),last_attempt_at=p_now,delivered_at=p_now,
      failed_at=null,next_attempt_at=null,provider_message_ref=provider_ref,failure_class=null,error_code=null
    where id=d.id;
    delivery_status:='delivered'; process_outcome:='simulated_success';
  else
    update ops.consumer_alert_deliveries set status='failed',attempt_count=attempt,
      first_attempt_at=coalesce(first_attempt_at,p_now),last_attempt_at=p_now,failed_at=p_now,
      next_attempt_at=case when terminal then null else p_now+ops.notification_retry_delay(attempt) end,
      failure_class=case when terminal and attempt>=5 then 'permanent' else failure end,
      error_code=case when terminal and attempt>=5 then 'MAX_ATTEMPTS' else upper(p_mock_outcome) end
    where id=d.id;
    delivery_status:='failed'; process_outcome:=case when terminal then 'terminal_failure' else 'retry_scheduled' end;
  end if;
  attempt_number:=attempt;
  return next;
end;
$$;

create or replace function ops.get_p0_email_payload(p_delivery_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,network,consumer,ops as $$
declare actor_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); payload jsonb;
begin
  if actor_role<>'myth_notification_delivery' then raise exception 'notification worker authorization required' using errcode='insufficient_privilege'; end if;
  select jsonb_build_object(
    'product','My TrustHub',
    'subject',replace(t.subject_template,'{{entity_name}}',e.canonical_name),
    'body',replace(replace(t.body_template,'{{entity_name}}',e.canonical_name),'{{what_changed}}',at.headline),
    'entity_name',e.canonical_name,'hub',cap.hub,'what_changed',at.headline,
    'official_as_of',a.source_as_of,'observed_at',a.observed_at,
    'source',coalesce(sp.display_name,cap.source_key),'source_confirmation_ref',sp.confirmation_ref,
    'project_context',a.project_context_snapshot,'why_received','You asked My TrustHub to Watch supported public-record changes for this record.',
    'watched_grain',cap.grain_key,'coverage_display_name',cap.display_name,
    'disclosure',t.disclosure,'manage_notifications_path','/my/notifications'
  ) into payload
  from ops.consumer_alert_deliveries d
  join consumer.consumer_alerts a on a.id=d.alert_id
  join network.network_change_events ce on ce.id=a.change_event_id
  join network.network_entities e on e.id=ce.network_entity_id
  join network.watch_capabilities cap on cap.id=ce.capability_id and cap.version=ce.capability_version
  join network.consumer_alert_templates at on at.template_key=a.template_key and at.version=a.template_version
  join network.consumer_notification_templates t on t.template_key=d.template_key and t.version=d.template_version
  left join network.consumer_source_presentations sp on sp.source_key=cap.source_key and sp.governance_status='approved'
  where d.id=p_delivery_id and d.delivery_type='p0_immediate';
  return payload;
end;
$$;

create or replace function consumer.get_digest_eligibility(p_local_date date default null)
returns table(
  alert_id uuid,severity text,local_digest_date date,headline text,
  entity_name text,source_organization text,source_confirmation_ref text,official_as_of timestamptz
)
language plpgsql stable security definer set search_path=pg_catalog,network,consumer,ops as $$
declare subject uuid:=consumer.require_user(); pref consumer.consumer_notification_preferences%rowtype;
begin
  select * into pref from consumer.consumer_notification_preferences where user_id=subject;
  return query
  select distinct a.id,a.severity,d.delivery_window_key::date,at.headline,e.canonical_name,
    coalesce(sp.display_name,cap.source_key),sp.confirmation_ref,a.source_as_of
  from ops.consumer_alert_deliveries d
  join consumer.consumer_alerts a on a.id=d.alert_id and a.user_id=subject
  join network.network_change_events ce on ce.id=a.change_event_id and ce.status='active'
  join network.network_entities e on e.id=ce.network_entity_id
  join network.watch_capabilities cap on cap.id=ce.capability_id and cap.version=ce.capability_version
  join network.consumer_alert_templates at on at.template_key=a.template_key and at.version=a.template_version
  left join network.consumer_source_presentations sp on sp.source_key=cap.source_key and sp.governance_status='approved'
  where d.status='pending' and d.delivery_type in ('p1_digest','p2_digest')
    and (p_local_date is null or d.delivery_window_key::date=p_local_date)
  order by d.delivery_window_key::date,a.severity,a.id;
end;
$$;

create or replace function consumer.get_periodic_watch_summary_eligibility()
returns table(
  eligible boolean,active_watch_count integer,material_alert_count integer,
  healthy_no_change_coverage_count integer,delayed_coverage_count integer,
  degraded_coverage_count integer,unknown_coverage_count integer
)
language plpgsql stable security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); summary_enabled boolean;
begin
  select p.periodic_watch_summary_enabled into summary_enabled
  from consumer.consumer_notification_preferences p where p.user_id=subject;
  return query
  with active_saved as (
    select s.id from consumer.consumer_saved_entities s
    join consumer.consumer_watches w on w.saved_entity_id=s.id and w.status='active'
    where s.user_id=subject and s.removed_at is null
  ), checks as (
    select c.* from active_saved s cross join lateral consumer.get_watch_coverage_checks(s.id) c
  )
  select coalesce(summary_enabled,false),
    (select count(*)::integer from active_saved),
    coalesce((select sum(c.alert_count)::integer from checks c),0),
    count(*) filter(where c.check_state='no_change')::integer,
    count(*) filter(where c.check_state='delayed')::integer,
    count(*) filter(where c.check_state='degraded')::integer,
    count(*) filter(where c.check_state in ('unknown','baseline_only'))::integer
  from checks c;
end;
$$;

alter table network.consumer_notification_templates enable row level security;
alter table network.consumer_notification_templates force row level security;
alter table consumer.consumer_notification_preferences enable row level security;
alter table consumer.consumer_notification_preferences force row level security;
alter table consumer.consumer_watch_notification_overrides enable row level security;
alter table consumer.consumer_watch_notification_overrides force row level security;
alter table consumer.consumer_notification_events enable row level security;
alter table consumer.consumer_notification_events force row level security;
alter table ops.consumer_alert_deliveries enable row level security;
alter table ops.consumer_alert_deliveries force row level security;
alter table ops.consumer_alert_delivery_attempts enable row level security;
alter table ops.consumer_alert_delivery_attempts force row level security;

create policy consumer_notification_templates_governor_all
on network.consumer_notification_templates for all to myth_capability_governor using(true) with check(true);
create policy consumer_notification_preferences_select_own
on consumer.consumer_notification_preferences for select to authenticated using((select auth.uid())=user_id);
create policy consumer_watch_notification_overrides_select_own
on consumer.consumer_watch_notification_overrides for select to authenticated using(exists(
  select 1 from consumer.consumer_watches w where w.id=watch_id and w.user_id=(select auth.uid())
));
create policy consumer_notification_events_select_own
on consumer.consumer_notification_events for select to authenticated using((select auth.uid())=user_id);

revoke all on table network.consumer_notification_templates from public,anon,authenticated;
revoke all on table consumer.consumer_notification_preferences from public,anon,authenticated;
revoke all on table consumer.consumer_watch_notification_overrides from public,anon,authenticated;
revoke all on table consumer.consumer_notification_events from public,anon,authenticated;
revoke all on table ops.consumer_alert_deliveries from public,anon,authenticated;
revoke all on table ops.consumer_alert_delivery_attempts from public,anon,authenticated;

grant select,insert,update on network.consumer_notification_templates to myth_capability_governor;
grant select on consumer.consumer_notification_preferences,consumer.consumer_watch_notification_overrides,
  consumer.consumer_notification_events to authenticated;

grant usage on schema consumer,network,ops to myth_notification_delivery;
grant execute on function ops.enqueue_alert_delivery(uuid,uuid),
  ops.process_mock_p0_email(uuid,text,timestamptz),ops.get_p0_email_payload(uuid)
to myth_notification_delivery;

grant execute on function consumer.get_notification_preferences(),
  consumer.update_notification_preferences(boolean,boolean,boolean,boolean,text,time,bigint,uuid),
  consumer.set_watch_notification_override(uuid,text,boolean,uuid),
  consumer.remove_watch_notification_override(uuid,text,uuid),
  consumer.get_watch_notification_overrides(uuid),
  consumer.get_digest_eligibility(date),
  consumer.get_periodic_watch_summary_eligibility()
to authenticated,myth_consumer_api;

revoke all on function network.enforce_notification_template_version() from public;
revoke all on function consumer.create_default_notification_preferences() from public;
revoke all on function consumer.notification_preferences_json(consumer.consumer_notification_preferences) from public;
revoke all on function consumer.get_notification_preferences() from public;
revoke all on function consumer.update_notification_preferences(boolean,boolean,boolean,boolean,text,time,bigint,uuid) from public;
revoke all on function consumer.set_watch_notification_override(uuid,text,boolean,uuid) from public;
revoke all on function consumer.remove_watch_notification_override(uuid,text,uuid) from public;
revoke all on function consumer.get_watch_notification_overrides(uuid) from public;
revoke all on function consumer.email_delivery_enabled(uuid,uuid,text) from public;
revoke all on function ops.consumer_email_is_deliverable(uuid) from public;
revoke all on function ops.notification_retry_delay(integer) from public;
revoke all on function ops.enqueue_alert_delivery(uuid,uuid) from public;
revoke all on function ops.delivery_still_eligible(uuid) from public;
revoke all on function ops.process_mock_p0_email(uuid,text,timestamptz) from public;
revoke all on function ops.get_p0_email_payload(uuid) from public;
revoke all on function consumer.get_digest_eligibility(date) from public;
revoke all on function consumer.get_periodic_watch_summary_eligibility() from public;

commit;
