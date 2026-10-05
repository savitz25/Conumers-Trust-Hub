// Local embedded PostgreSQL ONLY. Applies the real packet 15 issuer and the
// real packet 16 authority and binding files. Nothing here contacts a hosted
// database, creates a production key, or turns the contractor canary on.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
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
import { CONTRACTOR_PRODUCTION_PINS, signContractorAssertion, verifyContractorAssertion } from '../../lib/my-trusthub/profile-save/contractor-assertion.ts';
import { ContractorSourceChannel } from '../../lib/my-trusthub/profile-save/contractor-channel.ts';
import { handleProfileConfirmation } from '../../lib/my-trusthub/profile-save/browser.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { ASSERTION_HEADER, signAssertion, verifyAssertion } from '../../lib/my-trusthub/profile-save/service-assertion.ts';
import { API_PATH, PRODUCTION_TARGET } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { sessionMac } from '../../lib/my-trusthub/profile-save/session-authority.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';
import { classifyContractorRows } from '../../lib/my-trusthub/profile-save/contractor-binding.ts';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const ASK = 'https://www.asktrusthub.com', MOVE = 'https://www.movetrusthub.com', LENDER = 'https://www.lendertrusthub.com', INSURANCE = 'https://www.insurancetrusthub.com', CONTRACTOR = 'https://www.contractortrusthub.com';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const A = '11111111-1111-4111-8111-111111111111';
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
const ASFIN = { hub: 'insurance', origin: INSURANCE, slug: 'asfin-llc-l106287', returnPath: '/providers/asfin-llc-l106287', legalName: 'ASFIN LLC',
  jurisdiction: 'FL', license: 'L106287', profile: { hub: 'insurance', nativeId: 'state-license:FL:L106287', profileClass: 'insurance_provider' } };
const ROOF = { hub: 'contractor', origin: CONTRACTOR, slug: 'ccc057187-a-r-roofing-inc', returnPath: '/contractors/ccc057187-a-r-roofing-inc',
  legalName: 'A & R ROOFING INC', profile: { hub: 'contractor', nativeId: 'fl.dbpr.license:CCC057187', profileClass: 'contractor_profile' } };
const PLUMB = { hub: 'contractor', origin: CONTRACTOR, slug: 'cfc1427249-a-sunny-plumbing-company', returnPath: '/contractors/cfc1427249-a-sunny-plumbing-company',
  legalName: 'A SUNNY PLUMBING COMPANY', profile: { hub: 'contractor', nativeId: 'fl.dbpr.license:CFC1427249', profileClass: 'contractor_profile' } };
const ABSCO = { hub: 'contractor', origin: CONTRACTOR, slug: 'cgc1506243-abs-contracting-inc', returnPath: '/contractors/cgc1506243-abs-contracting-inc',
  legalName: 'ABS CONTRACTING INC', profile: { hub: 'contractor', nativeId: 'fl.dbpr.license:CGC1506243', profileClass: 'contractor_profile' } };
const UNBOUND = { hub: 'contractor', origin: CONTRACTOR, slug: 'cbc1268883-1776-construction-group-llc', returnPath: '/contractors/cbc1268883-1776-construction-group-llc',
  legalName: '1776 CONSTRUCTION GROUP LLC', profile: { hub: 'contractor', nativeId: 'fl.dbpr.license:CBC1268883', profileClass: 'contractor_profile' } };

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
  const ask = keys('ask-fixture'), move = keys('move-fixture'), lender = keys('lender-fixture'), insurance = keys('insurance-fixture'), contractor = keys('contractor-fixture');
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
  await db.exec(read('15-ask-prod-hub-account-context-forward.sql'));
  console.log('PASS packets 02, 03, 04, 05, 09, 12, 13, and 15 apply on the embedded database');

  let depth = 0, watch = false, maxDepth = 0;
  const bindingDepths = [];
  const pool = { connect: async () => {
    depth += 1;
    if (watch) maxDepth = Math.max(maxDepth, depth);
    return { query: (sql, values) => {
      if (String(sql).includes('prod_contractor_dbpr_binding_for')) bindingDepths.push({ depth, watch });
      return db.query(sql, values);
    }, release() { depth -= 1; } };
  } };
  const store = new PreviewStore(pool, PRODUCTION_TARGET);
  const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', exp = Math.floor(Date.now() / 1000) + 110;
  await db.query('insert into auth.users values($1)', [A]);
  await store.bind(A, sidA, exp, sessionMac(ask.privateKey.pem, A, sidA, exp, PRODUCTION));

  const acknowledged = [];
  const nonceSet = new Set(); const nonces = { claim: async k => !nonceSet.has(k) && !!nonceSet.add(k) };
  let moveSnapshot = null;
  const moveSource = new SourceChannel(ask.privateKey, undefined, async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    await verifyAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', body.action === 'acknowledge' ? 'source:ack' : 'source:read', nonces, Date.now(), PRODUCTION_TARGET);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: HINDMAN.slug, publicationState: 'PUBLISHABLE', reviewedClass: 'mover', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: moveSnapshot });
    assert.equal(depth, 1, 'move acknowledgement ran before the save transaction released, depth=' + depth);
    acknowledged.push(['move', body.receipts.map(r => r.parent.outcome).join()]); return Response.json({ ok: true });
  }, PRODUCTION_TARGET);
  const lenderFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    const claims = await verifyLenderAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', body.action === 'acknowledge' ? 'source:ack' : 'source:read', nonces);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: FREEDOM.slug, publicationState: 'PUBLISHABLE', reviewedClass: 'marketplace_company', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: body.manifest,
      manifestDigest: body.manifestDigest, browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser } });
    assert.equal(depth, 1, 'lender acknowledgement ran before the save transaction released, depth=' + depth);
    acknowledged.push(['lender', body.receipts.map(r => r.parent.outcome).join()]); return Response.json({ ok: true, result: { watchCreated: false } });
  };
  const insuranceFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    if (body.action !== 'acknowledge') return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
    const claims = await verifyInsuranceAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', 'source:ack', nonces);
    const receipt = body.receipts[0];
    if (body.receipts.length !== 1 || !receipt.requestKey.startsWith(claims.browser + ':')) return Response.json({ ok: false, error: 'unauthorized' }, { status: 403 });
    assert.equal(depth, 1, 'insurance acknowledgement ran before the save transaction released, depth=' + depth);
    acknowledged.push(['insurance', receipt.parent.outcome]);
    return Response.json({ ok: true, result: { acknowledged: receipt.parent.outcome === 'local_only' ? 'unsave' : 'save', watchCreated: false } });
  };
  const contractorSlugs = new Map([[ROOF.profile.nativeId, ROOF.slug], [PLUMB.profile.nativeId, PLUMB.slug], [ABSCO.profile.nativeId, ABSCO.slug], [UNBOUND.profile.nativeId, UNBOUND.slug]]);
  const contractorFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    const claims = await verifyContractorAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', body.action === 'acknowledge' ? 'source:ack' : 'source:read', nonces);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: contractorSlugs.get(body.profile.nativeId), publicationState: 'PUBLISHABLE', reviewedClass: 'contractor_profile', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: body.manifest,
      manifestDigest: body.manifestDigest, browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser } });
    if (!body.receipts.every(r => r.requestKey.startsWith(claims.browser + ':')) || body.receipts.some(r => 'watch' in r || r.watchCreated)) return Response.json({ ok: false }, { status: 403 });
    assert.equal(depth, 1, 'contractor acknowledgement ran before the save transaction released, depth=' + depth);
    acknowledged.push(['contractor', body.receipts.map(r => r.parent.outcome).join()]);
    return Response.json({ ok: true, result: { watchCreated: false } });
  };

  let parent = { subject: A, session: sidA, label: 'Fixture A' };
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
    assembly.contractorKey = contractor.publicKey; assembly.contractorSource = new ContractorSourceChannel(ask.privateKey, contractorFetch, CONTRACTOR_PRODUCTION_PINS);
    return assembly;
  };
  const bindings = { enabled: true, runtimeForRequest: r => runtime().serviceRuntime(r), acceptInsuranceManifest: r => runtime().acceptInsuranceManifest(r) };
  const post = async (bytes, assertion) => {
    const response = await handleProfileSave(new Request(ASK + API_PATH, { method: 'POST', body: bytes, headers: { 'content-type': 'application/json', [ASSERTION_HEADER]: assertion } }), bindings);
    return { status: response.status, body: await response.json() };
  };
  const signFor = {
    move: (bytes, browser) => signAssertion(move.privateKey, 'move', ASK + API_PATH, 'transfer:stage', bytes, browser, null, null, Date.now(), PRODUCTION_TARGET),
    lender: (bytes, browser) => signLenderAssertion(lender.privateKey, 'lender', ASK + API_PATH, 'transfer:stage', bytes, browser),
    insurance: (bytes, browser) => signInsuranceAssertion(insurance.privateKey, 'insurance', ASK + API_PATH, 'transfer:stage', bytes, browser),
    contractor: (bytes, browser) => signContractorAssertion(contractor.privateKey, 'contractor', ASK + API_PATH, 'transfer:stage', bytes, browser),
  };
  const manifestFor = m => ({ version: 'v2-3/selected-profiles/3', sourceHub: m.hub, audience: 'ask',
    selected: [{ localItemId: m.slug, revision: m.hub === 'move' ? 'a'.repeat(64) : '1', digest: 'a'.repeat(64), profile: m.profile }],
    returnTask: { kind: 'profile', hub: m.hub, profile: m.profile, canonicalSlug: m.slug, returnPath: m.returnPath } });
  const closedInsuranceManifest = m => {
    const profile = { hub: 'insurance', profileClass: 'insurance_provider', identifierNamespace: 'insurance.state_license', sourceIdentifier: m.license, jurisdiction: m.jurisdiction, canonicalReturnPath: m.returnPath };
    return { version: 'v2-3/selected-profiles/3', sourceHub: 'insurance', audience: 'ask', selected: [{ localItemId: m.slug, revision: '1', digest: insuranceProfileDigest(profile), profile }],
      returnTask: { kind: 'profile', hub: 'insurance', canonicalSlug: m.slug, profile, canonicalReturnPath: m.returnPath } };
  };
  async function stage(m, browser = randomRef()) {
    if (m.hub === 'insurance') {
      const bytes = Buffer.from(JSON.stringify(closedInsuranceManifest(m)));
      const staged = await post(bytes, signFor.insurance(bytes, browser));
      return staged.status === 200 ? { status: 200, continuationRef: staged.body.result.continuationRef, browser } : { status: staged.status, body: staged.body };
    }
    const service = async (operation, input) => { const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input })); return post(bytes, signFor[m.hub](bytes, browser)); };
    const manifest = manifestFor(m);
    const marking = m.hub === 'contractor';
    if (marking) { watch = true; maxDepth = 0; }
    const staged = await service('prepareGuestProfileTransfer', manifest);
    if (marking) watch = false;
    if (staged.status !== 200) return { status: staged.status, body: staged.body };
    const continuation = await service('prepareProfileSaveContinuation', { sourceHub: m.hub, audience: 'ask', transferRef: staged.body.result.transferRef, manifestDigest: staged.body.result.manifestDigest });
    if (continuation.status !== 200) return { status: continuation.status, body: continuation.body };
    if (m.hub === 'move') moveSnapshot = { ...continuation.body.result, transferRef: staged.body.result.transferRef, manifest, manifestDigest: staged.body.result.manifestDigest, browserProof: browser, requestPrefix: randomRef() };
    return { status: 200, continuationRef: continuation.body.result.continuationRef, browser };
  }
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
    const before = bindingDepths.length;
    const staged = await stage(m);
    if (staged.status !== 200) return { stage: staged.status, body: staged.body, bindingReads: bindingDepths.slice(before) };
    const { cookie: _cookie, ...result } = await arrive(m, staged.continuationRef, intent);
    return { stage: 200, ...result, bindingReads: bindingDepths.slice(before) };
  }
  const returned = m => ({ stage: 200, arrival: 303, status: 303, location: m.origin + m.returnPath });
  const saves = async () => (await db.query(`select e.canonical_name,s.source_hub,s.removed_at is null as active
    from consumer.consumer_saved_entities s join network.network_entities e on e.id=s.network_entity_id where s.user_id=$1 order by e.canonical_name`, [A])).rows;
  const active = async () => (await saves()).filter(r => r.active).map(r => r.canonical_name).sort();
  const snapshot = async () => JSON.stringify((await db.query('select id,user_id,network_entity_id,removed_at,row_version from consumer.consumer_saved_entities order by id')).rows);
  const quiet = () => db.exec('delete from ops.consumer_rate_limit_events; delete from ops.v23_profile_runtime_quota');
  const proofFor = () => ({ code: randomRef(), state: randomRef(), nonce: randomRef(), intent: randomRef(), creationKey: randomUUID(), targetOrigin: ASK, rateBucket: 'f'.repeat(64) });
  const issue = (proof, hub) => store.authorized(d => d.query(`select v23_private.prod_hub_issue_context($1,$2,$3,$4)`, [JSON.stringify(proof), A, sidA, hub]));
  const authorityFor = (hub, operation, input, scopes) => ({ hub, audience: 'ask', service: `svc:trusthub:${hub}:bff:v1`, scopes,
    subject: A, session: 'ab'.repeat(32), browser: 'cd'.repeat(32), operation, input });
  async function readAuthority(authority) {
    await db.exec('begin');
    try {
      await db.query('set local role myth_v23_authorizer');
      await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(authority)]);
      await db.query('set local role myth_v23_executor');
      return (await db.query('select v23_private.authority() as c')).rows[0].c;
    } finally { await db.exec('rollback'); }
  }
  async function rejectAuthority(authority, pattern) {
    await assert.rejects(readAuthority(authority), error => error.code === '42501' && pattern.test(error.message));
  }
  const selectSets = results => results.filter(r => Array.isArray(r.rows) && Array.isArray(r.fields) && r.fields.length > 0);
  const preflight = async () => selectSets(await db.exec(read('16-ask-prod-contractor-dbpr-preflight.sql')));

  const before = await preflight();
  assert.ok(before.length >= 5, 'preflight returned ' + before.length + ' sets');
  assert.ok(before.every(r => r.rows.length === 0), 'preflight was not empty before packet 16: ' + JSON.stringify(before.map(r => r.rows)));
  console.log('PASS packet 16 preflight is empty before the authority and binding packets, including the already-applied authority hold');

  await quiet();
  const savedBefore = await snapshot();
  acknowledged.length = 0;
  const missing = await click(ROOF, 'save');
  assert.notEqual(missing.stage, 200, JSON.stringify(missing.body));
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), savedBefore);
  const blocked = proofFor();
  await issue(blocked, 'contractor');
  await rejectAuthority(authorityFor('contractor', 'consumeProfileSaveContinuation', { continuationRef: 'x', issuer: 'contractor', browserProof: 'y' }, ['saved:write']), /invalid authority/);
  const contractorAuthority = authorityFor('contractor', 'consumeProfileSaveContinuation', {}, ['saved:write']);
  contractorAuthority.exchangeProof = blocked;
  await db.exec('begin');
  await db.query('set local role myth_v23_authorizer');
  await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(contractorAuthority)]);
  await db.query('set local role myth_v23_executor');
  await assert.rejects(db.query('select v23_private.consume_context($1)', [JSON.stringify(blocked)]), error => error.code === '42501' && /invalid authority/.test(error.message));
  await db.exec('rollback');
  assert.equal(await snapshot(), savedBefore);
  console.log('PASS missing contractor authority fails closed: stage is refused, consume_context raises 42501, and no Saved row is written');

  const authorityForward = read('16-ask-prod-contractor-authority-forward.sql');
  const authorityRollback = read('16-ask-prod-contractor-authority-rollback.sql');
  await db.exec(`set v23.approved_project=''`);
  await assert.rejects(db.exec(authorityForward), /Explicit production authorization required/); await db.exec('rollback');
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  await db.exec(authorityForward);
  await assert.rejects(db.exec(authorityForward), /already applied; review, do not re-apply/); await db.exec('rollback');
  const held = await preflight();
  const holds = held.filter(r => r.rows.some(row => row.disposition === 'ALREADY_APPLIED_HOLD'));
  assert.equal(holds.length, 1);
  assert.equal(holds[0].rows.length, 1);
  assert.ok(held.filter(r => r !== holds[0]).every(r => r.rows.length === 0), JSON.stringify(held.map(r => r.rows)));
  console.log('PASS contractor authority forward applies once, a second apply is a hold, and preflight reports ALREADY_APPLIED_HOLD instead of a clean skip');

  const accepted = await readAuthority(authorityFor('contractor', 'prepareGuestProfileTransfer', manifestFor(ROOF), ['transfer:stage']));
  assert.equal(accepted.hub, 'contractor');
  const consumed = await readAuthority(authorityFor('contractor', 'consumeProfileSaveContinuation', { continuationRef: 'x', issuer: 'contractor', browserProof: 'y' }, ['saved:write']));
  assert.equal(consumed.hub, 'contractor');
  assert.equal((await readAuthority(authorityFor('contractor', 'commitProfileSave', { item: { profile: ROOF.profile } }, ['saved:write']))).hub, 'contractor');
  for (const hub of ['move', 'insurance', 'lender']) {
    assert.equal((await readAuthority(authorityFor(hub, 'consumeProfileSaveContinuation', {}, ['saved:write']))).hub, hub, hub);
  }
  await rejectAuthority(authorityFor('senior', 'consumeProfileSaveContinuation', {}, ['saved:write']), /invalid authority/);
  await rejectAuthority(authorityFor('investor', 'consumeProfileSaveContinuation', {}, ['saved:write']), /invalid authority/);
  const wrongClass = manifestFor({ ...ROOF, profile: { ...ROOF.profile, profileClass: 'mover' } });
  await rejectAuthority(authorityFor('contractor', 'prepareGuestProfileTransfer', wrongClass, ['transfer:stage']), /invalid authority/);
  const wrongNamespace = manifestFor({ ...ROOF, profile: { hub: 'contractor', nativeId: 'nmls:2767', profileClass: 'contractor_profile' } });
  await rejectAuthority(authorityFor('contractor', 'prepareGuestProfileTransfer', wrongNamespace, ['transfer:stage']), /invalid authority/);
  await rejectAuthority(authorityFor('contractor', 'commitProfileSave', { item: { profile: { hub: 'contractor', nativeId: 'fl.dbpr.license:CCC057187', profileClass: 'official_firm' } } }, ['saved:write']), /invalid authority/);
  console.log('PASS v23_private.authority accepts the contractor contract and still accepts move, insurance, and lender; senior, investor, wrong class, and wrong namespace are refused');

  await db.exec(`select set_config('v23bind.contractor_dbpr_checked','true',false)`);
  const bound = selectSets(await db.exec(read('16-ask-prod-contractor-dbpr-binding-forward.sql')));
  const receipt = bound.find(r => r.rows.some(row => row.external_key === 'CCC057187'));
  assert.ok(receipt && receipt.rows.length === 3, JSON.stringify(bound.map(r => r.rows)));
  console.log('PASS packet 16 binding forward creates the three exact DBPR bindings');

  await quiet(); acknowledged.length = 0;
  const first = await click(ROOF, 'save');
  assert.deepEqual({ stage: first.stage, arrival: first.arrival, status: first.status, location: first.location }, returned(ROOF));
  assert.deepEqual(acknowledged, [['contractor', 'saved']]);
  const stageReads = first.bindingReads.filter(r => r.watch);
  const commitReads = first.bindingReads.filter(r => !r.watch);
  assert.ok(stageReads.length >= 1, 'stage binding lookup did not run');
  assert.ok(stageReads.every(r => r.depth === 1), JSON.stringify(stageReads));
  assert.equal(maxDepth, 1, 'contractor stage opened a second connection');
  assert.ok(commitReads.length >= 1 && commitReads.every(r => r.depth === 2), JSON.stringify(commitReads));
  assert.deepEqual((await saves()).filter(r => r.canonical_name === ROOF.legalName), [{ canonical_name: ROOF.legalName, source_hub: 'contractor', active: true }]);
  const handoff = (await db.query(`select issuer_hub,initiating_origin,audience_hub,status from ops.consumer_auth_handoffs order by created_at desc limit 1`)).rows[0];
  assert.deepEqual(handoff, { issuer_hub: 'contractor', initiating_origin: CONTRACTOR, audience_hub: 'ask', status: 'consumed' });
  await quiet(); acknowledged.length = 0;
  const repeat = await click(ROOF, 'save');
  assert.deepEqual({ stage: repeat.stage, arrival: repeat.arrival, status: repeat.status, location: repeat.location }, returned(ROOF));
  assert.deepEqual(acknowledged, [['contractor', 'already_saved']]);
  assert.equal((await saves()).filter(r => r.canonical_name === ROOF.legalName).length, 1);
  await quiet(); acknowledged.length = 0;
  const removed = await click(ROOF, 'unsave');
  assert.deepEqual({ stage: removed.stage, arrival: removed.arrival, status: removed.status, location: removed.location }, returned(ROOF));
  assert.deepEqual(acknowledged, [['contractor', 'local_only']]);
  assert.deepEqual(await active(), []);
  console.log('PASS contractor Save, repeated Save, and Unsave; context is contractor; acknowledgement follows commit; binding reads stay on one connection');

  for (const canary of [PLUMB, ABSCO]) {
    await quiet(); acknowledged.length = 0;
    const saved = await click(canary, 'save');
    assert.deepEqual({ stage: saved.stage, arrival: saved.arrival, status: saved.status, location: saved.location }, returned(canary), canary.slug);
    assert.deepEqual(acknowledged, [['contractor', 'saved']], canary.slug);
    await quiet(); acknowledged.length = 0;
    assert.deepEqual({ ...(await click(canary, 'unsave')), bindingReads: undefined }, { ...returned(canary), bindingReads: undefined });
    assert.deepEqual(acknowledged, [['contractor', 'local_only']], canary.slug);
  }
  assert.deepEqual(await active(), []);
  console.log('PASS clean canaries CFC1427249 and CGC1506243 save and unsave');

  // Same logical DBPR key, second accepted claim outside jurisdiction FL.
  // The specialist id differs so the accepted-specialist unique index allows
  // the row; only the namespace-and-key lookup can see it.
  const roofReceipt = receipt.rows.find(r => r.external_key === 'CCC057187');
  const resolveContractor = id => store.authorized(async d => (await d.query('select * from v23_private.prod_contractor_dbpr_binding_for($1)', [id])).rows);
  const beforeDup = await snapshot();
  async function competingClaim(label, jurisdiction) {
    return variantClaim(label, { source: 'CCC057187', jurisdiction });
  }
  async function variantClaim(label, patch) {
    const entityId = (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
      values('organization',$1,'contractor','FL',$2,$3) returning id`, ['A & R ROOFING INC ' + label, '/contractors/ccc057187-' + label, patch.entityStatus ?? 'active'])).rows[0].id;
    const bindingId = (await db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref)
      values($1,'contractor',$2,$3,$4,$5,$6,$7,clock_timestamp(),$8) returning id`,
      [entityId, patch.type ?? 'contractor_profile', patch.specialistId ?? ('fixture:' + label), patch.namespace ?? 'fl.dbpr.license', patch.source, 'jurisdiction' in patch ? patch.jurisdiction : 'FL', patch.status ?? 'accepted', 'local-' + label])).rows[0].id;
    return bindingId;
  }
  async function closeClaim(bindingId) {
    const closed = await db.query(`update network.network_entity_bindings set valid_to=clock_timestamp() where id=$1 and valid_to is null returning id`, [bindingId]);
    assert.equal(closed.rows.length, 1);
  }
  async function denySave(label) {
    await quiet(); acknowledged.length = 0;
    const denied = await click(ROOF, 'save');
    assert.notEqual(denied.stage, 200, label + ' ' + JSON.stringify(denied.body));
    assert.deepEqual(acknowledged, [], label + ' acknowledgement');
    assert.equal(await snapshot(), beforeDup, label + ' saved');
  }
  const seenByPreflight = async (specialistId) => (await preflight())[0].rows.some(r => r.specialist_entity_id === specialistId && r.source_identifier === 'CCC057187' && r.identifier_namespace === 'fl.dbpr.license');
  const nullClaim = await competingClaim('null-jurisdiction', null);
  const nullPreflight = await seenByPreflight('fixture:null-jurisdiction');
  let rows = await resolveContractor(ROOF.profile.nativeId);
  const nullRows = rows.length;
  const nullClass = classifyContractorRows(ROOF.profile.nativeId, rows);
  await closeClaim(nullClaim);
  const njClaim = await competingClaim('nj-jurisdiction', 'NJ');
  const njPreflight = await seenByPreflight('fixture:nj-jurisdiction');
  rows = await resolveContractor(ROOF.profile.nativeId);
  const njRows = rows.length;
  const njClass = classifyContractorRows(ROOF.profile.nativeId, rows);
  await closeClaim(njClaim);
  assert.equal(nullPreflight, true, 'preflight result 1 must list the null-jurisdiction claim');
  assert.equal(njPreflight, true, 'preflight result 1 must list the NJ claim');
  assert.equal(nullRows === 2 && njRows === 2, true, 'null rows ' + nullRows + ' ' + nullClass.outcome + '; NJ rows ' + njRows + ' ' + njClass.outcome);
  await db.query(`update network.network_entity_bindings set valid_to=null where id=$1 and provenance_ref='local-null-jurisdiction'`, [nullClaim]);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, await resolveContractor(ROOF.profile.nativeId)).reason, 'ambiguous');
  await denySave('FL plus null jurisdiction');
  await closeClaim(nullClaim);
  await db.query(`update network.network_entity_bindings set valid_to=null where id=$1 and provenance_ref='local-nj-jurisdiction'`, [njClaim]);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, await resolveContractor(ROOF.profile.nativeId)).reason, 'ambiguous');
  await denySave('FL plus NJ');
  await closeClaim(njClaim);
  await db.query(`update network.network_entity_bindings set valid_to=clock_timestamp() where id=$1 and valid_to is null`, [roofReceipt.binding_id]);
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 0);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'missing');
  await denySave('zero binding');
  const onlyNj = await competingClaim('only-nj', 'NJ');
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1, 'a lone NJ claim must be returned');
  assert.equal(rows[0].jurisdiction, 'NJ');
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'identity_disagreement');
  await denySave('single NJ');
  await closeClaim(onlyNj);
  const onlyNull = await competingClaim('only-null', null);
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1, 'a lone null-jurisdiction claim must be returned');
  assert.equal(rows[0].jurisdiction, null);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'identity_disagreement');
  await denySave('single null jurisdiction');
  await closeClaim(onlyNull);
  await db.query(`update network.network_entity_bindings set valid_to=null where id=$1`, [roofReceipt.binding_id]);
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).outcome, 'eligible');
  console.log('PASS same-key claims outside FL are visible: null and NJ duplicates are ambiguous, a lone non-FL claim is denied, and preflight lists both');

  const logicalClaims = async () => Number((await db.query(`select count(*)::int as n from network.network_entity_bindings
    where hub='contractor' and binding_status in ('accepted','review_required')
      and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
      and (lower(btrim(specialist_entity_id))=lower(btrim($1)) or (identifier_namespace='fl.dbpr.license' and source_identifier_normalized=lower(btrim(split_part($1,':',2)))))`,
    [ROOF.profile.nativeId])).rows[0].n);
  const policyQual = (await db.query(`select policyname, qual from pg_policies where policyname like 'prod_contractor_dbpr%' order by policyname`)).rows;
  async function normalizedProbe(label, source, jurisdiction) {
    const bindingId = await variantClaim(label, { source, jurisdiction });
    const listed = (await preflight())[0].rows.some(r => r.specialist_entity_id === 'fixture:' + label);
    const resolved = await resolveContractor(ROOF.profile.nativeId);
    await quiet(); acknowledged.length = 0;
    const save = await click(ROOF, 'save');
    const evidence = {
      label, source, jurisdiction, listed,
      resolver: resolved.length, logical: await logicalClaims(),
      reason: classifyContractorRows(ROOF.profile.nativeId, resolved).reason,
      stage: save.stage, ack: acknowledged.slice(), wrote: (await snapshot()) !== beforeDup,
    };
    if (evidence.wrote) {
      await quiet(); acknowledged.length = 0;
      await click(ROOF, 'unsave');
    }
    await closeClaim(bindingId);
    return evidence;
  }
  const lowerEvidence = await normalizedProbe('lower-nj', 'ccc057187', 'NJ');
  const paddedEvidence = await normalizedProbe('padded-al', ' CCC057187 ', 'AL');
  assert.equal(lowerEvidence.listed === true && lowerEvidence.resolver === 2 && lowerEvidence.logical === 2 && lowerEvidence.reason === 'ambiguous' && lowerEvidence.stage !== 200 && lowerEvidence.ack.length === 0 && lowerEvidence.wrote === false
    && paddedEvidence.listed === true && paddedEvidence.resolver === 2 && paddedEvidence.logical === 2 && paddedEvidence.reason === 'ambiguous' && paddedEvidence.stage !== 200 && paddedEvidence.ack.length === 0 && paddedEvidence.wrote === false,
    true, JSON.stringify({ policyQual, lowerEvidence, paddedEvidence }));
  console.log('PASS case and padding duplicates: preflight and the resolver both see the competing claim, and Save writes nothing');

  async function readerSees(bindingId) {
    await db.exec('begin');
    try {
      await db.query('set local role myth_v23_prod_reader');
      return (await db.query('select count(*)::int as n from network.network_entity_bindings where id=$1', [bindingId])).rows[0].n;
    } catch (error) {
      return error.message;
    } finally {
      await db.exec('rollback');
    }
  }
  async function specialistProbe(label, specialistId, extra = {}) {
    const namespace = extra.namespace ?? 'nj.dca.license';
    const bindingId = await variantClaim(label, {
      source: extra.source ?? 'NJ-NOT-DBPR',
      jurisdiction: 'jurisdiction' in extra ? extra.jurisdiction : 'NJ',
      namespace,
      specialistId,
      status: extra.status,
      type: extra.type,
      entityStatus: extra.entityStatus,
    });
    const readerRows = await readerSees(bindingId);
    const listed = (await preflight())[0].rows.some(r => r.specialist_entity_id === specialistId && r.identifier_namespace === namespace);
    const resolved = await resolveContractor(ROOF.profile.nativeId);
    await quiet(); acknowledged.length = 0;
    const save = await click(ROOF, 'save');
    const evidence = {
      label, specialistId, listed, readerRows,
      resolver: resolved.length, logical: await logicalClaims(),
      reason: classifyContractorRows(ROOF.profile.nativeId, resolved).reason,
      stage: save.stage, ack: acknowledged.slice(), wrote: (await snapshot()) !== beforeDup,
      seen: resolved.map(r => r.specialist_entity_id),
    };
    if (evidence.wrote) {
      await quiet(); acknowledged.length = 0;
      await click(ROOF, 'unsave');
    }
    await closeClaim(bindingId);
    return evidence;
  }
  const specialistDenied = evidence => evidence.listed === true && evidence.readerRows === 1 && evidence.resolver === evidence.logical && evidence.resolver === 2
    && evidence.reason === 'ambiguous' && evidence.stage !== 200 && evidence.ack.length === 0 && evidence.wrote === false;
  const lowerSpecialist = await specialistProbe('spec-lower', 'fl.dbpr.license:ccc057187');
  const paddedSpecialist = await specialistProbe('spec-padded', ' fl.dbpr.license:CCC057187');
  assert.equal(specialistDenied(lowerSpecialist) && specialistDenied(paddedSpecialist), true, JSON.stringify({ policyQual, lowerSpecialist, paddedSpecialist }));
  const mixedSpecialist = await specialistProbe('spec-mixed', 'fl.dbpr.license:Ccc057187');
  assert.equal(specialistDenied(mixedSpecialist), true, JSON.stringify(mixedSpecialist));
  const upperNamespace = await specialistProbe('spec-upper-ns', 'FL.DBPR.LICENSE:CCC057187');
  assert.equal(specialistDenied(upperNamespace), true, JSON.stringify(upperNamespace));
  console.log('PASS specialist-id case and padding duplicates: preflight and the resolver both see the competing claim, and Save writes nothing');

  const lowerOpen = await variantClaim('lower-open', { source: 'ccc057187', jurisdiction: 'NJ' });
  const paddedOpen = await variantClaim('padded-open', { source: ' CCC057187 ', jurisdiction: null });
  const specOpen = await variantClaim('spec-open', { source: 'NJ-NOT-DBPR', jurisdiction: 'NJ', namespace: 'nj.dca.license', specialistId: 'fl.dbpr.license:ccc057187' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 3, 'the resolver fail-closes at limit 3 when four logical claims exist');
  assert.equal(await logicalClaims(), 4);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'ambiguous');
  await denySave('lowercase source plus padded source plus specialist id');
  await closeClaim(lowerOpen);
  await closeClaim(paddedOpen);
  await closeClaim(specOpen);
  const nullVariant = await variantClaim('null-variant', { source: 'ccc057187', jurisdiction: null });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 2);
  assert.equal(rows.length, await logicalClaims());
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'ambiguous');
  await denySave('NULL jurisdiction normalized duplicate');
  await closeClaim(nullVariant);
  const reviewVariant = await variantClaim('review-variant', { source: ' CCC057187 ', jurisdiction: 'NJ', status: 'review_required' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 2);
  assert.equal(rows.length, await logicalClaims());
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'ambiguous');
  await denySave('review_required normalized duplicate');
  await closeClaim(reviewVariant);
  const inactiveVariant = await variantClaim('inactive-variant', { source: 'ccc057187', jurisdiction: 'NJ', entityStatus: 'retired' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 2);
  assert.equal(rows.length, await logicalClaims());
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'ambiguous');
  await denySave('inactive normalized duplicate');
  await closeClaim(inactiveVariant);
  const wrongClassClaim = await variantClaim('wrong-class', { source: 'ccc057187', jurisdiction: 'NJ', type: 'marketplace_company' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 2);
  assert.equal(rows.length, await logicalClaims());
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'ambiguous');
  await denySave('wrong-class normalized duplicate');
  await closeClaim(wrongClassClaim);
  const otherNamespace = await variantClaim('other-namespace', { source: 'ccc057187', jurisdiction: 'NJ', namespace: 'nj.dca.license' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1);
  assert.equal(rows.length, await logicalClaims());
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).outcome, 'eligible');
  assert.equal(rows.some(r => r.identifier_namespace !== 'fl.dbpr.license'), false);
  await closeClaim(otherNamespace);
  await db.query(`update network.network_entity_bindings set valid_to=clock_timestamp() where id=$1 and valid_to is null`, [roofReceipt.binding_id]);
  const loneLower = await variantClaim('lone-lower', { source: 'ccc057187', jurisdiction: 'NJ' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_identifier, 'ccc057187');
  assert.equal(rows[0].jurisdiction, 'NJ');
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'identity_disagreement');
  await denySave('lone lowercase NJ');
  await closeClaim(loneLower);
  const lonePadded = await variantClaim('lone-padded', { source: ' CCC057187 ', jurisdiction: null });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].jurisdiction, null);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'identity_disagreement');
  await denySave('lone padded null jurisdiction');
  await closeClaim(lonePadded);
  const loneSpecLower = await variantClaim('lone-spec-lower', { source: 'NJ-NOT-DBPR', jurisdiction: 'NJ', namespace: 'nj.dca.license', specialistId: 'fl.dbpr.license:ccc057187' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1, 'a lone lowercase specialist id must be returned');
  assert.equal(rows[0].specialist_entity_id, 'fl.dbpr.license:ccc057187');
  assert.equal(rows[0].identifier_namespace, 'nj.dca.license');
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'identity_disagreement');
  await denySave('lone lowercase specialist id');
  await closeClaim(loneSpecLower);
  const loneSpecPadded = await variantClaim('lone-spec-padded', { source: 'NJ-NOT-DBPR', jurisdiction: null, namespace: 'nj.dca.license', specialistId: ' fl.dbpr.license:CCC057187' });
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1, 'a lone padded specialist id must be returned');
  assert.equal(rows[0].specialist_entity_id, ' fl.dbpr.license:CCC057187');
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).reason, 'identity_disagreement');
  await denySave('lone padded specialist id');
  await closeClaim(loneSpecPadded);
  await db.query(`update network.network_entity_bindings set valid_to=null where id=$1`, [roofReceipt.binding_id]);
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1);
  assert.equal(rows.length, await logicalClaims());
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).outcome, 'eligible');
  const reviewSpec = await specialistProbe('spec-review', 'fl.dbpr.license:ccc057187', { status: 'review_required' });
  const inactiveSpec = await specialistProbe('spec-inactive', ' fl.dbpr.license:CCC057187', { entityStatus: 'retired' });
  const wrongClassSpec = await specialistProbe('spec-class', 'fl.dbpr.license:Ccc057187', { type: 'marketplace_company' });
  const nullSpec = await specialistProbe('spec-null', 'fl.dbpr.license:ccc057187', { jurisdiction: null });
  assert.equal(specialistDenied(reviewSpec) && specialistDenied(inactiveSpec) && specialistDenied(wrongClassSpec) && specialistDenied(nullSpec), true, JSON.stringify({ reviewSpec, inactiveSpec, wrongClassSpec, nullSpec }));
  for (const presented of ['fl.dbpr.license:ccc057187', 'fl.dbpr.license: CCC057187', ' fl.dbpr.license:CCC057187', 'fl.dbpr.license:CCC057187 ']) {
    const found = await resolveContractor(presented);
    assert.equal(found.length, 0, presented);
    assert.equal(classifyContractorRows(presented, found).outcome, 'denied', presented);
  }
  rows = await resolveContractor(ROOF.profile.nativeId);
  assert.equal(rows.length, 1);
  assert.equal(classifyContractorRows(ROOF.profile.nativeId, rows).outcome, 'eligible');
  console.log('PASS normalized DBPR duplicates are denied, a wrong namespace stays ineligible, and the canonical FL row remains eligible');

  await quiet(); acknowledged.length = 0;
  assert.deepEqual(await click(HINDMAN, 'save'), { ...returned(HINDMAN), bindingReads: [] });
  assert.deepEqual(acknowledged, [['move', 'saved']]);
  await quiet(); acknowledged.length = 0; await click(HINDMAN, 'unsave');
  assert.deepEqual(acknowledged, [['move', 'local_only']]);
  await quiet(); acknowledged.length = 0;
  assert.deepEqual({ ...(await click(FREEDOM, 'save')), bindingReads: undefined }, { ...returned(FREEDOM), bindingReads: undefined });
  const freedom = await click(FREEDOM, 'save');
  assert.equal(freedom.location, FREEDOM.origin + FREEDOM.returnPath);
  await quiet(); acknowledged.length = 0; await click(FREEDOM, 'unsave');
  assert.deepEqual(acknowledged, [['lender', 'local_only']]);
  await quiet(); acknowledged.length = 0;
  const insuranceSave = await click(ASFIN, 'save');
  assert.equal(insuranceSave.location, ASFIN.origin + ASFIN.returnPath);
  assert.deepEqual(acknowledged, [['insurance', 'saved']]);
  await quiet(); acknowledged.length = 0; await click(ASFIN, 'unsave');
  assert.deepEqual(acknowledged, [['insurance', 'local_only']]);
  assert.deepEqual(await active(), []);
  console.log('PASS move, lender, and insurance Save/Unsave still succeed after the contractor authority body');

  await quiet(); acknowledged.length = 0;
  const again = await click(ROOF, 'save');
  assert.equal(again.status, 303);
  const committed = await snapshot();
  const staged = await stage(ROOF);
  assert.equal(staged.status, 200);
  const crossed = await arrive(ROOF, staged.continuationRef, 'save', LENDER);
  assert.notEqual(crossed.status, 303);
  assert.equal(await snapshot(), committed);
  const lenderProof = proofFor(); await issue(lenderProof, 'lender');
  const asContractor = authorityFor('contractor', 'consumeProfileSaveContinuation', {}, ['saved:write']);
  asContractor.exchangeProof = lenderProof;
  await db.exec('begin');
  await db.query('set local role myth_v23_authorizer');
  await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)', [JSON.stringify(asContractor)]);
  await db.query('set local role myth_v23_executor');
  await assert.rejects(db.query('select v23_private.consume_context($1)', [JSON.stringify(lenderProof)]), error => error.code === '42501');
  await db.exec('rollback');
  assert.equal(await snapshot(), committed);
  console.log('PASS wrong-hub contractor context is refused and writes no Saved row');

  await db.query(`update network.network_entity_bindings set binding_status='review_required' where specialist_entity_id=$1 and binding_status='accepted'`, [ROOF.profile.nativeId]);
  const reviewSets = await preflight();
  assert.ok(reviewSets.some(r => r.rows.some(row => row.binding_status === 'review_required')), JSON.stringify(reviewSets.map(r => r.rows)));
  await quiet(); acknowledged.length = 0;
  const review = await click(ROOF, 'save');
  assert.notEqual(review.stage, 200, JSON.stringify(review.body));
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), committed);
  await db.query(`update network.network_entity_bindings set binding_status='accepted' where specialist_entity_id=$1 and binding_status='review_required'`, [ROOF.profile.nativeId]);
  console.log('PASS review_required is reported by preflight and fails closed with no Saved row');

  await db.query(`update network.network_entities set status='retired' where canonical_public_profile_ref=$1`, [ROOF.returnPath]);
  await quiet(); acknowledged.length = 0;
  const inactive = await click(ROOF, 'save');
  assert.notEqual(inactive.stage, 200, JSON.stringify(inactive.body));
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), committed);
  await db.query(`update network.network_entities set status='active' where canonical_public_profile_ref=$1`, [ROOF.returnPath]);
  console.log('PASS inactive contractor entity fails closed with no Saved row');

  const entity = (await db.query(`select network_entity_id from network.network_entity_bindings where specialist_entity_id=$1 and binding_status='accepted'`, [ROOF.profile.nativeId])).rows[0].network_entity_id;
  await db.query(`insert into network.network_entity_bindings (network_entity_id, hub, specialist_entity_type, specialist_entity_id, identifier_namespace, source_identifier, jurisdiction, binding_status, valid_from, provenance_ref)
    values ($1,'contractor','contractor_profile',$2,'fl.dbpr.license','CCC057187','FL','review_required', clock_timestamp() - interval '1 minute', 'local-ambiguity-fixture')`, [entity, ROOF.profile.nativeId]);
  await quiet(); acknowledged.length = 0;
  const ambiguous = await click(ROOF, 'save');
  assert.notEqual(ambiguous.stage, 200, JSON.stringify(ambiguous.body));
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), committed);
  await db.query(`update network.network_entity_bindings set valid_to = clock_timestamp() where provenance_ref='local-ambiguity-fixture'`);
  console.log('PASS multiple current contractor bindings fail closed with no Saved row');

  const watches = await db.query(`select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and c.relname ilike '%watch%'`);
  assert.deepEqual(watches.rows, []);
  assert.ok(acknowledged.every(row => !String(row[1]).includes('watch')));
  console.log('PASS no Watch relation exists and no acknowledgement created one');

  const moveBeforeRollback = await snapshot();
  await db.exec(authorityRollback);
  await rejectAuthority(authorityFor('contractor', 'consumeProfileSaveContinuation', {}, ['saved:write']), /invalid authority/);
  assert.equal((await readAuthority(authorityFor('move', 'consumeProfileSaveContinuation', {}, ['saved:write']))).hub, 'move');
  assert.equal((await readAuthority(authorityFor('lender', 'consumeProfileSaveContinuation', {}, ['saved:write']))).hub, 'lender');
  assert.equal((await readAuthority(authorityFor('insurance', 'consumeProfileSaveContinuation', {}, ['saved:write']))).hub, 'insurance');
  await quiet(); acknowledged.length = 0;
  const deniedAgain = await click(ROOF, 'save');
  assert.notEqual(deniedAgain.stage, 200);
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), moveBeforeRollback);
  await quiet(); acknowledged.length = 0;
  const moveAfter = await click(HINDMAN, 'save');
  assert.equal(moveAfter.location, HINDMAN.origin + HINDMAN.returnPath);
  assert.deepEqual(acknowledged, [['move', 'saved']]);
  await db.exec(authorityForward);
  await assert.rejects(db.exec(authorityForward), /already applied; review, do not re-apply/); await db.exec('rollback');
  console.log('PASS authority rollback restores the three-hub refusal, move still saves, and the forward packet applies again only from that restored body');

  const plumbing = receipt.rows.find(r => r.external_key === 'CFC1427249');
  const beforeBindingRollback = await snapshot();
  await db.query(`select set_config('v23.approved_project',$1,false), set_config('v23contractor.external_key',$2,false),
    set_config('v23contractor.binding_id',$3,false), set_config('v23contractor.network_entity_id',$4,false),
    set_config('v23contractor.canonical_public_profile_ref',$5,false)`,
    [PRODUCTION, plumbing.external_key, plumbing.binding_id, plumbing.network_entity_id, plumbing.canonical_public_profile_ref]);
  await db.exec(read('16-ask-prod-contractor-dbpr-binding-rollback.sql'));
  assert.equal(await snapshot(), beforeBindingRollback);
  assert.equal((await db.query(`select count(*)::int n from network.network_entities where id=$1`, [plumbing.network_entity_id])).rows[0].n, 1);
  assert.equal((await db.query(`select count(*)::int n from network.network_entity_bindings where id=$1 and valid_to is null`, [plumbing.binding_id])).rows[0].n, 0);
  await assert.rejects(db.exec(read('16-ask-prod-contractor-dbpr-binding-rollback.sql')), /exactly one/);
  await db.exec('rollback');
  await quiet(); acknowledged.length = 0;
  const closedSave = await click(PLUMB, 'save');
  assert.notEqual(closedSave.stage, 200, JSON.stringify(closedSave.body));
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), beforeBindingRollback);
  console.log('PASS packet 16 binding rollback closes one receipt binding, deletes nothing, preserves Saved research, and the closed facility is no longer eligible');
} finally {
  await db.close();
}
