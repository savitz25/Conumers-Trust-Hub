-- MY TRUSTHUB V2 — CONTRACTOR DBPR PREFLIGHT (READ ONLY).
-- Packet 16. Packet 14 is the investor authority packet. Packet 15 is the
-- shared hub account-context packet. This file applies neither, and it does
-- not apply the contractor authority change.
-- Operator session on qvvxvbcdmbjzrgvwjatw.
--
-- Result 1: current binding collision on a canonical specialist id, on the
-- same logical specialist id under any namespace, on the same normalized DBPR
-- key under fl.dbpr.license, or on that normalized key under another namespace.
-- The specialist id comparison is lower(btrim(specialist_entity_id)). The key
-- is source_identifier_normalized, lower(btrim(source_identifier)). A row holds
-- the binding packet.
-- Result 2: canonical public profile-ref collision on an active entity.
-- A row holds the binding packet.
-- Result 3: ambiguous active ownership (more than one current binding for one
-- logical specialist id, or more than one active entity for one profile ref).
-- The specialist id is lower(btrim(specialist_entity_id)). A row holds the binding packet.
-- Result 4: review_required conflict on the exact contractor contract.
-- A row holds the binding packet.
-- Result 5: authority status of v23_private.authority(). Always one row.
-- Read only. It does not apply 16-ask-prod-contractor-authority-forward.sql
-- and it does not instruct the operator to apply that file. Packet 19 is the
-- only production authority transition.
-- BASELINE_NO_AUTHORITY_CONFLICT: hubs move, insurance, lender. No authority
-- conflict. Packet 19 is the future authority step.
-- NETWORK_AUTHORITY_FINAL: the packet 19 six-hub body with contractor_profile
-- and fl.dbpr.license. Network authority is final and ready. Packet 16
-- authority is not missing.
-- LEGACY_PACKET16_AUTHORITY_HOLD: the old packet 16 contractor authority body.
-- HOLD. Converge on packet 19. Do not re-apply packet 16 authority.
-- UNKNOWN_AUTHORITY_HOLD: any other body, including a missing function.
-- HOLD. STOP. No mutation.
-- A HOLD is not a silent skip.
--
-- Do not apply the binding packet while result 1, 2, 3, or 4 has a row.
-- This file does not insert, update, or delete. It does not match names.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);

select specialist_entity_id, identifier_namespace, source_identifier, binding_status,
       count(*) as rows
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and (
     specialist_entity_id in (
       'fl.dbpr.license:CCC057187',
       'fl.dbpr.license:CFC1427249',
       'fl.dbpr.license:CGC1506243'
     )
     or lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1506243')
     or (
       hub = 'contractor'
       and identifier_namespace = 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1506243')
     )
     or (
       identifier_namespace is distinct from 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1506243')
     )
   )
 group by 1, 2, 3, 4
 order by 1, 2, 3;

select id, status, canonical_public_profile_ref
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/contractors/ccc057187-a-r-roofing-inc',
     '/contractors/cfc1427249-a-sunny-plumbing-company',
     '/contractors/cgc1506243-abs-contracting-inc'
   )
 order by canonical_public_profile_ref, id;

select 'binding' as kind, lower(btrim(specialist_entity_id)) as owner_key, count(*) as rows
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1506243')
 group by lower(btrim(specialist_entity_id))
 having count(*) > 1
union all
select 'profile_ref', canonical_public_profile_ref, count(*)
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/contractors/ccc057187-a-r-roofing-inc',
     '/contractors/cfc1427249-a-sunny-plumbing-company',
     '/contractors/cgc1506243-abs-contracting-inc'
   )
 group by canonical_public_profile_ref
 having count(*) > 1
 order by 1, 2;

-- Result 4. A current review_required row on the exact contractor contract
-- is a hold. It is not an accepted binding and it is not a clean preflight.
select specialist_entity_id, identifier_namespace, source_identifier, binding_status
  from network.network_entity_bindings
 where binding_status = 'review_required'
   and (valid_to is null or valid_to > statement_timestamp())
   and (
     specialist_entity_id in (
       'fl.dbpr.license:CCC057187',
       'fl.dbpr.license:CFC1427249',
       'fl.dbpr.license:CGC1506243'
     )
     or lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1506243')
     or (
       hub = 'contractor'
       and identifier_namespace = 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1506243')
     )
   )
 order by specialist_entity_id, identifier_namespace, source_identifier;

-- Result 5. Authority status. Always one row. Read only. No mutation.
-- The six-hub list is not a substring of the packet 16 four-hub list, and the
-- three-hub baseline marker includes the closing parenthesis before audience.
with installed as (
  select coalesce((
    select prosrc from pg_proc where oid = to_regprocedure('v23_private.authority()')
  ), '') as src
), marked as (
  select
    position($t$c->>'hub' in ('move','insurance','lender','investor','contractor','senior')$t$ in src) > 0 as six_hub,
    position($t$c->>'hub' in ('move','insurance','lender','contractor')$t$ in src) > 0 as packet16_hubs,
    position($t$c->>'hub' in ('move','insurance','lender') and c->>'audience'='ask'$t$ in src) > 0 as three_hub,
    position($t$contractor_profile$t$ in src) > 0 as contractor_profile,
    (position($t$fl.dbpr.license$t$ in src) > 0 or position($t$fl\.dbpr\.license$t$ in src) > 0) as dbpr_guard
  from installed
), classed as (
  select case
    when six_hub and contractor_profile and dbpr_guard then 'NETWORK_AUTHORITY_FINAL'
    when packet16_hubs and contractor_profile and dbpr_guard then 'LEGACY_PACKET16_AUTHORITY_HOLD'
    when three_hub and not packet16_hubs and not six_hub then 'BASELINE_NO_AUTHORITY_CONFLICT'
    else 'UNKNOWN_AUTHORITY_HOLD'
  end as disposition
  from marked
)
select disposition,
  case disposition
    when 'NETWORK_AUTHORITY_FINAL' then
      'Network authority final. Ready. The packet 19 six-hub body is installed (move, insurance, lender, investor, contractor, senior) and the contractor guard contractor_profile / fl.dbpr.license is present. Packet 16 authority is not missing. Do not apply 16-ask-prod-contractor-authority-forward.sql.'
    when 'LEGACY_PACKET16_AUTHORITY_HOLD' then
      'HOLD. Legacy packet 16 authority is installed. Converge with packet 19 (19-ask-prod-network-authority-forward.sql). Do not apply 16-ask-prod-contractor-authority-forward.sql. Packet 16 authority rollback is not the production rollback.'
    when 'BASELINE_NO_AUTHORITY_CONFLICT' then
      'No authority conflict. Hubs move, insurance, and lender are the three-hub baseline. Packet 19 is the future authority step. Do not apply 16-ask-prod-contractor-authority-forward.sql.'
    else
      'HOLD. STOP. The installed authority body is not the three-hub baseline, the packet 19 final body, or the legacy packet 16 contractor body. No mutation. Do not apply 16-ask-prod-contractor-authority-forward.sql.'
  end as operator_instruction
from classed;
