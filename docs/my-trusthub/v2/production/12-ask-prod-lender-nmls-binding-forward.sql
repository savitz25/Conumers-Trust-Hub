-- MY TRUSTHUB V2 — THREE LENDER MARKETPLACE BINDINGS (FORWARD, operator).
-- NOT APPLIED by this build. Broad Lender parent sync stays off.
-- Each insert runs only when that NMLS has zero current lender rows and
-- none of the three exact canonical profile refs is already an active entity.
-- An existing row aborts the transaction. No name, slug, or email match.
-- No merge. Slug is the public return path only.
--
-- The operator sets both guards after a read of 12-ask-prod-lender-nmls-preflight.sql
-- and a NMLS Consumer Access check. This file does not set them.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.nmls_consumer_access_checked','true',false);
--
-- The statement result is the rollback target. One receipt row per created binding:
--   nmls, binding_id, network_entity_id, canonical_public_profile_ref
-- The same rows remain in pg_temp.v23lender_receipt until the session ends.
--   \copy (select nmls, binding_id, network_entity_id, canonical_public_profile_ref
--          from pg_temp.v23lender_receipt order by nmls) to '12-receipt-<date>.csv' csv header

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
lock table network.network_entities, network.network_entity_bindings in share row exclusive mode;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if current_setting('v23bind.nmls_consumer_access_checked', true) is distinct from 'true' then
    raise exception 'Confirm each NMLS company ID on NMLS Consumer Access before creating bindings';
  end if;
  if exists (
    select 1 from network.network_entity_bindings
     where hub = 'lender'
       and identifier_namespace = 'nmls'
       and source_identifier in ('1984721', '2239104', '1673842')
       and (valid_to is null or valid_to > statement_timestamp())
  ) then
    raise exception 'Existing lender NMLS binding requires steward review; no merge';
  end if;
  if exists (
    select 1 from network.network_entities
     where status = 'active'
       and canonical_public_profile_ref in (
         '/lenders/pacific-trust-mortgage',
         '/lenders/metro-home-finance',
         '/lenders/lone-star-lending'
       )
  ) then
    raise exception 'Existing canonical profile ref requires steward review; no merge';
  end if;
end $$;

create temp table v23lender_receipt (
  nmls text primary key,
  binding_id uuid not null unique,
  network_entity_id uuid not null unique,
  canonical_public_profile_ref text not null unique
) on commit preserve rows;

with inserted_entity as (
  insert into network.network_entities (
    entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
  ) values
    ('organization', 'Pacific Trust Mortgage', 'lender', 'US', '/lenders/pacific-trust-mortgage', 'active'),
    ('organization', 'Metro Home Finance', 'lender', 'US', '/lenders/metro-home-finance', 'active'),
    ('organization', 'Lone Star Lending', 'lender', 'US', '/lenders/lone-star-lending', 'active')
  returning id, canonical_public_profile_ref
), inserted_binding as (
  insert into network.network_entity_bindings (
    network_entity_id, hub, specialist_entity_type, specialist_entity_id,
    identifier_namespace, source_identifier, jurisdiction, binding_status,
    valid_from, provenance_ref, resolution_note
  )
  select e.id, 'lender', 'marketplace_company', 'nmls:' || v.nmls,
         'nmls', v.nmls, 'US', 'accepted', transaction_timestamp(),
         'lender_trust_hub_catalog',
         'Marketplace company. Exact numeric NMLS. Slug is the return path only.'
    from (values
      ('1984721', '/lenders/pacific-trust-mortgage'),
      ('2239104', '/lenders/metro-home-finance'),
      ('1673842', '/lenders/lone-star-lending')
    ) as v(nmls, return_path)
    join inserted_entity e on e.canonical_public_profile_ref = v.return_path
  returning id, network_entity_id, source_identifier
)
insert into pg_temp.v23lender_receipt (nmls, binding_id, network_entity_id, canonical_public_profile_ref)
select b.source_identifier, b.id, b.network_entity_id, e.canonical_public_profile_ref
  from inserted_binding b
  join inserted_entity e on e.id = b.network_entity_id;

do $$ declare n integer; begin
  select count(*) into n from pg_temp.v23lender_receipt;
  if n <> 3
     or exists (
       select 1 from pg_temp.v23lender_receipt
        where (nmls, canonical_public_profile_ref) not in (
          ('1984721', '/lenders/pacific-trust-mortgage'),
          ('2239104', '/lenders/metro-home-finance'),
          ('1673842', '/lenders/lone-star-lending')
        )
     ) then
    raise exception 'Lender receipt must be exactly the three created canary bindings, got %', n;
  end if;
end $$;

-- The runtime login cannot select network tables. This read-only wrapper is
-- the same shape as prod_move_binding_for. It writes nothing.
do $$ begin
  if to_regrole('myth_v23_prod_reader') is null or to_regrole('myth_v23_authorizer') is null or to_regrole('myth_v23_executor') is null then
    raise exception 'V23_PROD_LENDER_RESOLVER_PRECONDITION_FAIL';
  end if;
  if to_regprocedure('v23_private.prod_lender_nmls_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('prod_lender_nmls_bindings','prod_lender_nmls_entities')) then
    raise exception 'V23_PROD_LENDER_RESOLVER_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
end $$;

create policy prod_lender_nmls_bindings on network.network_entity_bindings for select to myth_v23_prod_reader
 using(hub='lender' and (identifier_namespace='nmls' or specialist_entity_id ~ '^nmls:[1-9][0-9]{2,11}$'));
create policy prod_lender_nmls_entities on network.network_entities for select to myth_v23_prod_reader
 using(exists(select 1 from network.network_entity_bindings b where b.network_entity_id=network_entities.id
   and b.hub='lender' and (b.identifier_namespace='nmls' or b.specialist_entity_id ~ '^nmls:[1-9][0-9]{2,11}$')));

create function v23_private.prod_lender_nmls_binding_for(native_id text)
returns table(id uuid, network_entity_id uuid, binding_status text, specialist_entity_type text, specialist_entity_id text,
  identifier_namespace text, source_identifier text, jurisdiction text, entity_status text)
language sql stable security definer set search_path=pg_catalog,network as $$
 select b.id, e.id, b.binding_status, b.specialist_entity_type, b.specialist_entity_id,
   b.identifier_namespace, b.source_identifier, b.jurisdiction, e.status
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where $1 ~ '^nmls:[1-9][0-9]{2,11}$'
   and b.hub='lender'
   and (b.specialist_entity_id=$1 or (b.identifier_namespace='nmls' and b.source_identifier=substr($1,6)))
   and b.binding_status in ('accepted','review_required')
   and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
 order by b.id limit 3;
$$;
revoke all on function v23_private.prod_lender_nmls_binding_for(text) from public, anon, authenticated;
grant execute on function v23_private.prod_lender_nmls_binding_for(text) to myth_v23_authorizer, myth_v23_executor;
grant create on schema v23_private to myth_v23_prod_reader;
grant myth_v23_prod_reader to current_user with admin false, inherit false, set true granted by current_user;
alter function v23_private.prod_lender_nmls_binding_for(text) owner to myth_v23_prod_reader;
revoke create on schema v23_private from myth_v23_prod_reader;
revoke myth_v23_prod_reader from current_user granted by current_user;

do $$ begin
  if has_function_privilege('public','v23_private.prod_lender_nmls_binding_for(text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_lender_nmls_binding_for(text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_lender_nmls_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_lender_nmls_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.prod_lender_nmls_binding_for(text)','EXECUTE') then
    raise exception 'V23_PROD_LENDER_RESOLVER_ACL_FAIL';
  end if;
end $$;

select nmls, binding_id, network_entity_id, canonical_public_profile_ref
  from pg_temp.v23lender_receipt
 order by nmls;
commit;
