-- MY TRUSTHUB V2 PRODUCTION — ONE MOVE MOVER BINDING (PREFLIGHT + CONDITIONAL FORWARD, operator).
-- Target qvvxvbcdmbjzrgvwjatw. Run ONCE PER MOVER, only for a mover whose
-- preflight below reports no existing identity. This is the same governed
-- creation as 03-ask-prod-move-binding-forward.sql (Hindman), parameterised.
-- It creates exactly one network entity and one accepted binding and touches
-- no other row. It is NOT a bulk loader and must not be looped over a list
-- that nobody read.
--
-- A Move mover without exactly one accepted binding is simply not eligible for
-- a My TrustHub Save: the device Save still works and account sync fails
-- closed. So this file is needed only for movers that are to be made eligible.
--
-- Widening canary movers (Hindman already has its binding; do NOT re-run it):
--   usdot 373544  | GENTLE GIANT INTERSTATE COMPANY LLC | gentle-giant-moving | MC 228137
--   usdot 1684331 | CARAWAY MOVING INC                  | caraway-moving-inc  | MC 618833
--
-- ---------------------------------------------------------------------------
-- STEP 1 — PREFLIGHT (read-only). Set the mover, then run this block alone.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.usdot','373544',false);
--   select set_config('v23bind.legal_name','GENTLE GIANT INTERSTATE COMPANY LLC',false);
--   select set_config('v23bind.slug','gentle-giant-moving',false);
-- Expected for a mover that needs STEP 2: existing_bindings = 0 and
-- existing_entities = 0. If either is non-zero STOP: an existing accepted
-- binding is used as-is (nothing to do), and anything else needs steward
-- review. Never upsert, merge or rediscover by name.
select current_setting('v23bind.usdot') as usdot,
  (select count(*) from network.network_entity_bindings b
    where b.hub='move' and (b.specialist_entity_id='usdot-'||current_setting('v23bind.usdot')
      or b.identifier_namespace='fmcsa.usdot' and b.source_identifier_normalized=current_setting('v23bind.usdot'))) as existing_bindings,
  (select count(*) from network.network_entities e
    where e.primary_hub='move' and (e.canonical_name=current_setting('v23bind.legal_name')
      or e.canonical_public_profile_ref='/companies/'||current_setting('v23bind.slug'))) as existing_entities;

-- ---------------------------------------------------------------------------
-- STEP 2 — FORWARD (only when STEP 1 returned 0 / 0).
-- Fresh PUBLISHABLE proof: the public profile
--   https://www.movetrusthub.com/companies/<slug>
-- must have been read within two minutes of apply, showing exactly one
-- Company with this USDOT number, PUBLISHABLE. Record that read as the
-- evidence ref (URL + timestamp). Then, in the same session:
--   select set_config('v23.binding_creation_authorized','true',false);
--   select set_config('v23bind.preflight_checked_at',clock_timestamp()::text,false);
--   select set_config('v23bind.candidate_unchanged','true',false);
--   select set_config('v23bind.evidence_ref','<profile URL + read timestamp>',false);
-- The operator's SET-capable myth_identity_governor membership is temporary
-- for this transaction and must be revoked immediately after COMMIT.
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
 if coalesce(current_setting('v23bind.usdot',true),'') !~ '^[1-9][0-9]{0,8}$'
    or coalesce(current_setting('v23bind.slug',true),'') !~ '^[a-z0-9][a-z0-9-]{0,159}$'
    or char_length(btrim(coalesce(current_setting('v23bind.legal_name',true),''))) not between 2 and 300
    or current_setting('v23bind.legal_name',true) <> btrim(current_setting('v23bind.legal_name',true)) then
   raise exception 'Exact mover identity required: v23bind.usdot, v23bind.slug, v23bind.legal_name'; end if;
end $$;
set local role myth_identity_governor;
lock table network.network_entities,network.network_entity_bindings in share row exclusive mode;
do $$ begin
 if exists(select 1 from network.network_entity_bindings where
    hub='move' and (specialist_entity_id='usdot-'||current_setting('v23bind.usdot')
      or identifier_namespace='fmcsa.usdot' and source_identifier_normalized=current_setting('v23bind.usdot')))
    or exists(select 1 from network.network_entities where primary_hub='move' and
      (canonical_name=current_setting('v23bind.legal_name') or canonical_public_profile_ref='/companies/'||current_setting('v23bind.slug'))) then
   raise exception 'Existing identity requires steward review; no upsert or inferred merge'; end if;
end $$;
with entity as (
 insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
 values('organization',current_setting('v23bind.legal_name'),'move','US','/companies/'||current_setting('v23bind.slug'),'active') returning id
)
insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
 identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref,resolution_note)
select id,'move','mover','usdot-'||current_setting('v23bind.usdot'),'fmcsa.usdot',current_setting('v23bind.usdot'),'US','accepted',transaction_timestamp(),
 current_setting('v23bind.evidence_ref'),'My TrustHub V2 Move widening; canonical organization, Move mover, exact USDOT '||current_setting('v23bind.usdot')||'. Fresh PUBLISHABLE proof checked by approved operator.' from entity
returning id as binding_id,network_entity_id,provenance_ref;
commit;
-- Immediately after COMMIT:
--   revoke myth_identity_governor from <operator> granted by <operator>;
-- Verification marker (requires 09): exactly one row, accepted, same identity.
--   select binding_status,specialist_entity_id,source_identifier,jurisdiction,entity_status
--   from v23_private.prod_move_binding_for('usdot-'||current_setting('v23bind.usdot'));
-- Clear the per-mover settings before the next mover:
--   select set_config('v23.binding_creation_authorized','',false), set_config('v23bind.preflight_checked_at','',false),
--     set_config('v23bind.candidate_unchanged','',false), set_config('v23bind.evidence_ref','',false);
-- Rollback of one mover: never DELETE the entity or the binding (consumer rows
-- may reference them). Retire it the way the reviewed retirement packet does
-- (docs/my-trusthub/v2/final-parent-wiring/move-binding-teardown.sql): under a
-- separately authorised, temporary myth_identity_governor membership, close the
-- validity window of exactly the returned binding,
--   update network.network_entity_bindings set valid_to=clock_timestamp()
--   where id='<binding_id returned above>' and network_entity_id='<network_entity_id returned above>';
-- A binding whose validity has ended is not returned by the resolver, so the
-- mover stops being eligible; existing Saved research is preserved. This
-- per-mover retirement statement has NOT been exercised in the local harness;
-- review it against that packet before use.
