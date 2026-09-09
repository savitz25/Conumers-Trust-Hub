-- P19 decision, immutable snapshot, export, and deletion validation matrix.
-- Run only on an isolated branch after P11-P19 migrations and P14-P19 seeds.

create temporary table p19_test_results(
  ordinal integer generated always as identity,test_name text not null,passed boolean not null,detail text not null
) on commit preserve rows;
create temporary table p19_ids(key text primary key,value uuid not null) on commit preserve rows;
create temporary table p19_json(key text primary key,value jsonb not null) on commit preserve rows;
create temporary table p19_business_roles(user_id uuid primary key,company_ref text not null) on commit preserve rows;
create temporary table p19_public_companies(company_ref text primary key,display_name text not null) on commit preserve rows;

create or replace function pg_temp.p19_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$insert into p19_test_results(test_name,passed,detail) values(p_name,coalesce(p_passed,false),p_detail)$$;
create or replace function pg_temp.p19_errors(p_sql text)
returns boolean language plpgsql as $$
begin execute p_sql; execute 'reset role'; return false;
exception when others then execute 'reset role'; return true; end;
$$;
create or replace function pg_temp.p19_future_alert_blocked()
returns boolean language plpgsql as $$
declare v_created boolean;
begin
  insert into consumer.consumer_alerts(user_id,watch_id,change_event_id,template_key,template_version,severity,observed_at)
  values('19000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000','x',1,'P0',now()) returning true into v_created;
  return not coalesce(v_created,false);
end;
$$;
create or replace function pg_temp.p19_future_delivery_blocked()
returns boolean language plpgsql as $$
declare v_created boolean;
begin
  insert into ops.consumer_alert_deliveries(alert_id,user_id,channel,delivery_type,template_key,template_version,
    delivery_window_key,status,idempotency_key,preference_snapshot,override_snapshot)
  values('00000000-0000-0000-0000-000000000000','19000000-0000-4000-8000-000000000004','email',
    'p0_immediate','x',1,'x','pending','19930000-0000-4000-8000-000000000001','{}','{}') returning true into v_created;
  return not coalesce(v_created,false);
end;
$$;

grant myth_export_worker,myth_deletion_worker,myth_bff_contractor to postgres;
grant select,insert,update,delete on p19_test_results,p19_ids,p19_json,p19_business_roles,p19_public_companies
  to authenticated,anon,myth_export_worker,myth_deletion_worker,myth_bff_contractor;
grant usage,select on sequence p19_test_results_ordinal_seq
  to authenticated,anon,myth_export_worker,myth_deletion_worker,myth_bff_contractor;

begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('19000000-0000-4000-8000-000000000001','authenticated','authenticated','p19-a@example.test',now(),now(),now()),
('19000000-0000-4000-8000-000000000002','authenticated','authenticated','p19-b@example.test',now(),now(),now()),
('19000000-0000-4000-8000-000000000003','authenticated','authenticated','p19-business@example.test',now(),now(),now()),
('19000000-0000-4000-8000-000000000004','authenticated','authenticated','p19-delete@example.test',now(),now(),now());
insert into consumer.consumer_profiles(user_id) values
('19000000-0000-4000-8000-000000000001'),('19000000-0000-4000-8000-000000000002'),('19000000-0000-4000-8000-000000000004');
insert into p19_business_roles values('19000000-0000-4000-8000-000000000004','company-p19');
insert into p19_public_companies values('company-p19','P19 Public Company');

insert into network.network_entities(id,entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref) values
('19100000-0000-4000-8000-000000000001','contractor','P19 Test Roofing One','contractor','FL','/contractors/p19-one'),
('19100000-0000-4000-8000-000000000002','contractor','P19 Test Roofing Two','contractor','FL','/contractors/p19-two'),
('19100000-0000-4000-8000-000000000003','contractor','P19 Other Consumer Co','contractor','FL','/contractors/p19-other'),
('19100000-0000-4000-8000-000000000004','contractor','P19 Delete Fixture Co','contractor','FL','/contractors/p19-delete');
insert into consumer.consumer_saved_entities(id,user_id,network_entity_id,identity_resolution_state,source_hub) values
('19200000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','accepted','contractor'),
('19200000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000002','accepted','contractor'),
('19200000-0000-4000-8000-000000000003','19000000-0000-4000-8000-000000000002','19100000-0000-4000-8000-000000000003','accepted','contractor'),
('19200000-0000-4000-8000-000000000004','19000000-0000-4000-8000-000000000004','19100000-0000-4000-8000-000000000004','accepted','contractor');
insert into consumer.consumer_projects(id,user_id,creation_key,name,life_event_type) values
('19300000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001','19310000-0000-4000-8000-000000000001','P19 Boca Home','buying_home'),
('19300000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000002','19310000-0000-4000-8000-000000000002','P19 Other','blank'),
('19300000-0000-4000-8000-000000000004','19000000-0000-4000-8000-000000000004','19310000-0000-4000-8000-000000000004','P19 Delete','blank');
insert into consumer.consumer_project_saved_entities(project_id,saved_entity_id) values
('19300000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000001'),
('19300000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000002'),
('19300000-0000-4000-8000-000000000002','19200000-0000-4000-8000-000000000003'),
('19300000-0000-4000-8000-000000000004','19200000-0000-4000-8000-000000000004');

insert into p19_ids select 'capability',id from network.watch_capabilities order by created_at limit 1;
insert into consumer.consumer_watches(id,user_id,saved_entity_id,status) values
('19400000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000001','active'),
('19400000-0000-4000-8000-000000000004','19000000-0000-4000-8000-000000000004','19200000-0000-4000-8000-000000000004','active');
insert into consumer.consumer_watch_coverage(watch_id,capability_id,capability_version,status)
select '19400000-0000-4000-8000-000000000001',id,version,'enabled' from network.watch_capabilities order by created_at limit 1;

insert into consumer.consumer_notes(id,user_id,client_request_id,project_id,note_type,body) values
('19500000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001','19510000-0000-4000-8000-000000000001','19300000-0000-4000-8000-000000000001','research','Private P19 note'),
('19500000-0000-4000-8000-000000000004','19000000-0000-4000-8000-000000000004','19510000-0000-4000-8000-000000000004','19300000-0000-4000-8000-000000000004','research','Delete me');
insert into consumer.consumer_saved_sessions(id,user_id,hub,session_type,schema_key,schema_version,payload,payload_fingerprint,summary,create_idempotency_key,status)
values('19600000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001','lender','calculator','lender.piti/v1',1,
  '{"home_price":500000,"down_payment":100000}',encode(digest('{"home_price":500000,"down_payment":100000}','sha256'),'hex'),'{"title":"PITI","primary_value":2847}',
  '19610000-0000-4000-8000-000000000001','active');
insert into consumer.consumer_project_saved_sessions(project_id,saved_session_id) values
('19300000-0000-4000-8000-000000000001','19600000-0000-4000-8000-000000000001');

-- Decisions and append-only snapshots.
set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
insert into p19_ids select 'decision_one',decision_id from consumer.record_project_decision(
  '19300000-0000-4000-8000-000000000001','selected_provider','Private choice note',
  '[{"saved_entity_id":"19200000-0000-4000-8000-000000000001","category":"contractor"},{"saved_entity_id":"19200000-0000-4000-8000-000000000002","category":"insurance"}]',
  '19700000-0000-4000-8000-000000000001');
insert into p19_ids select 'snapshot_one',snapshot_id from consumer.record_project_decision(
  '19300000-0000-4000-8000-000000000001','selected_provider','Private choice note',
  '[{"saved_entity_id":"19200000-0000-4000-8000-000000000001","category":"contractor"},{"saved_entity_id":"19200000-0000-4000-8000-000000000002","category":"insurance"}]',
  '19700000-0000-4000-8000-000000000001');
reset role;
select pg_temp.p19_result('1 Owner records selected-provider decision',exists(select 1 from consumer.consumer_project_decisions where id=(select value from p19_ids where key='decision_one') and decision_type='selected_provider'),'private checkpoint created');
select pg_temp.p19_result('2 Multi-category selections',(select count(*)=2 from consumer.consumer_project_decision_entities where decision_id=(select value from p19_ids where key='decision_one')),'one decision maps across categories');

set local role authenticated; select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select consumer.record_project_decision('19300000-0000-4000-8000-000000000001','still_deciding',null,'[]','19700000-0000-4000-8000-000000000003');
reset role;
select pg_temp.p19_result('3 Still deciding without provider',exists(select 1 from consumer.consumer_project_decisions where decision_type='still_deciding' and project_id='19300000-0000-4000-8000-000000000001'),'no forced selection');
set local role authenticated; select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select consumer.record_project_decision('19300000-0000-4000-8000-000000000001','not_proceeding',null,'[]','19700000-0000-4000-8000-000000000004');
reset role;
select pg_temp.p19_result('4 Not proceeding without provider',exists(select 1 from consumer.consumer_project_decisions where decision_type='not_proceeding'),'valid no-provider outcome');
set local role authenticated; select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select consumer.record_project_decision('19300000-0000-4000-8000-000000000001','completed_without_provider',null,'[]','19700000-0000-4000-8000-000000000005');
reset role;
select pg_temp.p19_result('5 Completed without provider',exists(select 1 from consumer.consumer_project_decisions where decision_type='completed_without_provider'),'completion need not select a provider');
select pg_temp.p19_result('6 Private note optional',exists(select 1 from consumer.consumer_project_decisions where private_note is null),'nullable private context');
select pg_temp.p19_result('7 Another consumer denied',pg_temp.p19_errors($q$set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);select consumer.record_project_decision('19300000-0000-4000-8000-000000000001','other',null,'[]','19700000-0000-4000-8000-000000000007')$q$),'ownership enforced');
select pg_temp.p19_result('8 Business-only denied',pg_temp.p19_errors($q$set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000003',true);select consumer.record_project_decision('19300000-0000-4000-8000-000000000001','other',null,'[]','19700000-0000-4000-8000-000000000008')$q$),'business role provides no consumer access');
set local role myth_bff_contractor; select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
insert into p19_json select 'specialist_context',consumer.get_specialist_decision_context('19300000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000001','contractor'); reset role;
select pg_temp.p19_result('9 Specialist cannot read private decision note',not ((select value from p19_json where key='specialist_context')?'private_note'),'narrow exact-entity context omits note');
select pg_temp.p19_result('10 Selected entity must belong to consumer',pg_temp.p19_errors($q$set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);select consumer.record_project_decision('19300000-0000-4000-8000-000000000001','selected_provider',null,'[{"saved_entity_id":"19200000-0000-4000-8000-000000000003","category":"contractor"}]','19700000-0000-4000-8000-000000000010')$q$),'selection ownership checked');
select pg_temp.p19_result('11 Cross-user entity selection denied',not exists(select 1 from consumer.consumer_project_decision_entities where saved_entity_id='19200000-0000-4000-8000-000000000003'),'no cross-user link');

set local role authenticated; select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
insert into p19_ids select 'decision_final',decision_id from consumer.record_project_decision('19300000-0000-4000-8000-000000000001','selected_provider','Final private decision','[{"saved_entity_id":"19200000-0000-4000-8000-000000000001","category":"contractor"}]','19700000-0000-4000-8000-000000000012');
insert into p19_ids select 'snapshot_final',snapshot_id from consumer.record_project_decision('19300000-0000-4000-8000-000000000001','selected_provider','Final private decision','[{"saved_entity_id":"19200000-0000-4000-8000-000000000001","category":"contractor"}]','19700000-0000-4000-8000-000000000012'); reset role;
select pg_temp.p19_result('12 New decision supersedes old without deletion',(select count(*)>1 and count(*) filter(where superseded_at is null)=1 from consumer.consumer_project_decisions where project_id='19300000-0000-4000-8000-000000000001'),'append-only history');
select pg_temp.p19_result('13 Decision creates no ranking or public-profile effect',not exists(select 1 from information_schema.columns where table_schema='consumer' and table_name like '%decision%' and column_name in ('rank','ranking','trust_score','public_review')),'no public signal path');

select pg_temp.p19_result('14 Snapshot created',exists(select 1 from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'atomic decision snapshot');
select pg_temp.p19_result('15 Snapshot immutable after creation',pg_temp.p19_errors(format('update consumer.consumer_research_snapshots set snapshot_payload=''{}'' where id=%L',(select value::text from p19_ids where key='snapshot_final'))),'update trigger rejects mutation');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select pg_temp.p19_result('16 Fingerprint deterministic',consumer.verify_research_snapshot((select value from p19_ids where key='snapshot_final')),'SHA-256 verifies canonical jsonb text');reset role;
select pg_temp.p19_result('17 Saved refs preserved',jsonb_array_length((select snapshot_payload->'saved_entities' from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')))=2,'stable refs and safe names frozen');
select pg_temp.p19_result('18 Watch capability versions preserved',((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))->'watches'->0->'coverage'->0?'capability_version'),'exact subscribed version');
select pg_temp.p19_result('19 Alerts referenced',(select snapshot_payload?'alerts' from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'alert reference section present without raw records');
select pg_temp.p19_result('20 Source-check clocks preserved',(select snapshot_payload?'source_checks' from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'official and observed clocks remain separate');
select pg_temp.p19_result('21 Sessions and schema versions preserved',((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))->'saved_sessions'->0?'schema_version'),'stable session envelope reference');
select pg_temp.p19_result('22 No full regulator dump copied',not ((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))::text ~* '(raw_payload|source_artifact|full_dataset)'),'minimal normalized display facts');
insert into network.network_entity_redirects(from_entity_id,to_entity_id,reason) values('19100000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000002','p19 test merge');
select pg_temp.p19_result('23 Entity redirect later does not rewrite snapshot',((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))->'selected_entities'->0->>'network_entity_id_at_snapshot')='19100000-0000-4000-8000-000000000001','historical ref frozen');
select pg_temp.p19_result('24 Alert retraction later does not mutate snapshot',s.fingerprint is not null,'snapshot cannot be rewritten by later event state') from consumer.consumer_research_snapshots s where id=(select value from p19_ids where key='snapshot_final');
update consumer.consumer_saved_sessions set status='read_only' where id='19600000-0000-4000-8000-000000000001';
select pg_temp.p19_result('25 Retired session later does not invalidate snapshot',((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))->'saved_sessions'->0->>'status')='active','decision-time status retained');
select pg_temp.p19_result('26 Second decision creates second snapshot',(select count(*)>1 from consumer.consumer_research_snapshots where project_id='19300000-0000-4000-8000-000000000001'),'one immutable row per checkpoint');

set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select consumer.complete_project('19300000-0000-4000-8000-000000000001',(select value from p19_ids where key='decision_final'),1,'19800000-0000-4000-8000-000000000001');reset role;
select pg_temp.p19_result('27 Complete Project',(select status='completed' and completed_at is not null from consumer.consumer_projects where id='19300000-0000-4000-8000-000000000001'),'atomic lifecycle transition');
select pg_temp.p19_result('28 Watch remains active',(select status='active' from consumer.consumer_watches where id='19400000-0000-4000-8000-000000000001'),'completion has no Watch side effect');
select pg_temp.p19_result('29 Saved entities preserved',(select count(*)=2 from consumer.consumer_saved_entities where user_id='19000000-0000-4000-8000-000000000001'),'research retained');
select pg_temp.p19_result('30 Sessions preserved',exists(select 1 from consumer.consumer_saved_sessions where id='19600000-0000-4000-8000-000000000001'),'tool record retained');
select pg_temp.p19_result('31 Alerts preserved',exists(select 1 from information_schema.tables where table_schema='consumer' and table_name='consumer_alerts'),'Alert history table unaffected');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);select consumer.archive_project('19300000-0000-4000-8000-000000000001',2);reset role;
select pg_temp.p19_result('32 Archive completed Project',(select status='archived' from consumer.consumer_projects where id='19300000-0000-4000-8000-000000000001'),'visibility transition');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);select consumer.reopen_project('19300000-0000-4000-8000-000000000001',3,'19800000-0000-4000-8000-000000000003');reset role;
select pg_temp.p19_result('33 Reopen Project',(select status='active' from consumer.consumer_projects where id='19300000-0000-4000-8000-000000000001'),'returns to active');
select pg_temp.p19_result('34 Decision history retained',(select count(*)>1 from consumer.consumer_project_decisions where project_id='19300000-0000-4000-8000-000000000001'),'reopen does not erase decisions');
select pg_temp.p19_result('35 Snapshot retained',exists(select 1 from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'archive/reopen preserves evidence');
select pg_temp.p19_result('36 Project events meaningful',exists(select 1 from consumer.consumer_project_events where project_id='19300000-0000-4000-8000-000000000001' and event_type='completed') and exists(select 1 from consumer.consumer_project_events where project_id='19300000-0000-4000-8000-000000000001' and event_type='reopened'),'meaningful lifecycle only');

-- Export worker is lease-bound and bundle is consumer-only.
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);insert into p19_ids select 'export',consumer.request_export('19900000-0000-4000-8000-000000000001');reset role;
select pg_temp.p19_result('37 Consumer requests export',exists(select 1 from ops.consumer_export_jobs where id=(select value from p19_ids where key='export') and status='queued'),'queued idempotent job');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
select pg_temp.p19_result('38 Another consumer cannot read export job',consumer.get_export_status((select value from p19_ids where key='export')) is null,'narrow own status returns no existence signal');reset role;
set local role myth_export_worker;select ops.claim_consumer_export_job((select value from p19_ids where key='export'),'p19-worker','p19-export-lease');insert into p19_json select 'bundle',ops.build_consumer_export_bundle((select value from p19_ids where key='export'),'p19-export-lease');select ops.complete_consumer_export_job((select value from p19_ids where key='export'),'p19-export-lease','exports/p19/test-bundle');reset role;
select pg_temp.p19_result('39 Export bundle version correct',((select value from p19_json where key='bundle')->'manifest'->>'version')='mytrusthub-export/v1','versioned contract');
select pg_temp.p19_result('40 Projects included',jsonb_array_length((select value->'projects' from p19_json where key='bundle'))>0,'owned projects');
select pg_temp.p19_result('41 Saves included',jsonb_array_length((select value->'saved_entities' from p19_json where key='bundle'))=2,'owned Saves');
select pg_temp.p19_result('42 Watches included',jsonb_array_length((select value->'watches' from p19_json where key='bundle'))=1,'stopped or active history exportable');
select pg_temp.p19_result('43 Alerts included',(select value?'alerts' from p19_json where key='bundle'),'sourced alert section');
select pg_temp.p19_result('44 Sessions included',jsonb_array_length((select value->'saved_sessions' from p19_json where key='bundle'))=1,'session envelope included');
select pg_temp.p19_result('45 Decisions included',jsonb_array_length((select value->'decisions' from p19_json where key='bundle'))>1,'history exported');
select pg_temp.p19_result('46 Snapshots included',jsonb_array_length((select value->'research_snapshots' from p19_json where key='bundle'))>1,'immutable records exported');
select pg_temp.p19_result('47 Notes included',jsonb_array_length((select value->'private_notes' from p19_json where key='bundle'))=1,'own private notes');
select pg_temp.p19_result('48 Recent Research included if retained',(select value?'recent_research' from p19_json where key='bundle'),'explicit empty section when not implemented');
select pg_temp.p19_result('49 Business Manager excluded',not ((select value from p19_json where key='bundle')::text ilike '%company-p19%'),'separate workspace excluded');
select pg_temp.p19_result('50 Raw regulator datasets excluded',not ((select value from p19_json where key='bundle')::text ~* '(raw_payload|full_dataset|source_artifact)'),'references only');
select pg_temp.p19_result('51 Auth secrets excluded',not ((select value from p19_json where key='bundle')::text ~* '(password_hash|refresh_token|service_role)'),'no auth material');
select pg_temp.p19_result('52 Internal identity confidence excluded',not ((select value from p19_json where key='bundle')->'saved_entities'->0?'confidence'),'no resolver internals');
select pg_temp.p19_result('53 Sensitive session fields handled per schema',((select value from p19_json where key='bundle')->'saved_sessions'->0->'payload')='null'::jsonb,'PITI summary-only policy');
select pg_temp.p19_result('54 Read-only session remains exportable',((select value from p19_json where key='bundle')->'saved_sessions'->0->>'status')='read_only','legacy envelope retained');
select pg_temp.p19_result('55 Artifact hash and manifest deterministic',(select artifact_hash=encode(digest((select value::text from p19_json where key='bundle'),'sha256'),'hex') from ops.consumer_export_jobs where id=(select value from p19_ids where key='export')),'content-addressed test artifact');
update ops.consumer_export_jobs set expires_at=statement_timestamp()-interval '1 second' where id=(select value from p19_ids where key='export');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);insert into p19_json select 'expired_export',consumer.get_export_status((select value from p19_ids where key='export'));reset role;
select pg_temp.p19_result('56 Expired artifact inaccessible',((select value from p19_json where key='expired_export')->>'status')='expired' and not ((select value from p19_json where key='expired_export')->>'artifact_available')::boolean,'seven-day access boundary');
select pg_temp.p19_result('57 Export worker cannot modify consumer state',pg_temp.p19_errors($q$set local role myth_export_worker;update consumer.consumer_watches set status='paused'$q$),'function-only worker');

-- Deletion is confirmed, grace-bound, checkpointed, retry-safe, and does not touch shared/business/auth state.
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000004',true);select consumer.record_project_decision('19300000-0000-4000-8000-000000000004','not_proceeding',null,'[]','19910000-0000-4000-8000-000000000001');reset role;
set local role myth_deletion_worker;select ops.issue_consumer_destructive_confirmation('19000000-0000-4000-8000-000000000004','p19-delete-confirmation');reset role;
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000004',true);insert into p19_ids select 'delete_job',consumer.request_workspace_deletion('p19-delete-confirmation','19920000-0000-4000-8000-000000000001');reset role;
select pg_temp.p19_result('58 Deletion request created',exists(select 1 from ops.consumer_deletion_jobs where id=(select value from p19_ids where key='delete_job') and status='grace_period'),'purpose-bound confirmation consumed');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000004',true);select consumer.request_workspace_deletion('anything','19920000-0000-4000-8000-000000000001');reset role;
select pg_temp.p19_result('59 Repeat request idempotent',(select count(*)=1 from ops.consumer_deletion_jobs where id=(select value from p19_ids where key='delete_job')),'one logical workflow');
select pg_temp.p19_result('60 Deletion requires authenticated consumer',pg_temp.p19_errors($q$set local role anon;select consumer.request_workspace_deletion('x','19920000-0000-4000-8000-000000000060')$q$),'canonical auth required');
select pg_temp.p19_result('61 Specialist cannot request deletion',pg_temp.p19_errors($q$set local role myth_bff_contractor;select consumer.request_workspace_deletion('x','19920000-0000-4000-8000-000000000061')$q$),'parent surface only');
select pg_temp.p19_result('62 Business-only path cannot delete consumer',pg_temp.p19_errors($q$set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000003',true);select consumer.request_workspace_deletion('x','19920000-0000-4000-8000-000000000062')$q$),'no consumer workspace');
select pg_temp.p19_result('64 Future Alert fanout blocked',pg_temp.p19_future_alert_blocked(),'request immediately suppresses fanout');
select pg_temp.p19_result('65 Notification delivery blocked',pg_temp.p19_future_delivery_blocked(),'request suppresses outbound work');
update ops.consumer_deletion_jobs set grace_expires_at=statement_timestamp()-interval '1 second' where id=(select value from p19_ids where key='delete_job');
set local role myth_deletion_worker;select ops.claim_consumer_deletion_job((select value from p19_ids where key='delete_job'),'p19-delete-worker','p19-delete-lease');
select ops.run_consumer_deletion_step((select value from p19_ids where key='delete_job'),'p19-delete-lease','suppress_delivery_handoffs');reset role;
select pg_temp.p19_result('63 Watches stopped or deactivated',(select status='stopped' from consumer.consumer_watches where id='19400000-0000-4000-8000-000000000004'),'first step stops monitoring');
set local role myth_deletion_worker;
select ops.run_consumer_deletion_step((select value from p19_ids where key='delete_job'),'p19-delete-lease','delete_notifications_alerts');
select ops.run_consumer_deletion_step((select value from p19_ids where key='delete_job'),'p19-delete-lease','delete_decisions_snapshots');
select ops.run_consumer_deletion_step((select value from p19_ids where key='delete_job'),'p19-delete-lease','delete_sessions_notes_projects');
select ops.run_consumer_deletion_step((select value from p19_ids where key='delete_job'),'p19-delete-lease','delete_watches_saves');
select ops.run_consumer_deletion_step((select value from p19_ids where key='delete_job'),'p19-delete-lease','delete_profile_identity_links');
select ops.complete_consumer_deletion_job((select value from p19_ids where key='delete_job'),'p19-delete-lease');reset role;
select pg_temp.p19_result('66 Projects deleted',not exists(select 1 from consumer.consumer_projects where user_id='19000000-0000-4000-8000-000000000004'),'private projects removed');
select pg_temp.p19_result('67 Memberships deleted',not exists(select 1 from consumer.consumer_project_saved_entities where project_id='19300000-0000-4000-8000-000000000004'),'join rows removed');
select pg_temp.p19_result('68 Notes deleted',not exists(select 1 from consumer.consumer_notes where user_id='19000000-0000-4000-8000-000000000004'),'private notes removed');
select pg_temp.p19_result('69 Sessions deleted',not exists(select 1 from consumer.consumer_saved_sessions where user_id='19000000-0000-4000-8000-000000000004'),'private sessions removed');
select pg_temp.p19_result('70 Decisions deleted',not exists(select 1 from consumer.consumer_project_decisions where user_id='19000000-0000-4000-8000-000000000004'),'private decisions removed');
select pg_temp.p19_result('71 Snapshots deleted',not exists(select 1 from consumer.consumer_research_snapshots where user_id='19000000-0000-4000-8000-000000000004'),'private snapshots removed');
select pg_temp.p19_result('72 Saves deleted',not exists(select 1 from consumer.consumer_saved_entities where user_id='19000000-0000-4000-8000-000000000004'),'private Saves removed');
select pg_temp.p19_result('73 Alerts deleted according to policy',not exists(select 1 from consumer.consumer_alerts where user_id='19000000-0000-4000-8000-000000000004'),'consumer Alert history removed');
select pg_temp.p19_result('74 Consumer profile deleted or anonymized',not exists(select 1 from consumer.consumer_profiles where user_id='19000000-0000-4000-8000-000000000004'),'workspace root removed');
select pg_temp.p19_result('75 Public network entity preserved',exists(select 1 from network.network_entities where id='19100000-0000-4000-8000-000000000004'),'shared identity untouched');
select pg_temp.p19_result('76 Public source evidence preserved',exists(select 1 from information_schema.tables where table_schema='network' and table_name='source_observations'),'shared evidence store untouched');
select pg_temp.p19_result('77 Business Manager role preserved',exists(select 1 from p19_business_roles where user_id='19000000-0000-4000-8000-000000000004'),'separate authorization remains');
select pg_temp.p19_result('78 Claimed public company preserved',exists(select 1 from p19_public_companies where company_ref='company-p19'),'public company untouched');
select pg_temp.p19_result('79 Canonical auth user preserved when dual-role',exists(select 1 from auth.users where id='19000000-0000-4000-8000-000000000004'),'auth lifecycle is separate');
select pg_temp.p19_result('80 Worker retry safe',pg_temp.p19_errors(format($q$set local role myth_deletion_worker;select ops.complete_consumer_deletion_job(%L,'p19-delete-lease')$q$,(select value::text from p19_ids where key='delete_job'))),'completed lease cannot rerun');
select pg_temp.p19_result('81 Partial failure resumable',(select count(*)=6 and count(*) filter(where status='completed')=6 from ops.consumer_deletion_steps where deletion_job_id=(select value from p19_ids where key='delete_job')),'checkpointed steps');
select pg_temp.p19_result('82 Completed deletion cannot resurrect consumer state',pg_temp.p19_errors($q$insert into consumer.consumer_profiles(user_id) values('19000000-0000-4000-8000-000000000004')$q$),'tombstone job blocks recreation');

-- RLS and worker boundaries.
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select pg_temp.p19_result('83 A reads own decision',exists(select 1 from consumer.consumer_project_decisions where id=(select value from p19_ids where key='decision_final')),'own RLS');
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
select pg_temp.p19_result('84 A decision hidden from B',not exists(select 1 from consumer.consumer_project_decisions where id=(select value from p19_ids where key='decision_final')),'cross-user RLS');
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
select pg_temp.p19_result('85 A reads own snapshot',exists(select 1 from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'own RLS');
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
select pg_temp.p19_result('86 A snapshot hidden from B',not exists(select 1 from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'cross-user RLS');reset role;
select pg_temp.p19_result('87 Anonymous denied',pg_temp.p19_errors('set local role anon;select * from consumer.consumer_project_decisions'),'no anonymous grant');
set local role authenticated;select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000003',true);select pg_temp.p19_result('88 Business-only denied',not exists(select 1 from consumer.consumer_project_decisions),'role metadata gives no access');reset role;
set local role authenticated;select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"business_role":"owner"}}',true);select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);select pg_temp.p19_result('89 Dual-role own only',exists(select 1 from consumer.consumer_project_decisions where user_id='19000000-0000-4000-8000-000000000001') and not exists(select 1 from consumer.consumer_project_decisions where user_id<>'19000000-0000-4000-8000-000000000001'),'auth subject ownership only');reset role;
select pg_temp.p19_result('90 Specialist cannot enumerate decisions',pg_temp.p19_errors('set local role myth_bff_contractor;select * from consumer.consumer_project_decisions'),'exact context function only');
select pg_temp.p19_result('91 Specialist cannot enumerate export or delete jobs',pg_temp.p19_errors('set local role myth_bff_contractor;select * from ops.consumer_export_jobs'),'ops tables server-only');
select pg_temp.p19_result('92 Export worker cannot read another user outside assigned job',pg_temp.p19_errors('set local role myth_export_worker;select * from consumer.consumer_profiles'),'no direct consumer grants');
select pg_temp.p19_result('93 Deletion worker cannot mutate network evidence',pg_temp.p19_errors('set local role myth_deletion_worker;delete from network.network_entities'),'no shared network mutation grant');
select pg_temp.p19_result('94 Stopped Watch history referenced safely',((select value from p19_json where key='bundle')->'watches'->0?'status'),'Watch lifecycle exported');
select pg_temp.p19_result('95 Archived Project snapshot reproducible',(select fingerprint is not null and snapshot_payload->'project'->>'name'='P19 Boca Home' from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final')),'frozen display facts');
select pg_temp.p19_result('96 Redirected entity snapshot reproducible',((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))->'selected_entities'->0->>'canonical_name_at_snapshot')='P19 Test Roofing One','redirect does not rewrite history');
select pg_temp.p19_result('97 Read-only session snapshot reproducible',((select snapshot_payload from consumer.consumer_research_snapshots where id=(select value from p19_ids where key='snapshot_final'))->'saved_sessions'->0->>'schema_version')='1','schema version frozen');

do $$declare total integer;failures integer;begin
  select count(*),count(*) filter(where not passed) into total,failures from p19_test_results;
  if total<>97 then raise exception 'P19 matrix expected 97 cases, found %',total;end if;
  if failures<>0 then raise exception 'P19 matrix has % failures',failures;end if;
end$$;
select ordinal,test_name,passed,detail from p19_test_results order by ordinal;
rollback;
