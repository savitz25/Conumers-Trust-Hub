// Disposable PostgreSQL ACL simulation ONLY; no URLs, credentials or remote clients.
// pg_net is a local SQL fixture extension with inert HTTP functions, not pg_net C code.
// Actual CREATE EXTENSION/GRANT/REVOKE create all dependency/ACL catalog records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { closeoutPacket } from './v23-sql-closeout-cases.mjs';
const root = 'docs/my-trusthub/v2/final-parent-wiring/';
const sql = file => readFileSync(root + file, 'utf8');
const body = file => sql(file).replace(/^begin(?: isolation level serializable)?(?: read only)?;$/gm,'').replace(/^commit;$/gm,'');
const roles = ['supabase_admin','supabase_functions_admin','postgres','anon','authenticated','service_role'];
async function rejected(db, mutation, file, expected) {
  await db.exec('begin');
  try {
    await db.exec(mutation);
    await assert.rejects(db.exec(body(file)), expected);
  } finally { await db.exec('rollback'); }
}
async function pass(db, file, marker) {
  const results = await db.exec(sql(file));
  assert.ok(results.some(r => r.rows?.some(row => row.result===marker)), file + ' machine PASS required');
}
const packetPass = db => pass(db,'assertions.sql','V23_PARENT_PACKET_ASSERTIONS_PASS');
async function platformFixture(db) {
  const share = (await db.query("select setting from pg_config where name='SHAREDIR'")).rows[0].setting;
  db.Module.FS.writeFile(share + '/extension/pg_net.control', "comment = 'LOCAL ACL FIXTURE ONLY'\ndefault_version = '0.20.4'\nrelocatable = false\nsuperuser = true\n");
  db.Module.FS.writeFile(share + '/extension/pg_net--0.20.4.sql', `
    create schema net;
    create table net._http_response(id bigint,content text);
    create table net.http_request_queue(id bigint,body bytea);
    create function net.http_get(url text,params jsonb,headers jsonb,timeout_milliseconds integer)
      returns bigint language plpgsql as $$begin raise exception 'LOCAL_HTTP_CALLED'; end$$;
    create function net.http_post(url text,body jsonb,params jsonb,headers jsonb,timeout_milliseconds integer)
      returns bigint language plpgsql as $$begin raise exception 'LOCAL_HTTP_CALLED'; end$$;
    create function net.http_delete(url text,params jsonb,headers jsonb,timeout_milliseconds integer,body jsonb)
      returns bigint language plpgsql as $$begin raise exception 'LOCAL_HTTP_CALLED'; end$$;
    grant all on all tables in schema net to public;
    grant usage on schema net to public,supabase_functions_admin,postgres,anon,authenticated,service_role;
  `);
  await db.exec(`create role supabase_admin superuser nologin;
    create role supabase_functions_admin nologin;
    set role supabase_admin; create extension pg_net; reset role;`);
}
async function deniedAsRuntime(db, query, schema) {
  await db.exec('begin;set local role myth_v23_parent_preview');
  try { await assert.rejects(db.exec(query), error => error.code==='42501' && error.message.includes('schema ' + schema)); }
  finally { await db.exec('rollback'); }
}
export async function platformAclCases(originalDb) {
  const db = new PGlite({database:'postgres',loadDataDir:await originalDb.dumpDataDir(),extensions:{btree_gist,pgcrypto}});
  try {
    const pin = (await originalDb.query("select current_setting('v23.binding_id') bid,current_setting('v23.network_entity_id') eid,current_setting('v23.binding_provenance_ref') provenance")).rows[0];
    await db.query("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false),set_config('v23.binding_id',$1,false),set_config('v23.network_entity_id',$2,false),set_config('v23.binding_provenance_ref',$3,false)",[pin.bid,pin.eid,pin.provenance]);
    await db.exec("set v23.platform_public_hardening_authorized='true';set v23.closeout_writers_drained='true'");
    assert.equal((await db.query('select current_database() db')).rows[0].db,'postgres');
    await db.exec(`create view extensions.pg_stat_statements as select 1 fixture;
      create view extensions.pg_stat_statements_info as select 1 fixture;
      grant select on extensions.pg_stat_statements,extensions.pg_stat_statements_info to public;`);
    for (const name of ['pg_stat_statements','pg_stat_statements_info']) {
      const access = (await db.query("select has_table_privilege('myth_v23_parent_preview',$1,'SELECT') object_select,has_schema_privilege('myth_v23_parent_preview','extensions','USAGE') schema_usage",['extensions.'+name])).rows[0];
      assert.deepEqual(access,{object_select:true,schema_usage:false});
      await deniedAsRuntime(db,'select * from extensions.' + name,'extensions');
    }
    await packetPass(db); // A: PUBLIC object SELECT without schema USAGE is unreachable.
    await rejected(db,'grant usage on schema extensions to public','assertions.sql',/Raw table\/column access|Runtime pg_stat schema access/); // B
    await platformFixture(db);
    const inventory = `select jsonb_agg(to_jsonb(x) order by kind,object_id) objects from (
      select 'relation' kind,c.oid object_id,c.relowner owner_id,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='net'
      union all select 'function',p.oid,p.proowner,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net') x`;
    const objectsBefore = (await db.query(inventory)).rows[0].objects;
    const schemaBefore = (await db.query("select nspowner,nspacl::text acl from pg_namespace where nspname='net'")).rows[0];
    await assert.rejects(db.exec(sql('assertions.sql')),/Raw table\/column access/); // C
    await db.exec('rollback');
    const guards = [
      ["set local v23.platform_public_hardening_authorized='false'",/Separate isolated platform ACL authorization/],
      ["set local v23.approved_project='qvvxvbcdmbjzrgvwjatw'",/Separate isolated platform ACL authorization/],
      ["set local v23.closeout_writers_drained='false'",/Separate isolated platform ACL authorization/],
      ['alter schema net owner to postgres',/schema owner\/extension baseline/],
      ['drop extension pg_net cascade',/schema owner\/extension baseline/],
      ['alter extension pg_net drop table net._http_response',/ownership\/extension membership/],
      ['alter extension pg_net drop table net.http_request_queue',/ownership\/extension membership/],
      ['alter table net._http_response owner to postgres',/ownership\/extension membership/],
      ['grant create on schema net to public',/schema ACL baseline/],
      ['grant usage on schema net to myth_v23_cleanup',/schema ACL baseline/],
      ['grant usage on schema net to anon with grant option',/schema ACL baseline/],
      ['revoke usage on schema net from public',/schema ACL baseline/],
      ...roles.map(role => ['revoke usage on schema net from ' + role,/schema ACL baseline/]),
      ["create function public.local_net_dependency() returns void language plpgsql as $$begin perform net.http_get('local',null,null,1); end$$",/application pg_net dependency/],
      ["create schema supabase_functions;create function supabase_functions.http_request() returns trigger language plpgsql as $$begin return new;end$$;create trigger local_webhook after insert on consumer.packet_reference_fixture for each row execute function supabase_functions.http_request()",/trigger\/webhook dependency/],
    ];
    for (const [mutation, expected] of guards) await rejected(db,mutation,'platform-public-hardening.sql',expected);
    await pass(db,'platform-public-hardening.sql','V23_PLATFORM_PUBLIC_HARDENING_PASS'); // D
    await packetPass(db);
    console.log('PASS platform ACL: hardening and activation assertion');
    assert.deepEqual((await db.query(inventory)).rows[0].objects,objectsBefore);
    for (const role of roles) assert.equal((await db.query("select has_schema_privilege($1,'net','USAGE') allowed",[role])).rows[0].allowed,true);
    for (const table of ['_http_response','http_request_queue']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) assert.equal((await db.query("select has_table_privilege('myth_v23_parent_preview',$1,$2) object_acl",['net.'+table,privilege])).rows[0].object_acl,true);
      for (const query of ['select * from net.'+table,'insert into net.'+table+'(id) values(1)','update net.'+table+' set id=1','delete from net.'+table]) await deniedAsRuntime(db,query,'net');
    }
    for (const [name,types,args] of [
      ['http_get','text,jsonb,jsonb,integer',"'local',null,null,1"],
      ['http_post','text,jsonb,jsonb,jsonb,integer',"'local',null,null,null,1"],
      ['http_delete','text,jsonb,jsonb,integer,jsonb',"'local',null,null,1,null"],
    ]) {
      assert.equal((await db.query("select has_function_privilege('myth_v23_parent_preview',$1,'EXECUTE') object_acl",['net.'+name+'('+types+')'])).rows[0].object_acl,true);
      await deniedAsRuntime(db,'select net.'+name+'('+args+')','net');
    }
    // SET ROLE authority is checked with the runtime as session user, not a superuser.
    console.log('PASS platform ACL: schema-qualified table/function denial');
    await db.exec('set session authorization myth_v23_parent_preview');
    try {
      await pass(db,'platform-runtime-probes.sql','V23_PLATFORM_RUNTIME_PROBES_PASS');
      await db.exec('set role myth_v23_authorizer');
      assert.equal((await db.query('select v23_private.preview_ports_ready() ready')).rows[0].ready,true);
      await db.exec('reset role;set role myth_v23_executor;reset role');
      await assert.rejects(db.exec('set role myth_v23_cleanup'), error => error.code==='42501');
      await assert.rejects(db.exec('select v23_private.preview_ports_ready()'),error => error.code==='42501');
    } finally { await db.exec('set session authorization postgres;reset role'); }
    assert.deepEqual((await db.query('select current_user,session_user')).rows,[{current_user:'postgres',session_user:'postgres'}]);
    const negatives = [
      ['grant usage on schema net to myth_v23_parent_preview',/Unexpected direct runtime grants/], // E
      ['grant usage on schema net to public',/Raw table\/column access/], // F
      ...roles.map(role => ['revoke usage on schema net from '+role,/schema ACL baseline/]), // G: includes owner explicit grant
      ...['auth.users','consumer.consumer_saved_entities','network.network_entities','ops.v23_profile_runtime_records','v23_private.browser_confirmations'].map(table => ['grant select on '+table+' to public',/Raw table\/column access/]), // H: even with no USAGE
      ['create table public.local_raw(id int);grant select on public.local_raw to public',/Raw table\/column access/],
      ['grant select on consumer.consumer_saved_entities to myth_v23_parent_preview',/Unexpected direct runtime grants/],
    ];
    for (const [mutation,expected] of negatives) await rejected(db,mutation,'assertions.sql',expected);
    console.log('PASS platform ACL: activation negatives');
    await packetPass(db);
    await db.exec("set v23.platform_public_rollback_authorized='true'");
    await assert.rejects(db.exec(sql('platform-public-rollback.sql')),/Remove preview runtime/);
    await db.exec('rollback');
    // Existing lifecycle/receipt/A-B preservation suite now runs with hardened net.
    await closeoutPacket(db);
    // Rollback refuses unknown ACLs, missing approval, or any missing explicit role.
    await db.exec('revoke usage on schema net from public');
    const rollbackGuards = [
      ["set local v23.platform_public_rollback_authorized='false'",/Separate isolated platform ACL authorization/],
      ["set local v23.approved_project='qvvxvbcdmbjzrgvwjatw'",/Separate isolated platform ACL authorization/],
      ['alter schema net owner to postgres',/schema owner\/extension baseline/],
      ['grant create on schema net to public',/schema ACL baseline/],
      ...roles.map(role => ['revoke usage on schema net from '+role,/schema ACL baseline/]),
    ];
    for (const [mutation,expected] of rollbackGuards) await rejected(db,mutation,'platform-public-rollback.sql',expected);
    await pass(db,'platform-public-rollback.sql','V23_PLATFORM_PUBLIC_ROLLBACK_PASS');
    await pass(db,'teardown-assertions.sql','V23_PARENT_PACKET_TEARDOWN_ASSERTIONS_PASS');
    const schemaAfter = (await db.query("select nspowner,nspacl::text acl from pg_namespace where nspname='net'")).rows[0];
    assert.equal(schemaAfter.nspowner,schemaBefore.nspowner);
    // ACL array ordering is not authority; compare the exploded entries.
    const entries = text => text.replace(/[{}]/g,'').split(',').sort();
    assert.deepEqual(entries(schemaAfter.acl),entries(schemaBefore.acl));
    assert.deepEqual((await db.query(inventory)).rows[0].objects,objectsBefore);
    await rejected(db,'revoke usage on schema net from public','teardown-assertions.sql',/Original platform PUBLIC net ACL/);
    await rejected(db,'grant select on net._http_response to anon','teardown-assertions.sql',/Platform object ACLs\/ownership/);
    console.log('PASS platform ACL matrix A-H: effective relation/function denial, exact six platform grants preserved, runtime SET ROLE boundaries unchanged');
    console.log('PASS platform ACL guards: '+guards.length+' precondition negatives; '+negatives.length+' activation negatives; '+rollbackGuards.length+' rollback guard negatives; rollback-before-runtime-removal rejected; exact full closeout ACL restoration and consumer/receipt preservation');
  } finally { await db.close(); }
  assert.equal((await originalDb.query("select to_regnamespace('net') is null absent")).rows[0].absent,true);
}
