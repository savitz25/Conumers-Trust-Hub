// Disposable embedded PostgreSQL only. Inert SQL extension; no network code.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {closeoutPacket} from './v23-sql-closeout-cases.mjs';
const root='docs/my-trusthub/v2/final-parent-wiring/',sql=f=>readFileSync(root+f,'utf8');
const body=f=>sql(f).replace(/^begin(?: isolation level serializable)?(?: read only)?;$/gm,'').replace(/^(?:commit|rollback);$/gm,'');
async function packetPass(db){const r=await db.exec(sql('assertions.sql'));assert.ok(r.some(x=>x.rows?.some(y=>y.result==='V23_PARENT_PACKET_ASSERTIONS_PASS')));}
async function rejected(db,mutation,pattern){await db.exec('begin');try{await db.exec(mutation);await assert.rejects(db.exec(body('assertions.sql')),pattern);}finally{await db.exec('rollback');}}
async function installFixture(db){const share=(await db.query("select setting from pg_config where name='SHAREDIR'")).rows[0].setting;
 db.Module.FS.writeFile(share+'/extension/pg_net.control',"comment='LOCAL FIXTURE'\ndefault_version='0.20.4'\nrelocatable=false\nsuperuser=true\n");
 db.Module.FS.writeFile(share+'/extension/pg_net--0.20.4.sql',`create schema net;create table net._http_response(id bigint,content text);create table net.http_request_queue(id bigint,body bytea);create function net.http_get(text,jsonb,jsonb,integer) returns bigint language sql as $$select 1::bigint$$;create function net.http_post(text,jsonb,jsonb,jsonb,integer) returns bigint language sql as $$select 1::bigint$$;create function net.http_delete(text,jsonb,jsonb,integer,jsonb) returns bigint language sql as $$select 1::bigint$$;`);
 await db.exec('create extension pg_net');}
async function governorMembershipCases(originalDb){
 const db=new PGlite({database:'postgres',loadDataDir:await originalDb.dumpDataDir(),extensions:{btree_gist,pgcrypto}});
 try{const pin=(await originalDb.query("select current_setting('v23.binding_id') bid,current_setting('v23.network_entity_id') eid,current_setting('v23.binding_provenance_ref') provenance")).rows[0];
  await db.query("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false),set_config('v23.binding_id',$1,false),set_config('v23.network_entity_id',$2,false),set_config('v23.binding_provenance_ref',$3,false)",[pin.bid,pin.eid,pin.provenance]);
  await db.exec(`create role v23_governor_fixture_admin superuser nologin;set session authorization v23_governor_fixture_admin;
    alter role postgres rename to supabase_admin;create role postgres nologin noinherit nosuperuser nobypassrls;
    grant myth_identity_governor to postgres with admin true,inherit false,set false granted by supabase_admin`);
  await packetPass(db);
  await db.exec(`set role postgres;
    grant myth_identity_governor to postgres with admin false,inherit false,set true granted by postgres;
    reset role`);
  assert.equal((await db.query("select count(*)::int n from pg_auth_members m join pg_roles g on g.oid=m.roleid where g.rolname='myth_identity_governor' and m.set_option")).rows[0].n,1);
  await db.exec(`set role postgres;
    revoke myth_identity_governor from postgres granted by postgres;
    reset role`);
  await packetPass(db);
  await rejected(db,'grant myth_identity_governor to postgres with set true granted by supabase_admin',/identity governor/);
  await rejected(db,'grant myth_identity_governor to postgres with inherit true granted by supabase_admin',/identity governor/);
  await rejected(db,'grant myth_v23_parent_preview to myth_identity_governor with set true',/identity governor|Unexpected reverse membership/);
 }finally{await db.close();}
}
export async function platformAclCases(originalDb){const db=new PGlite({database:'postgres',loadDataDir:await originalDb.dumpDataDir(),extensions:{btree_gist,pgcrypto}});
 try{const pin=(await originalDb.query("select current_setting('v23.binding_id') bid,current_setting('v23.network_entity_id') eid,current_setting('v23.binding_provenance_ref') provenance")).rows[0];
  await db.query("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false),set_config('v23.binding_id',$1,false),set_config('v23.network_entity_id',$2,false),set_config('v23.binding_provenance_ref',$3,false)",[pin.bid,pin.eid,pin.provenance]);
  await db.exec(`create view extensions.pg_stat_statements as select 1 fixture;
    create view extensions.pg_stat_statements_info as select 1 fixture;
    grant select on extensions.pg_stat_statements,extensions.pg_stat_statements_info to public`);
  assert.deepEqual((await db.query("select has_table_privilege('myth_v23_parent_preview','extensions.pg_stat_statements','SELECT') object_access,has_schema_privilege('myth_v23_parent_preview','extensions','USAGE') schema_access")).rows[0],{object_access:true,schema_access:false});
  await packetPass(db);
  await rejected(db,'grant usage on schema extensions to public',/Raw table\/column access|Runtime pg_stat schema access/);
  await installFixture(db);await assert.rejects(db.exec(sql('assertions.sql')),/requires pg_net and schema net absent/);await db.exec('rollback');
  await db.exec('drop extension pg_net;drop schema if exists net');await packetPass(db);
  await rejected(db,'create schema net',/requires pg_net and schema net absent/);
  await rejected(db,'create schema net;create function net.http_get(text,jsonb,jsonb,integer) returns bigint language sql as $$select 1::bigint$$',/requires pg_net and schema net absent/);
  await rejected(db,'grant myth_identity_governor to postgres with admin false,inherit false,set true',/identity governor/);
  await governorMembershipCases(originalDb);
  await installFixture(db);await db.exec("set v23.pg_net_disable_authorized='true'");
  assert.ok((await db.exec(sql('pg-net-preflight.sql'))).some(x=>x.rows?.some(y=>y.result==='V23_PG_NET_PREFLIGHT_PASS')));
  assert.ok((await db.exec(sql('pg-net-disable.sql'))).some(x=>x.rows?.some(y=>y.result==='V23_PG_NET_DISABLE_PASS')));await packetPass(db);
  await db.exec("set v23.pg_net_reenable_authorized='true'");await db.exec(sql('pg-net-reenable.sql'));
  await assert.rejects(db.exec(sql('assertions.sql')),/requires pg_net and schema net absent/);await db.exec('rollback');
  await db.exec(sql('pg-net-disable.sql'));await packetPass(db);await closeoutPacket(db);
  console.log('PASS pg_net absence: lifecycle, governor capability negatives, clean teardown preservation');
 }finally{await db.close();}assert.equal((await originalDb.query("select to_regnamespace('net') is null absent")).rows[0].absent,true);}
