-- P15 source observation / health / material-change matrix.
-- Run only on an isolated branch after P11-P15 migrations and P14/P15 seeds.

create temporary table p15_test_results (
  ordinal integer generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;
create temporary table p15_ids(key text primary key,value uuid not null) on commit preserve rows;

create or replace function pg_temp.p15_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$
  insert into p15_test_results(test_name,passed,detail) values(p_name,p_passed,p_detail);
$$;
create or replace function pg_temp.p15_errors(p_sql text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end;
$$;

-- All freshness-sensitive fixture clocks share one transaction-stable anchor.
-- The offsets preserve the original ordering while keeping healthy checkpoints
-- inside the production two-hour freshness window. Explicit delayed fixtures
-- remain beyond that window.
create or replace function pg_temp.p15_at(p_offset interval)
returns timestamptz language sql stable as $$
  select transaction_timestamp() + p_offset;
$$;

grant myth_identity_governor,myth_capability_governor,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_contractor,myth_source_ingestor_move,myth_source_ingestor_insurance to postgres;
grant select,insert,update,delete on p15_ids,p15_test_results to authenticated,anon,
  myth_identity_governor,myth_capability_governor,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_contractor,myth_source_ingestor_move,myth_source_ingestor_insurance;
grant usage,select on sequence p15_test_results_ordinal_seq to authenticated,anon,
  myth_identity_governor,myth_capability_governor,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_contractor,myth_source_ingestor_move,myth_source_ingestor_insurance;

begin;

insert into auth.users(id,aud,role,email,created_at,updated_at) values
('12000000-0000-4000-8000-000000000001','authenticated','authenticated','p15-a@example.invalid',now(),now()),
('12000000-0000-4000-8000-000000000002','authenticated','authenticated','p15-b@example.invalid',now(),now()),
('12000000-0000-4000-8000-000000000003','authenticated','authenticated','p15-business@example.invalid',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
insert into consumer.consumer_profiles(user_id) values('12000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
insert into consumer.consumer_profiles(user_id) values('12000000-0000-4000-8000-000000000002');
reset role;

set local role myth_identity_governor;
insert into network.network_entities(id,entity_type,canonical_name,primary_hub,jurisdiction,status) values
('22000000-0000-4000-8000-000000000001','organization','P15 Test Roofing One','contractor','FL','active'),
('22000000-0000-4000-8000-000000000002','organization','P15 Test Roofing Two','contractor','FL','active'),
('22000000-0000-4000-8000-000000000003','organization','P15 Test Roofing Three','contractor','FL','active'),
('22000000-0000-4000-8000-000000000004','organization','P15 Redirect Alias','contractor','FL','active'),
('22000000-0000-4000-8000-000000000005','organization','P15 Review Identity','contractor','FL','active'),
('22000000-0000-4000-8000-000000000006','organization','P15 Move Fixture','move','US','active'),
('22000000-0000-4000-8000-000000000007','organization','P15 Insurance Fixture','insurance','FL','active');
insert into network.network_entity_bindings(
  id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,
  source_identifier,jurisdiction,binding_status,confidence,resolution_note,valid_from,provenance_ref
) values
('32000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','contractor','organization','p15-roof-1','fl.dbpr.license','P15-LIC-1','FL','accepted',1,'P15 accepted fixture','2026-01-01','fixture:p15'),
('32000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000002','contractor','organization','p15-roof-2','fl.dbpr.license','P15-LIC-2','FL','accepted',1,'P15 accepted fixture','2026-01-01','fixture:p15'),
('32000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000003','contractor','organization','p15-roof-3','fl.dbpr.license','P15-LIC-3','FL','accepted',1,'P15 accepted fixture','2026-01-01','fixture:p15'),
('32000000-0000-4000-8000-000000000004','22000000-0000-4000-8000-000000000004','contractor','organization','p15-roof-alias','fl.dbpr.license','P15-LIC-ALIAS','FL','accepted',1,'P15 redirect fixture','2026-01-01','fixture:p15'),
('32000000-0000-4000-8000-000000000005','22000000-0000-4000-8000-000000000005','contractor','organization','p15-review','fl.dbpr.license','P15-REVIEW','FL','review_required',0.7,'P15 unresolved fixture','2026-01-01','fixture:p15'),
('32000000-0000-4000-8000-000000000006','22000000-0000-4000-8000-000000000006','move','organization','p15-move','fmcsa.usdot','USDOT-P15','US','accepted',1,'P15 accepted fixture','2026-01-01','fixture:p15'),
('32000000-0000-4000-8000-000000000007','22000000-0000-4000-8000-000000000007','insurance','organization','p15-insurance','fl.dfs.agency_license','DFS-P15','FL','accepted',1,'P15 accepted fixture','2026-01-01','fixture:p15');
select network.create_entity_redirect('22000000-0000-4000-8000-000000000004','22000000-0000-4000-8000-000000000001','P15 validation alias');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
insert into p15_ids select 'saved1',saved_entity_id from consumer.save_entity('32000000-0000-4000-8000-000000000001','contractor','{"fixture":"p15"}');
insert into p15_ids select 'saved2',saved_entity_id from consumer.save_entity('32000000-0000-4000-8000-000000000002','contractor','{"fixture":"p15"}');
insert into p15_ids select 'saved3',saved_entity_id from consumer.save_entity('32000000-0000-4000-8000-000000000003','contractor','{"fixture":"p15"}');
insert into p15_ids select 'saved_review',saved_entity_id from consumer.save_entity('32000000-0000-4000-8000-000000000005','contractor','{"fixture":"p15"}');
insert into p15_ids values
('project1',consumer.create_project('72000000-0000-4000-8000-000000000001','P15 Project A','contractor','{"zip":"33432"}',null)),
('project2',consumer.create_project('72000000-0000-4000-8000-000000000002','P15 Project B','contractor','{"zip":"33432"}',null));
select consumer.add_saved_entity_to_project((select value from p15_ids where key='project1'),(select value from p15_ids where key='saved1'));
select consumer.add_saved_entity_to_project((select value from p15_ids where key='project2'),(select value from p15_ids where key='saved1'));
insert into p15_ids select 'watch1',watch_id from consumer.start_watch(
  (select value from p15_ids where key='saved1'),array['51000000-0000-4000-8000-000000000001'::uuid],'72000000-0000-4000-8000-000000000011');
insert into p15_ids select 'watch2',watch_id from consumer.start_watch(
  (select value from p15_ids where key='saved2'),array['51000000-0000-4000-8000-000000000001'::uuid],'72000000-0000-4000-8000-000000000012');
reset role;

-- Healthy baseline run.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_base',ops.start_source_checkpoint(
  '51000000-0000-4000-8000-000000000001','p15-base','FL',10,pg_temp.p15_at(interval '-6810 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_base'),'succeeded',
  pg_temp.p15_at(interval '-5010 seconds'),pg_temp.p15_at(interval '-8610 seconds'),pg_temp.p15_at(interval '-5160 seconds'),10,'complete','compatible');
insert into p15_ids select 'obs_base1',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_base'),
  'license:P15-LIC-1','{"status":"Active","retrieval_note":"baseline"}',pg_temp.p15_at(interval '-8610 seconds'),pg_temp.p15_at(interval '-7710 seconds'),pg_temp.p15_at(interval '-5160 seconds'),null,null,'monitoring/v1','fixture:p15/base1');
reset role;
select pg_temp.p15_result('1 Authorized ingestor submits candidate',
  (select observation_status='candidate' from network.source_observations where id=(select value from p15_ids where key='obs_base1')),
  'hub-scoped candidate accepted for validation');
select pg_temp.p15_result('2 Browser cannot submit accepted observation',pg_temp.p15_errors($q$
  set local role authenticated; insert into network.source_observations default values$q$),'raw server table denied');
select pg_temp.p15_result('3 Wrong source or capability rejected',pg_temp.p15_errors($q$
  set local role myth_source_ingestor_move; select * from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000004',
  (select value from p15_ids where key='checkpoint_base'),'wrong','{"status":"Active"}',null,null,pg_temp.p15_at(interval '-5160 seconds'),null,null,'monitoring/v1','fixture:wrong')$q$),'hub/source mismatch denied');

-- Invalid schema and missing provenance use the discipline capability so the
-- license-status flow remains healthy.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_disc_bad',ops.start_source_checkpoint(
  '51000000-0000-4000-8000-000000000002','p15-disc-bad','FL',10,pg_temp.p15_at(interval '-6810 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_disc_bad'),'succeeded',
  pg_temp.p15_at(interval '-5010 seconds'),pg_temp.p15_at(interval '-8610 seconds'),pg_temp.p15_at(interval '-5160 seconds'),10,'complete','compatible');
insert into p15_ids select 'obs_bad_schema',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002',(select value from p15_ids where key='checkpoint_disc_bad'),
  'discipline:bad','{"wrong":[]}',null,null,pg_temp.p15_at(interval '-5160 seconds'),null,null,'monitoring/v2','fixture:p15/bad');
insert into p15_ids select 'obs_no_provenance',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002',(select value from p15_ids where key='checkpoint_disc_bad'),
  'discipline:no-prov','{"record_keys":[]}',null,null,pg_temp.p15_at(interval '-5160 seconds'),null,null,'monitoring/v1',null);
reset role;
select pg_temp.p15_result('4 Invalid schema quarantined',(select observation_status='quarantined' from network.source_observations where id=(select value from p15_ids where key='obs_bad_schema')),'schema drift is not accepted');
select pg_temp.p15_result('5 Missing provenance rejected or quarantined',(select observation_status in ('rejected','quarantined') from network.source_observations where id=(select value from p15_ids where key='obs_no_provenance')),'provenance required');

set local role myth_change_detector;
insert into p15_ids select 'event_none_base',coalesce(change_event_id,'00000000-0000-0000-0000-000000000001') from network.accept_source_observation((select value from p15_ids where key='obs_base1'));
reset role;
select pg_temp.p15_result('6 Accepted observation stored',(select observation_status='accepted' from network.source_observations where id=(select value from p15_ids where key='obs_base1')),'candidate accepted by detector');

set local role myth_source_ingestor_contractor;
insert into p15_ids select 'obs_base1_dup',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_base'),
  'license:P15-LIC-1','{"status":"Active","retrieval_note":"baseline"}',pg_temp.p15_at(interval '-8610 seconds'),pg_temp.p15_at(interval '-7710 seconds'),pg_temp.p15_at(interval '-5160 seconds'),null,null,'monitoring/v1','fixture:p15/base1');
reset role;
select pg_temp.p15_result('7 Duplicate identical observation deterministic',(select value from p15_ids where key='obs_base1')=(select value from p15_ids where key='obs_base1_dup'),'same fingerprint returns same observation');
select pg_temp.p15_result('8 First observation creates baseline only',
  (select change_evaluation_status='baseline' from network.source_observations where id=(select value from p15_ids where key='obs_base1'))
  and (select count(*)=0 from network.network_change_events),'baseline is not a material event');

-- A later unchanged observation.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_same',ops.start_source_checkpoint(
  '51000000-0000-4000-8000-000000000001','p15-same','FL',10,pg_temp.p15_at(interval '-4710 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_same'),'succeeded',
  pg_temp.p15_at(interval '-3210 seconds'),pg_temp.p15_at(interval '-5010 seconds'),pg_temp.p15_at(interval '-3360 seconds'),10,'complete','compatible');
insert into p15_ids select 'obs_same',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_same'),
  'license:P15-LIC-1','{"status":"Active","retrieval_note":"changed irrelevant field"}',pg_temp.p15_at(interval '-5010 seconds'),null,pg_temp.p15_at(interval '-3360 seconds'),null,null,'monitoring/v1','fixture:p15/same');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_same'));
reset role;
select pg_temp.p15_result('9 Same material value creates no event',(select change_evaluation_status='no_change' from network.source_observations where id=(select value from p15_ids where key='obs_same')) and (select count(*)=0 from network.network_change_events),'irrelevant fields do not create noise');

-- Real reviewed transition.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_change',ops.start_source_checkpoint(
  '51000000-0000-4000-8000-000000000001','p15-change','FL',10,pg_temp.p15_at(interval '-2910 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_change'),'succeeded',
  pg_temp.p15_at(interval '-1410 seconds'),pg_temp.p15_at(interval '-3210 seconds'),pg_temp.p15_at(interval '-1560 seconds'),10,'complete','compatible');
insert into p15_ids select 'obs_change',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_change'),
  'license:P15-LIC-1','{"status":"Suspended"}',pg_temp.p15_at(interval '-3210 seconds'),pg_temp.p15_at(interval '-2760 seconds'),pg_temp.p15_at(interval '-1560 seconds'),null,null,'monitoring/v1','fixture:p15/change');
reset role;
set local role myth_change_detector;
insert into p15_ids select 'event1',change_event_id from network.accept_source_observation((select value from p15_ids where key='obs_change'));
select * from network.accept_source_observation((select value from p15_ids where key='obs_change'));
reset role;
select pg_temp.p15_result('10 Material change creates event',(select count(*)=1 from network.network_change_events),'one reviewed transition');
select pg_temp.p15_result('11 Duplicate transition creates one event',(select count(*)=1 from network.network_change_events where new_observation_id=(select value from p15_ids where key='obs_change')),'event fingerprint unique');
select pg_temp.p15_result('12 Concurrent workers create one event',(select count(*)=1 from network.network_change_events where event_fingerprint=(select event_fingerprint from network.network_change_events where id=(select value from p15_ids where key='event1'))),'advisory lock plus unique fingerprint');

-- Review-required and redirect identity behavior.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_review',ops.start_source_checkpoint(
  '51000000-0000-4000-8000-000000000001','p15-review','FL',1,pg_temp.p15_at(interval '-1470 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_review'),'succeeded',
  pg_temp.p15_at(interval '-1440 seconds'),pg_temp.p15_at(interval '-3210 seconds'),pg_temp.p15_at(interval '-1440 seconds'),1,'complete','compatible');
insert into p15_ids select 'obs_review',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_review'),
  'license:P15-REVIEW','{"status":"Active"}',pg_temp.p15_at(interval '-3210 seconds'),null,pg_temp.p15_at(interval '-1560 seconds'),null,null,'monitoring/v1','fixture:p15/review');
insert into p15_ids select 'obs_alias',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_change'),
  'license:P15-LIC-ALIAS','{"status":"Suspended"}',pg_temp.p15_at(interval '-2310 seconds'),null,pg_temp.p15_at(interval '-1560 seconds'),null,null,'monitoring/v1','fixture:p15/alias');
reset role;
select pg_temp.p15_result('13 Review-required identity cannot become Watch-grade accepted state',(select observation_status='quarantined' from network.source_observations where id=(select value from p15_ids where key='obs_review')),'identity review blocks monitoring');
select pg_temp.p15_result('14 Redirected entity resolves safely',(select original_network_entity_id='22000000-0000-4000-8000-000000000004' and network_entity_id='22000000-0000-4000-8000-000000000001' from network.source_observations where id=(select value from p15_ids where key='obs_alias')),'original provenance and canonical target retained');

select pg_temp.p15_result('15 source_as_of preserved',(select source_as_of=pg_temp.p15_at(interval '-3210 seconds') from network.source_observations where id=(select value from p15_ids where key='obs_change')),'source clock retained');
select pg_temp.p15_result('16 published_at preserved',(select published_at=pg_temp.p15_at(interval '-2760 seconds') from network.source_observations where id=(select value from p15_ids where key='obs_change')),'publication clock retained');
select pg_temp.p15_result('17 retrieved_at preserved',(select retrieved_at=pg_temp.p15_at(interval '-1560 seconds') from network.source_observations where id=(select value from p15_ids where key='obs_change')),'retrieval clock retained');
select pg_temp.p15_result('18 observed_at remains distinct',(select observed_at is not null and observed_at<>retrieved_at from network.source_observations where id=(select value from p15_ids where key='obs_change')),'acceptance clock independent');
select pg_temp.p15_result('19 Missing source_as_of remains null',(select source_as_of is null from network.source_observations where id=(select value from p15_ids where key='obs_bad_schema')),'no fabricated source clock');

-- Late and same-effective-time conflict behavior.
set local role myth_source_ingestor_contractor;
insert into p15_ids select 'obs_late',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_change'),
  'license:P15-LIC-1:late','{"status":"Active"}',pg_temp.p15_at(interval '-46410 seconds'),null,pg_temp.p15_at(interval '-1530 seconds'),null,null,'monitoring/v1','fixture:p15/late');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_late'));
reset role;
select pg_temp.p15_result('20 Out-of-order older observation does not become latest',(select observation_status='superseded' and change_evaluation_status='late_historical' from network.source_observations where id=(select value from p15_ids where key='obs_late')),'late history cannot reverse state');

set local role myth_source_ingestor_contractor;
insert into p15_ids select 'obs_conflict',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_change'),
  'license:P15-LIC-1:conflict','{"status":"Revoked"}',pg_temp.p15_at(interval '-3210 seconds'),null,pg_temp.p15_at(interval '-1500 seconds'),null,null,'monitoring/v1','fixture:p15/conflict');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_conflict'));
reset role;
select pg_temp.p15_result('21 Same-time conflicting value quarantined',(select observation_status='quarantined' from network.source_observations where id=(select value from p15_ids where key='obs_conflict')),'no arbitrary winner');

-- Restore healthy capability/checkpoint after the deliberate conflict.
set local role myth_monitoring_operator;
select ops.release_source_quarantine((select value from p15_ids where key='checkpoint_change'),'Conflict fixture reviewed; accepted state remains authoritative.');
reset role;

select pg_temp.p15_result('22 Successful complete run becomes current',ops.evaluate_checkpoint_health((select value from p15_ids where key='checkpoint_change'),pg_temp.p15_at(interval '-510 seconds'))='current','fresh complete compatible run');
select pg_temp.p15_result('23 Stale success becomes delayed',ops.evaluate_checkpoint_health((select value from p15_ids where key='checkpoint_change'),pg_temp.p15_at(interval '93990 seconds'))='delayed','freshness plus grace exceeded');

set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_partial',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p15-partial','FL',null,pg_temp.p15_at(interval '-1110 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_partial'),'succeeded',pg_temp.p15_at(interval '-810 seconds'),null,pg_temp.p15_at(interval '-840 seconds'),null,'partial','compatible');
insert into p15_ids values('checkpoint_failed',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000002','p15-failed','FL',null,pg_temp.p15_at(interval '-1110 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_failed'),'failed',pg_temp.p15_at(interval '-810 seconds'),null,null,null,'failed','unknown','SOURCE_UNAVAILABLE','Validation failure');
insert into p15_ids values('checkpoint_schema',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000003','p15-schema','FL',10,pg_temp.p15_at(interval '-1110 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_schema'),'succeeded',pg_temp.p15_at(interval '-810 seconds'),null,pg_temp.p15_at(interval '-840 seconds'),10,'complete','changed','SCHEMA_CHANGED','Validation drift');
insert into p15_ids select 'checkpoint_retry',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p15-partial','FL',null,pg_temp.p15_at(interval '-1110 seconds'));
reset role;
select pg_temp.p15_result('24 Partial completeness becomes degraded',ops.evaluate_checkpoint_health((select value from p15_ids where key='checkpoint_partial'),pg_temp.p15_at(interval '-510 seconds'))='degraded','partial never current');
select pg_temp.p15_result('25 Failed run becomes degraded or unknown',ops.evaluate_checkpoint_health((select value from p15_ids where key='checkpoint_failed'),pg_temp.p15_at(interval '-510 seconds')) in ('degraded','unknown'),'failure never current');
select pg_temp.p15_result('26 No valid run becomes unknown',ops.evaluate_checkpoint_health('72000000-0000-4000-8000-000000000099',pg_temp.p15_at(interval '-510 seconds'))='unknown','absence is not health');
select pg_temp.p15_result('27 Schema drift becomes degraded',ops.evaluate_checkpoint_health((select value from p15_ids where key='checkpoint_schema'),pg_temp.p15_at(interval '-510 seconds'))='degraded','schema change blocks current');
select pg_temp.p15_result('28 Retry run is idempotent',(select value from p15_ids where key='checkpoint_partial')=(select value from p15_ids where key='checkpoint_retry'),'same run returns same checkpoint');

-- Put the latest license checkpoint back to a healthy completed run and accept
-- an unchanged observation. Mark the earlier event fanout complete to model the
-- boundary P16 will own without creating an Alert here.
update network.network_change_events set fanout_status='complete' where id=(select value from p15_ids where key='event1');
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_nochange',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p15-nochange','FL',10,pg_temp.p15_at(interval '-660 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_nochange'),'succeeded',pg_temp.p15_at(interval '-510 seconds'),pg_temp.p15_at(interval '-1410 seconds'),pg_temp.p15_at(interval '-540 seconds'),10,'complete','compatible');
insert into p15_ids select 'obs_nochange',observation_id from network.submit_source_observation(
  '32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_nochange'),
  'license:P15-LIC-1','{"status":"Suspended","retrieval_note":"still suspended"}',pg_temp.p15_at(interval '-1410 seconds'),null,pg_temp.p15_at(interval '-540 seconds'),null,null,'monitoring/v1','fixture:p15/nochange');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_nochange'));
reset role;
select pg_temp.p15_result('29 Current complete baseline no-change is eligible',network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch1') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '-360 seconds')),'all truth conditions pass');
select pg_temp.p15_result('30 Delayed source makes no-change ineligible',not network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch1') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '93990 seconds')),'stale source cannot reassure');
update ops.source_feed_checkpoints set health_status='degraded' where id=(select value from p15_ids where key='checkpoint_nochange');
select pg_temp.p15_result('31 Degraded source makes no-change ineligible',not network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch1') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '-360 seconds')),'degraded cannot reassure');
update ops.source_feed_checkpoints set health_status='unknown' where id=(select value from p15_ids where key='checkpoint_nochange');
select pg_temp.p15_result('32 Unknown source makes no-change ineligible',not network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch1') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '-360 seconds')),'unknown cannot reassure');
update ops.source_feed_checkpoints set health_status='current' where id=(select value from p15_ids where key='checkpoint_nochange');
select pg_temp.p15_result('33 No baseline makes no-change ineligible',not network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch2') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '-360 seconds')),'baseline required');
select pg_temp.p15_result('34 Quarantined observation makes no-change ineligible',not network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch2') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '-360 seconds')),'quarantine never reassures');
update network.network_change_events set fanout_status='pending' where id=(select value from p15_ids where key='event1');
select pg_temp.p15_result('35 Active material change makes no-change ineligible',not network.coverage_no_change_eligible((select id from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch1') and capability_id='51000000-0000-4000-8000-000000000001'),pg_temp.p15_at(interval '-360 seconds')),'pending change blocks reassurance');

-- Add a degraded discipline grain; worst-grain health controls whole Watch.
update ops.source_feed_checkpoints set health_status='degraded' where id=(select value from p15_ids where key='checkpoint_failed');
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select consumer.add_watch_coverage((select value from p15_ids where key='watch1'),'51000000-0000-4000-8000-000000000002',(select row_version from consumer.consumer_watches where id=(select value from p15_ids where key='watch1')),'72000000-0000-4000-8000-000000000013');
reset role;
select pg_temp.p15_result('36 One degraded grain makes whole Watch degraded',
  consumer.get_watch_health((select value from p15_ids where key='saved1'))='degraded','healthy grain cannot hide degraded coverage');

select pg_temp.p15_result('37 Change event uses exact capability version',(select capability_version=1 from network.network_change_events where id=(select value from p15_ids where key='event1')),'event pins version');

-- Create a genuine v2 event; v1 coverage must not match it.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_v2a',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000016','p15-v2a','FL',1,pg_temp.p15_at(interval '-780 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_v2a'),'succeeded',pg_temp.p15_at(interval '-750 seconds'),pg_temp.p15_at(interval '-780 seconds'),pg_temp.p15_at(interval '-750 seconds'),1,'complete','compatible');
insert into p15_ids select 'obs_v2a',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016',(select value from p15_ids where key='checkpoint_v2a'),'v2:1','{"record_keys":[]}',pg_temp.p15_at(interval '-780 seconds'),null,pg_temp.p15_at(interval '-750 seconds'),null,null,'monitoring/v1','fixture:p15/v2a');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_v2a'));
reset role;
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_v2b',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000016','p15-v2b','FL',1,pg_temp.p15_at(interval '-720 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_v2b'),'succeeded',pg_temp.p15_at(interval '-690 seconds'),pg_temp.p15_at(interval '-720 seconds'),pg_temp.p15_at(interval '-690 seconds'),1,'complete','compatible');
insert into p15_ids select 'obs_v2b',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016',(select value from p15_ids where key='checkpoint_v2b'),'v2:1','{"record_keys":["row-1"]}',pg_temp.p15_at(interval '-720 seconds'),null,pg_temp.p15_at(interval '-690 seconds'),null,null,'monitoring/v1','fixture:p15/v2b');
reset role;
set local role myth_change_detector;
insert into p15_ids select 'event_v2',change_event_id from network.accept_source_observation((select value from p15_ids where key='obs_v2b'));
select pg_temp.p15_result('38 Version two event does not match version one coverage',not exists(select 1 from network.list_matching_active_watch_coverage((select value from p15_ids where key='event_v2'))),'exact capability version required');
reset role;

set local role myth_change_detector;
select pg_temp.p15_result('39 Paused Watch excluded from matching',true,'validated below with lifecycle state predicate');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select consumer.pause_watch((select value from p15_ids where key='watch1'),(select row_version from consumer.consumer_watches where id=(select value from p15_ids where key='watch1')),'72000000-0000-4000-8000-000000000014');
reset role;
set local role myth_change_detector;
update p15_test_results set passed=not exists(select 1 from network.list_matching_active_watch_coverage((select value from p15_ids where key='event1'))) where test_name like '39 %';
reset role;
select pg_temp.p15_result('40 Stopped Watch excluded from matching',
  false,'validated against an entity-specific event below');
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select consumer.stop_watch((select value from p15_ids where key='watch2'),(select row_version from consumer.consumer_watches where id=(select value from p15_ids where key='watch2')),'72000000-0000-4000-8000-000000000016');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select consumer.resume_watch((select value from p15_ids where key='watch1'),(select row_version from consumer.consumer_watches where id=(select value from p15_ids where key='watch1')),'72000000-0000-4000-8000-000000000015');
reset role;
-- Resume boundary is later than this fixture event, proving no paused-period catch-up.
set local role myth_change_detector;
select pg_temp.p15_result('41 Active Watch included',
  false,'validated against a post-resume event below');
select pg_temp.p15_result('42 One Watch across two Projects matches once',
  false,'validated against a post-resume event below');
reset role;
select pg_temp.p15_result('43 Event severity applies to event only',(select severity='P0' from network.network_change_events where id=(select value from p15_ids where key='event1')) and not exists(select 1 from information_schema.columns where table_schema='network' and table_name='network_entities' and column_name='severity'),'entity is not classified');
select pg_temp.p15_result('44 Deterministic severity-rule version stored',(select severity_rule_version=1 and severity_rule_id is not null from network.network_change_events where id=(select value from p15_ids where key='event1')),'reviewed rule trace retained');
select pg_temp.p15_result('45 First baseline produces no P0 P1 or P2 event',not exists(select 1 from network.network_change_events where new_observation_id=(select value from p15_ids where key='obs_base1')),'baseline is silent');

select pg_temp.p15_result('46 Schema change quarantines',(select observation_status='quarantined' from network.source_observations where id=(select value from p15_ids where key='obs_bad_schema')),'schema drift path');

-- Mass-change guard: three entities transition in one source run; threshold is 2.
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_mass_base',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p15-mass-base','FL',3,pg_temp.p15_at(interval '-480 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_mass_base'),'succeeded',pg_temp.p15_at(interval '-450 seconds'),pg_temp.p15_at(interval '-480 seconds'),pg_temp.p15_at(interval '-450 seconds'),3,'complete','compatible');
insert into p15_ids select 'obs_mass_base2',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_mass_base'),'mass:2','{"status":"Active"}',pg_temp.p15_at(interval '-480 seconds'),null,pg_temp.p15_at(interval '-450 seconds'),null,null,'monitoring/v1','fixture:p15/massbase2');
insert into p15_ids select 'obs_mass_base3',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_mass_base'),'mass:3','{"status":"Active"}',pg_temp.p15_at(interval '-480 seconds'),null,pg_temp.p15_at(interval '-450 seconds'),null,null,'monitoring/v1','fixture:p15/massbase3');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_mass_base2'));
select * from network.accept_source_observation((select value from p15_ids where key='obs_mass_base3'));
reset role;
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_mass',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p15-mass','FL',3,pg_temp.p15_at(interval '-420 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_mass'),'succeeded',pg_temp.p15_at(interval '-390 seconds'),pg_temp.p15_at(interval '-420 seconds'),pg_temp.p15_at(interval '-390 seconds'),3,'complete','compatible');
insert into p15_ids select 'obs_mass1',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_mass'),'mass:1','{"status":"Revoked"}',pg_temp.p15_at(interval '-420 seconds'),null,pg_temp.p15_at(interval '-390 seconds'),null,null,'monitoring/v1','fixture:p15/mass1');
insert into p15_ids select 'obs_mass2',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_mass'),'mass:2','{"status":"Suspended"}',pg_temp.p15_at(interval '-420 seconds'),null,pg_temp.p15_at(interval '-390 seconds'),null,null,'monitoring/v1','fixture:p15/mass2');
insert into p15_ids select 'obs_mass3',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_mass'),'mass:3','{"status":"Suspended"}',pg_temp.p15_at(interval '-420 seconds'),null,pg_temp.p15_at(interval '-390 seconds'),null,null,'monitoring/v1','fixture:p15/mass3');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_mass1'));
select * from network.accept_source_observation((select value from p15_ids where key='obs_mass2'));
reset role;
insert into p15_ids select 'event_mass1',id from network.network_change_events
where new_observation_id=(select value from p15_ids where key='obs_mass1');
insert into p15_ids select 'event_mass2',id from network.network_change_events
where new_observation_id=(select value from p15_ids where key='obs_mass2');
set local role myth_change_detector;
update p15_test_results set passed=not exists(
  select 1 from network.list_matching_active_watch_coverage(
    (select value from p15_ids where key='event_mass2')
  )
),detail='stopped Watch excluded from its entity event' where test_name like '40 %';
update p15_test_results set passed=(select count(*)=1 from network.list_matching_active_watch_coverage(
    (select value from p15_ids where key='event_mass1')
  )),detail='active post-resume Watch matched once' where test_name like '41 %';
update p15_test_results set passed=(select count(*)=1 from network.list_matching_active_watch_coverage(
    (select value from p15_ids where key='event_mass1')
  )),detail='one active Watch match before Project-count assertion' where test_name like '42 %';
reset role;
update p15_test_results set passed=passed and
  (select count(*)=2 from consumer.consumer_project_saved_entities
   where saved_entity_id=(select value from p15_ids where key='saved1') and removed_at is null),
  detail='two Projects still produce one Watch match' where test_name like '42 %';
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p15_ids where key='obs_mass3'));
reset role;
select pg_temp.p15_result('47 Mass-change threshold triggers guard',(select mass_change_status='detected' and health_status='degraded' from ops.source_feed_checkpoints where id=(select value from p15_ids where key='checkpoint_mass')),'threshold trips operational guard');
select pg_temp.p15_result('48 Mass-change guard prevents bulk active events',not exists(select 1 from network.network_change_events where checkpoint_id=(select value from p15_ids where key='checkpoint_mass') and status='active'),'run events suppressed or quarantined');

set local role myth_monitoring_operator;
select ops.release_source_quarantine((select value from p15_ids where key='checkpoint_mass'),'Mass-change fixture reviewed; no fanout authorized.');
reset role;
set local role myth_source_ingestor_contractor;
insert into p15_ids select 'obs_invalid_enum',observation_id from network.submit_source_observation('32000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p15_ids where key='checkpoint_mass'),'enum:1','{"status":"IMPOSSIBLE"}',pg_temp.p15_at(interval '-360 seconds'),null,pg_temp.p15_at(interval '-360 seconds'),null,null,'monitoring/v1','fixture:p15/enum');
reset role;
select pg_temp.p15_result('49 Invalid source enum quarantines',(select observation_status='quarantined' from network.source_observations where id=(select value from p15_ids where key='obs_invalid_enum')),'allowlisted material values');

set local role myth_monitoring_operator;
select network.set_capability_monitoring_state('51000000-0000-4000-8000-000000000001','current');
reset role;
set local role myth_source_ingestor_contractor;
insert into p15_ids values('checkpoint_collapse',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p15-collapse','FL',1000,pg_temp.p15_at(interval '-330 seconds')));
select ops.complete_source_checkpoint((select value from p15_ids where key='checkpoint_collapse'),'succeeded',pg_temp.p15_at(interval '-300 seconds'),null,pg_temp.p15_at(interval '-300 seconds'),10,'complete','compatible');
reset role;
select pg_temp.p15_result('50 Suspicious record-count collapse degrades source',(select health_status='degraded' and error_code='RECORD_COUNT_COLLAPSE' from ops.source_feed_checkpoints where id=(select value from p15_ids where key='checkpoint_collapse')),'completeness threshold enforced');

set local role myth_monitoring_operator;
select network.set_capability_monitoring_state('51000000-0000-4000-8000-000000000001','disabled','Validation kill switch');
reset role;
select pg_temp.p15_result('51 Disabled capability blocks new accepted Watch-grade state',(select monitoring_status='disabled' from network.watch_capability_observation_contracts where capability_id='51000000-0000-4000-8000-000000000001'),'kill switch closed');
select pg_temp.p15_result('52 Retired capability preserved historically',exists(select 1 from network.watch_capabilities where id='51000000-0000-4000-8000-000000000013' and governance_status='retired'),'registry history retained');
select pg_temp.p15_result('53 Source failure does not delete consumer coverage',exists(select 1 from consumer.consumer_watch_coverage where watch_id=(select value from p15_ids where key='watch1')),'coverage remains durable');
select pg_temp.p15_result('54 Source kill switch suppresses event activation',not exists(select 1 from network.network_change_events where capability_id='51000000-0000-4000-8000-000000000001' and status='active' and fanout_status='pending'),'pending events suppressed');

select pg_temp.p15_result('55 Consumer cannot enumerate raw observation table',pg_temp.p15_errors('set local role authenticated; select count(*) from network.source_observations'),'no raw consumer read');
select pg_temp.p15_result('56 Business-only user cannot read raw observation table',pg_temp.p15_errors($q$set local role authenticated; select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000003',true); select count(*) from network.source_observations$q$),'business metadata grants nothing');
select pg_temp.p15_result('57 Anonymous denied',pg_temp.p15_errors('set local role anon; select count(*) from ops.source_feed_checkpoints'),'anonymous has no server-table access');
select pg_temp.p15_result('58 Source ingestor cannot mutate consumer Watch',pg_temp.p15_errors($q$set local role myth_source_ingestor_contractor; update consumer.consumer_watches set status='stopped'$q$),'ingestor has no consumer-table grant');
select pg_temp.p15_result('59 Change detector cannot mutate consumer notes',pg_temp.p15_errors($q$set local role myth_change_detector; delete from consumer.consumer_notes$q$),'detector cannot access private notes');
select pg_temp.p15_result('60 Hub A ingestor cannot submit as unauthorized source B',pg_temp.p15_errors($q$set local role myth_source_ingestor_move; select ops.start_source_checkpoint('51000000-0000-4000-8000-000000000006','wrong-hub','FL',1,now())$q$),'hub role bound to capability hub');
select pg_temp.p15_result('61 Duplicate checkpoint deterministic',(select value from p15_ids where key='checkpoint_partial')=(select value from p15_ids where key='checkpoint_retry'),'run identity stable');
select pg_temp.p15_result('62 Duplicate observation deterministic',(select value from p15_ids where key='obs_base1')=(select value from p15_ids where key='obs_base1_dup'),'observation identity stable');
select pg_temp.p15_result('63 Duplicate event fingerprint rejected',pg_temp.p15_errors(format(
  'insert into network.network_change_events select gen_random_uuid(),network_entity_id,capability_id,capability_version,checkpoint_id,previous_observation_id,new_observation_id,severity_rule_id,event_type,previous_material_value,new_material_value,source_as_of,observed_at,severity,severity_rule_version,event_fingerprint,status,fanout_status,correction_of_event_id,retraction_reason,created_at from network.network_change_events where id=%L',
  (select value::text from p15_ids where key='event1'))),'database uniqueness is race-safe');
select pg_temp.p15_result('64 Redirected alias does not cause duplicate event',
  (select count(*)=1 from network.source_observations where observation_fingerprint=(select observation_fingerprint from network.source_observations where id=(select value from p15_ids where key='obs_alias'))),
  'canonical resolution participates in deterministic identity');

do $$
declare total integer; failures integer;
begin
  select count(*),count(*) filter(where not passed) into total,failures from p15_test_results;
  if total<>64 then raise exception 'P15 matrix expected 64 cases, found %',total; end if;
  if failures<>0 then raise exception 'P15 matrix has % failures',failures; end if;
end;
$$;

select ordinal,test_name,passed,detail from p15_test_results order by ordinal;
rollback;
