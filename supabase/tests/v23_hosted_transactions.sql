-- Isolated branch ONLY. Synthetic SQL/Auth fixtures, NOT browser/provider QA.
-- One rollback-only transaction; no persistent user, grant, schema or research.
begin;
-- Hosted PG17 auto ADMIN membership is not SET authority. The BFF negative
-- access check also needs a temporary self-grant; ROLLBACK removes all of these.
grant myth_v23_authorizer,myth_v23_executor,myth_v23_browser_store,myth_v23_cleanup,myth_bff_move
  to current_user with admin false,inherit false,set true granted by current_user;
create temporary table v23_results(label text primary key,passed boolean not null);
grant select,insert on v23_results to anon,authenticated,myth_bff_move,
  myth_v23_executor,myth_v23_authorizer,myth_v23_browser_store,myth_v23_cleanup;
create function pg_temp.v23_check(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'V23 assertion failed: %',label; end if;
  insert into v23_results values(label,true);
end $$;
create function pg_temp.v23_denied(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when insufficient_privilege then return true; end $$;
create temporary table v23_fixture(k text primary key,v jsonb);
grant select,insert,update on v23_fixture to myth_v23_executor,myth_v23_authorizer;
insert into auth.users(id) values
 ('a3230000-0000-4000-8000-000000000001'),('a3230000-0000-4000-8000-000000000002');
insert into network.network_entities(id,entity_type,canonical_name,primary_hub)
 values('e3230000-0000-4000-8000-000000000001','organization','Synthetic V23 SQL fixture','move');
insert into network.network_entity_bindings(id,network_entity_id,hub,specialist_entity_type,
 specialist_entity_id,identifier_namespace,source_identifier,binding_status,valid_from,provenance_ref)
 values('b3230000-0000-4000-8000-000000000001','e3230000-0000-4000-8000-000000000001',
 'move','mover','v23-hosted-fixture','fixture.v23','v23-hosted-fixture','accepted',now()-interval '1 day','fixture:v23:rollback-only');
insert into consumer.consumer_projects(id,user_id,creation_key,name,life_event_type) values
 ('c3230000-0000-4000-8000-000000000001','a3230000-0000-4000-8000-000000000001',gen_random_uuid(),'SQL fixture A','moving'),
 ('c3230000-0000-4000-8000-000000000002','a3230000-0000-4000-8000-000000000002',gen_random_uuid(),'SQL fixture B','moving');
insert into v23_fixture values
 ('item','{"localItemId":"fixture","revision":"1","digest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","profile":{"hub":"move","nativeId":"v23-hosted-fixture","profileClass":"mover"}}'),
 ('proof',jsonb_build_object('code',repeat('c',43),'targetOrigin','https://fixture-ask.invalid','state',repeat('s',43),'nonce',repeat('n',43),'rateBucket',repeat('q',43)));
insert into v23_fixture select 'input',jsonb_build_object('requestKey','hosted-proof','accountContextRef',repeat('g',43),
 'transferRef',repeat('t',43),'manifestDigest',repeat('d',64),'item',v,'projectRef',repeat('p',43)) from v23_fixture where k='item';
insert into v23_fixture select 'authority',jsonb_build_object('hub','move','audience','ask','service','svc:trusthub:move:bff:v1',
 'scopes',jsonb_build_array('transfer:stage','saved:write','receipt:verify'),'browser',repeat('b',64),
 'subject','a3230000-0000-4000-8000-000000000001','session','fixture-session','operation','prepareGuestProfileTransfer',
 'input',v,'projectId','c3230000-0000-4000-8000-000000000001','exchangeProof',(select v from v23_fixture where k='proof'),
 'receiptKey',repeat('e',64),'quotaKey',repeat('f',64)) from v23_fixture where k='input';
-- Fixture control only: no SECURITY DEFINER, persistent helper or runtime grant.
create function pg_temp.v23_authorize(patch jsonb default '{}') returns void language plpgsql as $$
begin
  execute 'reset role'; execute 'set local role myth_v23_authorizer';
  delete from v23_private.save_validation where backend=pg_backend_pid() and transaction_id=txid_current();
  delete from v23_private.exchange_validation where backend=pg_backend_pid() and transaction_id=txid_current();
  delete from v23_private.transaction_authority where backend=pg_backend_pid() and transaction_id=txid_current();
  insert into v23_private.transaction_authority(backend,transaction_id,authority)
    select pg_backend_pid(),txid_current(),v||patch from v23_fixture where k='authority';
  execute 'set local role myth_v23_executor';
end $$;
set local role anon;
select pg_temp.v23_check(pg_temp.v23_denied('select * from v23_private.transaction_authority'),'anonymous private denial');
reset role; set local role authenticated;
select pg_temp.v23_check(pg_temp.v23_denied('select * from v23_private.browser_confirmations'),'authenticated private denial');
reset role; set local role myth_bff_move;
select pg_temp.v23_check(pg_temp.v23_denied('select * from consumer.consumer_projects'),'BFF workspace denial');
reset role; set local role myth_v23_executor;
select pg_temp.v23_check(pg_temp.v23_denied('insert into v23_private.transaction_authority values(pg_backend_pid(),txid_current(),''{}'',now())'),'executor cannot mint authority');
select pg_temp.v23_check(pg_temp.v23_denied('select * from consumer.save_entity(''b3230000-0000-4000-8000-000000000001'',null,null)'),'executor cannot call P12 directly');
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.authority()'),'missing authority denied');
reset role;
select pg_temp.v23_authorize('{"audience":"move"}');
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.authority()'),'wrong audience denied');
select pg_temp.v23_authorize('{"service":"svc:trusthub:lender:bff:v1"}');
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.authority()'),'wrong service denied');
select pg_temp.v23_authorize('{"scopes":[]}');
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.authority()'),'missing scope denied');
select pg_temp.v23_authorize();
insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
 select 'stage',encode(sha256(convert_to(repeat('t',43),'UTF8')),'hex'),
 jsonb_build_object('input',jsonb_build_object('selected',jsonb_build_array(v)),
 'digest',repeat('d',64),'expiresAt',extract(epoch from now()+interval '10 minutes')*1000) from v23_fixture where k='item';
select pg_temp.v23_check((select count(*)=1 from ops.v23_profile_runtime_records),'stage current browser visible');
select pg_temp.v23_authorize('{"browser":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}');
select pg_temp.v23_check((select count(*)=0 from ops.v23_profile_runtime_records),'other browser stage hidden');
select pg_temp.v23_authorize('{"operation":"prepareProfileSaveContinuation"}');
insert into ops.v23_profile_runtime_records(kind,key_hash,payload) values('continuation',repeat('2',64),
 jsonb_build_object('stageKey',encode(sha256(convert_to(repeat('t',43),'UTF8')),'hex'),'used',false,
 'expiresAt',extract(epoch from now()+interval '10 minutes')*1000));
select pg_temp.v23_check((select count(*)=1 from ops.v23_profile_runtime_records where kind='continuation'),'continuation staged for same browser');
select pg_temp.v23_authorize('{"operation":"prepareProfileSaveContinuation","hub":"lender","service":"svc:trusthub:lender:bff:v1"}');
select pg_temp.v23_check((select count(*)=0 from ops.v23_profile_runtime_records),'other hub cannot read stage or continuation');
select pg_temp.v23_authorize('{"operation":"consumeProfileSaveContinuation"}');
select pg_temp.v23_check(pg_temp.v23_denied($q$insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
 values('grant',repeat('1',64),'{"subject":"a3230000-0000-4000-8000-000000000001"}')$q$),'grant needs real P13 marker');
reset role;
with i as(insert into ops.consumer_browser_handoff_intents(intent_kind,intent_code_hash,audience_hub,target_origin,
 return_path,browser_state_hash,nonce_hash,environment,expires_at)
 values('auth',encode(extensions.digest('v23-hosted-intent','sha256'),'hex'),'ask','https://fixture-ask.invalid','/my/profile-save',
 encode(extensions.digest(repeat('s',43),'sha256'),'hex'),encode(extensions.digest(repeat('n',43),'sha256'),'hex'),'development',now()+interval '2 minutes') returning id)
 insert into ops.consumer_auth_handoffs(intent_id,code_hash,canonical_user_id,issuer_hub,audience_hub,initiating_origin,
 target_origin,return_path,browser_state_hash,nonce_hash,creation_key,expires_at)
 select id,encode(extensions.digest(repeat('c',43),'sha256'),'hex'),'a3230000-0000-4000-8000-000000000001','move','ask',
 'https://fixture-move.invalid','https://fixture-ask.invalid','/my/profile-save',encode(extensions.digest(repeat('s',43),'sha256'),'hex'),
 encode(extensions.digest(repeat('n',43),'sha256'),'hex'),gen_random_uuid(),now()+interval '2 minutes' from i;
select pg_temp.v23_authorize('{"operation":"consumeProfileSaveContinuation","subject":"a3230000-0000-4000-8000-000000000002"}');
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.consume_context((select v from v23_fixture where k=''proof''))'),'wrong P13 subject denied atomically');
select pg_temp.v23_authorize('{"operation":"consumeProfileSaveContinuation"}');
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.consume_context(''{}'')'),'changed exchange proof denied');
select pg_temp.v23_check(v23_private.consume_context((select v from v23_fixture where k='proof'))='a3230000-0000-4000-8000-000000000001','P13 validated same subject');
insert into ops.v23_profile_runtime_records(kind,key_hash,payload) values('grant',encode(sha256(convert_to(repeat('g',43),'UTF8')),'hex'),
 jsonb_build_object('subject','a3230000-0000-4000-8000-000000000001','session','fixture-session','browser',repeat('b',64),
 'stageKey',encode(sha256(convert_to(repeat('t',43),'UTF8')),'hex'),'expiresAt',extract(epoch from now()+interval '10 minutes')*1000));
select pg_temp.v23_check(pg_temp.v23_denied('select v23_private.consume_context((select v from v23_fixture where k=''proof''))'),'P13 replay denied');
select pg_temp.v23_authorize('{"operation":"commitProfileSave"}');
select pg_temp.v23_authorize(jsonb_build_object('operation','commitProfileSave','input',
 (select v||jsonb_build_object('manifestDigest',repeat('0',64)) from v23_fixture where k='input')));
select pg_temp.v23_check(pg_temp.v23_denied($q$select * from v23_private.save_profile('b3230000-0000-4000-8000-000000000001')$q$),'altered manifest cannot Save');
select pg_temp.v23_authorize(jsonb_build_object('operation','commitProfileSave','input',
 (select jsonb_set(v,'{item,revision}','"2"') from v23_fixture where k='input')));
select pg_temp.v23_check(pg_temp.v23_denied($q$select * from v23_private.save_profile('b3230000-0000-4000-8000-000000000001')$q$),'unselected revision cannot Save');
select pg_temp.v23_authorize('{"operation":"commitProfileSave"}');
select pg_temp.v23_check(pg_temp.v23_denied($q$select * from v23_private.save_profile('b3230000-0000-4000-8000-000000000099')$q$),'wrong binding denied');
select pg_temp.v23_check(pg_temp.v23_denied($q$insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
 select 'receipt',repeat('e',64),jsonb_build_object('owner','a3230000-0000-4000-8000-000000000001','receipt',v||jsonb_build_object(
 'parent',jsonb_build_object('outcome','saved','savedRef','e3230000-0000-4000-8000-000000000001'),
 'project',jsonb_build_object('projectRef',repeat('p',43)))) from v23_fixture where k='input'$q$),'receipt requires actual Save marker');
insert into v23_fixture select 'saved',to_jsonb(s) from v23_private.save_profile('b3230000-0000-4000-8000-000000000001') s;
select pg_temp.v23_check((select (v->>'created')::boolean from v23_fixture where k='saved'),'exact P12 Save succeeds');
select pg_temp.v23_check(v23_private.add_project('c3230000-0000-4000-8000-000000000001',
 (select (v->>'saved_entity_id')::uuid from v23_fixture where k='saved')),'Project A membership succeeds');
insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
 select 'receipt',repeat('e',64),jsonb_build_object('owner','a3230000-0000-4000-8000-000000000001','receipt',v||jsonb_build_object(
 'parent',jsonb_build_object('outcome','saved','savedRef',(select v->>'saved_entity_id' from v23_fixture where k='saved')),
 'project',jsonb_build_object('outcome','added','projectRef',repeat('p',43)))) from v23_fixture where k='input';
select pg_temp.v23_check((select count(*)=1 from ops.v23_profile_runtime_records where kind='receipt'),'durable receipt accepted');
select pg_temp.v23_check(pg_temp.v23_denied($q$update ops.v23_profile_runtime_records set payload=jsonb_set(payload,'{receipt,item,revision}','"2"') where kind='receipt'$q$),'changed item rejected');
select pg_temp.v23_check(pg_temp.v23_denied($q$update ops.v23_profile_runtime_records set payload=jsonb_set(payload,'{receipt,project,projectRef}','"changed"') where kind='receipt'$q$),'changed Project receipt rejected');
select pg_temp.v23_check(pg_temp.v23_denied($q$update ops.v23_profile_runtime_records set owner_id='a3230000-0000-4000-8000-000000000002' where kind='receipt'$q$),'owner stamp immutable');
select pg_temp.v23_authorize('{"operation":"commitProfileSave","projectId":"c3230000-0000-4000-8000-000000000002"}');
select pg_temp.v23_check(pg_temp.v23_denied($q$select v23_private.add_project('c3230000-0000-4000-8000-000000000002',
 (select (v->>'saved_entity_id')::uuid from v23_fixture where k='saved'))$q$),'Project requires current-transaction Save marker');
select pg_temp.v23_check((select not created and saved_entity_id=(select (v->>'saved_entity_id')::uuid from v23_fixture where k='saved')
 from v23_private.save_profile('b3230000-0000-4000-8000-000000000001')),'duplicate P12 Save same row');
savepoint v23_project;
select pg_temp.v23_check(pg_temp.v23_denied($q$select v23_private.add_project('c3230000-0000-4000-8000-000000000002',
 (select (v->>'saved_entity_id')::uuid from v23_fixture where k='saved'))$q$),'cross-owner Project failure');
release savepoint v23_project;
reset role;
select pg_temp.v23_check((select count(*)=1 from consumer.consumer_saved_entities where user_id='a3230000-0000-4000-8000-000000000001'),'Project failure preserves one Save');
select pg_temp.v23_check((select count(*)=0 from consumer.consumer_project_saved_entities where project_id='c3230000-0000-4000-8000-000000000002'),'Project B untouched');
-- Deliberate subtransaction abort after P12 update proves Save/receipt rollback.
select pg_temp.v23_authorize('{"operation":"commitProfileSave"}');
reset role;
insert into v23_fixture select 'version',to_jsonb(row_version) from consumer.consumer_saved_entities where user_id='a3230000-0000-4000-8000-000000000001';
do $$ begin
  begin
    set local role myth_v23_executor;
    perform v23_private.save_profile('b3230000-0000-4000-8000-000000000001');
    raise exception 'fixture receipt failure' using errcode='ZX001';
  exception when sqlstate 'ZX001' then null; end;
end $$;
reset role;
select pg_temp.v23_check((select to_jsonb(row_version)=(select v from v23_fixture where k='version') from consumer.consumer_saved_entities
 where user_id='a3230000-0000-4000-8000-000000000001'),'failed receipt transaction rolls back P12 version');
select pg_temp.v23_authorize('{"operation":"getProfileSaveReceipt","session":"reauthenticated-fixture"}');
select pg_temp.v23_check((select count(*)=1 from ops.v23_profile_runtime_records where kind='receipt'),'fresh owner receipt read independent of old session');
select pg_temp.v23_authorize('{"operation":"getProfileSaveReceipt","receiptKey":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}');
select pg_temp.v23_check((select count(*)=0 from ops.v23_profile_runtime_records where kind='receipt'),'other receipt context hidden');
select pg_temp.v23_authorize('{"operation":"getProfileSaveReceipt","subject":"a3230000-0000-4000-8000-000000000002"}');
select pg_temp.v23_check((select count(*)=0 from ops.v23_profile_runtime_records where kind='receipt'),'Consumer B cannot recover A receipt');
select pg_temp.v23_authorize('{"operation":"commitProfileSave","session":"switched-session"}');
select pg_temp.v23_check(pg_temp.v23_denied($q$select * from v23_private.save_profile('b3230000-0000-4000-8000-000000000001')$q$),'switched session cannot Save');
-- A stale quota is the only cleanup fixture made eligible; research is not.
insert into ops.v23_profile_runtime_quota(bucket,window_start,count)
 values(repeat('f',64),floor(extract(epoch from now())/60)-1441,1);
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','a3230000-0000-4000-8000-000000000002',true);
select pg_temp.v23_check((select count(*)=0 from consumer.consumer_saved_entities),'Consumer B RLS hides A Save');
reset role; set local role myth_v23_cleanup;
select pg_temp.v23_check((select count(*)=0 from ops.v23_profile_runtime_records),'cleanup cannot see fresh receipts');
select pg_temp.v23_check(pg_temp.v23_denied('delete from consumer.consumer_saved_entities'),'cleanup cannot delete research');
with d as(delete from ops.v23_profile_runtime_quota returning bucket)
 select pg_temp.v23_check((select count(*)=1 from d),'cleanup removes only expired quota');
reset role; set local role myth_v23_browser_store;
select set_config('v23.confirmation_key',repeat('9',64),true);
insert into v23_private.browser_confirmations(key_hash,payload) values(repeat('9',64),'{}');
select set_config('v23.confirmation_key',repeat('8',64),true);
select pg_temp.v23_check((select count(*)=0 from v23_private.browser_confirmations),'confirmation cookie isolates record');
reset role;
select pg_temp.v23_check(to_regclass('consumer.consumer_watches') is null,'zero Watch runtime or creation');
do $$ begin
 if (select count(*) from v23_results)<>44 then raise exception 'matrix assertion count: %',(select count(*) from v23_results); end if;
end $$;
rollback;
select 'PASS: 44 rollback-only hosted SQL assertions' hosted_transaction_matrix;
