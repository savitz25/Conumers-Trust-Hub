-- MY TRUSTHUB V2 — INVESTOR FIRM CRD PREFLIGHT (READ ONLY).
-- Operator session on qvvxvbcdmbjzrgvwjatw. Run it before any packet 14 file.
-- On a clean production database result sets 1, 2, 3 and 5 are empty and
-- result set 4 is one row: baseline / PROCEED. Do not apply the binding packet
-- unless result sets 1 to 3 are empty; any row there is a hold for that
-- candidate and needs steward review. Do not apply anything while result set
-- 4 says HOLD. Result set 5 reports whether the Investor context packet is
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

-- 4. Network authority state. Always exactly one row. Packet 19 owns
--    v23_private.authority(); the packet 14 authority files are superseded and
--    are never part of the production order. The installed body is compared
--    whole, whitespace removed, against the three reviewed bodies (the same
--    normalization 19-ask-prod-network-authority-preflight.sql uses):
--      baseline          migration three-hub body (move, insurance, lender)
--      network_final     packet 19 six-hub body
--      legacy_packet14   packet 14 four-hub body (a superseded apply)
--    Anything else, including a missing function, is unknown.
--    disposition PROCEED: the Investor context and binding packets may run;
--      packet 19 provides authority later.
--    disposition FINAL: network authority is final; apply no authority file.
--    disposition HOLD: stop. Run 19-ask-prod-network-authority-preflight.sql
--      and get review before any authority step.
--    The hashes are pinned by scripts/qa/v23-investor-official-firm-postgres.mjs,
--    which recomputes them from the installed bodies.
select state as authority_state,
       case state when 'baseline' then 'PROCEED' when 'network_final' then 'FINAL' else 'HOLD' end as disposition,
       case state
         when 'baseline' then 'Investor context and binding packets may run. Authority comes later from 19-ask-prod-network-authority-forward.sql. Do not apply 14-ask-prod-investor-authority-forward.sql.'
         when 'network_final' then 'Network authority is final (packet 19). Apply no authority file. Do not apply either 14-ask-prod-investor-authority file.'
         when 'legacy_packet14' then 'HOLD: the superseded packet 14 authority is installed. Converge with 19-ask-prod-network-authority-preflight.sql then -forward.sql after review. Do not run 14-ask-prod-investor-authority-rollback.sql.'
         else 'HOLD: authority() is not a reviewed body. Stop and get review. Run 19-ask-prod-network-authority-preflight.sql; apply nothing.'
       end as next_step
  from (select case (select md5(regexp_replace(prosrc, '\s+', '', 'g')) from pg_proc
                      where oid = to_regprocedure('v23_private.authority()'))
                 when '691e2f2e05426c60af8fa3a54f38eac9' then 'baseline'
                 when '17f464ad69f3d8c7a89dd2cf9229f112' then 'network_final'
                 when 'ddfa1b8021363739c8b22911044f4cc8' then 'legacy_packet14'
                 else 'unknown'
               end as state) as installed;

-- 5. The Investor context packet must not be applied yet. A row here means it
--    is already in place: skip it, do not re-apply it.
select '14-ask-prod-investor-context-forward.sql' as already_applied
 where to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)') is not null;
