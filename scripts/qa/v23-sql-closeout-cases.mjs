// Disposable local PGlite/PostgreSQL packet cases only. No connection strings,
// credentials, hosted clients or network access. Imported by the existing local
// PostgreSQL harness; never execute this harness without local-test authorization.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const packet = 'docs/my-trusthub/v2/final-parent-wiring/';
const sql = name => readFileSync(packet + name, 'utf8');
const body = name => sql(name).replace(/^begin(?: isolation level serializable)?(?: read only)?;$/gm, '').replace(/^commit;$/gm, '');
async function rejected(db, mutation, file, expected) {
  await db.exec('begin');
  try {
    await db.exec(mutation);
    await assert.rejects(db.exec(body(file)), expected);
  } finally { await db.exec('rollback'); }
}
export async function createPacketBinding(db) {
  await db.exec(`set v23.binding_creation_authorized='true';
    set v23bind.candidate_unchanged='true';
    set v23bind.evidence_ref='local-sql-packet-fixture-only';
    select set_config('v23bind.preflight_checked_at',clock_timestamp()::text,false);`);
  const result = await db.exec(sql('move-binding-forward.sql'));
  const applied = result.flatMap(r => r.rows || []).find(r => r.binding_id && r.network_entity_id);
  assert.ok(applied, 'actual forward SQL must return binding and entity IDs');
  await db.query("select set_config('v23.binding_id',$1,false),set_config('v23.network_entity_id',$2,false),set_config('v23.binding_provenance_ref',$3,false)",
    [applied.binding_id, applied.network_entity_id, 'local-sql-packet-fixture-only']);
  await assert.rejects(db.exec(sql('move-binding-forward.sql')), /Existing identity requires steward review/);
  await db.exec('rollback');
  const counts = await db.query("select count(*)::int n from network.network_entity_bindings where specialist_entity_id='usdot-1002530'");
  assert.equal(counts.rows[0].n, 1);
  console.log('PASS packet: exact forward creation and duplicate rejection');
}
// Supabase's grantor is its bootstrap administrator. Reproduce that identity
// only inside a separate disposable PGlite clone; never change a
// hosted role or manufacture pg_auth_members rows with catalog DML.
async function reverseMembershipCases(originalDb) {
  const db = new PGlite({ database:'postgres',loadDataDir:await originalDb.dumpDataDir(),extensions:{ btree_gist,pgcrypto } });
  const pin = (await originalDb.query("select current_setting('v23.binding_id') binding_id,current_setting('v23.network_entity_id') entity_id,current_setting('v23.binding_provenance_ref') provenance")).rows[0];
  await db.query("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false),set_config('v23.binding_id',$1,false),set_config('v23.network_entity_id',$2,false),set_config('v23.binding_provenance_ref',$3,false)",[pin.binding_id,pin.entity_id,pin.provenance]);
  const outgoingQuery = `select g.rolname,m.admin_option,m.inherit_option,m.set_option
    from pg_auth_members m join pg_roles g on g.oid=m.roleid
    where m.member=(select oid from pg_roles where rolname='myth_v23_parent_preview') order by g.rolname`;
  const before = (await db.query(outgoingQuery)).rows;
  assert.deepEqual(before, [
    { rolname:'myth_v23_authorizer',admin_option:false,inherit_option:false,set_option:true },
    { rolname:'myth_v23_executor',admin_option:false,inherit_option:false,set_option:true },
  ]);
  await db.exec('begin');
  try {
    await db.exec(`create role v23_fixture_admin superuser nologin;
      set session authorization v23_fixture_admin;
      alter role postgres rename to supabase_admin;
      create role postgres nologin noinherit nosuperuser nobypassrls;
      grant myth_v23_parent_preview to postgres with admin true,inherit false,set false granted by supabase_admin;`);
    const reverse = (await db.query(`select member_role.rolname member,granted_role.rolname granted_role,
      grantor_role.rolname grantor,m.admin_option,m.inherit_option,m.set_option
      from pg_auth_members m join pg_roles member_role on member_role.oid=m.member
      join pg_roles granted_role on granted_role.oid=m.roleid join pg_roles grantor_role on grantor_role.oid=m.grantor
      where granted_role.rolname='myth_v23_parent_preview'`)).rows;
    assert.deepEqual(reverse, [{ member:'postgres',granted_role:'myth_v23_parent_preview',
      grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false }]);
    const passed = await db.exec(body('assertions.sql'));
    assert.ok(passed.some(result => result.rows?.some(row => row.result==='V23_PARENT_PACKET_ASSERTIONS_PASS')));
    assert.deepEqual((await db.query(outgoingQuery)).rows, before);
    const cases = [
      ['other member', `revoke myth_v23_parent_preview from postgres granted by supabase_admin;
        grant myth_v23_parent_preview to anon with admin true,inherit false,set false granted by supabase_admin;`, /Unexpected reverse membership/],
      ['other grantor', `alter role supabase_admin rename to v23_fixture_wrong_grantor;
        create role supabase_admin nologin;`, /Unexpected reverse membership/],
      ['reverse SET true', 'grant myth_v23_parent_preview to postgres with set true granted by supabase_admin', /Unexpected reverse membership/],
      ['reverse INHERIT true', 'grant myth_v23_parent_preview to postgres with inherit true granted by supabase_admin', /Unexpected reverse membership/],
      ['reverse ADMIN false', 'grant myth_v23_parent_preview to postgres with admin false granted by supabase_admin', /Unexpected reverse membership/],
      ['additional reverse row', 'grant myth_v23_parent_preview to anon with admin true,inherit false,set false granted by supabase_admin', /Unexpected reverse membership/],
      ['extra outgoing membership', 'grant myth_v23_cleanup to myth_v23_parent_preview with admin false,inherit false,set true', /Unexpected runtime memberships/],
      ['outgoing ADMIN true', 'grant myth_v23_authorizer to myth_v23_parent_preview with admin true', /Unexpected runtime memberships/],
      ['outgoing INHERIT true', 'grant myth_v23_authorizer to myth_v23_parent_preview with inherit true', /Unexpected runtime memberships/],
      ['outgoing SET false', 'grant myth_v23_authorizer to myth_v23_parent_preview with set false', /Unexpected runtime memberships/],
      ['missing outgoing membership', 'revoke myth_v23_executor from myth_v23_parent_preview', /Unexpected runtime memberships/],
    ];
    for (const [label, mutation, expected] of cases) {
      await db.exec('savepoint reverse_membership_case');
      try {
        await db.exec(mutation);
        await assert.rejects(db.exec(body('assertions.sql')), expected);
      } catch (error) { throw new Error('Reverse membership case: ' + label + ': ' + error.message, { cause:error }); }
      finally { await db.exec('rollback to savepoint reverse_membership_case;release savepoint reverse_membership_case'); }
    }
    const restored = await db.exec(body('assertions.sql'));
    assert.ok(restored.some(result => result.rows?.some(row => row.result==='V23_PARENT_PACKET_ASSERTIONS_PASS')));
    assert.deepEqual((await db.query(outgoingQuery)).rows, before);
    console.log('PASS reverse membership: exact hosted row permitted; ' + cases.length + ' altered reverse/outgoing cases rejected; outgoing memberships unchanged');
  } finally { await db.close(); }
  assert.equal((await originalDb.query("select count(*)::int n from pg_auth_members where roleid=(select oid from pg_roles where rolname='myth_v23_parent_preview')")).rows[0].n,0);
  assert.equal((await originalDb.query("select count(*)::int n from pg_roles where rolname in ('supabase_admin','v23_fixture_admin','v23_fixture_wrong_grantor')")).rows[0].n,0);
  assert.deepEqual((await originalDb.query(outgoingQuery)).rows, before);
  await originalDb.exec(sql('assertions.sql'));
  console.log('PASS reverse membership: zero-row local case; separate fixture database discarded');
}
export async function assertionFailureCases(db) {
  await db.exec(sql('assertions.sql')); // A positive control must pass FIRST.
  await reverseMembershipCases(db);
  const bid = "(current_setting('v23.binding_id')::uuid)";
  const eid = "(current_setting('v23.network_entity_id')::uuid)";
  const cases = [
    ['missing binding', `delete from network.network_entity_bindings where id=${bid}`, /query returned no rows/],
    ['wrong approved entity ID', "select set_config('v23.network_entity_id',gen_random_uuid()::text,true)", /query returned no rows/],
    ['binding points to another entity', `with e as (insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction) values('organization','Wrong binding target','move','US') returning id) update network.network_entity_bindings set network_entity_id=(select id from e) where id=${bid}`, /Exact current accepted forward binding/],
    ['missing forward provenance', "set local v23.binding_provenance_ref='different'", /Exact current accepted forward binding/],
    ...['hub','specialist_entity_type','specialist_entity_id','identifier_namespace','source_identifier','jurisdiction','binding_status'].map((field, i) =>
      ['binding ' + field, `update network.network_entity_bindings set ${field}='${['insurance','carrier','usdot-other','other.id','2002530','CA','review_required'][i]}' where id=${bid}`, /Exact current accepted forward binding/]),
    ...['entity_type','canonical_name','primary_hub','jurisdiction','status','canonical_public_profile_ref'].map((field,i) =>
      ['entity ' + field, `update network.network_entities set ${field}='${['carrier','Competing name','insurance','CA','retired','/wrong-profile'][i]}' where id=${eid}`, /Exact active canonical entity/]),
    ['ended lifetime', `update network.network_entity_bindings set valid_to=clock_timestamp() where id=${bid}`, /Exact current accepted forward binding/],
    ['competing canonical name', "insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction) values('organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US')", /Exactly one canonical Move identity/],
    ['competing canonical profile', "insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref) values('organization','Other','move','US','/companies/hindman-isaacs-moving-storage-inc')", /Exactly one canonical Move identity/],
    ['future overlapping specialist binding', `insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref) values(${eid},'move','carrier','usdot-1002530','other.id','other','CA','accepted',now()+interval '1 day','fixture')`, /Overlapping accepted Move\/regulator binding/],
    ['cross-hub regulator overlap', `insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref) values(${eid},'insurance','carrier','other','fmcsa.usdot','1002530','CA','accepted',now()+interval '1 day','fixture')`, /Overlapping accepted Move\/regulator binding/],
    ['unsafe login', 'alter role myth_v23_parent_preview bypassrls', /Unexpected runtime role attributes/],
    ['connection limit', 'alter role myth_v23_parent_preview connection limit 7', /Unexpected runtime role attributes/],
    ['unexpected membership', 'grant myth_v23_cleanup to myth_v23_parent_preview with inherit false,set true', /Unexpected runtime memberships/],
    ['nested membership', 'grant myth_v23_cleanup to myth_v23_authorizer', /Unexpected nested membership/],
    ['direct column grant', 'grant select(id) on auth.users to myth_v23_parent_preview', /Unexpected direct runtime grants/],
    ['PUBLIC raw column access', 'grant select(id) on auth.users to public', /Raw table\/column access/],
    ['PUBLIC raw sequence access', 'grant select on sequence network.identity_governance_events_id_seq to public', /Raw sequence access/],
    ['public private wrapper', 'grant execute on function v23_private.preview_confirmation(text,text,jsonb) to public', /Public private-preview wrapper execution/],
    ['authenticated private wrapper', 'grant execute on function v23_private.preview_saved(uuid,uuid) to authenticated', /Public private-preview wrapper execution/],
    ['wrong pin', "update v23_private.preview_deployment_pin set ask_origin='https://wrong.invalid'", /Exact deployment pin/],
    ['wrong staging origins', "update ops.consumer_hub_registry set staging_origins=array['https://wrong.invalid'] where hub_key='move'", /Exact Ask\/Move staging origins/],
    ['missing registry row', "delete from ops.consumer_hub_registry where hub_key='ask'", /Exact Ask\/Move staging origins/],
  ];
  const ports = ['preview_ports_ready()','preview_confirmation(text,text,jsonb)','preview_session_live(uuid,uuid)',
    'preview_move_binding()','preview_projects(uuid,uuid)','preview_saved(uuid,uuid)','preview_issue_context(jsonb,uuid,uuid)'];
  for (const port of ports) cases.push(['missing ' + port, `alter function v23_private.${port} rename to hidden_packet_port`, /Required private port missing/]);
  for (const [label, mutation, expected] of cases) {
    try { await rejected(db, mutation, 'assertions.sql', expected); }
    catch (error) { throw new Error('Assertion negative case: ' + label, { cause: error }); }
  }
  await db.exec(sql('assertions.sql'));
  console.log('PASS packet: ' + cases.length + ' fail-closed assertion negative cases and positive controls');
  await phase5ContextCases(db);
}
async function resetOperator(db) {
  try { await db.exec('rollback'); } catch { /* no open transaction */ }
  await db.exec('set session authorization postgres');
}
async function phase5ContextCases(db) {
  const pin = (await db.query("select current_setting('v23.approved_project') approved, current_setting('v23.binding_id') binding_id, current_setting('v23.network_entity_id') entity_id")).rows[0];
  await db.exec(`create schema if not exists extensions;
    create table if not exists extensions.pg_stat_statements(id int);
    create table if not exists extensions.pg_stat_statements_info(id int);
    revoke all on schema extensions from public;
    revoke all on all tables in schema extensions from public;
    create role v23_packet_operator noinherit nosuperuser bypassrls nologin;
    grant usage on schema network, ops, v23_private, auth, consumer, public to v23_packet_operator;
    grant select on all tables in schema network, ops, v23_private, auth, consumer, public to v23_packet_operator;`);
  await db.exec('set session authorization v23_packet_operator');
  try {
    const passed = await db.exec(sql('assertions.sql'));
    assert.ok(passed.some(result => result.rows?.some(row => row.result==='V23_PARENT_PACKET_ASSERTIONS_PASS')));
    console.log('PASS operator regression: inspector marker without runtime authority');
    await assert.rejects(db.exec('set role myth_v23_authorizer'), error => error.code==='42501' || /permission denied to set role/i.test(error.message));
    console.log('PASS operator SET ROLE denial');
  } finally { await resetOperator(db); }
  await db.exec('grant myth_v23_authorizer to v23_packet_operator with admin false, inherit false, set true');
  await db.exec('set session authorization v23_packet_operator');
  try {
    await db.exec('set role myth_v23_authorizer');
    assert.equal((await db.query('select current_user u')).rows[0].u, 'myth_v23_authorizer');
    await db.exec('reset role');
  } finally { await resetOperator(db); }
  await db.exec('revoke myth_v23_authorizer from v23_packet_operator');
  await db.exec('set session authorization v23_packet_operator');
  try {
    await assert.rejects(db.exec('set role myth_v23_authorizer'), error => error.code==='42501' || /permission denied to set role/i.test(error.message));
  } finally { await resetOperator(db); }
  async function asRuntime(fn) {
    await db.exec('set session authorization myth_v23_parent_preview');
    await db.query("select set_config('v23.approved_project',$1,false),set_config('v23.binding_id',$2,false),set_config('v23.network_entity_id',$3,false)", [pin.approved, pin.binding_id, pin.entity_id]);
    try { return await fn(); }
    finally { await resetOperator(db); }
  }
  const runtime = await asRuntime(() => db.exec(sql('platform-runtime-probes.sql')));
  assert.ok(runtime.some(result => result.rows?.some(row => row.result==='V23_PLATFORM_RUNTIME_PROBES_PASS')));
  console.log('PASS runtime authorizer SET, executor SET, cleanup denial, and binding resolver match');
  await db.exec('set session authorization v23_packet_operator');
  try {
    await assert.rejects(db.exec(sql('platform-runtime-probes.sql')), /Fresh independently pinned runtime login required/);
  } finally { await resetOperator(db); }
  await db.exec('set session authorization myth_v23_parent_preview');
  try {
    await db.exec('set role myth_v23_authorizer');
    await assert.rejects(db.exec(body('platform-runtime-probes.sql')), /Fresh independently pinned runtime login required/);
    await db.exec('reset role');
  } finally { await resetOperator(db); }
  console.log('PASS wrong-principal runtime probe negatives');
  const runtimeNegatives = [
    ['runtime cannot SET authorizer', 'revoke myth_v23_authorizer from myth_v23_parent_preview', /permission denied to set role "myth_v23_authorizer"/],
    ['runtime cannot SET executor', 'revoke myth_v23_executor from myth_v23_parent_preview', /permission denied to set role "myth_v23_executor"/],
    ['runtime can SET cleanup', 'grant myth_v23_cleanup to myth_v23_parent_preview with admin false, inherit false, set true', /Unrelated SET ROLE accepted/],
    ['wrong resolver ID', "create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select gen_random_uuid(),gen_random_uuid(),'accepted'::text$$", /Private resolver disagrees/],
    ['wrong resolver entity', `create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select '${pin.binding_id}'::uuid,gen_random_uuid(),'accepted'::text$$`, /Private resolver disagrees/],
    ['resolver status not accepted', `create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select '${pin.binding_id}'::uuid,'${pin.entity_id}'::uuid,'review_required'::text$$`, /Private resolver disagrees/],
    ['empty resolver', "create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select null::uuid,null::uuid,'accepted'::text where false$$", /Private resolver must return exactly one/],
    ['duplicate resolver', "create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select gen_random_uuid(),gen_random_uuid(),'accepted'::text from generate_series(1,2)$$", /Private resolver must return exactly one/],
    ['ready false', 'create or replace function v23_private.preview_ports_ready() returns boolean language sql as $$select false$$', /Required private ports are not ready/],
    ['authorizer missing EXECUTE', 'revoke execute on function v23_private.preview_saved(uuid,uuid) from myth_v23_authorizer', /Required private ports are not ready/],
  ];
  for (const [label, mutation, expected] of runtimeNegatives) {
    await db.exec('begin');
    try {
      await db.exec(mutation);
      await db.exec('set session authorization myth_v23_parent_preview');
      await db.query("select set_config('v23.approved_project',$1,true),set_config('v23.binding_id',$2,true),set_config('v23.network_entity_id',$3,true)", [pin.approved, pin.binding_id, pin.entity_id]);
      await assert.rejects(db.exec(body('platform-runtime-probes.sql')), expected);
    } catch (error) { throw new Error('Runtime negative case: ' + label, { cause: error }); }
    finally { await resetOperator(db); }
  }
  const restored = await asRuntime(() => db.exec(sql('platform-runtime-probes.sql')));
  assert.ok(restored.some(result => result.rows?.some(row => row.result==='V23_PLATFORM_RUNTIME_PROBES_PASS')));
  await db.exec(`drop owned by v23_packet_operator;
    drop role v23_packet_operator;
    drop table if exists extensions.pg_stat_statements, extensions.pg_stat_statements_info;`);
  console.log('PASS runtime negative cases: ' + runtimeNegatives.length);
}
export async function closeoutPacket(db) {
  await db.exec(`set v23.binding_retirement_authorized='true';
    set v23.parent_teardown_authorized='true';set v23.closeout_writers_drained='true'`);
  await db.exec(sql('teardown-preconditions.sql'));
  const cases = [
    ["set local v23.binding_retirement_authorized='false'", /Separate isolated binding retirement authorization/],
    ["set local v23.approved_project='wrong'", /Separate isolated binding retirement authorization/],
    ["select set_config('v23.binding_id',gen_random_uuid()::text,true)", /Forward IDs\/provenance differ/],
    ["select set_config('v23.network_entity_id',gen_random_uuid()::text,true)", /Forward IDs\/provenance differ/],
    ["update network.network_entity_bindings set specialist_entity_type='carrier' where id=current_setting('v23.binding_id')::uuid", /Exact live forward binding/],
    ["update network.network_entities set canonical_name='Other' where id=current_setting('v23.network_entity_id')::uuid", /Exact active forward canonical entity/],
    ["insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction) values('organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US')", /Competing canonical Move identity/],
    ["with e as (insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction) values('organization','Other redirect target','move','US') returning id) insert into network.network_entity_redirects(from_entity_id,to_entity_id,reason) select current_setting('v23.network_entity_id')::uuid,id,'fixture forbidden redirect' from e", /Redirected identity cannot be retired/],
    ["insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref) values(current_setting('v23.network_entity_id')::uuid,'move','mover','other','other.id','other','US','review_required',now(),'fixture')", /Ambiguous binding/],
  ];
  for (const [mutation, expected] of cases) await rejected(db, mutation, 'move-binding-teardown.sql', expected);
  await db.exec(sql('move-binding-teardown.sql'));
  const ended = (await db.query("select binding_status,valid_to from network.network_entity_bindings where id=current_setting('v23.binding_id')::uuid")).rows[0];
  assert.equal(ended.binding_status, 'accepted'); assert.ok(ended.valid_to);
  await db.exec('begin;set local role myth_v23_authorizer');
  assert.equal((await db.query('select * from v23_private.preview_move_binding()')).rows.length,0);
  await db.exec('rollback');
  await assert.rejects(db.exec(sql('move-binding-teardown.sql')), /Exact live forward binding/);
  await db.exec('rollback');
  await db.exec(sql('teardown.sql'));
  await db.exec(sql('teardown-assertions.sql'));
  const postCases = [
    ['create role myth_v23_parent_preview login', /Preview login\/reader role remains/],
    ['create function v23_private.preview_leak() returns boolean language sql as $$select true$$', /Preview-specific wrapper remains/],
    ['create table v23_private.preview_orphan(id int)', /Preview transport\/pin\/baseline object remains/],
    ['grant myth_v23_cleanup to myth_v23_authorizer', /Role attributes, memberships, ownership or grants/],
    ['grant select on consumer.consumer_saved_entities to anon', /Role attributes, memberships, ownership or grants/],
    ["update ops.consumer_hub_registry set staging_origins=array['https://wrong.invalid'] where hub_key='ask'", /staging origins were not restored exactly/],
    ['delete from consumer.consumer_saved_entities', /Protected research\/receipt rows changed/],
    ["update consumer.consumer_projects set name='Same count, changed research'", /Protected research\/receipt rows changed/],
    ["delete from ops.v23_profile_runtime_records where kind='receipt'", /Protected research\/receipt rows changed/],
    ["update network.network_entities set status='active' where id=current_setting('v23.network_entity_id')::uuid", /lifecycle differs/],
    ["update network.network_entity_bindings set valid_to=null where id=current_setting('v23.binding_id')::uuid", /lifecycle differs/],
  ];
  for (const [mutation, expected] of postCases) await rejected(db, mutation, 'teardown-assertions.sql', expected);
  await db.exec(sql('teardown-assertions.sql'));
  console.log('PASS packet: guarded lifecycle retirement, replay rejection, full teardown, preserved research/receipts, ' + postCases.length + ' post-teardown negative cases');
}
