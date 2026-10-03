// Local embedded PostgreSQL ONLY. Proves the exact-USDOT binding expansion
// packet (docs/my-trusthub/v2/production/11-*) against the real identity
// migrations, the real Hindman binding packet and the real resolver packet:
// reconciliation classes, the governed batch forward, its refusals, idempotence
// and the receipt-driven rollback. Nothing here contacts a hosted database.
//
// The only substitution is the resolver name the reconciliation requires
// (prod_move_binding_for -> preview_move_binding_for): this harness installs the
// preview copy of packet 09, which is the production packet with preview
// identifiers (asserted by check:my-trusthub-v2-3-widening).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createPacketBinding } from './v23-sql-closeout-cases.mjs';
import { buildManifest, candidateSql, evidenceCsv } from '../release/mth-v2-exact-usdot-packet.mjs';

const PREVIEW = 'xkkiicsassizmakcvxml', PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const root = 'docs/my-trusthub/v2/final-parent-wiring/', prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const reconcileSql = read('11-ask-prod-move-exact-usdot-reconcile.sql').replaceAll('prod_move_binding_for', 'preview_move_binding_for');
const forwardSql = read('11-ask-prod-move-exact-usdot-batch-forward.sql');
const rollbackSql = read('11-ask-prod-move-exact-usdot-batch-rollback.sql');

// The forward packet writes exactly the columns and values packet 10 writes.
{
  const squash = text => text.replace(/\s+/g, '');
  const ten = squash(read('10-ask-prod-move-mover-binding.sql'));
  for (const fragment of [
    'insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)',
    `insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
     identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref,resolution_note)`,
  ]) { assert.ok(ten.includes(squash(fragment))); assert.ok(squash(forwardSql).includes(squash(fragment))); }
  for (const sql of [forwardSql, rollbackSql, reconcileSql]) {
    const body = sql.split('\n').filter(line => !line.startsWith('--')).join('\n');
    assert.ok(!/\bdelete\s+from\b|\btruncate\b|\bon\s+conflict\b|\bdrop\s+(table|policy|function)\b/i.test(body), 'no delete, truncate, upsert or drop');
  }
  const forwardBody = forwardSql.split('\n').filter(line => !line.startsWith('--')).join('\n');
  assert.ok(!/\bupdate\s+network\./i.test(forwardBody), 'forward never updates a network row');
  const reconcileBody = reconcileSql.split('\n').filter(line => !line.startsWith('--')).join('\n');
  assert.ok(!/\b(insert\s+into|update)\s+(network|consumer)\./i.test(reconcileBody), 'reconciliation writes no network or consumer row');
  console.log('PASS packet text: packet-10 columns, INSERT-only forward, no delete/upsert anywhere, read-only reconciliation');
}

// Fixture enumeration in the shape the Move enumeration script writes.
const row = (usdot, slug, legal, patch = {}) => ({ id: 'usdot-' + usdot, slug, usdot, mc: '', name: legal, fmcsaLegalName: legal,
  publicationState: 'PUBLISHABLE', outOfService: false, capabilities: ['hhg_interstate_carrier'], moveClass: 'ELIGIBLE', ...patch });
const HINDMAN = row('1002530', 'hindman-isaacs-moving-storage-inc', 'HINDMAN & ISAACS MOVING & STORAGE, INC.');
const SAFE = [row('5551001', 'fixture-safe-one', "O'FIXTURE SAFE ONE MOVERS LLC"), row('5551002', 'fixture-safe-two', 'FIXTURE SAFE TWO INC'), row('77', 'fixture-safe-three', 'FIXTURE SAFE THREE, INC.')];
const AMBIGUOUS = row('5552001', 'fixture-ambiguous', 'FIXTURE AMBIGUOUS LLC');
const REVIEW = row('5552002', 'fixture-review', 'FIXTURE REVIEW LLC');
const SPLIT = row('5552003', 'fixture-split', 'FIXTURE SPLIT LLC');
const INACTIVE_ENTITY = row('5552004', 'fixture-inactive-entity', 'FIXTURE INACTIVE ENTITY LLC');
const ENDED = row('5552005', 'fixture-ended', 'FIXTURE ENDED LLC');
const SAME_NAME = row('5552006', 'fixture-same-name', 'Fixture Same Name LLC');
const SAME_REF = row('5552007', 'fixture-same-ref', 'FIXTURE SAME REF LLC');
const OTHER_HUB = row('5552008', 'fixture-other-hub', 'FIXTURE OTHER HUB LLC');
const enumeration = { project: 'arepfylnilkjmyduhwbz', finishedAt: new Date(Date.now() - 60_000).toISOString(), rows: [
  HINDMAN, ...SAFE, AMBIGUOUS, REVIEW, SPLIT, INACTIVE_ENTITY, ENDED, SAME_NAME, SAME_REF, OTHER_HUB,
  row('5553001', 'fixture-twin-a', 'FIXTURE TWIN MOVERS LLC'), row('5553002', 'fixture-twin-b', 'Fixture Twin Movers LLC'),
  row('', 'fixture-no-usdot', 'FIXTURE NO USDOT', { id: 'fixture-no-usdot', moveClass: 'MISSING_REQUIRED_IDENTITY' }),
  row('5553003', 'fixture-broker', 'FIXTURE BROKER', { capabilities: ['hhg_broker'], moveClass: 'HELD_UNSUPPORTED_CLASS' }),
  row('5553004', 'fixture-ingested', 'FIXTURE INGESTED', { publicationState: 'INGESTED', moveClass: 'NOT_PUBLISHABLE' }),
] };
const manifest = buildManifest(enumeration);
assert.deepEqual([manifest.publishable, manifest.supported, manifest.candidates.length], [16, 15, 12]);
assert.deepEqual(manifest.counts, { CANDIDATE: 12, MOVE_NAME_COLLISION_HOLD: 2, MISSING_REQUIRED_IDENTITY: 1 });
assert.equal(candidateSql(manifest), candidateSql(buildManifest(structuredClone({ ...enumeration, rows: [...enumeration.rows].reverse() }))));
assert.equal(evidenceCsv(manifest).trim().split('\n').length, 16);
console.log('PASS manifest: deterministic, colliding labels and missing identity held on the Move side, unsupported class excluded');

const bootstrap = new PGlite();
const emptyCluster = await bootstrap.dumpDataDir();
await bootstrap.close();
const boot = async () => {
  const db = new PGlite({ database: 'postgres', loadDataDir: emptyCluster, extensions: { btree_gist, pgcrypto } });
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
    alter table auth.sessions enable row level security; alter table auth.sessions force row level security;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  for (const f of ['20260907160000_my_trusthub_identity_foundation.sql', '20260907190000_my_trusthub_saved_projects_guest_import.sql',
    '20260907220000_my_trusthub_cross_hub_handoffs.sql', '20260919205200_my_trusthub_v23_transaction_capability.sql',
    '20261003170000_my_trusthub_saved_project_ids.sql']) await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec(`set v23.approved_project='${PREVIEW}'`);
  await db.exec(readFileSync(root + 'ports-forward.sql', 'utf8'));
  await db.exec(readFileSync(root + 'runtime-role-forward.sql', 'utf8'));
  await createPacketBinding(db); // the Hindman reference binding, through its own packet
  await db.exec(readFileSync(root + 'move-binding-resolver-forward.sql', 'utf8'));
  await db.exec(`set v23.approved_project='${PRODUCTION}'; set v23.binding_creation_authorized=''; set v23bind.evidence_ref='';`);
  return db;
};
const snapshot = async db => JSON.stringify((await db.query(`select
  (select jsonb_agg(to_jsonb(e) order by e.id) from network.network_entities e) entities,
  (select jsonb_agg(to_jsonb(b) order by b.id) from network.network_entity_bindings b) bindings,
  (select count(*) from network.identity_governance_events) events`)).rows[0]);
const classes = async db => Object.fromEntries((await db.query('select class,count(*)::int n from pg_temp.v23bulk_classified group by class')).rows.map(r => [r.class, r.n]));
const resolve = async (db, usdot) => (await db.query('select * from v23_private.preview_move_binding_for($1)', ['usdot-' + usdot])).rows;
const abort = db => db.exec('rollback; reset role');
const authorize = (db, expected) => db.exec(`set v23.binding_creation_authorized='true'; set v23bulk.candidate_unchanged='true';
  set v23bulk.evidence_ref='local-sql-packet-fixture-only'; set v23bulk.expected_safe_new='${expected}';`);

const db = await boot();
try {
  // Existing identities for every non-safe class (steward-style fixture rows).
  const entity = async (name, slug, status = 'active') => (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
    values('organization',$1,'move','US',$2,$3) returning id`, [name, '/companies/' + slug, status])).rows[0].id;
  const bind = (entityId, m, status, patch = {}) => db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,valid_to,provenance_ref) values($1,$2,'mover',$3,'fmcsa.usdot',$4,$5,$6,now()-interval '2 hours',$7,'fixture-only')`,
    [entityId, patch.hub ?? 'move', patch.nativeId ?? 'usdot-' + m.usdot, patch.usdot ?? m.usdot, 'jurisdiction' in patch ? patch.jurisdiction : 'US', status, patch.validTo ?? null]);
  await bind(await entity('FIXTURE AMBIGUOUS (first)', 'fixture-ambiguous-1'), AMBIGUOUS, 'accepted');
  await bind(await entity('FIXTURE AMBIGUOUS (second)', 'fixture-ambiguous-2'), AMBIGUOUS, 'accepted', { nativeId: 'fixture-other-id', jurisdiction: null });
  await bind(await entity('FIXTURE REVIEW (existing)', 'fixture-review-x'), REVIEW, 'review_required');
  await bind(await entity('FIXTURE SPLIT (existing)', 'fixture-split-x'), SPLIT, 'accepted', { usdot: '5559999' });
  await bind(await entity('FIXTURE INACTIVE (existing)', 'fixture-inactive-x', 'retired'), INACTIVE_ENTITY, 'accepted');
  await bind(await entity('FIXTURE ENDED (existing)', 'fixture-ended-x', 'retired'), ENDED, 'accepted', { validTo: new Date(Date.now() - 3_600_000).toISOString() });
  await entity('FIXTURE SAME NAME LLC', 'fixture-same-name-other-profile'); // label collision, different case
  await entity('FIXTURE SOMEBODY ELSE INC', SAME_REF.slug);
  await bind(await entity('FIXTURE OTHER HUB (existing)', 'fixture-other-hub-x'), OTHER_HUB, 'accepted', { hub: 'lender', nativeId: 'lender-1' });
  const baseline = await snapshot(db);

  // Reconciliation refuses without candidates or with a tampered manifest, and writes nothing.
  await assert.rejects(db.exec(reconcileSql), /Load 11-move-exact-usdot-candidates/);
  await db.exec(candidateSql(manifest));
  await assert.rejects(db.exec(candidateSql(manifest)), /already loaded/);
  await db.exec(`update pg_temp.v23bulk_candidates set legal_name='TAMPERED' where usdot='77'`);
  await assert.rejects(db.exec(reconcileSql), /V23_BULK_MANIFEST_FAIL/);
  await db.query(`update pg_temp.v23bulk_candidates set legal_name=$1 where usdot='77'`, [SAFE[2].fmcsaLegalName]);
  await db.exec(reconcileSql);
  assert.deepEqual(await classes(db), { ALREADY_ACCEPTED: 1, SAFE_NEW_BINDING: 3, AMBIGUOUS: 1, REVIEW_REQUIRED: 4, CONFLICT: 3 });
  const classOf = Object.fromEntries((await db.query('select usdot,class from pg_temp.v23bulk_classified')).rows.map(r => [r.usdot, r.class]));
  assert.deepEqual([HINDMAN, AMBIGUOUS, REVIEW, SPLIT, INACTIVE_ENTITY, ENDED, SAME_NAME, SAME_REF, OTHER_HUB].map(m => classOf[m.usdot]),
    ['ALREADY_ACCEPTED', 'AMBIGUOUS', 'REVIEW_REQUIRED', 'CONFLICT', 'CONFLICT', 'REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'CONFLICT']);
  for (const m of SAFE) assert.equal(classOf[m.usdot], 'SAFE_NEW_BINDING');
  assert.equal(await snapshot(db), baseline);
  console.log('PASS reconciliation: every class decided by exact identifiers, label collisions held, no row written');

  // Forward refusals: each leaves the database exactly as it was.
  await assert.rejects(db.exec(forwardSql), /authorization required/); await abort(db);
  await authorize(db, 2);
  await assert.rejects(db.exec(forwardSql), /Reviewed SAFE_NEW_BINDING count required/); await abort(db);
  await authorize(db, 3);
  await db.exec(`select set_config('v23bulk.reconciled_at',(clock_timestamp()-interval '3 minutes')::text,false)`);
  await assert.rejects(db.exec(forwardSql), /Fresh same-session reconciliation/); await abort(db);
  await db.exec(reconcileSql);
  const enumeratedAt = (await db.query(`select current_setting('v23bulk.enumerated_at') v`)).rows[0].v;
  await db.exec(`select set_config('v23bulk.enumerated_at',(clock_timestamp()-interval '25 hours')::text,false)`);
  await assert.rejects(db.exec(forwardSql), /Fresh Move enumeration required/); await abort(db);
  await db.query(`select set_config('v23bulk.enumerated_at',$1,false)`, [enumeratedAt]);
  // A competing identity appearing after the reviewed reconciliation stops the batch under the lock.
  await db.exec('begin');
  await bind(await entity('FIXTURE LATE CLAIM', 'fixture-late-claim'), SAFE[1], 'review_required');
  const withLateClaim = await snapshot(db);
  await db.exec('commit');
  await assert.rejects(db.exec(forwardSql), /V23_BULK_CHANGED: 2 SAFE_NEW_BINDING now, 3 reviewed/); await abort(db);
  assert.equal(await snapshot(db), withLateClaim);
  await db.exec(`update network.network_entity_bindings set binding_status='invalid' where provenance_ref='fixture-only' and specialist_entity_id='usdot-${SAFE[1].usdot}'`);
  await db.exec(reconcileSql);
  assert.equal((await classes(db)).SAFE_NEW_BINDING, 2); // an invalid historical claim still holds the mover back
  await assert.rejects(db.exec(forwardSql), /Reviewed SAFE_NEW_BINDING count required/); await abort(db);
  console.log('PASS forward guards: authorization, reviewed count, fresh reconciliation, fresh enumeration, change-under-lock all refuse with nothing written');

  // Forward apply.
  const before = (await db.query(`select (select jsonb_agg(to_jsonb(e) order by e.id) from network.network_entities e) entities,
    (select jsonb_agg(to_jsonb(b) order by b.id) from network.network_entity_bindings b) bindings`)).rows[0];
  await authorize(db, 2);
  await db.exec(forwardSql);
  const receipt = (await db.query('select * from pg_temp.v23bulk_receipt order by usdot::bigint')).rows;
  assert.deepEqual(receipt.map(r => r.usdot), ['77', '5551001']);
  const after = (await db.query(`select (select jsonb_agg(to_jsonb(e) order by e.id) from network.network_entities e where e.id<>all($1::uuid[])) entities,
    (select jsonb_agg(to_jsonb(b) order by b.id) from network.network_entity_bindings b where b.id<>all($2::uuid[])) bindings`,
    [receipt.map(r => r.network_entity_id), receipt.map(r => r.binding_id)])).rows[0];
  assert.deepEqual(after, before); // no pre-existing row changed
  for (const r of receipt) {
    const m = SAFE.find(s => s.usdot === r.usdot);
    assert.deepEqual((await resolve(db, r.usdot)).map(x => [x.id, x.network_entity_id, x.binding_status, x.specialist_entity_type, x.specialist_entity_id, x.identifier_namespace, x.source_identifier, x.jurisdiction, x.entity_status]),
      [[r.binding_id, r.network_entity_id, 'accepted', 'mover', 'usdot-' + r.usdot, 'fmcsa.usdot', r.usdot, 'US', 'active']]);
    const created = (await db.query('select entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status from network.network_entities where id=$1', [r.network_entity_id])).rows[0];
    assert.deepEqual(created, { entity_type: 'organization', canonical_name: m.fmcsaLegalName, primary_hub: 'move', jurisdiction: 'US', canonical_public_profile_ref: '/companies/' + m.slug, status: 'active' });
    assert.match(r.provenance_ref, new RegExp('^mth-v2-move-exact-usdot/' + manifest.sha256 + '/'));
  }
  for (const m of [AMBIGUOUS, REVIEW, SPLIT, INACTIVE_ENTITY, ENDED, SAME_NAME, SAME_REF, OTHER_HUB, SAFE[1]])
    assert.equal((await db.query(`select count(*)::int n from network.network_entity_bindings where provenance_ref like 'mth-v2-move-exact-usdot/%' and specialist_entity_id=$1`, ['usdot-' + m.usdot])).rows[0].n, 0);
  assert.equal((await db.query(`select has_table_privilege('myth_identity_governor','pg_temp.v23bulk_receipt','INSERT') p`)).rows[0].p, false);
  console.log('PASS forward: one entity + one accepted binding per SAFE_NEW_BINDING mover, packet-10 values, every other class and every prior row untouched');

  // Idempotence: same session and a re-reconciled session both refuse and write nothing.
  const applied = await snapshot(db);
  await assert.rejects(db.exec(forwardSql), /already applied in this session/); await abort(db);
  await db.exec('alter table pg_temp.v23bulk_receipt rename to v23bulk_receipt_kept');
  await db.exec(reconcileSql);
  assert.deepEqual(await classes(db), { ALREADY_ACCEPTED: 3, AMBIGUOUS: 1, REVIEW_REQUIRED: 5, CONFLICT: 3 });
  await assert.rejects(db.exec(forwardSql), /Reviewed SAFE_NEW_BINDING count required/); await abort(db);
  await db.exec(`set v23bulk.expected_safe_new='0'`);
  await assert.rejects(db.exec(forwardSql), /Reviewed SAFE_NEW_BINDING count required/); await abort(db);
  assert.equal(await snapshot(db), applied);
  console.log('PASS idempotence: a re-run creates nothing');

  // Rollback: receipt-driven retirement, no delete.
  await assert.rejects(db.exec(rollbackSql), /authorization required/); await abort(db);
  await db.exec(`set v23.binding_retirement_authorized='true'`);
  await assert.rejects(db.exec(rollbackSql), /Load the retained forward receipt/); await abort(db);
  await db.exec(`create temp table v23bulk_rollback(usdot text primary key,slug text,legal_name text,binding_id uuid not null unique,
    network_entity_id uuid not null unique,provenance_ref text not null,valid_from timestamptz not null) on commit preserve rows;
    insert into pg_temp.v23bulk_rollback select * from pg_temp.v23bulk_receipt_kept;`);
  await db.exec(`set v23bulk.rollback_expected_rows='3'`);
  await assert.rejects(db.exec(rollbackSql), /Loaded receipt rows differ/); await abort(db);
  await db.exec(`set v23bulk.rollback_expected_rows='2'`);
  // A receipt row pointed at somebody else's binding is refused.
  const hindman = (await resolve(db, HINDMAN.usdot))[0];
  await db.query(`update pg_temp.v23bulk_rollback set binding_id=$1 where usdot='77'`, [hindman.id]);
  await assert.rejects(db.exec(rollbackSql), /Exact live forward binding required: 1 of 2/); await abort(db);
  await db.query(`update pg_temp.v23bulk_rollback set binding_id=$1 where usdot='77'`, [receipt[0].binding_id]);
  assert.equal(await snapshot(db), applied);
  const countsBefore = (await db.query('select (select count(*)::int from network.network_entities) e,(select count(*)::int from network.network_entity_bindings) b')).rows[0];
  await db.exec(rollbackSql);
  assert.deepEqual((await db.query('select (select count(*)::int from network.network_entities) e,(select count(*)::int from network.network_entity_bindings) b')).rows[0], countsBefore);
  for (const r of receipt) {
    assert.equal((await resolve(db, r.usdot)).length, 0);
    const state = (await db.query(`select b.binding_status,b.valid_to is not null as ended,e.status from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id where b.id=$1`, [r.binding_id])).rows[0];
    assert.deepEqual(state, { binding_status: 'accepted', ended: true, status: 'retired' });
  }
  const rest = (await db.query(`select (select jsonb_agg(to_jsonb(e) order by e.id) from network.network_entities e where e.id<>all($1::uuid[])) entities,
    (select jsonb_agg(to_jsonb(b) order by b.id) from network.network_entity_bindings b where b.id<>all($2::uuid[])) bindings`,
    [receipt.map(r => r.network_entity_id), receipt.map(r => r.binding_id)])).rows[0];
  assert.deepEqual(rest, before);
  assert.equal((await resolve(db, HINDMAN.usdot)).length, 1);
  await assert.rejects(db.exec(rollbackSql), /Exact live forward binding required: 0 of 2/); await abort(db);
  await db.exec(reconcileSql);
  assert.deepEqual(await classes(db), { ALREADY_ACCEPTED: 1, AMBIGUOUS: 1, REVIEW_REQUIRED: 7, CONFLICT: 3 }); // retired identities are not reopened
  console.log('PASS rollback: exactly the receipt bindings retired, entities retired, nothing deleted, others untouched, re-run refused');
} finally { await db.close(); }

// The generated production candidate file, as shipped, on a database that holds
// only the Hindman reference: structure, manifest and full-size apply + rollback.
const shipped = prod + '11-move-exact-usdot-candidates.sql';
if (existsSync(shipped)) {
  const big = await boot();
  try {
    const sql = readFileSync(shipped, 'utf8');
    await big.exec(sql);
    // The shipped enumeration time is not rewritten; only its 24 h freshness is fixture-aged here.
    const n = Number((await big.query(`select current_setting('v23bulk.manifest_rows') v`)).rows[0].v);
    const tr = Date.now();
    await big.exec(reconcileSql);
    const reconcileMs = Date.now() - tr;
    const counts = await classes(big);
    assert.deepEqual(counts, { ALREADY_ACCEPTED: 1, SAFE_NEW_BINDING: n - 1 });
    await big.exec(`select set_config('v23bulk.enumerated_at',(clock_timestamp()-interval '1 minute')::text,false)`);
    await authorize(big, n - 1);
    const t0 = Date.now();
    await big.exec(forwardSql);
    const forwardMs = Date.now() - t0;
    const tv = Date.now();
    await big.exec('begin; set local enable_nestloop=off');
    assert.equal((await classes(big)).ALREADY_ACCEPTED, n);
    await big.exec('commit');
    const classifyAfterMs = Date.now() - tv;
    const made = (await big.query(`select count(*)::int n,count(distinct binding_id)::int b,count(distinct network_entity_id)::int e from pg_temp.v23bulk_receipt`)).rows[0];
    assert.deepEqual(made, { n: n - 1, b: n - 1, e: n - 1 });
    assert.equal((await big.query(`select count(*)::int n from pg_temp.v23bulk_candidates c where (select count(*) from v23_private.preview_move_binding_for('usdot-'||c.usdot) r
      where r.binding_status='accepted' and r.entity_status='active' and r.specialist_entity_id='usdot-'||c.usdot and r.source_identifier=c.usdot)=1`)).rows[0].n, n);
    await big.exec(`create temp table v23bulk_rollback as select * from pg_temp.v23bulk_receipt;
      set v23.binding_retirement_authorized='true'; set v23bulk.rollback_expected_rows='${n - 1}';`);
    const t1 = Date.now();
    await big.exec(rollbackSql);
    assert.equal((await big.query(`select count(*)::int n from network.network_entity_bindings where valid_to is null`)).rows[0].n, 1);
    assert.equal((await resolve(big, HINDMAN.usdot)).length, 1);
    console.log(`PASS shipped candidates: ${n} rows load, 1 ALREADY_ACCEPTED (Hindman) + ${n - 1} SAFE_NEW_BINDING on a Hindman-only database; reconcile ${reconcileMs} ms, forward ${forwardMs} ms (classification over the full set afterwards ${classifyAfterMs} ms), rollback ${Date.now() - t1} ms (embedded)`);
  } finally { await big.close(); }
}
console.log('PASS exact-USDOT binding expansion packet');
