-- P18 Saved comparisons/tools/sessions validation matrix.
-- Run only on an isolated branch after P11-P18 migrations and P14-P18 seeds.

create temporary table p18_test_results(
  ordinal integer generated always as identity,test_name text not null,passed boolean not null,detail text not null
) on commit preserve rows;
create temporary table p18_ids(key text primary key,value uuid not null) on commit preserve rows;
create temporary table p18_payloads(key text primary key,value jsonb not null) on commit preserve rows;

create or replace function pg_temp.p18_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$
  insert into p18_test_results(test_name,passed,detail) values(p_name,coalesce(p_passed,false),p_detail);
$$;
create or replace function pg_temp.p18_errors(p_sql text)
returns boolean language plpgsql as $$
begin execute p_sql; execute 'reset role'; return false;
exception when others then execute 'reset role'; return true; end;
$$;
create or replace function pg_temp.p18_oversized_guest_rejected()
returns boolean language plpgsql as $$
begin
  perform consumer.preview_guest_session_import(jsonb_build_object(
    'version','mytrusthub-guest-sessions/v1','generated_at',statement_timestamp(),
    'expires_at',statement_timestamp()+interval '1 day','items',jsonb_build_array(jsonb_build_object(
      'client_item_id','huge','item_type','saved_session','guest_session_key','huge-key','hub','move',
      'session_type','inventory','schema_key','move.inventory/v1','schema_version',1,
      'payload',jsonb_build_object('estimated_cubic_feet',100,'room_counts',repeat('x',270000)),
      'summary',jsonb_build_object('title','Huge'),'created_at',statement_timestamp()
    ))));
  return false;
exception when others then return true;
end;
$$;

grant myth_session_governor,myth_handoff_broker,myth_bff_ask,myth_bff_move,myth_bff_lender,
  myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor to postgres;
grant select,insert,update,delete on p18_ids,p18_payloads,p18_test_results to authenticated,anon,
  myth_session_governor,myth_handoff_broker,myth_bff_ask,myth_bff_move,myth_bff_lender,
  myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant usage,select on sequence p18_test_results_ordinal_seq to authenticated,anon,
  myth_session_governor,myth_handoff_broker,myth_bff_ask,myth_bff_move,myth_bff_lender,
  myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

begin;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values
('15000000-0000-4000-8000-000000000001','authenticated','authenticated','p18-a@example.test',now(),now(),now()),
('15000000-0000-4000-8000-000000000002','authenticated','authenticated','p18-b@example.test',now(),now(),now()),
('15000000-0000-4000-8000-000000000003','authenticated','authenticated','p18-business@example.test',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
insert into consumer.consumer_profiles(user_id) values('15000000-0000-4000-8000-000000000001');
insert into p18_ids select 'project_a',consumer.create_project(
  '95000000-0000-4000-8000-000000000001','P18 Home','buying_home','{"zip":"33432"}',null);
insert into p18_ids select 'project_b',consumer.create_project(
  '95000000-0000-4000-8000-000000000002','P18 Protecting','protecting','{"zip":"33432"}',null);
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
insert into consumer.consumer_profiles(user_id) values('15000000-0000-4000-8000-000000000002');
insert into p18_ids select 'project_other',consumer.create_project(
  '95000000-0000-4000-8000-000000000003','P18 Other','blank',null,null);
reset role;

-- Registry governance.
select pg_temp.p18_result('1 Approved schema accepted',exists(
  select 1 from network.consumer_session_schemas where schema_key='lender.piti/v1' and version=1 and status='approved'
),'parent-approved contract exists');
select pg_temp.p18_result('2 Draft rejected',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('move','plan','move.route-plan/v1',1,'{"origin_zip":"10001","destination_zip":"33432"}','{"title":"Route"}',null,'96000000-0000-4000-8000-000000000001',null)
$q$),'draft is not creatable');
select pg_temp.p18_result('4 Wrong hub rejected',pg_temp.p18_errors($q$
  set local role myth_bff_move; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('lender','calculator','lender.piti/v1',1,'{"home_price":500000,"down_payment":100000}','{"title":"PITI"}',null,'96000000-0000-4000-8000-000000000002',null)
$q$),'service hub scope enforced');
select pg_temp.p18_result('5 Unsupported version rejected',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('lender','calculator','lender.piti/v9',9,'{"home_price":500000,"down_payment":100000}','{"title":"PITI"}',null,'96000000-0000-4000-8000-000000000003',null)
$q$),'unknown schema/version denied');
select pg_temp.p18_result('6 Specialist cannot self-approve schema',pg_temp.p18_errors($q$
  set local role myth_bff_move; select network.set_consumer_session_schema_status('move.route-plan/v1',1,'approved')
$q$),'governor-only approval');
select pg_temp.p18_result('7 Browser cannot mutate registry',pg_temp.p18_errors($q$
  set local role authenticated; update network.consumer_session_schemas set status='approved' where schema_key='move.route-plan/v1'
$q$),'no browser registry mutation');

-- Save valid sessions through specialist and parent operations.
set local role myth_bff_lender;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
insert into p18_ids select 'piti',saved_session_id from consumer.save_session(
  'lender','calculator','lender.piti/v1',1,
  '{"home_price":500000,"down_payment":100000,"interest_rate":6.25,"term_years":30,"tax_monthly":650,"insurance_monthly":310}',
  '{"title":"PITI calculator","primary_value":2847,"unit":"USD/month"}',null,
  '96000000-0000-4000-8000-000000000010',null);
insert into p18_ids select 'piti_migrate',saved_session_id from consumer.save_session(
  'lender','calculator','lender.piti/v1',1,'{"home_price":450000,"down_payment":90000}',
  '{"title":"PITI migration fixture","primary_value":2500,"unit":"USD/month"}',null,
  '96000000-0000-4000-8000-000000000011',null);
insert into p18_ids select 'legacy',saved_session_id from consumer.save_session(
  'lender','worksheet','lender.legacy-budget/v1',1,'{"scenario_total":12000}',
  '{"title":"Legacy worksheet","primary_value":12000,"unit":"USD"}',null,
  '96000000-0000-4000-8000-000000000012',null);
reset role;
insert into p18_ids select 'piti_resume',resume_ref from consumer.consumer_saved_sessions
where id=(select value from p18_ids where key='piti');

select pg_temp.p18_result('8 Consumer or hub BFF saves valid session',exists(
  select 1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti') and hub='lender'
),'canonical parent envelope created');
set local role myth_bff_lender;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.save_session('lender','calculator','lender.piti/v1',1,
  '{"home_price":500000,"down_payment":100000,"interest_rate":6.25,"term_years":30,"tax_monthly":650,"insurance_monthly":310}',
  '{"title":"PITI calculator","primary_value":2847,"unit":"USD/month"}',null,
  '96000000-0000-4000-8000-000000000010',null);
reset role;
select pg_temp.p18_result('9 Duplicate idempotency key stable',(select count(*)=1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'same durable session');
select pg_temp.p18_result('10 Another consumer denied',pg_temp.p18_errors(format($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
  select consumer.update_saved_session(%L,'lender.piti/v1',1,'{"home_price":1,"down_payment":1}','{"title":"No"}',1,'96000000-0000-4000-8000-000000000013')
$q$,(select value::text from p18_ids where key='piti'))),'ownership enforced');
select pg_temp.p18_result('11 Anonymous denied',pg_temp.p18_errors(format($q$
  set local role anon; select consumer.get_saved_session_for_resume(%L)
$q$,(select resume_ref::text from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')))),'authentication required');
select pg_temp.p18_result('12 Business-only denied',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000003',true);
  select consumer.save_session('lender','calculator','lender.piti/v1',1,'{"home_price":1,"down_payment":1}','{"title":"No"}',null,'96000000-0000-4000-8000-000000000014',null)
$q$),'consumer profile required');
select pg_temp.p18_result('13 Wrong hub service denied',pg_temp.p18_errors(format($q$
  set local role myth_bff_move; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.get_saved_session_for_resume(%L)
$q$,(select resume_ref::text from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')))),'Move cannot act as Lender');
select pg_temp.p18_result('14 Oversize payload rejected',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('lender','calculator','lender.piti/v1',1,jsonb_build_object('home_price',1,'down_payment',1,'interest_rate',repeat('x',70000)),'{"title":"Huge"}',null,'96000000-0000-4000-8000-000000000015',null)
$q$),'per-schema byte limit');
select pg_temp.p18_result('15 Invalid payload rejected',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('lender','calculator','lender.piti/v1',1,'{"home_price":1,"down_payment":1,"unexpected":true}','{"title":"Invalid"}',null,'96000000-0000-4000-8000-000000000016',null)
$q$),'positive schema allowlist');
select pg_temp.p18_result('16 Secret or token field rejected',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('lender','calculator','lender.piti/v1',1,'{"home_price":{"access_token":"secret"},"down_payment":1}','{"title":"Invalid"}',null,'96000000-0000-4000-8000-000000000017',null)
$q$),'recursive prohibited-key screening');
select pg_temp.p18_result('17 Safe summary stored',(select summary->>'primary_value'='2847' and octet_length(summary::text)<2048 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'scalar allowlisted summary');
select pg_temp.p18_result('18 No Watch created',not exists(select 1 from consumer.consumer_watches where user_id='15000000-0000-4000-8000-000000000001'),'session persistence has no Watch side effect');
select pg_temp.p18_result('19 No Alert created',not exists(select 1 from consumer.consumer_alerts where user_id='15000000-0000-4000-8000-000000000001'),'session persistence has no Alert side effect');
select pg_temp.p18_result('20 No ranking change',not exists(select 1 from information_schema.columns where table_schema='consumer' and table_name='consumer_saved_sessions' and column_name in ('rank','ranking','score','trust_score')),'no public/ranking semantics');

-- Project membership is many-to-many and independent.
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.add_saved_session_to_project((select value from p18_ids where key='project_a'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000021');
reset role;
select pg_temp.p18_result('21 Session added to Project',exists(select 1 from consumer.consumer_project_saved_sessions where project_id=(select value from p18_ids where key='project_a') and saved_session_id=(select value from p18_ids where key='piti') and removed_at is null),'membership created');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.add_saved_session_to_project((select value from p18_ids where key='project_a'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000021');
reset role;
select pg_temp.p18_result('22 Repeated add idempotent',(select count(*)=1 from consumer.consumer_project_saved_sessions where project_id=(select value from p18_ids where key='project_a') and saved_session_id=(select value from p18_ids where key='piti')),'one membership row');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.add_saved_session_to_project((select value from p18_ids where key='project_b'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000022');
reset role;
select pg_temp.p18_result('23 One session in two Projects',(select count(*)=2 from consumer.consumer_project_saved_sessions where saved_session_id=(select value from p18_ids where key='piti') and removed_at is null),'one payload and two joins');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.remove_saved_session_from_project((select value from p18_ids where key='project_a'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000023');
reset role;
select pg_temp.p18_result('24 Remove one preserves other',(select count(*)=1 from consumer.consumer_project_saved_sessions where saved_session_id=(select value from p18_ids where key='piti') and removed_at is null),'Project B retained');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.remove_saved_session_from_project((select value from p18_ids where key='project_b'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000024');
reset role;
select pg_temp.p18_result('25 No Project leaves Unfiled',not exists(select 1 from consumer.consumer_project_saved_sessions where saved_session_id=(select value from p18_ids where key='piti') and removed_at is null),'Saved session remains');
select pg_temp.p18_result('26 Cross-user assignment denied',pg_temp.p18_errors(format($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
  select consumer.add_saved_session_to_project(%L,%L,'96000000-0000-4000-8000-000000000025')
$q$,(select value::text from p18_ids where key='project_other'),(select value::text from p18_ids where key='piti'))),'both parents must share owner');

-- Updates, concurrency, and version boundaries.
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.update_saved_session((select value from p18_ids where key='piti'),'lender.piti/v1',1,
  '{"home_price":500000,"down_payment":100000,"interest_rate":6.1,"term_years":30,"tax_monthly":650,"insurance_monthly":310}',
  '{"title":"PITI calculator","primary_value":2800,"unit":"USD/month"}',1,'96000000-0000-4000-8000-000000000028');
reset role;
select pg_temp.p18_result('28 Owner updates session',(select row_version=2 and summary->>'primary_value'='2800' from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'optimistic update');
select pg_temp.p18_result('29 Stale row version rejected',pg_temp.p18_errors(format($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.update_saved_session(%L,'lender.piti/v1',1,'{"home_price":1,"down_payment":1}','{"title":"Stale"}',1,'96000000-0000-4000-8000-000000000029')
$q$,(select value::text from p18_ids where key='piti'))),'newer state protected');
select pg_temp.p18_result('30 Wrong schema update rejected',pg_temp.p18_errors(format($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.update_saved_session(%L,'lender.piti/v2',2,'{"home_price":1,"down_payment":1}','{"title":"Wrong path"}',2,'96000000-0000-4000-8000-000000000030')
$q$,(select value::text from p18_ids where key='piti'))),'migration adapter path required');
select pg_temp.p18_result('31 Wrong hub update denied',pg_temp.p18_errors(format($q$
  set local role myth_bff_move; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.update_saved_session(%L,'lender.piti/v1',1,'{"home_price":1,"down_payment":1}','{"title":"Wrong hub"}',2,'96000000-0000-4000-8000-000000000031')
$q$,(select value::text from p18_ids where key='piti'))),'hub isolation');
set local role myth_bff_lender;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.mark_saved_session_resumed((select value from p18_ids where key='piti'),2,'96000000-0000-4000-8000-000000000032');
reset role;
select pg_temp.p18_result('32 Last resumed timestamp updates',(select last_resumed_at is not null and row_version=3 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'meaningful resume activity');

select pg_temp.p18_result('33 V1 session preserved',(select schema_key='lender.piti/v1' and schema_version=1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'stored meaning stable');
select pg_temp.p18_result('34 V2 does not silently replace V1',(select count(*)=1 from network.consumer_session_schemas where schema_key='lender.piti/v2' and version=2) and (select schema_version=1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'upgrade is explicit');
select pg_temp.p18_result('35 Specialist adapter migration contract represented',exists(
  select 1 from network.consumer_session_schema_migrations m join network.consumer_session_schemas f on f.id=m.from_schema_id join network.consumer_session_schemas t on t.id=m.to_schema_id
  where f.schema_key='lender.piti/v1' and t.schema_key='lender.piti/v2' and m.status='approved'
),'hub adapter reviewed by parent');
set local role myth_bff_lender;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.apply_saved_session_schema_migration((select value from p18_ids where key='piti_migrate'),'lender.piti/v2',2,
  '{"home_price":450000,"down_payment":90000,"hoa_monthly":0}',
  '{"title":"PITI migration fixture","primary_value":2500,"unit":"USD/month"}',1,'96000000-0000-4000-8000-000000000035');
reset role;
set local role myth_session_governor;
select network.set_consumer_session_schema_status('lender.legacy-budget/v1',1,'retired');
reset role;
select pg_temp.p18_result('3 Retired cannot create new session',pg_temp.p18_errors($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
  select consumer.save_session('lender','worksheet','lender.legacy-budget/v1',1,'{"scenario_total":1}','{"title":"Retired"}',null,'96000000-0000-4000-8000-000000000036',null)
$q$),'retired registry blocks creation');
select pg_temp.p18_result('36 Retired without adapter becomes read-only',(select status='read_only' from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='legacy')),'old research retained');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('37 Read-only session remains exportable',exists(select 1 from consumer.list_saved_session_summaries(100) where saved_session_id=(select value from p18_ids where key='legacy') and status='read_only'),'summary remains available for future export');
reset role;

-- Resume is opaque, audience-bound, and one-session scoped.
set local role myth_bff_lender;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('38 Authorized specialist retrieves own session',exists(select 1 from consumer.get_saved_session_for_resume((select value from p18_ids where key='piti_resume')) where hub='lender' and payload ? 'home_price'),'exact authorized payload');
reset role;
select pg_temp.p18_result('39 Move cannot read Lender',pg_temp.p18_errors(format($q$
  set local role myth_bff_move; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true); select consumer.get_saved_session_for_resume(%L)
$q$,(select resume_ref::text from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')))),'hub payload isolation');
select pg_temp.p18_result('40 Resume ref safe',exists(select 1 from network.consumer_session_schemas where schema_key='lender.piti/v1' and resume_route_key='/my-lending' and resume_route_key ~ '^/[a-z0-9/_-]+$'),'registered relative route');
select pg_temp.p18_result('41 Arbitrary URL rejected',pg_temp.p18_errors(format($q$
  set local role myth_handoff_broker; select ops.create_session_resume_handoff('p18-unsafe-code-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','15000000-0000-4000-8000-000000000001',%L,'lender','javascript:alert(1)','p18-state-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','p18-nonce-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
$q$,(select value::text from p18_ids where key='piti'))),'P13 allowlisted relative route');
set local role myth_handoff_broker;
insert into p18_ids select 'resume_handoff',ops.create_session_resume_handoff(
  'p18-valid-code-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','15000000-0000-4000-8000-000000000001',
  (select value from p18_ids where key='piti'),'lender','/my-lending',
  'p18-state-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','p18-nonce-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
reset role;
select pg_temp.p18_result('42 Payload absent from browser URL',(select code_hash=encode(digest('p18-valid-code-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','sha256'),'hex') and not exists(
  select 1 from information_schema.columns where table_schema='ops' and table_name='consumer_session_resume_handoffs' and column_name='payload'
) from ops.consumer_session_resume_handoffs where id=(select value from p18_ids where key='resume_handoff')),'URL carries opaque code only');
set local role myth_bff_lender;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
insert into p18_ids select 'consumed_resume_ref',resume_ref from ops.consume_session_resume_handoff(
  'p18-valid-code-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','15000000-0000-4000-8000-000000000001','lender',
  'p18-state-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','p18-nonce-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') where ok;
reset role;
select pg_temp.p18_result('43 Project context handoff works',(select target_hub='lender' and status='consumed' from ops.consumer_session_resume_handoffs where id=(select value from p18_ids where key='resume_handoff')),'session context survives server-side round trip');

-- Guest-session import is separate, explicit, bounded, and idempotent.
insert into p18_payloads values('guest-main',jsonb_build_object(
  'version','mytrusthub-guest-sessions/v1','generated_at',statement_timestamp(),'expires_at',statement_timestamp()+interval '30 days',
  'items',jsonb_build_array(
    jsonb_build_object('client_item_id','guest-valid','item_type','saved_session','guest_session_key','guest-session-1','hub','move','session_type','inventory','schema_key','move.inventory/v1','schema_version',1,'payload',jsonb_build_object('room_counts',jsonb_build_object('bedroom',2),'estimated_cubic_feet',1420),'summary',jsonb_build_object('title','Move inventory','primary_value',1420,'unit','cu ft'),'created_at',statement_timestamp()),
    jsonb_build_object('client_item_id','guest-deselected','item_type','saved_session','guest_session_key','guest-session-2','hub','move','session_type','comparison','schema_key','move.comparison/v1','schema_version',1,'payload',jsonb_build_object('mover_refs',jsonb_build_array('demo-a','demo-b'),'origin_zip','10001','destination_zip','33432'),'summary',jsonb_build_object('title','Move comparison','item_count',2),'created_at',statement_timestamp())
  )));
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('44 Guest preview no mutation',not exists(select id from consumer.consumer_guest_session_imports) and (select count(*)=2 from consumer.preview_guest_session_import((select value from p18_payloads where key='guest-main'))),'preview returns two without receipt or session mutation');
insert into p18_ids select 'guest_import',import_id from consumer.commit_guest_session_import((select value from p18_payloads where key='guest-main'),array['guest-valid'],null,'97000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.p18_result('45 Valid guest session import',exists(select 1 from consumer.consumer_saved_sessions where guest_origin_key='guest-session-1'),'selected session imported');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.commit_guest_session_import((select value from p18_payloads where key='guest-main'),array['guest-valid'],null,'97000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.p18_result('46 Duplicate import idempotent',(select count(*)=1 from consumer.consumer_saved_sessions where user_id='15000000-0000-4000-8000-000000000001' and guest_origin_key='guest-session-1'),'receipt replay stable');
insert into p18_payloads values('guest-unsupported',jsonb_build_object('version','mytrusthub-guest-sessions/v1','generated_at',statement_timestamp(),'expires_at',statement_timestamp()+interval '1 day','items',jsonb_build_array(
  jsonb_build_object('client_item_id','unsupported','item_type','saved_session','guest_session_key','guest-unsupported','hub','move','session_type','inventory','schema_key','move.inventory/v9','schema_version',9,'payload',jsonb_build_object('estimated_cubic_feet',1),'summary',jsonb_build_object('title','Unsupported'),'created_at',statement_timestamp())
)));
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('47 Unsupported version rejected',(select item_status='unsupported_version' and not importable from consumer.preview_guest_session_import((select value from p18_payloads where key='guest-unsupported'))),'no invented migration');
select pg_temp.p18_result('48 Oversized guest payload rejected',pg_temp.p18_oversized_guest_rejected(),'256 KiB total boundary');
reset role;
select pg_temp.p18_result('49 Deselected item not imported',not exists(select 1 from consumer.consumer_saved_sessions where guest_origin_key='guest-session-2'),'explicit selection only');
select pg_temp.p18_result('50 Unfiled default',not exists(select 1 from consumer.consumer_project_saved_sessions m join consumer.consumer_saved_sessions s on s.id=m.saved_session_id where s.guest_origin_key='guest-session-1' and m.removed_at is null),'no automatic Project');

insert into p18_payloads values('guest-project',jsonb_build_object('version','mytrusthub-guest-sessions/v1','generated_at',statement_timestamp(),'expires_at',statement_timestamp()+interval '1 day','items',jsonb_build_array(
  jsonb_build_object('client_item_id','guest-project','item_type','saved_session','guest_session_key','guest-session-3','hub','move','session_type','comparison','schema_key','move.comparison/v1','schema_version',1,'payload',jsonb_build_object('mover_refs',jsonb_build_array('demo-a','demo-b')),'summary',jsonb_build_object('title','Move comparison','item_count',2),'created_at',statement_timestamp())
)));
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.commit_guest_session_import((select value from p18_payloads where key='guest-project'),array['guest-project'],(select value from p18_ids where key='project_a'),'97000000-0000-4000-8000-000000000002');
reset role;
select pg_temp.p18_result('51 Project assignment explicit',exists(select 1 from consumer.consumer_project_saved_sessions m join consumer.consumer_saved_sessions s on s.id=m.saved_session_id where s.guest_origin_key='guest-session-3' and m.project_id=(select value from p18_ids where key='project_a') and m.removed_at is null),'consented assignment');
select pg_temp.p18_result('52 Guest import creates no Watch',not exists(select 1 from consumer.consumer_watches where user_id='15000000-0000-4000-8000-000000000001'),'guest session is not monitoring');
select pg_temp.p18_result('53 Guest import creates no Alert',not exists(select 1 from consumer.consumer_alerts where user_id='15000000-0000-4000-8000-000000000001'),'guest session is not an Alert');

-- Privacy, RLS, and specialist least privilege.
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('54 A reads own session',exists(select 1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'owner-visible metadata');
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000002',true);
select pg_temp.p18_result('55 A session hidden from B',not exists(select 1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'RLS owner isolation');
reset role;
select pg_temp.p18_result('56 Anonymous denied',pg_temp.p18_errors('set local role anon; select id from consumer.consumer_saved_sessions'),'no anonymous research access');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000003',true);
select pg_temp.p18_result('57 Business-only denied',not exists(select 1 from consumer.consumer_saved_sessions),'business metadata grants nothing');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"business_role":"owner"}}',true);
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('58 Dual-role own only',exists(select 1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')) and not exists(select 1 from consumer.consumer_saved_sessions where user_id<>'15000000-0000-4000-8000-000000000001'),'canonical consumer ownership');
reset role;
select pg_temp.p18_result('59 Specialist cannot enumerate unrelated sessions',pg_temp.p18_errors('set local role myth_bff_move; select consumer.list_saved_session_summaries(100)'),'one-session operations only');
select pg_temp.p18_result('60 Specialist cannot read private notes',pg_temp.p18_errors('set local role myth_bff_lender; select id from consumer.consumer_notes'),'notes remain parent-only');
select pg_temp.p18_result('61 Specialist cannot read notification delivery',pg_temp.p18_errors('set local role myth_bff_lender; select id from ops.consumer_alert_deliveries'),'delivery remains private');
select pg_temp.p18_result('62 No sensitive fixture data persisted',not exists(select 1 from consumer.consumer_saved_sessions where payload::text ~* '(ssn|access_token|refresh_token|password|bank_account|account_number|credit_card|diagnosis|medical_record|brokerage_credentials|trading_authorization)'),'safe deterministic fixtures');

-- Session and Project lifecycle remain independent.
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.add_saved_session_to_project((select value from p18_ids where key='project_a'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000063');
select consumer.add_saved_session_to_project((select value from p18_ids where key='project_b'),(select value from p18_ids where key='piti'),'96000000-0000-4000-8000-000000000064');
select consumer.archive_saved_session((select value from p18_ids where key='piti'),3,'96000000-0000-4000-8000-000000000065');
reset role;
select pg_temp.p18_result('63 Archive session',(select status='archived' and archived_at is not null from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'removed from active Continue');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.restore_saved_session((select value from p18_ids where key='piti'),4,'96000000-0000-4000-8000-000000000066');
reset role;
select pg_temp.p18_result('64 Restore session',(select status='active' and archived_at is null from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'resumable again');
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select consumer.archive_project((select value from p18_ids where key='project_a'),(select row_version from consumer.consumer_projects where id=(select value from p18_ids where key='project_a')));
reset role;
select pg_temp.p18_result('27 Project archive preserves session',exists(select 1 from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'Project lifecycle is independent');
select pg_temp.p18_result('65 Project archive leaves session intact',(select status='active' from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='piti')),'session remains Saved');
select pg_temp.p18_result('66 Remove attached session requires safe handling',pg_temp.p18_errors(format($q$
  set local role authenticated; select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true); select consumer.remove_saved_session(%L,5,'96000000-0000-4000-8000-000000000067')
$q$,(select value::text from p18_ids where key='piti'))),'Project evidence cannot be silently orphaned');
select pg_temp.p18_result('67 Read-only legacy preserved',(select status='read_only' and payload is not null from consumer.consumer_saved_sessions where id=(select value from p18_ids where key='legacy')),'not discarded');
insert into p18_ids select 'guest_unfiled',id from consumer.consumer_saved_sessions
where guest_origin_key='guest-session-1';

-- Bounded parent read models.
set local role authenticated;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
select pg_temp.p18_result('68 Continue returns recent active session',exists(select 1 from consumer.list_continue_sessions(10) where saved_session_id=(select value from p18_ids where key='piti')),'activity ordering without ranking');
select pg_temp.p18_result('69 Saved Research returns summary only',pg_get_function_result('consumer.list_saved_session_summaries(integer)'::regprocedure) not ilike '%payload%','raw payload excluded');
select pg_temp.p18_result('70 Multi-Project summary correct',(select jsonb_array_length(project_memberships)=2 from consumer.list_saved_session_summaries(100) where saved_session_id=(select value from p18_ids where key='piti')),'two memberships one session');
select pg_temp.p18_result('71 Unfiled session represented',(select jsonb_array_length(project_memberships)=0 from consumer.list_saved_session_summaries(100) where saved_session_id=(select value from p18_ids where key='guest_unfiled')),'unfiled is valid');
select pg_temp.p18_result('72 Retired session not shown as resumable',(select not resume_available from consumer.list_saved_session_summaries(100) where saved_session_id=(select value from p18_ids where key='legacy')),'visible but read-only');
reset role;

do $$
declare total integer; failures integer;
begin
  select count(*),count(*) filter(where not passed) into total,failures from p18_test_results;
  if total<>72 then raise exception 'P18 matrix expected 72 cases, found %',total; end if;
  if failures<>0 then raise exception 'P18 matrix has % failures',failures; end if;
end;
$$;

select ordinal,test_name,passed,detail from p18_test_results order by test_name;
rollback;
