-- P14 62-case capability/Watch/RLS/cross-hub matrix.
-- Run on an isolated branch after P11B + P12 + P13 + P14 and the P14
-- validation-only capability seed.

create temporary table p14_results(
  ordinal integer generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;
create temporary table p14_ids(key text primary key,value uuid not null) on commit preserve rows;
create temporary table p14_versions(key text primary key,value bigint not null) on commit preserve rows;

create or replace function pg_temp.p14_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$
  insert into p14_results(test_name,passed,detail) values(p_name,p_passed,p_detail);
$$;
create or replace function pg_temp.p14_errors(p_sql text)
returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end;
$$;
create or replace function pg_temp.p14_relation_count(p_relation text)
returns bigint language plpgsql as $$
declare result bigint;
begin
  if to_regclass(p_relation) is null then return 0; end if;
  execute format('select count(*) from %s',p_relation) into result;
  return result;
end;
$$;

begin;

grant myth_identity_governor,myth_capability_governor,
  myth_capability_proposer_contractor,myth_bff_move to postgres;
grant select,insert,update,delete on p14_results,p14_ids,p14_versions
  to authenticated,anon,myth_capability_governor,myth_capability_proposer_contractor,myth_bff_move;
grant usage,select on sequence p14_results_ordinal_seq
  to authenticated,anon,myth_capability_governor,myth_capability_proposer_contractor,myth_bff_move;

insert into auth.users(id,aud,role,email,raw_app_meta_data,created_at,updated_at) values
('71000000-0000-4000-8000-000000000001','authenticated','authenticated','p14-a@example.invalid','{"business_roles":["owner"]}',now(),now()),
('71000000-0000-4000-8000-000000000002','authenticated','authenticated','p14-b@example.invalid','{}',now(),now()),
('71000000-0000-4000-8000-000000000003','authenticated','authenticated','p14-business@example.invalid','{"business_roles":["owner"]}',now(),now());

set local role myth_identity_governor;
insert into network.network_entities(id,entity_type,canonical_name,primary_hub,jurisdiction,status,canonical_public_profile_ref) values
('61000000-0000-4000-8000-000000000001','organization','P14 Contractor','contractor','FL','active','/contractors/p14'),
('61000000-0000-4000-8000-000000000002','organization','P14 Insurance','insurance','FL','active','/directory/p14'),
('61000000-0000-4000-8000-000000000003','organization','P14 Move','move','US','active','/companies/p14'),
('61000000-0000-4000-8000-000000000004','organization','P14 Review','contractor','FL','active','/contractors/review'),
('61000000-0000-4000-8000-000000000005','organization','P14 Removable','contractor','FL','active','/contractors/removable'),
('61000000-0000-4000-8000-000000000006','organization','P14 Lender','lender','US','active','/lenders/p14'),
('61000000-0000-4000-8000-000000000007','organization','P14 Senior','senior','US','active','/providers/p14'),
('61000000-0000-4000-8000-000000000008','organization','P14 Investor','investor','US','active','/firms/p14');
insert into network.network_entity_bindings(
  id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,
  identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref
) values
('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','contractor','organization','p14-contractor','fl.dbpr.license','P14-DBPR','FL','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','contractor','organization','p14-contractor-sunbiz','fl.sunbiz.document','P14-SUNBIZ','FL','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000002','insurance','organization','p14-insurance','fl.dfs.agency_license','P14-DFS','FL','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000003','move','organization','p14-move','fmcsa.usdot','P14-US-DOT','US','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000005','61000000-0000-4000-8000-000000000004','contractor','organization','p14-review','fl.dbpr.license','P14-REVIEW','FL','review_required',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000006','61000000-0000-4000-8000-000000000005','contractor','organization','p14-removable','fl.dbpr.license','P14-REMOVE','FL','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000007','61000000-0000-4000-8000-000000000006','lender','organization','p14-lender','nmls.id','P14-NMLS','US','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000008','61000000-0000-4000-8000-000000000007','senior','organization','p14-senior','cms.ccn','P14-CCN','US','accepted',timestamptz '2026-01-01','validation:p14'),
('62000000-0000-4000-8000-000000000009','61000000-0000-4000-8000-000000000008','investor','organization','p14-investor','sec.crd','P14-CRD','US','accepted',timestamptz '2026-01-01','validation:p14');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
insert into consumer.consumer_profiles(user_id) values('71000000-0000-4000-8000-000000000001');
insert into p14_ids values
('project_a',consumer.create_project('63000000-0000-4000-8000-000000000001','Project A','buying_home','{"schema_version":"1","zip":"33432"}',null)),
('project_b',consumer.create_project('63000000-0000-4000-8000-000000000002','Project B','contractor','{"schema_version":"1","job_zip":"33432"}',null));
insert into p14_ids select 'saved_contractor',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000001','contractor',null);
insert into p14_ids select 'saved_insurance',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000003','insurance',null);
insert into p14_ids select 'saved_move',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000004','move',null);
insert into p14_ids select 'saved_review',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000005','contractor',null);
insert into p14_ids select 'saved_removable',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000006','contractor',null);
insert into p14_ids select 'saved_lender',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000007','lender',null);
insert into p14_ids select 'saved_senior',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000008','senior',null);
insert into p14_ids select 'saved_investor',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000009','investor',null);
select consumer.add_saved_entity_to_project((select value from p14_ids where key='project_a'),(select value from p14_ids where key='saved_contractor'));
select consumer.add_saved_entity_to_project((select value from p14_ids where key='project_b'),(select value from p14_ids where key='saved_contractor'));
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
insert into consumer.consumer_profiles(user_id) values('71000000-0000-4000-8000-000000000002');
insert into p14_ids select 'saved_b',saved_entity_id from consumer.save_entity('62000000-0000-4000-8000-000000000001','contractor',null);
reset role;

-- CAPABILITY REGISTRY 1-10
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.p14_result('1 Approved capability available',
  (select eligible from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_contractor')) where capability_id='51000000-0000-4000-8000-000000000001'),'approved + enabled + applicable');
select pg_temp.p14_result('2 Draft unavailable',
  (select unavailable_reason='CAPABILITY_NOT_APPROVED' from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_contractor')) where capability_id='51000000-0000-4000-8000-000000000011'),'draft cannot be selected');
select pg_temp.p14_result('3 Disabled unavailable for new subscription',
  (select unavailable_reason='CAPABILITY_NOT_APPROVED' from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_contractor')) where capability_id='51000000-0000-4000-8000-000000000012'),'disabled cannot be selected');
select pg_temp.p14_result('4 Retired unavailable for new subscription',
  (select unavailable_reason='CAPABILITY_NOT_APPROVED' from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_contractor')) where capability_id='51000000-0000-4000-8000-000000000013'),'retired cannot be selected');
select pg_temp.p14_result('5 Wrong hub or entity type unavailable',
  (select unavailable_reason='CAPABILITY_NOT_APPLICABLE' from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_contractor')) where capability_id='51000000-0000-4000-8000-000000000015'),'entity type enforced');
select pg_temp.p14_result('6 Wrong jurisdiction unavailable',
  (select unavailable_reason='CAPABILITY_NOT_APPLICABLE' from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_contractor')) where capability_id='51000000-0000-4000-8000-000000000014'),'jurisdiction enforced');
select pg_temp.p14_result('7 review_required binding unavailable',
  (select unavailable_reason='IDENTITY_REQUIRES_REVIEW' from consumer.list_available_watch_capabilities((select value from p14_ids where key='saved_review')) where capability_id='51000000-0000-4000-8000-000000000001')
  and pg_temp.p14_errors(format('select * from consumer.start_watch(%L,array[%L::uuid],%L)',(select value from p14_ids where key='saved_review'),'51000000-0000-4000-8000-000000000001',gen_random_uuid())),
  'Save remains valid but Watch is denied');
reset role;

set local role myth_capability_proposer_contractor;
insert into p14_ids values('proposal',network.propose_watch_capability(
  'contractor.test.proposal',1,'contractor','organization','FL','fl.dbpr.license','test','proposal',
  'Proposed capability','Proposal requires parent review.',interval '24 hours',null,'{}',now()
));
select pg_temp.p14_result('8 Specialist proposer cannot self-approve',
  pg_temp.p14_errors(format('update network.watch_capabilities set governance_status=%L,enabled=true,watch_eligible=true where id=%L','approved',(select value from p14_ids where key='proposal'))),
  'proposal exists as review_required without table update privilege');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.p14_result('9 Browser cannot mutate capability registry',
  pg_temp.p14_errors('update network.watch_capabilities set enabled=false'),
  'network registry is not a browser write surface');
reset role;
set local role myth_capability_governor;
select pg_temp.p14_result('10 Capability version meaning is immutable',
  pg_temp.p14_errors($sql$update network.watch_capabilities set grain_key='reinterpreted' where id='51000000-0000-4000-8000-000000000001'$sql$),
  'approved semantics require a new version');
reset role;

-- START WATCH 11-21
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
insert into p14_ids select 'watch_main',watch_id from consumer.start_watch(
  (select value from p14_ids where key='saved_contractor'),
  array['51000000-0000-4000-8000-000000000001'::uuid,'51000000-0000-4000-8000-000000000002'::uuid],
  '64000000-0000-4000-8000-000000000001'
);
select pg_temp.p14_result('11 Saved owner starts Watch',
  exists(select 1 from consumer.consumer_watches w where w.id=(select value from p14_ids where key='watch_main') and w.status='active'),'explicit Watch created');
select pg_temp.p14_result('12 Unsaved entity cannot start Watch',
  pg_temp.p14_errors(format('select * from consumer.start_watch(%L,array[%L::uuid],%L)','69999999-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',gen_random_uuid())),'Saved row required');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select pg_temp.p14_result('13 Another consumer cannot start Watch',
  pg_temp.p14_errors(format('select * from consumer.start_watch(%L,array[%L::uuid],%L)',(select value from p14_ids where key='saved_contractor'),'51000000-0000-4000-8000-000000000001',gen_random_uuid())),'ownership derived from canonical subject');
reset role;
set local role anon;
select pg_temp.p14_result('14 Anonymous denied',
  pg_temp.p14_errors(format('select * from consumer.start_watch(%L,array[%L::uuid],%L)',(select value from p14_ids where key='saved_contractor'),'51000000-0000-4000-8000-000000000001',gen_random_uuid())),'authentication required');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000003',true);
select pg_temp.p14_result('15 Business-only denied',
  pg_temp.p14_errors(format('select * from consumer.start_watch(%L,array[%L::uuid],%L)',(select value from p14_ids where key='saved_contractor'),'51000000-0000-4000-8000-000000000001',gen_random_uuid())),'business metadata grants no consumer ownership');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.p14_result('16 Duplicate start idempotent',
  (select watch_id=(select value from p14_ids where key='watch_main') and not created from consumer.start_watch(
    (select value from p14_ids where key='saved_contractor'),array['51000000-0000-4000-8000-000000000001'::uuid,'51000000-0000-4000-8000-000000000002'::uuid],
    '64000000-0000-4000-8000-000000000001')),'same key returns stable Watch');
select pg_temp.p14_result('17 One Watch per Saved entity',
  (select count(*)=1 from consumer.consumer_watches where saved_entity_id=(select value from p14_ids where key='saved_contractor')),'durable uniqueness');
select pg_temp.p14_result('18 Selected coverage rows exact',
  (select count(*)=2 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and status='enabled'),'two selections persisted');
select pg_temp.p14_result('19 Unselected capability not added',
  not exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000003'),'unchecked Sunbiz grain absent');
reset role;
select pg_temp.p14_result('20 No Alert created',pg_temp.p14_relation_count('consumer.consumer_alerts')=0,'starting a Watch created zero Alerts');
select pg_temp.p14_result('21 No observation created',pg_temp.p14_relation_count('network.source_observations')=0,'starting a Watch created zero source observations');

-- PROJECT INDEPENDENCE 22-25
select pg_temp.p14_result('22 One Saved in two Projects has one Watch',
  (select count(*)=2 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p14_ids where key='saved_contractor') and removed_at is null)
  and (select count(*)=1 from consumer.consumer_watches where saved_entity_id=(select value from p14_ids where key='saved_contractor')),'Project joins do not own Watch');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select consumer.archive_project((select value from p14_ids where key='project_a'),1);
select pg_temp.p14_result('23 Archive Project A preserves Watch',
  exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main') and status='active'),'archive is independent');
select consumer.remove_saved_entity_from_project((select value from p14_ids where key='project_a'),(select value from p14_ids where key='saved_contractor'));
select pg_temp.p14_result('24 Remove Project A membership preserves Watch',
  exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main') and status='active'),'membership removal is independent');
select consumer.remove_saved_entity_from_project((select value from p14_ids where key='project_b'),(select value from p14_ids where key='saved_contractor'));
select pg_temp.p14_result('25 Remove final membership leaves Unfiled Watch active',
  not exists(select 1 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p14_ids where key='saved_contractor') and removed_at is null)
  and exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main') and status='active'),'Unfiled does not stop Watch');

-- PAUSE / RESUME 26-32
insert into p14_versions values('main',consumer.pause_watch((select value from p14_ids where key='watch_main'),1,'64000000-0000-4000-8000-000000000002'));
select pg_temp.p14_result('26 Active to paused',(select status='paused' from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main')),'status transition');
select pg_temp.p14_result('27 Paused coverage preserved',(select count(*)=2 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and status='enabled'),'definitions preserved');
update p14_versions set value=consumer.resume_watch((select value from p14_ids where key='watch_main'),value,'64000000-0000-4000-8000-000000000003') where key='main';
select pg_temp.p14_result('28 Paused to active',(select status='active' from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main')),'resume transition');
update p14_versions set value=consumer.pause_watch((select value from p14_ids where key='watch_main'),value,'64000000-0000-4000-8000-000000000004') where key='main';
select pg_temp.p14_result('29 Duplicate pause idempotent',
  consumer.pause_watch((select value from p14_ids where key='watch_main'),3,'64000000-0000-4000-8000-000000000004')=(select value from p14_versions where key='main'),'already-paused returns current version');
update p14_versions set value=consumer.resume_watch((select value from p14_ids where key='watch_main'),value,'64000000-0000-4000-8000-000000000005') where key='main';
select pg_temp.p14_result('30 Duplicate resume idempotent',
  consumer.resume_watch((select value from p14_ids where key='watch_main'),4,'64000000-0000-4000-8000-000000000005')=(select value from p14_versions where key='main'),'already-active returns current version');
select pg_temp.p14_result('31 Stale row-version rejected',
  pg_temp.p14_errors(format('select consumer.pause_watch(%L,1,%L)',(select value from p14_ids where key='watch_main'),gen_random_uuid())),'optimistic concurrency enforced');
select pg_temp.p14_result('32 Paused catch-up policy stored',
  (select resume_policy='next_accepted_observation' and resume_boundary_at is not null from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main'))
  and exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_main') and event_type='resumed' and metadata->>'catch_up'='none'),
  'no retroactive fanout after intentional pause');

-- STOP / RESTART 33-37
update p14_versions set value=consumer.stop_watch((select value from p14_ids where key='watch_main'),value,'64000000-0000-4000-8000-000000000006') where key='main';
select pg_temp.p14_result('33 Stop preserves Saved',exists(select 1 from consumer.consumer_saved_entities where id=(select value from p14_ids where key='saved_contractor') and removed_at is null),'Save remains');
select pg_temp.p14_result('34 Stop preserves coverage history',(select count(*)=2 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main')),'coverage rows retained');
select pg_temp.p14_result('35 Stopped Watch not active',(select status='stopped' from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main')),'lifecycle state explicit');
select pg_temp.p14_result('36 Restart requires current explicit eligible coverage',
  pg_temp.p14_errors(format('select consumer.restart_watch(%L,%L::uuid[],%s,%L)',(select value from p14_ids where key='watch_main'),'{}',(select value from p14_versions where key='main'),gen_random_uuid())),'empty implicit restoration denied');
reset role;
set local role myth_capability_governor;
select network.set_watch_capability_state('51000000-0000-4000-8000-000000000002','retired',false,false,'validation_only',now()+interval '1 second');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
update p14_versions set value=consumer.restart_watch((select value from p14_ids where key='watch_main'),array['51000000-0000-4000-8000-000000000001'::uuid],value,'64000000-0000-4000-8000-000000000007') where key='main';
select pg_temp.p14_result('37 Retired capability not silently restored',
  exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000002' and status='retired')
  and (select count(*)=1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and status='enabled'),'restart uses explicit eligible set');

-- COVERAGE 38-43
update p14_versions set value=consumer.add_watch_coverage((select value from p14_ids where key='watch_main'),'51000000-0000-4000-8000-000000000003',value,'64000000-0000-4000-8000-000000000008') where key='main';
select pg_temp.p14_result('38 Add capability explicitly',exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000003' and status='enabled'),'explicit add');
select pg_temp.p14_result('39 New registry capability not auto-added',not exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000017'),'additional coverage only offered');
update p14_versions set value=consumer.remove_watch_coverage((select value from p14_ids where key='watch_main'),'51000000-0000-4000-8000-000000000003',value,'64000000-0000-4000-8000-000000000009') where key='main';
select pg_temp.p14_result('40 Remove capability explicitly',exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000003' and status='disabled'),'historical row retained');
select pg_temp.p14_result('41 Cannot leave active Watch with zero enabled coverage',
  pg_temp.p14_errors(format('select consumer.remove_watch_coverage(%L,%L,%s,%L)',(select value from p14_ids where key='watch_main'),'51000000-0000-4000-8000-000000000001',(select value from p14_versions where key='main'),gen_random_uuid())),'stop or select another grain');
select pg_temp.p14_result('42 Version two does not replace version one automatically',
  not exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000016')
  and exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and capability_id='51000000-0000-4000-8000-000000000002' and capability_version=1),'explicit upgrade required');
select pg_temp.p14_result('43 Disabled or retired coverage remains historically visible',
  (select count(*)=3 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main'))
  and exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_main') and status='retired'),'no silent deletion');

-- UNSAVE 44-47 on separate deterministic Saves
insert into p14_ids select 'watch_removable',watch_id from consumer.start_watch((select value from p14_ids where key='saved_removable'),array['51000000-0000-4000-8000-000000000001'::uuid],'64000000-0000-4000-8000-000000000010');
select pg_temp.p14_result('44 Active Watch blocks unsave',pg_temp.p14_errors(format('select consumer.remove_saved_entity(%L,1)',(select value from p14_ids where key='saved_removable'))),'Watch must be stopped');
insert into p14_versions values('removable',consumer.pause_watch((select value from p14_ids where key='watch_removable'),1,'64000000-0000-4000-8000-000000000011'));
select pg_temp.p14_result('45 Paused Watch blocks unsave',pg_temp.p14_errors(format('select consumer.remove_saved_entity(%L,1)',(select value from p14_ids where key='saved_removable'))),'paused is still a Watch');
select consumer.stop_watch_and_remove_saved_entity((select value from p14_ids where key='watch_removable'),(select value from p14_versions where key='removable'),1,'64000000-0000-4000-8000-000000000012');
select pg_temp.p14_result('46 Explicit stop-and-remove succeeds where memberships permit',
  exists(select 1 from consumer.consumer_saved_entities where id=(select value from p14_ids where key='saved_removable') and removed_at is not null)
  and exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_removable') and status='stopped'),'combined operation is explicit and atomic');
select consumer.add_saved_entity_to_project((select value from p14_ids where key='project_b'),(select value from p14_ids where key='saved_insurance'));
insert into p14_ids select 'watch_insurance',watch_id from consumer.start_watch((select value from p14_ids where key='saved_insurance'),array['51000000-0000-4000-8000-000000000006'::uuid],'64000000-0000-4000-8000-000000000013');
select consumer.stop_watch((select value from p14_ids where key='watch_insurance'),1,'64000000-0000-4000-8000-000000000014');
select pg_temp.p14_result('47 Membership conflict still enforced',pg_temp.p14_errors(format('select consumer.remove_saved_entity(%L,1)',(select value from p14_ids where key='saved_insurance'))),'stopping Watch does not remove Project membership');

-- RLS 48-54
select pg_temp.p14_result('48 Consumer A reads own Watch',exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main')),'own RLS read');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
insert into p14_ids select 'watch_b',watch_id from consumer.start_watch((select value from p14_ids where key='saved_b'),array['51000000-0000-4000-8000-000000000001'::uuid],'64000000-0000-4000-8000-000000000015');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.p14_result('49 A cannot read B Watch',not exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_b')),'Watch RLS');
select pg_temp.p14_result('50 A cannot read B coverage',not exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p14_ids where key='watch_b')),'coverage resolves through Watch owner');
reset role;
set local role anon;
select pg_temp.p14_result('51 Anonymous denied',pg_temp.p14_errors('select * from consumer.consumer_watches'),'no table access');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000003',true);
select pg_temp.p14_result('52 Business-only denied',not exists(select 1 from consumer.consumer_watches),'business metadata grants nothing');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.p14_result('53 Dual-role own access only',
  exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_main'))
  and not exists(select 1 from consumer.consumer_watches where id=(select value from p14_ids where key='watch_b')),'canonical ownership only');
reset role;
set local role myth_bff_move;
select pg_temp.p14_result('54 Specialist cannot enumerate unrelated Watches',pg_temp.p14_errors('select * from consumer.consumer_watches'),'BFF has no consumer table privilege');
reset role;

-- CROSS-HUB 55-58
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.p14_result('55 Contractor BFF receives narrow Watch state',
  (select watch_status='active' and enabled_coverage_count=1 and source_check_status='not_available'
   from consumer.get_cross_hub_entity_watch_state('61000000-0000-4000-8000-000000000001')),'composed narrow state');
select pg_temp.p14_result('56 Insurance BFF receives narrow Watch state',
  (select watch_status='stopped' and enabled_coverage_count=1
   from consumer.get_cross_hub_entity_watch_state('61000000-0000-4000-8000-000000000002')),'no history or unrelated account state');
reset role;
set local role myth_bff_move;
select pg_temp.p14_result('57 Move BFF cannot access Contractor user unrelated state',
  pg_temp.p14_errors($sql$select * from consumer.get_cross_hub_entity_watch_state('61000000-0000-4000-8000-000000000001')$sql$),'scope assertion cannot bypass canonical user authorization');
reset role;
select pg_temp.p14_result('58 Six-hub capability contract compatible',
  (select count(distinct hub)=6 from network.watch_capabilities where governance_status='approved' and capability_key in (
    'contractor.fl.dbpr.license_status','move.federal.fmcsa.operating_authority','lender.nmls.public_status',
    'insurance.fl.dfs.agency_status','senior.cms.ownership','investor.sec.form_adv.material_change'
  )) and not exists(select 1 from ops.consumer_hub_registry where not(array['watch:read','watch:write']<@allowed_scopes)),
  'one contract, hub-specific capability declarations');

-- AUDIT 59-62
select pg_temp.p14_result('59 Watch start event recorded',exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_main') and event_type='started'),'lifecycle audit');
select pg_temp.p14_result('60 Pause and resume events recorded',
  exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_main') and event_type='paused')
  and exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_main') and event_type='resumed'),'lifecycle audit');
select pg_temp.p14_result('61 Coverage add and remove recorded',
  exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_main') and event_type='coverage_added')
  and exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_main') and event_type='coverage_removed'),'coverage audit');
select pg_temp.p14_result('62 Stop event recorded',exists(select 1 from consumer.consumer_watch_events where watch_id=(select value from p14_ids where key='watch_removable') and event_type='stopped'),'stop audit');

reset role;

do $$
declare failed integer; total integer;
begin
  select count(*),count(*) filter(where not passed) into total,failed from p14_results;
  if total<>62 or failed<>0 then
    raise exception 'P14 matrix failed: % total, % failed',total,failed;
  end if;
end;
$$;

select ordinal,test_name,passed,detail from p14_results order by ordinal;
rollback;
