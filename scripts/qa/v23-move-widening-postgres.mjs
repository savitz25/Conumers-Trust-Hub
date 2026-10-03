// Local embedded PostgreSQL ONLY. Real P11/P12/P13 SQL, the real preview port
// packet, the real exact-mover resolver packet and the real per-mover binding
// packet. Auth and the Move source channel are explicit fixtures. This proves
// the widened Ask runtime: any supported Move mover resolves by its exact
// verified identity; anything unpublished, unsupported, unbound, ambiguous or
// review_required fails closed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PreviewAssembly } from '../../lib/my-trusthub/profile-save/preview-assembly.ts';
import { PreviewStore, randomRef } from '../../lib/my-trusthub/profile-save/preview-store.ts';
import { SourceChannel, supportedMoveProfile } from '../../lib/my-trusthub/profile-save/source-channel.ts';
import { TEST_PROFILE, TEST_SLUG } from '../../lib/my-trusthub/profile-save/reference-profile.fixture.ts';
import { handleProfileConfirmation } from '../../lib/my-trusthub/profile-save/browser.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { ASSERTION_HEADER, signAssertion } from '../../lib/my-trusthub/profile-save/service-assertion.ts';
import { ASK_PREVIEW, MOVE_PREVIEW, API_PATH, GRANT_API_PATH } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { fixtureEnv, A, B, keys } from '../../lib/my-trusthub/profile-save/final-wiring.test.ts';
import { sessionMac, sessionMacKey } from '../../lib/my-trusthub/profile-save/session-authority.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';
import { createPacketBinding } from './v23-sql-closeout-cases.mjs';

const PREVIEW = 'xkkiicsassizmakcvxml', PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const root = 'docs/my-trusthub/v2/final-parent-wiring/', prod = 'docs/my-trusthub/v2/production/';
const mover = (usdot, slug, legalName) => ({ profile: { hub: 'move', nativeId: 'usdot-' + usdot, profileClass: 'mover' }, usdot, slug, legalName });
const HINDMAN = { profile: TEST_PROFILE, usdot: '1002530', slug: TEST_SLUG, legalName: 'HINDMAN & ISAACS MOVING & STORAGE INC' };
const GENTLE = mover('373544', 'gentle-giant-moving', 'GENTLE GIANT INTERSTATE COMPANY LLC');
const CARAWAY = mover('1684331', 'caraway-moving-inc', 'CARAWAY MOVING INC');
const UNBOUND = mover('5550001', 'fixture-unbound-mover', 'FIXTURE UNBOUND MOVER LLC');
const AMBIGUOUS = mover('5550002', 'fixture-ambiguous-mover', 'FIXTURE AMBIGUOUS MOVER LLC');
const REVIEW = mover('5550003', 'fixture-review-mover', 'FIXTURE REVIEW MOVER LLC');
const UNPUBLISHED = mover('5550004', 'fixture-unpublished-mover', 'FIXTURE UNPUBLISHED MOVER LLC');
const SPLIT = mover('5550005', 'fixture-split-identity-mover', 'FIXTURE SPLIT IDENTITY MOVER LLC');

// The preview resolver packet is the production packet with preview identifiers.
{
  const strip = text => text.slice(text.indexOf('begin;')).replace(/\r\n/g, '\n');
  const expected = strip(readFileSync(prod + '09-ask-prod-move-binding-resolver-forward.sql', 'utf8'))
    .replaceAll(PRODUCTION, PREVIEW).replaceAll('prod_move', 'preview_move').replaceAll('myth_v23_prod_reader', 'myth_v23_preview_reader')
    .replaceAll('myth_v23_parent_prod', 'myth_v23_parent_preview').replaceAll('V23_PROD_', 'V23_PREVIEW_')
    .replaceAll('Explicit production authorization required', 'Explicit isolated apply authorization required').replaceAll('02-ask-prod-ports-forward.sql', 'ports-forward.sql');
  assert.equal(strip(readFileSync(root + 'move-binding-resolver-forward.sql', 'utf8')), expected);
  console.log('PASS resolver packet: preview copy is the production packet with preview identifiers only');
}

const bootstrap = new PGlite();
const emptyCluster = await bootstrap.dumpDataDir();
await bootstrap.close();
const db = new PGlite({ database: 'postgres', loadDataDir: emptyCluster, extensions: { btree_gist, pgcrypto } });
try {
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
  const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.query('insert into auth.users values($1),($2)', [A, B]);
  const signing = keys(), exp = Math.floor(Date.now() / 1000) + 110;
  await db.query('select v23_private.preview_session_install_mac($1)', [sessionMacKey(signing.privateKey.pem)]);
  await createPacketBinding(db); // the Hindman reference binding, through its own packet

  // The resolver packet refuses without the base ports and applies exactly once.
  await db.exec(readFileSync(root + 'move-binding-resolver-forward.sql', 'utf8'));
  await assert.rejects(db.exec(readFileSync(root + 'move-binding-resolver-forward.sql', 'utf8')), /already applied/);
  await db.exec('rollback');
  console.log('PASS resolver packet: applies once, verifies the Hindman reference, refuses a re-run');

  // Per-mover binding packet (the production file, run under the production
  // attestation it demands) for the two additional widening canary movers.
  const packet = readFileSync(prod + '10-ask-prod-move-mover-binding.sql', 'utf8');
  const preflightSql = /\nselect current_setting\('v23bind\.usdot'\)[\s\S]*?existing_entities;/.exec(packet)[0];
  const forwardSql = packet.slice(packet.indexOf('begin isolation level serializable;'), packet.indexOf('commit;') + 'commit;'.length);
  async function bindMover(m) {
    await db.query(`select set_config('v23.approved_project',$1,false),set_config('v23bind.usdot',$2,false),set_config('v23bind.legal_name',$3,false),set_config('v23bind.slug',$4,false)`,
      [PRODUCTION, m.usdot, m.legalName, m.slug]);
    const before = (await db.query(preflightSql)).rows[0];
    assert.deepEqual([Number(before.existing_bindings), Number(before.existing_entities)], [0, 0]);
    await db.exec(`set v23.binding_creation_authorized='true'; set v23bind.candidate_unchanged='true'; set v23bind.evidence_ref='local-sql-packet-fixture-only';
      select set_config('v23bind.preflight_checked_at',clock_timestamp()::text,false);`);
    const applied = (await db.exec(forwardSql)).flatMap(r => r.rows || []).find(r => r.binding_id);
    assert.ok(applied?.binding_id && applied.network_entity_id);
    await db.exec('reset role');
    // A second run for the same mover is refused; nothing is upserted or merged.
    await assert.rejects(db.exec(forwardSql), /Existing identity requires steward review/);
    await db.exec('rollback; reset role');
    const after = (await db.query(preflightSql)).rows[0];
    assert.deepEqual([Number(after.existing_bindings), Number(after.existing_entities)], [1, 1]);
    await db.exec(`set v23.binding_creation_authorized=''; set v23bind.evidence_ref='';`);
    await db.query(`select set_config('v23.approved_project',$1,false)`, [PREVIEW]);
    return applied;
  }
  const gentle = await bindMover(GENTLE), caraway = await bindMover(CARAWAY);
  // The packet refuses a malformed identity and a missing authorization.
  await db.query(`select set_config('v23.approved_project',$1,false),set_config('v23bind.usdot','12a',false)`, [PRODUCTION]);
  await assert.rejects(db.exec(forwardSql)); await db.exec('rollback; reset role');
  await db.query(`select set_config('v23.approved_project',$1,false)`, [PREVIEW]);
  await assert.rejects(db.exec(forwardSql), /authorization required/); await db.exec('rollback; reset role');
  console.log('PASS binding packet: one entity + one accepted binding per mover, re-run refused, guards hold');

  // Fixture identities for the negative cases (direct steward-style inserts).
  const entity = async (name, slug, status = 'active') => (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
    values('organization',$1,'move','US',$2,$3) returning id`, [name, '/companies/' + slug, status])).rows[0].id;
  const bind = (entityId, m, status, patch = {}) => db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref) values($1,'move',$2,$3,'fmcsa.usdot',$4,$5,$6,now()-interval '1 minute','fixture-only')`,
    [entityId, patch.type ?? 'mover', patch.nativeId ?? m.profile.nativeId, patch.usdot ?? m.usdot, 'jurisdiction' in patch ? patch.jurisdiction : 'US', status]);
  await bind(await entity(AMBIGUOUS.legalName, AMBIGUOUS.slug), AMBIGUOUS, 'accepted');
  // The schema already forbids two overlapping accepted bindings for one (hub,
  // namespace, jurisdiction, identifier). A second accepted claim can still
  // exist under another jurisdiction key; the resolver must see it and refuse.
  await assert.rejects(bind(await entity(AMBIGUOUS.legalName + ' (same-key claim)', AMBIGUOUS.slug + '-1'), AMBIGUOUS, 'accepted', { nativeId: 'fixture-same-key-id' }), /exclusion constraint/);
  await bind(await entity(AMBIGUOUS.legalName + ' (second claim)', AMBIGUOUS.slug + '-2'), AMBIGUOUS, 'accepted', { nativeId: 'fixture-other-id', jurisdiction: null });
  await bind(await entity(REVIEW.legalName, REVIEW.slug), REVIEW, 'review_required');
  await bind(await entity(UNPUBLISHED.legalName, UNPUBLISHED.slug), UNPUBLISHED, 'accepted');
  await bind(await entity(SPLIT.legalName, SPLIT.slug), SPLIT, 'accepted', { usdot: '5559999' }); // native id and number disagree

  const pool = { connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) };
  const store = new PreviewStore(pool);
  await store.bind(A, sidA, exp, sessionMac(signing.privateKey.pem, A, sidA, exp));
  await store.bind(B, sidB, exp, sessionMac(signing.privateKey.pem, B, sidB, exp));

  // SQL resolver contract, as the runtime role.
  const resolve = id => store.authorized(async d => (await d.query('select * from v23_private.preview_move_binding_for($1)', [id])).rows);
  assert.equal((await resolve(HINDMAN.profile.nativeId)).length, 1);
  assert.deepEqual((await resolve(GENTLE.profile.nativeId)).map(r => [r.id, r.network_entity_id, r.binding_status, r.specialist_entity_type, r.specialist_entity_id, r.identifier_namespace, r.source_identifier, r.jurisdiction, r.entity_status]),
    [[gentle.binding_id, gentle.network_entity_id, 'accepted', 'mover', 'usdot-373544', 'fmcsa.usdot', '373544', 'US', 'active']]);
  assert.equal((await resolve(UNBOUND.profile.nativeId)).length, 0);
  assert.equal((await resolve(AMBIGUOUS.profile.nativeId)).length, 2);
  assert.deepEqual((await resolve(REVIEW.profile.nativeId)).map(r => r.binding_status), ['review_required']);
  for (const bad of ['usdot-0', 'usdot-', '%', 'usdot-373544 ', "usdot-1' or '1'='1", 'gentle-giant-moving', 'GENTLE GIANT INTERSTATE COMPANY LLC', gentle.network_entity_id, gentle.binding_id, ''])
    assert.equal((await resolve(bad)).length, 0, bad);
  // No runtime role can read the identity tables themselves.
  for (const role of ['myth_v23_authorizer', 'myth_v23_executor']) for (const table of ['network.network_entity_bindings', 'network.network_entities']) {
    await db.exec(`begin; set local role ${role}`);
    await assert.rejects(db.query(`select 1 from ${table} limit 1`)); await db.exec('rollback');
  }
  console.log('PASS SQL resolver: exact identity only, <=3 rows, no name/slug/uuid lookup, no direct table access for runtime roles');

  // Move source channel fixture: Move's own publication verdict per identity.
  const key = keys(), move = keys();
  const published = new Map([HINDMAN, GENTLE, CARAWAY, UNBOUND, AMBIGUOUS, REVIEW, SPLIT].map(m => [m.profile.nativeId, m.slug]));
  let sourceSnapshot = null; const acknowledged = [];
  const source = new SourceChannel(key.privateKey, undefined, async (_target, init) => {
    const body = JSON.parse(Buffer.from(init.body).toString());
    if (body.action === 'resolve') {
      const slug = supportedMoveProfile(body.profile) ? published.get(body.profile.nativeId) : null;
      if (!slug) return Response.json({ ok: false, error: 'unavailable' }, { status: 503 });
      return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: slug, publicationState: 'PUBLISHABLE', reviewedClass: 'mover', checkedAt: Date.now() } });
    }
    if (body.action === 'source') return Response.json({ ok: true, result: sourceSnapshot });
    if (body.action === 'acknowledge') { acknowledged.push(body.receipts.map(r => r.parent.outcome).join()); return Response.json({ ok: true }); }
    throw Error('Unexpected source operation');
  });
  let parent = null;
  // Owner-scoped removal exactly as production: the signed-in user's own list
  // and the P12 remove RPC, intersected with the verified session's Saves.
  const asUser = (subject, sql, values = []) => db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)`, [subject, JSON.stringify({ sub: subject })]);
    return (await tx.query(sql, values)).rows;
  });
  const removeSaved = async (p, networkEntityId) => {
    const owned = new Set((await store.authorized(d => d.query('select saved_entity_id from v23_private.preview_saved($1,$2)', [p.subject, p.session]))).rows.map(r => r.saved_entity_id));
    const rows = (await asUser(p.subject, 'select saved_entity_id,stored_network_entity_id,resolved_network_entity_id,removed_at,cardinality(project_ids) as projects from consumer.list_saved_entities()'))
      .filter(r => !r.removed_at && owned.has(r.saved_entity_id) && (r.stored_network_entity_id === networkEntityId || r.resolved_network_entity_id === networkEntityId));
    if (rows.some(r => r.projects > 0)) return 'in_project';
    for (const r of rows) {
      const version = (await asUser(p.subject, 'select row_version from consumer.consumer_saved_entities where id=$1', [r.saved_entity_id]))[0].row_version;
      await asUser(p.subject, 'select consumer.remove_saved_entity($1,$2)', [r.saved_entity_id, version]);
    }
    return rows.length > 0;
  };
  const runtime = () => new PreviewAssembly(fixtureEnv, pool, source, move.publicKey, async () => parent, removeSaved);
  const browser = randomRef();
  const signed = (url, body, scope) => new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json',
    [ASSERTION_HEADER]: signAssertion(move.privateKey, 'move', url, scope, body, browser) } });
  const service = async (operation, input) => {
    const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input }));
    const response = await handleProfileSave(signed(ASK_PREVIEW + API_PATH, bytes, 'transfer:stage'), { enabled: true, runtimeForRequest: r => runtime().serviceRuntime(r) });
    return { status: response.status, body: await response.json() };
  };
  const bindingFor = async profile => {
    const bytes = Buffer.from(JSON.stringify({ action: 'binding', profile }));
    try { return await (await runtime().grantService(signed(ASK_PREVIEW + GRANT_API_PATH, bytes, 'transfer:stage'))).json(); }
    catch (error) { return { ok: false, error: error.code ?? 'error' }; }
  };
  const manifestFor = m => ({ version: 'v2-3/selected-profiles/3', sourceHub: 'move', audience: 'ask',
    selected: [{ localItemId: m.slug, revision: 'a'.repeat(64), digest: 'a'.repeat(64), profile: m.profile }],
    returnTask: { kind: 'profile', hub: 'move', profile: m.profile, canonicalSlug: m.slug, returnPath: '/companies/' + m.slug } });
  const saves = async (subject = A) => (await db.query(`select e.canonical_name,s.source_hub,s.identity_resolution_state,s.removed_at is null as active
    from consumer.consumer_saved_entities s join network.network_entities e on e.id=s.network_entity_id where s.user_id=$1 order by e.canonical_name`, [subject])).rows;
  const active = async (subject = A) => (await saves(subject)).filter(r => r.active).map(r => r.canonical_name);
  /** The whole one-click chain for one mover: signed stage, continuation,
   * cross-site arrival with an intent, then the follow-up GET. */
  async function click(m, intent) {
    const manifest = manifestFor(m);
    const stage = await service('prepareGuestProfileTransfer', manifest);
    if (stage.status !== 200) return { stage: stage.status };
    const continuation = await service('prepareProfileSaveContinuation', { sourceHub: 'move', audience: 'ask', transferRef: stage.body.result.transferRef, manifestDigest: stage.body.result.manifestDigest });
    assert.equal(continuation.status, 200, JSON.stringify(continuation.body));
    sourceSnapshot = { ...continuation.body.result, transferRef: stage.body.result.transferRef, manifest, manifestDigest: stage.body.result.manifestDigest, browserProof: browser, requestPrefix: randomRef() };
    const arrival = new Request(ASK_PREVIEW + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: continuation.body.result.continuationRef, intent }), headers: { origin: MOVE_PREVIEW } });
    const arrived = await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival));
    if (arrived.status !== 303) return { stage: 200, arrival: arrived.status };
    const get = new Request(ASK_PREVIEW + '/my/profile-save', { headers: { cookie: arrived.headers.get('set-cookie').split(';')[0] } });
    const done = await handleProfileConfirmation(get, await runtime().browserBindings(get));
    if (done.status !== 303) return { stage: 200, arrival: 303, status: done.status, page: await done.text() };
    return { stage: 200, arrival: 303, status: done.status, location: done.headers.get('location') };
  }
  const returned = m => ({ stage: 200, arrival: 303, status: 303, location: MOVE_PREVIEW + '/companies/' + m.slug });

  // A / G / O. Exact accepted binding -> the parent hands Move the binding and saves.
  for (const m of [HINDMAN, GENTLE, CARAWAY]) {
    const answer = await bindingFor(m.profile);
    assert.equal(answer.ok, true, m.slug); assert.deepEqual(answer.result.profile, m.profile); assert.equal(answer.result.binding.status, 'accepted');
  }
  assert.equal((await bindingFor(GENTLE.profile)).result.binding.id, gentle.binding_id);
  assert.equal((await bindingFor(CARAWAY.profile)).result.binding.networkEntityId, caraway.network_entity_id);
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  for (const m of [GENTLE, CARAWAY, HINDMAN]) assert.deepEqual(await click(m, 'save'), returned(m), m.slug);
  assert.deepEqual(await saves(), [CARAWAY, GENTLE, HINDMAN].map(m => ({ canonical_name: m.legalName, source_hub: 'move', identity_resolution_state: 'accepted', active: true })));
  assert.deepEqual(acknowledged, ['saved', 'saved', 'saved']);
  console.log('PASS A/G/O: two non-Hindman movers and the Hindman reference resolve by exact identity and save once each, attributed to Move');

  // H. Repeated Save: exactly one row per mover.
  for (const m of [GENTLE, GENTLE, CARAWAY]) assert.deepEqual(await click(m, 'save'), returned(m));
  assert.equal((await saves()).length, 3); assert.deepEqual(acknowledged.slice(3), ['already_saved', 'already_saved', 'already_saved']);
  // Another account's Saves are its own.
  parent = { subject: B, session: sidB, label: 'Fixture B' };
  assert.deepEqual(await click(GENTLE, 'save'), returned(GENTLE));
  assert.deepEqual(await active(B), [GENTLE.legalName]); assert.equal((await saves(A)).length, 3);
  console.log('PASS H: repeated Save never duplicates; Saves are per owner');

  // I. Unsave removes only the verified owner's matching row.
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  acknowledged.length = 0;
  assert.deepEqual(await click(GENTLE, 'unsave'), returned(GENTLE));
  assert.deepEqual(await active(A), [CARAWAY.legalName, HINDMAN.legalName]); assert.deepEqual(await active(B), [GENTLE.legalName]);
  assert.deepEqual(acknowledged, ['local_only']);
  // Save again restores the same row rather than creating a second one.
  assert.deepEqual(await click(GENTLE, 'save'), returned(GENTLE));
  assert.equal((await saves(A)).length, 3); assert.equal((await active(A)).length, 3);
  console.log('PASS I: Unsave removes the owner\'s row for that exact mover only; re-Save restores it');

  // J. Project membership conflict stays protected: nothing is detached, nothing is acknowledged.
  const project = (await asUser(A, "select consumer.create_project(gen_random_uuid(),'Move to Boston','moving') as id"))[0].id;
  const carawaySaved = (await asUser(A, 'select saved_entity_id,canonical_name from consumer.list_saved_entities()')).find(r => r.canonical_name === CARAWAY.legalName).saved_entity_id;
  await asUser(A, 'select consumer.add_saved_entity_to_project($1,$2,null)', [project, carawaySaved]);
  acknowledged.length = 0;
  const conflict = await click(CARAWAY, 'unsave');
  assert.equal(conflict.status, 200); assert.match(conflict.page, /filed in one of your Projects/);
  assert.ok(conflict.page.includes(`href="${MOVE_PREVIEW}/companies/${CARAWAY.slug}"`));
  assert.equal((await active(A)).includes(CARAWAY.legalName), true);
  // Even if the removal is attempted anyway, the P12 rule itself refuses it.
  const version = (await asUser(A, 'select row_version from consumer.consumer_saved_entities where id=$1', [carawaySaved]))[0].row_version;
  await assert.rejects(asUser(A, 'select consumer.remove_saved_entity($1,$2)', [carawaySaved, version]), /still belongs to one or more Projects/);
  assert.equal((await db.query('select count(*)::int n from consumer.consumer_project_saved_entities where saved_entity_id=$1 and removed_at is null', [carawaySaved])).rows[0].n, 1);
  assert.deepEqual(acknowledged, []);
  console.log('PASS J: a Saved mover filed in a Project is not removed, not detached, not acknowledged, and the customer is told why');

  // B/C/D/E/F and identity-grain disagreement: every one is denied before any Save.
  const before = JSON.stringify(await db.query('select id,network_entity_id,removed_at,row_version from consumer.consumer_saved_entities order by id'));
  // Move asks for the binding before it stages anything, so a denied binding
  // answer stops the Save at the source. Should a stage arrive anyway, the
  // commit re-proves publication and binding and fails closed: the browser is
  // returned to the profile with no Saved row and no acknowledgement.
  const unchanged = async () => JSON.stringify(await db.query('select id,network_entity_id,removed_at,row_version from consumer.consumer_saved_entities order by id'));
  const denied = async (m, label) => {
    // Keep the existing 10-per-minute hand-off limit out of these cases so each
    // denial is for its own reason, not for rate limiting.
    await db.exec('delete from ops.consumer_rate_limit_events');
    assert.equal((await bindingFor(m.profile)).ok, false, label + ' binding');
    acknowledged.length = 0; await click(m, 'save');
    assert.equal(await unchanged(), before, label + ' save'); assert.deepEqual(acknowledged, [], label + ' acknowledgement');
  };
  await denied(UNPUBLISHED, 'B unpublished');
  await denied(UNBOUND, 'D missing binding');
  await denied(AMBIGUOUS, 'E ambiguous binding');
  await denied(REVIEW, 'F review_required binding');
  await denied(SPLIT, 'identity grain disagreement');
  for (const profile of [{ ...GENTLE.profile, profileClass: 'broker' }, { ...GENTLE.profile, profileClass: 'auto_transport' }, { ...GENTLE.profile, hub: 'lender' },
    { ...GENTLE.profile, nativeId: 'gentle-giant' }, { ...GENTLE.profile, nativeId: gentle.network_entity_id }, { ...GENTLE.profile, name: 'Gentle Giant' }]) {
    assert.equal((await bindingFor(profile)).ok, false, 'C ' + JSON.stringify(profile));
    assert.notEqual((await service('prepareGuestProfileTransfer', { ...manifestFor(GENTLE), selected: [{ ...manifestFor(GENTLE).selected[0], profile }], returnTask: { ...manifestFor(GENTLE).returnTask, profile } })).status, 200);
  }
  // A mover that stops being published at Move is denied at the next Save even with an accepted binding.
  published.delete(CARAWAY.profile.nativeId);
  await denied(CARAWAY, 'unpublished after binding');
  published.set(CARAWAY.profile.nativeId, CARAWAY.slug);
  // A binding that becomes ambiguous or review_required after the fact is denied too.
  await bind(await entity('GENTLE GIANT (competing claim)', 'gentle-giant-moving-2'), GENTLE, 'review_required', { nativeId: 'fixture-competing-id' });
  await denied(GENTLE, 'binding became ambiguous');
  // ...and its Unsave is refused too: an ambiguous identity is never acted on.
  await click(GENTLE, 'unsave'); assert.equal(await unchanged(), before); assert.deepEqual(acknowledged, []);
  console.log('PASS B/C/D/E/F: unpublished, unsupported class, missing, ambiguous, review_required and grain-mismatched identities are all denied; no Saved row changes');

  // The existing hand-off limit still applies per session: the 11th account
  // Save inside a minute fails closed (device Save only), nothing is duplicated.
  await db.exec('delete from ops.consumer_rate_limit_events');
  await db.query(`update network.network_entity_bindings set binding_status='invalid' where specialist_entity_id='fixture-competing-id'`);
  acknowledged.length = 0;
  for (let i = 0; i < 12; i++) await click(GENTLE, 'save');
  assert.equal(acknowledged.length, 10); assert.deepEqual([...new Set(acknowledged)], ['already_saved']);
  assert.equal(JSON.parse(await unchanged()).rows.length, JSON.parse(before).rows.length);

  // L. Signed out: the chain returns to the profile and saves nothing.
  await db.exec('delete from ops.consumer_rate_limit_events; delete from ops.v23_profile_runtime_quota');
  parent = null;
  const count = (await db.query('select count(*)::int n from consumer.consumer_saved_entities where removed_at is null')).rows[0].n;
  assert.deepEqual(await click(HINDMAN, 'save'), returned(HINDMAN));
  assert.equal((await db.query('select count(*)::int n from consumer.consumer_saved_entities where removed_at is null')).rows[0].n, count);

  // K. No Watch or Alert relation exists on this path and no transaction authority leaks.
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema in ('consumer','ops','network','v23_private') and table_name ~* '(watch|alert)'")).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from v23_private.transaction_authority')).rows[0].n, 0);
  console.log('PASS K/L: signed-out Save changes nothing in the account; zero Watch/Alert relations; no leaked transaction authority');

  // Rollback of the resolver removes exactly its three objects and the runtime fails closed.
  await db.exec(`drop function v23_private.preview_move_binding_for(text);
    drop policy preview_move_mover_bindings on network.network_entity_bindings; drop policy preview_move_mover_entities on network.network_entities;`);
  assert.equal((await db.query('select * from v23_private.preview_move_binding()')).rows.length, 1, 'the one-mover reference function is untouched');
  assert.equal((await bindingFor(HINDMAN.profile)).ok, false);
  console.log('PASS rollback: resolver removed, one-mover reference objects untouched, runtime fails closed');
} finally { await db.close(); }
