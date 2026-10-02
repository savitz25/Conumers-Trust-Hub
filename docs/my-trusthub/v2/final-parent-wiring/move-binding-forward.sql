-- PREPARED, NOT AUTHORIZED TO EXECUTE. Only xkkiicsassizmakcvxml.
-- The operator's SET-capable myth_identity_governor membership is temporary for
-- this Phase-4 transaction and must be revoked immediately after COMMIT. Phase
-- 5 accepts only the known platform bookkeeping row with SET/INHERIT false (or
-- zero such rows on local PostgreSQL).
-- Live preview recheck 2026-09-22T13:39:03.154Z: HTTP 200, Vercel MISS, age 0,
-- exactly one Company: usdot-1002530, USDOT 1002530, MC 421784, PUBLISHABLE.
-- This evidence EXPIRES. Repeat the documented read within two minutes of apply.
begin isolation level serializable;
set local statement_timeout='15s';
set local lock_timeout='3s';
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
    or current_setting('v23.binding_creation_authorized',true) is distinct from 'true' then
   raise exception 'Separate isolated binding mutation authorization required'; end if;
 if nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz is null
    or nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz < clock_timestamp()-interval '2 minutes'
    or nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz > clock_timestamp()
    or current_setting('v23bind.candidate_unchanged',true) is distinct from 'true'
    or nullif(current_setting('v23bind.evidence_ref',true),'') is null then
   raise exception 'Fresh PUBLISHABLE exact-identity source proof required'; end if;
end $$;
-- The operator must independently pin the host before setting attestations.
set local role myth_identity_governor;
lock table network.network_entities,network.network_entity_bindings in share row exclusive mode;
do $$ begin
 if exists(select 1 from network.network_entity_bindings where
    (hub='move' and specialist_entity_id='usdot-1002530' or identifier_namespace='fmcsa.usdot' and source_identifier_normalized='1002530'))
    or exists(select 1 from network.network_entities where primary_hub='move' and
      (canonical_name='HINDMAN & ISAACS MOVING & STORAGE INC' or canonical_public_profile_ref='/companies/hindman-isaacs-moving-storage-inc')) then
   raise exception 'Existing identity requires steward review; no upsert or inferred merge'; end if;
end $$;
with entity as (
 insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
 values('organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US','/companies/hindman-isaacs-moving-storage-inc','active') returning id
)
insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
 identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref,resolution_note)
select id,'move','mover','usdot-1002530','fmcsa.usdot','1002530','US','accepted',transaction_timestamp(),
 current_setting('v23bind.evidence_ref'),'V2-3 isolated test only; canonical organization, Move mover, exact USDOT 1002530 / MC 421784. Fresh PUBLISHABLE proof checked by approved runner.' from entity
returning id as binding_id,network_entity_id,provenance_ref;
commit;
-- Retain these exact returned IDs and provenance in the approved operator
-- record. Supply them to assertions/retirement; never rediscover by name alone.
