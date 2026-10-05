// Local embedded PostgreSQL ONLY. Proves the per-hub account context on the
// PRODUCTION target shape with the real packets: 02/04/05 (ports, runtime role,
// session authority), 03 + 09 (Move reference binding + resolver), 12 (Lender
// NMLS bindings), 13 (Insurance state-license bindings) and 15 (per-hub account
// context issuer). Move, Lender and Insurance each run the whole one-click
// chain through the real continuation consume. Auth and the specialist source
// channels are explicit fixtures. Nothing here contacts a hosted database or
// any specialist.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PreviewAssembly } from '../../lib/my-trusthub/profile-save/preview-assembly.ts';
import { PreviewStore, randomRef } from '../../lib/my-trusthub/profile-save/preview-store.ts';
import { SourceChannel } from '../../lib/my-trusthub/profile-save/source-channel.ts';
import { LenderSourceChannel } from '../../lib/my-trusthub/profile-save/lender-channel.ts';
import { LENDER_PRODUCTION_PINS, signLenderAssertion, verifyLenderAssertion } from '../../lib/my-trusthub/profile-save/lender-assertion.ts';
import { INSURANCE_PRODUCTION_PINS, signInsuranceAssertion, verifyInsuranceAssertion } from '../../lib/my-trusthub/profile-save/insurance-assertion.ts';
import { insuranceProfileDigest } from '../../lib/my-trusthub/profile-save/insurance-manifest.ts';
import { InsuranceAckChannel } from '../../lib/my-trusthub/profile-save/insurance-channel.ts';
import { handleProfileConfirmation } from '../../lib/my-trusthub/profile-save/browser.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { ASSERTION_HEADER, signAssertion, verifyAssertion } from '../../lib/my-trusthub/profile-save/service-assertion.ts';
import { API_PATH, PRODUCTION_TARGET } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { sessionMac } from '../../lib/my-trusthub/profile-save/session-authority.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const ASK = 'https://www.asktrusthub.com', MOVE = 'https://www.movetrusthub.com', LENDER = 'https://www.lendertrusthub.com', INSURANCE = 'https://www.insurancetrusthub.com', CONTRACTOR = 'https://www.contractortrusthub.com';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ENV = {
  VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
  MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: ASK,
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: `https://${PRODUCTION}.supabase.co`,
  MY_TRUSTHUB_V23_PARENT_ORIGIN: ASK, MY_TRUSTHUB_V23_MOVE_ORIGIN: MOVE,
  MY_TRUSTHUB_V23_PRODUCTION_PROJECT: PRODUCTION, MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated',
};
function keys(kid) {
  const pair = generateKeyPairSync('ed25519');
  return { privateKey: { kid, pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid, pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } };
}
const HINDMAN = { hub: 'move', origin: MOVE, slug: 'hindman-isaacs-moving-storage-inc', returnPath: '/companies/hindman-isaacs-moving-storage-inc',
  legalName: 'HINDMAN & ISAACS MOVING & STORAGE INC', profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' } };
const FREEDOM = { hub: 'lender', origin: LENDER, slug: 'freedom-mortgage', returnPath: '/lenders/freedom-mortgage',
  legalName: 'Freedom Mortgage', profile: { hub: 'lender', nativeId: 'nmls:2767', profileClass: 'marketplace_company' } };
const LOANDEPOT = { hub: 'lender', origin: LENDER, slug: 'loandepot', returnPath: '/lenders/loandepot',
  legalName: 'loanDepot', profile: { hub: 'lender', nativeId: 'nmls:174457', profileClass: 'marketplace_company' } };
const ASFIN = { hub: 'insurance', origin: INSURANCE, slug: 'asfin-llc-l106287', returnPath: '/providers/asfin-llc-l106287', legalName: 'ASFIN LLC',
  jurisdiction: 'FL', license: 'L106287', profile: { hub: 'insurance', nativeId: 'state-license:FL:L106287', profileClass: 'insurance_provider' } };
const IMT = { hub: 'insurance', origin: INSURANCE, slug: 'imt-services-llc-1365714', returnPath: '/providers/imt-services-llc-1365714', legalName: 'IMT SERVICES, LLC',
  jurisdiction: 'TX', license: '1365714', profile: { hub: 'insurance', nativeId: 'state-license:TX:1365714', profileClass: 'insurance_provider' } };

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
  const ask = keys('ask-fixture'), move = keys('move-fixture'), lender = keys('lender-fixture'), insurance = keys('insurance-fixture');
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  await db.exec(read('02-ask-prod-ports-forward.sql'));
  await db.exec(`set v23.binding_creation_authorized='true'; set v23bind.candidate_unchanged='true'; set v23bind.evidence_ref='local-sql-packet-fixture-only';
    select set_config('v23bind.preflight_checked_at',clock_timestamp()::text,false);`);
  await db.exec(read('03-ask-prod-move-binding-forward.sql')); await db.exec('reset role');
  await db.exec(read('04-ask-prod-runtime-role-forward.sql'));
  await db.query(`select set_config('v23.install_session_mac',$1,false)`, [createHash('sha256').update(ask.privateKey.pem).digest('hex')]);
  await db.exec(read('05-ask-prod-session-mac-install.sql'));
  await db.exec(read('09-ask-prod-move-binding-resolver-forward.sql'));
  await db.exec(`set v23bind.nmls_consumer_access_checked='true'`);
  await db.exec(read('12-ask-prod-lender-nmls-binding-forward.sql'));
  await db.exec(`set v23bind.insurance_state_license_checked='true'`);
  await db.exec(read('13-ask-prod-insurance-state-license-binding-forward.sql'));
  console.log('PASS production packets 02, 03, 04, 05, 09, 12 and 13 apply unmodified on the embedded database');

  const pool = { connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) };
  const store = new PreviewStore(pool, PRODUCTION_TARGET);
  const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 110;
  await db.query('insert into auth.users values($1),($2)', [A, B]);
  await store.bind(A, sidA, exp, sessionMac(ask.privateKey.pem, A, sidA, exp, PRODUCTION));
  await store.bind(B, sidB, exp, sessionMac(ask.privateKey.pem, B, sidB, exp, PRODUCTION));

  // Specialist fixtures. Each verifies Ask's signature the way the specialist does.
  const acknowledged = []; // [hub, outcome]
  const nonceSet = new Set(); const nonces = { claim: async k => !nonceSet.has(k) && !!nonceSet.add(k) };
  let moveSnapshot = null;
  const moveSource = new SourceChannel(ask.privateKey, undefined, async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    await verifyAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', body.action === 'acknowledge' ? 'source:ack' : 'source:read', nonces, Date.now(), PRODUCTION_TARGET);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: HINDMAN.slug, publicationState: 'PUBLISHABLE', reviewedClass: 'mover', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: moveSnapshot });
    acknowledged.push(['move', body.receipts.map(r => r.parent.outcome).join()]); return Response.json({ ok: true });
  }, PRODUCTION_TARGET);
  const lenderSlugs = new Map([[FREEDOM.profile.nativeId, FREEDOM.slug], [LOANDEPOT.profile.nativeId, LOANDEPOT.slug]]);
  const lenderFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    const claims = await verifyLenderAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', body.action === 'acknowledge' ? 'source:ack' : 'source:read', nonces);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: lenderSlugs.get(body.profile.nativeId), publicationState: 'PUBLISHABLE', reviewedClass: 'marketplace_company', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: body.manifest,
      manifestDigest: body.manifestDigest, browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser } });
    if (!body.receipts.every(r => r.requestKey.startsWith(claims.browser + ':'))) return Response.json({ ok: false }, { status: 403 });
    acknowledged.push(['lender', body.receipts.map(r => r.parent.outcome).join()]); return Response.json({ ok: true, result: { watchCreated: false } });
  };
  // Insurance accepts only the acknowledgement, exactly as its deployed source route does.
  const insuranceFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    if (body.action !== 'acknowledge' || Object.keys(body).sort().join() !== 'action,continuationRef,receipts') return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
    let claims;
    try { claims = await verifyInsuranceAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', 'source:ack', nonces); }
    catch { return Response.json({ ok: false, error: 'unauthorized' }, { status: 403 }); }
    const receipt = body.receipts[0];
    if (body.receipts.length !== 1 || receipt.localCopy !== 'keep' || 'watch' in receipt || 'watchCreated' in receipt ||
      !['saved', 'already_saved', 'local_only'].includes(receipt.parent.outcome) || !receipt.requestKey.startsWith(claims.browser + ':') ||
      receipt.item.profile.hub !== 'insurance' || receipt.item.profile.profileClass !== 'insurance_provider' ||
      !/^state-license:[A-Z]{2}:[A-Z0-9]{3,32}$/.test(receipt.item.profile.nativeId)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 403 });
    acknowledged.push(['insurance', receipt.parent.outcome]);
    return Response.json({ ok: true, result: { acknowledged: receipt.parent.outcome === 'local_only' ? 'unsave' : 'save', watchCreated: false } });
  };

  let parent = null;
  const asUser = (subject, sql, values = []) => db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)`, [subject, JSON.stringify({ sub: subject })]);
    return (await tx.query(sql, values)).rows;
  });
  const removeSaved = async (p, networkEntityId) => {
    const owned = new Set((await store.authorized(d => d.query('select saved_entity_id from v23_private.prod_saved($1,$2)', [p.subject, p.session]))).rows.map(r => r.saved_entity_id));
    const rows = (await asUser(p.subject, 'select saved_entity_id,stored_network_entity_id,resolved_network_entity_id,removed_at,cardinality(project_ids) as projects from consumer.list_saved_entities()'))
      .filter(r => !r.removed_at && owned.has(r.saved_entity_id) && (r.stored_network_entity_id === networkEntityId || r.resolved_network_entity_id === networkEntityId));
    if (rows.some(r => r.projects > 0)) return 'in_project';
    for (const r of rows) {
      const version = (await asUser(p.subject, 'select row_version from consumer.consumer_saved_entities where id=$1', [r.saved_entity_id]))[0].row_version;
      await asUser(p.subject, 'select consumer.remove_saved_entity($1,$2)', [r.saved_entity_id, version]);
    }
    return rows.length > 0;
  };
  const runtime = () => {
    const assembly = new PreviewAssembly(ENV, pool, moveSource, move.publicKey, async () => parent, removeSaved);
    assembly.lenderKey = lender.publicKey; assembly.lenderSource = new LenderSourceChannel(ask.privateKey, lenderFetch, LENDER_PRODUCTION_PINS);
    assembly.insuranceKey = insurance.publicKey; assembly.insuranceSource = new InsuranceAckChannel(ask.privateKey, insuranceFetch, INSURANCE_PRODUCTION_PINS);
    return assembly;
  };
  const bindings = { enabled: true, runtimeForRequest: r => runtime().serviceRuntime(r), acceptInsuranceManifest: r => runtime().acceptInsuranceManifest(r) };
  const post = async (bytes, assertion) => {
    const response = await handleProfileSave(new Request(ASK + API_PATH, { method: 'POST', body: bytes, headers: { 'content-type': 'application/json', [ASSERTION_HEADER]: assertion } }), bindings);
    return { status: response.status, body: await response.json() };
  };
  const signFor = { move: (bytes, browser) => signAssertion(move.privateKey, 'move', ASK + API_PATH, 'transfer:stage', bytes, browser, null, null, Date.now(), PRODUCTION_TARGET),
    lender: (bytes, browser) => signLenderAssertion(lender.privateKey, 'lender', ASK + API_PATH, 'transfer:stage', bytes, browser),
    insurance: (bytes, browser) => signInsuranceAssertion(insurance.privateKey, 'insurance', ASK + API_PATH, 'transfer:stage', bytes, browser) };
  const manifestFor = m => ({ version: 'v2-3/selected-profiles/3', sourceHub: m.hub, audience: 'ask',
    selected: [{ localItemId: m.slug, revision: m.hub === 'move' ? 'a'.repeat(64) : '1', digest: 'a'.repeat(64), profile: m.profile }],
    returnTask: { kind: 'profile', hub: m.hub, profile: m.profile, canonicalSlug: m.slug, returnPath: m.returnPath } });
  const closedInsuranceManifest = m => {
    const profile = { hub: 'insurance', profileClass: 'insurance_provider', identifierNamespace: 'insurance.state_license', sourceIdentifier: m.license, jurisdiction: m.jurisdiction, canonicalReturnPath: m.returnPath };
    return { version: 'v2-3/selected-profiles/3', sourceHub: 'insurance', audience: 'ask', selected: [{ localItemId: m.slug, revision: '1', digest: insuranceProfileDigest(profile), profile }],
      returnTask: { kind: 'profile', hub: 'insurance', canonicalSlug: m.slug, profile, canonicalReturnPath: m.returnPath } };
  };
  /** Stage one profile the way its specialist does and return the continuation. */
  async function stage(m, browser = randomRef()) {
    if (m.hub === 'insurance') {
      const bytes = Buffer.from(JSON.stringify(closedInsuranceManifest(m)));
      const staged = await post(bytes, signFor.insurance(bytes, browser));
      return staged.status === 200 ? { status: 200, continuationRef: staged.body.result.continuationRef, browser } : { status: staged.status };
    }
    const service = async (operation, input) => { const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input })); return post(bytes, signFor[m.hub](bytes, browser)); };
    const manifest = manifestFor(m);
    const staged = await service('prepareGuestProfileTransfer', manifest);
    if (staged.status !== 200) return { status: staged.status };
    const continuation = await service('prepareProfileSaveContinuation', { sourceHub: m.hub, audience: 'ask', transferRef: staged.body.result.transferRef, manifestDigest: staged.body.result.manifestDigest });
    assert.equal(continuation.status, 200, JSON.stringify(continuation.body));
    if (m.hub === 'move') moveSnapshot = { ...continuation.body.result, transferRef: staged.body.result.transferRef, manifest, manifestDigest: staged.body.result.manifestDigest, browserProof: browser, requestPrefix: randomRef() };
    return { status: 200, continuationRef: continuation.body.result.continuationRef, browser };
  }
  /** Top-level arrival from the specialist origin with an intent, then the follow-up GET. */
  async function arrive(m, continuationRef, intent, from = m.origin) {
    const arrival = new Request(ASK + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef, intent }), headers: { origin: from } });
    const arrived = await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival));
    if (arrived.status !== 303) return { arrival: arrived.status };
    const cookie = arrived.headers.get('set-cookie').split(';')[0];
    const get = new Request(ASK + '/my/profile-save', { headers: { cookie } });
    const done = await handleProfileConfirmation(get, await runtime().browserBindings(get));
    return { arrival: 303, status: done.status, location: done.headers.get('location'), cookie };
  }
  async function click(m, intent) {
    const staged = await stage(m);
    if (staged.status !== 200) return { stage: staged.status };
    const { cookie: _cookie, ...result } = await arrive(m, staged.continuationRef, intent);
    return { stage: 200, ...result };
  }
  const returned = m => ({ stage: 200, arrival: 303, status: 303, location: m.origin + m.returnPath });
  const saves = async (subject = A) => (await db.query(`select e.canonical_name,s.source_hub,s.removed_at is null as active
    from consumer.consumer_saved_entities s join network.network_entities e on e.id=s.network_entity_id where s.user_id=$1 order by e.canonical_name`, [subject])).rows;
  const active = async (subject = A) => (await saves(subject)).filter(r => r.active).map(r => r.canonical_name).sort();
  const snapshot = async () => JSON.stringify((await db.query('select id,user_id,network_entity_id,removed_at,row_version from consumer.consumer_saved_entities order by id')).rows);
  const quiet = () => db.exec('delete from ops.consumer_rate_limit_events; delete from ops.v23_profile_runtime_quota');
  const handoffs = async () => (await db.query(`select issuer_hub,audience_hub,initiating_origin,status from ops.consumer_auth_handoffs order by created_at`)).rows;

  const userA = { subject: A, session: sidA, label: 'Fixture A' }, userB = { subject: B, session: sidB, label: 'Fixture B' };
  const contextForward = read('15-ask-prod-hub-account-context-forward.sql'), contextRollback = read('15-ask-prod-hub-account-context-rollback.sql');
  const issuer = async name => JSON.stringify((await db.query(`select prosrc,proowner::regrole::text as owner,proacl::text as acl from pg_proc where oid=to_regprocedure($1)`, [name])).rows[0] ?? null);
  const moveIssuerBefore = await issuer('v23_private.prod_issue_context(jsonb,uuid,uuid)');

  // ---- BEFORE packet 15 -------------------------------------------------
  // Move issues and consumes as 'move' and works. Lender and Insurance stage,
  // but cannot obtain a context for their hub, so the Save fails closed: no
  // Saved row and no acknowledgement. (On the unmodified runtime the context is
  // issued as 'move' and the consume itself is refused; see the SQL trace below.)
  parent = userA;
  assert.deepEqual(await click(HINDMAN, 'save'), returned(HINDMAN));
  assert.deepEqual(await active(), [HINDMAN.legalName]);
  assert.deepEqual(acknowledged, [['move', 'saved']]);
  assert.deepEqual(await handoffs(), [{ issuer_hub: 'move', audience_hub: 'ask', initiating_origin: MOVE, status: 'consumed' }]);
  for (const m of [FREEDOM, ASFIN]) {
    await quiet(); acknowledged.length = 0;
    const before = await snapshot();
    assert.deepEqual(await click(m, 'save'), returned(m), m.hub); // the browser is still returned to the profile
    assert.equal(await snapshot(), before, m.hub + ' wrote a Saved row without a context');
    assert.deepEqual(acknowledged, [], m.hub + ' acknowledged without a commit');
  }
  console.log('PASS before packet 15: Move saves; a Lender and an Insurance Save stage, write no Saved row and send no acknowledgement');

  // Root cause at the SQL contract: a context issued by the Move issuer is refused for any other consuming hub.
  const proofFor = () => ({ code: randomRef(), state: randomRef(), nonce: randomRef(), intent: randomRef(), creationKey: crypto.randomUUID(), targetOrigin: ASK, rateBucket: 'f'.repeat(64) });
  const consume = async (proof, hub, patch = {}) => (await db.query('select ok,error_code from ops.consume_consumer_auth_handoff($1,$2,$3,$4,$5,$6,$7)',
    [patch.code ?? proof.code, hub, 'ask', patch.target ?? proof.targetOrigin, patch.state ?? proof.state, patch.nonce ?? proof.nonce, proof.rateBucket])).rows[0];
  await quiet();
  const moveProof = proofFor();
  await store.authorized(d => d.query('select v23_private.prod_issue_context($1,$2,$3)', [JSON.stringify(moveProof), A, sidA]));
  assert.deepEqual(await consume(moveProof, 'lender'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  assert.deepEqual(await consume(moveProof, 'insurance'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  assert.deepEqual(await consume(moveProof, 'move'), { ok: true, error_code: null });
  console.log("PASS root cause: prod_issue_context issues as hub 'move'; consuming it as lender or insurance is INVALID_AUDIENCE, as move it succeeds");

  // The commit wraps that refusal. consume_context is what the Save calls, and
  // it raises 42501 ('P13 denied') when the issued hub is not the caller hub.
  // No Saved row is written. This is the unmodified issuer, before packet 15.
  const denied = proofFor();
  await quiet();
  await store.authorized(d => d.query('select v23_private.prod_issue_context($1,$2,$3)', [JSON.stringify(denied), A, sidA]));
  const savedBeforeDenial = await snapshot();
  const lenderAuthority = { hub: 'lender', audience: 'ask', service: 'svc:trusthub:lender:bff:v1', scopes: ['saved:write'],
    subject: A, session: 'ab'.repeat(32), browser: 'cd'.repeat(32), operation: 'consumeProfileSaveContinuation', exchangeProof: denied };
  await db.exec('begin');
  await db.query('set local role myth_v23_authorizer');
  await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(lenderAuthority)]);
  await db.query('set local role myth_v23_executor');
  await assert.rejects(db.query('select v23_private.consume_context($1)', [JSON.stringify(denied)]),
    error => error.code === '42501' && /P13 denied/.test(error.message));
  await db.exec('rollback');
  assert.equal(await snapshot(), savedBeforeDenial);
  // The refused consume rolls back, so the move-issued context is still issued.
  // Remove only that fixture before the packet-15 issued-row snapshot.
  const leftover = (await db.query(`select id, intent_id from ops.consumer_auth_handoffs where code_hash=ops.hash_handoff_secret($1)`, [denied.code])).rows[0];
  await db.query(`delete from ops.consumer_handoff_events where handoff_kind='auth' and handoff_ref=$1`, [leftover.id]);
  await db.query('delete from ops.consumer_auth_handoffs where id=$1', [leftover.id]);
  await db.query('delete from ops.consumer_browser_handoff_intents where id=$1', [leftover.intent_id]);
  console.log('PASS known failure: consuming the move-issued context as lender raises 42501 and writes no Saved row');

  // ---- packet 15 --------------------------------------------------------
  await assert.rejects(db.exec(contextRollback), /nothing to remove/); await db.exec('rollback');
  await db.exec(`set v23.approved_project=''`);
  await assert.rejects(db.exec(contextForward), /Explicit production authorization required/); await db.exec('rollback');
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  await db.exec(contextForward);
  await assert.rejects(db.exec(contextForward), /already applied/); await db.exec('rollback');
  await db.exec(contextRollback);
  assert.equal(await issuer('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'), 'null');
  await db.exec(contextForward);
  assert.equal(await issuer('v23_private.prod_issue_context(jsonb,uuid,uuid)'), moveIssuerBefore);
  const hubFn = JSON.parse(await issuer('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'));
  assert.equal(hubFn.owner, 'myth_v23_foundation');
  assert.match(hubFn.prosrc, /when 'contractor' then 'https:\/\/www\.contractortrusthub\.com'/);
  assert.match(hubFn.prosrc, /proof \? 'hub'/);
  assert.doesNotMatch(hubFn.prosrc, /proof->>'(hub|issuer|issuerHub|sourceHub)'/);
  console.log('PASS packet 15: one new function owned by the foundation role, guarded, re-run refused, rollback removes only it, the Move issuer is byte-identical, Contractor origin is pinned inside the function');

  // Shared hub allowlist. Contractor is admitted. Move, Investor, and any
  // browser-supplied hub key are refused. The lender five-strike sequence below
  // is unchanged and does not consume the Contractor context.
  const issue = (proof, hub, subject = A, session = sidA) => store.authorized(d => d.query('select v23_private.prod_hub_issue_context($1,$2,$3,$4)', [JSON.stringify(proof), subject, session, hub]));
  await quiet();
  for (const hub of ['move', 'investor', 'senior', 'ask', '', 'LENDER', 'lender ', 'contractor ', null]) await assert.rejects(issue(proofFor(), hub), /hub/, String(hub));
  for (const key of ['hub', 'issuer', 'issuerHub', 'sourceHub']) await assert.rejects(issue({ ...proofFor(), [key]: 'contractor' }, 'contractor'), /hub/, key);
  await assert.rejects(issue(proofFor(), 'lender', A, '99999999-9999-4999-8999-999999999999'), /session/); // no live verified session
  await assert.rejects(issue({ ...proofFor(), targetOrigin: LENDER }, 'lender'), /origin/);
  await assert.rejects(issue({ ...proofFor(), targetOrigin: CONTRACTOR }, 'contractor'), /origin/);
  await assert.rejects(issue({ ...proofFor(), code: 'short' }, 'lender'), /proof/);
  for (const role of ['myth_v23_executor', 'anon', 'authenticated']) {
    await db.exec(`begin; set local role ${role}`);
    await assert.rejects(db.query('select v23_private.prod_hub_issue_context($1,$2,$3,$4)', [JSON.stringify(proofFor()), A, sidA, 'lender'])); await db.exec('rollback');
  }
  const lenderProof = proofFor(), insuranceProof = proofFor(), contractorProof = proofFor();
  await issue(lenderProof, 'lender'); await issue(insuranceProof, 'insurance'); await issue(contractorProof, 'contractor');
  assert.equal((await db.query(`select nonce_hash = ops.hash_handoff_secret($2) as nonce_bound from ops.consumer_auth_handoffs where code_hash=ops.hash_handoff_secret($1)`, [contractorProof.code, contractorProof.nonce])).rows[0].nonce_bound, true);
  assert.deepEqual((await db.query(`select issuer_hub,initiating_origin,audience_hub,target_origin,extract(epoch from expires_at-created_at)::int as ttl from ops.consumer_auth_handoffs
    where status='issued' order by issuer_hub`)).rows, [
    { issuer_hub: 'contractor', initiating_origin: CONTRACTOR, audience_hub: 'ask', target_origin: ASK, ttl: 90 },
    { issuer_hub: 'insurance', initiating_origin: INSURANCE, audience_hub: 'ask', target_origin: ASK, ttl: 90 },
    { issuer_hub: 'lender', initiating_origin: LENDER, audience_hub: 'ask', target_origin: ASK, ttl: 90 }]);
  // I. wrong hub: a Lender context is not a Move or Insurance context, and the reverse.
  for (const hub of ['move', 'insurance', 'investor']) assert.deepEqual(await consume(lenderProof, hub), { ok: false, error_code: 'INVALID_AUDIENCE' }, hub);
  for (const hub of ['move', 'lender']) assert.deepEqual(await consume(insuranceProof, hub), { ok: false, error_code: 'INVALID_AUDIENCE' }, hub);
  // L. tampered state, nonce or target.
  assert.deepEqual(await consume(insuranceProof, 'insurance', { state: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  assert.deepEqual(await consume(insuranceProof, 'insurance', { nonce: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  assert.deepEqual(await consume(insuranceProof, 'insurance', { target: INSURANCE }), { ok: false, error_code: 'INVALID_AUDIENCE' });
  assert.deepEqual(await consume(insuranceProof, 'insurance', { code: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  // Five failed attempts revoke the context: the right hub can no longer use it either.
  assert.deepEqual(await consume(lenderProof, 'move'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  assert.deepEqual(await consume(lenderProof, 'move'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  assert.deepEqual(await consume(lenderProof, 'lender'), { ok: false, error_code: 'INVALID_STATE' });
  // K. single use.
  const once = proofFor(); await issue(once, 'lender');
  assert.deepEqual(await consume(once, 'lender'), { ok: true, error_code: null });
  assert.deepEqual(await consume(once, 'lender'), { ok: false, error_code: 'HANDOFF_ALREADY_USED' });
  // J. expired.
  const stale = proofFor(); await issue(stale, 'insurance');
  await db.query(`update ops.consumer_auth_handoffs set created_at=created_at-interval '2 minutes',expires_at=expires_at-interval '2 minutes' where code_hash=ops.hash_handoff_secret($1)`, [stale.code]);
  assert.deepEqual(await consume(stale, 'insurance'), { ok: false, error_code: 'HANDOFF_EXPIRED' });
  console.log('PASS context contract: lender, insurance, and contractor issued at their pinned origins with a 90 second lifetime; move, investor, senior, empty, unknown, and browser hub keys are refused; wrong hub, tampered, reused, and expired contexts are refused');

  // I-L. Contractor handoff contract. Consume is ops.consume_consumer_auth_handoff,
  // the call consume_context makes after authority(). authority() still admits
  // only move, insurance, and lender, so consume_context as contractor fails
  // closed and writes no Saved row. This block does not touch the lender
  // five-strike proof above.
  await quiet();
  const savedBeforeContractor = await snapshot();
  assert.deepEqual(await consume(contractorProof, 'contractor'), { ok: true, error_code: null });
  assert.deepEqual(await consume(contractorProof, 'contractor'), { ok: false, error_code: 'HANDOFF_ALREADY_USED' });
  const cross = proofFor(); await issue(cross, 'contractor');
  for (const hub of ['lender', 'insurance', 'move', 'investor']) assert.deepEqual(await consume(cross, hub), { ok: false, error_code: 'INVALID_AUDIENCE' }, hub);
  const lenderAsContractor = proofFor(); await issue(lenderAsContractor, 'lender');
  assert.deepEqual(await consume(lenderAsContractor, 'contractor'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  const insuranceAsContractor = proofFor(); await issue(insuranceAsContractor, 'insurance');
  assert.deepEqual(await consume(insuranceAsContractor, 'contractor'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  const moveAsContractor = proofFor();
  await store.authorized(d => d.query('select v23_private.prod_issue_context($1,$2,$3)', [JSON.stringify(moveAsContractor), A, sidA]));
  assert.deepEqual(await consume(moveAsContractor, 'contractor'), { ok: false, error_code: 'INVALID_AUDIENCE' });
  const tamperedContractor = proofFor(); await issue(tamperedContractor, 'contractor');
  assert.deepEqual(await consume(tamperedContractor, 'contractor', { state: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  assert.deepEqual(await consume(tamperedContractor, 'contractor', { nonce: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  const expiredContractor = proofFor(); await issue(expiredContractor, 'contractor');
  await db.query(`update ops.consumer_auth_handoffs set created_at=created_at-interval '2 minutes',expires_at=expires_at-interval '2 minutes' where code_hash=ops.hash_handoff_secret($1)`, [expiredContractor.code]);
  assert.deepEqual(await consume(expiredContractor, 'contractor'), { ok: false, error_code: 'HANDOFF_EXPIRED' });
  const revokedContractor = proofFor(); await issue(revokedContractor, 'contractor');
  for (const hub of ['move', 'lender', 'insurance', 'investor', 'senior']) assert.deepEqual(await consume(revokedContractor, hub), { ok: false, error_code: 'INVALID_AUDIENCE' });
  assert.deepEqual(await consume(revokedContractor, 'contractor'), { ok: false, error_code: 'INVALID_STATE' });
  assert.equal(await snapshot(), savedBeforeContractor);
  const authorityProof = proofFor();
  await issue(authorityProof, 'contractor');
  const contractorAuthority = { hub: 'contractor', audience: 'ask', service: 'svc:trusthub:contractor:bff:v1', scopes: ['saved:write'],
    subject: A, session: 'ab'.repeat(32), browser: 'cd'.repeat(32), operation: 'consumeProfileSaveContinuation', exchangeProof: authorityProof };
  await db.exec('begin');
  await db.query('set local role myth_v23_authorizer');
  await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(contractorAuthority)]);
  await db.query('set local role myth_v23_executor');
  await assert.rejects(db.query('select v23_private.consume_context($1)', [JSON.stringify(authorityProof)]),
    error => error.code === '42501' && /invalid authority/.test(error.message));
  await db.exec('rollback');
  assert.equal(await snapshot(), savedBeforeContractor);
  console.log('PASS I-L Contractor: issued at https://www.contractortrusthub.com, consumed only as contractor, cross-hub either way is INVALID_AUDIENCE, reuse/expiry/tamper/five-strike unchanged; consume_context still refuses contractor at authority() and writes no Saved row');

  // ---- AFTER packet 15: the whole chain per hub -------------------------
  await db.exec('delete from ops.consumer_auth_handoffs; delete from ops.consumer_browser_handoff_intents');
  const expectHub = async (m, intent, outcome) => {
    await quiet(); acknowledged.length = 0;
    const before = (await handoffs()).length;
    assert.deepEqual(await click(m, intent), returned(m), m.hub + ' ' + intent);
    assert.deepEqual(acknowledged, outcome ? [[m.hub, outcome]] : [], m.hub + ' ' + intent + ' acknowledgement');
    return (await handoffs()).slice(before);
  };
  // A/B. Move is unchanged: issued and consumed as move.
  assert.deepEqual(await expectHub(HINDMAN, 'save', 'already_saved'), [{ issuer_hub: 'move', audience_hub: 'ask', initiating_origin: MOVE, status: 'consumed' }]);
  await expectHub(HINDMAN, 'unsave', 'local_only');
  assert.deepEqual(await active(), []);
  assert.deepEqual(await expectHub(HINDMAN, 'save', 'saved'), [{ issuer_hub: 'move', audience_hub: 'ask', initiating_origin: MOVE, status: 'consumed' }]);
  console.log('PASS A/B Move: Save, Unsave and re-Save unchanged; context issued and consumed as move');
  // C/D/E. Lender.
  assert.deepEqual(await expectHub(FREEDOM, 'save', 'saved'), [{ issuer_hub: 'lender', audience_hub: 'ask', initiating_origin: LENDER, status: 'consumed' }]);
  assert.deepEqual((await saves()).filter(r => r.canonical_name === FREEDOM.legalName), [{ canonical_name: FREEDOM.legalName, source_hub: 'lender', active: true }]);
  await expectHub(FREEDOM, 'save', 'already_saved'); await expectHub(FREEDOM, 'save', 'already_saved');
  assert.equal((await saves()).filter(r => r.canonical_name === FREEDOM.legalName).length, 1);
  await expectHub(LOANDEPOT, 'save', 'saved');
  await expectHub(FREEDOM, 'unsave', 'local_only');
  assert.deepEqual(await active(), [HINDMAN.legalName, LOANDEPOT.legalName].sort());
  await expectHub(FREEDOM, 'save', 'saved');
  assert.equal((await saves()).filter(r => r.canonical_name === FREEDOM.legalName).length, 1);
  console.log('PASS C/D/E Lender: Save through the real continuation consume (context issued and consumed as lender), repeated Save keeps one row, Unsave removes it, acknowledged each time');
  // F/G/H. Insurance.
  assert.deepEqual(await expectHub(ASFIN, 'save', 'saved'), [{ issuer_hub: 'insurance', audience_hub: 'ask', initiating_origin: INSURANCE, status: 'consumed' }]);
  assert.deepEqual((await saves()).filter(r => r.canonical_name === ASFIN.legalName), [{ canonical_name: ASFIN.legalName, source_hub: 'insurance', active: true }]);
  await expectHub(ASFIN, 'save', 'already_saved'); await expectHub(ASFIN, 'save', 'already_saved');
  assert.equal((await saves()).filter(r => r.canonical_name === ASFIN.legalName).length, 1);
  await expectHub(IMT, 'save', 'saved');
  await expectHub(ASFIN, 'unsave', 'local_only');
  assert.deepEqual(await active(), [FREEDOM.legalName, HINDMAN.legalName, IMT.legalName, LOANDEPOT.legalName].sort());
  await expectHub(ASFIN, 'save', 'saved');
  console.log('PASS F/G/H Insurance: Save through the real continuation consume (context issued and consumed as insurance), repeated Save keeps one row, Unsave removes it, acknowledged each time');
  // Saves are per owner.
  parent = userB;
  await expectHub(FREEDOM, 'save', 'saved'); await expectHub(ASFIN, 'save', 'saved');
  assert.deepEqual(await active(B), [ASFIN.legalName, FREEDOM.legalName].sort());
  parent = userA;
  assert.equal((await active(A)).length, 5);

  // M. The browser cannot choose the hub: the arrival origin must be the hub that staged, and extra fields are refused.
  const all = await snapshot();
  for (const [m, from] of [[FREEDOM, INSURANCE], [FREEDOM, MOVE], [ASFIN, LENDER], [ASFIN, MOVE], [HINDMAN, LENDER], [FREEDOM, 'https://evil.example']]) {
    await quiet(); acknowledged.length = 0;
    const staged = await stage(m);
    const result = await arrive(m, staged.continuationRef, 'unsave', from);
    assert.notEqual(result.status, 303, m.hub + ' continuation arriving from ' + from);
    assert.deepEqual(acknowledged, []);
  }
  for (const extra of [{ hub: 'move' }, { sourceHub: 'move' }, { issuer: 'move' }]) {
    const staged = await stage(FREEDOM);
    const arrival = new Request(ASK + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: staged.continuationRef, intent: 'save', ...extra }), headers: { origin: LENDER } });
    assert.notEqual((await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival))).status, 303, JSON.stringify(extra));
  }
  assert.equal(await snapshot(), all);
  // A specialist cannot stage another hub's profile under its own signature.
  for (const [signer, m] of [['lender', HINDMAN], ['move', FREEDOM], ['insurance', FREEDOM], ['lender', ASFIN]]) {
    const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation: 'prepareGuestProfileTransfer', input: manifestFor(m) }));
    assert.notEqual((await post(bytes, signFor[signer](bytes, randomRef()))).status, 200, signer + ' staging ' + m.hub);
  }
  console.log('PASS M: the hub comes from the verified signature and arrival origin; a continuation arriving from another origin, extra hub fields and cross-hub stages are refused');

  // K (application). One continuation is one Save: replaying the follow-up or the arrival commits nothing new.
  await quiet(); acknowledged.length = 0;
  const staged = await stage(LOANDEPOT);
  const first = await arrive(LOANDEPOT, staged.continuationRef, 'save');
  assert.equal(first.status, 303);
  assert.deepEqual(acknowledged, [['lender', 'already_saved']]);
  const consumedCount = async () => (await handoffs()).filter(h => h.status === 'consumed').length;
  const committed = await snapshot(), consumed = await consumedCount();
  const again = new Request(ASK + '/my/profile-save', { headers: { cookie: first.cookie } });
  await handleProfileConfirmation(again, await runtime().browserBindings(again));
  await arrive(LOANDEPOT, staged.continuationRef, 'save');
  assert.equal(await snapshot(), committed); // no second commit
  assert.equal(await consumedCount(), consumed); // no second context is consumed for a used continuation
  // The committed outcome may be re-sent to the specialist; it is never a new Save.
  assert.deepEqual([...new Set(acknowledged.map(a => a.join()))], ['lender,already_saved']);
  assert.equal((await saves()).filter(r => r.canonical_name === LOANDEPOT.legalName).length, 1);
  const all2 = await snapshot();
  console.log('PASS K: one continuation is one Save; replaying the follow-up or the arrival commits nothing and consumes no context; only the already-committed outcome is ever re-sent');

  // N/O. The acknowledgement is sent only after the Saved state is committed.
  await quiet(); acknowledged.length = 0;
  await db.query(`update network.network_entity_bindings set binding_status='review_required' where specialist_entity_id=$1`, [IMT.profile.nativeId]);
  await click(IMT, 'save');
  assert.deepEqual(acknowledged, []); assert.equal(await snapshot(), all2);
  await db.query(`update network.network_entity_bindings set binding_status='accepted' where specialist_entity_id=$1`, [IMT.profile.nativeId]);
  // Signed out: nothing saved, nothing acknowledged.
  parent = null; await quiet();
  for (const m of [FREEDOM, ASFIN, HINDMAN]) assert.deepEqual(await click(m, 'save'), returned(m));
  assert.deepEqual(acknowledged, []); assert.equal(await snapshot(), all2);
  parent = userA;
  // With the context issuer removed again, Lender and Insurance fail closed and Move still works.
  await db.exec(contextRollback);
  for (const m of [LOANDEPOT, IMT]) { await quiet(); acknowledged.length = 0; await click(m, 'save'); assert.deepEqual(acknowledged, [], m.hub); }
  assert.equal(await snapshot(), all2);
  await expectHub(HINDMAN, 'save', 'already_saved');
  await db.exec(contextForward);
  await expectHub(LOANDEPOT, 'save', 'already_saved'); await expectHub(IMT, 'save', 'already_saved');
  console.log('PASS N/O: no acknowledgement without a committed Saved state (denied binding, signed out, missing issuer); a failed consume writes no Saved row');

  // ---- packet 18: admit senior on the shared issuer. Packet 15 files stay. ----
  const SENIOR = 'https://www.seniortrusthub.com';
  const seniorPreflight = read('18-ask-prod-senior-hub-context-preflight.sql');
  const seniorForward = read('18-ask-prod-senior-hub-context-forward.sql');
  const seniorRollback = read('18-ask-prod-senior-hub-context-rollback.sql');
  const authorityBefore18 = await issuer('v23_private.authority()');
  const moveBefore18 = await issuer('v23_private.prod_issue_context(jsonb,uuid,uuid)');
  await db.exec(seniorPreflight);
  await assert.rejects(issue(proofFor(), 'senior'), /hub/);
  await db.exec(seniorForward);
  await assert.rejects(db.exec(seniorForward), /not the frozen packet 15 body/); await db.exec('rollback');
  await assert.rejects(db.exec(seniorPreflight), /not the frozen packet 15 body/); await db.exec('rollback');
  const admittedFn = JSON.parse(await issuer('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'));
  assert.equal(admittedFn.owner, 'myth_v23_foundation');
  assert.match(admittedFn.prosrc, /when 'senior' then 'https:\/\/www\.seniortrusthub\.com'/);
  assert.match(admittedFn.prosrc, /when 'lender' then 'https:\/\/www\.lendertrusthub\.com'/);
  assert.match(admittedFn.prosrc, /when 'insurance' then 'https:\/\/www\.insurancetrusthub\.com'/);
  assert.match(admittedFn.prosrc, /when 'contractor' then 'https:\/\/www\.contractortrusthub\.com'/);
  assert.equal(await issuer('v23_private.authority()'), authorityBefore18);
  assert.equal(await issuer('v23_private.prod_issue_context(jsonb,uuid,uuid)'), moveBefore18);
  await quiet();
  for (const hub of ['move', 'investor', 'ask', '', 'LENDER', 'senior ', 'Senior', 'lender,senior', '*', null]) await assert.rejects(issue(proofFor(), hub), /hub/, String(hub));
  for (const key of ['hub', 'issuer', 'issuerHub', 'sourceHub']) await assert.rejects(issue({ ...proofFor(), [key]: 'senior' }, 'senior'), /hub/, key);
  await assert.rejects(issue({ ...proofFor(), targetOrigin: SENIOR }, 'senior'), /origin/);
  await assert.rejects(issue({ ...proofFor(), targetOrigin: 'https://seniortrusthub.com' }, 'senior'), /origin/);
  const lenderAfter = proofFor(), insuranceAfter = proofFor(), contractorAfter = proofFor(), seniorProof = proofFor();
  await issue(lenderAfter, 'lender'); await issue(insuranceAfter, 'insurance'); await issue(contractorAfter, 'contractor'); await issue(seniorProof, 'senior');
  assert.equal((await db.query(`select nonce_hash = ops.hash_handoff_secret($2) as nonce_bound from ops.consumer_auth_handoffs where code_hash=ops.hash_handoff_secret($1)`, [seniorProof.code, seniorProof.nonce])).rows[0].nonce_bound, true);
  assert.deepEqual((await db.query(`select issuer_hub,initiating_origin,audience_hub,target_origin,extract(epoch from expires_at-created_at)::int as ttl from ops.consumer_auth_handoffs where code_hash=ops.hash_handoff_secret($1)`, [seniorProof.code])).rows, [
    { issuer_hub: 'senior', initiating_origin: SENIOR, audience_hub: 'ask', target_origin: ASK, ttl: 90 }]);
  assert.deepEqual(await consume(seniorProof, 'senior'), { ok: true, error_code: null });
  assert.deepEqual(await consume(seniorProof, 'senior'), { ok: false, error_code: 'HANDOFF_ALREADY_USED' });
  const seniorCross = proofFor(); await issue(seniorCross, 'senior');
  for (const hub of ['lender', 'insurance', 'contractor', 'move']) assert.deepEqual(await consume(seniorCross, hub), { ok: false, error_code: 'INVALID_AUDIENCE' }, hub);
  for (const [proof, hub] of [[lenderAfter, 'lender'], [insuranceAfter, 'insurance'], [contractorAfter, 'contractor']]) {
    assert.deepEqual(await consume(proof, 'senior'), { ok: false, error_code: 'INVALID_AUDIENCE' }, hub);
  }
  const seniorTamper = proofFor(); await issue(seniorTamper, 'senior');
  assert.deepEqual(await consume(seniorTamper, 'senior', { state: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  assert.deepEqual(await consume(seniorTamper, 'senior', { nonce: randomRef() }), { ok: false, error_code: 'INVALID_STATE' });
  const seniorExpired = proofFor(); await issue(seniorExpired, 'senior');
  await db.query(`update ops.consumer_auth_handoffs set created_at=created_at-interval '2 minutes',expires_at=expires_at-interval '2 minutes' where code_hash=ops.hash_handoff_secret($1)`, [seniorExpired.code]);
  assert.deepEqual(await consume(seniorExpired, 'senior'), { ok: false, error_code: 'HANDOFF_EXPIRED' });
  console.log('PASS packet 18 issuance: senior is issued only at https://www.seniortrusthub.com; lender, insurance, and contractor stay on their pins; cross-hub, browser hub, browser origin, expiry, reuse, tamper, and nonce checks hold');

  // Rollback restores the frozen three-hub function and does not drop it.
  const savedBeforeRollback = await snapshot();
  await db.exec(seniorRollback);
  assert.notEqual(await issuer('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'), 'null');
  const restored = JSON.parse(await issuer('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)'));
  assert.doesNotMatch(restored.prosrc, /senior/);
  assert.match(restored.prosrc, /when 'contractor' then 'https:\/\/www\.contractortrusthub\.com'/);
  await assert.rejects(issue(proofFor(), 'senior'), /hub/);
  const lenderRestored = proofFor(); await issue(lenderRestored, 'lender');
  assert.deepEqual(await consume(lenderRestored, 'lender'), { ok: true, error_code: null });
  await assert.rejects(db.exec(seniorRollback), /not the packet 18 body/); await db.exec('rollback');
  assert.equal(await snapshot(), savedBeforeRollback);
  assert.equal(await issuer('v23_private.authority()'), authorityBefore18);
  assert.equal(await issuer('v23_private.prod_issue_context(jsonb,uuid,uuid)'), moveBefore18);
  console.log('PASS packet 18 rollback: the shared issuer is the frozen three-hub function again, senior is denied, the function remains, Saved research is untouched');

  await db.exec(seniorPreflight);
  await db.exec(seniorForward);
  // Packet 15 + 18 without Packet 17: issuance works, the Saved commit does not.
  const savedBeforeAuthority = await snapshot();
  const ackBefore = acknowledged.length;
  const deniedSenior = proofFor();
  await issue(deniedSenior, 'senior');
  const seniorAuthority = { hub: 'senior', audience: 'ask', service: 'svc:trusthub:senior:bff:v1', scopes: ['saved:write'],
    subject: A, session: 'ab'.repeat(32), browser: 'cd'.repeat(32), operation: 'consumeProfileSaveContinuation', exchangeProof: deniedSenior };
  await db.exec('begin');
  await db.query('set local role myth_v23_authorizer');
  await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(seniorAuthority)]);
  await db.query('set local role myth_v23_executor');
  await assert.rejects(db.query('select v23_private.consume_context($1)', [JSON.stringify(deniedSenior)]),
    error => error.code === '42501' && /invalid authority/.test(error.message));
  await db.exec('rollback');
  assert.equal(await snapshot(), savedBeforeAuthority);
  assert.equal(acknowledged.length, ackBefore);
  console.log('PASS packet 18 without packet 17: senior context is issued, consume_context raises invalid authority, no Saved row and no acknowledgement');

  // Packet 17 is read from the pinned PR #233 commit. This branch does not edit those files.
  const PACKET17 = '16a35a6d9ac7cfcc8c1c6fd415f9ab04d07c1532';
  const packet17 = name => execFileSync('git', ['show', `${PACKET17}:docs/my-trusthub/v2/production/${name}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  await db.exec(packet17('17-ask-prod-senior-authority-forward.sql'));
  await db.exec(`set v23bind.senior_ccn_checked='true'`);
  await db.exec(packet17('17-ask-prod-senior-ccn-binding-forward.sql'));
  const resolved = async ccn => (await db.query('select specialist_entity_id,identifier_namespace,source_identifier,jurisdiction,specialist_entity_type,canonical_public_profile_ref from v23_private.prod_senior_ccn_binding_for($1)', [ccn])).rows;
  assert.deepEqual(await resolved('015009'), [{ specialist_entity_id: '015009', identifier_namespace: 'cms.ccn', source_identifier: '015009', jurisdiction: 'US', specialist_entity_type: 'cms_facility', canonical_public_profile_ref: '/facility/cms/015009/burns-nursing-home-inc' }]);
  assert.equal((await resolved('055223'))[0].canonical_public_profile_ref, '/facility/cms/055223/san-jacinto-valley-post-acute');
  assert.equal((await resolved('155805'))[0].canonical_public_profile_ref, '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center');
  const bindingId = (await db.query('select id from v23_private.prod_senior_ccn_binding_for($1)', ['015009'])).rows[0].id;
  const accountContextRef = randomRef(), transferRef = randomRef();
  const browser = 'cd'.repeat(32), session = 'ab'.repeat(32);
  const digest = 'a'.repeat(64);
  const item = { localItemId: '015009', revision: '1', digest: 'b'.repeat(64), profile: { hub: 'senior', nativeId: '015009', profileClass: 'cms_facility' } };
  const sha = value => createHash('sha256').update(value).digest('hex');
  const expiresAt = Date.now() + 600000;
  const seniorBase = { hub: 'senior', audience: 'ask', service: 'svc:trusthub:senior:bff:v1', browser };
  // Stage and grant go through stamp_record under the real operations. A bare
  // insert has no transaction authority, so the stamp refuses it.
  const withAuthority = async (authority, work) => {
    await db.exec('begin');
    try {
      await db.query('set local role myth_v23_authorizer');
      await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(authority)]);
      await db.query('set local role myth_v23_executor');
      const value = await work();
      await db.query('set local role myth_v23_authorizer');
      await db.query('delete from v23_private.save_validation where backend=pg_backend_pid() and transaction_id=txid_current()');
      await db.query('delete from v23_private.exchange_validation where backend=pg_backend_pid() and transaction_id=txid_current()');
      await db.query('delete from v23_private.transaction_authority where backend=pg_backend_pid() and transaction_id=txid_current()');
      await db.exec('commit');
      return value;
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  };
  await withAuthority({ ...seniorBase, scopes: ['transfer:stage'], operation: 'prepareGuestProfileTransfer' }, () => db.query(
    'insert into ops.v23_profile_runtime_records(kind,key_hash,payload) values($1,$2,$3)',
    ['stage', sha(transferRef), JSON.stringify({ input: { selected: [item] }, digest, expiresAt, browser })]));
  const canaryProof = proofFor();
  await quiet();
  await issue(canaryProof, 'senior');
  await withAuthority({ ...seniorBase, scopes: ['saved:write'], subject: A, session, operation: 'consumeProfileSaveContinuation', exchangeProof: canaryProof }, async () => {
    await db.query('select v23_private.consume_context($1)', [JSON.stringify(canaryProof)]);
    await db.query('insert into ops.v23_profile_runtime_records(kind,key_hash,payload) values($1,$2,$3)', [
      'grant', sha(accountContextRef), JSON.stringify({ stageKey: sha(transferRef), session, browser, expiresAt, subject: A, hub: 'senior' }),
    ]);
  });
  const saved = await withAuthority({ ...seniorBase, scopes: ['saved:write'], subject: A, session, operation: 'commitProfileSave',
    input: { accountContextRef, transferRef, manifestDigest: digest, item } }, () => db.query('select saved_entity_id,created from v23_private.save_profile($1)', [bindingId]));
  assert.equal(saved.rows[0].created, true);
  assert.deepEqual((await saves()).filter(r => r.canonical_name === 'BURNS NURSING HOME, INC.'), [{ canonical_name: 'BURNS NURSING HOME, INC.', source_hub: 'senior', active: true }]);
  assert.equal(acknowledged.length, ackBefore);
  console.log('PASS packet 15+18+17: CMS CCN 015009 commits one Senior Saved row through save_profile; acknowledgement stays with the specialist channel and was not sent by SQL');

  // P. No Watch or Alert relation exists on this path and no transaction authority leaks.
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema in ('consumer','ops','network','v23_private') and table_name ~* '(watch|alert)'")).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from v23_private.transaction_authority')).rows[0].n, 0);
  console.log('PASS P: zero Watch/Alert relations; no leaked transaction authority');
} finally { await db.close(); }
console.log('PASS per-hub account context (Move, Lender, Insurance, Contractor handoff; production target, embedded database)');
