-- MY TRUSTHUB V2 — INSURANCE STATE-LICENSE PREFLIGHT (READ ONLY).
-- Operator session on qvvxvbcdmbjzrgvwjatw. Do not apply the binding packet
-- until BOTH result sets return zero rows. Any row is a hold for that candidate.
-- The second result set is an exact canonical_public_profile_ref match.
-- It is not a name match. This file does not insert, update, or delete.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);

select jurisdiction, source_identifier, specialist_entity_id, identifier_namespace,
       binding_status, count(*) as rows
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and (
     specialist_entity_id in (
       'state-license:FL:L106287',
       'state-license:TX:1365714',
       'state-license:TX:9982'
     )
     or (
       hub = 'insurance'
       and identifier_namespace = 'insurance.state_license'
       and source_identifier in ('L106287', '1365714', '9982')
     )
     or (
       identifier_namespace = 'naic'
       and source_identifier in ('L106287', '1365714', '9982')
     )
   )
 group by 1, 2, 3, 4, 5
 order by 1, 2;

select id, status, canonical_public_profile_ref
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/providers/asfin-llc-l106287',
     '/providers/imt-services-llc-1365714',
     '/providers/bailey-insurance-risk-management-inc-9982'
   )
 order by canonical_public_profile_ref, id;
