// Local embedded PostgreSQL only. Proves the insurance state-license binding
// rollback closes one receipt at a time, proves Packet 15 rollback drops only
// the frozen three-hub issuer, then proves the current production packet
// sequence returns to the three-hub baseline with and without Saved research.
// Nothing here contacts a hosted database, creates a key, or applies production SQL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const BASELINE_FP = '691e2f2e05426c60af8fa3a54f38eac9';
const PACKET19_FP = '17f464ad69f3d8c7a89dd2cf9229f112';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const INSURANCE_ROLLBACK = '13-ask-prod-insurance-state-license-binding-rollback.sql';
const insuranceRollback = read(INSURANCE_ROLLBACK);
assert.doesNotMatch(insuranceRollback, /variable_conflict/i);
assert.doesNotMatch(insuranceRollback, /^\s*delete\b/im);
assert.match(insuranceRollback, /v_jurisdiction/);
assert.match(insuranceRollback, /v_license/);
assert.match(insuranceRollback, /v_binding_id/);
assert.match(insuranceRollback, /v_network_entity_id/);
assert.match(insuranceRollback, /b\.jurisdiction = v_jurisdiction/);
assert.match(insuranceRollback, /b\.source_identifier = v_license/);
assert.doesNotMatch(insuranceRollback, /\bdeclare[\s\S]*?\bjurisdiction text\b/);
assert.equal(createHash('sha256').update(insuranceRollback).digest('hex'), '6511d47087fff62c2fb4a290c339a52427d0d1809c9fa5dcf232a4e30d8769c9');

const HUB_ROLLBACK = '15-ask-prod-hub-account-context-rollback.sql';
const HUB = 'v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)';
const MOVE_ISSUER = 'v23_private.prod_issue_context(jsonb,uuid,uuid)';
const hubRollback = read(HUB_ROLLBACK);
assert.equal(createHash('sha256').update(hubRollback).digest('hex'), '964887905744d06586f4ce27e52a4e90e77dc466a4e3a48372ac962f31b1ad71');
assert.doesNotMatch(hubRollback, /drop\s+function[\s\S]{0,200}cascade/i);
assert.match(hubRollback, /body is distinct from frozen/);
assert.doesNotMatch(hubRollback, /md5\(regexp_replace\(body/);
assert.doesNotMatch(hubRollback, /regexp_replace\(frozen/);
assert.match(hubRollback, /acldefault\('f', p\.proowner\)/);
assert.match(hubRollback, /function acl drifted/);
assert.match(hubRollback, /installed shared issuer is not the frozen packet 15 body/);
assert.match(hubRollback, /nothing to remove/);
assert.match(hubRollback, /owner, security, or acl drifted/);
assert.match(hubRollback, /signature drifted/);
assert.match(hubRollback, /'https:\/\/www\.lendertrusthub\.com'\n/);
assert.doesNotMatch(hubRollback, /lendertrusthub\.com '/);
assert.doesNotMatch(hubRollback, /\brevoke\b/i);
assert.doesNotMatch(hubRollback, /\bgrant execute\b/i);
assert.doesNotMatch(hubRollback, /v23_private\.authority\(\)/);
assert.doesNotMatch(hubRollback, /seniortrusthub\.com/);

const migrations = [
  '20260907160000_my_trusthub_identity_foundation.sql',
  '20260907190000_my_trusthub_saved_projects_guest_import.sql',
  '20260907220000_my_trusthub_cross_hub_handoffs.sql',
  '20260919205200_my_trusthub_v23_transaction_capability.sql',
  '20261003170000_my_trusthub_saved_project_ids.sql',
];

async function clear(db) {
  try { await db.exec('rollback'); } catch { /* no open transaction */ }
}
async function apply(db, file) {
  try { await db.exec(read(file)); }
  catch (error) {
    await clear(db);
    throw new Error(`${file}: ${error.code ?? ''} ${error.message}`);
  }
}
async function refuse(db, file, pattern) {
  let caught = null;
  try { await db.exec(read(file)); }
  catch (error) { caught = error; }
  await clear(db);
  assert.ok(caught, `${file} succeeded and was expected to hold`);
  assert.match(`${caught.code ?? ''} ${caught.message}`, pattern);
  return caught;
}
async function fingerprint(db) {
  const row = (await db.query(`select md5(regexp_replace(prosrc, '\\s+', '', 'g')) as fp, prosecdef
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0];
  assert.equal(row.prosecdef, false);
  return row.fp;
}
async function authorityState(db) {
  return (await db.query(`select current_setting('v23.network_authority_state', true) as state,
    current_setting('v23.network_authority_hubs', true) as hubs`)).rows[0];
}
async function bindings(db) {
  return (await db.query(`select b.id::text as id, b.hub, b.specialist_entity_id, b.valid_to is null as open, e.status
    from network.network_entity_bindings b
    join network.network_entities e on e.id = b.network_entity_id
    order by b.hub, b.specialist_entity_id, b.id`)).rows;
}
function changed(before, after) {
  const beforeById = new Map(before.map(row => [row.id, row]));
  const afterById = new Map(after.map(row => [row.id, row]));
  const diffs = [];
  for (const [id, row] of beforeById) {
    const next = afterById.get(id);
    if (!next || next.open !== row.open || next.status !== row.status || next.hub !== row.hub || next.specialist_entity_id !== row.specialist_entity_id) {
      diffs.push({ id, before: row, after: next ?? null });
    }
  }
  for (const [id, row] of afterById) if (!beforeById.has(id)) diffs.push({ id, before: null, after: row });
  return diffs;
}
async function saved(db) {
  return (await db.query(`select id::text, user_id::text, network_entity_id::text, removed_at::text, row_version
    from consumer.consumer_saved_entities order by id`)).rows;
}
async function naic(db) {
  return (await db.query(`select id::text, identifier_namespace, specialist_entity_type, source_identifier, valid_to::text
    from network.network_entity_bindings
    where identifier_namespace = 'naic' or specialist_entity_type = 'legal_insurer'
    order by id`)).rows;
}
async function entities(db) {
  return (await db.query(`select id::text, primary_hub, status, canonical_name, canonical_public_profile_ref
    from network.network_entities order by primary_hub, canonical_public_profile_ref`)).rows;
}
async function watchTables(db) {
  return (await db.query(`select count(*)::int as n from information_schema.tables
    where table_schema in ('consumer','ops','network','v23_private') and table_name ~* '(watch|alert)'`)).rows[0].n;
}
async function hubMeta(db) {
  return (await db.query(`select pg_get_function_identity_arguments(p.oid) as args,
      md5(regexp_replace(p.prosrc, '\\s+', '', 'g')) as body_md5,
      p.prosecdef, p.provolatile::text as volatile_kind, p.proowner::regrole::text as owner,
      regexp_replace(coalesce(array_to_string(p.proconfig, ','), ''), '\\s+', '', 'g') as config,
      l.lanname,
      has_function_privilege('public', p.oid, 'EXECUTE') as public_exec,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
      has_function_privilege('myth_v23_executor', p.oid, 'EXECUTE') as executor_exec,
      has_function_privilege('myth_v23_authorizer', p.oid, 'EXECUTE') as authorizer_exec,
      has_schema_privilege('myth_v23_foundation', 'v23_private', 'CREATE') as foundation_create
    from pg_proc p
    join pg_language l on l.oid = p.prolang
    where p.oid = to_regprocedure($1)`, [HUB])).rows[0] ?? null;
}
async function moveIssuerMeta(db) {
  return (await db.query(`select md5(regexp_replace(prosrc, '\\s+', '', 'g')) as body_md5,
      prosecdef, proowner::regrole::text as owner, provolatile::text as volatile_kind,
      regexp_replace(coalesce(array_to_string(proconfig, ','), ''), '\\s+', '', 'g') as config
    from pg_proc where oid = to_regprocedure($1)`, [MOVE_ISSUER])).rows[0] ?? null;
}
async function contextCounts(db) {
  return (await db.query(`select
    (select count(*)::int from ops.consumer_auth_handoffs) as handoffs,
    (select count(*)::int from ops.consumer_browser_handoff_intents) as intents,
    (select count(*)::int from ops.consumer_handoff_events) as events`)).rows[0];
}
async function researchSnapshot(db) {
  return {
    savedRows: (await db.query(`select id::text, user_id::text, network_entity_id::text, source_binding_id::text,
      identity_resolution_state, source_hub, source_context::text, saved_at::text, updated_at::text, removed_at::text, row_version
      from consumer.consumer_saved_entities order by id`)).rows,
    projects: (await db.query(`select id::text, user_id::text, creation_key::text, name, life_event_type, status,
      location_context::text, target_date::text, created_at::text, updated_at::text, completed_at::text, archived_at::text, row_version
      from consumer.consumer_projects order by id`)).rows,
    memberships: (await db.query(`select project_id::text, saved_entity_id::text, added_at::text, removed_at::text,
      project_role, created_at::text, updated_at::text, row_version
      from consumer.consumer_project_saved_entities order by project_id, saved_entity_id`)).rows,
    notes: (await db.query(`select id::text, user_id::text, client_request_id::text, project_id::text, saved_entity_id::text,
      note_type, body, created_at::text, updated_at::text, row_version
      from consumer.consumer_notes order by id`)).rows,
  };
}
const RESOLVERS = [
  'v23_private.prod_move_binding()',
  'v23_private.prod_lender_nmls_binding_for(text)',
  'v23_private.prod_insurance_state_license_binding_for(text)',
  'v23_private.prod_investor_crd_binding_for(text)',
  'v23_private.prod_contractor_dbpr_binding_for(text)',
  'v23_private.prod_senior_ccn_binding_for(text)',
];
async function resolverPresence(db) {
  const rows = [];
  for (const name of RESOLVERS) rows.push({ name, present: await present(db, name) });
  return rows;
}
async function preservation(db) {
  return {
    hub: await hubMeta(db),
    move: await moveIssuerMeta(db),
    investor: await present(db, 'v23_private.prod_investor_issue_context(jsonb,uuid,uuid)'),
    authority: await fingerprint(db),
    bindings: await bindings(db),
    entities: await entities(db),
    research: await researchSnapshot(db),
    contexts: await contextCounts(db),
    naic: await naic(db),
    watch: await watchTables(db),
    resolvers: await resolverPresence(db),
  };
}
async function installSavedResearch(db) {
  const fl = (await db.query(`select binding_id::text as binding_id, network_entity_id::text as network_entity_id
    from pg_temp.v23insurance_receipt where jurisdiction = 'FL'`)).rows[0];
  const userId = '11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users(id) values ($1)', [userId]);
  await db.query(`insert into consumer.consumer_saved_entities
    (user_id, network_entity_id, source_binding_id, identity_resolution_state, source_hub, source_context)
    values ($1::uuid, $2::uuid, $3::uuid, 'accepted', 'insurance', '{"fixture":"local-saved-research"}'::jsonb)
    returning id`, [userId, fl.network_entity_id, fl.binding_id]);
  const savedId = (await db.query('select id from consumer.consumer_saved_entities where user_id = $1::uuid', [userId])).rows[0].id;
  await db.query(`insert into consumer.consumer_projects (user_id, creation_key, name, life_event_type)
    values ($1::uuid, '22222222-2222-4222-8222-222222222222', 'Local insurance research', 'protecting')`, [userId]);
  const projectId = (await db.query('select id from consumer.consumer_projects where user_id = $1::uuid', [userId])).rows[0].id;
  await db.query(`insert into consumer.consumer_project_saved_entities (project_id, saved_entity_id, project_role)
    values ($1, $2, 'compare')`, [projectId, savedId]);
  await db.query(`insert into consumer.consumer_notes
    (user_id, client_request_id, project_id, saved_entity_id, note_type, body)
    values ($1::uuid, '33333333-3333-4333-8333-333333333333', $2, $3, 'research', 'Local fixture note on the Florida license')`,
    [userId, projectId, savedId]);
}
async function present(db, signature) {
  return (await db.query('select to_regprocedure($1) is not null as present', [signature])).rows[0].present;
}
async function quiet(db) {
  await db.query('select 1 as probe');
  const tx = (await db.query('select txid_current_if_assigned() as tx')).rows[0].tx;
  assert.equal(tx, null);
}
async function rowsOf(db, sql) {
  return (await db.query(sql)).rows;
}
async function loadReceipt(db, gucs, row) {
  for (const [column, name] of Object.entries(gucs)) {
    await db.query('select set_config($1, $2, false)', [name, String(row[column])]);
  }
}

const bootstrap = new PGlite();
const emptyCluster = await bootstrap.dumpDataDir();
await bootstrap.close();
const seededDb = new PGlite({ database: 'postgres', loadDataDir: emptyCluster, extensions: { btree_gist, pgcrypto } });
await seededDb.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth; create table auth.users(id uuid primary key);
  create table auth.sessions(id uuid primary key, user_id uuid references auth.users, not_after timestamptz);
  alter table auth.sessions enable row level security; alter table auth.sessions force row level security;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb$$;`);
for (const file of migrations) await seededDb.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
await seededDb.exec(`select set_config('v23.approved_project', '${PRODUCTION}', false)`);
await apply(seededDb, '02-ask-prod-ports-forward.sql');
await seededDb.exec(`set v23.binding_creation_authorized='true'; set v23bind.candidate_unchanged='true'; set v23bind.evidence_ref='local-sql-packet-fixture-only';
  select set_config('v23bind.preflight_checked_at', clock_timestamp()::text, false);`);
await apply(seededDb, '03-ask-prod-move-binding-forward.sql');
await seededDb.exec('reset role');
await apply(seededDb, '04-ask-prod-runtime-role-forward.sql');
await seededDb.query('select set_config($1, $2, false)', ['v23.install_session_mac', createHash('sha256').update('local-fixture-not-a-production-key').digest('hex')]);
await apply(seededDb, '05-ask-prod-session-mac-install.sql');
await apply(seededDb, '09-ask-prod-move-binding-resolver-forward.sql');
await apply(seededDb, '06-ask-prod-readiness.sql');
const seeded = await seededDb.dumpDataDir();
await seededDb.close();

async function open() {
  const db = new PGlite({ database: 'postgres', loadDataDir: seeded, extensions: { btree_gist, pgcrypto } });
  await db.exec(`select set_config('v23.approved_project', '${PRODUCTION}', false)`);
  return db;
}

const insuranceGucs = {
  jurisdiction: 'v23insurance.jurisdiction',
  license: 'v23insurance.license',
  binding_id: 'v23insurance.binding_id',
  network_entity_id: 'v23insurance.network_entity_id',
  canonical_public_profile_ref: 'v23insurance.canonical_public_profile_ref',
};

async function insuranceForward(db) {
  await db.exec(`set v23bind.nmls_consumer_access_checked='true'`);
  await apply(db, '12-ask-prod-lender-nmls-binding-forward.sql');
  await db.exec(`set v23bind.insurance_state_license_checked='true'`);
  await apply(db, '13-ask-prod-insurance-state-license-binding-forward.sql');
  return rowsOf(db, `select jurisdiction, license, binding_id::text as binding_id, network_entity_id::text as network_entity_id,
    canonical_public_profile_ref from pg_temp.v23insurance_receipt order by jurisdiction`);
}

const receiptDb = await open();
try {
  const receipts = await insuranceForward(receiptDb);
  assert.deepEqual(receipts.map(row => [row.jurisdiction, row.license, row.canonical_public_profile_ref]), [
    ['FL', 'L106287', '/providers/asfin-llc-l106287'],
    ['OH', '19068455', '/providers/j-a-sandoval-llc-19068455'],
    ['TX', '1365714', '/providers/imt-services-llc-1365714'],
  ]);
  console.log(`INSURANCE_RECEIPTS ${JSON.stringify(receipts)}`);
  const savedBefore = await saved(receiptDb);
  const naicBefore = await naic(receiptDb);
  const entitiesBefore = await entities(receiptDb);
  const watchBefore = await watchTables(receiptDb);
  assert.equal(savedBefore.length, 0);
  assert.equal(watchBefore, 0);
  assert.equal(await present(receiptDb, 'v23_private.prod_insurance_state_license_binding_for(text)'), true);

  for (const [index, receipt] of receipts.entries()) {
    const before = await bindings(receiptDb);
    await loadReceipt(receiptDb, insuranceGucs, receipt);
    await apply(receiptDb, INSURANCE_ROLLBACK);
    const diffs = changed(before, await bindings(receiptDb));
    assert.equal(diffs.length, 1, JSON.stringify(diffs));
    assert.equal(diffs[0].id, receipt.binding_id);
    assert.equal(diffs[0].before.open, true);
    assert.equal(diffs[0].after.open, false);
    assert.equal(diffs[0].after.status, 'active');
    const resolved = (await receiptDb.query(`select count(*)::int as n from v23_private.prod_insurance_state_license_binding_for($1)`,
      [`state-license:${receipt.jurisdiction}:${receipt.license}`])).rows[0].n;
    assert.equal(resolved, 0);
    console.log(`RECEIPT_${index + 1}_ROLLBACK PASS ${receipt.jurisdiction} ${receipt.license} ${receipt.binding_id}`);
    if (index === 0) {
      const held = await bindings(receiptDb);
      const heldSaved = await saved(receiptDb);
      const heldNaic = await naic(receiptDb);
      await loadReceipt(receiptDb, insuranceGucs, receipt);
      const refusal = await refuse(receiptDb, INSURANCE_ROLLBACK, /Rollback must close exactly one binding from the supplied receipt row, closed 0/);
      assert.equal(refusal.code, 'P0001');
      assert.deepEqual(await bindings(receiptDb), held);
      assert.deepEqual(await saved(receiptDb), heldSaved);
      assert.deepEqual(await naic(receiptDb), heldNaic);
      console.log('RECEIPT_1_SECOND_ROLLBACK HOLD');
    }
  }
  const closed = await bindings(receiptDb);
  assert.deepEqual(closed.filter(row => row.hub === 'insurance').map(row => row.open), [false, false, false]);
  assert.equal(closed.filter(row => row.hub === 'lender' && row.open).length, 3);
  assert.equal(closed.filter(row => row.hub === 'move' && row.open).length, 1);
  assert.deepEqual(await saved(receiptDb), savedBefore);
  assert.deepEqual(await naic(receiptDb), naicBefore);
  assert.deepEqual(await entities(receiptDb), entitiesBefore);
  assert.equal(await watchTables(receiptDb), watchBefore);
  assert.equal((await receiptDb.query('select count(*)::int as n from v23_private.prod_move_binding()')).rows[0].n, 1);
  await quiet(receiptDb);
  console.log('SAVED_RESEARCH_UNCHANGED PASS');
  console.log('WATCH_UNCHANGED PASS');
  console.log('INSURANCE_RECEIPT_ROLLBACK_OK');
} finally {
  await receiptDb.close();
}

const absent = await open();
try {
  const before = await preservation(absent);
  assert.equal(before.hub, null);
  assert.ok(before.move);
  const missing = await refuse(absent, HUB_ROLLBACK, /V23_PROD_HUB_CONTEXT_ROLLBACK_PRECONDITION_FAIL: nothing to remove/);
  assert.equal(missing.code, 'P0001');
  assert.deepEqual(await preservation(absent), before);
  console.log('MISSING_FUNCTION_REFUSED PASS');
} finally {
  await absent.close();
}

const exact = await open();
try {
  await apply(exact, '15-ask-prod-hub-account-context-forward.sql');
  const before = await preservation(exact);
  assert.equal(before.hub.owner, 'myth_v23_foundation');
  assert.equal(before.hub.prosecdef, true);
  assert.equal(before.hub.volatile_kind, 'v');
  assert.equal(before.hub.lanname, 'plpgsql');
  assert.equal(before.hub.config, 'search_path=pg_catalog,v23_private,ops');
  assert.equal(before.hub.public_exec, false);
  assert.equal(before.hub.anon_exec, false);
  assert.equal(before.hub.authenticated_exec, false);
  assert.equal(before.hub.executor_exec, false);
  assert.equal(before.hub.authorizer_exec, true);
  assert.equal(before.hub.foundation_create, false);
  assert.equal(before.hub.args.replace(/\s+/g, ''), 'proofjsonb,subjectuuid,sessionuuid,p_hubtext');
  await apply(exact, HUB_ROLLBACK);
  assert.equal(await present(exact, HUB), false);
  assert.equal(await present(exact, MOVE_ISSUER), true);
  assert.equal(await present(exact, 'v23_private.prod_investor_issue_context(jsonb,uuid,uuid)'), false);
  assert.deepEqual(await moveIssuerMeta(exact), before.move);
  assert.deepEqual(await bindings(exact), before.bindings);
  assert.deepEqual(await entities(exact), before.entities);
  assert.deepEqual(await researchSnapshot(exact), before.research);
  assert.deepEqual(await contextCounts(exact), before.contexts);
  assert.equal(await fingerprint(exact), before.authority);
  console.log('PACKET15_EXACT_PREDECESSOR_GUARD PASS');
} finally {
  await exact.close();
}

const seniorDb = await open();
try {
  await apply(seniorDb, '15-ask-prod-hub-account-context-forward.sql');
  const packet15 = await hubMeta(seniorDb);
  const packet15Source = (await seniorDb.query('select prosrc from pg_proc where oid = to_regprocedure($1)', [HUB])).rows[0].prosrc;
  await apply(seniorDb, '18-ask-prod-senior-hub-context-preflight.sql');
  await apply(seniorDb, '18-ask-prod-senior-hub-context-forward.sql');
  const before = await preservation(seniorDb);
  assert.notEqual(before.hub.body_md5, packet15.body_md5);
  await refuse(seniorDb, HUB_ROLLBACK, /installed shared issuer is not the frozen packet 15 body/);
  assert.deepEqual(await preservation(seniorDb), before);
  console.log('PACKET18_BODY_REFUSED_WITHOUT_CHANGE PASS');
  await apply(seniorDb, '18-ask-prod-senior-hub-context-rollback.sql');
  assert.equal((await seniorDb.query('select prosrc from pg_proc where oid = to_regprocedure($1)', [HUB])).rows[0].prosrc, packet15Source);
  assert.deepEqual(await hubMeta(seniorDb), packet15);
  await apply(seniorDb, HUB_ROLLBACK);
  assert.equal(await present(seniorDb, HUB), false);
  assert.equal(await present(seniorDb, MOVE_ISSUER), true);
  assert.deepEqual(await moveIssuerMeta(seniorDb), before.move);
  assert.deepEqual(await bindings(seniorDb), before.bindings);
  assert.deepEqual(await entities(seniorDb), before.entities);
  assert.deepEqual(await researchSnapshot(seniorDb), before.research);
  assert.deepEqual(await contextCounts(seniorDb), before.contexts);
  assert.equal(await fingerprint(seniorDb), before.authority);
  console.log('PACKET18_THEN15_ROLLBACK PASS');
} finally {
  await seniorDb.close();
}

const unknown = await open();
try {
  await apply(unknown, '15-ask-prod-hub-account-context-forward.sql');
  await unknown.exec(`create or replace function v23_private.prod_hub_issue_context(proof jsonb, subject uuid, session uuid, p_hub text)
    returns boolean language plpgsql security definer set search_path = pg_catalog, v23_private, ops as $body$
    begin
      raise exception 'unknown body' using errcode = '42501';
    end
    $body$`);
  const before = await preservation(unknown);
  await refuse(unknown, HUB_ROLLBACK, /installed shared issuer is not the frozen packet 15 body/);
  assert.deepEqual(await preservation(unknown), before);
  assert.equal(await present(unknown, HUB), true);
  console.log('UNKNOWN_BODY_REFUSED_WITHOUT_CHANGE PASS');
} finally {
  await unknown.close();
}

const drifted = await open();
try {
  await apply(drifted, '15-ask-prod-hub-account-context-forward.sql');
  await drifted.exec('alter function v23_private.prod_hub_issue_context(jsonb, uuid, uuid, text) security invoker');
  const before = await preservation(drifted);
  assert.equal(before.hub.prosecdef, false);
  await refuse(drifted, HUB_ROLLBACK, /owner, security, or acl drifted/);
  assert.deepEqual(await preservation(drifted), before);
  assert.equal(await present(drifted, HUB), true);
  console.log('SECURITY_METADATA_REFUSED_WITHOUT_CHANGE PASS');
} finally {
  await drifted.close();
}

const acl = await open();
try {
  await apply(acl, '15-ask-prod-hub-account-context-forward.sql');
  await acl.exec('revoke execute on function v23_private.prod_hub_issue_context(jsonb, uuid, uuid, text) from myth_v23_authorizer');
  const before = await preservation(acl);
  assert.equal(before.hub.authorizer_exec, false);
  assert.equal(before.hub.prosecdef, true);
  const removedGrant = await refuse(acl, HUB_ROLLBACK, /function acl drifted/);
  assert.equal(removedGrant.code, 'P0001');
  assert.deepEqual(await preservation(acl), before);
  assert.equal(await present(acl, HUB), true);
  console.log('REMOVED_GRANT_REFUSED PASS');
} finally {
  await acl.close();
}

async function hubSource(db) {
  return (await db.query('select prosrc, proacl::text as proacl from pg_proc where oid = to_regprocedure($1)', [HUB])).rows[0] ?? null;
}
async function replaceHubSource(db, prosrc) {
  await db.exec(`create or replace function v23_private.prod_hub_issue_context(proof jsonb,subject uuid,session uuid,p_hub text) returns boolean
    language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $body$${prosrc}$body$`);
}
async function refuseHeld(label, mutate, pattern) {
  const db = await open();
  try {
    await apply(db, '15-ask-prod-hub-account-context-forward.sql');
    await mutate(db);
    const before = await preservation(db);
    const sourceBefore = await hubSource(db);
    assert.ok(sourceBefore);
    const refusal = await refuse(db, HUB_ROLLBACK, pattern);
    assert.equal(refusal.code, 'P0001');
    assert.deepEqual(await hubSource(db), sourceBefore);
    assert.deepEqual(await preservation(db), before);
    assert.equal(await present(db, HUB), true);
    console.log(`${label} PASS`);
  } finally {
    await db.close();
  }
}
const reviewedSource = await (async () => {
  const db = await open();
  try {
    await apply(db, '15-ask-prod-hub-account-context-forward.sql');
    return (await hubSource(db)).prosrc;
  } finally {
    await db.close();
  }
})();
await refuseHeld('EXTRA_SERVICE_ROLE_GRANT_REFUSED', async db => {
  await db.exec(`grant execute on function ${HUB} to service_role`);
}, /function acl drifted/);
await refuseHeld('UNRELATED_ROLE_GRANT_REFUSED', async db => {
  await db.exec('create role gb2_acl_probe nologin');
  await db.exec(`grant execute on function ${HUB} to gb2_acl_probe`);
}, /function acl drifted/);
await refuseHeld('PUBLIC_EXECUTE_REFUSED', async db => {
  await db.exec(`grant execute on function ${HUB} to public`);
}, /function acl drifted/);
await refuseHeld('GRANT_OPTION_REFUSED', async db => {
  await db.exec(`grant execute on function ${HUB} to myth_v23_authorizer with grant option`);
}, /function acl drifted/);
await refuseHeld('NULL_ACL_REFUSED', async db => {
  await db.exec(`update pg_proc set proacl = null where oid = to_regprocedure('${HUB}')`);
  const raw = await hubSource(db);
  assert.equal(raw.proacl, null);
}, /function acl drifted/);
await refuseHeld('LENDER_TRAILING_SPACE_REFUSED', async db => {
  const changed = reviewedSource.replace("'https://www.lendertrusthub.com'", "'https://www.lendertrusthub.com '");
  assert.notEqual(changed, reviewedSource);
  await replaceHubSource(db, changed);
}, /not the frozen packet 15 body/);
await refuseHeld('LENDER_LEADING_SPACE_REFUSED', async db => {
  await replaceHubSource(db, reviewedSource.replace("'https://www.lendertrusthub.com'", "' https://www.lendertrusthub.com'"));
}, /not the frozen packet 15 body/);
await refuseHeld('INSURANCE_ORIGIN_REFUSED', async db => {
  await replaceHubSource(db, reviewedSource.replace('https://www.insurancetrusthub.com', 'https://www.insurancetrusthub.com.example'));
}, /not the frozen packet 15 body/);
await refuseHeld('CONTRACTOR_ORIGIN_REFUSED', async db => {
  await replaceHubSource(db, reviewedSource.replace('https://www.contractortrusthub.com', 'https://contractor.example'));
}, /not the frozen packet 15 body/);
await refuseHeld('CHANGED_EXCEPTION_REFUSED', async db => {
  await replaceHubSource(db, reviewedSource.replace("errcode='42501'", "errcode='42502'"));
}, /not the frozen packet 15 body/);
await refuseHeld('FORMATTING_REFUSED', async db => {
  await replaceHubSource(db, reviewedSource.replace('\nbegin\n', '\nbegin\n -- formatting\n'));
}, /not the frozen packet 15 body/);
await refuseHeld('WRONG_OWNER_REFUSED', async db => {
  await db.exec(`alter function ${HUB} owner to service_role`);
}, /owner, security, or acl drifted/);
await refuseHeld('SEARCH_PATH_REFUSED', async db => {
  await db.exec(`alter function ${HUB} set search_path = pg_catalog`);
}, /owner, security, or acl drifted/);

// Reverse order required by the packets, which matches the operator list:
// 19 first, because its rollback replaces authority() only while the installed
// body is the packet 19 body. Binding rollbacks do not read authority() and do
// not depend on each other, so lender, insurance, investor, contractor, senior
// stay in that order. Packet 18 must precede packet 15: 18 requires the
// four-hub prod_hub_issue_context body and restores the three-hub body, and 15
// drops the function. Packet 18's issuer md5 checks are snapshots taken inside
// the packet 18 rollback transaction, so packet 19 can roll back first.
// Investor context rollback drops only prod_investor_issue_context and is last.
async function proveNetwork(label, withResearch) {
  const networkDb = await open();
  try {
  assert.equal(await fingerprint(networkDb), BASELINE_FP);
  await apply(networkDb, '12-ask-prod-lender-nmls-preflight.sql');
  await apply(networkDb, '13-ask-prod-insurance-state-license-preflight.sql');
  await apply(networkDb, '14-ask-prod-investor-crd-preflight.sql');
  await apply(networkDb, '16-ask-prod-contractor-dbpr-preflight.sql');
  await apply(networkDb, '17-ask-prod-senior-ccn-preflight.sql');
  await apply(networkDb, '19-ask-prod-network-authority-preflight.sql');
  assert.deepEqual(await authorityState(networkDb), { state: 'baseline', hubs: 'move,insurance,lender' });

  await networkDb.exec(`set v23bind.nmls_consumer_access_checked='true'`);
  await apply(networkDb, '12-ask-prod-lender-nmls-binding-forward.sql');
  await networkDb.exec(`set v23bind.insurance_state_license_checked='true'`);
  await apply(networkDb, '13-ask-prod-insurance-state-license-binding-forward.sql');
  await apply(networkDb, '15-ask-prod-hub-account-context-forward.sql');
  await apply(networkDb, '18-ask-prod-senior-hub-context-preflight.sql');
  await apply(networkDb, '18-ask-prod-senior-hub-context-forward.sql');
  await apply(networkDb, '14-ask-prod-investor-context-forward.sql');
  await networkDb.exec(`set v23bind.sec_iapd_checked='true'`);
  await apply(networkDb, '14-ask-prod-investor-crd-binding-forward.sql');
  await networkDb.exec(`set v23bind.contractor_dbpr_checked='true'`);
  await apply(networkDb, '16-ask-prod-contractor-dbpr-binding-forward.sql');
  await networkDb.exec(`set v23bind.senior_ccn_checked='true'`);
  await apply(networkDb, '17-ask-prod-senior-ccn-binding-forward.sql');
  await apply(networkDb, '19-ask-prod-network-authority-preflight.sql');
  assert.deepEqual(await authorityState(networkDb), { state: 'baseline', hubs: 'move,insurance,lender' });
  assert.equal(await fingerprint(networkDb), BASELINE_FP);
  await apply(networkDb, '19-ask-prod-network-authority-forward.sql');
  assert.equal(await fingerprint(networkDb), PACKET19_FP);
  const openCounts = await networkDb.query(`select hub, count(*)::int as n, count(*) filter (where valid_to is null)::int as open
    from network.network_entity_bindings group by hub order by hub`);
  assert.deepEqual(openCounts.rows, [
    { hub: 'contractor', n: 3, open: 3 },
    { hub: 'insurance', n: 3, open: 3 },
    { hub: 'investor', n: 3, open: 3 },
    { hub: 'lender', n: 3, open: 3 },
    { hub: 'move', n: 1, open: 1 },
    { hub: 'senior', n: 3, open: 3 },
  ]);
  assert.equal(await present(networkDb, 'v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'), true);
  assert.equal(await present(networkDb, 'v23_private.prod_investor_issue_context(jsonb,uuid,uuid)'), true);
  console.log(`FULL_NETWORK_FORWARD ${label} PASS ${PACKET19_FP}`);

  if (withResearch) await installSavedResearch(networkDb);
  const researchBefore = await researchSnapshot(networkDb);
  const watchBefore = await watchTables(networkDb);
  const naicBefore = await naic(networkDb);
  const entitiesBefore = await entities(networkDb);
  const moveBefore = await moveIssuerMeta(networkDb);
  const resolversBefore = await resolverPresence(networkDb);
  assert.equal(watchBefore, 0);
  assert.equal(researchBefore.savedRows.length, withResearch ? 1 : 0);
  assert.equal(researchBefore.projects.length, withResearch ? 1 : 0);
  assert.equal(researchBefore.memberships.length, withResearch ? 1 : 0);
  assert.equal(researchBefore.notes.length, withResearch ? 1 : 0);
  if (withResearch) {
    assert.equal(researchBefore.savedRows[0].source_hub, 'insurance');
    assert.equal(researchBefore.notes[0].note_type, 'research');
    assert.equal(researchBefore.memberships[0].project_role, 'compare');
    assert.equal(researchBefore.projects[0].life_event_type, 'protecting');
  }

  await apply(networkDb, '19-ask-prod-network-authority-rollback.sql');
  assert.equal(await fingerprint(networkDb), BASELINE_FP);
  const stillOpen = await bindings(networkDb);
  assert.equal(stillOpen.filter(row => row.open).length, 16);

  const closers = [
    ['lender', 'pg_temp.v23lender_receipt', 'nmls', {
      nmls: 'v23lender.nmls', binding_id: 'v23lender.binding_id', network_entity_id: 'v23lender.network_entity_id',
      canonical_public_profile_ref: 'v23lender.canonical_public_profile_ref',
    }, '12-ask-prod-lender-nmls-binding-rollback.sql'],
    ['insurance', 'pg_temp.v23insurance_receipt', 'jurisdiction', insuranceGucs, INSURANCE_ROLLBACK],
    ['investor', 'pg_temp.v23investor_receipt', 'crd::bigint', {
      crd: 'v23investor.crd', binding_id: 'v23investor.binding_id', network_entity_id: 'v23investor.network_entity_id',
      canonical_public_profile_ref: 'v23investor.canonical_public_profile_ref',
    }, '14-ask-prod-investor-crd-binding-rollback.sql'],
    ['contractor', 'pg_temp.v23contractor_receipt', 'external_key', {
      external_key: 'v23contractor.external_key', binding_id: 'v23contractor.binding_id', network_entity_id: 'v23contractor.network_entity_id',
      canonical_public_profile_ref: 'v23contractor.canonical_public_profile_ref',
    }, '16-ask-prod-contractor-dbpr-binding-rollback.sql'],
    ['senior', 'pg_temp.v23senior_receipt', 'ccn', {
      ccn: 'v23senior.ccn', binding_id: 'v23senior.binding_id', network_entity_id: 'v23senior.network_entity_id',
      canonical_public_profile_ref: 'v23senior.canonical_public_profile_ref',
    }, '17-ask-prod-senior-ccn-binding-rollback.sql'],
  ];
  let closedReceipts = 0;
  for (const [hub, table, order, gucs, file] of closers) {
    const receiptRows = await rowsOf(networkDb, `select * from ${table} order by ${order}`);
    assert.equal(receiptRows.length, 3, hub);
    for (const receipt of receiptRows) {
      const before = await bindings(networkDb);
      await loadReceipt(networkDb, gucs, receipt);
      await apply(networkDb, file);
      const diffs = changed(before, await bindings(networkDb));
      assert.equal(diffs.length, 1, `${hub} ${JSON.stringify(diffs)}`);
      assert.equal(diffs[0].before.hub, hub);
      assert.equal(diffs[0].before.open, true);
      assert.equal(diffs[0].after.open, false);
      assert.equal(diffs[0].after.status, 'active');
      closedReceipts += 1;
    }
    console.log(`${hub.toUpperCase()}_BINDING_ROLLBACK ${label} PASS 3`);
  }
  assert.equal(closedReceipts, 15);

  await apply(networkDb, '18-ask-prod-senior-hub-context-rollback.sql');
  await apply(networkDb, '15-ask-prod-hub-account-context-rollback.sql');
  await apply(networkDb, '14-ask-prod-investor-context-rollback.sql');

  assert.equal(await fingerprint(networkDb), BASELINE_FP);
  assert.equal(await present(networkDb, 'v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'), false);
  assert.equal(await present(networkDb, 'v23_private.prod_investor_issue_context(jsonb,uuid,uuid)'), false);
  assert.equal(await present(networkDb, 'v23_private.prod_issue_context(jsonb,uuid,uuid)'), true);
  assert.equal(await present(networkDb, 'v23_private.prod_insurance_state_license_binding_for(text)'), true);
  const finalBindings = await bindings(networkDb);
  assert.equal(finalBindings.length, 16);
  assert.deepEqual(finalBindings.filter(row => row.hub !== 'move').map(row => row.open), Array(15).fill(false));
  assert.deepEqual(finalBindings.filter(row => row.hub === 'move').map(row => ({ open: row.open, status: row.status })), [{ open: true, status: 'active' }]);
  assert.equal((await networkDb.query('select count(*)::int as n from v23_private.prod_move_binding()')).rows[0].n, 1);
  assert.deepEqual(await moveIssuerMeta(networkDb), moveBefore);
  assert.deepEqual(await researchSnapshot(networkDb), researchBefore);
  assert.deepEqual(await naic(networkDb), naicBefore);
  assert.deepEqual(await entities(networkDb), entitiesBefore);
  assert.deepEqual(await resolverPresence(networkDb), resolversBefore);
  assert.equal(resolversBefore.every(row => row.present), true);
  assert.equal(await watchTables(networkDb), watchBefore);
  await quiet(networkDb);
  console.log(`FINAL_AUTHORITY_FINGERPRINT ${label} ${BASELINE_FP}`);
  console.log(`BINDING_RECEIPTS_CLOSED ${label} ${closedReceipts}`);
  console.log(`FULL_NETWORK_REVERSE ${label} PASS`);
  console.log(`AUTHORITY_BASELINE_RESTORED ${label} PASS`);
  console.log(`MOVE_BASELINE_PRESERVED ${label} PASS`);
  console.log(`SAVED_NOTES_PROJECTS_UNCHANGED ${label} PASS`);
  console.log(`WATCH_UNCHANGED ${label} PASS`);
  return closedReceipts;
} finally {
  await networkDb.close();
}
}

const noSaveClosed = await proveNetwork('NO_SAVE', false);
const savedClosed = await proveNetwork('SAVED_RESEARCH', true);
assert.equal(noSaveClosed, 15);
assert.equal(savedClosed, 15);
console.log(`BINDING_RECEIPTS_CLOSED ${noSaveClosed}`);
