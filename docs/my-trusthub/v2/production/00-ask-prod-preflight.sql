-- MY TRUSTHUB V2 PRODUCTION HANDOFF — ASK PREFLIGHT (READ-ONLY).
-- Target: canonical consumer/Auth project qvvxvbcdmbjzrgvwjatw, database postgres.
-- Run as the operator (postgres). Nothing here mutates. Every row must read
-- as noted before 01..06 are applied. Pin the project ref OUTSIDE SQL first.
select 'P11/P12/P13 present' as check_name,
  to_regprocedure('consumer.save_entity(uuid,text,jsonb)') is not null
  and to_regprocedure('consumer.list_saved_entities()') is not null
  and to_regprocedure('consumer.remove_saved_entity(uuid,bigint)') is not null
  and to_regprocedure('consumer.list_cross_hub_project_summaries(integer)') is not null
  and to_regprocedure('ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text)') is not null
  and to_regprocedure('ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text)') is not null as ok -- expect true
union all
select 'extensions.hmac available', to_regprocedure('extensions.hmac(bytea,bytea,text)') is not null -- expect true
union all
select 'v23 foundation ABSENT (01 not yet applied)',
  to_regnamespace('v23_private') is null and to_regclass('ops.v23_profile_runtime_records') is null
  and not exists(select 1 from pg_roles where rolname like 'myth_v23_%') -- expect true before 01, false after
union all
select 'prod_* objects ABSENT (02 not yet applied)',
  not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='v23_private' and p.proname like 'prod_%')
  and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='v23_private' and c.relname like 'prod_%')
  and not exists(select 1 from pg_roles where rolname in ('myth_v23_parent_prod','myth_v23_prod_reader')) -- expect true before 02
union all
select 'registry has ask+move rows',
  (select count(*) from ops.consumer_hub_registry where hub_key in ('ask','move'))=2 -- expect true
union all
select 'registry production origins carry the canonical pair',
  exists(select 1 from ops.consumer_hub_registry where hub_key='ask' and 'https://www.asktrusthub.com'=any(production_origins))
  and exists(select 1 from ops.consumer_hub_registry where hub_key='move' and 'https://www.movetrusthub.com'=any(production_origins)) -- expect true; if false, stop and review P13 registry
union all
select 'Hindman network entity/binding present (decides 03)',
  exists(select 1 from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id
    where b.hub='move' and b.specialist_entity_type='mover' and b.specialist_entity_id='usdot-1002530'
      and b.identifier_namespace='fmcsa.usdot' and b.source_identifier='1002530' and b.jurisdiction='US'
      and b.binding_status='accepted' and e.status='active' and e.entity_type='organization'
      and e.canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC') -- true: skip 03; false: run 03
union all
select 'no conflicting Hindman identity (if 03 is needed)',
  not exists(select 1 from network.network_entity_bindings where hub='move' and specialist_entity_id='usdot-1002530')
  and not exists(select 1 from network.network_entities where primary_hub='move' and canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC')
  or exists(select 1 from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id
    where b.hub='move' and b.specialist_entity_id='usdot-1002530' and b.binding_status='accepted' and e.status='active') -- expect true
union all
select 'identity governor role exists (needed by 03)', to_regrole('myth_identity_governor') is not null -- expect true if 03 is needed
union all
select 'pg_net present (informational; production gate is privilege-based)',
  exists(select 1 from pg_extension where extname='pg_net') or to_regnamespace('net') is not null;

-- Record the output with the operator ledger. Secrets never appear here.
