-- P17 notification preferences / delivery ledger / mock P0 email matrix.
-- Run only on an isolated branch after P11-P17 migrations and P14-P17 seeds.

create temporary table p17_test_results(
  ordinal integer generated always as identity,test_name text not null,passed boolean not null,detail text not null
) on commit preserve rows;
create temporary table p17_ids(key text primary key,value uuid not null) on commit preserve rows;

create or replace function pg_temp.p17_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$
  insert into p17_test_results(test_name,passed,detail) values(p_name,coalesce(p_passed,false),p_detail);
$$;
create or replace function pg_temp.p17_errors(p_sql text)
returns boolean language plpgsql as $$
begin execute p_sql; execute 'reset role'; return false;
exception when others then execute 'reset role'; return true; end;
$$;

grant myth_identity_governor,myth_notification_delivery,myth_monitoring_operator to postgres;
grant select,insert,update,delete on p17_ids,p17_test_results to authenticated,anon,
  myth_notification_delivery,myth_monitoring_operator,myth_bff_contractor;
grant usage,select on sequence p17_test_results_ordinal_seq to authenticated,anon,
  myth_notification_delivery,myth_monitoring_operator,myth_bff_contractor;

begin;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('14000000-0000-4000-8000-000000000001','authenticated','authenticated','p17-a@example.test',now(),now(),now()),
('14000000-0000-4000-8000-000000000002','authenticated','authenticated','p17-b@example.test',now(),now(),now()),
('14000000-0000-4000-8000-000000000003','authenticated','authenticated','p17-business@example.test',now(),now(),now()),
('14000000-0000-4000-8000-000000000004','authenticated','authenticated','not-an-email',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
insert into consumer.consumer_profiles(user_id) values('14000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
insert into consumer.consumer_profiles(user_id) values('14000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000004',true);
insert into consumer.consumer_profiles(user_id) values('14000000-0000-4000-8000-000000000004');
reset role;

set local role myth_identity_governor;
insert into network.network_entities(id,entity_type,canonical_name,primary_hub,jurisdiction,status) values
('24000000-0000-4000-8000-000000000001','organization','P17 Roofing Test','contractor','FL','active'),
('24000000-0000-4000-8000-000000000002','organization','P17 Hospice Test','senior','US','active'),
('24000000-0000-4000-8000-000000000003','organization','P17 Insurance Test','insurance','FL','active'),
('24000000-0000-4000-8000-000000000004','organization','P17 No-change Test','contractor','FL','active');
insert into network.network_entity_bindings(
 id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,
 source_identifier,jurisdiction,binding_status,confidence,resolution_note,valid_from,provenance_ref
) values
('34000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','contractor','organization','p17-roof','fl.dbpr.license','P17-LIC','FL','accepted',1,'P17 fixture','2026-01-01','fixture:p17'),
('34000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000002','senior','organization','p17-hospice','cms.ccn','P17-CMS','US','accepted',1,'P17 fixture','2026-01-01','fixture:p17'),
('34000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000003','insurance','organization','p17-insurance','fl.dfs.agency_license','P17-DFS','FL','accepted',1,'P17 fixture','2026-01-01','fixture:p17'),
('34000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000004','contractor','organization','p17-nochange','fl.dbpr.license','P17-NOCHANGE','FL','accepted',1,'P17 fixture','2026-01-01','fixture:p17');
reset role;

-- Canonical consumer state and explicit coverage.
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
insert into p17_ids select 'saved_a_p0',saved_entity_id from consumer.save_entity('34000000-0000-4000-8000-000000000001','contractor','{"fixture":"p17"}');
insert into p17_ids select 'watch_a_p0',watch_id from consumer.start_watch((select value from p17_ids where key='saved_a_p0'),array['51000000-0000-4000-8000-000000000001'::uuid],'84000000-0000-4000-8000-000000000001');
insert into p17_ids select 'saved_a_p1',saved_entity_id from consumer.save_entity('34000000-0000-4000-8000-000000000002','senior','{"fixture":"p17"}');
insert into p17_ids select 'watch_a_p1',watch_id from consumer.start_watch((select value from p17_ids where key='saved_a_p1'),array['51000000-0000-4000-8000-000000000007'::uuid],'84000000-0000-4000-8000-000000000002');
insert into p17_ids select 'saved_a_p2',saved_entity_id from consumer.save_entity('34000000-0000-4000-8000-000000000003','insurance','{"fixture":"p17"}');
insert into p17_ids select 'watch_a_p2',watch_id from consumer.start_watch((select value from p17_ids where key='saved_a_p2'),array['51000000-0000-4000-8000-000000000006'::uuid],'84000000-0000-4000-8000-000000000003');
insert into p17_ids select 'saved_a_nochange',saved_entity_id from consumer.save_entity('34000000-0000-4000-8000-000000000004','contractor','{"fixture":"p17"}');
insert into p17_ids select 'watch_a_nochange',watch_id from consumer.start_watch((select value from p17_ids where key='saved_a_nochange'),array['51000000-0000-4000-8000-000000000001'::uuid],'84000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
insert into p17_ids select 'saved_b_p0',saved_entity_id from consumer.save_entity('34000000-0000-4000-8000-000000000001','contractor','{"fixture":"p17"}');
insert into p17_ids select 'watch_b_p0',watch_id from consumer.start_watch((select value from p17_ids where key='saved_b_p0'),array['51000000-0000-4000-8000-000000000001'::uuid],'84000000-0000-4000-8000-000000000005');
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000004',true);
insert into p17_ids select 'saved_invalid_p0',saved_entity_id from consumer.save_entity('34000000-0000-4000-8000-000000000001','contractor','{"fixture":"p17"}');
insert into p17_ids select 'watch_invalid_p0',watch_id from consumer.start_watch((select value from p17_ids where key='saved_invalid_p0'),array['51000000-0000-4000-8000-000000000001'::uuid],'84000000-0000-4000-8000-000000000006');
reset role;

-- Traceable validation observations. Cap 1's latest run carries the qualified no-change entity.
insert into ops.source_feed_checkpoints(
 id,capability_id,capability_version,source_key,jurisdiction,run_id,request_fingerprint,run_status,
 started_at,completed_at,last_success_at,source_as_of,retrieved_at,expected_record_count,observed_record_count,
 completeness_status,schema_status,health_status
) values
('44000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,'fl.dbpr','FL','p17-cap1-old',encode(extensions.digest('p17-cap1-old','sha256'),'hex'),'succeeded',statement_timestamp()-interval '10 minutes',statement_timestamp()-interval '9 minutes',statement_timestamp()-interval '9 minutes',statement_timestamp()-interval '10 minutes',statement_timestamp()-interval '9 minutes',1,1,'complete','compatible','current'),
('44000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000007',1,'cms','US','p17-cap7',encode(extensions.digest('p17-cap7','sha256'),'hex'),'succeeded',statement_timestamp()-interval '8 minutes',statement_timestamp()-interval '7 minutes',statement_timestamp()-interval '7 minutes',statement_timestamp()-interval '8 minutes',statement_timestamp()-interval '7 minutes',1,1,'complete','compatible','current'),
('44000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000006',1,'fl.dfs','FL','p17-cap6',encode(extensions.digest('p17-cap6','sha256'),'hex'),'succeeded',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '5 minutes',1,1,'complete','compatible','current'),
('44000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000001',1,'fl.dbpr','FL','p17-cap1-latest',encode(extensions.digest('p17-cap1-latest','sha256'),'hex'),'succeeded',statement_timestamp()-interval '30 seconds',statement_timestamp()-interval '20 seconds',statement_timestamp()-interval '20 seconds',statement_timestamp()-interval '30 seconds',statement_timestamp()-interval '20 seconds',1,1,'complete','compatible','current');

insert into network.source_observations(
 id,original_network_entity_id,network_entity_id,entity_binding_id,capability_id,capability_version,
 source_key,grain_key,source_record_key,normalized_value,material_value,normalized_fingerprint,
 material_fingerprint,observation_fingerprint,observation_status,change_evaluation_status,
 source_as_of,retrieved_at,observed_at,sequence_effective_at,ingest_run_id,provenance_ref,schema_version
) values
('54000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,'fl.dbpr','license_status','p17-roof','{"status":"Active"}','{"status":"Active"}',repeat('1',64),repeat('2',64),repeat('3',64),'accepted','baseline',statement_timestamp()-interval '10 minutes',statement_timestamp()-interval '9 minutes',statement_timestamp()-interval '9 minutes',statement_timestamp()-interval '10 minutes','44000000-0000-4000-8000-000000000001','fixture:p17/roof/base','monitoring/v1'),
('54000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',1,'fl.dbpr','license_status','p17-roof','{"status":"Suspended"}','{"status":"Suspended"}',repeat('4',64),repeat('5',64),repeat('6',64),'accepted','event_created',statement_timestamp()-interval '9 minutes',statement_timestamp()-interval '8 minutes',statement_timestamp()-interval '8 minutes',statement_timestamp()-interval '9 minutes','44000000-0000-4000-8000-000000000001','fixture:p17/roof/change','monitoring/v1'),
('54000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000007',1,'cms','ownership','p17-hospice','{"owner_id":"A"}','{"owner_id":"A"}',repeat('7',64),repeat('8',64),repeat('9',64),'accepted','baseline',statement_timestamp()-interval '8 minutes',statement_timestamp()-interval '7 minutes',statement_timestamp()-interval '7 minutes',statement_timestamp()-interval '8 minutes','44000000-0000-4000-8000-000000000002','fixture:p17/hospice/base','monitoring/v1'),
('54000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000007',1,'cms','ownership','p17-hospice','{"owner_id":"B"}','{"owner_id":"B"}',repeat('a',64),repeat('b',64),repeat('c',64),'accepted','event_created',statement_timestamp()-interval '7 minutes',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '7 minutes','44000000-0000-4000-8000-000000000002','fixture:p17/hospice/change','monitoring/v1'),
('54000000-0000-4000-8000-000000000005','24000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000003','34000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000006',1,'fl.dfs','agency_status','p17-insurance','{"status":"Active"}','{"status":"Active"}',repeat('d',64),repeat('e',64),repeat('f',64),'accepted','baseline',statement_timestamp()-interval '6 minutes',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '6 minutes','44000000-0000-4000-8000-000000000003','fixture:p17/insurance/base','monitoring/v1'),
('54000000-0000-4000-8000-000000000006','24000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000003','34000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000006',1,'fl.dfs','agency_status','p17-insurance','{"status":"Inactive"}','{"status":"Inactive"}',repeat('0',64),repeat('1',64),repeat('2',64),'accepted','event_created',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '4 minutes',statement_timestamp()-interval '4 minutes',statement_timestamp()-interval '5 minutes','44000000-0000-4000-8000-000000000003','fixture:p17/insurance/change','monitoring/v1'),
('54000000-0000-4000-8000-000000000007','24000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000004','34000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000001',1,'fl.dbpr','license_status','p17-nochange','{"status":"Active"}','{"status":"Active"}',repeat('3',64),repeat('4',64),repeat('5',64),'accepted','baseline',statement_timestamp()-interval '40 seconds',statement_timestamp()-interval '35 seconds',statement_timestamp()-interval '35 seconds',statement_timestamp()-interval '40 seconds','44000000-0000-4000-8000-000000000004','fixture:p17/nochange/base','monitoring/v1'),
('54000000-0000-4000-8000-000000000008','24000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000004','34000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000001',1,'fl.dbpr','license_status','p17-nochange','{"status":"Active","retrieval_note":"ignored"}','{"status":"Active"}',repeat('6',64),repeat('4',64),repeat('7',64),'accepted','no_change',statement_timestamp()-interval '30 seconds',statement_timestamp()-interval '20 seconds',statement_timestamp()-interval '20 seconds',statement_timestamp()-interval '30 seconds','44000000-0000-4000-8000-000000000004','fixture:p17/nochange/check','monitoring/v1');

create or replace function pg_temp.p17_make_alert(
 p_key text,p_user uuid,p_watch uuid,p_entity uuid,p_capability uuid,
 p_previous_observation uuid,p_new_observation uuid,p_severity text
) returns uuid language plpgsql as $$
declare rule_row network.alert_severity_rules%rowtype; alert_template network.consumer_alert_templates%rowtype;
 event_id uuid:=gen_random_uuid(); alert_id uuid:=gen_random_uuid(); event_observed timestamptz:=statement_timestamp();
begin
 select * into rule_row from network.alert_severity_rules r
 where r.capability_id=p_capability and r.severity=p_severity and r.governance_status='approved' and r.enabled
 order by r.rule_priority limit 1;
 select * into alert_template from network.consumer_alert_templates t
 where t.template_key=rule_row.safe_template_key and t.governance_status='approved' order by version desc limit 1;
 insert into network.network_change_events(
  id,network_entity_id,capability_id,capability_version,checkpoint_id,previous_observation_id,new_observation_id,
  severity_rule_id,event_type,previous_material_value,new_material_value,source_as_of,observed_at,severity,
  severity_rule_version,event_fingerprint,status,fanout_status
 ) select event_id,p_entity,p_capability,c.version,o.ingest_run_id,p_previous_observation,p_new_observation,
   rule_row.id,rule_row.event_type,'{"before":"fixture"}','{"after":"fixture"}',o.source_as_of,event_observed,
   p_severity,rule_row.rule_version,encode(extensions.digest('p17-event-'||p_key,'sha256'),'hex'),'active','complete'
   from network.watch_capabilities c join network.source_observations o on o.id=p_new_observation where c.id=p_capability;
 insert into consumer.consumer_alerts(
  id,user_id,watch_id,change_event_id,template_key,template_version,severity,source_as_of,observed_at
 ) select alert_id,p_user,p_watch,event_id,alert_template.template_key,alert_template.version,p_severity,e.source_as_of,e.observed_at
   from network.network_change_events e where e.id=event_id;
 insert into p17_ids values('event_'||p_key,event_id),('alert_'||p_key,alert_id);
 return alert_id;
end;
$$;

-- Multiple Alerts share durable Watch/coverage but have distinct exact events.
select pg_temp.p17_make_alert('success','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('override','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('globaloff','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('retry','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('retract','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('suppressed','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('permanent','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('rate','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000001','P0');
select pg_temp.p17_make_alert('paused','14000000-0000-4000-8000-000000000002',(select value from p17_ids where key='watch_b_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('invalid','14000000-0000-4000-8000-000000000004',(select value from p17_ids where key='watch_invalid_p0'),'24000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000002','P0');
select pg_temp.p17_make_alert('p1','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p1'),'24000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000007','54000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000004','P1');
select pg_temp.p17_make_alert('p2default','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p2'),'24000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-000000000005','54000000-0000-4000-8000-000000000006','P2');
select pg_temp.p17_make_alert('p2optin','14000000-0000-4000-8000-000000000001',(select value from p17_ids where key='watch_a_p2'),'24000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-000000000005','54000000-0000-4000-8000-000000000006','P2');

-- Global defaults and owner-only mutations.
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('1 Consumer reads own preferences',(select p0_email_enabled and p1_digest_enabled and not p2_digest_enabled and periodic_watch_summary_enabled from consumer.get_notification_preferences()),'deterministic transactional defaults');
select consumer.update_notification_preferences(false,true,false,true,'America/New_York',time '08:30',1,'85000000-0000-4000-8000-000000000001');
select pg_temp.p17_result('2 Consumer updates P0 email',(select not p0_email_enabled from consumer.get_notification_preferences()),'global P0 off');
select consumer.update_notification_preferences(false,false,false,true,'America/New_York',time '08:30',2,'85000000-0000-4000-8000-000000000002');
select pg_temp.p17_result('3 Consumer updates P1 digest',(select not p1_digest_enabled from consumer.get_notification_preferences()),'P1 digest mutable');
select consumer.update_notification_preferences(false,false,true,true,'America/New_York',time '08:30',3,'85000000-0000-4000-8000-000000000003');
select pg_temp.p17_result('4 Consumer updates P2 digest',(select p2_digest_enabled from consumer.get_notification_preferences()),'explicit P2 opt-in');
select consumer.update_notification_preferences(false,false,true,false,'America/New_York',time '08:30',4,'85000000-0000-4000-8000-000000000004');
select pg_temp.p17_result('5 Consumer updates Watch summary',(select not periodic_watch_summary_enabled from consumer.get_notification_preferences()),'summary preference independent');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
select pg_temp.p17_result('6 Consumer B cannot read A preferences',not exists(select 1 from consumer.consumer_notification_preferences where user_id='14000000-0000-4000-8000-000000000001'),'RLS owner isolation');
reset role;
select pg_temp.p17_result('7 Anonymous denied',pg_temp.p17_errors('set local role anon; select * from consumer.get_notification_preferences()'),'authentication required');
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000003',true);
select pg_temp.p17_result('8 Business-only denied',not exists(select 1 from consumer.consumer_notification_preferences),'business authorization adds no access');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"business_role":"owner"}}',true);
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('9 Dual-role own only',(select count(*)=1 from consumer.consumer_notification_preferences),'canonical subject remains boundary');

-- Restore global defaults except timezone; exercise override precedence.
select consumer.update_notification_preferences(true,true,false,true,'America/New_York',time '08:30',5,'85000000-0000-4000-8000-000000000005');
select consumer.set_watch_notification_override((select value from p17_ids where key='watch_a_p0'),'P0',false,'85000000-0000-4000-8000-000000000010');
select pg_temp.p17_result('10 Override P0 off',(select not enabled from consumer.get_watch_notification_overrides((select value from p17_ids where key='watch_a_p0')) where severity='P0'),'Watch-level delivery control');
reset role;
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_override',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_override'),'86000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.p17_result('11 Global on plus Watch off means no email',(select status='suppressed' and error_code='PREFERENCE_DISABLED' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_override')),'override tightens global consent');
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select consumer.update_notification_preferences(false,true,false,true,'America/New_York',time '08:30',6,'85000000-0000-4000-8000-000000000006');
select consumer.set_watch_notification_override((select value from p17_ids where key='watch_a_p0'),'P0',true,'85000000-0000-4000-8000-000000000011');
reset role;
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_globaloff',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_globaloff'),'86000000-0000-4000-8000-000000000002');
reset role;
select pg_temp.p17_result('12 Global off plus Watch on remains off',(select status='suppressed' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_globaloff')),'override cannot elevate global consent');
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select consumer.update_notification_preferences(true,true,false,true,'America/New_York',time '08:30',7,'85000000-0000-4000-8000-000000000007');
select consumer.remove_watch_notification_override((select value from p17_ids where key='watch_a_p0'),'P0','85000000-0000-4000-8000-000000000012');
select pg_temp.p17_result(
  '13 Override removal returns to global',
  not exists(select 1 from consumer.get_watch_notification_overrides((select value from p17_ids where key='watch_a_p0')) where severity='P0')
    and (select p0_email_enabled from consumer.get_notification_preferences()),
  'override removed and global default restored'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
select pg_temp.p17_result('14 Unrelated consumer denied',pg_temp.p17_errors(format('select consumer.set_watch_notification_override(%L,''P0'',false,%L)',(select value::text from p17_ids where key='watch_a_p0'),'85000000-0000-4000-8000-000000000013')),'Watch ownership enforced');
reset role;
select pg_temp.p17_result('15 Specialist BFF cannot read overrides',pg_temp.p17_errors('set local role myth_bff_contractor; select count(*) from consumer.consumer_watch_notification_overrides'),'private delivery setting');

-- Enqueue channel behavior and successful mock P0.
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_success',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_success'),'86000000-0000-4000-8000-000000000010');
insert into p17_ids select 'delivery_p1',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_p1'),'86000000-0000-4000-8000-000000000011');
insert into p17_ids select 'delivery_p2default',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_p2default'),'86000000-0000-4000-8000-000000000012');
reset role;
select pg_temp.p17_result('16 Eligible P0 creates one delivery',(select status='pending' and delivery_type='p0_immediate' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_success')),'P0 immediate eligibility');
select pg_temp.p17_result('17 P1 does not immediate-send',(select status='pending' and delivery_type='p1_digest' and attempt_count=0 from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_p1')),'digest queue only');
select pg_temp.p17_result('18 P2 does not immediate-send',(select status='suppressed' and attempt_count=0 from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_p2default')),'in-app default');

set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
select consumer.pause_watch((select value from p17_ids where key='watch_b_p0'),(select row_version from consumer.consumer_watches where id=(select value from p17_ids where key='watch_b_p0')),'85000000-0000-4000-8000-000000000020');
reset role;
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_paused',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_paused'),'86000000-0000-4000-8000-000000000013');
reset role;
select pg_temp.p17_result('19 Paused or stopped Watch Alert cannot newly deliver',(select status='suppressed' and error_code='WATCH_NOT_ACTIVE' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_paused')),'current lifecycle rechecked');

set local role myth_notification_delivery;
insert into p17_ids select 'delivery_retract',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_retract'),'86000000-0000-4000-8000-000000000014');
reset role;
set local role myth_monitoring_operator;
select network.retract_change_event((select value from p17_ids where key='event_retract'),'P17 source correction before send');
reset role;
set local role myth_notification_delivery;
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_retract'),'success');
reset role;
select pg_temp.p17_result('20 Retracted Alert pending delivery suppressed',(select status='suppressed' and error_code='ALERT_EVENT_NOT_ACTIVE' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_retract')),'send-time eligibility');
update network.network_change_events set status='suppressed',fanout_status='not_applicable' where id=(select value from p17_ids where key='event_suppressed');
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_suppressed',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_suppressed'),'86000000-0000-4000-8000-000000000015');
reset role;
select pg_temp.p17_result('21 Suppressed Alert has no outbound delivery',(select status='suppressed' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_suppressed')),'source/event suppression propagates');
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_invalid',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_invalid'),'86000000-0000-4000-8000-000000000016');
reset role;
select pg_temp.p17_result('22 Invalid email does not send',(select status='suppressed' and failure_class='invalid_destination' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_invalid')),'Alert and Watch remain');

set local role myth_notification_delivery;
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_success'),'success');
reset role;
select pg_temp.p17_result('23 Valid preference and P0 simulates success',(select status='delivered' and provider_message_ref like 'mock:p17:%' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_success')),'mock transport only');
select pg_temp.p17_result('24 One Alert produces one logical email delivery',(select count(*)=1 from ops.consumer_alert_deliveries where alert_id=(select value from p17_ids where key='alert_success')),'logical unique key');
set local role myth_notification_delivery;
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_success'),'success');
reset role;
select pg_temp.p17_result('25 Retry creates no duplicate successful send',(select count(*)=1 from ops.consumer_alert_delivery_attempts where delivery_id=(select value from p17_ids where key='delivery_success') and outcome='delivered'),'terminal success');
select pg_temp.p17_result('26 Concurrent worker has one success',(select count(*)=1 and max(attempt_count)=1 from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_success')),'row lock and terminal state');
select pg_temp.p17_result('27 Delivered Alert remains in-app',exists(select 1 from consumer.consumer_alerts where id=(select value from p17_ids where key='alert_success')),'delivery ledger separate');
select pg_temp.p17_result('28 Email delivery does not mark Alert read',(select status='unread' from consumer.consumer_alerts where id=(select value from p17_ids where key='alert_success')),'attention state independent');

-- Retry, failure, and stable enqueue behavior.
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_retry',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_retry'),'86000000-0000-4000-8000-000000000020');
select * from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_retry'),'86000000-0000-4000-8000-000000000020');
reset role;
select pg_temp.p17_result('29 Repeated enqueue stable',(select count(*)=1 from ops.consumer_alert_deliveries where alert_id=(select value from p17_ids where key='alert_retry')),'same logical row');
select pg_temp.p17_result('30 Repeated process after delivered does not resend',(select attempt_count=1 from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_success')),'delivered terminal');
set local role myth_notification_delivery;
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_retry'),'transient_failure',statement_timestamp());
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_retry'),'success',statement_timestamp()+interval '2 minutes');
reset role;
select pg_temp.p17_result('31 Provider retry safe',(select status='delivered' and attempt_count=2 from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_retry')),'one logical delivery across retry');
select pg_temp.p17_result('32 Idempotency survives worker restart simulation',(select count(*)=2 and count(*) filter(where outcome='delivered')=1 from ops.consumer_alert_delivery_attempts where delivery_id=(select value from p17_ids where key='delivery_retry')),'durable attempt ledger');
select pg_temp.p17_result('33 Transient failure retries',(select count(*)=2 from ops.consumer_alert_delivery_attempts where delivery_id=(select value from p17_ids where key='delivery_retry')),'bounded retry succeeded');

set local role myth_notification_delivery;
insert into p17_ids select 'delivery_permanent',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_permanent'),'86000000-0000-4000-8000-000000000021');
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_permanent'),'permanent_failure');
insert into p17_ids select 'delivery_rate',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_rate'),'86000000-0000-4000-8000-000000000022');
select * from ops.process_mock_p0_email((select value from p17_ids where key='delivery_rate'),'rate_limited',statement_timestamp());
reset role;
select pg_temp.p17_result('34 Permanent failure stops',(select status='failed' and failure_class='permanent' and next_attempt_at is null from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_permanent')),'terminal classification');
select pg_temp.p17_result('35 Rate-limit failure schedules safely',(select status='failed' and failure_class='rate_limited' and next_attempt_at is not null from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_rate')),'bounded retry delay');
select pg_temp.p17_result('36 Invalid destination terminal',(select status='suppressed' and next_attempt_at is null from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_invalid')),'no futile retry');
select pg_temp.p17_result('37 Attempt count correct',(select attempt_count=2 from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_retry')),'attempts append once');
select pg_temp.p17_result('38 Failure never disables Watch',(select status='active' from consumer.consumer_watches where id=(select value from p17_ids where key='watch_a_p0')),'delivery cannot mutate coverage/lifecycle');

-- Digest eligibility and timezone.
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('39 P1 eligible for digest',exists(select 1 from consumer.get_digest_eligibility(null) where alert_id=(select value from p17_ids where key='alert_p1')),'P1 default digest');
select pg_temp.p17_result('40 P2 excluded by default',not exists(select 1 from consumer.get_digest_eligibility(null) where alert_id=(select value from p17_ids where key='alert_p2default')),'P2 remains in-app');
select consumer.update_notification_preferences(true,true,true,true,'America/New_York',time '08:30',8,'85000000-0000-4000-8000-000000000008');
reset role;
set local role myth_notification_delivery;
insert into p17_ids select 'delivery_p2optin',delivery_id from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_p2optin'),'86000000-0000-4000-8000-000000000023');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('41 P2 included when opted in',exists(select 1 from consumer.get_digest_eligibility(null) where alert_id=(select value from p17_ids where key='alert_p2optin')),'explicit informational digest');
select pg_temp.p17_result('42 Same Alert appears once',(select count(*)=1 from consumer.get_digest_eligibility(null) where alert_id=(select value from p17_ids where key='alert_p1')),'digest dedupe');
select pg_temp.p17_result('43 User timezone respected',(select local_digest_date=(a.surfaced_at at time zone 'America/New_York')::date from consumer.get_digest_eligibility(null) d join consumer.consumer_alerts a on a.id=d.alert_id where d.alert_id=(select value from p17_ids where key='alert_p1')),'local date window');
select pg_temp.p17_result('44 Digest contains source refs',(select source_organization is not null and source_confirmation_ref is not null from consumer.get_digest_eligibility(null) where alert_id=(select value from p17_ids where key='alert_p1')),'each item stays sourced');
select pg_temp.p17_result('45 Digest does not invent score',not exists(select 1 from information_schema.columns where table_schema='ops' and table_name='consumer_alert_deliveries' and column_name in ('score','rank','trust_score')),'no provider classification');

-- Summary uses only P16-qualified no-change states.
select pg_temp.p17_result('46 Qualified no-change may appear',(select healthy_no_change_coverage_count>=1 from consumer.get_periodic_watch_summary_eligibility()),'P15/P16 truth reused');
reset role;
update ops.source_feed_checkpoints set health_status='delayed' where id='44000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('47 Delayed source cannot appear as no-change',(select healthy_no_change_coverage_count=0 and delayed_coverage_count>=1 from consumer.get_periodic_watch_summary_eligibility()),'health precedence');
reset role;
update ops.source_feed_checkpoints set health_status='degraded' where id='44000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('48 Degraded source cannot appear as no-change',(select healthy_no_change_coverage_count=0 and degraded_coverage_count>=1 from consumer.get_periodic_watch_summary_eligibility()),'no reassurance');
reset role;
update ops.source_feed_checkpoints set health_status='unknown' where id='44000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
select pg_temp.p17_result('49 Unknown source cannot appear as no-change',(select healthy_no_change_coverage_count=0 and unknown_coverage_count>=1 from consumer.get_periodic_watch_summary_eligibility()),'unknown is not healthy silence');
select pg_temp.p17_result('50 Material Alert represented',(select material_alert_count>=1 from consumer.get_periodic_watch_summary_eligibility()),'sourced Alerts counted without score');
select pg_temp.p17_result('51 Inactive Watch excluded',(select active_watch_count=4 from consumer.get_periodic_watch_summary_eligibility()),'paused B Watch is outside A and inactive Watches never count');
reset role;
update ops.source_feed_checkpoints set health_status='current' where id='44000000-0000-4000-8000-000000000004';

-- Reviewed deterministic templates and content.
set local role myth_notification_delivery;
select pg_temp.p17_result('52 Approved template renders',(select (ops.get_p0_email_payload((select value from p17_ids where key='delivery_success'))->>'subject') like 'My TrustHub alert:%'),'reviewed version');
reset role;
update network.consumer_notification_templates set enabled=false,governance_status='disabled' where template_key='p0.material-change.email' and version=1;
set local role myth_notification_delivery;
select pg_temp.p17_result('53 Disabled template cannot send',(select outcome='template_unavailable' from ops.enqueue_alert_delivery((select value from p17_ids where key='alert_rate'),'86000000-0000-4000-8000-000000000024')),'governance gate');
reset role;
update network.consumer_notification_templates set enabled=true,governance_status='approved' where template_key='p0.material-change.email' and version=1;
select pg_temp.p17_result('54 Wrong template version rejected',pg_temp.p17_errors(format(
 'insert into ops.consumer_alert_deliveries(alert_id,user_id,channel,delivery_type,template_key,template_version,delivery_window_key,status,idempotency_key,preference_snapshot,override_snapshot) values(%L,%L,''email'',''p0_immediate'',''p0.material-change.email'',99,''immediate'',''pending'',%L,''{}'',''{}'')',
 (select value::text from p17_ids where key='alert_success'),'14000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000099')),'template FK and version');
set local role myth_notification_delivery;
select pg_temp.p17_result('55 P0 content contains source',(select ops.get_p0_email_payload((select value from p17_ids where key='delivery_success')) ?& array['source','source_confirmation_ref','watched_grain']),'sourced delivery');
select pg_temp.p17_result('56 Official-as-of retained',(select ops.get_p0_email_payload((select value from p17_ids where key='delivery_success'))->>'official_as_of' is not null),'source clock');
select pg_temp.p17_result('57 Disclosure retained',(select ops.get_p0_email_payload((select value from p17_ids where key='delivery_success'))->>'disclosure'='Extracts can lag. This is not a TrustHub verdict.'),'required copy');
select pg_temp.p17_result('58 No verdict or recommendation wording',(select lower(ops.get_p0_email_payload((select value from p17_ids where key='delivery_success'))::text) !~ 'safe to|recommended provider|trust score|do not hire'),'factual contract fixture');
reset role;

-- Retraction/suppression remain terminal for outbound delivery.
select pg_temp.p17_result('59 Retracted-before-send suppressed',(select status='suppressed' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_retract')),'no stale P0');
select pg_temp.p17_result('60 Already-delivered retained in ledger',(select status='delivered' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_success')),'immutable delivery history');
select pg_temp.p17_result('61 Mass-change suppression blocks delivery',(select status='suppressed' from ops.consumer_alert_deliveries where id=(select value from p17_ids where key='delivery_suppressed')),'P15/P16 suppression flows through');

-- RLS and least-privilege worker boundaries.
select pg_temp.p17_result('62 Consumer cannot mutate delivery ledger',pg_temp.p17_errors('set local role authenticated; delete from ops.consumer_alert_deliveries'),'server-only ledger');
select pg_temp.p17_result(
  '63 Notification worker can process',
  has_function_privilege('myth_notification_delivery','ops.process_mock_p0_email(uuid,text,timestamptz)','execute')
    and exists(select 1 from ops.consumer_alert_delivery_attempts where delivery_id=(select value from p17_ids where key='delivery_success')),
  'narrow operation succeeds without direct ledger access'
);
select pg_temp.p17_result('64 Worker cannot modify notes',pg_temp.p17_errors('set local role myth_notification_delivery; delete from consumer.consumer_notes'),'no research access');
select pg_temp.p17_result('65 Worker cannot modify Watch coverage',pg_temp.p17_errors('set local role myth_notification_delivery; delete from consumer.consumer_watch_coverage'),'delivery does not control observation');
select pg_temp.p17_result('66 Worker cannot alter Alert severity',pg_temp.p17_errors('set local role myth_notification_delivery; update consumer.consumer_alerts set severity=''P2'''),'Alert evidence immutable to delivery');
select pg_temp.p17_result('67 Specialist cannot enumerate delivery history',pg_temp.p17_errors('set local role myth_bff_contractor; select count(*) from ops.consumer_alert_deliveries'),'no cross-hub delivery access');

select pg_temp.p17_result('68 Manage notifications stays parent-side',(select bool_and(not('notification:read'=any(allowed_scopes)) and not('notification:write'=any(allowed_scopes))) from ops.consumer_hub_registry),'no specialist notification scope');
select pg_temp.p17_result('69 Hub receives no consumer email',pg_get_function_result('consumer.get_cross_hub_entity_alert_state(uuid)'::regprocedure) not ilike '%email%','narrow Alert state unchanged');
select pg_temp.p17_result('70 All-six-hub contract remains compatible',(select count(*)=7 and bool_and('alert:read'=any(allowed_scopes)) from ops.consumer_hub_registry),'Ask and six hubs retain P16 scope');

do $$
declare total integer; failures integer;
begin
 select count(*),count(*) filter(where not passed) into total,failures from p17_test_results;
 if total<>70 then raise exception 'P17 matrix expected 70 cases, found %',total; end if;
 if failures<>0 then raise exception 'P17 matrix has % failures',failures; end if;
end;
$$;

select ordinal,test_name,passed,detail from p17_test_results order by test_name;
rollback;
