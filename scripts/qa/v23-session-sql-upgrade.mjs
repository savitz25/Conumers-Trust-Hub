// Disposable in-memory PostgreSQL only. No URL, network client, or hosted credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { sessionMac, sessionMacKey } from '../../lib/my-trusthub/profile-save/session-authority.ts';

const root = 'docs/my-trusthub/v2/final-parent-wiring/';
const sql = name => readFileSync(root + name, 'utf8');
const old = readFileSync('scripts/qa/fixtures/v23-session-authority-old.sql', 'utf8');
const shared = text => text.split('-- BEGIN SHARED SESSION READINESS CONTRACT')[1].split('-- END SHARED SESSION READINESS CONTRACT')[0];
assert.equal(shared(sql('ports-forward.sql')), shared(sql('session-authority-forward.sql')));
for (const name of ['ports-forward.sql', 'session-authority-forward.sql', 'session-authority-rollback.sql']) {
  assert.match(sql(name), /preview_session_live\(subject uuid, session uuid\)/);
}
const bootstrap = new PGlite(), cluster = await bootstrap.dumpDataDir();
await bootstrap.close();
const db = new PGlite({ database:'postgres', loadDataDir:cluster, extensions:{btree_gist,pgcrypto} });
const pem = generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'}).toString();
const install = () => db.query("select set_config('v23.install_session_mac',$1,false)", [sessionMacKey(pem).toString('hex')]);
const ready = async () => {
  const actor=(await db.query('select session_user actor')).rows[0].actor;
  await db.exec('set session authorization local_test_root; set role myth_v23_authorizer');
  try { return (await db.query('select v23_private.preview_ports_ready() ready')).rows[0].ready; }
  finally { await db.exec('reset role; set session authorization '+actor); }
};
const memberships = async () => (await db.query(`select roleid,member,grantor,admin_option,inherit_option,set_option
  from pg_auth_members order by roleid,member,grantor`)).rows;
const objects = async () => (await db.query(`select proname from pg_proc where pronamespace='v23_private'::regnamespace
  and proname like 'preview_session_%' order by proname`)).rows.map(r=>r.proname);
let negatives = 0;
try {
  await db.exec(`create role local_test_root superuser login; create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
    alter table auth.sessions enable row level security; alter table auth.sessions force row level security;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  for (const name of ['20260907160000_my_trusthub_identity_foundation.sql','20260907190000_my_trusthub_saved_projects_guest_import.sql',
    '20260907220000_my_trusthub_cross_hub_handoffs.sql','20260919205200_my_trusthub_v23_transaction_capability.sql']) {
    await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
  }
  await db.exec("set v23.approved_project='xkkiicsassizmakcvxml'");
  // Hosted visibility: regprocedure display is not a schema-qualified SQL dependency.
  await db.exec('set search_path=extensions,public');
  assert.equal((await db.query("select to_regprocedure('extensions.hmac(bytea,bytea,text)')::text sig")).rows[0].sig,'hmac(bytea,bytea,text)');
  await assert.rejects(db.exec(`create function public.old_hmac_visibility(message text,secret bytea,mac bytea)
    returns boolean language sql set search_path=pg_catalog as
    $$select hmac(convert_to(message,'UTF8'),secret,'sha256')=mac$$`), e=>e.code==='42883');
  console.log('PASS hosted-like OLD bare hmac construction fails 42883 with extensions visible');
  await db.exec(sql('ports-forward.sql'));
  await db.exec(sql('runtime-role-forward.sql'));
  assert.equal(await ready(),false,'clean install cannot be ready before key installation');
  await db.query('select v23_private.preview_session_install_mac($1)',[sessionMacKey(pem)]);
  assert.equal(await ready(),true,'complete clean install');
  console.log('PASS clean install: compatible names; no MAC row => FALSE; installed MAC => TRUE');

  // Establish the exact OLD predicate/readiness definitions, not a renamed approximation.
  await db.exec(`drop function v23_private.preview_session_authority_ready();
    drop function v23_private.preview_session_bind(uuid,uuid,bigint,bytea);
    drop function v23_private.preview_session_install_mac(bytea);
    drop function v23_private.preview_session_mac_matches(text,bytea,bytea);
    drop table v23_private.preview_session_attestations;
    drop table v23_private.preview_session_mac;
    drop function v23_private.preview_ports_ready(); drop function v23_private.preview_session_live(uuid,uuid);`);
  await db.exec(old);
  await db.exec('alter function v23_private.preview_session_live(uuid,uuid) owner to myth_v23_foundation');
  const oldLive = (await db.query("select pg_get_functiondef('v23_private.preview_session_live(uuid,uuid)'::regprocedure) body")).rows[0].body;
  const oldReady = (await db.query("select pg_get_functiondef('v23_private.preview_ports_ready()'::regprocedure) body")).rows[0].body;
  // Model the managed operator: schema owner/CREATEROLE, NOINHERIT, not superuser.
  await db.exec(`set session authorization local_test_root;
    create role local_packet_operator login nosuperuser noinherit createrole bypassrls;
    alter schema v23_private owner to local_packet_operator;
    alter function v23_private.preview_ports_ready() owner to local_packet_operator;
    grant select on v23_private.preview_deployment_pin to local_packet_operator;
    grant myth_v23_foundation to local_packet_operator with admin true,inherit false,set false;
    set session authorization local_packet_operator`);
  const beforeMemberships = await memberships();
  await db.exec('set session authorization local_test_root');
  await assert.rejects(db.exec(`create or replace function v23_private.preview_session_live(p_subject uuid,p_session uuid)
    returns boolean language sql as $$select false$$`), e=>e.code==='42P13');
  console.log('PASS before-patch 42P13 reproduction against exact OLD installed names');
  await db.exec('set session authorization local_packet_operator');

  await db.exec('set search_path=extensions,public');
  await install();
  await db.exec(sql('session-authority-forward.sql'));
  assert.equal(await ready(),true);
  assert.deepEqual(await memberships(),beforeMemberships,'no persistent operator capability membership');
  assert.equal((await db.query("select proargnames from pg_proc where oid='v23_private.preview_session_live(uuid,uuid)'::regprocedure")).rows[0].proargnames.join(','),'subject,session');
  const subject='11111111-1111-4111-8111-111111111111', session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const expiry=Math.floor(Date.now()/1000)+90;
  await db.exec('set session authorization local_test_root; set role myth_v23_authorizer');
  await db.query('select v23_private.preview_session_bind($1,$2,$3,$4)',[subject,session,expiry,sessionMac(pem,subject,session,expiry)]);
  assert.equal((await db.query('select v23_private.preview_session_live($1,$2) live',[subject,session])).rows[0].live,true);
  await db.exec('reset role');
  console.log('PASS OLD -> FORWARD; new attestation predicate active; complete readiness TRUE');
  for (const path of ['extensions,public','pg_catalog,public']) {
    await db.exec('set session authorization local_packet_operator; set search_path='+path);
    await install(); await db.exec(sql('session-authority-forward.sql'));
    assert.equal(await ready(),true);
    await db.exec('set session authorization local_test_root; set role myth_v23_authorizer');
    await db.query('select v23_private.preview_session_bind($1,$2,$3,$4)',[subject,session,expiry,sessionMac(pem,subject,session,expiry)]);
    assert.equal((await db.query('select v23_private.preview_session_live($1,$2) live',[subject,session])).rows[0].live,true);
    await db.exec('reset role');
  }
  console.log('PASS repaired forward and actual MAC binding with extensions visible and absent from caller search_path');


  const cases = [
    ['missing exact HMAC dependency', 'alter function extensions.hmac(bytea,bytea,text) rename to hidden_hmac'],
    ['only public HMAC dependency', `alter function extensions.hmac(bytea,bytea,text) set schema public`],
    ['missing MAC table', 'drop table v23_private.preview_session_mac'],
    ['missing attestation table', 'drop table v23_private.preview_session_attestations'],
    ['missing MAC row','delete from v23_private.preview_session_mac'],
    ['invalid MAC length',"alter table v23_private.preview_session_mac drop constraint preview_session_mac_key_check; update v23_private.preview_session_mac set key=decode('aa','hex')"],
    ['invalid singleton', 'alter table v23_private.preview_session_mac drop constraint preview_session_mac_singleton_check; update v23_private.preview_session_mac set singleton=false'],
    ['extra singleton', 'alter table v23_private.preview_session_mac drop constraint preview_session_mac_singleton_check; insert into v23_private.preview_session_mac values(false,decode(repeat(\'aa\',32),\'hex\'))'],
    ['runtime role INHERIT','alter role myth_v23_parent_preview inherit'],
    ['runtime extra capability','grant myth_v23_cleanup to myth_v23_parent_preview'],
    ['runtime missing executor','revoke myth_v23_executor from myth_v23_parent_preview'],
    ['missing deployment pin','delete from v23_private.preview_deployment_pin'],
    ['legacy transport RLS','alter table v23_private.preview_transport_records disable row level security'],
  ];
  for (const table of ['preview_session_mac','preview_session_attestations']) {
    for (const [label, mutation] of [
      ['RLS','disable row level security'],['FORCE RLS','no force row level security'],['owner','owner to postgres'],
    ]) cases.push([`${table} ${label}`,`alter table v23_private.${table} ${mutation}`]);
    for (const role of ['public','anon','authenticated','myth_v23_parent_preview','myth_v23_authorizer','myth_v23_executor']) {
      cases.push([`${table} SELECT ${role}`,`grant select on v23_private.${table} to ${role}`]);
    }
    cases.push([`${table} column privilege`,`grant select(${table==='preview_session_mac'?'key':'subject'}) on v23_private.${table} to myth_v23_parent_preview`]);
  }
  const funcs=['preview_session_mac_matches(text,bytea,bytea)','preview_session_install_mac(bytea)',
    'preview_session_bind(uuid,uuid,bigint,bytea)','preview_session_live(uuid,uuid)','preview_session_authority_ready()'];
  for (const fn of funcs) {
    cases.push([`${fn} missing`,`alter function v23_private.${fn} rename to hidden_session_function`]);
    cases.push([`${fn} owner`,`alter function v23_private.${fn} owner to postgres`]);
    cases.push([`${fn} security mode`,`alter function v23_private.${fn} security ${fn.startsWith('preview_session_mac_matches')?'definer':'invoker'}`]);
    for (const role of ['public','anon','authenticated','myth_v23_parent_preview']) {
      cases.push([`${fn} EXECUTE ${role}`,`grant execute on function v23_private.${fn} to ${role}`]);
    }
  }
  cases.push(['missing authorizer bind privilege','revoke execute on function v23_private.preview_session_bind(uuid,uuid,bigint,bytea) from myth_v23_authorizer']);
  cases.push(['missing executor live privilege','revoke execute on function v23_private.preview_session_live(uuid,uuid) from myth_v23_executor']);
  cases.push(['executor mint privilege','grant execute on function v23_private.preview_session_bind(uuid,uuid,bigint,bytea) to myth_v23_executor']);
  cases.push(['authorizer installer privilege','grant execute on function v23_private.preview_session_install_mac(bytea) to myth_v23_authorizer']);
  for (const [label,mutation] of cases) {
    await db.exec('begin');
    try { await db.exec(mutation); assert.equal(await ready(),false,label); negatives++; }
    finally { await db.exec('rollback'); }
    assert.equal(await ready(),true,`${label}: restored positive control`);
  }
  console.log(`PASS ${negatives} readiness negative cases, each with restored positive control`);
  // Public-only dependency cannot satisfy the forward installation guard either.
  await db.exec('alter function extensions.hmac(bytea,bytea,text) set schema public');
  await db.exec('set session authorization local_packet_operator');
  await install();
  await assert.rejects(db.exec(sql('session-authority-forward.sql')),/Required session dependency extensions.hmac/);
  await db.exec('rollback; set session authorization local_test_root');
  assert.equal(await ready(),false);
  await db.exec('alter function public.hmac(bytea,bytea,text) set schema extensions');
  assert.equal(await ready(),true);
  console.log('PASS public-only HMAC: readiness FALSE and forward dependency guard refuses atomically');
  await db.exec('set session authorization local_packet_operator');
  await db.exec(sql('session-authority-rollback.sql'));
  assert.equal((await db.query("select pg_get_functiondef('v23_private.preview_session_live(uuid,uuid)'::regprocedure) body")).rows[0].body.includes('auth.sessions'),true);
  assert.equal((await db.query("select proargnames from pg_proc where oid='v23_private.preview_session_live(uuid,uuid)'::regprocedure")).rows[0].proargnames.join(','),'subject,session');
  assert.equal((await db.query("select pg_get_functiondef('v23_private.preview_ports_ready()'::regprocedure) body")).rows[0].body,oldReady);
  assert.deepEqual(await objects(),['preview_session_live']);
  assert.equal((await db.query("select count(*)::int n from pg_class where relnamespace='v23_private'::regnamespace and relname in ('preview_session_mac','preview_session_attestations')")).rows[0].n,0);
  assert.deepEqual(await memberships(),beforeMemberships);
  assert.equal((await db.query("select has_any_column_privilege('myth_v23_foundation',(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='sessions'),'SELECT') allowed")).rows[0].allowed,false);
  assert.match(oldLive,/auth.sessions/);
  console.log('PASS OLD -> FORWARD -> ROLLBACK: compatible parameters; old readiness; no new objects/memberships or Auth grants');
  await install(); await db.exec(sql('session-authority-forward.sql')); assert.equal(await ready(),true);
  await install(); await db.exec(sql('session-authority-forward.sql')); assert.equal(await ready(),true);
  console.log('PASS OLD -> FORWARD -> ROLLBACK -> FORWARD and forward reapply');
  await db.query("select set_config('v23.install_session_mac',$1,false)",['00'.repeat(32)]);
  await assert.rejects(db.exec(sql('session-authority-forward.sql')),/differs from the installed key/);
  await db.exec('rollback');
  assert.equal(await ready(),true,'wrong install material must not replace the stored key');
  assert.deepEqual(await memberships(),beforeMemberships,'failed repair leaves no temporary memberships');
  for (const name of ['session-authority-forward.sql','session-authority-rollback.sql']) {
    await db.exec("set v23.approved_project='qvvxvbcdmbjzrgvwjatw'");
    await assert.rejects(db.exec(sql(name)),/Explicit isolated apply authorization required/);
    await db.exec('rollback');
    await db.exec("set v23.approved_project='xkkiicsassizmakcvxml'");
    assert.equal(await ready(),true);
  }
  console.log('PASS wrong install key and wrong project guards: atomic refusal; valid state preserved');
} catch(e) { console.error('LOCAL SESSION SQL FAIL',e.message,e.code,e.where); process.exitCode=1; }
finally { await db.close(); }
