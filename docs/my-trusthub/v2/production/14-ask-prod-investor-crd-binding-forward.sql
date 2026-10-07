-- MY TRUSTHUB V2 — THREE INVESTOR OFFICIAL-FIRM BINDINGS + RESOLVER (FORWARD, operator).
-- NOT APPLIED by this build. Investor parent sync stays off.
--
-- Creates, in one transaction:
--   three canonical investor organizations and three accepted sec.crd bindings
--   policy   prod_investor_crd_bindings on network.network_entity_bindings (SELECT, myth_v23_prod_reader)
--   policy   prod_investor_crd_entities on network.network_entities        (SELECT, myth_v23_prod_reader)
--   function v23_private.prod_investor_crd_binding_for(text)               (owner myth_v23_prod_reader)
-- The resolution proof assumes myth_v23_prod_reader after that owner change,
-- because alter owner moves execute off the operator. It resets the role and
-- revokes the membership before commit. The function body and the ending ACL
-- are unchanged.
-- Nothing else. INSERT only on the identity tables: no UPDATE, no DELETE, no
-- upsert, no merge, no name or slug match. Any existing claim on one of the
-- three CRDs or the three canonical profile refs aborts the whole transaction.
--
-- Identity (locked): hub investor / specialist_entity_type official_firm /
-- identifier_namespace sec.crd / source_identifier = exact numeric firm CRD /
-- specialist_entity_id crd-<CRD> / jurisdiction US.
-- canonical_public_profile_ref /firm/sec-crd-<CRD> is the public return path
-- and is checked by the runtime; it is not an identity.
--
-- The operator sets both guards after reading 14-ask-prod-investor-crd-preflight.sql
-- (result sets 1 to 3 empty) and confirming each firm CRD on SEC IAPD
-- (adviserinfo.sec.gov). This file does not set them.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.sec_iapd_checked','true',false);
--
-- The statement result is the rollback target. One receipt row per created binding:
--   crd, binding_id, network_entity_id, canonical_public_profile_ref
-- The same rows remain in pg_temp.v23investor_receipt until the session ends.
--   \copy (select crd, binding_id, network_entity_id, canonical_public_profile_ref
--          from pg_temp.v23investor_receipt order by crd::bigint) to '14-receipt-<date>.csv' csv header

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
lock table network.network_entities, network.network_entity_bindings in share row exclusive mode;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if current_setting('v23bind.sec_iapd_checked', true) is distinct from 'true' then
    raise exception 'Confirm each firm CRD on SEC IAPD before creating bindings';
  end if;
  if to_regrole('myth_v23_prod_reader') is null or to_regrole('myth_v23_authorizer') is null or to_regrole('myth_v23_executor') is null then
    raise exception 'V23_PROD_INVESTOR_RESOLVER_PRECONDITION_FAIL';
  end if;
  if to_regprocedure('v23_private.prod_investor_crd_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('prod_investor_crd_bindings','prod_investor_crd_entities')) then
    raise exception 'V23_PROD_INVESTOR_RESOLVER_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
  -- Any status, any lifetime, any hub: a prior claim on the CRD is never overwritten.
  if exists (
    select 1 from network.network_entity_bindings
     where (identifier_namespace = 'sec.crd' and source_identifier_normalized in ('106176', '104571', '110441'))
        or (hub = 'investor' and specialist_entity_id in ('crd-106176', 'crd-104571', 'crd-110441'))
  ) then
    raise exception 'Existing investor CRD binding requires steward review; no merge';
  end if;
  if exists (
    select 1 from network.network_entities
     where canonical_public_profile_ref in (
         '/firm/sec-crd-106176',
         '/firm/sec-crd-104571',
         '/firm/sec-crd-110441'
       )
  ) then
    raise exception 'Existing canonical profile ref requires steward review; no merge';
  end if;
end $$;

create temp table v23investor_receipt (
  crd text primary key,
  binding_id uuid not null unique,
  network_entity_id uuid not null unique,
  canonical_public_profile_ref text not null unique
) on commit preserve rows;

with canary(crd, legal_name) as (values
  ('106176', 'WEINBERGER ASSET MANAGEMENT, INC'),
  ('104571', 'METROPOLITAN WEST ASSET MANAGEMENT LLC'),
  ('110441', 'WESTERN ASSET MANAGEMENT COMPANY, LLC')
), inserted_entity as (
  insert into network.network_entities (
    entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
  )
  select 'organization', legal_name, 'investor', 'US', '/firm/sec-crd-' || crd, 'active' from canary
  returning id, canonical_public_profile_ref
), inserted_binding as (
  insert into network.network_entity_bindings (
    network_entity_id, hub, specialist_entity_type, specialist_entity_id,
    identifier_namespace, source_identifier, jurisdiction, binding_status,
    valid_from, provenance_ref, resolution_note
  )
  select e.id, 'investor', 'official_firm', 'crd-' || c.crd,
         'sec.crd', c.crd, 'US', 'accepted', transaction_timestamp(),
         'investor_trust_hub_firms',
         'Official SEC/IARD firm. Exact numeric firm CRD ' || c.crd || '. Slug is the return path only.'
    from canary c
    join inserted_entity e on e.canonical_public_profile_ref = '/firm/sec-crd-' || c.crd
  returning id, network_entity_id, source_identifier
)
insert into pg_temp.v23investor_receipt (crd, binding_id, network_entity_id, canonical_public_profile_ref)
select b.source_identifier, b.id, b.network_entity_id, e.canonical_public_profile_ref
  from inserted_binding b
  join inserted_entity e on e.id = b.network_entity_id;

do $$ declare n integer; begin
  select count(*) into n from pg_temp.v23investor_receipt;
  if n <> 3
     or exists (
       select 1 from pg_temp.v23investor_receipt
        where (crd, canonical_public_profile_ref) not in (
          ('106176', '/firm/sec-crd-106176'),
          ('104571', '/firm/sec-crd-104571'),
          ('110441', '/firm/sec-crd-110441')
        )
     ) then
    raise exception 'Investor receipt must be exactly the three created canary bindings, got %', n;
  end if;
end $$;

-- The runtime login cannot select network tables. This read-only wrapper has
-- the same shape as prod_move_binding_for and prod_lender_nmls_binding_for,
-- plus the entity's canonical profile ref. It writes nothing. One identity in,
-- at most three rows out; no name, slug, uuid or pattern lookup.
create policy prod_investor_crd_bindings on network.network_entity_bindings for select to myth_v23_prod_reader
 using(hub='investor' and (identifier_namespace='sec.crd' or specialist_entity_id ~ '^crd-[1-9][0-9]{0,9}$'));
create policy prod_investor_crd_entities on network.network_entities for select to myth_v23_prod_reader
 using(exists(select 1 from network.network_entity_bindings b where b.network_entity_id=network_entities.id
   and b.hub='investor' and (b.identifier_namespace='sec.crd' or b.specialist_entity_id ~ '^crd-[1-9][0-9]{0,9}$')));

create function v23_private.prod_investor_crd_binding_for(native_id text)
returns table(id uuid, network_entity_id uuid, binding_status text, specialist_entity_type text, specialist_entity_id text,
  identifier_namespace text, source_identifier text, jurisdiction text, entity_status text, canonical_public_profile_ref text)
language sql stable security definer set search_path=pg_catalog,network as $$
 select b.id, e.id, b.binding_status, b.specialist_entity_type, b.specialist_entity_id,
   b.identifier_namespace, b.source_identifier, b.jurisdiction, e.status, e.canonical_public_profile_ref
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where $1 ~ '^crd-[1-9][0-9]{0,9}$'
   and b.hub='investor'
   and (b.specialist_entity_id=$1 or (b.identifier_namespace='sec.crd' and b.source_identifier_normalized=substr($1,5)))
   and b.binding_status in ('accepted','review_required')
   and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
 order by b.id limit 3;
$$;
revoke all on function v23_private.prod_investor_crd_binding_for(text) from public, anon, authenticated;
grant execute on function v23_private.prod_investor_crd_binding_for(text) to myth_v23_authorizer, myth_v23_executor;
grant create on schema v23_private to myth_v23_prod_reader;
grant myth_v23_prod_reader to current_user with admin false, inherit false, set true granted by current_user;
alter function v23_private.prod_investor_crd_binding_for(text) owner to myth_v23_prod_reader;
revoke create on schema v23_private from myth_v23_prod_reader;

do $$ declare n integer; r record; crds text[]; binding_ids uuid[]; entity_ids uuid[]; i integer; begin
  if has_function_privilege('public','v23_private.prod_investor_crd_binding_for(text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_investor_crd_binding_for(text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_investor_crd_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_investor_crd_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.prod_investor_crd_binding_for(text)','EXECUTE') then
    raise exception 'V23_PROD_INVESTOR_RESOLVER_ACL_FAIL';
  end if;
  -- Read the receipt as the operator. The temp table is not visible to the
  -- resolver owner, and that owner is who must call the function.
  select coalesce(array_agg(crd order by crd), '{}'),
         coalesce(array_agg(binding_id order by crd), '{}'),
         coalesce(array_agg(network_entity_id order by crd), '{}')
    into crds, binding_ids, entity_ids
    from pg_temp.v23investor_receipt;
  if coalesce(array_length(crds, 1), 0) <> 3 then
    raise exception 'Investor receipt must be exactly the three created canary bindings, got %', coalesce(array_length(crds, 1), 0);
  end if;
  -- Same reviewed owner session as packet 02. Alter owner moved execute here.
  -- The body is security definer and nobypassrls, so this is the RLS proof.
  set local role myth_v23_prod_reader;
  -- Impossible and malformed identities return nothing.
  for r in select unnest(array['crd-0', 'crd-', '%', 'sec-crd-106176', '106176', 'WEINBERGER ASSET MANAGEMENT, INC']) as bad loop
    select count(*) into n from v23_private.prod_investor_crd_binding_for(r.bad);
    if n <> 0 then raise exception 'V23_PROD_INVESTOR_RESOLVER_FAIL: % matched', r.bad; end if;
  end loop;
  -- Each created binding resolves as exactly one accepted, exact row.
  for i in 1 .. array_length(crds, 1) loop
    select count(*) into n from v23_private.prod_investor_crd_binding_for('crd-' || crds[i]) f
     where f.id = binding_ids[i] and f.network_entity_id = entity_ids[i] and f.binding_status = 'accepted'
       and f.specialist_entity_type = 'official_firm' and f.specialist_entity_id = 'crd-' || crds[i]
       and f.identifier_namespace = 'sec.crd' and f.source_identifier = crds[i] and f.jurisdiction = 'US'
       and f.entity_status = 'active' and f.canonical_public_profile_ref = '/firm/sec-crd-' || crds[i];
    if n <> 1 or (select count(*) from v23_private.prod_investor_crd_binding_for('crd-' || crds[i])) <> 1 then
      raise exception 'V23_PROD_INVESTOR_RESOLVER_FAIL: crd % does not resolve to its one created binding', crds[i];
    end if;
  end loop;
  reset role;
  raise notice 'V23_PROD_INVESTOR_CRD_BINDINGS_APPLIED';
end $$;
revoke myth_v23_prod_reader from current_user granted by current_user;

select crd, binding_id, network_entity_id, canonical_public_profile_ref
  from pg_temp.v23investor_receipt
 order by crd::bigint;
commit;
