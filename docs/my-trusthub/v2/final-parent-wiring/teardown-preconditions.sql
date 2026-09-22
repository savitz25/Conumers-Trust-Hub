-- PREPARED ONLY. Separate teardown/retirement authority; no host proof in GUCs.
-- Stop preview ingress and all other writers/cleanup jobs; drain runtime sessions.
-- Independently pin the isolated host. Keep this SAME operator connection through
-- move-binding-teardown.sql, teardown.sql and teardown-assertions.sql.
-- Baselines are session-local and private. No research/credential values printed.
begin isolation level serializable;
set local row_security=off;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
   or current_setting('v23.binding_retirement_authorized',true) is distinct from 'true'
   or current_setting('v23.parent_teardown_authorized',true) is distinct from 'true'
   or current_setting('v23.closeout_writers_drained',true) is distinct from 'true' then
   raise exception 'Explicit isolated retirement/teardown and drained-writer attestations required'; end if;
 if exists(select 1 from pg_stat_activity where usename='myth_v23_parent_preview') then
   raise exception 'Drain runtime login first'; end if;
 if (select count(*) from v23_private.preview_registry_before)<>2
   or (select count(distinct hub_key) from v23_private.preview_registry_before where hub_key in ('ask','move'))<>2
   or not exists(select 1 from v23_private.preview_security_before where object_key='role:myth_v23_authorizer') then
   raise exception 'Original activation baseline missing'; end if;
end $$;
create temp table v23_closeout_security on commit preserve rows as
 select * from v23_private.preview_security_before;
create temp table v23_closeout_origins on commit preserve rows as
 select * from v23_private.preview_registry_before;
-- Retain platform presence/object ACLs across the separately authorized rollback.
create temp table v23_closeout_platform_acl on commit preserve rows as
 select to_regnamespace('net') is not null net_present,(select jsonb_agg(to_jsonb(x) order by kind,object_id) from (
 select 'relation' kind,c.oid object_id,c.relowner owner_id,c.relacl::text acl
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='net'
 union all
 select 'function',p.oid,p.proowner,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net'
) x) net_objects;
create temp table v23_closeout_identity on commit preserve rows as
 select to_jsonb(b) binding_before,to_jsonb(e) entity_before
 from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id
 where b.id=nullif(current_setting('v23.binding_id',true),'')::uuid
   and e.id=nullif(current_setting('v23.network_entity_id',true),'')::uuid
   and b.provenance_ref=nullif(current_setting('v23.binding_provenance_ref',true),'');
do $$ begin
 if (select count(*) from pg_temp.v23_closeout_identity)<>1 then
   raise exception 'Exact approved forward IDs/provenance required'; end if;
end $$;
create temp table v23_closeout_research(object_name text primary key,row_count bigint,fingerprint text) on commit preserve rows;
-- Protect ALL consumer tables, all ops tables except the origin registry and
-- quota counters, and original durable browser confirmations. Preserve even
-- unrelated research; do not merely compare counts or a selected receipt.
do $$ declare t record; total bigint; fingerprint text; begin
 for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relkind in ('r','p') and (n.nspname='consumer'
     or n.nspname='ops' and c.relname not in ('consumer_hub_registry','v23_profile_runtime_quota')
     or n.nspname='v23_private' and c.relname='browser_confirmations')
   order by n.nspname,c.relname loop
   execute format('lock table %I.%I in share mode',t.nspname,t.relname);
   execute format('select count(*),encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text,''sha256''),''hex'') from %I.%I t',
     t.nspname,t.relname) into total,fingerprint;
   insert into pg_temp.v23_closeout_research values(format('%I.%I',t.nspname,t.relname),total,fingerprint);
 end loop;
 if not exists(select 1 from pg_temp.v23_closeout_research where object_name='consumer.consumer_saved_entities')
   or not exists(select 1 from pg_temp.v23_closeout_research where object_name='consumer.consumer_projects')
   or not exists(select 1 from pg_temp.v23_closeout_research where object_name='consumer.consumer_project_saved_entities')
   or not exists(select 1 from pg_temp.v23_closeout_research where object_name='ops.v23_profile_runtime_records') then
   raise exception 'Required research/receipt tables missing from preservation baseline'; end if;
end $$;
revoke all on pg_temp.v23_closeout_security,pg_temp.v23_closeout_origins,
 pg_temp.v23_closeout_identity,pg_temp.v23_closeout_research from public,anon,authenticated;
revoke all on pg_temp.v23_closeout_platform_acl from public,anon,authenticated;
commit;
-- Locks end at commit. Keep writers quiescent throughout the entire closeout.
-- Any concurrent change makes post-teardown assertions fail; do not recapture
-- the baseline after a failed teardown to hide missing or changed research.
