-- MY TRUSTHUB V2 — THREE INSURANCE PROVIDER BINDINGS (FORWARD, operator).
-- NOT APPLIED by this build. Insurance parent sync and the canary stay off.
-- legal_insurer / NAIC rows are not updated.
-- Each insert runs only when that exact state license has zero current rows
-- and none of the three exact canonical profile refs is already an active entity.
-- An existing row aborts the transaction. No name, slug, email, or provider UUID match.
-- No merge. Slug is the public return path only.
--
-- The operator sets both guards after a read of
-- 13-ask-prod-insurance-state-license-preflight.sql. This file does not set them.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.insurance_state_license_checked','true',false);
--
-- The statement result is the rollback target. One receipt row per created binding:
--   jurisdiction, license, binding_id, network_entity_id, canonical_public_profile_ref
-- The same rows remain in pg_temp.v23insurance_receipt until the session ends.
--   \copy (select jurisdiction, license, binding_id, network_entity_id, canonical_public_profile_ref
--          from pg_temp.v23insurance_receipt order by jurisdiction, license) to '13-receipt-<date>.csv' csv header

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
lock table network.network_entities, network.network_entity_bindings in share row exclusive mode;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if current_setting('v23bind.insurance_state_license_checked', true) is distinct from 'true' then
    raise exception 'Confirm each exact state license before creating bindings';
  end if;
  if exists (
    select 1 from network.network_entity_bindings
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
  ) then
    raise exception 'Existing insurance state-license binding requires steward review; no merge';
  end if;
  if exists (
    select 1 from network.network_entities
     where status = 'active'
       and canonical_public_profile_ref in (
         '/providers/asfin-llc-l106287',
         '/providers/imt-services-llc-1365714',
         '/providers/bailey-insurance-risk-management-inc-9982'
       )
  ) then
    raise exception 'Existing canonical profile ref requires steward review; no merge';
  end if;
end $$;

create temp table v23insurance_receipt (
  jurisdiction text not null,
  license text not null,
  binding_id uuid not null unique,
  network_entity_id uuid not null unique,
  canonical_public_profile_ref text not null unique,
  primary key (jurisdiction, license)
) on commit preserve rows;

with inserted_entity as (
  insert into network.network_entities (
    entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
  ) values
    ('organization', 'ASFIN LLC', 'insurance', 'FL', '/providers/asfin-llc-l106287', 'active'),
    ('organization', 'IMT SERVICES, LLC', 'insurance', 'TX', '/providers/imt-services-llc-1365714', 'active'),
    ('organization', 'BAILEY INSURANCE & RISK MANAGEMENT INC', 'insurance', 'TX', '/providers/bailey-insurance-risk-management-inc-9982', 'active')
  returning id, canonical_public_profile_ref
), inserted_binding as (
  insert into network.network_entity_bindings (
    network_entity_id, hub, specialist_entity_type, specialist_entity_id,
    identifier_namespace, source_identifier, jurisdiction, binding_status,
    valid_from, provenance_ref, resolution_note
  )
  select e.id, 'insurance', 'insurance_provider',
         'state-license:' || v.jurisdiction || ':' || v.license,
         'insurance.state_license', v.license, v.jurisdiction, 'accepted', transaction_timestamp(),
         'insurance_trust_hub_provider',
         'Published agency. Exact state license. Slug is the return path only.'
    from (values
      ('FL', 'L106287', '/providers/asfin-llc-l106287'),
      ('TX', '1365714', '/providers/imt-services-llc-1365714'),
      ('TX', '9982', '/providers/bailey-insurance-risk-management-inc-9982')
    ) as v(jurisdiction, license, return_path)
    join inserted_entity e on e.canonical_public_profile_ref = v.return_path
  returning id, network_entity_id, source_identifier, jurisdiction
)
insert into pg_temp.v23insurance_receipt (
  jurisdiction, license, binding_id, network_entity_id, canonical_public_profile_ref
)
select b.jurisdiction, b.source_identifier, b.id, b.network_entity_id, e.canonical_public_profile_ref
  from inserted_binding b
  join inserted_entity e on e.id = b.network_entity_id;

do $$ declare n integer; begin
  select count(*) into n from pg_temp.v23insurance_receipt;
  if n <> 3
     or exists (
       select 1 from pg_temp.v23insurance_receipt
        where (jurisdiction, license, canonical_public_profile_ref) not in (
          ('FL', 'L106287', '/providers/asfin-llc-l106287'),
          ('TX', '1365714', '/providers/imt-services-llc-1365714'),
          ('TX', '9982', '/providers/bailey-insurance-risk-management-inc-9982')
        )
     ) then
    raise exception 'Insurance receipt must be exactly the three created canary bindings, got %', n;
  end if;
end $$;

-- The runtime login cannot select network tables. This read-only wrapper is
-- the same shape as prod_lender_nmls_binding_for. It writes nothing.
do $$ begin
  if to_regrole('myth_v23_prod_reader') is null or to_regrole('myth_v23_authorizer') is null or to_regrole('myth_v23_executor') is null then
    raise exception 'V23_PROD_INSURANCE_RESOLVER_PRECONDITION_FAIL';
  end if;
  if to_regprocedure('v23_private.prod_insurance_state_license_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('prod_insurance_state_license_bindings','prod_insurance_state_license_entities')) then
    raise exception 'V23_PROD_INSURANCE_RESOLVER_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
end $$;

create policy prod_insurance_state_license_bindings on network.network_entity_bindings for select to myth_v23_prod_reader
 using(hub='insurance' and (identifier_namespace='insurance.state_license' or specialist_entity_id ~ '^state-license:[A-Z]{2}:[A-Z0-9]{3,32}$'));
create policy prod_insurance_state_license_entities on network.network_entities for select to myth_v23_prod_reader
 using(exists(select 1 from network.network_entity_bindings b where b.network_entity_id=network_entities.id
   and b.hub='insurance' and (b.identifier_namespace='insurance.state_license' or b.specialist_entity_id ~ '^state-license:[A-Z]{2}:[A-Z0-9]{3,32}$')));

create function v23_private.prod_insurance_state_license_binding_for(native_id text)
returns table(id uuid, network_entity_id uuid, binding_status text, specialist_entity_type text, specialist_entity_id text,
  identifier_namespace text, source_identifier text, jurisdiction text, entity_status text, canonical_public_profile_ref text)
language sql stable security definer set search_path=pg_catalog,network as $$
 select b.id, e.id, b.binding_status, b.specialist_entity_type, b.specialist_entity_id,
   b.identifier_namespace, b.source_identifier, b.jurisdiction, e.status, e.canonical_public_profile_ref
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where split_part($1, ':', 1) = 'state-license'
   and split_part($1, ':', 4) = ''
   and split_part($1, ':', 2) in (
     'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
     'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
     'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
   )
   and split_part($1, ':', 3) ~ '^[A-Z0-9]{3,32}$'
   and split_part($1, ':', 3) ~ '[0-9]'
   and b.hub = 'insurance'
   and b.binding_status in ('accepted','review_required')
   and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
   and (
     b.specialist_entity_id = $1
     or (
       b.jurisdiction = split_part($1, ':', 2)
       and b.source_identifier = split_part($1, ':', 3)
     )
   )
 order by b.id limit 3;
$$;
revoke all on function v23_private.prod_insurance_state_license_binding_for(text) from public, anon, authenticated;
grant execute on function v23_private.prod_insurance_state_license_binding_for(text) to myth_v23_authorizer, myth_v23_executor;
grant create on schema v23_private to myth_v23_prod_reader;
grant myth_v23_prod_reader to current_user with admin false, inherit false, set true granted by current_user;
alter function v23_private.prod_insurance_state_license_binding_for(text) owner to myth_v23_prod_reader;
revoke create on schema v23_private from myth_v23_prod_reader;
revoke myth_v23_prod_reader from current_user granted by current_user;

do $$ begin
  if has_function_privilege('public','v23_private.prod_insurance_state_license_binding_for(text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_insurance_state_license_binding_for(text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_insurance_state_license_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_insurance_state_license_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.prod_insurance_state_license_binding_for(text)','EXECUTE') then
    raise exception 'V23_PROD_INSURANCE_RESOLVER_ACL_FAIL';
  end if;
end $$;

select jurisdiction, license, binding_id, network_entity_id, canonical_public_profile_ref
  from pg_temp.v23insurance_receipt
 order by jurisdiction, license;
commit;
