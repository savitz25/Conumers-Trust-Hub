// Local embedded PostgreSQL ONLY. No URL/connection/env credentials. The P11/P12
// SQL and the forward migration are real; Supabase auth is a fixture.
// Proves consumer.list_saved_entities() returns an empty project_ids array for
// a Saved entity with no active Project membership.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {savedProjectIds} from '../../lib/my-trusthub/saved-project-ids.ts';

const FIX='supabase/migrations/20261003170000_my_trusthub_saved_project_ids.sql';
const db=new PGlite({extensions:{btree_gist,pgcrypto}});
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
 for(const file of ['20260907160000_my_trusthub_identity_foundation.sql','20260907190000_my_trusthub_saved_projects_guest_import.sql'])
  await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
 const entity='33333333-3333-4333-8333-333333333333',binding='44444444-4444-4444-8444-444444444444';
 await db.exec(`insert into auth.users values('${A}'),('${B}');
 insert into network.network_entities(id,entity_type,canonical_name,primary_hub) values('${entity}','mover','Synthetic isolated mover','move');
 insert into network.network_entity_bindings(id,network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,binding_status,valid_from,provenance_ref)
 values('${binding}','${entity}','move','mover','fixture-mover','fixture','fixture-mover','accepted',now()-interval '1 day','fixture-only');`);
 // Every call runs as the signed-in consumer, exactly like the PostgREST RPC.
 const as=async(user,sql,values=[])=>db.transaction(async tx=>{
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user})]);
  return (await tx.query(sql,values)).rows;
 });
 // Compared as cardinality + array text so a NULL element is unambiguous.
 const list=async user=>as(user,'select saved_entity_id,cardinality(project_ids) as n,project_ids::text as ids from consumer.list_saved_entities()');
 const saved=(await as(A,"select saved_entity_id from consumer.save_entity($1,'move',$2)",[binding,{purpose:'v2_3_profile_save'}]))[0].saved_entity_id;

 // The defect, reproduced on the unpatched function: one NULL "membership".
 const before=(await list(A))[0];
 assert.deepEqual([before.n,before.ids],[1,'{NULL}'],'baseline reproduces the production defect ({NULL}, length 1)');
 console.log('REPRODUCED unpatched list_saved_entities(): zero memberships -> project_ids = {NULL}');
 // The application read model no longer trusts a NULL element either.
 assert.deepEqual(savedProjectIds([null]),[]);assert.deepEqual(savedProjectIds(null),[]);assert.deepEqual(savedProjectIds(['p',null]),['p']);

 await db.exec(readFileSync(FIX,'utf8'));
 // Applying twice is harmless (function replacement only).
 await db.exec(readFileSync(FIX,'utf8'));

 // zero memberships -> []
 const shape=async()=>{const row=(await list(A))[0];return [row.n,row.ids];};
 assert.deepEqual(await shape(),[0,'{}']);
 console.log('PASS zero memberships -> project_ids = []');

 // one active membership -> exactly that one UUID
 const project=(await as(A,"select consumer.create_project(gen_random_uuid(),'A Project','moving') as id"))[0].id;
 assert.equal((await as(A,'select consumer.add_saved_entity_to_project($1,$2,null) as added',[project,saved]))[0].added,true);
 assert.deepEqual(await shape(),[1,`{${project}}`]);
 console.log('PASS one active membership -> exactly one UUID');

 // removed membership only -> []
 assert.equal((await as(A,'select consumer.remove_saved_entity_from_project($1,$2) as removed',[project,saved]))[0].removed,true);
 assert.deepEqual(await shape(),[0,'{}']);
 console.log('PASS removed membership only -> project_ids = []');

 // Unfiled again, so the owner-scoped Unsave is permitted; another account sees nothing.
 assert.deepEqual(await list(B),[]);
 const version=(await as(A,'select row_version from consumer.consumer_saved_entities where id=$1',[saved]))[0].row_version;
 await as(A,'select consumer.remove_saved_entity($1,$2)',[saved,version]);
 const after=await as(A,'select removed_at is not null as removed,project_ids::text as ids from consumer.list_saved_entities()');
 assert.equal(after.length,1);assert.equal(after[0].removed,true);assert.equal(after[0].ids,'{}');
 console.log('PASS unfiled Saved entity can be unsaved by its owner; removed row still lists project_ids = []');

 // Signature, security and grants unchanged.
 const fn=(await db.query(`select p.prosecdef,p.provolatile,pg_get_function_result(p.oid) as result,
   has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('anon',p.oid,'EXECUTE') as anon
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='consumer' and p.proname='list_saved_entities'`)).rows;
 assert.equal(fn.length,1);assert.equal(fn[0].prosecdef,true);assert.equal(fn[0].provolatile,'s');
 assert.equal(fn[0].authenticated,true);assert.equal(fn[0].anon,false);assert.match(fn[0].result,/project_ids uuid\[\]/);
 console.log('PASS function signature, SECURITY DEFINER and grants unchanged');
 // The operator packet carries the identical function body.
 const body=text=>/create or replace function consumer\.list_saved_entities\(\)[\s\S]*?\$\$;/.exec(text.replace(/\r\n/g,'\n'))?.[0];
 assert.equal(body(readFileSync('docs/my-trusthub/v2/production/08-ask-prod-saved-project-ids.sql','utf8')),body(readFileSync(FIX,'utf8')));
 console.log('PASS operator packet matches the migration');
}finally{await db.close();}
