-- MY TRUSTHUB V2 — SENIOR CMS CCN PREFLIGHT (READ ONLY).
-- Packet 17. Senior = CMS nursing-home profiles only (hub senior, class
-- cms_facility, namespace cms.ccn, id = the exact CCN). Packet 15 owns the
-- shared hub account context; this packet contains none of it.
-- Operator session on qvvxvbcdmbjzrgvwjatw. Do not apply the binding packet
-- until results 1-5 return ZERO rows and result 6 reads as described. Any row
-- in 1-5 is a hold. This file changes nothing and does not match names.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Result 1: exact active Senior cms.ccn binding collisions (same specialist id
--           on hub senior, same namespace+CCN, or the same CCN filed under
--           another namespace or another hub). Comparison uses the canonical
--           identifier: source_identifier_normalized, which is
--           lower(btrim(source_identifier)), and lower(btrim(specialist_entity_id)).
--           Case or padding variants of one CCN are the same logical claim.
-- Result 2: canonical public profile-ref collisions on an active entity.
-- Result 3: ambiguous network ownership (more than one current binding for one
--           logical CCN, or more than one active entity for one profile ref).
-- Result 4: existing accepted bindings for the three CCNs.
-- Result 5: review_required conflicts for the three CCNs.
-- Result 6: authority readiness (one row; see 17-ask-prod-senior-authority-forward.sql).

-- Result 1
select hub, specialist_entity_type, specialist_entity_id, identifier_namespace, source_identifier, binding_status,
       count(*) as rows
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and (
     (hub = 'senior' and lower(btrim(specialist_entity_id)) in ('015009', '055223', '155805'))
     or (
       hub = 'senior'
       and identifier_namespace = 'cms.ccn'
       and source_identifier_normalized in ('015009', '055223', '155805')
     )
     or (
       hub = 'senior'
       and identifier_namespace is distinct from 'cms.ccn'
       and source_identifier_normalized in ('015009', '055223', '155805')
     )
     or (
       hub is distinct from 'senior'
       and identifier_namespace = 'cms.ccn'
       and source_identifier_normalized in ('015009', '055223', '155805')
     )
   )
 group by 1, 2, 3, 4, 5, 6
 order by 1, 3, 4;

-- Result 2
select id, status, primary_hub, canonical_public_profile_ref
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/facility/cms/015009/burns-nursing-home-inc',
     '/facility/cms/055223/san-jacinto-valley-post-acute',
     '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center'
   )
 order by canonical_public_profile_ref, id;

-- Result 3. One binding row is counted once per logical CCN it claims.
-- A single accepted row whose specialist id and source identifier are the
-- same canary stays at count 1 and is not an ambiguity hold.
select 'binding' as kind, c.ccn as owner_key, count(*) as rows
  from network.network_entity_bindings b
  cross join (values ('015009'), ('055223'), ('155805')) as c(ccn)
 where (b.valid_to is null or b.valid_to > statement_timestamp())
   and b.hub = 'senior'
   and (
     lower(btrim(b.specialist_entity_id)) = c.ccn
     or b.source_identifier_normalized = c.ccn
   )
 group by c.ccn
 having count(*) > 1
union all
select 'profile_ref', canonical_public_profile_ref, count(*)
  from network.network_entities
 where status = 'active'
   and canonical_public_profile_ref in (
     '/facility/cms/015009/burns-nursing-home-inc',
     '/facility/cms/055223/san-jacinto-valley-post-acute',
     '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center'
   )
 group by canonical_public_profile_ref
 having count(*) > 1
 order by 1, 2;

-- Result 4
select id as binding_id, network_entity_id, specialist_entity_type, specialist_entity_id, identifier_namespace, source_identifier
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and hub = 'senior'
   and binding_status = 'accepted'
   and (
     lower(btrim(specialist_entity_id)) in ('015009', '055223', '155805')
     or source_identifier_normalized in ('015009', '055223', '155805')
   )
 order by source_identifier, id;

-- Result 5
select id as binding_id, network_entity_id, specialist_entity_type, specialist_entity_id, identifier_namespace, source_identifier
  from network.network_entity_bindings
 where (valid_to is null or valid_to > statement_timestamp())
   and hub = 'senior'
   and binding_status = 'review_required'
   and (
     lower(btrim(specialist_entity_id)) in ('015009', '055223', '155805')
     or source_identifier_normalized in ('015009', '055223', '155805')
   )
 order by source_identifier, id;

-- Result 6: authority readiness. v23_private.authority() must be installed.
-- If senior_admitted is false, apply 17-ask-prod-senior-authority-forward.sql
-- before any Senior stage can be written. resolver_installed must be false
-- before the binding forward and true after it.
select to_regprocedure('v23_private.authority()') is not null as authority_installed,
       coalesce((select position($t$'senior'$t$ in substring(prosrc from $re$c->>'hub' in \(([a-z',]+)\)$re$)) > 0
                   from pg_proc where oid = to_regprocedure('v23_private.authority()')), false) as senior_admitted,
       to_regprocedure('v23_private.prod_senior_ccn_binding_for(text)') is not null as resolver_installed;
