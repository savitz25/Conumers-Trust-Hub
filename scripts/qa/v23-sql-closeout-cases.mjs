// Disposable local PGlite/PostgreSQL packet cases only. No connection strings,
// credentials, hosted clients or network access. Imported by the existing local
// PostgreSQL harness; never execute this harness without local-test authorization.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
export async function assertionFailureCases(db) {
  await db.exec(sql('assertions.sql')); // A positive control must pass FIRST.
  const bid = "(current_setting('v23.binding_id')::uuid)";
  const eid = "(current_setting('v23.network_entity_id')::uuid)";
  const cases = [
    ['missing binding', `delete from network.network_entity_bindings where id=${bid}`, /query returned no rows/],
    ['wrong approved entity ID', "select set_config('v23.network_entity_id',gen_random_uuid()::text,true)", /query returned no rows/],
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
    ['public private wrapper', 'grant execute on function v23_private.preview_confirmation(text,text,jsonb) to public', /Public private-preview wrapper execution/],
    ['authenticated private wrapper', 'grant execute on function v23_private.preview_saved(uuid,uuid) to authenticated', /Public private-preview wrapper execution/],
    ['wrong pin', "update v23_private.preview_deployment_pin set ask_origin='https://wrong.invalid'", /Exact deployment pin/],
    ['wrong staging origins', "update ops.consumer_hub_registry set staging_origins=array['https://wrong.invalid'] where hub_key='move'", /Exact Ask\/Move staging origins/],
    ['missing registry row', "delete from ops.consumer_hub_registry where hub_key='ask'", /Exact Ask\/Move staging origins/],
    ['ready false', "create or replace function v23_private.preview_ports_ready() returns boolean language sql as $$select false$$", /Required private ports are not ready/],
    ['wrong resolver ID', "create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select gen_random_uuid(),gen_random_uuid(),'accepted'::text$$", /Private resolver disagrees/],
    ['empty resolver', "create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select null::uuid,null::uuid,'accepted'::text where false$$", /Private resolver must return exactly one/],
    ['duplicate resolver', "create or replace function v23_private.preview_move_binding() returns table(id uuid,network_entity_id uuid,binding_status text) language sql as $$select gen_random_uuid(),gen_random_uuid(),'accepted'::text from generate_series(1,2)$$", /Private resolver must return exactly one/],
  ];
  const ports = ['preview_ports_ready()','preview_confirmation(text,text,jsonb)','preview_session_live(uuid,uuid)',
    'preview_move_binding()','preview_projects(uuid,uuid)','preview_saved(uuid,uuid)','preview_issue_context(jsonb,uuid,uuid)'];
  for (const port of ports) cases.push(['missing ' + port, `alter function v23_private.${port} rename to hidden_packet_port`, /Required private port missing/]);
  cases.push(['authorizer missing EXECUTE', 'revoke execute on function v23_private.preview_saved(uuid,uuid) from myth_v23_authorizer', /Required private ports are not ready/]);
  for (const [label, mutation, expected] of cases) {
    try { await rejected(db, mutation, 'assertions.sql', expected); }
    catch (error) { throw new Error('Assertion negative case: ' + label, { cause: error }); }
  }
  await db.exec(sql('assertions.sql'));
  console.log('PASS packet: ' + cases.length + ' fail-closed assertion negative cases and positive controls');
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
