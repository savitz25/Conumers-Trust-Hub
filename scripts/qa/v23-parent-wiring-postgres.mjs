// Local embedded PostgreSQL ONLY. Real P11/P12/P13 and prepared port SQL.
// Auth/source HTTP are explicit fixtures; this is NOT hosted/browser evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PreviewAssembly } from '../../lib/my-trusthub/profile-save/preview-assembly.ts';
import { PreviewStore, PreviewConfirmationStore, randomRef } from '../../lib/my-trusthub/profile-save/preview-store.ts';
import { SourceChannel, TEST_PROFILE, TEST_SLUG } from '../../lib/my-trusthub/profile-save/source-channel.ts';
import { handleProfileConfirmation } from '../../lib/my-trusthub/profile-save/browser.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { ASSERTION_HEADER, signAssertion, verifyAssertion } from '../../lib/my-trusthub/profile-save/service-assertion.ts';
import { ASK_PREVIEW, MOVE_PREVIEW, API_PATH, PARENT_LOGIN } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { fixtureEnv, A, B, keys } from '../../lib/my-trusthub/profile-save/final-wiring.test.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';
const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
    alter table auth.sessions enable row level security; alter table auth.sessions force row level security;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  for (const f of ['20260907160000_my_trusthub_identity_foundation.sql','20260907190000_my_trusthub_saved_projects_guest_import.sql',
    '20260907220000_my_trusthub_cross_hub_handoffs.sql','20260919205200_my_trusthub_v23_transaction_capability.sql']) await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'));
  // Execute the existing hosted transaction matrix only inside LOCAL PGlite.
  await db.exec(readFileSync('supabase/tests/v23_hosted_transactions.sql', 'utf8'));
  await db.exec("set v23.approved_project='xkkiicsassizmakcvxml'");
  const root = 'docs/my-trusthub/v2/final-parent-wiring/';
  await db.exec(readFileSync(root + 'ports-forward.sql', 'utf8'));
  await db.exec(readFileSync(root + 'runtime-role-forward.sql', 'utf8'));
  console.log('PASS local PostgreSQL: forward SQL and original hosted-matrix cases');
  const memberships = (await db.query(`select r.rolname,m.admin_option,m.inherit_option,m.set_option from pg_auth_members m join pg_roles r on r.oid=m.roleid
    where m.member=(select oid from pg_roles where rolname=$1) order by r.rolname`, [PARENT_LOGIN])).rows;
  assert.deepEqual(memberships.map(r => r.rolname), ['myth_v23_authorizer','myth_v23_executor']);
  assert.ok(memberships.every(r => !r.admin_option && !r.inherit_option && r.set_option));
  const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.query('insert into auth.users values($1),($2)', [A, B]);
  await db.query('insert into auth.sessions values($1,$2,null),($3,$4,null)', [sidA, A, sidB, B]);
  await db.exec(`with e as (insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction)
    values('organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US') returning id)
    insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref)
    select id,'move','mover','usdot-1002530','fmcsa.usdot','1002530','US','accepted',now()-interval '1 day','local-test-only' from e;`);
  const pool = { connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) };
  const store = new PreviewStore(pool), confirmations = new PreviewConfirmationStore(pool);
  assert.equal(await store.authorized(async d => (await d.query('select v23_private.preview_ports_ready() ready', [])).rows[0].ready), true);
  assert.equal(await store.live(A, sidA), true); assert.equal(await store.live(B, sidA), false);
  assert.equal(await store.live(A, sidB), false);
  await db.exec('begin;set local role myth_v23_authorizer');
  await assert.rejects(db.query('select * from auth.sessions')); await db.exec('rollback');
  const key = keys(), move = keys(), browser = randomRef(); let sourceSnapshot; let acknowledgment = 0;
  const source = new SourceChannel(key.privateKey, undefined, async (target, init) => {
    const body = JSON.parse(Buffer.from(init.body).toString());
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: TEST_PROFILE, canonicalSlug: TEST_SLUG, publicationState: 'PUBLISHABLE', reviewedClass: 'mover', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: sourceSnapshot });
    if (body.action === 'acknowledge') { acknowledgment++; return Response.json({ ok: true }); }
    throw Error('Unexpected source operation');
  });
  let parent = null;
  const runtime = new PreviewAssembly(fixtureEnv, pool, source, move.publicKey, async () => parent);
  const projectA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', projectB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await db.query("insert into consumer.consumer_projects(id,user_id,creation_key,name,life_event_type) values($1,$2,gen_random_uuid(),'A private Project','moving'),($3,$4,gen_random_uuid(),'B private Project','moving')", [projectA,A,projectB,B]);
  const projectsA = await runtime.projects({subject:A,session:sidA,label:'Fixture A'});
  const projectsB = await runtime.projects({subject:B,session:sidB,label:'Fixture B'});
  assert.equal(projectsA.length,1); assert.equal(projectsA[0].id,projectA); assert.notEqual(projectsA[0].ref,projectA);
  assert.equal(projectsB.length,1); assert.equal(projectsB[0].id,projectB); assert.notEqual(projectsB[0].ref,projectsA[0].ref);
  const manifest = { version: 'v2-3/selected-profiles/2', sourceHub: 'move', audience: 'ask',
    selected: [{ localItemId: TEST_SLUG, revision: '1', digest: 'a'.repeat(64), profile: TEST_PROFILE }],
    returnTask: { kind: 'profile', hub: 'move', profile: TEST_PROFILE, canonicalSlug: TEST_SLUG } };
  async function call(operation, input) {
    const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input }));
    const req = new Request(ASK_PREVIEW + API_PATH, { method: 'POST', body: bytes, headers: { 'content-type': 'application/json',
      [ASSERTION_HEADER]: signAssertion(move.privateKey, 'move', ASK_PREVIEW + API_PATH, 'transfer:stage', bytes, browser) } });
    return handleProfileSave(req, { enabled: true, runtimeForRequest: r => runtime.serviceRuntime(r) });
  }
  const stageResponse = await call('prepareGuestProfileTransfer', manifest);
  const stageBody = await stageResponse.json(); assert.equal(stageResponse.status, 200, JSON.stringify(stageBody));
  const stage = stageBody.result;
  const contResponse = await call('prepareProfileSaveContinuation', { sourceHub: 'move', audience: 'ask', transferRef: stage.transferRef, manifestDigest: stage.manifestDigest });
  const contBody = await contResponse.json(); assert.equal(contResponse.status, 200, JSON.stringify(contBody));
  const continuation = contBody.result;
  sourceSnapshot = { ...continuation, transferRef: stage.transferRef, manifest, manifestDigest: stage.manifestDigest, browserProof: browser, requestPrefix: randomRef() };
  const start = new Request(ASK_PREVIEW + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: continuation.continuationRef }), headers: { origin: MOVE_PREVIEW } });
  const started = await handleProfileConfirmation(start, await runtime.browserBindings(start)); assert.equal(started.status, 303);
  const cookie = started.headers.get('set-cookie').split(';')[0], cookieRef = cookie.split('=')[1];
  const get = () => new Request(ASK_PREVIEW + '/my/profile-save', { headers: { cookie } });
  assert.match(await (await handleProfileConfirmation(get(), await runtime.browserBindings(get()))).text(), /Sign in to continue/);
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  const form = await (await handleProfileConfirmation(get(), await runtime.browserBindings(get()))).text();
  assert.match(form, /Confirm Save/);
  assert.equal((await db.query('select count(*)::int n from consumer.consumer_saved_entities')).rows[0].n, 0);
  const csrf = /name="csrf" value="([^"]+)"/.exec(form)[1];
  assert.ok(form.includes('A private Project')); assert.ok(!form.includes('B private Project')); assert.ok(!form.includes(projectA));
  const forgedProject = new Request(ASK_PREVIEW + '/my/profile-save', {method:'POST',body:new URLSearchParams({csrf,confirm:'yes',project:projectsB[0].ref}),headers:{origin:ASK_PREVIEW,cookie}});
  assert.notEqual((await handleProfileConfirmation(forgedProject,await runtime.browserBindings(forgedProject))).status,200);
  assert.equal((await db.query('select count(*)::int n from consumer.consumer_saved_entities')).rows[0].n,0);
  const post = () => new Request(ASK_PREVIEW + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ csrf, confirm: 'yes', project: '' }), headers: { origin: ASK_PREVIEW, cookie } });
  const saved = await handleProfileConfirmation(post(), await runtime.browserBindings(post()));
  assert.equal(saved.status, 200, await saved.clone().text()); assert.match(await saved.text(), /Saved to My TrustHub/);
  assert.equal(acknowledgment, 1);
  assert.equal((await db.query('select count(*)::int n from consumer.consumer_saved_entities')).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from ops.consumer_auth_handoffs where status='consumed'")).rows[0].n, 1);
  assert.equal((await store.authorized(d => d.query('select * from v23_private.preview_saved($1,$2)', [A, sidA]))).rows.length, 1);
  assert.equal((await store.authorized(d => d.query('select * from v23_private.preview_saved($1,$2)', [B, sidB]))).rows.length, 0);
  await assert.rejects(store.authorized(d => d.query('select * from v23_private.preview_saved($1,$2)', [B, sidA])));
  const reload = await handleProfileConfirmation(get(), await runtime.browserBindings(get())); assert.equal(reload.status, 200); assert.equal(acknowledgment, 2);
  const duplicate = await handleProfileConfirmation(post(), await runtime.browserBindings(post())); assert.equal(duplicate.status, 200);
  assert.equal((await db.query('select count(*)::int n from consumer.consumer_saved_entities')).rows[0].n, 1);
  let confirmation; await confirmations.withRecord(cookieRef, async c => { confirmation = c; });
  const internal = await (await runtime.browserBindings(post())).runtime(post(), confirmation, parent);
  await assert.rejects(internal.execute('consumeProfileSaveContinuation', { continuationRef: continuation.continuationRef, issuer: 'move', audience: 'ask', browserProof: browser }));
  console.log('PASS local PostgreSQL: signed stage, durable source link, explicit confirmation, actual P13/P12, receipt, reload, retry, replay denial');
  const challenge = await runtime.grants.challenge(continuation.continuationRef, browser);
  const bridgeStart = await runtime.grants.browser(new Request(challenge.target, { method: 'POST', body: new URLSearchParams(challenge.fields), headers: { origin: MOVE_PREVIEW } }));
  assert.equal(bridgeStart.status, 303);
  const bridge = await runtime.grants.browser(new Request(challenge.target, { headers: { cookie: bridgeStart.headers.get('set-cookie').split(';')[0] } }));
  const html = await bridge.text(), proof = /"proofRef":"([A-Za-z0-9_-]{43})"/.exec(html)[1];
  assert.ok(html.includes(JSON.stringify(MOVE_PREVIEW))); assert.ok(!html.includes(A)); assert.ok(!html.includes(sidA));
  const grantBody = Buffer.from(JSON.stringify({ action: 'resolve', continuationRef: continuation.continuationRef, proofRef: proof }));
  const grantUrl = ASK_PREVIEW + API_PATH + '/current-grant';
  const resolved = await runtime.grantService(new Request(grantUrl, { method: 'POST', body: grantBody, headers: { 'content-type': 'application/json',
    [ASSERTION_HEADER]: signAssertion(move.privateKey, 'move', grantUrl, 'receipt:verify', grantBody, browser) } }));
  const resolution = await resolved.text(); assert.ok(!resolution.includes(A)); assert.ok(!resolution.includes(sidA));
  assert.equal(JSON.parse(resolution).result.selectionConfirmed, true);
  assert.equal((await runtime.grants.resolve(proof, browser)).grant.subject, A);
  await assert.rejects(runtime.grants.resolve(proof, randomRef()));
  await assert.rejects(runtime.grants.resolve(proof, browser, randomRef()));
  await assert.rejects(runtime.grants.authorize(challenge.fields.challengeRef, parent));
  const nextChallenge = await runtime.grants.challenge(continuation.continuationRef, browser);
  parent = { subject: B, session: sidB, label: 'Fixture B' };
  assert.equal((await handleProfileConfirmation(get(), await runtime.browserBindings(get()))).status, 409);
  await assert.rejects(runtime.grants.authorize(nextChallenge.fields.challengeRef, parent));
  await assert.rejects(runtime.grants.resolve(proof, browser));
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  const again = await runtime.grants.challenge(continuation.continuationRef, browser);
  const fresh = await runtime.grants.authorize(again.fields.challengeRef, parent);
  await db.query('delete from auth.sessions where id=$1', [sidA]);
  await assert.rejects(runtime.grants.resolve(fresh, browser));
  assert.equal(await store.live(A, sidA), false);
  console.log('PASS local PostgreSQL: B switch invalidates A proof, copied browser/continuation rejected, session revocation enforced');
  const bytes = Buffer.from('{}'), assertion = signAssertion(move.privateKey, 'move', ASK_PREVIEW + API_PATH, 'transfer:stage', bytes, browser);
  const req = () => new Request(ASK_PREVIEW + API_PATH, { method: 'POST', headers: { [ASSERTION_HEADER]: assertion } });
  await verifyAssertion(req(), bytes, move.publicKey, 'move', 'transfer:stage', store);
  await assert.rejects(verifyAssertion(req(), bytes, move.publicKey, 'move', 'transfer:stage', store));
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema in ('consumer','ops','network','v23_private') and table_name ~* '(watch|alert)'")).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from v23_private.transaction_authority')).rows[0].n, 0);
  console.log('PASS local PostgreSQL: durable nonce replay denial, zero Watch/Alert relations and zero leaked transaction authority');
  await db.exec(readFileSync(root + 'assertions.sql', 'utf8'));
  const research = await db.query('select * from consumer.consumer_saved_entities');
  const receipts = await db.query("select * from ops.v23_profile_runtime_records where kind='receipt'");
  await db.exec(readFileSync(root + 'teardown.sql', 'utf8'));
  assert.deepEqual(await db.query('select * from consumer.consumer_saved_entities'), research);
  assert.deepEqual(await db.query("select * from ops.v23_profile_runtime_records where kind='receipt'"), receipts);
  assert.equal((await db.query('select count(*)::int n from pg_roles where rolname=$1', [PARENT_LOGIN])).rows[0].n, 0);
  console.log('PASS local PostgreSQL: role/ACL assertions and teardown preserve Saved research and durable receipts');
} catch (error) { console.error('LOCAL WIRING SQL FAIL', error.message, error.code, error.where); process.exitCode = 1; }
finally { await db.close(); }
