-- PREPARED ONLY. Requires separate authorization for xkkiicsassizmakcvxml.
-- Runner MUST pin the remote project/host outside SQL. This GUC is an operator
-- attestation, not proof of host identity. Never execute through production.
begin;
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
    raise exception 'Explicit isolated apply authorization required';
  end if;
end $$;

-- Snapshot BEFORE any preview grant/role changes. Contains ACLs/attributes only,
-- never passwords. Dropped by teardown after copying into the operator session.
do $$ begin
 if (select count(*) from ops.consumer_hub_registry where hub_key in ('ask','move'))<>2
   or exists(select 1 from pg_roles where rolname in ('myth_v23_parent_preview','myth_v23_preview_reader'))
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='v23_private' and p.proname like 'preview_%')
   or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='v23_private' and c.relname like 'preview_%') then
   raise exception 'Clean preview packet preconditions required'; end if;
 if has_any_column_privilege('myth_v23_foundation','auth.sessions','SELECT')
   or has_schema_privilege('myth_v23_foundation','v23_private','CREATE')
   or has_schema_privilege('myth_v23_browser_store','v23_private','CREATE')
   or has_function_privilege('myth_v23_foundation','consumer.list_cross_hub_project_summaries(integer)','EXECUTE')
   or has_function_privilege('myth_v23_foundation','consumer.list_saved_entities()','EXECUTE')
   or has_function_privilege('myth_v23_foundation','ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text)','EXECUTE')
   or has_function_privilege('myth_v23_foundation','ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text)','EXECUTE') then
   raise exception 'Preview grant already present; reviewed clean base required'; end if;
end $$;
create table v23_private.preview_security_before as
with objects as (
 select 'relation:'||n.nspname||'.'||c.relname object_key,c.relowner owner_id,
   coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner)) acl
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('auth','consumer','ops','network','v23_private','public') and c.relkind in ('r','p','v','m','f','S')
   and not (n.nspname='v23_private' and c.relname like 'preview_%')
 union all
 select 'column:'||n.nspname||'.'||c.relname||'.'||a.attname,c.relowner,coalesce(a.attacl,'{}'::aclitem[])
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('auth','consumer','ops','network','v23_private','public') and c.relkind in ('r','p','v','m','f')
   and a.attnum>0 and not a.attisdropped and not (n.nspname='v23_private' and c.relname like 'preview_%')
 union all
 select 'function:'||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
   p.proowner,coalesce(p.proacl,acldefault('f',p.proowner))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('auth','consumer','ops','network','v23_private','public')
   and not (n.nspname='v23_private' and p.proname like 'preview_%')
 union all
 select 'schema:'||n.nspname,n.nspowner,coalesce(n.nspacl,acldefault('n',n.nspowner))
 from pg_namespace n where n.nspname in ('auth','consumer','ops','network','v23_private','public')
 union all
 select 'defaults:'||d.defaclrole||':'||d.defaclnamespace||':'||d.defaclobjtype::text,d.defaclrole,d.defaclacl
 from pg_default_acl d
 union all
 select 'database:'||datname,datdba,coalesce(datacl,acldefault('d',datdba))
 from pg_database where datname=current_database()
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
revoke all on v23_private.preview_security_before from public,anon,authenticated;
alter table v23_private.preview_security_before enable row level security;
alter table v23_private.preview_security_before force row level security;

create table v23_private.preview_deployment_pin (
  singleton boolean primary key default true check(singleton),
  project_ref text not null check(project_ref='xkkiicsassizmakcvxml'),
  version text not null check(version='v23-parent-wiring/1'),
  ask_origin text not null,
  move_origin text not null
);
insert into v23_private.preview_deployment_pin values(true,'xkkiicsassizmakcvxml','v23-parent-wiring/1',
 'https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app',
 'https://move-trust-hub-git-mth-v2-3-move-par-71a0b3-savitz25-s-projects.vercel.app');
alter table v23_private.preview_deployment_pin enable row level security;
alter table v23_private.preview_deployment_pin force row level security;
grant select on v23_private.preview_deployment_pin to myth_v23_authorizer,myth_v23_foundation;
create policy preview_pin_read on v23_private.preview_deployment_pin for select
  to myth_v23_authorizer,myth_v23_foundation using(true);

create table v23_private.preview_transport_records (
  key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp()
);
alter table v23_private.preview_transport_records enable row level security;
alter table v23_private.preview_transport_records force row level security;
grant select,insert,update on v23_private.preview_transport_records to myth_v23_authorizer;
create policy preview_transport_exact_key on v23_private.preview_transport_records to myth_v23_authorizer
  using(key_hash=current_setting('v23.transport_key',true))
  with check(key_hash=current_setting('v23.transport_key',true));
create index preview_transport_expiry on v23_private.preview_transport_records(expires_at);
grant select,delete on v23_private.preview_transport_records to myth_v23_cleanup;
create policy preview_transport_cleanup on v23_private.preview_transport_records to myth_v23_cleanup
  using(expires_at < statement_timestamp()-interval '1 hour');

-- No LOGIN membership in browser_store. Its existing exact-cookie RLS remains.
create function v23_private.preview_confirmation(action text,key text,value jsonb default null) returns jsonb
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
revoke all on function v23_private.preview_confirmation(text,text,jsonb) from public,anon,authenticated;
grant execute on function v23_private.preview_confirmation(text,text,jsonb) to myth_v23_authorizer;
grant create on schema v23_private to myth_v23_browser_store;
grant myth_v23_browser_store to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.preview_confirmation(text,text,jsonb) owner to myth_v23_browser_store;
revoke create on schema v23_private from myth_v23_browser_store;
revoke myth_v23_browser_store from current_user granted by current_user;

-- Narrow session predicate. No auth table access is granted to the login,
-- authorizer or executor; the private foundation sees only three columns.
grant select(id,user_id,not_after) on auth.sessions to myth_v23_foundation;
create policy preview_exact_live_session on auth.sessions for select to myth_v23_foundation
 using(id::text=current_setting('v23.session_id',true) and user_id::text=current_setting('v23.session_subject',true));
create function v23_private.preview_session_live(subject uuid,session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,auth as $$
begin
 perform set_config('v23.session_id',session::text,true);
 perform set_config('v23.session_subject',subject::text,true);
 return exists(select 1 from auth.sessions s where s.id=session and s.user_id=subject
   and (s.not_after is null or s.not_after>statement_timestamp()));
end;
$$;
revoke all on function v23_private.preview_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_session_live(uuid,uuid) to myth_v23_authorizer,myth_v23_executor;

-- The sole approved public binding; no arbitrary identity lookup or enumeration.
-- A nonlogin wrapper owner avoids invoking the foundation's transaction-capability
-- policies outside a Save transaction. The LOGIN gets no membership in this role.
create role myth_v23_preview_reader nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
grant usage on schema network,v23_private to myth_v23_preview_reader;
grant select on network.network_entities,network.network_entity_bindings to myth_v23_preview_reader;
create policy preview_exact_move_binding on network.network_entity_bindings for select to myth_v23_preview_reader
 using(hub='move' and specialist_entity_type='mover' and specialist_entity_id='usdot-1002530'
   and identifier_namespace='fmcsa.usdot' and source_identifier='1002530' and jurisdiction='US');
create policy preview_exact_move_entity on network.network_entities for select to myth_v23_preview_reader
 using(entity_type='organization' and canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC'
   and primary_hub='move' and jurisdiction='US' and status='active');
create function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text)
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
revoke all on function v23_private.preview_move_binding() from public,anon,authenticated;
grant execute on function v23_private.preview_move_binding() to myth_v23_authorizer,myth_v23_executor;
grant create on schema v23_private to myth_v23_preview_reader;
grant myth_v23_preview_reader to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.preview_move_binding() owner to myth_v23_preview_reader;
revoke create on schema v23_private from myth_v23_preview_reader;
revoke myth_v23_preview_reader from current_user granted by current_user;

grant execute on function consumer.list_cross_hub_project_summaries(integer) to myth_v23_foundation;
create function v23_private.preview_projects(subject uuid,session uuid) returns table(project_id uuid,name text)
language plpgsql security definer set search_path=pg_catalog,v23_private,consumer as $$
begin
 if not v23_private.preview_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',subject::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject)::text,true);
 return query select p.project_id,p.name from consumer.list_cross_hub_project_summaries(25) p where p.status='active';
end $$;
revoke all on function v23_private.preview_projects(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_projects(uuid,uuid) to myth_v23_authorizer;

grant execute on function consumer.list_saved_entities() to myth_v23_foundation;
create function v23_private.preview_saved(subject uuid,session uuid) returns table(saved_entity_id uuid,canonical_name text,primary_hub text,saved_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,v23_private,consumer as $$
begin
 if not v23_private.preview_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',subject::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject)::text,true);
 return query select s.saved_entity_id,s.canonical_name,s.primary_hub,s.saved_at from consumer.list_saved_entities() s where s.removed_at is null;
end $$;
revoke all on function v23_private.preview_saved(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_saved(uuid,uuid) to myth_v23_authorizer;

grant execute on function ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text),
 ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text) to myth_v23_foundation;
create function v23_private.preview_issue_context(proof jsonb,subject uuid,session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $$
declare pin v23_private.preview_deployment_pin%rowtype;
begin
 if not v23_private.preview_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 select * into strict pin from v23_private.preview_deployment_pin where singleton;
 if proof->>'targetOrigin' is distinct from pin.ask_origin then raise exception 'origin' using errcode='42501'; end if;
 if not coalesce(proof->>'code' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'state' ~ '^[A-Za-z0-9_-]{43}$'
   and proof->>'nonce' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'intent' ~ '^[A-Za-z0-9_-]{43}$',false)
   then raise exception 'proof' using errcode='42501'; end if;
 perform ops.create_browser_handoff_intent('auth',proof->>'intent','ask',pin.ask_origin,'/my/profile-save',
   proof->>'state',proof->>'nonce','staging',proof->>'rateBucket');
 perform ops.create_consumer_auth_handoff(proof->>'code',subject,'move',pin.move_origin,proof->>'intent',
   (proof->>'creationKey')::uuid,proof->>'rateBucket');
 return true;
end $$;
revoke all on function v23_private.preview_issue_context(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_issue_context(jsonb,uuid,uuid) to myth_v23_authorizer;

-- Set ACL before owner transfer, then remove only temporary operator membership.
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.preview_session_live(uuid,uuid) owner to myth_v23_foundation;
alter function v23_private.preview_projects(uuid,uuid) owner to myth_v23_foundation;
alter function v23_private.preview_saved(uuid,uuid) owner to myth_v23_foundation;
alter function v23_private.preview_issue_context(jsonb,uuid,uuid) owner to myth_v23_foundation;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

-- Isolated P13 registry change is separate from application environment values.
-- Preserve the old arrays for precise teardown; do not touch production origins.
create table v23_private.preview_registry_before as
 select hub_key,staging_origins from ops.consumer_hub_registry where hub_key in ('ask','move');
revoke all on v23_private.preview_registry_before from public,anon,authenticated;
alter table v23_private.preview_registry_before enable row level security;
alter table v23_private.preview_registry_before force row level security;
update ops.consumer_hub_registry set staging_origins=case hub_key
 when 'ask' then array['https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app']
 when 'move' then array['https://move-trust-hub-git-mth-v2-3-move-par-71a0b3-savitz25-s-projects.vercel.app'] end
 where hub_key in ('ask','move');

create function v23_private.preview_ports_ready() returns boolean
language sql stable security invoker set search_path=pg_catalog as $$
 select current_user='myth_v23_authorizer'
 and not exists(select 1 from unnest(array[
  'v23_private.preview_confirmation(text,text,jsonb)',
  'v23_private.preview_session_live(uuid,uuid)',
  'v23_private.preview_move_binding()',
  'v23_private.preview_projects(uuid,uuid)',
  'v23_private.preview_saved(uuid,uuid)',
  'v23_private.preview_issue_context(jsonb,uuid,uuid)']) f
  where to_regprocedure(f) is null or not has_function_privilege(current_user,f,'EXECUTE'))
 and (select count(*)=5 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname||'.'||c.relname in ('v23_private.preview_transport_records','v23_private.browser_confirmations',
  'v23_private.transaction_authority','ops.v23_profile_runtime_records','ops.v23_profile_runtime_quota')
  and c.relrowsecurity and c.relforcerowsecurity)
 and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='auth' and c.relname in ('users','sessions') and has_table_privilege(current_user,c.oid,'SELECT'));
$$;
revoke all on function v23_private.preview_ports_ready() from public,anon,authenticated;
grant execute on function v23_private.preview_ports_ready() to myth_v23_authorizer;
commit;
