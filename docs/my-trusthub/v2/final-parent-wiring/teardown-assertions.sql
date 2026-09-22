-- PREPARED ONLY. Read-only verification AFTER separately authorized lifecycle
-- retirement and parent teardown. Requires the SAME operator session/baselines.
-- Pin isolated host independently. Failures do not authorize repairs/deletions.
begin isolation level serializable read only;
set local row_security=off;
do $$
declare security_now jsonb; t record; total bigint; fingerprint text;
 b jsonb; e jsonb; prior record; retired record;
begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
   or current_setting('v23.binding_retirement_authorized',true) is distinct from 'true'
   or current_setting('v23.parent_teardown_authorized',true) is distinct from 'true' then
   raise exception 'Separate isolated closeout authorization required'; end if;
 if to_regclass('pg_temp.v23_closeout_security') is null or to_regclass('pg_temp.v23_closeout_origins') is null
   or to_regclass('pg_temp.v23_closeout_research') is null or to_regclass('pg_temp.v23_closeout_identity') is null
   or to_regclass('pg_temp.v23_closeout_retirement') is null then
   raise exception 'Same-session before/retirement evidence missing'; end if;
 if exists(select 1 from pg_roles where rolname in ('myth_v23_parent_preview','myth_v23_preview_reader')) then
   raise exception 'Preview login/reader role remains'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='v23_private' and p.proname like 'preview_%') then
   raise exception 'Preview-specific wrapper remains'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='v23_private' and c.relname like 'preview_%') then
   raise exception 'Preview transport/pin/baseline object remains'; end if;
 if exists(select 1 from pg_policy where polname in ('preview_exact_live_session',
     'preview_exact_move_binding','preview_exact_move_entity','preview_pin_read',
     'preview_transport_exact_key','preview_transport_cleanup')) then
   raise exception 'Preview-only policy remains'; end if;
 select jsonb_object_agg(object_key,state) into security_now from (
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
 select 'defaults:'||d.defaclrole||':'||d.defaclnamespace||':'||d.defaclobjtype,d.defaclrole,d.defaclacl
 from pg_default_acl d
 union all
 select 'database:'||datname,datdba,coalesce(datacl,acldefault('d',datdba))
 from pg_database where datname=current_database()
), inventory as (
 select object_key,jsonb_build_object('owner',owner_id,'acl',coalesce(
   (select jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type,a.is_grantable)
     from aclexplode(acl) a),'[]'::jsonb)) state from objects
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
select object_key,state from inventory
 ) current_inventory;
 if security_now is distinct from
   (select jsonb_object_agg(object_key,state) from pg_temp.v23_closeout_security) then
   raise exception 'Role attributes, memberships, ownership or grants differ from original baseline'; end if;
 if (select count(*) from pg_temp.v23_closeout_origins)<>2
   or (select count(distinct hub_key) from pg_temp.v23_closeout_origins where hub_key in ('ask','move'))<>2
   or exists(select 1 from (select * from ops.consumer_hub_registry where hub_key in ('ask','move')) r
     full join pg_temp.v23_closeout_origins b using(hub_key)
     where r.hub_key is null or b.hub_key is null or r.staging_origins is distinct from b.staging_origins) then
   raise exception 'Ask/Move staging origins were not restored exactly'; end if;
 if not exists(select 1 from pg_temp.v23_closeout_research where object_name='consumer.consumer_saved_entities')
   or not exists(select 1 from pg_temp.v23_closeout_research where object_name='consumer.consumer_projects')
   or not exists(select 1 from pg_temp.v23_closeout_research where object_name='consumer.consumer_project_saved_entities')
   or not exists(select 1 from pg_temp.v23_closeout_research where object_name='ops.v23_profile_runtime_records') then
   raise exception 'Research/receipt preservation baseline incomplete'; end if;
 for t in select * from pg_temp.v23_closeout_research loop
   if to_regclass(t.object_name) is null then raise exception 'Protected research table missing: %',t.object_name; end if;
   execute format('select count(*),encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text,''sha256''),''hex'') from %s t',
     t.object_name) into total,fingerprint;
   if total is distinct from t.row_count or fingerprint is distinct from t.fingerprint then
     raise exception 'Protected research/receipt rows changed: %',t.object_name; end if;
 end loop;
 select * into strict prior from pg_temp.v23_closeout_identity;
 select * into strict retired from pg_temp.v23_closeout_retirement;
 if retired.binding_id::text is distinct from prior.binding_before->>'id'
   or retired.network_entity_id::text is distinct from prior.entity_before->>'id'
   or retired.binding_id is distinct from nullif(current_setting('v23.binding_id',true),'')::uuid
   or retired.network_entity_id is distinct from nullif(current_setting('v23.network_entity_id',true),'')::uuid then
   raise exception 'Retirement witness differs from forward IDs'; end if;
 select to_jsonb(x) into strict b from network.network_entity_bindings x where id=retired.binding_id;
 select to_jsonb(x) into strict e from network.network_entities x where id=retired.network_entity_id;
 if b-'valid_to'-'updated_at' is distinct from prior.binding_before-'valid_to'-'updated_at'
   or e-'status'-'updated_at' is distinct from prior.entity_before-'status'-'updated_at'
   or prior.binding_before->>'valid_to' is not null or prior.binding_before->>'binding_status' is distinct from 'accepted'
   or prior.entity_before->>'status' is distinct from 'active'
   or (b->>'valid_to')::timestamptz is distinct from retired.retired_at
   or retired.retired_at<=(b->>'valid_from')::timestamptz
   or retired.retired_at>statement_timestamp() or e->>'status' is distinct from 'retired' then
   raise exception 'Historical binding/entity lifecycle differs from authorized retirement'; end if;
 if exists(select 1 from network.network_entity_redirects
   where from_entity_id=retired.network_entity_id or to_entity_id=retired.network_entity_id) then
   raise exception 'Retired identity was merged/redirected'; end if;
 if exists(select 1 from network.network_entity_bindings other where other.id<>retired.binding_id and
   (other.network_entity_id=retired.network_entity_id or other.hub='move' and other.specialist_entity_id='usdot-1002530'
    or other.identifier_namespace='fmcsa.usdot' and other.source_identifier_normalized='1002530')) then
   raise exception 'Competing binding after retirement'; end if;
 if exists(select 1 from network.network_entities other where other.id<>retired.network_entity_id and other.primary_hub='move'
   and (other.canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC'
     or other.canonical_public_profile_ref='/companies/hindman-isaacs-moving-storage-inc')) then
   raise exception 'Competing canonical identity after retirement'; end if;
end $$;
select 'V23_PARENT_PACKET_TEARDOWN_ASSERTIONS_PASS' as result;
commit;
