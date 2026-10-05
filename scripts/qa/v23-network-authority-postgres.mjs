// Local embedded PostgreSQL only. Proves packet 19 is the one authority
// transition for move, insurance, lender, investor, contractor, and senior.
// Binding SQL is loaded from the current candidate commits. Nothing here
// contacts a hosted database, creates a key, or applies production SQL.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const INVESTOR = 'cad6857664e4cc6899588ad82318f7317d1d6dd1';
const CONTRACTOR = 'e3f1f67a5945112ce890e41237e935c69e98c76c';
const SENIOR_AUTH = '16a35a6d9ac7cfcc8c1c6fd415f9ab04d07c1532';
const SENIOR_BIND = '5752e5cbef6cbcd8483c6124c049eeea232a2643';
const USER = '11111111-1111-4111-8111-111111111111';
const BROWSER = 'ab'.repeat(32);
const prod = 'docs/my-trusthub/v2/production/';

const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const show = (rev, file) => execFileSync('git', ['show', `${rev}:${prod}${file}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');

const preflightSql = read('19-ask-prod-network-authority-preflight.sql');
const forwardSql = read('19-ask-prod-network-authority-forward.sql');
const rollbackSql = read('19-ask-prod-network-authority-rollback.sql');
const authSql = {
  14: show(INVESTOR, '14-ask-prod-investor-authority-forward.sql'),
  16: show(CONTRACTOR, '16-ask-prod-contractor-authority-forward.sql'),
  17: show(SENIOR_AUTH, '17-ask-prod-senior-authority-forward.sql'),
};
const bindSql = {
  14: show(INVESTOR, '14-ask-prod-investor-crd-binding-forward.sql'),
  16: show(CONTRACTOR, '16-ask-prod-contractor-dbpr-binding-forward.sql'),
  17: show(SENIOR_BIND, '17-ask-prod-senior-ccn-binding-forward.sql'),
};
assert.equal(authSql[17], show(SENIOR_BIND, '17-ask-prod-senior-authority-forward.sql'), 'senior authority bytes differ between PR 233 and PR 235');
assert.doesNotMatch(rollbackSql, /^\s*delete\b/im);
assert.match(rollbackSql, /V23_PROD_NETWORK_AUTHORITY_ROLLBACK_STEWARD/);
assert.match(forwardSql, /official_firm/);
assert.match(forwardSql, /contractor_profile/);
assert.match(forwardSql, /cms_facility/);

function claim(hub, operation, input = {}) {
  const staging = operation === 'prepareGuestProfileTransfer' || operation === 'prepareProfileSaveContinuation';
  return {
    hub, audience: 'ask', service: `svc:trusthub:${hub}:bff:v1`, browser: BROWSER, operation,
    scopes: staging ? ['transfer:stage'] : ['saved:write', 'receipt:verify'],
    subject: USER, session: 'cd'.repeat(32), input,
  };
}
function transfer(hub, profileClass, nativeId, extra = {}) {
  const profile = { hub, profileClass, nativeId, ...extra };
  return { sourceHub: hub, returnTask: { hub, profile }, selected: [{ profile }] };
}
function commit(hub, profileClass, nativeId, extra = {}) {
  return { item: { profile: { hub, profileClass, nativeId, ...extra } } };
}

async function clear(db) {
  try { await db.exec('rollback'); } catch { /* no open transaction */ }
}
async function apply(db, sql) {
  try { await db.exec(sql); }
  catch (error) {
    await clear(db);
    throw error;
  }
}
async function refuse(db, sql, pattern) {
  const before = await fingerprint(db);
  let caught = null;
  try { await db.exec(sql); }
  catch (error) { caught = error; }
  await clear(db);
  assert.ok(caught, 'expected a refusal, and the statement succeeded');
  assert.match(`${caught.code ?? ''} ${caught.message}`, pattern);
  assert.equal(await fingerprint(db), before, 'a refused packet changed authority()');
  return caught.message;
}
async function fingerprint(db) {
  const row = (await db.query(`select md5(regexp_replace(prosrc, '\\s+', '', 'g')) as fp,
    prosecdef, pg_get_userbyid(proowner) as owner
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0];
  assert.equal(row.prosecdef, false);
  return `${row.owner}:${row.fp}`;
}
async function otherFunctions(db) {
  const row = (await db.query(`select md5(coalesce(string_agg(sig, ',' order by sig), '')) as fp from (
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '):' || md5(p.prosrc) as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('v23_private', 'ops', 'network', 'consumer')
      and p.oid is distinct from to_regprocedure('v23_private.authority()')
  ) s`)).rows[0];
  return row.fp;
}
async function decide(db, body) {
  await db.exec('begin');
  try {
    await db.query(`insert into v23_private.transaction_authority(backend, transaction_id, authority)
      values (pg_backend_pid(), txid_current(), $1::jsonb)`, [JSON.stringify(body)]);
    const hub = (await db.query(`select v23_private.authority()->>'hub' as hub`)).rows[0].hub;
    await db.exec('rollback');
    return { ok: true, hub };
  } catch (error) {
    await clear(db);
    return { ok: false, message: error.message, code: error.code };
  }
}
async function admit(db, body, hub) {
  const found = await decide(db, body);
  assert.deepEqual(found, { ok: true, hub });
}
async function deny(db, body) {
  const found = await decide(db, body);
  assert.equal(found.ok, false, JSON.stringify(found));
  assert.match(found.message, /invalid authority/);
}
async function legacyTrio(db) {
  const cases = [
    ['move', claim('move', 'prepareGuestProfileTransfer', {})],
    ['move-browser', claim('move', 'prepareGuestProfileTransfer', { hub: 'senior', browserHub: 'investor' })],
    ['lender', claim('lender', 'commitProfileSave', commit('lender', 'marketplace_company', 'nmls:2767'))],
    ['lender-other-class', claim('lender', 'commitProfileSave', commit('lender', 'not_a_reviewed_class', 'nmls:2767'))],
    ['insurance', claim('insurance', 'commitProfileSave', commit('insurance', 'insurance_provider', 'state-license:FL:L106287'))],
    ['insurance-other-class', claim('insurance', 'commitProfileSave', commit('insurance', 'not_a_reviewed_class', 'state-license:FL:L106287'))],
  ];
  const out = [];
  for (const [name, body] of cases) {
    const found = await decide(db, body);
    assert.equal(found.ok, true, name + ' ' + JSON.stringify(found));
    assert.equal(found.hub, body.hub, name);
    out.push(name);
  }
  const mismatched = claim('move', 'prepareGuestProfileTransfer', {});
  mismatched.service = 'svc:trusthub:senior:bff:v1';
  await deny(db, mismatched);
  return out.join(',');
}
async function stateOf(db) {
  await apply(db, preflightSql);
  const row = (await db.query(`select current_setting('v23.network_authority_state', true) as state,
    current_setting('v23.network_authority_hubs', true) as hubs`)).rows[0];
  return row;
}
async function counts(db) {
  return (await db.query(`select
    (select count(*)::int from network.network_entity_bindings where hub = 'investor' and identifier_namespace = 'sec.crd') as investor,
    (select count(*)::int from network.network_entity_bindings where hub = 'contractor' and identifier_namespace = 'fl.dbpr.license') as contractor,
    (select count(*)::int from network.network_entity_bindings where hub = 'senior' and identifier_namespace = 'cms.ccn') as senior,
    to_regprocedure('v23_private.prod_investor_crd_binding_for(text)') is not null as investor_resolver,
    to_regprocedure('v23_private.prod_contractor_dbpr_binding_for(text)') is not null as contractor_resolver,
    to_regprocedure('v23_private.prod_senior_ccn_binding_for(text)') is not null as senior_resolver`)).rows[0];
}
async function bind(db, order) {
  for (const packet of order) await apply(db, bindSql[packet]);
  assert.deepEqual(await counts(db), {
    investor: 3, contractor: 3, senior: 3,
    investor_resolver: true, contractor_resolver: true, senior_resolver: true,
  });
}
async function oldPreflightSignals(db) {
  const investor = (await db.query(`select position($t$'lender','investor'$t$ in prosrc) > 0 as hit
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0].hit;
  const contractor = (await db.query(`select position($t$c->>'hub' in ('move','insurance','lender','contractor')$t$ in prosrc) > 0 as hit
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0].hit;
  const senior = (await db.query(String.raw`select position($t$'senior'$t$ in substring(prosrc from $re$c->>'hub' in \(([a-z',]+)\)$re$)) > 0 as hit
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0].hit;
  return { investor, contractor, senior };
}
async function sixHubContracts(db) {
  await admit(db, claim('investor', 'prepareGuestProfileTransfer', transfer('investor', 'official_firm', 'crd-106176')), 'investor');
  await admit(db, claim('investor', 'commitProfileSave', commit('investor', 'official_firm', 'crd-104571')), 'investor');
  await admit(db, claim('investor', 'prepareGuestProfileTransfer', transfer('investor', 'official_firm', 'crd-110441', { identifierNamespace: 'sec.crd' })), 'investor');
  await admit(db, claim('investor', 'consumeProfileSaveContinuation', {}), 'investor');
  await admit(db, claim('investor', 'prepareProfileSaveContinuation', {}), 'investor');
  await deny(db, claim('investor', 'commitProfileSave', commit('investor', 'broker_dealer', 'crd-106176')));
  await deny(db, claim('investor', 'commitProfileSave', commit('investor', 'official_firm', '106176')));
  await deny(db, claim('investor', 'commitProfileSave', commit('investor', 'official_firm', 'crd-0106176')));
  await deny(db, claim('investor', 'commitProfileSave', commit('investor', 'official_firm', 'sec.crd:106176')));
  await deny(db, claim('investor', 'prepareGuestProfileTransfer', transfer('investor', 'official_firm', 'crd-106176', { identifierNamespace: 'cms.ccn' })));

  for (const key of ['CCC057187', 'CFC1427249', 'CGC1506243']) {
    await admit(db, claim('contractor', 'commitProfileSave', commit('contractor', 'contractor_profile', `fl.dbpr.license:${key}`)), 'contractor');
  }
  await admit(db, claim('contractor', 'prepareGuestProfileTransfer', transfer('contractor', 'contractor_profile', 'fl.dbpr.license:CCC057187', { identifierNamespace: 'fl.dbpr.license' })), 'contractor');
  await admit(db, claim('contractor', 'consumeProfileSaveContinuation', {}), 'contractor');
  await deny(db, claim('contractor', 'commitProfileSave', commit('contractor', 'mover', 'fl.dbpr.license:CCC057187')));
  await deny(db, claim('contractor', 'commitProfileSave', commit('contractor', 'contractor_profile', 'CCC057187')));
  await deny(db, claim('contractor', 'commitProfileSave', commit('contractor', 'contractor_profile', 'fl.dbpr.license:ccc057187')));
  await deny(db, claim('contractor', 'prepareGuestProfileTransfer', transfer('contractor', 'contractor_profile', 'fl.dbpr.license:CCC057187', { identifierNamespace: 'sec.crd' })));

  for (const ccn of ['015009', '055223', '155805', '01500g']) {
    await admit(db, claim('senior', 'commitProfileSave', commit('senior', 'cms_facility', ccn)), 'senior');
  }
  await admit(db, claim('senior', 'prepareGuestProfileTransfer', transfer('senior', 'cms_facility', '015009', { identifierNamespace: 'cms.ccn' })), 'senior');
  await admit(db, claim('senior', 'consumeProfileSaveContinuation', {}), 'senior');
  await deny(db, claim('senior', 'commitProfileSave', commit('senior', 'home_health', '015009')));
  await deny(db, claim('senior', 'commitProfileSave', commit('senior', 'nursing_home', '055223')));
  await deny(db, claim('senior', 'commitProfileSave', commit('senior', 'cms_facility', 'cms.ccn:015009')));
  await deny(db, claim('senior', 'commitProfileSave', commit('senior', 'cms_facility', '0150090')));
  await deny(db, claim('senior', 'prepareGuestProfileTransfer', transfer('senior', 'cms_facility', '155805', { identifierNamespace: 'sec.crd' })));

  await deny(db, claim('ask', 'prepareGuestProfileTransfer', {}));
  await deny(db, claim('advisor', 'prepareGuestProfileTransfer', {}));
  await deny(db, claim('titlehub', 'commitProfileSave', {}));
  await deny(db, claim('Senior', 'commitProfileSave', commit('Senior', 'cms_facility', '015009')));
  await deny(db, claim('senior ', 'commitProfileSave', commit('senior ', 'cms_facility', '015009')));
  const browser = claim('move', 'prepareGuestProfileTransfer', { hub: 'senior', browserHub: 'investor' });
  await admit(db, browser, 'move');
}

const migrations = [
  '20260907160000_my_trusthub_identity_foundation.sql',
  '20260907190000_my_trusthub_saved_projects_guest_import.sql',
  '20260907220000_my_trusthub_cross_hub_handoffs.sql',
  '20260919205200_my_trusthub_v23_transaction_capability.sql',
  '20261003170000_my_trusthub_saved_project_ids.sql',
];
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
await seededDb.exec(read('02-ask-prod-ports-forward.sql'));
const seeded = await seededDb.dumpDataDir();
await seededDb.close();

async function open() {
  const db = new PGlite({ database: 'postgres', loadDataDir: seeded, extensions: { btree_gist, pgcrypto } });
  await db.exec(`select set_config('v23.approved_project', '${PRODUCTION}', false),
    set_config('v23bind.sec_iapd_checked', 'true', false),
    set_config('v23bind.contractor_dbpr_checked', 'true', false),
    set_config('v23bind.senior_ccn_checked', 'true', false)`);
  return db;
}

const db = await open();
let baselineFp;
let finalFp;
try {
  baselineFp = await fingerprint(db);
  const beforeTrio = await legacyTrio(db);
  await deny(db, claim('investor', 'prepareGuestProfileTransfer', transfer('investor', 'official_firm', 'crd-106176')));
  await deny(db, claim('contractor', 'commitProfileSave', commit('contractor', 'contractor_profile', 'fl.dbpr.license:CCC057187')));
  await deny(db, claim('senior', 'commitProfileSave', commit('senior', 'cms_facility', '015009')));
  console.log('PASS A B C baseline move, lender, and insurance admitted; investor, contractor, and senior denied');

  const source = (await db.query(`select prosrc from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0].prosrc;
  const drifted = source.replace(`raise exception 'operation'`, `raise exception 'operation_drift'`);
  assert.notEqual(drifted, source);
  await db.exec(`create or replace function v23_private.authority() returns jsonb language plpgsql security invoker
    set search_path = pg_catalog, v23_private as $body$${drifted}$body$`);
  const driftedFp = await fingerprint(db);
  assert.notEqual(driftedFp, baselineFp);
  const preflightStop = await refuse(db, preflightSql, /V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_FAIL/);
  const forwardStop = await refuse(db, forwardSql, /V23_PROD_NETWORK_AUTHORITY_PRECONDITION_FAIL/);
  assert.equal(await fingerprint(db), driftedFp);
  assert.match(preflightStop, /not a reviewed predecessor/);
  assert.match(forwardStop, /not a reviewed predecessor/);
  await db.exec(`create or replace function v23_private.authority() returns jsonb language plpgsql security invoker
    set search_path = pg_catalog, v23_private as $body$${source}$body$`);
  assert.equal(await fingerprint(db), baselineFp);
  console.log('PASS P unknown authority body stops preflight and forward without a write');

  let report = await stateOf(db);
  assert.deepEqual(report, { state: 'baseline', hubs: 'move,insurance,lender' });
  assert.deepEqual(await oldPreflightSignals(db), { investor: false, contractor: false, senior: false });
  await bind(db, [14, 16, 17]);
  const bindingRows = (await db.query(`select id::text, hub, specialist_entity_id, valid_to::text
    from network.network_entity_bindings where hub in ('investor', 'contractor', 'senior')
    order by hub, specialist_entity_id`)).rows;
  assert.equal(bindingRows.length, 9);
  const neighbors = await otherFunctions(db);
  await apply(db, forwardSql);
  finalFp = await fingerprint(db);
  assert.notEqual(finalFp, baselineFp);
  assert.equal(await otherFunctions(db), neighbors);
  report = await stateOf(db);
  assert.deepEqual(report, { state: 'applied', hubs: 'move,insurance,lender,investor,contractor,senior' });
  assert.equal(await legacyTrio(db), beforeTrio);
  console.log('PASS A B C move, lender, and insurance decisions are unchanged after packet 19');
  await sixHubContracts(db);
  console.log('PASS D E F investor, contractor, and senior exact contracts admitted');
  console.log('PASS G H I J K L wrong class and wrong namespace denied');
  console.log('PASS M N O unknown hub, future hub, and a browser hub field denied or ignored');
  assert.deepEqual(await oldPreflightSignals(db), { investor: true, contractor: false, senior: true });
  console.log('PASS current preflight signals mis-report after packet 19: investor substring hit, contractor four-hub substring miss, senior token hit');

  await refuse(db, forwardSql, /already applied/);
  assert.equal(await fingerprint(db), finalFp);
  console.log('PASS Q second forward refused and wrote nothing');

  await db.exec(`insert into auth.users(id) values ('${USER}')`);
  const saved = await db.query(`insert into consumer.consumer_saved_entities(user_id, network_entity_id, identity_resolution_state, source_hub)
    select '${USER}', network_entity_id, 'accepted', hub
    from network.network_entity_bindings
    where (hub, source_identifier) in (('investor', '106176'), ('contractor', 'CCC057187'), ('senior', '015009'))
    returning id::text, source_hub, network_entity_id::text, removed_at`);
  assert.equal(saved.rows.length, 3);
  const savedBefore = saved.rows.map(row => ({ ...row, removed_at: row.removed_at ?? null }));
  await apply(db, rollbackSql);
  assert.equal(await fingerprint(db), baselineFp);
  report = await stateOf(db);
  assert.deepEqual(report, { state: 'baseline', hubs: 'move,insurance,lender' });
  const bindingAfter = (await db.query(`select id::text, hub, specialist_entity_id, valid_to::text
    from network.network_entity_bindings where hub in ('investor', 'contractor', 'senior')
    order by hub, specialist_entity_id`)).rows;
  assert.deepEqual(bindingAfter, bindingRows);
  const savedAfter = (await db.query(`select id::text, source_hub, network_entity_id::text, removed_at
    from consumer.consumer_saved_entities order by source_hub`)).rows
    .map(row => ({ ...row, removed_at: row.removed_at ?? null }));
  assert.deepEqual(savedAfter, savedBefore.sort((a, b) => a.source_hub.localeCompare(b.source_hub)));
  assert.equal(await legacyTrio(db), beforeTrio);
  await deny(db, claim('investor', 'commitProfileSave', commit('investor', 'official_firm', 'crd-106176')));
  await deny(db, claim('contractor', 'commitProfileSave', commit('contractor', 'contractor_profile', 'fl.dbpr.license:CCC057187')));
  await deny(db, claim('senior', 'commitProfileSave', commit('senior', 'cms_facility', '015009')));
  console.log('PASS R rollback restored the three-hub body');
  console.log('PASS T hub bindings survived authority rollback');
  console.log('PASS U Saved research survived authority rollback');
  await refuse(db, rollbackSql, /V23_PROD_NETWORK_AUTHORITY_ROLLBACK_PRECONDITION_FAIL/);
  assert.equal(await fingerprint(db), baselineFp);
  assert.equal((await db.query(`select count(*)::int as n from consumer.consumer_saved_entities where removed_at is null`)).rows[0].n, 3);
  console.log('PASS S second rollback refused and wrote nothing');
} finally {
  await db.close();
}

async function converge(label, steps, expectedState) {
  const next = await open();
  try {
    assert.equal(await fingerprint(next), baselineFp, label + ' seed was not the baseline');
    for (const step of steps) {
      if (step.ok) await apply(next, authSql[step.packet]);
      else {
        const message = await refuse(next, authSql[step.packet], /PRECONDITION_FAIL|not a reviewed|already applied/);
        console.log(`INFO ${label} packet ${step.packet} refused: ${message.split('\n')[0]}`);
      }
    }
    if (expectedState) assert.deepEqual(await stateOf(next), expectedState);
    const neighbors = await otherFunctions(next);
    await apply(next, forwardSql);
    assert.equal(await fingerprint(next), finalFp, label + ' did not converge');
    assert.equal(await otherFunctions(next), neighbors);
    await sixHubContracts(next);
    await apply(next, rollbackSql);
    assert.equal(await fingerprint(next), baselineFp);
    await deny(next, claim('investor', 'prepareGuestProfileTransfer', transfer('investor', 'official_firm', 'crd-106176')));
    await admit(next, claim('move', 'prepareGuestProfileTransfer', {}), 'move');
    console.log(`PASS ${label} converged to packet 19 and rolled back to the three-hub body`);
  } finally {
    await next.close();
  }
}

await converge('14 authority then 19', [{ packet: 14, ok: true }],
  { state: 'packet14_authority', hubs: 'move,insurance,lender,investor' });
await converge('16 authority then 19', [{ packet: 16, ok: true }],
  { state: 'packet16_authority', hubs: 'move,insurance,lender,contractor' });
await converge('17 authority then 19', [{ packet: 17, ok: true }],
  { state: 'packet17_style', hubs: 'move,insurance,lender,senior' });
await converge('14 then 17 then refused 16 then 19',
  [{ packet: 14, ok: true }, { packet: 17, ok: true }, { packet: 16, ok: false }],
  { state: 'packet17_style', hubs: 'move,insurance,lender,investor,senior' });
await converge('17 then refused 14 then 19',
  [{ packet: 17, ok: true }, { packet: 14, ok: false }],
  { state: 'packet17_style', hubs: 'move,insurance,lender,senior' });
await converge('16 then refused 17 then 19',
  [{ packet: 16, ok: true }, { packet: 17, ok: false }],
  { state: 'packet16_authority', hubs: 'move,insurance,lender,contractor' });

for (const order of [[14, 16, 17], [16, 14, 17], [17, 16, 14]]) {
  const next = await open();
  try {
    assert.equal(await fingerprint(next), baselineFp);
    await bind(next, order);
    const beforeSignals = await oldPreflightSignals(next);
    assert.deepEqual(beforeSignals, { investor: false, contractor: false, senior: false });
    await apply(next, forwardSql);
    assert.equal(await fingerprint(next), finalFp);
    await sixHubContracts(next);
    console.log(`PASS binding order ${order.join(' -> ')} -> 19`);
  } finally {
    await next.close();
  }
}

const after = await open();
try {
  await apply(after, forwardSql);
  assert.equal(await fingerprint(after), finalFp);
  await bind(after, [17, 14, 16]);
  await sixHubContracts(after);
  console.log('PASS binding forwards do not require authority to be absent; 19 then 17 -> 14 -> 16 bindings succeeded');
} finally {
  await after.close();
}

console.log('NETWORK_AUTHORITY_HARNESS_OK');
console.log(`BASELINE_FP ${baselineFp}`);
console.log(`FINAL_FP ${finalFp}`);
