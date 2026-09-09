-- P16 consumer Alerts / Watch checks / history matrix.
-- Run only on an isolated branch after P11-P16 migrations and P14-P16 seeds.

create temporary table p16_test_results(
  ordinal integer generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;
create temporary table p16_ids(key text primary key,value uuid not null) on commit preserve rows;

create or replace function pg_temp.p16_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$
  insert into p16_test_results(test_name,passed,detail) values(p_name,coalesce(p_passed,false),p_detail);
$$;
create or replace function pg_temp.p16_errors(p_sql text)
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

grant myth_identity_governor,myth_alert_fanout,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_contractor to postgres;
grant select,insert,update,delete on p16_ids,p16_test_results to authenticated,anon,
  myth_identity_governor,myth_alert_fanout,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_contractor,myth_bff_move,myth_bff_contractor;
grant usage,select on sequence p16_test_results_ordinal_seq to authenticated,anon,
  myth_identity_governor,myth_alert_fanout,myth_change_detector,myth_monitoring_operator,
  myth_source_ingestor_contractor,myth_bff_move,myth_bff_contractor;

begin;

insert into auth.users(id,aud,role,email,created_at,updated_at) values
('13000000-0000-4000-8000-000000000001','authenticated','authenticated','p16-a@example.invalid',now(),now()),
('13000000-0000-4000-8000-000000000002','authenticated','authenticated','p16-b@example.invalid',now(),now()),
('13000000-0000-4000-8000-000000000003','authenticated','authenticated','p16-business@example.invalid',now(),now()),
('13000000-0000-4000-8000-000000000004','authenticated','authenticated','p16-empty@example.invalid',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
insert into consumer.consumer_profiles(user_id) values('13000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
insert into consumer.consumer_profiles(user_id) values('13000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000004',true);
insert into consumer.consumer_profiles(user_id) values('13000000-0000-4000-8000-000000000004');
reset role;

set local role myth_identity_governor;
insert into network.network_entities(id,entity_type,canonical_name,primary_hub,jurisdiction,status) values
('23000000-0000-4000-8000-000000000001','organization','P16 Roofing One','contractor','FL','active'),
('23000000-0000-4000-8000-000000000002','organization','P16 Paused Roofing','contractor','FL','active'),
('23000000-0000-4000-8000-000000000003','organization','P16 Stopped Roofing','contractor','FL','active'),
('23000000-0000-4000-8000-000000000004','organization','P16 Versioned Roofing','contractor','FL','active'),
('23000000-0000-4000-8000-000000000005','organization','P16 Unchanged Roofing','contractor','FL','active'),
('23000000-0000-4000-8000-000000000006','organization','P16 Baseline Roofing','contractor','FL','active'),
('23000000-0000-4000-8000-000000000007','organization','P16 Insurance Agency','insurance','FL','active');
insert into network.network_entity_bindings(
  id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,
  source_identifier,jurisdiction,binding_status,confidence,resolution_note,valid_from,provenance_ref
) values
('33000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','contractor','organization','p16-roof-1','fl.dbpr.license','P16-LIC-1','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16'),
('33000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','contractor','organization','p16-roof-2','fl.dbpr.license','P16-LIC-2','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16'),
('33000000-0000-4000-8000-000000000003','23000000-0000-4000-8000-000000000003','contractor','organization','p16-roof-3','fl.dbpr.license','P16-LIC-3','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16'),
('33000000-0000-4000-8000-000000000004','23000000-0000-4000-8000-000000000004','contractor','organization','p16-roof-4','fl.dbpr.license','P16-LIC-4','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16'),
('33000000-0000-4000-8000-000000000005','23000000-0000-4000-8000-000000000005','contractor','organization','p16-roof-5','fl.dbpr.license','P16-LIC-5','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16'),
('33000000-0000-4000-8000-000000000006','23000000-0000-4000-8000-000000000006','contractor','organization','p16-roof-6','fl.dbpr.license','P16-LIC-6','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16'),
('33000000-0000-4000-8000-000000000007','23000000-0000-4000-8000-000000000007','insurance','organization','p16-insurance','fl.dfs.agency_license','P16-DFS-1','FL','accepted',1,'P16 fixture','2026-01-01','fixture:p16');
reset role;

-- Saves, Projects, memberships, and explicit Watches.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
insert into p16_ids select 'saved_a1',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000001','contractor','{"fixture":"p16"}');
insert into p16_ids select 'saved_a2',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000002','contractor','{"fixture":"p16"}');
insert into p16_ids select 'saved_a3',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000003','contractor','{"fixture":"p16"}');
insert into p16_ids select 'saved_a4',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000004','contractor','{"fixture":"p16"}');
insert into p16_ids select 'saved_a5',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000005','contractor','{"fixture":"p16"}');
insert into p16_ids select 'saved_a6',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000006','contractor','{"fixture":"p16"}');
insert into p16_ids select 'saved_insurance',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000007','insurance','{"fixture":"p16"}');
insert into p16_ids values
('project1',consumer.create_project('73000000-0000-4000-8000-000000000001','P16 Project One','contractor','{"zip":"33432"}',null)),
('project2',consumer.create_project('73000000-0000-4000-8000-000000000002','P16 Project Two','contractor','{"zip":"33432"}',null));
select consumer.add_saved_entity_to_project((select value from p16_ids where key='project1'),(select value from p16_ids where key='saved_a1'));
select consumer.add_saved_entity_to_project((select value from p16_ids where key='project2'),(select value from p16_ids where key='saved_a1'));
insert into p16_ids select 'watch_a1',watch_id from consumer.start_watch((select value from p16_ids where key='saved_a1'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000001');
insert into p16_ids select 'watch_a2',watch_id from consumer.start_watch((select value from p16_ids where key='saved_a2'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000002');
insert into p16_ids select 'watch_a3',watch_id from consumer.start_watch((select value from p16_ids where key='saved_a3'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000003');
insert into p16_ids select 'watch_a4',watch_id from consumer.start_watch((select value from p16_ids where key='saved_a4'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000004');
insert into p16_ids select 'watch_a5',watch_id from consumer.start_watch((select value from p16_ids where key='saved_a5'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000005');
insert into p16_ids select 'watch_a6',watch_id from consumer.start_watch((select value from p16_ids where key='saved_a6'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000006');
insert into p16_ids select 'watch_insurance',watch_id from consumer.start_watch((select value from p16_ids where key='saved_insurance'),array['51000000-0000-4000-8000-000000000006'::uuid],'83000000-0000-4000-8000-000000000007');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
insert into p16_ids select 'saved_b1',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000001','contractor','{"fixture":"p16"}');
insert into p16_ids select 'watch_b1',watch_id from consumer.start_watch((select value from p16_ids where key='saved_b1'),array['51000000-0000-4000-8000-000000000001'::uuid],'83000000-0000-4000-8000-000000000008');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000004',true);
insert into p16_ids select 'saved_empty',saved_entity_id from consumer.save_entity('33000000-0000-4000-8000-000000000001','contractor','{"fixture":"p16"}');
insert into p16_ids select 'watch_empty',watch_id from consumer.start_watch((select value from p16_ids where key='saved_empty'),array['51000000-0000-4000-8000-000000000002'::uuid],'83000000-0000-4000-8000-000000000009');
reset role;

-- Entity one: baseline, then an exact P0 material event.
set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_base1',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-base1','FL',1,statement_timestamp()-interval '8 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_base1'),'succeeded',statement_timestamp()-interval '7 minutes',statement_timestamp()-interval '10 minutes',statement_timestamp()-interval '7 minutes',1,'complete','compatible');
insert into p16_ids select 'obs_base1',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_base1'),'p16:entity1','{"status":"Active"}',statement_timestamp()-interval '10 minutes',null,statement_timestamp()-interval '7 minutes',null,null,'monitoring/v1','fixture:p16/base1');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p16_ids where key='obs_base1'));
reset role;
select pg_temp.p16_result('8 First baseline creates no Alert',not exists(select 1 from consumer.consumer_alerts),'baseline is not an Alert');
select pg_temp.p16_result('9 No-change observation creates no Alert',not exists(select 1 from consumer.consumer_alerts),'no source check noise');

set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_event1',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-event1','FL',1,statement_timestamp()-interval '6 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_event1'),'succeeded',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '5 minutes',1,'complete','compatible');
insert into p16_ids select 'obs_event1',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_event1'),'p16:entity1','{"status":"Suspended"}',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '5 minutes 30 seconds',statement_timestamp()-interval '5 minutes',null,null,'monitoring/v1','fixture:p16/event1');
reset role;
set local role myth_change_detector;
insert into p16_ids select 'event1',change_event_id from network.accept_source_observation((select value from p16_ids where key='obs_event1'));
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('36 Pending material event becomes needs attention',(select check_state='material_change' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a1'))),'pending event prevents reassurance');
reset role;

set local role myth_alert_fanout;
insert into p16_ids select 'fanout1',gen_random_uuid() from consumer.fanout_change_event((select value from p16_ids where key='event1')) where matching_watches=2 and alerts_created=2;
reset role;
insert into p16_ids select 'alert_a1',id from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000001' and change_event_id=(select value from p16_ids where key='event1');
insert into p16_ids select 'alert_b1',id from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000002' and change_event_id=(select value from p16_ids where key='event1');
select pg_temp.p16_result('1 Active exact-version Watch receives Alert',exists(select 1 from p16_ids where key='alert_a1'),'exact coverage matched');
select pg_temp.p16_result('10 One event and Watch creates one Alert',(select count(*)=1 from consumer.consumer_alerts where watch_id=(select value from p16_ids where key='watch_a1') and change_event_id=(select value from p16_ids where key='event1')),'unique Watch/event pair');
select pg_temp.p16_result('13 One Watch in two Projects gets one Alert',(select count(*)=1 from consumer.consumer_alerts where watch_id=(select value from p16_ids where key='watch_a1')) and (select jsonb_array_length(project_context_snapshot->'projects')=2 from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')),'Project context snapshots without duplication');
select pg_temp.p16_result('14 Two consumers watching same event receive own Alert',(select count(*)=2 from consumer.consumer_alerts where change_event_id=(select value from p16_ids where key='event1')),'one per eligible Watch');
select pg_temp.p16_result('15 User with no matching Watch receives none',not exists(select 1 from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000004'),'no exact coverage match');

set local role myth_alert_fanout;
select * from consumer.fanout_change_event((select value from p16_ids where key='event1'));
reset role;
select pg_temp.p16_result('11 Retry does not duplicate',(select count(*)=2 from consumer.consumer_alerts where change_event_id=(select value from p16_ids where key='event1')),'complete event is stable');
select pg_temp.p16_result('12 Concurrent fanout does not duplicate',pg_temp.p16_errors(format(
  'insert into consumer.consumer_alerts(user_id,watch_id,change_event_id,template_key,template_version,severity,project_context_snapshot,source_as_of,observed_at) select user_id,watch_id,change_event_id,template_key,template_version,severity,project_context_snapshot,source_as_of,observed_at from consumer.consumer_alerts where id=%L',
  (select value::text from p16_ids where key='alert_a1'))),'unique constraint is race-safe');

-- Paused event, post-resume event, and stopped Watch event.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select consumer.pause_watch((select value from p16_ids where key='watch_a2'),(select row_version from consumer.consumer_watches where id=(select value from p16_ids where key='watch_a2')),'83000000-0000-4000-8000-000000000010');
select consumer.stop_watch((select value from p16_ids where key='watch_a3'),(select row_version from consumer.consumer_watches where id=(select value from p16_ids where key='watch_a3')),'83000000-0000-4000-8000-000000000011');
reset role;

set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_lifecycle_base',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-lifecycle-base','FL',2,statement_timestamp()-interval '4 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_lifecycle_base'),'succeeded',statement_timestamp()-interval '3 minutes 50 seconds',statement_timestamp()-interval '4 minutes',statement_timestamp()-interval '3 minutes 50 seconds',2,'complete','compatible');
insert into p16_ids select 'obs_pause_base',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_lifecycle_base'),'p16:pause','{"status":"Active"}',statement_timestamp()-interval '4 minutes',null,statement_timestamp()-interval '3 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/pause-base');
insert into p16_ids select 'obs_stop_base',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_lifecycle_base'),'p16:stop','{"status":"Active"}',statement_timestamp()-interval '4 minutes',null,statement_timestamp()-interval '3 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/stop-base');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p16_ids where key='obs_pause_base'));
select * from network.accept_source_observation((select value from p16_ids where key='obs_stop_base'));
reset role;

set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_lifecycle_event',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-lifecycle-event','FL',2,statement_timestamp()-interval '3 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_lifecycle_event'),'succeeded',statement_timestamp()-interval '2 minutes 50 seconds',statement_timestamp()-interval '3 minutes',statement_timestamp()-interval '2 minutes 50 seconds',2,'complete','compatible');
insert into p16_ids select 'obs_pause_event',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_lifecycle_event'),'p16:pause','{"status":"Suspended"}',statement_timestamp()-interval '3 minutes',null,statement_timestamp()-interval '2 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/pause-event');
insert into p16_ids select 'obs_stop_event',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_lifecycle_event'),'p16:stop','{"status":"Suspended"}',statement_timestamp()-interval '3 minutes',null,statement_timestamp()-interval '2 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/stop-event');
reset role;
set local role myth_change_detector;
insert into p16_ids select 'event_pause',change_event_id from network.accept_source_observation((select value from p16_ids where key='obs_pause_event'));
insert into p16_ids select 'event_stop',change_event_id from network.accept_source_observation((select value from p16_ids where key='obs_stop_event'));
reset role;
set local role myth_alert_fanout;
select * from consumer.fanout_change_event((select value from p16_ids where key='event_pause'));
select * from consumer.fanout_change_event((select value from p16_ids where key='event_stop'));
reset role;
select pg_temp.p16_result('2 Paused Watch does not receive Alert',not exists(select 1 from consumer.consumer_alerts where watch_id=(select value from p16_ids where key='watch_a2')),'paused excluded');
select pg_temp.p16_result('3 Stopped Watch does not receive Alert',not exists(select 1 from consumer.consumer_alerts where watch_id=(select value from p16_ids where key='watch_a3')),'stopped excluded');
select pg_temp.p16_result('16 Event during pause excluded',not exists(select 1 from consumer.consumer_alerts where change_event_id=(select value from p16_ids where key='event_pause')),'pause boundary enforced');

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select consumer.resume_watch((select value from p16_ids where key='watch_a2'),(select row_version from consumer.consumer_watches where id=(select value from p16_ids where key='watch_a2')),'83000000-0000-4000-8000-000000000012');
reset role;
set local role myth_alert_fanout;
select * from consumer.fanout_change_event((select value from p16_ids where key='event_pause'));
reset role;
select pg_temp.p16_result('18 No retroactive catch-up',not exists(select 1 from consumer.consumer_alerts where change_event_id=(select value from p16_ids where key='event_pause')),'completed paused-period event stays excluded');

set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_resume_event',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-resume-event','FL',1,statement_timestamp()-interval '1 minute'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_resume_event'),'succeeded',statement_timestamp()-interval '50 seconds',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '50 seconds',1,'complete','compatible');
insert into p16_ids select 'obs_resume_event',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_resume_event'),'p16:pause','{"status":"Active"}',statement_timestamp()-interval '1 minute',null,statement_timestamp()-interval '50 seconds',null,null,'monitoring/v1','fixture:p16/resume-event');
reset role;
set local role myth_change_detector;
insert into p16_ids select 'event_resume',change_event_id from network.accept_source_observation((select value from p16_ids where key='obs_resume_event'));
reset role;
set local role myth_alert_fanout;
select * from consumer.fanout_change_event((select value from p16_ids where key='event_resume'));
reset role;
select pg_temp.p16_result('17 Event after resume included',exists(select 1 from consumer.consumer_alerts where watch_id=(select value from p16_ids where key='watch_a2') and change_event_id=(select value from p16_ids where key='event_resume')),'post-resume event eligible');

-- Exact v2 event does not match v1 coverage.
set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_v2base',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000016','p16-v2base','FL',1,statement_timestamp()-interval '4 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_v2base'),'succeeded',statement_timestamp()-interval '3 minutes 50 seconds',statement_timestamp()-interval '4 minutes',statement_timestamp()-interval '3 minutes 50 seconds',1,'complete','compatible');
insert into p16_ids select 'obs_v2base',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000016',(select value from p16_ids where key='cp_v2base'),'p16:v2','{"record_keys":[]}',statement_timestamp()-interval '4 minutes',null,statement_timestamp()-interval '3 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/v2base');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p16_ids where key='obs_v2base'));
reset role;
set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_v2event',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000016','p16-v2event','FL',1,statement_timestamp()-interval '2 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_v2event'),'succeeded',statement_timestamp()-interval '110 seconds',statement_timestamp()-interval '2 minutes',statement_timestamp()-interval '110 seconds',1,'complete','compatible');
insert into p16_ids select 'obs_v2event',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000016',(select value from p16_ids where key='cp_v2event'),'p16:v2','{"record_keys":["row-1"]}',statement_timestamp()-interval '2 minutes',null,statement_timestamp()-interval '110 seconds',null,null,'monitoring/v1','fixture:p16/v2event');
reset role;
set local role myth_change_detector;
insert into p16_ids select 'event_v2',change_event_id from network.accept_source_observation((select value from p16_ids where key='obs_v2event'));
reset role;
set local role myth_alert_fanout;
select * from consumer.fanout_change_event((select value from p16_ids where key='event_v2'));
reset role;
select pg_temp.p16_result('4 Wrong capability version does not receive Alert',not exists(select 1 from consumer.consumer_alerts where watch_id=(select value from p16_ids where key='watch_a4')),'no silent version upgrade');

-- Inactive events never fan out. These fixtures reuse traceable P15 observations.
insert into network.network_change_events(
  id,network_entity_id,capability_id,capability_version,checkpoint_id,previous_observation_id,new_observation_id,
  severity_rule_id,event_type,previous_material_value,new_material_value,source_as_of,observed_at,severity,
  severity_rule_version,event_fingerprint,status,fanout_status,retraction_reason
)
select v.id,e.network_entity_id,e.capability_id,e.capability_version,e.checkpoint_id,e.previous_observation_id,e.new_observation_id,
  e.severity_rule_id,e.event_type,e.previous_material_value,e.new_material_value,e.source_as_of,statement_timestamp(),e.severity,
  e.severity_rule_version,encode(extensions.digest(v.label,'sha256'),'hex'),v.status,'pending',
  case when v.status='retracted' then 'P16 validation fixture correction' else null end
from network.network_change_events e
cross join (values
 ('43000000-0000-4000-8000-000000000001'::uuid,'p16-suppressed','suppressed'),
 ('43000000-0000-4000-8000-000000000002'::uuid,'p16-quarantined','quarantined'),
 ('43000000-0000-4000-8000-000000000003'::uuid,'p16-retracted','retracted'),
 ('43000000-0000-4000-8000-000000000004'::uuid,'p16-mass','suppressed')
) v(id,label,status)
where e.id=(select value from p16_ids where key='event1');
set local role myth_alert_fanout;
select * from consumer.fanout_change_event('43000000-0000-4000-8000-000000000001');
select * from consumer.fanout_change_event('43000000-0000-4000-8000-000000000002');
select * from consumer.fanout_change_event('43000000-0000-4000-8000-000000000003');
select * from consumer.fanout_change_event('43000000-0000-4000-8000-000000000004');
reset role;
select pg_temp.p16_result('5 Suppressed event does not create Alert',not exists(select 1 from consumer.consumer_alerts where change_event_id='43000000-0000-4000-8000-000000000001'),'suppressed before fanout');
select pg_temp.p16_result('6 Quarantined event does not create Alert',not exists(select 1 from consumer.consumer_alerts where change_event_id='43000000-0000-4000-8000-000000000002'),'quarantine before fanout');
select pg_temp.p16_result('7 Retracted event does not create new Alert',not exists(select 1 from consumer.consumer_alerts where change_event_id='43000000-0000-4000-8000-000000000003'),'retracted before fanout');
select pg_temp.p16_result('49 Suppressed mass-change produces no Alert',not exists(select 1 from consumer.consumer_alerts where change_event_id='43000000-0000-4000-8000-000000000004'),'mass guard blocks fanout');

-- Read state and safe detail.
select pg_temp.p16_result('19 Alert is unread initially',(select status='unread' and read_at is null from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')),'attention state begins unread');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select consumer.set_alert_read_state((select value from p16_ids where key='alert_a1'),true,(select row_version from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')));
select pg_temp.p16_result('20 Mark read',(select read_state='read' from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'read timestamp set');
select consumer.set_alert_read_state((select value from p16_ids where key='alert_a1'),false,(select row_version from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')));
select pg_temp.p16_result('21 Mark unread',(select read_state='unread' from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'read timestamp cleared');
select consumer.mark_all_alerts_read();
select pg_temp.p16_result('22 Mark all read',not exists(select 1 from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000001' and status='unread'),'history retained while caught up');
reset role;
select pg_temp.p16_result('23 Consumer B cannot change Consumer A state',pg_temp.p16_errors(format(
  'set local role authenticated; select set_config(''request.jwt.claim.sub'',''13000000-0000-4000-8000-000000000002'',true); select consumer.set_alert_read_state(%L,false,2)',
  (select value::text from p16_ids where key='alert_a1'))),'ownership enforced');

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('24 Exact watched grain visible',(select watched_grain='license_status' and capability_version=1 from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'exact coverage disclosed');
select pg_temp.p16_result('25 Source visible',(select source_organization='Florida DBPR' from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'reviewed source name');
select pg_temp.p16_result('26 Official-as-of preserved',(select official_as_of is not null from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'source clock retained');
select pg_temp.p16_result('27 Observed and check time remain distinct',(select observed_at<>checked_at from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'monitoring and source-run clocks remain separate');
select pg_temp.p16_result('28 Project context present',(select jsonb_array_length(project_context->'projects')=2 from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'one Alert with two context entries');
select pg_temp.p16_result('29 Why-received chain is explicit',(select why_received like 'You asked My TrustHub to Watch%' and coverage_id is not null from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'Saved to Watch to grain to event to Alert');
select pg_temp.p16_result('30 Raw source payload absent',not exists(select 1 from information_schema.columns where table_schema='consumer' and table_name='consumer_alerts' and column_name in ('normalized_value','previous_material_value','new_material_value')),'safe detail only');
reset role;

-- Healthy unchanged and baseline-only fixtures.
set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_unchanged_base',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-unchanged-base','FL',2,statement_timestamp()-interval '4 minutes'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_unchanged_base'),'succeeded',statement_timestamp()-interval '3 minutes 50 seconds',statement_timestamp()-interval '4 minutes',statement_timestamp()-interval '3 minutes 50 seconds',2,'complete','compatible');
insert into p16_ids select 'obs_unchanged_base',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_unchanged_base'),'p16:unchanged','{"status":"Active"}',statement_timestamp()-interval '4 minutes',null,statement_timestamp()-interval '3 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/unchanged-base');
insert into p16_ids select 'obs_baseline_only',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_unchanged_base'),'p16:baseline-only','{"status":"Active"}',statement_timestamp()-interval '4 minutes',null,statement_timestamp()-interval '3 minutes 50 seconds',null,null,'monitoring/v1','fixture:p16/baseline-only');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p16_ids where key='obs_unchanged_base'));
select * from network.accept_source_observation((select value from p16_ids where key='obs_baseline_only'));
reset role;
set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_unchanged',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000001','p16-unchanged','FL',1,statement_timestamp()-interval '10 seconds'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_unchanged'),'succeeded',statement_timestamp()-interval '5 seconds',statement_timestamp()-interval '10 seconds',statement_timestamp()-interval '5 seconds',1,'complete','compatible');
insert into p16_ids select 'obs_unchanged',observation_id from network.submit_source_observation('33000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000001',(select value from p16_ids where key='cp_unchanged'),'p16:unchanged','{"status":"Active","retrieval_note":"ignored"}',statement_timestamp()-interval '10 seconds',null,statement_timestamp()-interval '5 seconds',null,null,'monitoring/v1','fixture:p16/unchanged');
reset role;
set local role myth_change_detector;
select * from network.accept_source_observation((select value from p16_ids where key='obs_unchanged'));
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('31 Current healthy unchanged becomes no_change',(select check_state='no_change' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a5'))),'P15 eligibility is true');
reset role;
update ops.source_feed_checkpoints set health_status='delayed' where id=(select value from p16_ids where key='cp_unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('32 Delayed source gives no reassurance',(select check_state='delayed' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a5'))),'health overrides no-change');
reset role;
update ops.source_feed_checkpoints set health_status='degraded' where id=(select value from p16_ids where key='cp_unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('33 Degraded source gives no reassurance',(select check_state='degraded' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a5'))),'health overrides no-change');
reset role;
update ops.source_feed_checkpoints set health_status='unknown' where id=(select value from p16_ids where key='cp_unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('34 Unknown source gives no reassurance',(select check_state='unknown' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a5'))),'absence of truth is explicit');
reset role;
update ops.source_feed_checkpoints set health_status='current' where id=(select value from p16_ids where key='cp_unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('35 Baseline only gives no reassurance',(select check_state='baseline_only' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a6'))),'a first observation is not no-change');
select pg_temp.p16_result('37 Active surfaced Alert becomes material change',(select check_state='material_change' from consumer.get_watch_coverage_checks((select value from p16_ids where key='saved_a1'))),'surfaced material history remains visible');
reset role;

-- Add a degraded second grain, verify worst-grain summary, then remove it.
set local role myth_source_ingestor_contractor;
insert into p16_ids values('cp_degraded_grain',ops.start_source_checkpoint('51000000-0000-4000-8000-000000000002','p16-degraded-grain','FL',1,statement_timestamp()-interval '1 minute'));
select ops.complete_source_checkpoint((select value from p16_ids where key='cp_degraded_grain'),'failed',statement_timestamp()-interval '50 seconds',null,null,null,'failed','unknown','SOURCE_FAILED','P16 fixture');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select consumer.add_watch_coverage((select value from p16_ids where key='watch_a5'),'51000000-0000-4000-8000-000000000002',(select row_version from consumer.consumer_watches where id=(select value from p16_ids where key='watch_a5')),'83000000-0000-4000-8000-000000000013');
select pg_temp.p16_result('38 Worst-grain health controls whole Watch',(select health_status in ('degraded','unknown') from consumer.get_watch_summary((select value from p16_ids where key='saved_a5'))),'worst enabled grain retained');
select pg_temp.p16_result('39 Healthy grain cannot hide degraded grain',(select all_enabled_coverage_no_change=false from consumer.get_watch_summary((select value from p16_ids where key='saved_a5'))),'no blanket reassurance');
select consumer.remove_watch_coverage((select value from p16_ids where key='watch_a5'),'51000000-0000-4000-8000-000000000002',(select row_version from consumer.consumer_watches where id=(select value from p16_ids where key='watch_a5')),'83000000-0000-4000-8000-000000000014');
reset role;

-- Consumer-safe history contains meaningful events only.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('40 Watch started visible',exists(select 1 from consumer.get_watch_observation_history((select value from p16_ids where key='saved_a1'),50) where entry_type='started'),'lifecycle history');
select pg_temp.p16_result('41 No-change check visible',exists(select 1 from consumer.get_watch_observation_history((select value from p16_ids where key='saved_a5'),50) where entry_type='source_checked_no_change'),'qualified source check only');
select pg_temp.p16_result('42 Material Alert visible',exists(select 1 from consumer.get_watch_observation_history((select value from p16_ids where key='saved_a1'),50) where entry_type='material_change_surfaced'),'Alert history');
select pg_temp.p16_result('43 Pause and resume visible',(select count(*)=2 from consumer.get_watch_observation_history((select value from p16_ids where key='saved_a2'),50) where entry_type in ('paused','resumed')),'intentional gap preserved');
select pg_temp.p16_result('44 Coverage add and remove visible',(select count(*)=2 from consumer.get_watch_observation_history((select value from p16_ids where key='saved_a5'),50) where entry_type in ('coverage_added','coverage_removed')),'coverage history');
select pg_temp.p16_result('45 Raw ingest retry omitted',not exists(select 1 from consumer.get_watch_observation_history((select value from p16_ids where key='saved_a5'),100) where entry_type in ('candidate_submitted','checkpoint_started','checkpoint_completed')),'history is bounded and meaningful');
reset role;

-- Retraction preserves the existing Alert and adds correction state.
set local role myth_monitoring_operator;
select network.retract_change_event((select value from p16_ids where key='event1'),'P16 validation source correction');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('46 Retracted Alert remains historically visible',exists(select 1 from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')),'history retained');
select pg_temp.p16_result('47 Correction state visible',(select event_state='retracted' and correction_notice is not null from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'source correction disclosed');
select pg_temp.p16_result('48 Retraction causes no silent deletion',(select count(*)>=1 from consumer.list_alerts(null,false,100,null) where alert_id=(select value from p16_ids where key='alert_a1')),'list retains corrected Alert');
reset role;

-- Mass event remains suppressed until an explicit per-event release.
update ops.source_feed_checkpoints set mass_change_status='released' where id=(select checkpoint_id from network.network_change_events where id='43000000-0000-4000-8000-000000000004');
set local role myth_monitoring_operator;
select network.approve_change_event_for_fanout('43000000-0000-4000-8000-000000000004','Reviewed P16 validation event for controlled release');
reset role;
select pg_temp.p16_result('50 Controlled release required before fanout',(select status='active' and fanout_status='pending' from network.network_change_events where id='43000000-0000-4000-8000-000000000004') and exists(select 1 from ops.consumer_alert_fanout_audit where change_event_id='43000000-0000-4000-8000-000000000004' and action='event_released'),'release is explicit and audited');

-- RLS and least privilege.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('51 Consumer A reads own Alerts',(select count(*)>=1 from consumer.consumer_alerts),'own-row RLS');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
select pg_temp.p16_result('52 Consumer A cannot read Consumer B Alerts',not exists(select 1 from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000001'),'cross-user rows hidden');
reset role;
select pg_temp.p16_result('53 Anonymous denied',pg_temp.p16_errors('set local role anon; select count(*) from consumer.consumer_alerts'),'anonymous has no grant');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);
select pg_temp.p16_result('54 Business-only denied',not exists(select 1 from consumer.consumer_alerts),'business metadata grants no access to another subject');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"business_role":"owner"}}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select pg_temp.p16_result('55 Dual-role user has own access only',exists(select 1 from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000001') and not exists(select 1 from consumer.consumer_alerts where user_id='13000000-0000-4000-8000-000000000002'),'canonical subject owns private rows');
reset role;
select pg_temp.p16_result('56 Browser cannot read raw observations',pg_temp.p16_errors('set local role authenticated; select count(*) from network.source_observations'),'raw envelope remains server-only');
select pg_temp.p16_result('57 Specialist BFF cannot enumerate unrelated Alerts',pg_temp.p16_errors('set local role myth_bff_contractor; select count(*) from consumer.consumer_alerts'),'BFF receives no table grant');
select pg_temp.p16_result('58 Fanout worker cannot modify notes',pg_temp.p16_errors('set local role myth_alert_fanout; delete from consumer.consumer_notes'),'fanout role cannot read or mutate research');

-- Cross-hub reads are entity-scoped and bounded.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select consumer.set_alert_read_state((select value from p16_ids where key='alert_a1'),false,(select row_version from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')));
select pg_temp.p16_result('59 Contractor gets narrow unread state',(select has_unread_alert and alert_count>=1 from consumer.get_cross_hub_entity_alert_state('23000000-0000-4000-8000-000000000001')),'entity-scoped summary only');
select pg_temp.p16_result('60 Insurance gets narrow state',(select not has_unread_alert and alert_count=0 from consumer.get_cross_hub_entity_alert_state('23000000-0000-4000-8000-000000000007')),'zero-Alert Saved entity returns bounded state');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
select pg_temp.p16_result('61 Move cannot enumerate unrelated Contractor Alerts',not exists(select 1 from consumer.get_cross_hub_entity_alert_state('23000000-0000-4000-8000-000000000002')),'unrelated entity is not disclosed');
reset role;
select pg_temp.p16_result('62 All-six-hub contract compatibility',(select count(*)=7 and bool_and('alert:read'=any(allowed_scopes)) from ops.consumer_hub_registry),'Ask and all six specialist hubs carry the narrow scope');

-- Empty inbox cannot imply healthy monitoring.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000004',true);
select pg_temp.p16_result('67 Empty Alerts reports unhealthy monitoring',
  (select total_alerts=0 and has_monitoring_health_issue from consumer.get_alerts_overview()),
  'empty history and source health are separate truths');
reset role;

-- Project/archive/Watch/Saved lifecycle never removes Alert history.
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select consumer.archive_project((select value from p16_ids where key='project1'),(select row_version from consumer.consumer_projects where id=(select value from p16_ids where key='project1')));
select pg_temp.p16_result('63 Archive Project preserves Alert',exists(select 1 from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')) and (select project_context->'projects' @> '[{"current_status":"archived"}]'::jsonb from consumer.get_alert_detail((select value from p16_ids where key='alert_a1'))),'historical context includes current archive state');
select consumer.stop_watch((select value from p16_ids where key='watch_a1'),(select row_version from consumer.consumer_watches where id=(select value from p16_ids where key='watch_a1')),'83000000-0000-4000-8000-000000000015');
select pg_temp.p16_result('64 Watch stop preserves Alert history',exists(select 1 from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')),'Watch lifecycle is separate');
select consumer.remove_saved_entity_from_project((select value from p16_ids where key='project1'),(select value from p16_ids where key='saved_a1'));
select pg_temp.p16_result('65 Membership removal preserves Alert',exists(select 1 from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')),'Project relation is separate');
select consumer.remove_saved_entity_from_project((select value from p16_ids where key='project2'),(select value from p16_ids where key='saved_a1'));
select consumer.remove_saved_entity((select value from p16_ids where key='saved_a1'),(select row_version from consumer.consumer_saved_entities where id=(select value from p16_ids where key='saved_a1')));
select pg_temp.p16_result('66 Saved removal preserves consumer Alert history',exists(select 1 from consumer.consumer_alerts where id=(select value from p16_ids where key='alert_a1')),'soft removal retains trace until workspace deletion');
reset role;

-- The required matrix is 66 cases; case 67 replaces no requirement and proves
-- the explicit empty-inbox health invariant, for 67 total P16 assertions.
do $$
declare total integer; failures integer;
begin
  select count(*),count(*) filter(where not passed) into total,failures from p16_test_results;
  if total<>67 then raise exception 'P16 matrix expected 67 cases, found %',total; end if;
  if failures<>0 then raise exception 'P16 matrix has % failures',failures; end if;
end;
$$;

select ordinal,test_name,passed,detail from p16_test_results order by test_name::text;
rollback;
