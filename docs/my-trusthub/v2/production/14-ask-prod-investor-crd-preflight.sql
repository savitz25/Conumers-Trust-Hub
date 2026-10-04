-- MY TRUSTHUB V2 — INVESTOR FIRM CRD PREFLIGHT (READ ONLY).
-- Operator session on qvvxvbcdmbjzrgvwjatw. Run it before any packet 14 file:
-- on a database where nothing of packet 14 is applied, all four result sets
-- are empty. Do not apply the binding packet unless result sets 1 to 3 are
-- empty; any row there is a hold for that candidate and needs steward review.
-- Result set 4 only reports which of the authority and context packets are
-- already in place. This file does not insert, update, or delete.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Identity: hub investor / official_firm / sec.crd / exact numeric firm CRD /
-- specialist_entity_id crd-<CRD> / US. Return path /firm/sec-crd-<CRD>.
-- Nothing here is a name match.

-- 1. Any binding, in any hub, status or lifetime, that already claims one of
--    the three firm CRDs under sec.crd or the crd-<CRD> native id.
select hub, specialist_entity_type, specialist_entity_id, identifier_namespace, source_identifier,
       jurisdiction, binding_status, valid_from, valid_to, id as binding_id, network_entity_id
  from network.network_entity_bindings
 where (identifier_namespace = 'sec.crd' and source_identifier_normalized in ('106176', '104571', '110441'))
    or (hub = 'investor' and specialist_entity_id in ('crd-106176', 'crd-104571', 'crd-110441'))
 order by source_identifier, id;

-- 2. Any entity that already holds one of the three exact canonical profile refs.
select id, canonical_name, primary_hub, status, canonical_public_profile_ref
  from network.network_entities
 where canonical_public_profile_ref in (
     '/firm/sec-crd-106176',
     '/firm/sec-crd-104571',
     '/firm/sec-crd-110441'
   )
 order by canonical_public_profile_ref, id;

-- 3. The resolver objects must not exist yet.
select 'function' as object, 'v23_private.prod_investor_crd_binding_for(text)' as name
 where to_regprocedure('v23_private.prod_investor_crd_binding_for(text)') is not null
union all
select 'policy', policyname from pg_policies
 where schemaname = 'network' and policyname in ('prod_investor_crd_bindings', 'prod_investor_crd_entities');

-- 4. The authority and context packets must not be applied yet. A row here
--    means that packet is already in place: skip it, do not re-apply it.
select '14-ask-prod-investor-authority-forward.sql' as already_applied
 where position($t$'lender','investor')$t$ in (select prosrc from pg_proc where oid = to_regprocedure('v23_private.authority()'))) > 0
union all
select '14-ask-prod-investor-context-forward.sql'
 where to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)') is not null;
