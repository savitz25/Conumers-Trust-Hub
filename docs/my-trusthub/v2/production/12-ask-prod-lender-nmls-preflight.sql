-- MY TRUSTHUB V2 — LENDER NMLS PREFLIGHT (READ ONLY).
-- Operator session on qvvxvbcdmbjzrgvwjatw. Do not apply the binding packet
-- until BOTH result sets return zero rows. Any row is a hold for that candidate.
-- The second result set is an exact canonical_public_profile_ref match.
-- It is not a name match. This file does not insert, update, or delete.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);

select source_identifier, specialist_entity_id, identifier_namespace, jurisdiction,
       binding_status, count(*) as rows
  from network.network_entity_bindings
 where hub = 'lender'
   and identifier_namespace = 'nmls'
   and source_identifier in ('1984721', '2239104', '1673842')
   and (valid_to is null or valid_to > statement_timestamp())
 group by 1, 2, 3, 4, 5
 order by 1;

select id, canonical_name, status, canonical_public_profile_ref
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/lenders/pacific-trust-mortgage',
     '/lenders/metro-home-finance',
     '/lenders/lone-star-lending'
   )
 order by canonical_public_profile_ref, id;
