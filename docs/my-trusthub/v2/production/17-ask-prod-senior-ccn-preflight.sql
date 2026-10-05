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
-- Result 6: network authority state (one row). The authority step is packet 19
--           (19-ask-prod-network-authority-forward.sql). Packet 17's own
--           authority forward is SUPERSEDED BY PACKET 19 and is not applied.

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

-- Result 6: network authority state, from the whole installed authority() body.
-- A bare 'senior' token is never evidence of final authority. States:
--   baseline                  the reviewed three-hub migration body (move,
--                             insurance, lender). The Senior binding packet may
--                             proceed; the authority step later is packet 19.
--   network_authority_final   exactly the certified packet 19 six-hub body, with
--                             senior, the cms_facility guard and the cms.ccn
--                             contract present. Nothing further to do.
--   legacy_packet17_hold      the reviewed migration text with only the hub list
--                             changed and senior in that list (a packet 17-style
--                             body, no Senior class guard). HOLD: converge with
--                             packet 19; do not treat as final.
--   unknown_hold              anything else, including a missing function. HOLD:
--                             stop and review. (A packet 14 or 16 authority body
--                             also reads here; packet 19's own preflight is the
--                             place that recognises and converges those.)
-- Fingerprints are md5 of the body with all whitespace removed:
--   baseline 691e2f2e05426c60af8fa3a54f38eac9 (migration 20260919205200)
--   final    17f464ad69f3d8c7a89dd2cf9229f112 (PR #236 head 3b56570, packet 19)
--   template fe0edfb9acf31361b92099e4cd282fb7 (migration text, hub list removed)
-- resolver_installed must be false before the binding forward and true after it.
with installed as (
  select prosrc as body, regexp_replace(prosrc, '\s+', '', 'g') as norm,
         substring(prosrc from $re$c->>'hub' in \(([a-z',]+)\) and c->>'audience'='ask'$re$) as hubs
    from pg_proc where oid = to_regprocedure('v23_private.authority()')
), classified as (
  select case
    when body is null then 'unknown_hold'
    when md5(norm) = '691e2f2e05426c60af8fa3a54f38eac9' then 'baseline'
    when md5(norm) = '17f464ad69f3d8c7a89dd2cf9229f112'
         and position($t$c->>'hub' in ('move','insurance','lender','investor','contractor','senior') and c->>'audience'='ask'$t$ in body) > 0
         and position($t$c->>'hub' = 'senior'$t$ in body) > 0
         and position($t$is distinct from 'cms_facility'$t$ in body) > 0
         and position($t$is distinct from 'cms.ccn'$t$ in body) > 0
         and position($t$!~ '^[A-Z0-9]{6}$'$t$ in body) > 0 then 'network_authority_final'
    when hubs is not null
         and (length(body) - length(replace(body, hubs, ''))) = length(hubs)
         and md5(regexp_replace(replace(body, hubs, '@HUBS@'), '\s+', '', 'g')) = 'fe0edfb9acf31361b92099e4cd282fb7'
         and string_to_array(replace(hubs, '''', ''), ',') @> array['move','insurance','lender','senior']
         and string_to_array(replace(hubs, '''', ''), ',') <@ array['move','insurance','lender','investor','contractor','senior'] then 'legacy_packet17_hold'
    else 'unknown_hold' end as authority_state
    from (select 1) one left join installed on true
)
select authority_state,
       case authority_state
         when 'baseline' then 'binding packet may proceed; authority step later = packet 19'
         when 'network_authority_final' then 'network authority final (packet 19); no authority step'
         when 'legacy_packet17_hold' then 'HOLD: legacy packet 17 authority body; converge with packet 19'
         else 'HOLD: unknown authority body; stop and review' end as next_step,
       to_regprocedure('v23_private.prod_senior_ccn_binding_for(text)') is not null as resolver_installed
  from classified;
