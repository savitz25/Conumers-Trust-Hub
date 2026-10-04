-- MY TRUSTHUB V2 — CONTRACTOR DBPR PREFLIGHT (READ ONLY).
-- Packet 16. Packet 14 is the investor authority packet. Packet 15 is the
-- shared hub account-context packet. This file does not apply either.
-- Operator session on qvvxvbcdmbjzrgvwjatw. Do not apply the binding packet
-- until EVERY result set returns zero rows. Any row is a hold.
--
-- Result 1: exact active binding collision (specialist id, namespace+key, or
-- the same DBPR key filed under another namespace).
-- Result 2: canonical public profile-ref collision on an active entity.
-- Result 3: ambiguous entity ownership (more than one current binding for one
-- key, or more than one active entity for one profile ref).
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
       and source_identifier in ('CCC057187', 'CFC1427249', 'CGC1506243')
     )
     or (
       identifier_namespace is distinct from 'fl.dbpr.license'
       and source_identifier in ('CCC057187', 'CFC1427249', 'CGC1506243')
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
