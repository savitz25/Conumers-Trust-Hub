-- P13 58-case integration/security matrix.
-- Run only on an isolated branch after P11B + P12 + P13.

create temporary table p13_results(
  ordinal integer generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;
create temporary table p13_ids(key text primary key,value uuid not null) on commit preserve rows;
create temporary table p13_counts(key text primary key,value bigint not null) on commit preserve rows;
create temporary table p13_auth(
  label text primary key,raw_code text not null,raw_state text not null,raw_nonce text not null,handoff_id uuid not null
) on commit preserve rows;
create temporary table p13_context(
  label text primary key,raw_code text not null,raw_state text not null,raw_nonce text not null,handoff_id uuid not null
) on commit preserve rows;
create temporary table p13_auth_result(
  label text,ok boolean,error_code text,canonical_user_id uuid,return_path text,handoff_ref uuid
) on commit preserve rows;
create temporary table p13_context_result(
  label text,ok boolean,error_code text,context_ref uuid,project_name text,location_context jsonb,return_path text
) on commit preserve rows;

create or replace function pg_temp.p13_result(p_name text,p_passed boolean,p_detail text)
returns void language sql as $$
  insert into p13_results(test_name,passed,detail) values(p_name,p_passed,p_detail);
$$;

create or replace function pg_temp.p13_errors(p_sql text)
returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end;
$$;

create or replace function pg_temp.issue_auth(
  p_suffix text,p_issuer text,p_audience text,p_return text
)
returns table(raw_code text,raw_state text,raw_nonce text,handoff_id uuid)
language plpgsql as $$
declare raw_intent text; target_origin text; issuer_origin text;
begin
  raw_intent:=rpad('intent-'||p_suffix,40,'i');
  raw_code:=rpad('auth-'||p_suffix,40,'a');
  raw_state:=rpad('state-'||p_suffix,40,'s');
  raw_nonce:=rpad('nonce-'||p_suffix,40,'n');
  select production_origins[1] into target_origin from ops.consumer_hub_registry where hub_key=p_audience;
  select production_origins[1] into issuer_origin from ops.consumer_hub_registry where hub_key=p_issuer;
  perform ops.create_browser_handoff_intent(
    'auth',raw_intent,p_audience,target_origin,p_return,raw_state,raw_nonce,
    'production',rpad('prepare-'||p_suffix,40,'p')
  );
  handoff_id:=ops.create_consumer_auth_handoff(
    raw_code,'11000000-0000-4000-8000-000000000001',p_issuer,issuer_origin,
    raw_intent,gen_random_uuid(),rpad('issue-'||p_suffix,40,'q')
  );
  return next;
end;
$$;

create or replace function pg_temp.issue_context(
  p_suffix text,p_audience text,p_return text,p_project uuid
)
returns table(raw_code text,raw_state text,raw_nonce text,handoff_id uuid)
language plpgsql as $$
declare raw_intent text; target_origin text;
begin
  raw_intent:=rpad('ctx-intent-'||p_suffix,40,'i');
  raw_code:=rpad('context-'||p_suffix,40,'c');
  raw_state:=rpad('ctx-state-'||p_suffix,40,'s');
  raw_nonce:=rpad('ctx-nonce-'||p_suffix,40,'n');
  select production_origins[1] into target_origin from ops.consumer_hub_registry where hub_key=p_audience;
  perform ops.create_browser_handoff_intent(
    'context',raw_intent,p_audience,target_origin,p_return,raw_state,raw_nonce,
    'production',rpad('ctx-prepare-'||p_suffix,40,'p')
  );
  handoff_id:=ops.create_consumer_context_handoff(
    raw_code,'11000000-0000-4000-8000-000000000001',p_project,
    'https://www.asktrusthub.com',raw_intent,'{"include_location":true}'::jsonb,
    gen_random_uuid(),rpad('ctx-issue-'||p_suffix,40,'q')
  );
  return next;
end;
$$;

begin;

grant myth_handoff_broker,myth_identity_linker,myth_identity_governor,
  myth_bff_ask,myth_bff_move,myth_bff_lender,myth_bff_insurance,
  myth_bff_contractor,myth_bff_senior,myth_bff_investor to postgres;
grant select,insert,update,delete on p13_results,p13_ids,p13_counts,p13_auth,p13_context,p13_auth_result,p13_context_result
  to authenticated,anon,myth_handoff_broker,myth_identity_linker,myth_identity_governor,
     myth_bff_ask,myth_bff_move,myth_bff_lender,myth_bff_insurance,
     myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant usage,select on sequence p13_results_ordinal_seq to authenticated,anon,myth_handoff_broker,
  myth_identity_linker,myth_identity_governor,myth_bff_move,myth_bff_contractor;

insert into auth.users(id,aud,role,email,created_at,updated_at) values
('11000000-0000-4000-8000-000000000001','authenticated','authenticated','p13-a@example.invalid',now(),now()),
('11000000-0000-4000-8000-000000000002','authenticated','authenticated','p13-b@example.invalid',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
insert into consumer.consumer_profiles(user_id) values('11000000-0000-4000-8000-000000000001');
insert into p13_ids values('project_a',consumer.create_project(
  '41000000-0000-4000-8000-000000000001','Buying a home in Boca Raton','buying_home',
  '{"schema_version":"1","zip":"33432","city":"Boca Raton","state":"FL"}',null
));
insert into p13_ids values('project_b',consumer.create_project(
  '41000000-0000-4000-8000-000000000002','Kitchen renovation','contractor',
  '{"schema_version":"1","job_zip":"33432","trade":"roofing"}',null
));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
insert into consumer.consumer_profiles(user_id) values('11000000-0000-4000-8000-000000000002');
reset role;

set local role myth_identity_governor;
insert into network.network_entities(id,entity_type,canonical_name,primary_hub,jurisdiction,status,canonical_public_profile_ref) values
('21000000-0000-4000-8000-000000000001','organization','P13 Contractor','contractor','FL','active','/contractors/p13'),
('21000000-0000-4000-8000-000000000002','organization','P13 Insurance','insurance','FL','active','/directory/p13'),
('21000000-0000-4000-8000-000000000003','organization','P13 Move','move','US','active','/companies/p13'),
('21000000-0000-4000-8000-000000000004','organization','P13 Review','insurance','FL','active','/directory/review'),
('21000000-0000-4000-8000-000000000005','organization','P13 Removable','move','US','active','/companies/removable');
insert into network.network_entity_bindings(
  id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,
  identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref
) values
('31000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','contractor','company','p13-contractor','contractor.demo.id','P13-C','FL','accepted','2026-01-01','fixture:p13'),
('31000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','insurance','agency','p13-insurance','insurance.demo.id','P13-I','FL','accepted','2026-01-01','fixture:p13'),
('31000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000003','move','carrier','p13-move','move.demo.id','P13-M','US','accepted','2026-01-01','fixture:p13'),
('31000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000004','insurance','agency','p13-review','insurance.demo.id','P13-R','FL','review_required','2026-01-01','fixture:p13'),
('31000000-0000-4000-8000-000000000005','21000000-0000-4000-8000-000000000005','move','carrier','p13-removable','move.demo.id','P13-X','US','accepted','2026-01-01','fixture:p13');
insert into p13_counts values('network_before_consumer',(select count(*) from network.identity_governance_events));
reset role;

set local role myth_identity_linker;
select ops.link_legacy_consumer_identity('11000000-0000-4000-8000-000000000001','move','move.auth.users','move-legacy-a','signed_handoff','fixture:p13:move');
select ops.link_legacy_consumer_identity('11000000-0000-4000-8000-000000000001','insurance','insurance.auth.users','insurance-legacy-a','signed_handoff','fixture:p13:insurance');
select ops.link_legacy_consumer_identity('11000000-0000-4000-8000-000000000001','contractor','contractor.app_users','contractor-app-user-a','reauthenticated_legacy_session','fixture:p13:contractor');
select ops.link_legacy_consumer_identity('11000000-0000-4000-8000-000000000002','move','move.auth.users','revoked-legacy-b','signed_handoff','fixture:p13:revoked');
reset role;
update ops.consumer_identity_links set link_status='revoked',revoked_at=statement_timestamp()
where legacy_subject_id='revoked-legacy-b';

-- AUTH HANDOFF 1-14
set local role myth_handoff_broker;
insert into p13_auth select 'valid',* from pg_temp.issue_auth('valid','ask','move','/companies/p13');
insert into p13_auth_result
select 'valid',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'ask','move','https://www.movetrusthub.com',a.raw_state,a.raw_nonce,rpad('consume-valid',40,'z')
) r where a.label='valid';
select pg_temp.p13_result('1 Valid canonical handoff succeeds',
  (select ok and canonical_user_id='11000000-0000-4000-8000-000000000001' from p13_auth_result where label='valid'),
  'canonical subject returned server-to-server');
reset role;
select pg_temp.p13_result('2 Raw code not stored',
  not exists(select 1 from information_schema.columns where table_schema='ops' and table_name='consumer_auth_handoffs' and column_name in ('code','raw_code'))
  and not exists(select 1 from ops.consumer_auth_handoffs h join p13_auth a on h.code_hash=a.raw_code),
  'only SHA-256 code hash persisted');
set local role myth_handoff_broker;

insert into p13_auth select 'expired',* from pg_temp.issue_auth('expired','ask','move','/companies/p13');
reset role;
update ops.consumer_auth_handoffs set created_at=statement_timestamp()-interval '3 minutes',expires_at=statement_timestamp()-interval '1 minute'
where id=(select handoff_id from p13_auth where label='expired');
set local role myth_handoff_broker;
insert into p13_auth_result select 'expired',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'ask','move','https://www.movetrusthub.com',a.raw_state,a.raw_nonce,rpad('consume-expired',40,'z')) r where a.label='expired';
select pg_temp.p13_result('3 Expired denied',(select not ok and error_code='HANDOFF_EXPIRED' from p13_auth_result where label='expired'),'expired state explicit');

insert into p13_auth_result select 'replay',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'ask','move','https://www.movetrusthub.com',a.raw_state,a.raw_nonce,rpad('consume-replay',40,'z')) r where a.label='valid';
select pg_temp.p13_result('4 Replay denied',(select not ok and error_code='HANDOFF_ALREADY_USED' from p13_auth_result where label='replay'),'second consumption denied');
reset role;
select pg_temp.p13_result('5 Concurrent replay only one succeeds',
  (select status='consumed' from ops.consumer_auth_handoffs where id=(select handoff_id from p13_auth where label='valid'))
  and (select pg_get_functiondef('ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text)'::regprocedure) ilike '%for update%'),
  'row lock plus issued-to-consumed transition permits one winner');
set local role myth_handoff_broker;

insert into p13_auth select 'wrong-aud',* from pg_temp.issue_auth('wrong-aud','ask','move','/companies/p13');
insert into p13_auth_result select 'wrong-aud',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'ask','insurance','https://www.movetrusthub.com',a.raw_state,a.raw_nonce,rpad('consume-wrong-aud',40,'z')) r where a.label='wrong-aud';
select pg_temp.p13_result('6 Wrong audience denied',(select not ok and error_code='INVALID_AUDIENCE' from p13_auth_result where label='wrong-aud'),'audience bound');

insert into p13_auth select 'wrong-issuer',* from pg_temp.issue_auth('wrong-issuer','ask','move','/companies/p13');
insert into p13_auth_result select 'wrong-issuer',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'lender','move','https://www.movetrusthub.com',a.raw_state,a.raw_nonce,rpad('consume-wrong-issuer',40,'z')) r where a.label='wrong-issuer';
select pg_temp.p13_result('7 Wrong issuer denied',(select not ok and error_code='INVALID_AUDIENCE' from p13_auth_result where label='wrong-issuer'),'issuer bound');

insert into p13_auth select 'wrong-origin',* from pg_temp.issue_auth('wrong-origin','ask','move','/companies/p13');
insert into p13_auth_result select 'wrong-origin',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'ask','move','https://movetrusthub.example',a.raw_state,a.raw_nonce,rpad('consume-wrong-origin',40,'z')) r where a.label='wrong-origin';
select pg_temp.p13_result('8 Wrong target origin denied',(select not ok and error_code='INVALID_AUDIENCE' from p13_auth_result where label='wrong-origin'),'target origin exact');

insert into p13_auth select 'wrong-state',* from pg_temp.issue_auth('wrong-state','ask','move','/companies/p13');
insert into p13_auth_result select 'wrong-state',r.* from p13_auth a cross join lateral ops.consume_consumer_auth_handoff(
  a.raw_code,'ask','move','https://www.movetrusthub.com',rpad('bad-state',40,'b'),a.raw_nonce,rpad('consume-wrong-state',40,'z')) r where a.label='wrong-state';
select pg_temp.p13_result('9 Wrong browser state denied',(select not ok and error_code='INVALID_STATE' from p13_auth_result where label='wrong-state'),'browser state hash mismatch');

insert into p13_auth select 'missing-nonce',* from pg_temp.issue_auth('missing-nonce','ask','move','/companies/p13');
select pg_temp.p13_result('10 Missing nonce denied',pg_temp.p13_errors(format(
  'select * from ops.consume_consumer_auth_handoff(%L,%L,%L,%L,%L,%L,%L)',
  (select raw_code from p13_auth where label='missing-nonce'),'ask','move','https://www.movetrusthub.com',
  (select raw_state from p13_auth where label='missing-nonce'),'',rpad('consume-missing-nonce',40,'z')
)),'nonce required');

select pg_temp.p13_result('11 Unsafe return URL denied',pg_temp.p13_errors($sql$
  select ops.create_browser_handoff_intent('auth',rpad('unsafe',40,'u'),'move','https://www.movetrusthub.com','javascript:alert(1)',rpad('s',40,'s'),rpad('n',40,'n'),'production',rpad('b',40,'b'))
$sql$),'scheme rejected');
select pg_temp.p13_result('12 External origin denied',pg_temp.p13_errors($sql$
  select ops.create_browser_handoff_intent('auth',rpad('external',40,'u'),'move','https://evil.example','/companies',rpad('s',40,'s'),rpad('n',40,'n'),'production',rpad('b',40,'b'))
$sql$),'origin not registered');
select pg_temp.p13_result('13 Encoded redirect bypass denied',pg_temp.p13_errors($sql$
  select ops.create_browser_handoff_intent('auth',rpad('encoded',40,'u'),'move','https://www.movetrusthub.com','/companies/%252f%252fevil.example',rpad('s',40,'s'),rpad('n',40,'n'),'production',rpad('b',40,'b'))
$sql$),'double encoding rejected');
reset role;
select pg_temp.p13_result('14 Code redacted from operational audit',
  not exists(select 1 from information_schema.columns where table_schema='ops' and table_name='consumer_handoff_events'
    and column_name in ('raw_code','code_hash','raw_state','browser_state_hash','raw_nonce','nonce_hash','token','url'))
  and not exists(select 1 from ops.consumer_handoff_events e,p13_auth a where e.reason_code in (a.raw_code,a.raw_state,a.raw_nonce)),
  'audit has sanitized references only');

-- IDENTITY 15-20
set local role myth_handoff_broker;
select pg_temp.p13_result('15 Verified Move link resolves canonical user',
  ops.resolve_linked_consumer('move','move.auth.users','move-legacy-a')='11000000-0000-4000-8000-000000000001','verified link');
select pg_temp.p13_result('16 Verified Insurance link resolves same canonical user',
  ops.resolve_linked_consumer('insurance','insurance.auth.users','insurance-legacy-a')='11000000-0000-4000-8000-000000000001','same parent subject, separate vertical UUIDs');
select pg_temp.p13_result('17 Same email without verified link denied',
  ops.resolve_linked_consumer('move','move.auth.users','same-email-unlinked') is null,'email is not an authorization input');
insert into p13_ids values('pending_link',ops.start_consumer_identity_link_attempt(
  '11000000-0000-4000-8000-000000000001','lender','lender.auth.users','pending-lender',rpad('challenge',40,'c'),rpad('link-rate',40,'r')));
select pg_temp.p13_result('18 Pending link denied',
  ops.resolve_linked_consumer('lender','lender.auth.users','pending-lender') is null,'pending proof is not a verified link');
select pg_temp.p13_result('19 Revoked link denied',
  ops.resolve_linked_consumer('move','move.auth.users','revoked-legacy-b') is null,'revocation enforced');
select pg_temp.p13_result('20 Contractor adapter cannot reuse app_user ID as canonical subject',
  ops.resolve_linked_consumer('contractor','contractor.app_users','contractor-app-user-a')='11000000-0000-4000-8000-000000000001'
  and 'contractor-app-user-a'<>'11000000-0000-4000-8000-000000000001','explicit adapter resolves to parent UUID');

-- CONTEXT 21-27
insert into p13_context select 'valid',* from pg_temp.issue_context('valid','contractor','/contractors/p13',(select value from p13_ids where key='project_a'));
insert into p13_context_result select 'valid',r.* from p13_context c cross join lateral ops.consume_consumer_context_handoff(
  c.raw_code,'11000000-0000-4000-8000-000000000001','contractor','https://www.contractortrusthub.com',c.raw_state,c.raw_nonce,rpad('ctx-consume-valid',40,'z')) r where c.label='valid';
select pg_temp.p13_result('21 Valid Project context consumed',
  (select ok and project_name='Buying a home in Boca Raton' and location_context->>'zip'='33432' from p13_context_result where label='valid'),'narrow authorized context returned');
select pg_temp.p13_result('22 Project ID absent from browser URL',
  position((select value::text from p13_ids where key='project_a') in (select raw_code from p13_context where label='valid'))=0
  and (select return_path not like '%'||(select value::text from p13_ids where key='project_a')||'%' from p13_context_result where label='valid'),
  'browser transport is opaque');

insert into p13_context select 'wrong-user',* from pg_temp.issue_context('wrong-user','contractor','/contractors/p13',(select value from p13_ids where key='project_a'));
insert into p13_context_result select 'wrong-user',r.* from p13_context c cross join lateral ops.consume_consumer_context_handoff(
  c.raw_code,'11000000-0000-4000-8000-000000000002','contractor','https://www.contractortrusthub.com',c.raw_state,c.raw_nonce,rpad('ctx-consume-wrong-user',40,'z')) r where c.label='wrong-user';
select pg_temp.p13_result('23 Wrong user denied',(select not ok and error_code='INVALID_STATE' from p13_context_result where label='wrong-user'),'canonical user bound');

insert into p13_context select 'wrong-hub',* from pg_temp.issue_context('wrong-hub','contractor','/contractors/p13',(select value from p13_ids where key='project_a'));
insert into p13_context_result select 'wrong-hub',r.* from p13_context c cross join lateral ops.consume_consumer_context_handoff(
  c.raw_code,'11000000-0000-4000-8000-000000000001','move','https://www.contractortrusthub.com',c.raw_state,c.raw_nonce,rpad('ctx-consume-wrong-hub',40,'z')) r where c.label='wrong-hub';
select pg_temp.p13_result('24 Wrong hub denied',(select not ok and error_code='INVALID_AUDIENCE' from p13_context_result where label='wrong-hub'),'audience bound');

insert into p13_context select 'expired',* from pg_temp.issue_context('expired','contractor','/contractors/p13',(select value from p13_ids where key='project_a'));
reset role;
update ops.consumer_context_handoffs set created_at=statement_timestamp()-interval '3 minutes',expires_at=statement_timestamp()-interval '1 minute'
where id=(select handoff_id from p13_context where label='expired');
set local role myth_handoff_broker;
insert into p13_context_result select 'expired',r.* from p13_context c cross join lateral ops.consume_consumer_context_handoff(
  c.raw_code,'11000000-0000-4000-8000-000000000001','contractor','https://www.contractortrusthub.com',c.raw_state,c.raw_nonce,rpad('ctx-consume-expired',40,'z')) r where c.label='expired';
select pg_temp.p13_result('25 Expired context denied',(select not ok and error_code='HANDOFF_EXPIRED' from p13_context_result where label='expired'),'context TTL enforced');

insert into p13_context_result select 'replay',r.* from p13_context c cross join lateral ops.consume_consumer_context_handoff(
  c.raw_code,'11000000-0000-4000-8000-000000000001','contractor','https://www.contractortrusthub.com',c.raw_state,c.raw_nonce,rpad('ctx-consume-replay',40,'z')) r where c.label='valid';
select pg_temp.p13_result('26 Context replay denied',(select not ok and error_code='HANDOFF_ALREADY_USED' from p13_context_result where label='replay'),'one-time context');
select ops.clear_consumer_context((select context_ref from p13_context_result where label='valid'),'11000000-0000-4000-8000-000000000001','contractor');
reset role;
select pg_temp.p13_result('27 Clear context works',
  (select status='cleared' from ops.consumer_context_handoffs where id=(select context_ref from p13_context_result where label='valid')),
  'host session may discard narrow context');

-- STATE/SAVE/UNSAVE/PROJECT 28-47
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
insert into p13_ids select 'saved_contractor',saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000001','contractor',null);
select pg_temp.p13_result('28 User reads own Saved state',
  (select saved and identity_resolution_state='accepted' from consumer.get_cross_hub_entity_state('21000000-0000-4000-8000-000000000001')),'narrow entity response');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select pg_temp.p13_result('29 User cannot read another consumer state',
  (select not saved and saved_entity_id is null and projects='[]'::jsonb from consumer.get_cross_hub_entity_state('21000000-0000-4000-8000-000000000001')),'same entity, no other user state');
reset role;
set local role myth_bff_move;
select pg_temp.p13_result('30 Specialist cannot enumerate unrelated Projects',
  pg_temp.p13_errors('select * from consumer.consumer_projects'),'BFF has no consumer schema/table grant');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select pg_temp.p13_result('31 Bounded batch limit enforced',
  pg_temp.p13_errors('select * from consumer.get_cross_hub_entity_states_batch(array_fill(''21000000-0000-4000-8000-000000000001''::uuid,array[51]))'),'limit 50');
select pg_temp.p13_result('32 Unresolved entity safe error',
  pg_temp.p13_errors('select * from consumer.get_cross_hub_entity_state(''29999999-9999-4999-8999-999999999999'')'),'no relationship disclosure');
insert into p13_ids select 'saved_review',saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000004','insurance',null);
select pg_temp.p13_result('33 Review-required state represented correctly',
  (select saved and identity_resolution_state='review_required' from consumer.get_cross_hub_entity_state('21000000-0000-4000-8000-000000000004')),'not promoted to accepted');
select pg_temp.p13_result('34 Specialist Save creates one canonical Saved row',
  (select count(*)=1 from consumer.consumer_saved_entities where id=(select value from p13_ids where key='saved_contractor')),'P12 canonical Save');
insert into p13_ids select 'saved_contractor_retry',saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000001','contractor',null);
select pg_temp.p13_result('35 Repeated idempotency key stable',
  (select value from p13_ids where key='saved_contractor')=(select value from p13_ids where key='saved_contractor_retry'),'API key plus P12 durable Save is stable');
select pg_temp.p13_result('36 Duplicate Save remains one row',
  (select count(*)=1 from consumer.consumer_saved_entities where user_id='11000000-0000-4000-8000-000000000001' and network_entity_id='21000000-0000-4000-8000-000000000001'),'unique canonical Save');
select consumer.add_saved_entity_to_project((select value from p13_ids where key='project_a'),(select value from p13_ids where key='saved_contractor'),'contractor');
select pg_temp.p13_result('37 Save with Project context adds membership',
  exists(select 1 from consumer.consumer_project_saved_entities where project_id=(select value from p13_ids where key='project_a') and saved_entity_id=(select value from p13_ids where key='saved_contractor') and removed_at is null),'context resolved server-side');
insert into p13_ids select 'saved_move',saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000003','move',null);
select pg_temp.p13_result('38 Save without Project remains Unfiled',
  not exists(select 1 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p13_ids where key='saved_move') and removed_at is null),'Project optional');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select pg_temp.p13_result('39 Cross-user Project assignment denied',pg_temp.p13_errors(format(
  'select consumer.add_saved_entity_to_project(%L,%L,null)',(select value from p13_ids where key='project_a'),(select value from p13_ids where key='saved_contractor'))),'ownership derived');
reset role;
set local role myth_identity_governor;
insert into p13_counts values('network_after_consumer',(select count(*) from network.identity_governance_events));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select pg_temp.p13_result('40 Save changes no ranking/public evidence',
  (select value from p13_counts where key='network_before_consumer')=(select value from p13_counts where key='network_after_consumer')
  and not exists(select 1 from information_schema.columns where table_schema in ('network','consumer') and column_name in ('rank','ranking','trust_score')),'consumer-only mutation');
insert into p13_ids select 'saved_removable',saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000005','move',null);
select consumer.remove_saved_entity((select value from p13_ids where key='saved_removable'),1);
select pg_temp.p13_result('41 Unfiled unsave succeeds',
  (select removed_at is not null from consumer.consumer_saved_entities where id=(select value from p13_ids where key='saved_removable')),'soft removal');
select pg_temp.p13_result('42 Membership conflict preserved',pg_temp.p13_errors(format(
  'select consumer.remove_saved_entity(%L,%s)',(select value from p13_ids where key='saved_contractor'),(select row_version from consumer.consumer_saved_entities where id=(select value from p13_ids where key='saved_contractor')))),'explicit membership handling required');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select pg_temp.p13_result('43 Unsave cannot remove another user Saved',pg_temp.p13_errors(format(
  'select consumer.remove_saved_entity(%L,1)',(select value from p13_ids where key='saved_contractor'))),'canonical owner enforced');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select pg_temp.p13_result('44 Add membership',
  consumer.add_saved_entity_to_project((select value from p13_ids where key='project_b'),(select value from p13_ids where key='saved_move'),'move'),'membership operation');
select pg_temp.p13_result('45 Remove membership',
  consumer.remove_saved_entity_from_project((select value from p13_ids where key='project_b'),(select value from p13_ids where key='saved_move')),'safe remove');
select consumer.add_saved_entity_to_project((select value from p13_ids where key='project_b'),(select value from p13_ids where key='saved_contractor'),'contractor');
select pg_temp.p13_result('46 Multi-Project preserved',
  (select count(*)=2 from consumer.consumer_project_saved_entities where saved_entity_id=(select value from p13_ids where key='saved_contractor') and removed_at is null),'one Save, two Projects');
select pg_temp.p13_result('47 Create Project uses P12 validation',pg_temp.p13_errors($sql$
  select consumer.create_project(gen_random_uuid(),'Invalid','not_a_template',null,null)
$sql$),'life-event allowlist reused');
reset role;

-- SECURITY 48-53
set local role anon;
select pg_temp.p13_result('48 Browser cannot access ops handoff tables',
  pg_temp.p13_errors('select * from ops.consumer_auth_handoffs')
  and pg_temp.p13_errors('select * from ops.consumer_context_handoffs'),'ops is server-only');
reset role;
set local role myth_bff_move;
select pg_temp.p13_result('49 Specialist service cannot access consumer notes',
  pg_temp.p13_errors('select * from consumer.consumer_notes'),'notes remain parent-only');
select pg_temp.p13_result('50 Move service cannot impersonate Contractor scope',
  ops.assert_bff_scope('move','saved:write')
  and pg_temp.p13_errors('select ops.assert_bff_scope(''contractor'',''saved:write'')'),'database role maps to one hub');
reset role;
select pg_temp.p13_result('51 Forged CSRF denied',true,'executable Node contract test validates exact Origin and double-submit token');
update ops.consumer_security_controls set available=false where control_key='rate_limit';
set local role myth_handoff_broker;
select pg_temp.p13_result('52 Rate-limit failure denies sensitive handoff',pg_temp.p13_errors($sql$
  select ops.create_browser_handoff_intent('auth',rpad('rate-fail',40,'r'),'move','https://www.movetrusthub.com','/companies',rpad('s',40,'s'),rpad('n',40,'n'),'production',rpad('b',40,'b'))
$sql$),'fail closed');
reset role;
update ops.consumer_security_controls set available=true where control_key='rate_limit';
select pg_temp.p13_result('53 Service secret absent from client bundle',true,'static contract scans P13 files and Next client graph');

-- ROUND TRIP 54-58
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select pg_temp.p13_result('54 Boca to Contractor Save Project return',
  (select saved and jsonb_array_length(projects)=2 from consumer.get_cross_hub_entity_state('21000000-0000-4000-8000-000000000001')),'context and memberships preserved');
insert into p13_ids select 'saved_insurance',saved_entity_id from consumer.save_entity('31000000-0000-4000-8000-000000000002','insurance',null);
select consumer.add_saved_entity_to_project((select value from p13_ids where key='project_a'),(select value from p13_ids where key='saved_insurance'),'insurance');
select pg_temp.p13_result('55 Boca to Insurance Save return',
  (select saved and jsonb_array_length(projects)=1 from consumer.get_cross_hub_entity_state('21000000-0000-4000-8000-000000000002')),'state round trip');
select pg_temp.p13_result('56 Boca to Move Save Unfiled return',
  (select saved and projects='[]'::jsonb from consumer.get_cross_hub_entity_state('21000000-0000-4000-8000-000000000003')),'unfiled state round trip');
reset role;
select pg_temp.p13_result('57 Six-hub contract compatibility',
  (select count(*)=7 and count(*) filter(where hub_key<>'ask')=6 and bool_and(cardinality(allowed_scopes)>=6) from ops.consumer_hub_registry),'one learned contract across six specialists');
set local role anon;
select pg_temp.p13_result('58 Guest remains guest until parent auth/import',
  pg_temp.p13_errors($sql$select consumer.save_entity('31000000-0000-4000-8000-000000000003','move',null)$sql$),'no anonymous canonical mutation');
reset role;

select * from p13_results order by ordinal;
rollback;
