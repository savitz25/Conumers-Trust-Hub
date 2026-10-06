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
-- BASELINE_NO_AUTHORITY_CONFLICT: the exact three-hub migration body. No
-- authority conflict. Binding work may proceed. Packet 19 is the future
-- authority step.
-- NETWORK_AUTHORITY_FINAL: the exact certified packet 19 body. Network
-- authority is final. Do not apply a hub-specific authority forward.
-- LEGACY_PACKET16_AUTHORITY_HOLD: the exact packet 16 contractor authority
-- body. HOLD. Converge through packet 19. Do not re-apply packet 16 authority.
-- UNKNOWN_AUTHORITY_HOLD: any other body, including a missing function and any
-- edit of a reviewed body. HOLD. STOP. No mutation.
-- The comparison is md5(regexp_replace(prosrc, '\s+', '', 'g')), the same
-- whole-body normalization as 19-ask-prod-network-authority-preflight.sql.
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
       'fl.dbpr.license:CGC1517216'
     )
     or lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1517216')
     or (
       hub = 'contractor'
       and identifier_namespace = 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1517216')
     )
     or (
       identifier_namespace is distinct from 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1517216')
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
     '/contractors/cgc1517216-abaco-construction-inc'
   )
 order by canonical_public_profile_ref, id;

select 'binding' as kind, lower(btrim(specialist_entity_id)) as owner_key, count(*) as rows
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1517216')
 group by lower(btrim(specialist_entity_id))
 having count(*) > 1
union all
select 'profile_ref', canonical_public_profile_ref, count(*)
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/contractors/ccc057187-a-r-roofing-inc',
     '/contractors/cfc1427249-a-sunny-plumbing-company',
     '/contractors/cgc1517216-abaco-construction-inc'
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
       'fl.dbpr.license:CGC1517216'
     )
     or lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1517216')
     or (
       hub = 'contractor'
       and identifier_namespace = 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1517216')
     )
   )
 order by specialist_entity_id, identifier_namespace, source_identifier;

-- Result 5. Authority status. Always one row. Read only. No mutation.
-- Whole-function fingerprint: md5(regexp_replace(prosrc, '\s+', '', 'g')).
-- Only the three reviewed bodies match. A comment, a shortened body, a loosened
-- guard, or any other edit is UNKNOWN_AUTHORITY_HOLD.
select disposition,
  case disposition
    when 'NETWORK_AUTHORITY_FINAL' then
      'Network authority final. Ready. The installed body is the certified packet 19 function. Packet 16 authority is not missing. Do not apply 16-ask-prod-contractor-authority-forward.sql.'
    when 'LEGACY_PACKET16_AUTHORITY_HOLD' then
      'HOLD. Legacy packet 16 authority is installed. Converge with packet 19 (19-ask-prod-network-authority-forward.sql). Do not apply 16-ask-prod-contractor-authority-forward.sql. Packet 16 authority rollback is not the production rollback.'
    when 'BASELINE_NO_AUTHORITY_CONFLICT' then
      'No authority conflict. Hubs move, insurance, and lender are the three-hub baseline. Packet 19 is the future authority step. Do not apply 16-ask-prod-contractor-authority-forward.sql.'
    else
      'HOLD. STOP. The installed authority body is not the three-hub baseline, the packet 19 final body, or the legacy packet 16 contractor body. No mutation. Do not apply 16-ask-prod-contractor-authority-forward.sql.'
  end as operator_instruction
  from (
    select case fingerprint
             when '691e2f2e05426c60af8fa3a54f38eac9' then 'BASELINE_NO_AUTHORITY_CONFLICT'
             when '17f464ad69f3d8c7a89dd2cf9229f112' then 'NETWORK_AUTHORITY_FINAL'
             when 'b96310263f422a646fe8d9811f3ba35f' then 'LEGACY_PACKET16_AUTHORITY_HOLD'
             else 'UNKNOWN_AUTHORITY_HOLD'
           end as disposition
      from (
        select md5(regexp_replace(prosrc, '\s+', '', 'g')) as fingerprint
          from pg_proc
         where oid = to_regprocedure('v23_private.authority()')
        union all
        select null::text
         where to_regprocedure('v23_private.authority()') is null
      ) as installed
  ) as classed;
