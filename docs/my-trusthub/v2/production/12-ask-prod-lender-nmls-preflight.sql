-- MY TRUSTHUB V2 — LENDER NMLS PREFLIGHT (READ ONLY).
-- Operator session on qvvxvbcdmbjzrgvwjatw. Do not apply the binding packet
-- until this returns zero rows for each candidate. Any row is a hold.
-- This file does not insert, update, or delete.
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
