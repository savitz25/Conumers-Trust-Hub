-- MY TRUSTHUB V2 PRODUCTION HANDOFF — HINDMAN CANARY BINDING (CONDITIONAL).
-- Run ONLY when 00-ask-prod-preflight reported "Hindman network entity/binding
-- present" = false. If it reported true, skip this file: the existing accepted
-- production binding is used as-is and nothing is upserted or merged.
-- The operator's SET-capable myth_identity_governor membership is temporary for
-- this transaction and must be revoked immediately after COMMIT.
-- Fresh PUBLISHABLE proof: the public profile
-- https://www.movetrusthub.com/companies/hindman-isaacs-moving-storage-inc must
-- have been read within two minutes of apply, showing exactly one Company,
-- USDOT 1002530, MC 421784, PUBLISHABLE. Record the evidence ref below.
begin isolation level serializable;
set local statement_timeout='15s';
set local lock_timeout='3s';
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw'
    or current_setting('v23.binding_creation_authorized',true) is distinct from 'true' then
   raise exception 'Separate production binding mutation authorization required'; end if;
 if nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz is null
    or nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz < clock_timestamp()-interval '2 minutes'
    or nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz > clock_timestamp()
    or current_setting('v23bind.candidate_unchanged',true) is distinct from 'true'
    or nullif(current_setting('v23bind.evidence_ref',true),'') is null then
   raise exception 'Fresh PUBLISHABLE exact-identity source proof required'; end if;
end $$;
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
 current_setting('v23bind.evidence_ref'),'My TrustHub V2 production canary; canonical organization, Move mover, exact USDOT 1002530 / MC 421784. Fresh PUBLISHABLE proof checked by approved operator.' from entity
returning id as binding_id,network_entity_id,provenance_ref;
commit;
-- Immediately after COMMIT, revoke the temporary operator SET membership:
--   revoke myth_identity_governor from <operator> granted by <operator>;
-- Retain the returned binding_id / network_entity_id / provenance_ref in the
-- operator ledger. Never rediscover by name alone.
