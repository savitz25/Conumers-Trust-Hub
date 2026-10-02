-- FORWARD REPAIR ONLY. Production prohibited.
-- Do not apply through a stateless Query API or unsafe agent execution.
-- An explicitly authorized operator may apply using ONE persistent PostgreSQL session.
-- Approval setting, hidden MAC parameter and this SQL must remain in that same session.
-- Secret logging and echo must be disabled; SQL authorization gates still apply.
-- Target: isolated Ask project xkkiicsassizmakcvxml.
-- Not applicable to production qvvxvbcdmbjzrgvwjatw.
-- Replaces preview_session_live so myth_v23_foundation no longer reads auth.sessions.
-- Does not grant USAGE on schema auth or SELECT on auth.sessions.
--
-- In the same session, before this file:
--   select set_config('v23.approved_project','xkkiicsassizmakcvxml',false);
-- Load v23.install_session_mac through a parameterized, non-echoing trusted runner.
-- Disable SQL/parameter logging; never paste the PEM or derived secret into a transcript.
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
  if not coalesce(current_setting('v23.install_session_mac', true) ~ '^[0-9a-f]{64}$',false) then
    raise exception 'v23.install_session_mac must be the 64-hex sha256 of the existing Ask signing private key PEM';
  end if;
  if to_regprocedure('v23_private.preview_session_live(uuid,uuid)') is null then
    raise exception 'Clean preview packet is not present; refusing a partial repair';
  end if;
end $$;

-- Assume the owner explicitly; NOINHERIT operator membership alone is not ownership.
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
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
begin
  if to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'Required session dependency extensions.hmac(bytea,bytea,text) is missing';
  end if;
  execute 'drop function if exists v23_private.preview_session_mac_matches(text,bytea,bytea)';
  execute $fn$
    create function v23_private.preview_session_mac_matches(message text, secret bytea, mac bytea) returns boolean
    language sql immutable set search_path=pg_catalog as
    $body$ select extensions.hmac(convert_to(message, 'UTF8'), secret, 'sha256'::text) = mac $body$
  $fn$;
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

create or replace function v23_private.preview_session_live(subject uuid, session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private as $$
begin
  return exists(
    select 1 from v23_private.preview_session_attestations a
    join v23_private.preview_deployment_pin p on p.singleton
    where a.subject=$1 and a.session_id=$2
      and a.project_ref=p.project_ref and a.project_ref='xkkiicsassizmakcvxml'
      and a.expires_at>statement_timestamp());
end $$;
revoke all on function v23_private.preview_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_session_live(uuid,uuid) to myth_v23_authorizer,myth_v23_executor;

do $$ begin
 perform v23_private.preview_session_install_mac(decode(current_setting('v23.install_session_mac'), 'hex'));
 perform set_config('v23.install_session_mac','',false);
end $$;
reset role;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;
-- BEGIN SHARED SESSION READINESS CONTRACT
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
-- Only a boolean crosses the security-definer boundary; no key material is returned.
create or replace function v23_private.preview_session_authority_ready() returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private set row_security=on as $$
declare rel oid; fn oid; spec record; foundation oid := to_regrole('myth_v23_foundation');
  allowed oid[]; complete boolean;
begin
  if foundation is null or to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then return false; end if;
  foreach rel in array array[to_regclass('v23_private.preview_session_mac'),
    to_regclass('v23_private.preview_session_attestations')] loop
    if rel is null or not exists(select 1 from pg_class where oid=rel and relkind='r'
      and relowner=foundation and relrowsecurity and relforcerowsecurity) then return false; end if;
    if exists(select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.oid=rel and a.grantee<>foundation and not exists
        (select 1 from pg_roles where oid=a.grantee and (rolsuper or rolbypassrls)))
      or exists(select 1 from pg_attribute c, lateral aclexplode(c.attacl) a
        where c.attrelid=rel and a.grantee<>foundation and not exists
          (select 1 from pg_roles where oid=a.grantee and (rolsuper or rolbypassrls)))
      or exists(select 1 from pg_roles r where r.rolname in
        ('anon','authenticated','myth_v23_parent_preview','myth_v23_authorizer','myth_v23_executor')
        and (has_table_privilege(r.oid,rel,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          or has_any_column_privilege(r.oid,rel,'SELECT,INSERT,UPDATE,REFERENCES'))) then return false; end if;
  end loop;
  for spec in select * from (values
    ('v23_private.preview_session_mac_matches(text,bytea,bytea)',false,array[]::text[]),
    ('v23_private.preview_session_install_mac(bytea)',true,array[]::text[]),
    ('v23_private.preview_session_bind(uuid,uuid,bigint,bytea)',true,array['myth_v23_authorizer']),
    ('v23_private.preview_session_live(uuid,uuid)',true,array['myth_v23_authorizer','myth_v23_executor']),
    ('v23_private.preview_session_authority_ready()',true,array['myth_v23_authorizer'])
  ) specs(signature,definer,callers) loop
    fn := to_regprocedure(spec.signature);
    if fn is null or not exists(select 1 from pg_proc where oid=fn and proowner=foundation
      and prosecdef=spec.definer) then return false; end if;
    allowed := array[foundation] || array(select to_regrole(x)::oid from unnest(spec.callers) x);
    if exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=fn and (not a.grantee=any(allowed) or (a.grantee<>foundation and a.is_grantable)))
      or exists(select 1 from unnest(spec.callers) r where not has_function_privilege(r,fn,'EXECUTE'))
      or exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','myth_v23_parent_preview',
        'myth_v23_authorizer','myth_v23_executor') and not r.rolname=any(spec.callers)
        and has_function_privilege(r.oid,fn,'EXECUTE')) then return false; end if;
  end loop;
  -- Dynamic only after catalog checks: missing tables must return FALSE, not throw.
  execute 'select count(*)=1 and coalesce(bool_and(singleton and octet_length(key)=32),false)
    from v23_private.preview_session_mac' into complete;
  return coalesce(complete,false);
exception when others then return false;
end $$;
revoke all on function v23_private.preview_session_authority_ready() from public,anon,authenticated;
grant execute on function v23_private.preview_session_authority_ready() to myth_v23_authorizer;
reset role;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

create or replace function v23_private.preview_ports_ready() returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare complete boolean;
begin
  if current_user<>'myth_v23_authorizer' then return false; end if;
  if exists(select 1 from unnest(array[
    'v23_private.preview_confirmation(text,text,jsonb)',
    'v23_private.preview_session_bind(uuid,uuid,bigint,bytea)',
    'v23_private.preview_session_live(uuid,uuid)',
    'v23_private.preview_session_authority_ready()',
    'v23_private.preview_move_binding()',
    'v23_private.preview_projects(uuid,uuid)',
    'v23_private.preview_saved(uuid,uuid)',
    'v23_private.preview_issue_context(jsonb,uuid,uuid)']) f
    where to_regprocedure(f) is null or not has_function_privilege(current_user,f,'EXECUTE')) then return false; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname||'.'||c.relname in ('v23_private.preview_transport_records','v23_private.browser_confirmations',
    'v23_private.transaction_authority','ops.v23_profile_runtime_records','ops.v23_profile_runtime_quota')
    and c.relrowsecurity and c.relforcerowsecurity)<>5 then return false; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relname in ('users','sessions')
      and has_table_privilege(current_user,c.oid,'SELECT')) then return false; end if;
  if not exists(select 1 from pg_roles where rolname='myth_v23_parent_preview'
    and rolcanlogin and not (rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
    or (select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid
      where m.member=to_regrole('myth_v23_parent_preview') and r.rolname in ('myth_v23_authorizer','myth_v23_executor')
      and m.set_option and not m.inherit_option and not m.admin_option)<>2
    or exists(select 1 from pg_auth_members where member=to_regrole('myth_v23_parent_preview')
      and roleid not in (to_regrole('myth_v23_authorizer'),to_regrole('myth_v23_executor')))
    or exists(select 1 from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor','myth_v23_foundation')
      and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
    or exists(select 1 from pg_auth_members where member in (to_regrole('myth_v23_authorizer'),to_regrole('myth_v23_executor')))
    then return false; end if;
  execute $pin$select count(*)=1 and coalesce(bool_and(singleton
    and project_ref='xkkiicsassizmakcvxml' and version='v23-parent-wiring/1'
    and ask_origin='https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app'),false)
    from v23_private.preview_deployment_pin$pin$ into complete;
  if not coalesce(complete,false) then return false; end if;
  return v23_private.preview_session_authority_ready();
exception when others then return false;
end $$;
revoke all on function v23_private.preview_ports_ready() from public,anon,authenticated;
grant execute on function v23_private.preview_ports_ready() to myth_v23_authorizer;
-- END SHARED SESSION READINESS CONTRACT
-- Catalog + key-state checks run as the owner, without granting the operator runtime roles.
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
do $$ begin
 if not v23_private.preview_session_authority_ready() then
   raise exception 'Incomplete session-authority repair'; end if;
end $$;
reset role;
revoke myth_v23_foundation from current_user granted by current_user;
commit;
