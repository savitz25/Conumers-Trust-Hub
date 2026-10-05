-- MY TRUSTHUB V2 — CONTRACTOR DBPR PREFLIGHT (READ ONLY).
-- Packet 16. Packet 14 is the investor authority packet. Packet 15 is the
-- shared hub account-context packet. This file applies neither, and it does
-- not apply the contractor authority change.
-- Operator session on qvvxvbcdmbjzrgvwjatw.
--
-- Result 1: current binding collision on a canonical specialist id, on the
-- same normalized DBPR key under fl.dbpr.license, or on that normalized key
-- under another namespace. The key is source_identifier_normalized,
-- lower(btrim(source_identifier)). A row holds the binding packet.
-- Result 2: canonical public profile-ref collision on an active entity.
-- A row holds the binding packet.
-- Result 3: ambiguous active ownership (more than one current binding for one
-- key, or more than one active entity for one profile ref). A row holds the binding packet.
-- Result 4: review_required conflict on the exact contractor contract.
-- A row holds the binding packet.
-- Result 5: contractor authority is already applied. A row is a HOLD for
-- 16-ask-prod-contractor-authority-forward.sql. It is not a clean database
-- and it is not a silent skip. Do not re-apply that packet while the row is
-- present. An empty result 5 means the reviewed three-hub authority is still
-- installed, which is the precondition for the authority forward packet.
--
-- Do not apply the binding packet while result 1, 2, 3, or 4 has a row.
-- Do not treat result 5 as clean when it has a row.
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

select 'binding' as kind, specialist_entity_id as owner_key, count(*) as rows
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and specialist_entity_id in (
     'fl.dbpr.license:CCC057187',
     'fl.dbpr.license:CFC1427249',
     'fl.dbpr.license:CGC1506243'
   )
 group by specialist_entity_id
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
     or (
       hub = 'contractor'
       and identifier_namespace = 'fl.dbpr.license'
       and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1506243')
     )
   )
 order by specialist_entity_id, identifier_namespace, source_identifier;

-- Result 5. Already-applied contractor authority. A row is a hold, not a
-- clean skip. The forward packet raises instead of applying a second time.
select '16-ask-prod-contractor-authority-forward.sql' as packet,
       'ALREADY_APPLIED_HOLD' as disposition
 where position($t$c->>'hub' in ('move','insurance','lender','contractor')$t$ in (
   select prosrc from pg_proc where oid = to_regprocedure('v23_private.authority()')
 )) > 0;
