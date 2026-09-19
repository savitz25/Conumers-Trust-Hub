// Local embedded PostgreSQL ONLY. No URL/connection/env credentials. P11/P12/P13
// SQL is real; Supabase auth schema/functions and verified users are fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {ParentProfileSaveRuntime,hash} from '../../lib/my-trusthub/profile-save/runtime.ts';
import {AuthorizedPostgresBackend} from '../../lib/my-trusthub/profile-save/authorized-postgres.ts';
import {PostgresConfirmationStore} from '../../lib/my-trusthub/profile-save/confirmation-store.ts';
import {retentionBatch,quotaRetentionBatch,confirmationRetentionBatch} from '../../lib/my-trusthub/profile-save/retention.ts';
import {TRANSFER_VERSION} from '../../lib/my-trusthub/contracts/v2-3-profile-transfer.ts';
const db=new PGlite({extensions:{btree_gist,pgcrypto}});
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
 for(const file of ['20260907160000_my_trusthub_identity_foundation.sql','20260907190000_my_trusthub_saved_projects_guest_import.sql','20260907220000_my_trusthub_cross_hub_handoffs.sql','20260919205200_my_trusthub_v23_transaction_capability.sql']){
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));console.log('LOCAL POSTGRES applied fixture migration '+file);
 }
 assert.equal((await db.query("select count(*)::int as n from pg_roles where rolname like 'myth_v23_%' and (rolsuper or rolbypassrls or rolcanlogin)")).rows[0].n,0);
 console.log('PASS nonlogin/non-BYPASSRLS roles');
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
 const entity='33333333-3333-4333-8333-333333333333',binding='44444444-4444-4444-8444-444444444444';
 const project='55555555-5555-4555-8555-555555555555',otherProject='66666666-6666-4666-8666-666666666666';
 await db.exec(`insert into auth.users values('${A}'),('${B}');
 insert into network.network_entities(id,entity_type,canonical_name,primary_hub) values('${entity}','mover','Synthetic isolated mover','move');
 insert into network.network_entity_bindings(id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,binding_status,valid_from,provenance_ref)
 values('${binding}','${entity}','move','mover','fixture-mover','fixture','fixture-mover','accepted',now()-interval '1 day','fixture-only');
 insert into consumer.consumer_projects(id,user_id,creation_key,name,life_event_type) values
 ('${project}','${A}',gen_random_uuid(),'A Project','moving'),('${otherProject}','${B}',gen_random_uuid(),'B Project','moving');`);
 const proof={code:'c'.repeat(43),targetOrigin:'http://127.0.0.1:4620',state:'s'.repeat(43),nonce:'n'.repeat(43),rateBucket:'q'.repeat(43)};
 await db.query(`with intent as (insert into ops.consumer_browser_handoff_intents(intent_kind,intent_code_hash,audience_hub,target_origin,return_path,browser_state_hash,nonce_hash,environment,expires_at)
 values('auth',$1,'ask',$2,'/my/profile-save',$3,$4,'development',now()+interval '120 seconds') returning id)
 insert into ops.consumer_auth_handoffs(intent_id,code_hash,canonical_user_id,issuer_hub,audience_hub,initiating_origin,target_origin,return_path,browser_state_hash,nonce_hash,creation_key,expires_at)
 select id,$5,$6,'move','ask','http://127.0.0.1:4621',$2,'/my/profile-save',$3,$4,gen_random_uuid(),now()+interval '120 seconds' from intent`,
 [hash('fixture-intent'),proof.targetOrigin,hash(proof.state),hash(proof.nonce),hash(proof.code),A]);
 let caller={hub:'move',browserBinding:'b'.repeat(43),environment:'isolated',scopes:['transfer:stage','saved:write','receipt:verify']};
 const identity={hub:'move',nativeId:'fixture-mover',profileClass:'mover'};
 const item={localItemId:'fixture-mover',revision:'1',digest:'a'.repeat(64),profile:identity};
 const task={kind:'profile',hub:'move',canonicalSlug:'fixture-mover',profile:identity};
 const backend=new AuthorizedPostgresBackend({pool:{connect:async()=>({query:(sql,params)=>db.query(sql,params),release(){}})},
   verify:async a=>JSON.stringify(a.caller)===JSON.stringify(caller),profile:async()=>({...identity,published:true,supportedClass:true,binding:{id:binding,networkEntityId:entity,status:'accepted'}}),
   returnTask:async()=>task,project:async ref=>ref==='p'.repeat(43)?project:otherProject,exchange:async()=>proof});
 const runtime=new ParentProfileSaveRuntime({enabled:true,backend,authenticate:async()=>caller,registry:{environment:'isolated',isolatedBackendVerified:true,
   origins:{move:'http://127.0.0.1:4621',insurance:'http://127.0.0.1:4622',lender:'http://127.0.0.1:4623'}}});
 const stage=await runtime.execute('prepareGuestProfileTransfer',{version:TRANSFER_VERSION,sourceHub:'move',audience:'ask',selected:[item],returnTask:task});
 console.log('PASS SQL stage');
 const continuation=await runtime.execute('prepareProfileSaveContinuation',{sourceHub:'move',audience:'ask',transferRef:stage.transferRef,manifestDigest:stage.manifestDigest});
 console.log('PASS SQL continuation');
 caller={...caller,parent:{subject:A,sessionBinding:'fixture-session',admitted:true},exchange:'fixture-exchange',selectionConfirmed:true,confirmedTransferRef:stage.transferRef};
 const context=await runtime.execute('consumeProfileSaveContinuation',{continuationRef:continuation.continuationRef,issuer:'move',audience:'ask',browserProof:caller.browserBinding});
 console.log('PASS SQL P13 consume');
 const input={requestKey:'fixture-save',accountContextRef:context.accountContextRef,transferRef:stage.transferRef,manifestDigest:stage.manifestDigest,item,projectRef:'p'.repeat(43)};
 const receipt=await runtime.execute('commitProfileSave',input);
 assert.equal(receipt.parent.outcome,'saved');assert.equal(receipt.project.outcome,'added');
 assert.deepEqual(await runtime.execute('commitProfileSave',input),receipt);
 const authorizedCommit={caller:structuredClone(caller),operation:'commitProfileSave',input};
 assert.equal(await backend.transaction(tx=>tx.addProjectP12(input.projectRef,receipt.parent.savedRef,caller),authorizedCommit),'failed','Project cannot use even an owned Saved ID without this transaction Save');
 await assert.rejects(backend.transaction(tx=>tx.put('grant',hash('forged-grant'),{subject:A}),
   {caller:structuredClone(caller),operation:'consumeProfileSaveContinuation',input:{}}),'grant requires actual P13 consume marker');
 await assert.rejects(backend.transaction(tx=>tx.put('receipt',hash(JSON.stringify([A,input.accountContextRef,input.requestKey])),
   {owner:A,receipt}),authorizedCommit),'receipt cannot claim durable Save without transaction marker');
 const partial=await runtime.execute('commitProfileSave',{...input,requestKey:'project-failure',projectRef:'z'.repeat(43)});
 assert.equal(partial.parent.outcome,'already_saved');assert.equal(partial.project.outcome,'failed');
 assert.equal((await db.query('select count(*)::int n from consumer.consumer_saved_entities')).rows[0].n,1);
 // Inject failure after P12 changes but before the real receipt INSERT.
 await db.exec(`create function public.fixture_receipt_failure() returns trigger language plpgsql as $$begin
   if new.payload#>>'{receipt,requestKey}'='rollback-fixture' then raise exception 'synthetic receipt failure'; end if;return new;end$$;
   create trigger fixture_receipt_failure before insert on ops.v23_profile_runtime_records for each row execute function public.fixture_receipt_failure();`);
 const before=await db.query('select row_version from consumer.consumer_saved_entities');
 await assert.rejects(runtime.execute('commitProfileSave',{...input,requestKey:'rollback-fixture'}));
 assert.deepEqual(await db.query('select row_version from consumer.consumer_saved_entities'),before,'P12 mutation rolled back with failed receipt');
 await assert.rejects(runtime.execute('commitProfileSave',{...input,projectRef:'z'.repeat(43)}),/conflict/);
 await assert.rejects(runtime.execute('consumeProfileSaveContinuation',{continuationRef:continuation.continuationRef,issuer:'move',audience:'ask',browserProof:caller.browserBinding}),/conflict/);
 // Expire grant in fixture admin context, then require fresh exact owner recovery.
 await assert.rejects(db.query("update ops.v23_profile_runtime_records set payload=jsonb_set(payload,'{expiresAt}','1') where kind='grant'"));
 // Runtime trigger disallows admin mutation without capability. Clock-independent
 // expiry path is separately covered in R17; force here only through fixture DDL.
 await db.exec('alter table ops.v23_profile_runtime_records disable trigger v23_stamp');
 await db.query("update ops.v23_profile_runtime_records set payload=jsonb_set(payload,'{expiresAt}','1') where kind='grant'");
 await db.exec('alter table ops.v23_profile_runtime_records enable trigger v23_stamp');
 const lookup={accountContextRef:context.accountContextRef,requestKey:input.requestKey};
 await assert.rejects(runtime.execute('getProfileSaveReceipt',lookup),/expired/);
 caller={...caller,parent:{subject:A,sessionBinding:'new-session',admitted:true},receiptRecovery:{...lookup,verifiedAt:Date.now()}};
 assert.deepEqual(await runtime.execute('getProfileSaveReceipt',lookup),receipt);
 assert.equal(await runtime.execute('verifyProfileSaveReceipt',{...lookup,receiptRef:receipt.receiptRef,manifestDigest:stage.manifestDigest,item,projectRef:'z'.repeat(43)}),null);
 await assert.rejects(runtime.execute('commitProfileSave',input));
 caller={...caller,parent:{subject:B,sessionBinding:'fixture-b',admitted:true}};
 assert.equal(await runtime.execute('getProfileSaveReceipt',lookup),null,'B cannot recover A receipt even with copied opaque context');
 for(const bad of [{hub:'lender'}, {scopes:['business:manage']}]){
   const old=caller;caller={...caller,...bad};await assert.rejects(runtime.execute('commitProfileSave',input));caller=old;
 }
 for(const role of ['anon','authenticated','myth_bff_move','myth_v23_executor']){
   await db.exec('begin;set local role '+role);
   if(role==='authenticated')assert.equal((await db.query('select * from consumer.consumer_saved_entities')).rows.length,0,'unbound authenticated role sees no owner rows');
   else await assert.rejects(db.query('select * from consumer.consumer_saved_entities'));
   await db.exec('rollback');
 }
 assert.equal((await db.query('select count(*)::int n from v23_private.transaction_authority')).rows[0].n,0);
 await db.exec('begin;set local role myth_v23_executor');
 await assert.rejects(db.query("insert into v23_private.transaction_authority values(pg_backend_pid(),txid_current(),'{}',now())"));await db.exec('rollback');
 await db.exec('begin;set local role myth_v23_executor');
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[A]);
 await assert.rejects(db.query('select * from consumer.save_entity($1,null,null)',[binding]));await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int n from pg_class where oid in ('ops.v23_profile_runtime_records'::regclass,'ops.v23_profile_runtime_quota'::regclass,'v23_private.transaction_authority'::regclass) and relrowsecurity and relforcerowsecurity")).rows[0].n,3);
 console.log('PASS actual P11/P12/P13 + authorized adapter + SQL receipt, duplicate, Project savepoint, B denial, no workspace enumeration');
 const store=new PostgresConfirmationStore({connect:async()=>({query:(sql,p)=>db.query(sql,p),release(){}})},'dedicated');
 const key='k'.repeat(43),candidate='d'.repeat(43);
 await store.put(key,{source:{continuationRef:continuation.continuationRef},csrf:'fixture',expiresAt:Date.now()+600000,requestPrefix:'p'.repeat(43)});
 await assert.rejects(store.withRecord(key,async(c,checkpoint)=>{c.parent={subject:A,session:'a',label:'Fixture A'};c.contextCandidateRef=candidate;await checkpoint();throw new Error('lost response');}),/lost response/);
 await store.withRecord(key,async c=>{assert.equal(c.contextCandidateRef,candidate);assert.equal(c.parent.subject,A);});
 await assert.rejects(store.withRecord(key,async(c,checkpoint)=>{c.parent.subject=B;await checkpoint();}),/conflict/);
 await store.withRecord(key,async c=>assert.equal(c.parent.subject,A));
 assert.equal(await store.withRecord('u'.repeat(43),async c=>c),null);
 console.log('PASS SQL browser checkpoint survives lost response; owner switch rejected; unknown cookie sees no record');
 const research=await db.query('select * from consumer.consumer_saved_entities');
 await db.exec("begin;set local role myth_v23_cleanup;set local lock_timeout='1s';set local statement_timeout='5s'");
 for(const batch of [retentionBatch(Date.now()),quotaRetentionBatch(Date.now()),confirmationRetentionBatch(Date.now())])await db.query(batch.sql,batch.values);
 await db.exec('commit');
 assert.deepEqual(await db.query('select * from consumer.consumer_saved_entities'),research);
 await db.exec(readFileSync('docs/my-trusthub/v2/V2-3F-rollback.sql','utf8'));
 assert.deepEqual(await db.query('select * from consumer.consumer_saved_entities'),research);
 await db.exec('begin;set local role myth_v23_executor');
 await assert.rejects(db.query('select * from ops.v23_profile_runtime_records'));await db.exec('rollback');
 console.log('PASS cleanup least privilege; rollback closes runtime and preserves research');
}catch(e){console.error('LOCAL POSTGRES FAIL',e.message,e.code,e.where);process.exitCode=1;}finally{await db.close();}
