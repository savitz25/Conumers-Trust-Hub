// Local embedded PostgreSQL only. Proves the insurance state-license binding
// rollback closes one receipt at a time, then proves the current production
// packet sequence returns to the three-hub baseline before any consumer Save.
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

// Reverse order required by the packets, which matches the operator list:
// 19 first, because its rollback replaces authority() only while the installed
// body is the packet 19 body. Binding rollbacks do not read authority() and do
// not depend on each other, so lender, insurance, investor, contractor, senior
// stay in that order. Packet 18 must precede packet 15: 18 requires the
// four-hub prod_hub_issue_context body and restores the three-hub body, and 15
// drops the function. Packet 18's issuer md5 checks are snapshots taken inside
// the packet 18 rollback transaction, so packet 19 can roll back first.
// Investor context rollback drops only prod_investor_issue_context and is last.
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
  console.log(`FULL_NETWORK_FORWARD PASS ${PACKET19_FP}`);

  const savedBefore = await saved(networkDb);
  const watchBefore = await watchTables(networkDb);
  const naicBefore = await naic(networkDb);
  const entitiesBefore = await entities(networkDb);
  assert.equal(savedBefore.length, 0);
  assert.equal(watchBefore, 0);

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
    }
    console.log(`${hub.toUpperCase()}_BINDING_ROLLBACK PASS 3`);
  }

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
  assert.deepEqual(await saved(networkDb), savedBefore);
  assert.deepEqual(await naic(networkDb), naicBefore);
  assert.deepEqual(await entities(networkDb), entitiesBefore);
  assert.equal(await watchTables(networkDb), watchBefore);
  await quiet(networkDb);
  console.log(`FINAL_AUTHORITY_FINGERPRINT ${BASELINE_FP}`);
  console.log('FULL_NETWORK_ROLLBACK PASS');
  console.log('BASELINE_RESTORED PASS');
} finally {
  await networkDb.close();
}
