-- MY TRUSTHUB V2 — THREE SENIOR CMS CCN BINDINGS (FORWARD, operator).
-- Packet 17. NOT APPLIED by this build. Senior parent sync and the canary stay
-- off. Senior migration 0036 is not applied here. No production keys are
-- created here. No account-context SQL is in this packet (packet 15 owns it).
--
-- CMS nursing-home profiles only: hub senior, class cms_facility, namespace
-- cms.ccn, specialist id = source identifier = the exact CCN, jurisdiction US.
-- Each insert runs only when that exact CCN has zero current Senior rows and
-- none of the three exact canonical profile refs is already an active entity.
-- An existing row aborts the transaction. No name, address, slug, email, or
-- UUID match. No merge. The slug is the public return path only.
--
-- The operator sets both guards after a read of
-- 17-ask-prod-senior-ccn-preflight.sql. This file does not set them.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.senior_ccn_checked','true',false);
--
-- The statement result is the rollback target. One receipt row per created binding:
--   ccn, binding_id, network_entity_id, canonical_public_profile_ref
-- The same rows remain in pg_temp.v23senior_receipt until the session ends.
--   \copy (select ccn, binding_id, network_entity_id, canonical_public_profile_ref
--          from pg_temp.v23senior_receipt order by ccn) to '17-receipt-<date>.csv' csv header

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
lock table network.network_entities, network.network_entity_bindings in share row exclusive mode;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if current_setting('v23bind.senior_ccn_checked', true) is distinct from 'true' then
    raise exception 'Confirm each exact CMS CCN before creating bindings';
  end if;
  if exists (
    select 1 from network.network_entity_bindings
     where (valid_to is null or valid_to > statement_timestamp())
       and (
         (hub = 'senior' and lower(btrim(specialist_entity_id)) in ('015009', '055223', '155805'))
         or (hub = 'senior' and source_identifier_normalized in ('015009', '055223', '155805'))
         or (identifier_namespace = 'cms.ccn' and source_identifier_normalized in ('015009', '055223', '155805'))
       )
  ) then
    raise exception 'Existing Senior CMS CCN binding requires steward review; no merge';
  end if;
  if exists (
    select 1 from network.network_entities
     where status = 'active'
       and canonical_public_profile_ref in (
         '/facility/cms/015009/burns-nursing-home-inc',
         '/facility/cms/055223/san-jacinto-valley-post-acute',
         '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center'
       )
  ) then
    raise exception 'Existing canonical profile ref requires steward review; no merge';
  end if;
end $$;

create temp table v23senior_receipt (
  ccn text primary key,
  binding_id uuid not null unique,
  network_entity_id uuid not null unique,
  canonical_public_profile_ref text not null unique
) on commit preserve rows;

with canary(ccn, facility_name, profile_ref) as (values
    ('015009', 'BURNS NURSING HOME, INC.', '/facility/cms/015009/burns-nursing-home-inc'),
    ('055223', 'SAN JACINTO VALLEY POST ACUTE', '/facility/cms/055223/san-jacinto-valley-post-acute'),
    ('155805', 'ADDISON POINTE HEALTH & REHABILITATION CENTER', '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center')
), inserted_entity as (
  insert into network.network_entities (
    entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
  )
  select 'organization', facility_name, 'senior', 'US', profile_ref, 'active' from canary
  returning id, canonical_public_profile_ref
), inserted_binding as (
  insert into network.network_entity_bindings (
    network_entity_id, hub, specialist_entity_type, specialist_entity_id,
    identifier_namespace, source_identifier, jurisdiction, binding_status,
    valid_from, provenance_ref, resolution_note
  )
  select e.id, 'senior', 'cms_facility', c.ccn,
         'cms.ccn', c.ccn, 'US', 'accepted', transaction_timestamp(),
         'senior_trust_hub_cms_provider_information',
         'Published CMS nursing-home profile. Exact CMS CCN. Slug is the return path only.'
    from canary c
    join inserted_entity e on e.canonical_public_profile_ref = c.profile_ref
  returning id, network_entity_id, source_identifier
)
insert into pg_temp.v23senior_receipt (
  ccn, binding_id, network_entity_id, canonical_public_profile_ref
)
select b.source_identifier, b.id, b.network_entity_id, e.canonical_public_profile_ref
  from inserted_binding b
  join inserted_entity e on e.id = b.network_entity_id;

do $$ declare n integer; begin
  select count(*) into n from pg_temp.v23senior_receipt;
  if n <> 3
     or exists (
       select 1 from pg_temp.v23senior_receipt
        where (ccn, canonical_public_profile_ref) not in (
          ('015009', '/facility/cms/015009/burns-nursing-home-inc'),
          ('055223', '/facility/cms/055223/san-jacinto-valley-post-acute'),
          ('155805', '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center')
        )
     ) then
    raise exception 'Senior receipt must be exactly the three created canary bindings, got %', n;
  end if;
end $$;

-- The runtime login cannot select network tables. This read-only wrapper
-- writes nothing. It returns every current Senior row that claims this CCN in
-- either identifier column, so the caller can fail closed on disagreement,
-- another class, or ambiguity. It never reads another hub.
do $$ begin
  if to_regrole('myth_v23_prod_reader') is null or to_regrole('myth_v23_authorizer') is null or to_regrole('myth_v23_executor') is null then
    raise exception 'V23_PROD_SENIOR_RESOLVER_PRECONDITION_FAIL';
  end if;
  if to_regprocedure('v23_private.prod_senior_ccn_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('prod_senior_ccn_bindings','prod_senior_ccn_entities')) then
    raise exception 'V23_PROD_SENIOR_RESOLVER_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
end $$;

create policy prod_senior_ccn_bindings on network.network_entity_bindings for select to myth_v23_prod_reader
 using(hub='senior' and (identifier_namespace='cms.ccn' or specialist_entity_id ~ '^[A-Za-z0-9]{6}$'));
create policy prod_senior_ccn_entities on network.network_entities for select to myth_v23_prod_reader
 using(exists(select 1 from network.network_entity_bindings b where b.network_entity_id=network_entities.id
   and b.hub='senior' and (b.identifier_namespace='cms.ccn' or b.specialist_entity_id ~ '^[A-Za-z0-9]{6}$')));

create function v23_private.prod_senior_ccn_binding_for(native_id text)
returns table(id uuid, network_entity_id uuid, binding_status text, specialist_entity_type text, specialist_entity_id text,
  identifier_namespace text, source_identifier text, jurisdiction text, entity_status text, canonical_public_profile_ref text)
language sql stable security definer set search_path=pg_catalog,network as $$
 select b.id, e.id, b.binding_status, b.specialist_entity_type, b.specialist_entity_id,
   b.identifier_namespace, b.source_identifier, b.jurisdiction, e.status, e.canonical_public_profile_ref
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where $1 ~ '^[A-Za-z0-9]{6}$'
   and b.hub = 'senior'
   and b.binding_status in ('accepted','review_required')
   and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
   and (
     lower(btrim(b.specialist_entity_id)) = lower(btrim($1))
     or (b.identifier_namespace = 'cms.ccn' and b.source_identifier_normalized = lower(btrim($1)))
   )
 order by b.id limit 3;
$$;
revoke all on function v23_private.prod_senior_ccn_binding_for(text) from public, anon, authenticated;
grant execute on function v23_private.prod_senior_ccn_binding_for(text) to myth_v23_authorizer, myth_v23_executor;
grant create on schema v23_private to myth_v23_prod_reader;
grant myth_v23_prod_reader to current_user with admin false, inherit false, set true granted by current_user;
alter function v23_private.prod_senior_ccn_binding_for(text) owner to myth_v23_prod_reader;
revoke create on schema v23_private from myth_v23_prod_reader;
revoke myth_v23_prod_reader from current_user granted by current_user;

do $$ begin
  if has_function_privilege('public','v23_private.prod_senior_ccn_binding_for(text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_senior_ccn_binding_for(text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_senior_ccn_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_senior_ccn_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.prod_senior_ccn_binding_for(text)','EXECUTE') then
    raise exception 'V23_PROD_SENIOR_RESOLVER_ACL_FAIL';
  end if;
end $$;

select ccn, binding_id, network_entity_id, canonical_public_profile_ref
  from pg_temp.v23senior_receipt
 order by ccn;
commit;
