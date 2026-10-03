-- MY TRUSTHUB V2 — THREE LENDER MARKETPLACE BINDINGS (FORWARD, operator).
-- NOT APPLIED by this build. Broad Lender parent sync stays off.
-- Each insert runs only when that NMLS has zero current lender rows.
-- An existing row aborts the transaction. No name, slug, or email match.
-- Slug is the public return path only.
--
-- The operator sets both guards after a read of 12-ask-prod-lender-nmls-preflight.sql
-- and a NMLS Consumer Access check. This file does not set them.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23bind.nmls_consumer_access_checked','true',false);

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
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
end $$;

insert into network.network_entities (
  entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
) values
  ('organization', 'Pacific Trust Mortgage', 'lender', 'US', '/lenders/pacific-trust-mortgage', 'active'),
  ('organization', 'Metro Home Finance', 'lender', 'US', '/lenders/metro-home-finance', 'active'),
  ('organization', 'Lone Star Lending', 'lender', 'US', '/lenders/lone-star-lending', 'active');

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
  join network.network_entities e
    on e.primary_hub = 'lender'
   and e.canonical_public_profile_ref = v.return_path
   and e.status = 'active';
commit;
