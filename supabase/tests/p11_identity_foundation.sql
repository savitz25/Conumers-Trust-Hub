-- P11B authorization, entity-resolution, and identity-link matrix.
-- Run only against an isolated branch/local database after the P11B migration.
-- Fixtures use reserved example.invalid addresses and are removed before commit.

create temporary table p11_test_results (
  ordinal integer generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;

-- The Supabase SQL executor connects as `postgres`, which is intentionally not
-- a permanent member of the application service roles. Add transaction-scoped
-- memberships for SET ROLE coverage and revoke them before the suite commits.
grant
  myth_identity_governor,
  myth_identity_linker,
  myth_identity_proposer_insurance
to postgres;

create or replace function pg_temp.record_result(
  p_test_name text,
  p_passed boolean,
  p_detail text
)
returns void
language sql
as $$
  insert into p11_test_results(test_name, passed, detail)
  values (p_test_name, p_passed, p_detail);
$$;

create or replace function pg_temp.command_errors(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end;
$$;

-- The matrix deliberately switches into browser and service roles. Grant only
-- this connection-local result sink so each role can report its assertion.
grant select, insert on p11_test_results to
  anon,
  authenticated,
  myth_identity_governor,
  myth_identity_linker,
  myth_identity_proposer_insurance;
grant usage, select on sequence p11_test_results_ordinal_seq to
  anon,
  authenticated,
  myth_identity_governor,
  myth_identity_linker,
  myth_identity_proposer_insurance;

begin;

insert into auth.users(id, aud, role, email, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'p11-consumer-a@example.invalid', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'p11-consumer-b@example.invalid', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'p11-business-only@example.invalid', now(), now());

-- Consumer A creates, reads, and updates their own profile.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into consumer.consumer_profiles(user_id, preferred_zip)
values ('10000000-0000-4000-8000-000000000001', '33432');
select pg_temp.record_result(
  '1 Consumer A reads own profile — ALLOW',
  (select count(*) = 1 from consumer.consumer_profiles),
  'own profile visible'
);
update consumer.consumer_profiles set research_memory_enabled = false;
select pg_temp.record_result(
  '2 Consumer A updates own research-memory flag — ALLOW',
  (select research_memory_enabled = false from consumer.consumer_profiles),
  'allowed column updated'
);
reset role;

-- Consumer B creates their profile, then A cannot see or mutate it.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
insert into consumer.consumer_profiles(user_id, preferred_zip)
values ('10000000-0000-4000-8000-000000000002', '10001');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select pg_temp.record_result(
  '3 Consumer A reads Consumer B profile — DENY',
  (select count(*) = 0 from consumer.consumer_profiles where user_id = '10000000-0000-4000-8000-000000000002'),
  'RLS returned no row'
);
do $$
declare affected integer;
begin
  update consumer.consumer_profiles
     set research_memory_enabled = false
   where user_id = '10000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  perform pg_temp.record_result(
    '4 Consumer A updates Consumer B — DENY',
    affected = 0,
    'RLS affected zero rows'
  );
end;
$$;
reset role;

-- Anonymous has no consumer schema/table access.
set local role anon;
select pg_temp.record_result(
  '5 Anonymous reads consumer profile — DENY',
  pg_temp.command_errors('select * from consumer.consumer_profiles'),
  'permission denied before row access'
);
select pg_temp.record_result(
  '6 Anonymous writes consumer profile — DENY',
  pg_temp.command_errors($sql$
    insert into consumer.consumer_profiles(user_id)
    values ('10000000-0000-4000-8000-000000000003')
  $sql$),
  'permission denied'
);
reset role;

-- A business claim in JWT metadata does not grant consumer access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"business_role":"owner"}}',
  true
);
select pg_temp.record_result(
  '7 Business-only user reads unrelated consumer profile — DENY',
  (select count(*) = 0 from consumer.consumer_profiles),
  'business metadata grants nothing'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"business_role":"owner"}}',
  true
);
select pg_temp.record_result(
  '8 Dual-role user reads own consumer profile — ALLOW',
  (select count(*) = 1 from consumer.consumer_profiles),
  'authorization remains auth-subject ownership'
);
select pg_temp.record_result(
  '9 Dual-role user reads another consumer profile — DENY',
  (select count(*) = 0 from consumer.consumer_profiles where user_id = '10000000-0000-4000-8000-000000000002'),
  'business metadata does not broaden RLS'
);
reset role;

-- Create deterministic registry fixtures as the approved parent governor.
set local role myth_identity_governor;
insert into network.network_entities(id, entity_type, canonical_name, primary_hub, jurisdiction)
values
  ('20000000-0000-4000-8000-000000000001', 'organization', 'Test Roofing Co', 'contractor', 'FL'),
  ('20000000-0000-4000-8000-000000000002', 'organization', 'Test Roofing Successor', 'contractor', 'FL'),
  ('20000000-0000-4000-8000-000000000003', 'organization', 'Test Roofing Canonical', 'contractor', 'FL'),
  ('20000000-0000-4000-8000-000000000004', 'organization', 'Old Reused Identifier Entity', 'contractor', 'FL'),
  ('20000000-0000-4000-8000-000000000005', 'organization', 'New Reused Identifier Entity', 'contractor', 'FL');

insert into network.network_entity_bindings(
  id, network_entity_id, hub, specialist_entity_type, specialist_entity_id,
  identifier_namespace, source_identifier, jurisdiction, binding_status,
  confidence, valid_from, provenance_ref
) values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'contractor', 'contractor', 'contractor-test-1',
  'contractor.fl.dbpr.license', 'TEST-LIC-001', 'FL', 'accepted',
  1.0, '2026-01-01T00:00:00Z', 'fixture:p11:accepted'
);
reset role;

-- Browser cannot mutate identity graph.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select pg_temp.record_result(
  '10 Browser user inserts accepted network binding — DENY',
  pg_temp.command_errors($sql$
    insert into network.network_entity_bindings(
      network_entity_id, hub, specialist_entity_type, specialist_entity_id,
      identifier_namespace, source_identifier, binding_status, valid_from, provenance_ref
    ) values (
      '20000000-0000-4000-8000-000000000001', 'contractor', 'contractor', 'browser-write',
      'contractor.fl.dbpr.license', 'BROWSER-1', 'accepted', now(), 'fixture:browser'
    )
  $sql$),
  'network schema has no browser usage or mutation grant'
);
select pg_temp.record_result(
  '11 Browser user creates entity redirect — DENY',
  pg_temp.command_errors($sql$
    select network.create_entity_redirect(
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'browser attempt'
    )
  $sql$),
  'redirect function is not executable by browser roles'
);
reset role;

-- Hub-scoped proposer can propose only review-required bindings for its own hub.
set local role myth_identity_proposer_insurance;
insert into network.network_entity_bindings(
  id, network_entity_id, hub, specialist_entity_type, specialist_entity_id,
  identifier_namespace, source_identifier, jurisdiction, binding_status,
  confidence, valid_from, provenance_ref
) values (
  '30000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'insurance', 'agency', 'insurance-test-1',
  'insurance.fl.dfs.agency', 'TEST-AGENCY-001', 'FL', 'review_required',
  0.7000, '2026-01-01T00:00:00Z', 'fixture:p11:review'
);
select pg_temp.record_result(
  '12 Approved specialist identity service creates review-required binding — ALLOW',
  (select count(*) = 1 from network.network_entity_bindings where id = '30000000-0000-4000-8000-000000000002'),
  'hub-scoped review proposal inserted'
);
select pg_temp.record_result(
  '12a Specialist proposer cannot self-accept binding — DENY',
  pg_temp.command_errors($sql$
    insert into network.network_entity_bindings(
      network_entity_id, hub, specialist_entity_type, specialist_entity_id,
      identifier_namespace, source_identifier, jurisdiction, binding_status,
      valid_from, provenance_ref
    ) values (
      '20000000-0000-4000-8000-000000000001', 'insurance', 'agency', 'self-accepted',
      'insurance.fl.dfs.agency', 'SELF-ACCEPTED', 'FL', 'accepted', now(), 'fixture:self-accept'
    )
  $sql$),
  'RLS requires review_required'
);
select pg_temp.record_result(
  '13 Specialist-scoped service cannot enumerate consumer profiles — DENY',
  pg_temp.command_errors('select * from consumer.consumer_profiles'),
  'no consumer schema privilege'
);
reset role;

-- Explicit network privileges prove consumer actions cannot write identity/ranking inputs.
select pg_temp.record_result(
  '14 Consumer has no network mutation privilege — DENY',
  not has_schema_privilege('authenticated', 'network', 'USAGE')
  and not has_table_privilege('authenticated', 'network.network_entities', 'INSERT')
  and not has_table_privilege('authenticated', 'network.network_entity_bindings', 'INSERT'),
  'no browser path into identity or future ranking inputs'
);

-- Entity resolution and Watch-identity eligibility.
set local role myth_identity_governor;
select pg_temp.record_result(
  'E1 Accepted binding resolves to network entity',
  (select network_entity_id = '20000000-0000-4000-8000-000000000001'
     and binding_status = 'accepted'
     and watch_identity_eligible
   from network.resolve_entity_binding('contractor', 'contractor', 'contractor-test-1', '2026-09-07T00:00:00Z')),
  'accepted current binding is eligible'
);
select pg_temp.record_result(
  'E2 review_required binding is distinguishable and not Watch-eligible',
  (select binding_status = 'review_required' and not watch_identity_eligible
   from network.resolve_entity_binding('insurance', 'agency', 'insurance-test-1', '2026-09-07T00:00:00Z')),
  'review state returned without accepted semantics'
);

insert into network.network_entity_bindings(
  id, network_entity_id, hub, specialist_entity_type, specialist_entity_id,
  identifier_namespace, source_identifier, jurisdiction, binding_status,
  valid_from, provenance_ref
) values (
  '30000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  'contractor', 'contractor', 'invalid-test',
  'contractor.fl.dbpr.license', 'INVALID-1', 'FL', 'invalid',
  '2026-01-01T00:00:00Z', 'fixture:p11:invalid'
);
select pg_temp.record_result(
  'E3 Invalid binding does not resolve as accepted',
  (select binding_status = 'invalid' and not watch_identity_eligible
   from network.resolve_entity_binding('contractor', 'contractor', 'invalid-test', '2026-09-07T00:00:00Z')),
  'invalid state is explicit and ineligible'
);

select pg_temp.record_result(
  'E4 Duplicate exact accepted binding is rejected',
  pg_temp.command_errors($sql$
    insert into network.network_entity_bindings(
      network_entity_id, hub, specialist_entity_type, specialist_entity_id,
      identifier_namespace, source_identifier, jurisdiction, binding_status,
      valid_from, provenance_ref
    ) values (
      '20000000-0000-4000-8000-000000000001', 'contractor', 'contractor', 'contractor-test-1',
      'contractor.fl.dbpr.license', 'TEST-LIC-001', 'FL', 'accepted',
      '2026-01-01T00:00:00Z', 'fixture:p11:duplicate'
    )
  $sql$),
  'unique/exclusion constraints reject duplicate'
);

insert into network.network_entity_bindings(
  id, network_entity_id, hub, specialist_entity_type, specialist_entity_id,
  identifier_namespace, source_identifier, jurisdiction, binding_status,
  valid_from, valid_to, provenance_ref
) values (
  '30000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000004',
  'contractor', 'license', 'reuse-old',
  'contractor.fl.dbpr.license', 'REUSE-001', 'FL', 'accepted',
  '2020-01-01T00:00:00Z', '2021-01-01T00:00:00Z', 'fixture:p11:reuse-old'
), (
  '30000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000005',
  'contractor', 'license', 'reuse-new',
  'contractor.fl.dbpr.license', 'REUSE-001', 'FL', 'accepted',
  '2021-01-01T00:00:00Z', null, 'fixture:p11:reuse-new'
);
select pg_temp.record_result(
  'E5 Non-overlapping validity ranges permit identifier reuse',
  (select count(*) = 2 from network.network_entity_bindings
    where identifier_namespace = 'contractor.fl.dbpr.license'
      and source_identifier_normalized = 'reuse-001'
      and binding_status = 'accepted'),
  'old and new real-world entities remain distinct'
);
select pg_temp.record_result(
  'E6 Overlapping accepted identifier validity is rejected',
  pg_temp.command_errors($sql$
    insert into network.network_entity_bindings(
      network_entity_id, hub, specialist_entity_type, specialist_entity_id,
      identifier_namespace, source_identifier, jurisdiction, binding_status,
      valid_from, valid_to, provenance_ref
    ) values (
      '20000000-0000-4000-8000-000000000003', 'contractor', 'license', 'reuse-overlap',
      'contractor.fl.dbpr.license', 'REUSE-001', 'FL', 'accepted',
      '2020-06-01T00:00:00Z', '2022-01-01T00:00:00Z', 'fixture:p11:reuse-overlap'
    )
  $sql$),
  'GiST exclusion constraint prevents hijack window'
);

select network.create_entity_redirect(
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'P11 fixture merge one'
);
select network.create_entity_redirect(
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  'P11 fixture merge two'
);
select pg_temp.record_result(
  'E7 Redirect resolves deterministically to terminal canonical entity',
  network.resolve_canonical_entity('20000000-0000-4000-8000-000000000001') = '20000000-0000-4000-8000-000000000003',
  'two-hop redirect resolves terminal entity'
);
select pg_temp.record_result(
  'E8 Redirect loop is rejected',
  pg_temp.command_errors($sql$
    select network.create_entity_redirect(
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      'cycle attempt'
    )
  $sql$),
  'canonical target resolution detects cycle'
);

insert into network.network_entity_bindings(
  id, network_entity_id, hub, specialist_entity_type, specialist_entity_id,
  identifier_namespace, source_identifier, jurisdiction, binding_status,
  valid_from, provenance_ref
) values (
  '30000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000003',
  'insurance', 'agency', 'cross-hub-agency-1',
  'insurance.fl.dfs.agency', 'CROSS-HUB-1', 'FL', 'accepted',
  '2026-01-01T00:00:00Z', 'fixture:p11:cross-hub'
);
select pg_temp.record_result(
  'E9 Cross-hub bindings can point to one canonical entity',
  (select count(distinct network.resolve_canonical_entity(network_entity_id)) = 1
   from network.network_entity_bindings
   where id in (
     '30000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000006'
   )),
  'hub identities converge only through reviewed canonicalization'
);
select pg_temp.record_result(
  'E10 Governance audit records bindings and redirects',
  (select count(*) >= 8 from network.identity_governance_events),
  'append-only governance events present'
);
reset role;

-- Canonical-to-legacy identity links are explicit and never email-derived.
set local role myth_identity_linker;
select ops.link_legacy_consumer_identity(
  '10000000-0000-4000-8000-000000000001',
  'move',
  'supabase:arepfylnilkjmyduhwbz',
  '90000000-0000-4000-8000-000000000001',
  'reauthenticated_legacy_session',
  'fixture:p11:legacy-move-proof'
);
select pg_temp.record_result(
  'L1 Verified legacy subject links to canonical parent subject',
  (select count(*) = 1 from ops.consumer_identity_links
    where canonical_user_id = '10000000-0000-4000-8000-000000000001'
      and legacy_subject_namespace = 'supabase:arepfylnilkjmyduhwbz'),
  'legacy UUID stored as an opaque mapping, not reused as canonical ID'
);

select ops.link_legacy_consumer_identity(
  '10000000-0000-4000-8000-000000000001',
  'insurance',
  'supabase:gojyhmbojbwbpiamoktq',
  '90000000-0000-4000-8000-000000000002',
  'signed_handoff',
  'fixture:p11:legacy-insurance-proof'
);
select pg_temp.record_result(
  'L2 One canonical subject may link multiple vertical subjects',
  (select count(*) = 2 from ops.consumer_identity_links
    where canonical_user_id = '10000000-0000-4000-8000-000000000001'),
  'links do not change canonical auth.users.id'
);
select pg_temp.record_result(
  'L3 One legacy subject cannot link to two canonical subjects',
  pg_temp.command_errors($sql$
    select ops.link_legacy_consumer_identity(
      '10000000-0000-4000-8000-000000000002',
      'move',
      'supabase:arepfylnilkjmyduhwbz',
      '90000000-0000-4000-8000-000000000001',
      'admin_review',
      'fixture:p11:duplicate-legacy-proof'
    )
  $sql$),
  'unique legacy namespace/subject prevents reassignment'
);
select pg_temp.record_result(
  'L4 Email-only identity linking is rejected',
  pg_temp.command_errors($sql$
    select ops.link_legacy_consumer_identity(
      '10000000-0000-4000-8000-000000000002',
      'insurance',
      'supabase:gojyhmbojbwbpiamoktq',
      'email-derived-subject',
      'email_match',
      'fixture:p11:email-only'
    )
  $sql$),
  'verification method allowlist excludes email matching'
);
select pg_temp.record_result(
  'L5 Identity-link audit events are written',
  (select count(*) = 2 from ops.consumer_identity_link_events where action = 'linked'),
  'each successful explicit link is audited'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select pg_temp.record_result(
  'L6 Browser consumer cannot enumerate identity links',
  pg_temp.command_errors('select * from ops.consumer_identity_links'),
  'ops schema remains server-only'
);
reset role;

-- Cleanup all deterministic fixtures before committing the successful test run.
delete from ops.consumer_identity_link_events;
delete from ops.consumer_identity_links;
delete from network.identity_governance_events;
delete from network.network_entity_redirects;
delete from network.network_entity_bindings;
delete from network.network_entities;
delete from consumer.consumer_profiles;
delete from auth.users where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
);

revoke
  myth_identity_governor,
  myth_identity_linker,
  myth_identity_proposer_insurance
from postgres;

commit;

select ordinal, test_name, passed, detail
from p11_test_results
order by ordinal;
