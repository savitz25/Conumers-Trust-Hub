-- FORWARD REPAIR ONLY. Do not apply from an agent session.
-- Target: isolated Ask project xkkiicsassizmakcvxml.
-- Not applicable to production qvvxvbcdmbjzrgvwjatw.
-- Replaces preview_session_live so myth_v23_foundation no longer reads auth.sessions.
-- Does not grant USAGE on schema auth or SELECT on auth.sessions.
--
-- In the same session, before this file:
--   select set_config('v23.approved_project','xkkiicsassizmakcvxml',false);
--   select set_config('v23.install_session_mac','<64 lowercase hex>',false);
-- The hex is sha256 of MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM, UTF-8, with no newline added.
-- Do not print the PEM. A different key fails closed instead of replacing the installed key.
begin;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'xkkiicsassizmakcvxml' then
    raise exception 'Explicit isolated apply authorization required';
  end if;
  if (select project_ref from v23_private.preview_deployment_pin where singleton) is distinct from 'xkkiicsassizmakcvxml' then
    raise exception 'Deployment pin is not the isolated Ask project';
  end if;
  if current_setting('v23.install_session_mac', true) !~ '^[0-9a-f]{64}$' then
    raise exception 'v23.install_session_mac must be the 64-hex sha256 of the existing Ask signing private key PEM';
  end if;
  if to_regprocedure('v23_private.preview_session_live(uuid,uuid)') is null then
    raise exception 'Clean preview packet is not present; refusing a partial repair';
  end if;
end $$;

create table if not exists v23_private.preview_session_mac (
  singleton boolean primary key default true check (singleton),
  key bytea not null check (octet_length(key)=32)
);
alter table v23_private.preview_session_mac enable row level security;
alter table v23_private.preview_session_mac force row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polname='preview_session_mac_foundation') then
    create policy preview_session_mac_foundation on v23_private.preview_session_mac
      for all to myth_v23_foundation using (true) with check (true);
  end if;
end $$;
revoke all on v23_private.preview_session_mac from public,anon,authenticated;

create table if not exists v23_private.preview_session_attestations (
  subject uuid not null,
  session_id uuid not null,
  project_ref text not null,
  expires_at timestamptz not null,
  primary key (subject, session_id)
);
alter table v23_private.preview_session_attestations enable row level security;
alter table v23_private.preview_session_attestations force row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polname='preview_session_attestation_foundation') then
    create policy preview_session_attestation_foundation on v23_private.preview_session_attestations
      for all to myth_v23_foundation
      using (project_ref='xkkiicsassizmakcvxml')
      with check (project_ref='xkkiicsassizmakcvxml');
  end if;
end $$;
revoke all on v23_private.preview_session_attestations from public,anon,authenticated;

do $hmac$
declare sig text;
begin
  sig := coalesce(
    to_regprocedure('extensions.hmac(bytea,bytea,text)')::text,
    to_regprocedure('public.hmac(bytea,bytea,text)')::text);
  if sig is null then
    raise exception 'pgcrypto hmac(bytea,bytea,text) is required for session attestation';
  end if;
  execute 'drop function if exists v23_private.preview_session_mac_matches(text,bytea,bytea)';
  execute format($fn$
    create function v23_private.preview_session_mac_matches(message text, secret bytea, mac bytea) returns boolean
    language sql immutable set search_path=pg_catalog as
    $body$ select %s(convert_to(message, 'UTF8'), secret, 'sha256') = mac $body$
  $fn$, split_part(sig, '(', 1));
end $hmac$;
revoke all on function v23_private.preview_session_mac_matches(text,bytea,bytea) from public,anon,authenticated;

create or replace function v23_private.preview_session_install_mac(key bytea) returns void
language plpgsql security definer set search_path=pg_catalog,v23_private as $$
declare existing bytea;
begin
  if octet_length(key) is distinct from 32 then raise exception 'session mac key' using errcode='42501'; end if;
  select k.key into existing from v23_private.preview_session_mac k where k.singleton;
  if existing is null then
    insert into v23_private.preview_session_mac(singleton, key) values (true, key);
  elsif existing <> key then
    raise exception 'session mac key differs from the installed key' using errcode='42501';
  end if;
end $$;
revoke all on function v23_private.preview_session_install_mac(bytea) from public,anon,authenticated;

create or replace function v23_private.preview_session_bind(p_subject uuid, p_session uuid, p_expires_unix bigint, p_mac bytea)
returns boolean language plpgsql security definer set search_path=pg_catalog,v23_private as $$
declare pin text; secret bytea; message text;
begin
  select project_ref into strict pin from v23_private.preview_deployment_pin where singleton;
  if pin is distinct from 'xkkiicsassizmakcvxml' then raise exception 'project' using errcode='42501'; end if;
  if p_expires_unix <= floor(extract(epoch from statement_timestamp()))
    or p_expires_unix > floor(extract(epoch from statement_timestamp())) + 120 then
    raise exception 'expiry' using errcode='42501';
  end if;
  if octet_length(p_mac) is distinct from 32 then raise exception 'mac' using errcode='42501'; end if;
  select k.key into strict secret from v23_private.preview_session_mac k where k.singleton;
  message := 'v23-session/1|' || pin || '|' || lower(p_subject::text) || '|' || lower(p_session::text) || '|' || p_expires_unix::text;
  if not v23_private.preview_session_mac_matches(message, secret, p_mac) then
    raise exception 'mac' using errcode='42501';
  end if;
  insert into v23_private.preview_session_attestations(subject, session_id, project_ref, expires_at)
  values (p_subject, p_session, pin, to_timestamp(p_expires_unix))
  on conflict (subject, session_id) do update
    set expires_at=excluded.expires_at, project_ref=excluded.project_ref
    where v23_private.preview_session_attestations.project_ref=excluded.project_ref;
  return true;
end $$;
revoke all on function v23_private.preview_session_bind(uuid,uuid,bigint,bytea) from public,anon,authenticated;
grant execute on function v23_private.preview_session_bind(uuid,uuid,bigint,bytea) to myth_v23_authorizer;

create or replace function v23_private.preview_session_live(p_subject uuid, p_session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private as $$
begin
  return exists(
    select 1 from v23_private.preview_session_attestations a
    join v23_private.preview_deployment_pin p on p.singleton
    where a.subject=p_subject and a.session_id=p_session
      and a.project_ref=p.project_ref and a.project_ref='xkkiicsassizmakcvxml'
      and a.expires_at>statement_timestamp());
end $$;
revoke all on function v23_private.preview_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_session_live(uuid,uuid) to myth_v23_authorizer,myth_v23_executor;

grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false, inherit false, set true granted by current_user;
alter function v23_private.preview_session_mac_matches(text,bytea,bytea) owner to myth_v23_foundation;
alter function v23_private.preview_session_install_mac(bytea) owner to myth_v23_foundation;
alter function v23_private.preview_session_bind(uuid,uuid,bigint,bytea) owner to myth_v23_foundation;
alter function v23_private.preview_session_live(uuid,uuid) owner to myth_v23_foundation;
alter table v23_private.preview_session_mac owner to myth_v23_foundation;
alter table v23_private.preview_session_attestations owner to myth_v23_foundation;
revoke create on schema v23_private from myth_v23_foundation;
grant execute on function v23_private.preview_session_install_mac(bytea) to current_user;
select v23_private.preview_session_install_mac(decode(current_setting('v23.install_session_mac'), 'hex'));
revoke execute on function v23_private.preview_session_install_mac(bytea) from current_user;
revoke myth_v23_foundation from current_user granted by current_user;
select set_config('v23.install_session_mac', '', false);
commit;
