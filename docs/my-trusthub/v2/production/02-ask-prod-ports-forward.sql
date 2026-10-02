-- MY TRUSTHUB V2 PRODUCTION HANDOFF — ASK PARENT PORTS (production copy of
-- final-parent-wiring/ports-forward.sql). Target qvvxvbcdmbjzrgvwjatw only.
-- Identifiers are v23_private.prod_* so no preview object is reused or renamed.
-- Differences from the isolated packet, and nothing else:
--   * project ref, deployment pin origins, login/reader role names;
--   * handoff intents are issued with environment 'production' against the
--     registry's production_origins (no staging_origins mutation);
--   * no preview invite semantics (parent admission is the production policy).
-- Runner MUST pin the remote project/host outside SQL. The GUC is an operator
-- attestation, not proof of host identity.
begin;
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production apply authorization required';
  end if;
end $$;

do $$ begin
 if (select count(*) from ops.consumer_hub_registry where hub_key in ('ask','move'))<>2
   or not exists(select 1 from ops.consumer_hub_registry where hub_key='ask' and 'https://www.asktrusthub.com'=any(production_origins))
   or not exists(select 1 from ops.consumer_hub_registry where hub_key='move' and 'https://www.movetrusthub.com'=any(production_origins))
   or exists(select 1 from pg_roles where rolname in ('myth_v23_parent_prod','myth_v23_prod_reader'))
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='v23_private' and p.proname like 'prod_%')
   or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='v23_private' and c.relname like 'prod_%') then
   raise exception 'Clean production packet preconditions required'; end if;
 if has_any_column_privilege('myth_v23_foundation','auth.sessions','SELECT')
   or has_schema_privilege('myth_v23_foundation','v23_private','CREATE')
   or has_schema_privilege('myth_v23_browser_store','v23_private','CREATE')
   or has_function_privilege('myth_v23_foundation','consumer.list_cross_hub_project_summaries(integer)','EXECUTE')
   or has_function_privilege('myth_v23_foundation','consumer.list_saved_entities()','EXECUTE')
   or has_function_privilege('myth_v23_foundation','ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text)','EXECUTE')
   or has_function_privilege('myth_v23_foundation','ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text)','EXECUTE') then
   raise exception 'Parent grant already present; reviewed clean base required'; end if;
end $$;

-- Snapshot BEFORE any production grant/role changes. ACLs/attributes only.
create table v23_private.prod_security_before as
with objects as (
 select 'relation:'||n.nspname||'.'||c.relname object_key,c.relowner owner_id,
   coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner)) acl
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('auth','consumer','ops','network','v23_private','public') and c.relkind in ('r','p','v','m','f','S')
   and not (n.nspname='v23_private' and c.relname like 'prod_%')
 union all
 select 'function:'||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
   p.proowner,coalesce(p.proacl,acldefault('f',p.proowner))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('auth','consumer','ops','network','v23_private','public')
   and not (n.nspname='v23_private' and p.proname like 'prod_%')
 union all
 select 'schema:'||n.nspname,n.nspowner,coalesce(n.nspacl,acldefault('n',n.nspowner))
 from pg_namespace n where n.nspname in ('auth','consumer','ops','network','v23_private','public')
), inventory as (
 select object_key,jsonb_build_object('owner',owner_id,'acl',coalesce(
   (select jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable)
     from aclexplode(nullif(acl,'{}'::aclitem[])) a),'[]'::jsonb)) state from objects
 union all
 select 'membership:'||m.roleid||':'||m.member||':'||m.grantor,
   jsonb_build_object('admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
 from pg_auth_members m where m.roleid in (select oid from pg_roles where rolname like 'myth_v23_%')
   or m.member in (select oid from pg_roles where rolname like 'myth_v23_%')
 union all
 select 'role:'||rolname,jsonb_build_object('login',rolcanlogin,'inherit',rolinherit,'super',rolsuper,
   'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,
   'limit',rolconnlimit,'valid_until',rolvaliduntil,'config',rolconfig)
 from pg_roles where rolname like 'myth_v23_%'
)
select object_key,state from inventory;
revoke all on v23_private.prod_security_before from public,anon,authenticated;
alter table v23_private.prod_security_before enable row level security;
alter table v23_private.prod_security_before force row level security;

create table v23_private.prod_deployment_pin (
  singleton boolean primary key default true check(singleton),
  project_ref text not null check(project_ref='qvvxvbcdmbjzrgvwjatw'),
  version text not null check(version='v23-parent-wiring/1'),
  ask_origin text not null check(ask_origin='https://www.asktrusthub.com'),
  move_origin text not null check(move_origin='https://www.movetrusthub.com')
);
insert into v23_private.prod_deployment_pin values(true,'qvvxvbcdmbjzrgvwjatw','v23-parent-wiring/1',
 'https://www.asktrusthub.com','https://www.movetrusthub.com');
alter table v23_private.prod_deployment_pin enable row level security;
alter table v23_private.prod_deployment_pin force row level security;
grant select on v23_private.prod_deployment_pin to myth_v23_authorizer,myth_v23_foundation;
create policy prod_pin_read on v23_private.prod_deployment_pin for select
  to myth_v23_authorizer,myth_v23_foundation using(true);

create table v23_private.prod_transport_records (
  key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp()
);
alter table v23_private.prod_transport_records enable row level security;
alter table v23_private.prod_transport_records force row level security;
grant select,insert,update on v23_private.prod_transport_records to myth_v23_authorizer;
create policy prod_transport_exact_key on v23_private.prod_transport_records to myth_v23_authorizer
  using(key_hash=current_setting('v23.transport_key',true))
  with check(key_hash=current_setting('v23.transport_key',true));
create index prod_transport_expiry on v23_private.prod_transport_records(expires_at);
grant select,delete on v23_private.prod_transport_records to myth_v23_cleanup;
create policy prod_transport_cleanup on v23_private.prod_transport_records to myth_v23_cleanup
  using(expires_at < statement_timestamp()-interval '1 hour');

-- No LOGIN membership in browser_store. Its existing exact-cookie RLS remains.
create function v23_private.prod_confirmation(action text,key text,value jsonb default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,v23_private as $$
declare prior jsonb; result jsonb;
begin
 if key !~ '^[a-f0-9]{64}$' or action not in ('read','insert','update') then raise exception 'invalid' using errcode='42501'; end if;
 perform set_config('v23.confirmation_key',key,true);
 if action='read' then select payload into result from v23_private.browser_confirmations where key_hash=key; return result; end if;
 if action='insert' then
   insert into v23_private.browser_confirmations(key_hash,payload) values(key,value); return value;
 end if;
 select payload into prior from v23_private.browser_confirmations where key_hash=key for update;
 if prior is null or prior->'source' is distinct from value->'source'
   or prior#>>'{parent,subject}' is not null and prior->'parent' is distinct from value->'parent'
   then raise exception 'immutable confirmation' using errcode='42501'; end if;
 update v23_private.browser_confirmations set payload=value where key_hash=key returning payload into result;
 return result;
end $$;
revoke all on function v23_private.prod_confirmation(text,text,jsonb) from public,anon,authenticated;
grant execute on function v23_private.prod_confirmation(text,text,jsonb) to myth_v23_authorizer;
grant create on schema v23_private to myth_v23_browser_store;
grant myth_v23_browser_store to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.prod_confirmation(text,text,jsonb) owner to myth_v23_browser_store;
revoke create on schema v23_private from myth_v23_browser_store;
revoke myth_v23_browser_store from current_user granted by current_user;

-- Session authority is an application attestation, not auth.sessions.
create table v23_private.prod_session_mac (
  singleton boolean primary key default true check (singleton),
  key bytea not null check (octet_length(key)=32)
);
alter table v23_private.prod_session_mac enable row level security;
alter table v23_private.prod_session_mac force row level security;
create policy prod_session_mac_foundation on v23_private.prod_session_mac
  for all to myth_v23_foundation using (true) with check (true);
revoke all on v23_private.prod_session_mac from public,anon,authenticated;

create table v23_private.prod_session_attestations (
  subject uuid not null,
  session_id uuid not null,
  project_ref text not null,
  expires_at timestamptz not null,
  primary key (subject, session_id)
);
alter table v23_private.prod_session_attestations enable row level security;
alter table v23_private.prod_session_attestations force row level security;
create policy prod_session_attestation_foundation on v23_private.prod_session_attestations
  for all to myth_v23_foundation
  using (project_ref='qvvxvbcdmbjzrgvwjatw')
  with check (project_ref='qvvxvbcdmbjzrgvwjatw');
revoke all on v23_private.prod_session_attestations from public,anon,authenticated;

do $hmac$
begin
  if to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'Required session dependency extensions.hmac(bytea,bytea,text) is missing';
  end if;
  execute $fn$
    create function v23_private.prod_session_mac_matches(message text, secret bytea, mac bytea) returns boolean
    language sql immutable set search_path=pg_catalog as
    $body$ select extensions.hmac(convert_to(message, 'UTF8'), secret, 'sha256'::text) = mac $body$
  $fn$;
end $hmac$;
revoke all on function v23_private.prod_session_mac_matches(text,bytea,bytea) from public,anon,authenticated;

create function v23_private.prod_session_install_mac(key bytea) returns void
language plpgsql security definer set search_path=pg_catalog,v23_private as $$
declare existing bytea;
begin
  if octet_length(key) is distinct from 32 then raise exception 'session mac key' using errcode='42501'; end if;
  select k.key into existing from v23_private.prod_session_mac k where k.singleton;
  if existing is null then
    insert into v23_private.prod_session_mac(singleton, key) values (true, key);
  elsif existing <> key then
    raise exception 'session mac key differs from the installed key' using errcode='42501';
  end if;
end $$;
revoke all on function v23_private.prod_session_install_mac(bytea) from public,anon,authenticated;

create function v23_private.prod_session_bind(p_subject uuid, p_session uuid, p_expires_unix bigint, p_mac bytea)
returns boolean language plpgsql security definer set search_path=pg_catalog,v23_private as $$
declare pin text; secret bytea; message text;
begin
  select project_ref into strict pin from v23_private.prod_deployment_pin where singleton;
  if pin is distinct from 'qvvxvbcdmbjzrgvwjatw' then raise exception 'project' using errcode='42501'; end if;
  if p_expires_unix <= floor(extract(epoch from statement_timestamp()))
    or p_expires_unix > floor(extract(epoch from statement_timestamp())) + 120 then
    raise exception 'expiry' using errcode='42501';
  end if;
  if octet_length(p_mac) is distinct from 32 then raise exception 'mac' using errcode='42501'; end if;
  select k.key into strict secret from v23_private.prod_session_mac k where k.singleton;
  message := 'v23-session/1|' || pin || '|' || lower(p_subject::text) || '|' || lower(p_session::text) || '|' || p_expires_unix::text;
  if not v23_private.prod_session_mac_matches(message, secret, p_mac) then
    raise exception 'mac' using errcode='42501';
  end if;
  insert into v23_private.prod_session_attestations(subject, session_id, project_ref, expires_at)
  values (p_subject, p_session, pin, to_timestamp(p_expires_unix))
  on conflict (subject, session_id) do update
    set expires_at=excluded.expires_at, project_ref=excluded.project_ref
    where v23_private.prod_session_attestations.project_ref=excluded.project_ref;
  return true;
end $$;
revoke all on function v23_private.prod_session_bind(uuid,uuid,bigint,bytea) from public,anon,authenticated;
grant execute on function v23_private.prod_session_bind(uuid,uuid,bigint,bytea) to myth_v23_authorizer;

create function v23_private.prod_session_live(subject uuid, session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private as $$
begin
  return exists(
    select 1 from v23_private.prod_session_attestations a
    join v23_private.prod_deployment_pin p on p.singleton
    where a.subject=$1 and a.session_id=$2
      and a.project_ref=p.project_ref and a.project_ref='qvvxvbcdmbjzrgvwjatw'
      and a.expires_at>statement_timestamp());
end $$;
revoke all on function v23_private.prod_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.prod_session_live(uuid,uuid) to myth_v23_authorizer,myth_v23_executor;

-- The sole approved public binding for the canary; no arbitrary identity lookup
-- or enumeration. Widening later replaces these two exact policies and this
-- wrapper with the reviewed supported-published-mover contract, separately.
create role myth_v23_prod_reader nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
grant usage on schema network,v23_private to myth_v23_prod_reader;
grant select on network.network_entities,network.network_entity_bindings to myth_v23_prod_reader;
create policy prod_exact_move_binding on network.network_entity_bindings for select to myth_v23_prod_reader
 using(hub='move' and specialist_entity_type='mover' and specialist_entity_id='usdot-1002530'
   and identifier_namespace='fmcsa.usdot' and source_identifier='1002530' and jurisdiction='US');
create policy prod_exact_move_entity on network.network_entities for select to myth_v23_prod_reader
 using(entity_type='organization' and canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC'
   and primary_hub='move' and jurisdiction='US' and status='active');
create function v23_private.prod_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text)
language sql security definer set search_path=pg_catalog,network as $$
 select b.id,e.id,b.binding_status from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where b.hub='move' and b.specialist_entity_type='mover' and b.specialist_entity_id='usdot-1002530'
 and b.identifier_namespace='fmcsa.usdot' and b.source_identifier='1002530' and b.jurisdiction='US'
 and b.binding_status='accepted' and b.valid_from<=statement_timestamp()
 and (b.valid_to is null or b.valid_to>statement_timestamp()) and e.status='active'
 and e.entity_type='organization' and e.canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC'
 and e.jurisdiction='US' limit 2;
$$;
revoke all on function v23_private.prod_move_binding() from public,anon,authenticated;
grant execute on function v23_private.prod_move_binding() to myth_v23_authorizer,myth_v23_executor;
grant create on schema v23_private to myth_v23_prod_reader;
grant myth_v23_prod_reader to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.prod_move_binding() owner to myth_v23_prod_reader;
revoke create on schema v23_private from myth_v23_prod_reader;
revoke myth_v23_prod_reader from current_user granted by current_user;

grant execute on function consumer.list_cross_hub_project_summaries(integer) to myth_v23_foundation;
create function v23_private.prod_projects(subject uuid,session uuid) returns table(project_id uuid,name text)
language plpgsql security definer set search_path=pg_catalog,v23_private,consumer as $$
begin
 if not v23_private.prod_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',subject::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject)::text,true);
 return query select p.project_id,p.name from consumer.list_cross_hub_project_summaries(25) p where p.status='active';
end $$;
revoke all on function v23_private.prod_projects(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.prod_projects(uuid,uuid) to myth_v23_authorizer;

grant execute on function consumer.list_saved_entities() to myth_v23_foundation;
create function v23_private.prod_saved(subject uuid,session uuid) returns table(saved_entity_id uuid,canonical_name text,primary_hub text,saved_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,v23_private,consumer as $$
begin
 if not v23_private.prod_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',subject::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject)::text,true);
 return query select s.saved_entity_id,s.canonical_name,s.primary_hub,s.saved_at from consumer.list_saved_entities() s where s.removed_at is null;
end $$;
revoke all on function v23_private.prod_saved(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.prod_saved(uuid,uuid) to myth_v23_authorizer;

grant execute on function ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text),
 ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text) to myth_v23_foundation;
create function v23_private.prod_issue_context(proof jsonb,subject uuid,session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $$
declare pin v23_private.prod_deployment_pin%rowtype;
begin
 if not v23_private.prod_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 select * into strict pin from v23_private.prod_deployment_pin where singleton;
 if proof->>'targetOrigin' is distinct from pin.ask_origin then raise exception 'origin' using errcode='42501'; end if;
 if not coalesce(proof->>'code' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'state' ~ '^[A-Za-z0-9_-]{43}$'
   and proof->>'nonce' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'intent' ~ '^[A-Za-z0-9_-]{43}$',false)
   then raise exception 'proof' using errcode='42501'; end if;
 perform ops.create_browser_handoff_intent('auth',proof->>'intent','ask',pin.ask_origin,'/my/profile-save',
   proof->>'state',proof->>'nonce','production',proof->>'rateBucket');
 perform ops.create_consumer_auth_handoff(proof->>'code',subject,'move',pin.move_origin,proof->>'intent',
   (proof->>'creationKey')::uuid,proof->>'rateBucket');
 return true;
end $$;
revoke all on function v23_private.prod_issue_context(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.prod_issue_context(jsonb,uuid,uuid) to myth_v23_authorizer;

-- Set ACL before owner transfer, then remove only temporary operator membership.
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.prod_session_mac_matches(text,bytea,bytea) owner to myth_v23_foundation;
alter function v23_private.prod_session_install_mac(bytea) owner to myth_v23_foundation;
alter function v23_private.prod_session_bind(uuid,uuid,bigint,bytea) owner to myth_v23_foundation;
alter function v23_private.prod_session_live(uuid,uuid) owner to myth_v23_foundation;
alter table v23_private.prod_session_mac owner to myth_v23_foundation;
alter table v23_private.prod_session_attestations owner to myth_v23_foundation;
alter function v23_private.prod_projects(uuid,uuid) owner to myth_v23_foundation;
alter function v23_private.prod_saved(uuid,uuid) owner to myth_v23_foundation;
alter function v23_private.prod_issue_context(jsonb,uuid,uuid) owner to myth_v23_foundation;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

-- BEGIN SHARED SESSION READINESS CONTRACT (production identifiers)
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
create or replace function v23_private.prod_session_authority_ready() returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private set row_security=on as $$
declare rel oid; fn oid; spec record; foundation oid := to_regrole('myth_v23_foundation');
  allowed oid[]; complete boolean;
begin
  if foundation is null or to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then return false; end if;
  foreach rel in array array[to_regclass('v23_private.prod_session_mac'),
    to_regclass('v23_private.prod_session_attestations')] loop
    if rel is null or not exists(select 1 from pg_class where oid=rel and relkind='r'
      and relowner=foundation and relrowsecurity and relforcerowsecurity) then return false; end if;
    if exists(select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.oid=rel and a.grantee<>foundation and not exists
        (select 1 from pg_roles where oid=a.grantee and (rolsuper or rolbypassrls)))
      or exists(select 1 from pg_attribute c, lateral aclexplode(c.attacl) a
        where c.attrelid=rel and a.grantee<>foundation and not exists
          (select 1 from pg_roles where oid=a.grantee and (rolsuper or rolbypassrls)))
      or exists(select 1 from pg_roles r where r.rolname in
        ('anon','authenticated','myth_v23_parent_prod','myth_v23_authorizer','myth_v23_executor')
        and (has_table_privilege(r.oid,rel,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          or has_any_column_privilege(r.oid,rel,'SELECT,INSERT,UPDATE,REFERENCES'))) then return false; end if;
  end loop;
  for spec in select * from (values
    ('v23_private.prod_session_mac_matches(text,bytea,bytea)',false,array[]::text[]),
    ('v23_private.prod_session_install_mac(bytea)',true,array[]::text[]),
    ('v23_private.prod_session_bind(uuid,uuid,bigint,bytea)',true,array['myth_v23_authorizer']),
    ('v23_private.prod_session_live(uuid,uuid)',true,array['myth_v23_authorizer','myth_v23_executor']),
    ('v23_private.prod_session_authority_ready()',true,array['myth_v23_authorizer'])
  ) specs(signature,definer,callers) loop
    fn := to_regprocedure(spec.signature);
    if fn is null or not exists(select 1 from pg_proc where oid=fn and proowner=foundation
      and prosecdef=spec.definer) then return false; end if;
    allowed := array[foundation] || array(select to_regrole(x)::oid from unnest(spec.callers) x);
    if exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=fn and (not a.grantee=any(allowed) or (a.grantee<>foundation and a.is_grantable)))
      or exists(select 1 from unnest(spec.callers) r where not has_function_privilege(r,fn,'EXECUTE'))
      or exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','myth_v23_parent_prod',
        'myth_v23_authorizer','myth_v23_executor') and not r.rolname=any(spec.callers)
        and has_function_privilege(r.oid,fn,'EXECUTE')) then return false; end if;
  end loop;
  execute 'select count(*)=1 and coalesce(bool_and(singleton and octet_length(key)=32),false)
    from v23_private.prod_session_mac' into complete;
  return coalesce(complete,false);
exception when others then return false;
end $$;
revoke all on function v23_private.prod_session_authority_ready() from public,anon,authenticated;
grant execute on function v23_private.prod_session_authority_ready() to myth_v23_authorizer;
reset role;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

create or replace function v23_private.prod_ports_ready() returns boolean
language plpgsql security invoker set search_path=pg_catalog as $$
declare complete boolean;
begin
  if current_user<>'myth_v23_authorizer' then return false; end if;
  if exists(select 1 from unnest(array[
    'v23_private.prod_confirmation(text,text,jsonb)',
    'v23_private.prod_session_bind(uuid,uuid,bigint,bytea)',
    'v23_private.prod_session_live(uuid,uuid)',
    'v23_private.prod_session_authority_ready()',
    'v23_private.prod_move_binding()',
    'v23_private.prod_projects(uuid,uuid)',
    'v23_private.prod_saved(uuid,uuid)',
    'v23_private.prod_issue_context(jsonb,uuid,uuid)']) f
    where to_regprocedure(f) is null or not has_function_privilege(current_user,f,'EXECUTE')) then return false; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname||'.'||c.relname in ('v23_private.prod_transport_records','v23_private.browser_confirmations',
    'v23_private.transaction_authority','ops.v23_profile_runtime_records','ops.v23_profile_runtime_quota')
    and c.relrowsecurity and c.relforcerowsecurity)<>5 then return false; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relname in ('users','sessions')
      and has_table_privilege(current_user,c.oid,'SELECT')) then return false; end if;
  if not exists(select 1 from pg_roles where rolname='myth_v23_parent_prod'
    and rolcanlogin and not (rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
    or (select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid
      where m.member=to_regrole('myth_v23_parent_prod') and r.rolname in ('myth_v23_authorizer','myth_v23_executor')
      and m.set_option and not m.inherit_option and not m.admin_option)<>2
    or exists(select 1 from pg_auth_members where member=to_regrole('myth_v23_parent_prod')
      and roleid not in (to_regrole('myth_v23_authorizer'),to_regrole('myth_v23_executor')))
    or exists(select 1 from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor','myth_v23_foundation')
      and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
    or exists(select 1 from pg_auth_members where member in (to_regrole('myth_v23_authorizer'),to_regrole('myth_v23_executor')))
    then return false; end if;
  execute $pin$select count(*)=1 and coalesce(bool_and(singleton
    and project_ref='qvvxvbcdmbjzrgvwjatw' and version='v23-parent-wiring/1'
    and ask_origin='https://www.asktrusthub.com' and move_origin='https://www.movetrusthub.com'),false)
    from v23_private.prod_deployment_pin$pin$ into complete;
  if not coalesce(complete,false) then return false; end if;
  return v23_private.prod_session_authority_ready();
exception when others then return false;
end $$;
revoke all on function v23_private.prod_ports_ready() from public,anon,authenticated;
grant execute on function v23_private.prod_ports_ready() to myth_v23_authorizer;
-- END SHARED SESSION READINESS CONTRACT
do $$ begin raise notice 'V23_PROD_PORTS_FORWARD_APPLIED'; end $$;
commit;
