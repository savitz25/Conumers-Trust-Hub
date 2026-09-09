-- P12 Saved/Project/note/guest-import matrix.
-- Run only on an isolated branch after P11 + P12 migrations.

create temporary table p12_test_results (
  ordinal integer generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;

create temporary table p12_ids (key text primary key, value uuid not null) on commit preserve rows;
create temporary table p12_counts (key text primary key, value bigint not null) on commit preserve rows;
create temporary table p12_payloads (key text primary key, payload jsonb not null) on commit preserve rows;
create temporary table p12_preview (
  client_item_id text, item_status text, valid boolean, importable boolean,
  binding_id uuid, network_entity_id uuid, existing_saved_entity_id uuid,
  project_assignment_eligible boolean
) on commit preserve rows;

create or replace function pg_temp.p12_result(p_name text, p_passed boolean, p_detail text)
returns void language sql as $$
  insert into p12_test_results(test_name, passed, detail) values (p_name, p_passed, p_detail);
$$;

create or replace function pg_temp.p12_errors(p_sql text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end;
$$;

-- Keep the P12 regression invariant valid when later migrations add Watches.
-- Dynamic SQL lets this suite also run against a P11 + P12-only database where
-- consumer.consumer_watches does not exist yet.
create or replace function pg_temp.p12_watch_count(p_user_id uuid)
returns bigint language plpgsql as $$
declare
  watch_count bigint;
begin
  if to_regclass('consumer.consumer_watches') is null then
    return 0;
  end if;

  execute 'select count(*) from consumer.consumer_watches where user_id = $1'
    into watch_count
    using p_user_id;
  return watch_count;
end;
$$;

grant myth_identity_governor to postgres;
grant select, insert on p12_test_results, p12_ids, p12_counts, p12_payloads, p12_preview to anon, authenticated, myth_identity_governor;
grant update, delete on p12_ids, p12_counts, p12_payloads, p12_preview to authenticated, myth_identity_governor;
grant usage, select on sequence p12_test_results_ordinal_seq to anon, authenticated, myth_identity_governor;

begin;

insert into auth.users(id, aud, role, email, created_at, updated_at)
values
  ('11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'p12-a@example.invalid', now(), now()),
  ('11000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'p12-b@example.invalid', now(), now()),
  ('11000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'p12-business@example.invalid', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
insert into consumer.consumer_profiles(user_id) values ('11000000-0000-4000-8000-000000000001');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
insert into consumer.consumer_profiles(user_id) values ('11000000-0000-4000-8000-000000000002');
reset role;

set local role myth_identity_governor;
insert into network.network_entities(id, entity_type, canonical_name, primary_hub, jurisdiction, status)
values
  ('21000000-0000-4000-8000-000000000001', 'organization', 'P12 Accepted Provider', 'contractor', 'FL', 'active'),
  ('21000000-0000-4000-8000-000000000002', 'organization', 'P12 Review Provider', 'insurance', 'FL', 'active'),
  ('21000000-0000-4000-8000-000000000003', 'organization', 'P12 Invalid Provider', 'senior', 'FL', 'active'),
  ('21000000-0000-4000-8000-000000000004', 'organization', 'P12 Redirect Source', 'contractor', 'FL', 'active'),
  ('21000000-0000-4000-8000-000000000005', 'organization', 'P12 Redirect Target', 'contractor', 'FL', 'active'),
  ('21000000-0000-4000-8000-000000000006', 'organization', 'P12 Guest Accepted', 'lender', 'US', 'active'),
  ('21000000-0000-4000-8000-000000000007', 'organization', 'P12 Guest Review', 'insurance', 'FL', 'active'),
  ('21000000-0000-4000-8000-000000000008', 'organization', 'P12 Removable', 'move', 'US', 'active');

insert into network.network_entity_bindings(
  id, network_entity_id, hub, specialist_entity_type, specialist_entity_id,
  identifier_namespace, source_identifier, jurisdiction, binding_status,
  valid_from, provenance_ref
) values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'contractor', 'company', 'p12-accepted', 'contractor.demo.id', 'P12-A', 'FL', 'accepted', '2026-01-01', 'fixture:p12'),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'insurance', 'agency', 'p12-review', 'insurance.demo.id', 'P12-R', 'FL', 'review_required', '2026-01-01', 'fixture:p12'),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000003', 'senior', 'provider', 'p12-invalid', 'senior.demo.id', 'P12-I', 'FL', 'invalid', '2026-01-01', 'fixture:p12'),
  ('31000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000004', 'contractor', 'company', 'p12-redirect', 'contractor.demo.id', 'P12-D', 'FL', 'accepted', '2026-01-01', 'fixture:p12'),
  ('31000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000006', 'lender', 'company', 'p12-guest-accepted', 'lender.demo.id', 'P12-GA', 'US', 'accepted', '2026-01-01', 'fixture:p12'),
  ('31000000-0000-4000-8000-000000000007', '21000000-0000-4000-8000-000000000007', 'insurance', 'agency', 'p12-guest-review', 'insurance.demo.id', 'P12-GR', 'FL', 'review_required', '2026-01-01', 'fixture:p12'),
  ('31000000-0000-4000-8000-000000000008', '21000000-0000-4000-8000-000000000008', 'move', 'carrier', 'p12-removable', 'move.demo.id', 'P12-M', 'US', 'accepted', '2026-01-01', 'fixture:p12');
insert into p12_counts values ('network_before_consumer_writes', (select count(*) from network.identity_governance_events));
reset role;

-- SAVED 1-9
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
insert into p12_ids
select 'saved_accepted', saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000001', 'contractor', '{"entry":"profile"}');
select pg_temp.p12_result('1 Consumer A saves accepted entity - ALLOW',
  (select count(*) = 1 from consumer.consumer_saved_entities where id = (select value from p12_ids where key='saved_accepted') and identity_resolution_state='accepted' and removed_at is null),
  'one active Save created');
insert into p12_ids
select 'saved_duplicate', saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000001', 'contractor', '{"entry":"profile"}');
select pg_temp.p12_result('2 Duplicate Save deduplicates deterministically',
  (select value from p12_ids where key='saved_accepted') = (select value from p12_ids where key='saved_duplicate')
  and (select count(*) = 1 from consumer.consumer_saved_entities where user_id='11000000-0000-4000-8000-000000000001' and network_entity_id='21000000-0000-4000-8000-000000000001'),
  'same durable Saved row returned');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
select pg_temp.p12_result('3 Consumer B cannot read A Saved', (select count(*)=0 from consumer.consumer_saved_entities), 'RLS filters A rows');
reset role;
set local role anon;
select pg_temp.p12_result('4 Anonymous cannot read Saved', pg_temp.p12_errors('select * from consumer.consumer_saved_entities'), 'schema/table access denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"business_role":"owner"}}', true);
select pg_temp.p12_result('5 Business-only user cannot read A Saved', (select count(*)=0 from consumer.consumer_saved_entities), 'business metadata grants nothing');
reset role;

select pg_temp.p12_result(
  '6 Save creates no Watch',
  pg_temp.p12_watch_count('11000000-0000-4000-8000-000000000001') = 0,
  'Save created zero Watch rows'
);
select pg_temp.p12_result('7 Save does not change network/public ranking data',
  (select value from p12_counts where key='network_before_consumer_writes') = (select count(*) from network.identity_governance_events)
  and not exists (select 1 from information_schema.columns where table_schema='network' and column_name in ('rank','ranking','trust_score')),
  'consumer Save has no network write or ranking column');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
insert into p12_ids select 'saved_review', saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000002', 'insurance', null);
select pg_temp.p12_result('8 Review-required entity Save matches contract',
  (select identity_resolution_state='review_required' from consumer.consumer_saved_entities where id=(select value from p12_ids where key='saved_review')),
  'research preserved with explicit review state');
insert into p12_ids select 'saved_redirect', saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000004', 'contractor', null);
reset role;
set local role myth_identity_governor;
select network.create_entity_redirect('21000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000005', 'P12 redirect test');
insert into p12_counts values ('network_after_redirect', (select count(*) from network.identity_governance_events));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select pg_temp.p12_result('9 Redirected Saved entity resolves canonically',
  (select resolved_network_entity_id='21000000-0000-4000-8000-000000000005' and stored_network_entity_id='21000000-0000-4000-8000-000000000004' from consumer.list_saved_entities() where saved_entity_id=(select value from p12_ids where key='saved_redirect')),
  'durable stored reference resolves to terminal entity');

-- PROJECTS 10-15
insert into p12_ids values ('project_a', consumer.create_project('41000000-0000-4000-8000-000000000001', 'Buying a home in Boca Raton', 'buying_home', '{"schema_version":"1","zip":"33432","city":"Boca Raton","state":"FL"}', '2026-10-18'));
insert into p12_ids values ('project_b', consumer.create_project('41000000-0000-4000-8000-000000000002', 'Protecting what matters', 'protecting', '{"schema_version":"1","zip":"33432"}', null));
select pg_temp.p12_result('10 A creates Project', (select count(*)=2 from consumer.consumer_projects), 'two valid Projects created');
select pg_temp.p12_result('12 A edits own Project',
  consumer.update_project((select value from p12_ids where key='project_a'), 1, 'Boca home purchase', '{"schema_version":"1","zip":"33432","state":"FL"}', '2026-10-18')=2,
  'optimistic version advanced');
select pg_temp.p12_result('12a Stale Project update is rejected',
  pg_temp.p12_errors(format('select consumer.update_project(%L, 1, %L, %L::jsonb, null)', (select value from p12_ids where key='project_a'), 'stale', '{"schema_version":"1"}')),
  'row_version protects concurrent updates');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
select pg_temp.p12_result('11 B cannot read A Project', (select count(*)=0 from consumer.consumer_projects), 'RLS filters Projects');
select pg_temp.p12_result('15 Invalid life_event rejected',
  pg_temp.p12_errors($sql$select consumer.create_project('41000000-0000-4000-8000-000000000099','Invalid','not_a_template',null,null)$sql$),
  'life event allowlist enforced');
reset role;

-- MEMBERSHIP 16-21 and archive/restore 13-14
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select pg_temp.p12_result('16 Add Saved to own Project', consumer.add_saved_entity_to_project((select value from p12_ids where key='project_a'),(select value from p12_ids where key='saved_accepted'),'contractor'), 'membership inserted');
select pg_temp.p12_result('17 Add same Saved twice is idempotent',
  not consumer.add_saved_entity_to_project((select value from p12_ids where key='project_a'),(select value from p12_ids where key='saved_accepted'),'contractor')
  and (select count(*)=1 from consumer.consumer_project_saved_entities where project_id=(select value from p12_ids where key='project_a') and saved_entity_id=(select value from p12_ids where key='saved_accepted')),
  'composite durable row remains one');
select consumer.add_saved_entity_to_project((select value from p12_ids where key='project_b'),(select value from p12_ids where key='saved_accepted'),'insurance');
select pg_temp.p12_result('18 One Saved belongs to two Projects',
  (select count(*)=2 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p12_ids where key='saved_accepted') and removed_at is null)
  and (select count(*)=1 from consumer.consumer_saved_entities where id=(select value from p12_ids where key='saved_accepted')),
  'two memberships, one Save');
select consumer.archive_project((select value from p12_ids where key='project_a'),2);
select pg_temp.p12_result('13 A archives Project',
  (select status='archived' and row_version=3 from consumer.consumer_projects where id=(select value from p12_ids where key='project_a')),
  'active became archived');
select consumer.restore_project((select value from p12_ids where key='project_a'),3);
select pg_temp.p12_result('14 Restore preserves relationships',
  (select status='active' and row_version=4 from consumer.consumer_projects where id=(select value from p12_ids where key='project_a'))
  and (select count(*)=1 from consumer.consumer_project_saved_entities where project_id=(select value from p12_ids where key='project_a') and removed_at is null),
  'membership survived archive/restore');
select consumer.remove_saved_entity_from_project((select value from p12_ids where key='project_a'),(select value from p12_ids where key='saved_accepted'));
select pg_temp.p12_result('19 Remove from one leaves other membership',
  (select count(*)=1 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p12_ids where key='saved_accepted') and removed_at is null),
  'Project B remains active');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
select pg_temp.p12_result('20 Cross-user membership denied',
  pg_temp.p12_errors(format('select consumer.add_saved_entity_to_project(%L,%L,null)', (select value from p12_ids where key='project_a'), (select value from p12_ids where key='saved_accepted'))),
  'service ownership guard rejects cross-user IDs');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select consumer.remove_saved_entity_from_project((select value from p12_ids where key='project_b'),(select value from p12_ids where key='saved_accepted'));
select pg_temp.p12_result('21 No membership leaves Saved Unfiled',
  (select count(*)=0 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p12_ids where key='saved_accepted') and removed_at is null)
  and (select removed_at is null from consumer.consumer_saved_entities where id=(select value from p12_ids where key='saved_accepted')),
  'Save remains active with no Project');

-- Guest payloads and preview 27, 30-31, 37-40
insert into p12_payloads values (
  'main', jsonb_build_object(
    'version','mytrusthub-guest/v1','generated_at',statement_timestamp(),
    'expires_at',statement_timestamp()+interval '30 days','items',jsonb_build_array(
      jsonb_build_object('client_item_id','accepted','item_type','saved_entity','hub','lender','specialist_entity_type','company','specialist_entity_id','p12-guest-accepted'),
      jsonb_build_object('client_item_id','duplicate','item_type','saved_entity','hub','contractor','specialist_entity_type','company','specialist_entity_id','p12-accepted'),
      jsonb_build_object('client_item_id','review','item_type','saved_entity','hub','insurance','specialist_entity_type','agency','specialist_entity_id','p12-guest-review'),
      jsonb_build_object('client_item_id','unresolved','item_type','saved_entity','hub','move','specialist_entity_type','carrier','specialist_entity_id','does-not-exist'),
      jsonb_build_object('client_item_id','invalid','item_type','saved_entity','hub','senior','specialist_entity_type','provider','specialist_entity_id','p12-invalid'),
      jsonb_build_object('client_item_id','deselected','item_type','saved_entity','hub','move','specialist_entity_type','carrier','specialist_entity_id','p12-removable')
    )
  )
);
insert into p12_counts values ('save_before_preview',(select count(*) from consumer.consumer_saved_entities)),('receipt_before_preview',(select count(*) from consumer.consumer_guest_imports));
insert into p12_preview select * from consumer.preview_guest_import((select payload from p12_payloads where key='main'));
select pg_temp.p12_result('27 Preview performs no mutation',
  (select value from p12_counts where key='save_before_preview')=(select count(*) from consumer.consumer_saved_entities)
  and (select value from p12_counts where key='receipt_before_preview')=(select count(*) from consumer.consumer_guest_imports),
  'preview is read-only');
select pg_temp.p12_result('30 Unresolved item not importable', (select item_status='unresolved' and not importable from p12_preview where client_item_id='unresolved'), 'unresolved is explicit');
select pg_temp.p12_result('31 Review-required preview matches contract', (select item_status='review_required' and importable from p12_preview where client_item_id='review'), 'Save allowed with review state');
select pg_temp.p12_result('37 Oversized payload rejected',
  pg_temp.p12_errors($sql$select consumer.validate_guest_payload(jsonb_build_object('version','mytrusthub-guest/v1','generated_at',now(),'expires_at',now()+interval '1 day','items','[]'::jsonb,'padding',repeat('x',262145)))$sql$),
  '256 KB limit enforced before schema acceptance');
select pg_temp.p12_result('38 Invalid schema version rejected',
  pg_temp.p12_errors($sql$select consumer.validate_guest_payload(jsonb_build_object('version','mytrusthub-guest/v2','generated_at',now(),'expires_at',now()+interval '1 day','items','[]'::jsonb))$sql$),
  'version is required and closed');
select pg_temp.p12_result('39 Expired guest payload rejected',
  pg_temp.p12_errors($sql$select consumer.validate_guest_payload(jsonb_build_object('version','mytrusthub-guest/v1','generated_at',now()-interval '2 days','expires_at',now()-interval '1 day','items','[]'::jsonb))$sql$),
  'expired payload denied');
select pg_temp.p12_result('40 Raw auth token field rejected',
  pg_temp.p12_errors($sql$select consumer.validate_guest_payload(jsonb_build_object('version','mytrusthub-guest/v1','generated_at',now(),'expires_at',now()+interval '1 day','items','[]'::jsonb,'access_token','secret'))$sql$),
  'allowlisted schema rejects credential fields');

-- Guest commit 28-36
insert into p12_ids
select 'guest_import', import_id from consumer.commit_guest_import(
  (select payload from p12_payloads where key='main'),
  array['accepted','duplicate','review','unresolved','invalid'],
  '51000000-0000-4000-8000-000000000001', null
);
select pg_temp.p12_result('28 Accepted guest item import works',
  (select count(*)=1 from consumer.consumer_guest_import_items where import_id=(select value from p12_ids where key='guest_import') and client_item_id='accepted' and result_status='imported'),
  'selected accepted item created one Save');
select pg_temp.p12_result('29 Duplicate resolves existing Saved',
  (select saved_entity_id=(select value from p12_ids where key='saved_accepted') and result_status='duplicate' from consumer.consumer_guest_import_items where import_id=(select value from p12_ids where key='guest_import') and client_item_id='duplicate'),
  'existing durable Save referenced');
select pg_temp.p12_result('31a Review-required guest item imports with state',
  (select s.identity_resolution_state='review_required' from consumer.consumer_guest_import_items gi join consumer.consumer_saved_entities s on s.id=gi.saved_entity_id where gi.import_id=(select value from p12_ids where key='guest_import') and gi.client_item_id='review'),
  'review state preserved on Save');
select pg_temp.p12_result('32 Deselected item not imported',
  (select result_status='not_selected' and not selected from consumer.consumer_guest_import_items where import_id=(select value from p12_ids where key='guest_import') and client_item_id='deselected')
  and not exists (select 1 from consumer.consumer_saved_entities where network_entity_id='21000000-0000-4000-8000-000000000008'),
  'consent selection controls mutation');
select pg_temp.p12_result('33 No Project assignment defaults Unfiled',
  not exists (select 1 from consumer.consumer_project_saved_entities m join consumer.consumer_guest_import_items gi on gi.saved_entity_id=m.saved_entity_id where gi.import_id=(select value from p12_ids where key='guest_import') and gi.client_item_id='accepted' and m.removed_at is null),
  'imported Save has no membership');

insert into p12_payloads values (
  'assign', jsonb_build_object('version','mytrusthub-guest/v1','generated_at',statement_timestamp(),'expires_at',statement_timestamp()+interval '30 days','items',jsonb_build_array(
    jsonb_build_object('client_item_id','duplicate','item_type','saved_entity','hub','contractor','specialist_entity_type','company','specialist_entity_id','p12-accepted')
  ))
);
insert into p12_ids
select 'guest_assign', import_id from consumer.commit_guest_import(
  (select payload from p12_payloads where key='assign'), array['duplicate'],
  '51000000-0000-4000-8000-000000000002', (select value from p12_ids where key='project_a')
);
select pg_temp.p12_result('34 Explicit Project assignment works',
  exists (select 1 from consumer.consumer_project_saved_entities where project_id=(select value from p12_ids where key='project_a') and saved_entity_id=(select value from p12_ids where key='saved_accepted') and removed_at is null),
  'duplicate Save assigned without duplication');
select pg_temp.p12_result(
  '35 Guest import does not create Watch',
  pg_temp.p12_watch_count('11000000-0000-4000-8000-000000000001') = 0,
  'guest import created zero Watch rows'
);
select consumer.commit_guest_import((select payload from p12_payloads where key='assign'), array['duplicate'], '51000000-0000-4000-8000-000000000002', (select value from p12_ids where key='project_a'));
select pg_temp.p12_result('36 Duplicate idempotency key creates no duplicates',
  (select count(*)=1 from consumer.consumer_guest_imports where idempotency_key='51000000-0000-4000-8000-000000000002')
  and (select count(*)=1 from consumer.consumer_guest_import_items where import_id=(select value from p12_ids where key='guest_assign')),
  'stable receipt returned');

-- NOTES 22-26
insert into p12_ids values ('project_note', consumer.create_note('61000000-0000-4000-8000-000000000001',(select value from p12_ids where key='project_a'),null,'research','Roof condition is a major question before closing.'));
select pg_temp.p12_result('22 A creates private Project note', exists(select 1 from consumer.consumer_notes where id=(select value from p12_ids where key='project_note')), 'Project-owned note created');
insert into p12_ids values ('saved_note', consumer.create_note('61000000-0000-4000-8000-000000000002',null,(select value from p12_ids where key='saved_accepted'),'general','Confirm source record before the next step.'));
select pg_temp.p12_result('23 A creates Saved-entity note', exists(select 1 from consumer.consumer_notes where id=(select value from p12_ids where key='saved_note')), 'Saved-owned note created');
reset role;
set local role myth_identity_governor;
insert into p12_counts values ('network_after_notes',(select count(*) from network.identity_governance_events));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select pg_temp.p12_result('26 Note writes do not touch public evidence',
  (select value from p12_counts where key='network_after_redirect')=(select value from p12_counts where key='network_after_notes'),
  'notes remain in consumer schema');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
select pg_temp.p12_result('24 B cannot read notes', (select count(*)=0 from consumer.consumer_notes), 'RLS isolates note owner');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"business_role":"owner"}}', true);
select pg_temp.p12_result('25 Business role cannot read notes', (select count(*)=0 from consumer.consumer_notes), 'business metadata grants no note access');
reset role;

-- REMOVAL 41-43
set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
insert into p12_ids select 'saved_removable', saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000008','move',null);
select consumer.remove_saved_entity((select value from p12_ids where key='saved_removable'),1);
select pg_temp.p12_result('41 Remove unfiled Saved succeeds',
  (select removed_at is not null and row_version=2 from consumer.consumer_saved_entities where id=(select value from p12_ids where key='saved_removable')),
  'soft removal preserves durable row');
select pg_temp.p12_result('42 Removal with Project membership returns conflict',
  pg_temp.p12_errors(format('select consumer.remove_saved_entity(%L,%s)', (select value from p12_ids where key='saved_accepted'), (select row_version from consumer.consumer_saved_entities where id=(select value from p12_ids where key='saved_accepted')))),
  'membership must be handled explicitly');
select consumer.archive_project((select value from p12_ids where key='project_a'),4);
select pg_temp.p12_result('43 Project archive never removes Saved',
  (select status='archived' from consumer.consumer_projects where id=(select value from p12_ids where key='project_a'))
  and (select removed_at is null from consumer.consumer_saved_entities where id=(select value from p12_ids where key='saved_accepted'))
  and exists(select 1 from consumer.consumer_project_saved_entities where project_id=(select value from p12_ids where key='project_a') and saved_entity_id=(select value from p12_ids where key='saved_accepted') and removed_at is null),
  'Save and membership remain queryable');

-- RLS 44+: own, cross-user, anonymous, business-only, and dual-role coverage.
select pg_temp.p12_result('44 Own P12 rows visible across every table',
  (select count(*)>0 from consumer.consumer_saved_entities)
  and (select count(*)>0 from consumer.consumer_projects)
  and (select count(*)>0 from consumer.consumer_project_saved_entities)
  and (select count(*)>0 from consumer.consumer_notes)
  and (select count(*)>0 from consumer.consumer_guest_imports)
  and (select count(*)>0 from consumer.consumer_guest_import_items),
  'Consumer A sees all owned P12 state');
select pg_temp.p12_result('45 Direct browser writes denied',
  pg_temp.p12_errors($sql$insert into consumer.consumer_projects(user_id,creation_key,name,life_event_type) values ('11000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000099','Bypass','blank')$sql$),
  'mutations require narrow operations');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
select pg_temp.p12_result('46 Consumer B sees no A Saves', (select count(*)=0 from consumer.consumer_saved_entities), 'Saved RLS');
select pg_temp.p12_result('47 Consumer B sees no A Projects', (select count(*)=0 from consumer.consumer_projects), 'Project RLS');
select pg_temp.p12_result('48 Consumer B sees no A memberships', (select count(*)=0 from consumer.consumer_project_saved_entities), 'membership parent ownership');
select pg_temp.p12_result('49 Consumer B sees no A notes', (select count(*)=0 from consumer.consumer_notes), 'note RLS');
select pg_temp.p12_result('50 Consumer B sees no A import receipts', (select count(*)=0 from consumer.consumer_guest_imports), 'receipt RLS');
select pg_temp.p12_result('51 Consumer B sees no A import items', (select count(*)=0 from consumer.consumer_guest_import_items), 'item parent ownership');
reset role;

set local role anon;
select pg_temp.p12_result('52 Anonymous denied every P12 table',
  pg_temp.p12_errors('select * from consumer.consumer_saved_entities')
  and pg_temp.p12_errors('select * from consumer.consumer_projects')
  and pg_temp.p12_errors('select * from consumer.consumer_project_saved_entities')
  and pg_temp.p12_errors('select * from consumer.consumer_notes')
  and pg_temp.p12_errors('select * from consumer.consumer_guest_imports')
  and pg_temp.p12_errors('select * from consumer.consumer_guest_import_items'),
  'no anonymous table access');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"business_role":"owner"}}', true);
select pg_temp.p12_result('53 Business-only subject sees no P12 rows',
  (select count(*)=0 from consumer.consumer_saved_entities)
  and (select count(*)=0 from consumer.consumer_projects)
  and (select count(*)=0 from consumer.consumer_project_saved_entities)
  and (select count(*)=0 from consumer.consumer_notes)
  and (select count(*)=0 from consumer.consumer_guest_imports)
  and (select count(*)=0 from consumer.consumer_guest_import_items),
  'business metadata creates no consumer authorization');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"business_role":"owner"}}', true);
select pg_temp.p12_result('54 Dual-role subject sees only own P12 rows',
  (select count(*)>0 from consumer.consumer_saved_entities)
  and (select count(*)>0 from consumer.consumer_projects)
  and not exists(select 1 from consumer.consumer_saved_entities where user_id<>'11000000-0000-4000-8000-000000000001'),
  'authorization remains canonical subject ownership');
reset role;

-- Cleanup deterministic fixtures.
delete from consumer.consumer_guest_import_items;
delete from consumer.consumer_guest_imports;
delete from consumer.consumer_notes;
delete from consumer.consumer_project_saved_entities;
delete from consumer.consumer_projects;
delete from consumer.consumer_saved_entities;
delete from network.identity_governance_events;
delete from network.network_entity_redirects;
delete from network.network_entity_bindings;
delete from network.network_entities;
delete from consumer.consumer_profiles;
delete from auth.users where id in (
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000003'
);

revoke myth_identity_governor from postgres;

commit;

select ordinal, test_name, passed, detail from p12_test_results order by ordinal;
