-- MY TRUSTHUB V2 — THREE CONTRACTOR DBPR BINDINGS (FORWARD, operator).
-- Packet 16. NOT APPLIED by this build. Contractor parent sync and the canary
-- stay off. Do not apply migration 016. No production keys are created here.
-- Each insert runs only when that exact DBPR key has zero current rows and
-- none of the three exact canonical profile refs is already an active entity.
-- An existing row aborts the transaction. No name, slug, email, or UUID match.
-- No merge. Slug is the public return path only.
--
-- The operator sets both guards after a read of
-- 16-ask-prod-contractor-dbpr-preflight.sql. This file does not set them.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.contractor_dbpr_checked','true',false);
--
-- The statement result is the rollback target. One receipt row per created binding:
--   external_key, binding_id, network_entity_id, canonical_public_profile_ref
-- The same rows remain in pg_temp.v23contractor_receipt until the session ends.
--   \copy (select external_key, binding_id, network_entity_id, canonical_public_profile_ref
--          from pg_temp.v23contractor_receipt order by external_key) to '16-receipt-<date>.csv' csv header

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
lock table network.network_entities, network.network_entity_bindings in share row exclusive mode;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if current_setting('v23bind.contractor_dbpr_checked', true) is distinct from 'true' then
    raise exception 'Confirm each exact DBPR license before creating bindings';
  end if;
  if exists (
    select 1 from network.network_entity_bindings
     where (valid_to is null or valid_to > statement_timestamp())
       and (
         specialist_entity_id in (
           'fl.dbpr.license:CCC057187',
           'fl.dbpr.license:CFC1427249',
           'fl.dbpr.license:CGC1517216'
         )
         or lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1517216')
         or (
           hub = 'contractor'
           and identifier_namespace = 'fl.dbpr.license'
           and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1517216')
         )
         or (
           identifier_namespace is distinct from 'fl.dbpr.license'
           and source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1517216')
         )
       )
  ) then
    raise exception 'Existing contractor DBPR binding requires steward review; no merge';
  end if;
  if exists (
    select 1 from network.network_entities
     where status = 'active'
       and canonical_public_profile_ref in (
         '/contractors/ccc057187-a-r-roofing-inc',
         '/contractors/cfc1427249-a-sunny-plumbing-company',
         '/contractors/cgc1517216-abaco-construction-inc'
       )
  ) then
    raise exception 'Existing canonical profile ref requires steward review; no merge';
  end if;
  if exists (
    select 1 from network.network_entity_bindings
     where (valid_to is null or valid_to > statement_timestamp())
       and lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1517216')
     group by lower(btrim(specialist_entity_id))
    having count(*) > 1
  ) or exists (
    select 1 from network.network_entities
     where status = 'active'
       and canonical_public_profile_ref in (
         '/contractors/ccc057187-a-r-roofing-inc',
         '/contractors/cfc1427249-a-sunny-plumbing-company',
         '/contractors/cgc1517216-abaco-construction-inc'
       )
     group by canonical_public_profile_ref
    having count(*) > 1
  ) then
    raise exception 'Ambiguous contractor ownership requires steward review; no merge';
  end if;
end $$;

create temp table v23contractor_receipt (
  external_key text primary key,
  binding_id uuid not null unique,
  network_entity_id uuid not null unique,
  canonical_public_profile_ref text not null unique
) on commit preserve rows;

with inserted_entity as (
  insert into network.network_entities (
    entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
  ) values
    ('organization', 'A & R ROOFING INC', 'contractor', 'FL', '/contractors/ccc057187-a-r-roofing-inc', 'active'),
    ('organization', 'A SUNNY PLUMBING COMPANY', 'contractor', 'FL', '/contractors/cfc1427249-a-sunny-plumbing-company', 'active'),
    ('organization', 'ABACO CONSTRUCTION INC', 'contractor', 'FL', '/contractors/cgc1517216-abaco-construction-inc', 'active')
  returning id, canonical_public_profile_ref
), inserted_binding as (
  insert into network.network_entity_bindings (
    network_entity_id, hub, specialist_entity_type, specialist_entity_id,
    identifier_namespace, source_identifier, jurisdiction, binding_status,
    valid_from, provenance_ref, resolution_note
  )
  select e.id, 'contractor', 'contractor_profile',
         'fl.dbpr.license:' || v.external_key,
         'fl.dbpr.license', v.external_key, 'FL', 'accepted', transaction_timestamp(),
         'contractor_trust_hub_florida_dbpr',
         'Published Florida contractor. Exact DBPR license. Slug is the return path only.'
    from (values
      ('CCC057187', '/contractors/ccc057187-a-r-roofing-inc'),
      ('CFC1427249', '/contractors/cfc1427249-a-sunny-plumbing-company'),
      ('CGC1517216', '/contractors/cgc1517216-abaco-construction-inc')
    ) as v(external_key, return_path)
    join inserted_entity e on e.canonical_public_profile_ref = v.return_path
  returning id, network_entity_id, source_identifier
)
insert into pg_temp.v23contractor_receipt (
  external_key, binding_id, network_entity_id, canonical_public_profile_ref
)
select b.source_identifier, b.id, b.network_entity_id, e.canonical_public_profile_ref
  from inserted_binding b
  join inserted_entity e on e.id = b.network_entity_id;

do $$ declare n integer; begin
  select count(*) into n from pg_temp.v23contractor_receipt;
  if n <> 3
     or exists (
       select 1 from pg_temp.v23contractor_receipt
        where (external_key, canonical_public_profile_ref) not in (
          ('CCC057187', '/contractors/ccc057187-a-r-roofing-inc'),
          ('CFC1427249', '/contractors/cfc1427249-a-sunny-plumbing-company'),
          ('CGC1517216', '/contractors/cgc1517216-abaco-construction-inc')
        )
     ) then
    raise exception 'Contractor receipt must be exactly the three created canary bindings, got %', n;
  end if;
end $$;

-- The runtime login cannot select network tables. This read-only wrapper
-- writes nothing. It returns every current accepted or review_required claim
-- for this namespace and DBPR key, whatever jurisdiction is stored, and every
-- current claim whose specialist id is the same logical id. The key comparison
-- is source_identifier_normalized, lower(btrim(source_identifier)). The
-- specialist id comparison is lower(btrim(specialist_entity_id)) =
-- lower(btrim(native id)). A case or outer-whitespace variant cannot hide.
-- The presented native id stays fl.dbpr.license plus an uppercase DBPR key.
-- The caller fails closed on disagreement or ambiguity. Eligibility still
-- requires jurisdiction FL and the canonical DBPR key.
do $$ begin
  if to_regrole('myth_v23_prod_reader') is null or to_regrole('myth_v23_authorizer') is null or to_regrole('myth_v23_executor') is null then
    raise exception 'V23_PROD_CONTRACTOR_RESOLVER_PRECONDITION_FAIL';
  end if;
  if to_regprocedure('v23_private.prod_contractor_dbpr_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('prod_contractor_dbpr_bindings','prod_contractor_dbpr_entities')) then
    raise exception 'V23_PROD_CONTRACTOR_RESOLVER_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
end $$;

create policy prod_contractor_dbpr_bindings on network.network_entity_bindings for select to myth_v23_prod_reader
 using(hub='contractor' and (identifier_namespace='fl.dbpr.license' or lower(btrim(specialist_entity_id)) ~ '^fl\.dbpr\.license:[a-z]{1,4}[0-9]{3,9}$'));
create policy prod_contractor_dbpr_entities on network.network_entities for select to myth_v23_prod_reader
 using(exists(select 1 from network.network_entity_bindings b where b.network_entity_id=network_entities.id
   and b.hub='contractor' and (b.identifier_namespace='fl.dbpr.license' or lower(btrim(b.specialist_entity_id)) ~ '^fl\.dbpr\.license:[a-z]{1,4}[0-9]{3,9}$')));

create function v23_private.prod_contractor_dbpr_binding_for(native_id text)
returns table(id uuid, network_entity_id uuid, binding_status text, specialist_entity_type text, specialist_entity_id text,
  identifier_namespace text, source_identifier text, jurisdiction text, entity_status text, canonical_public_profile_ref text)
language sql stable security definer set search_path=pg_catalog,network as $$
 select b.id, e.id, b.binding_status, b.specialist_entity_type, b.specialist_entity_id,
   b.identifier_namespace, b.source_identifier, b.jurisdiction, e.status, e.canonical_public_profile_ref
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where split_part($1, ':', 1) = 'fl.dbpr.license'
   and split_part($1, ':', 2) ~ '^[A-Z]{1,4}[0-9]{3,9}$'
   and split_part($1, ':', 3) = ''
   and b.hub = 'contractor'
   and b.binding_status in ('accepted','review_required')
   and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
   and (
     lower(btrim(b.specialist_entity_id)) = lower(btrim($1))
     or (
       b.identifier_namespace = 'fl.dbpr.license'
       and b.source_identifier_normalized = lower(btrim(split_part($1, ':', 2)))
     )
   )
 order by b.id limit 3;
$$;
revoke all on function v23_private.prod_contractor_dbpr_binding_for(text) from public, anon, authenticated;
grant execute on function v23_private.prod_contractor_dbpr_binding_for(text) to myth_v23_authorizer, myth_v23_executor;
grant create on schema v23_private to myth_v23_prod_reader;
grant myth_v23_prod_reader to current_user with admin false, inherit false, set true granted by current_user;
alter function v23_private.prod_contractor_dbpr_binding_for(text) owner to myth_v23_prod_reader;
revoke create on schema v23_private from myth_v23_prod_reader;
revoke myth_v23_prod_reader from current_user granted by current_user;

do $$ begin
  if has_function_privilege('public','v23_private.prod_contractor_dbpr_binding_for(text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_contractor_dbpr_binding_for(text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_contractor_dbpr_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_contractor_dbpr_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.prod_contractor_dbpr_binding_for(text)','EXECUTE') then
    raise exception 'V23_PROD_CONTRACTOR_RESOLVER_ACL_FAIL';
  end if;
end $$;

select external_key, binding_id, network_entity_id, canonical_public_profile_ref
  from pg_temp.v23contractor_receipt
 order by external_key;
commit;
