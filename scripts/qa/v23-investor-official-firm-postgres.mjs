// Local embedded PostgreSQL ONLY. Proves the Ask side of the Investor
// official-firm Save on the PRODUCTION target shape: the real identity
// migrations, the real production packets 01/02/04/05, and the real packet 14
// (three firm CRD bindings + resolver), then the production assembly end to
// end: an Investor-signed stage, the top-level arrival, Save, repeated Save,
// Unsave, and every denial. Auth and the Investor source channel are explicit
// fixtures. Nothing here contacts a hosted database, Ask, or Investor.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PreviewAssembly } from '../../lib/my-trusthub/profile-save/preview-assembly.ts';
import { PreviewStore, randomRef } from '../../lib/my-trusthub/profile-save/preview-store.ts';
import { SourceChannel } from '../../lib/my-trusthub/profile-save/source-channel.ts';
import { InvestorSourceChannel } from '../../lib/my-trusthub/profile-save/investor-channel.ts';
import { INVESTOR_PRODUCTION_PINS, signInvestorAssertion, verifyInvestorAssertion } from '../../lib/my-trusthub/profile-save/investor-assertion.ts';
import { LENDER_PRODUCTION_PINS, signLenderAssertion } from '../../lib/my-trusthub/profile-save/lender-assertion.ts';
import { LenderSourceChannel } from '../../lib/my-trusthub/profile-save/lender-channel.ts';
import { handleProfileConfirmation } from '../../lib/my-trusthub/profile-save/browser.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { ASSERTION_HEADER, signAssertion } from '../../lib/my-trusthub/profile-save/service-assertion.ts';
import { API_PATH, PRODUCTION_TARGET } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { sessionMac } from '../../lib/my-trusthub/profile-save/session-authority.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const ASK = 'https://www.asktrusthub.com', INVESTOR = 'https://www.investortrusthub.com';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ENV = {
  VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
  MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: ASK,
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: `https://${PRODUCTION}.supabase.co`,
  MY_TRUSTHUB_V23_PARENT_ORIGIN: ASK, MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com',
  MY_TRUSTHUB_V23_PRODUCTION_PROJECT: PRODUCTION, MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated',
};
const firm = (crd, legalName) => ({ crd, legalName, slug: 'sec-crd-' + crd, profile: { hub: 'investor', nativeId: 'crd-' + crd, profileClass: 'official_firm' } });
const WEINBERGER = firm('106176', 'WEINBERGER ASSET MANAGEMENT, INC');
const METWEST = firm('104571', 'METROPOLITAN WEST ASSET MANAGEMENT LLC');
const WESTERN = firm('110441', 'WESTERN ASSET MANAGEMENT COMPANY, LLC');
const CANARIES = [WEINBERGER, METWEST, WESTERN];
const UNBOUND = firm('105958', 'FIXTURE UNBOUND FIRM');
const REVIEW = firm('7770001', 'FIXTURE REVIEW FIRM');
const AMBIGUOUS = firm('7770002', 'FIXTURE AMBIGUOUS FIRM');
const WRONG_CLASS = firm('7770003', 'FIXTURE REPRESENTATIVE');
const WRONG_REF = firm('7770004', 'FIXTURE WRONG PROFILE REF');
const RETIRED = firm('7770005', 'FIXTURE RETIRED ENTITY');
const WRONG_JURISDICTION = firm('7770006', 'FIXTURE STATE JURISDICTION');
const WRONG_CRD = firm('7770007', 'FIXTURE OTHER CRD');
const HINDMAN = { slug: 'hindman-isaacs-moving-storage-inc', legalName: 'HINDMAN & ISAACS MOVING & STORAGE INC', profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' } };
const FREEDOM = { slug: 'freedom-mortgage', profile: { hub: 'lender', nativeId: 'nmls:2767', profileClass: 'marketplace_company' } };
const MOVE_ORIGIN = 'https://www.movetrusthub.com', LENDER_ORIGIN = 'https://www.lendertrusthub.com';
function keys(kid) {
  const pair = generateKeyPairSync('ed25519');
  return { privateKey: { kid, pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    publicKey: { kid, pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } };
}

// Packet text: identity contract and INSERT-only forward.
{
  const body = sql => sql.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n');
  const forward = body(read('14-ask-prod-investor-crd-binding-forward.sql')), rollback = body(read('14-ask-prod-investor-crd-binding-rollback.sql')), preflight = body(read('14-ask-prod-investor-crd-preflight.sql'));
  for (const text of ["'investor', 'official_firm', 'crd-' || c.crd", "'sec.crd', c.crd, 'US', 'accepted'", "'/firm/sec-crd-' || crd", "('106176', 'WEINBERGER ASSET MANAGEMENT, INC')",
    "('104571', 'METROPOLITAN WEST ASSET MANAGEMENT LLC')", "('110441', 'WESTERN ASSET MANAGEMENT COMPANY, LLC')"]) assert.ok(forward.includes(text), text);
  assert.ok(!/\bdelete\s+from\b|\btruncate\b|\bon\s+conflict\b|\bupdate\s+network\./i.test(forward), 'forward is INSERT only');
  assert.ok(!/\bdelete\s+from\b|\btruncate\b|\bdrop\b|\binsert\s+into\b/i.test(rollback), 'rollback closes a validity window and nothing else');
  assert.ok(!/\b(insert|update|delete|create|alter|drop|grant)\b/i.test(preflight), 'preflight is read only');
  console.log('PASS packet 14 text: locked identity contract, INSERT-only forward, validity-only rollback, read-only preflight');
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
  const ask = keys('ask-fixture'), move = keys('move-fixture'), investor = keys('investor-fixture');
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  await db.exec(read('02-ask-prod-ports-forward.sql'));
  // Nothing of packet 14 is applied yet: the preflight is empty in all four result sets.
  const preflightSets = async () => (await db.exec(read('14-ask-prod-investor-crd-preflight.sql'))).map(r => r.rows.length);
  assert.deepEqual(await preflightSets(), [0, 0, 0, 0]);
  // The other hubs' own packets, unmodified, for the regression at the end.
  await db.exec(`set v23.binding_creation_authorized='true'; set v23bind.candidate_unchanged='true'; set v23bind.evidence_ref='local-sql-packet-fixture-only';
    select set_config('v23bind.preflight_checked_at',clock_timestamp()::text,false);`);
  await db.exec(read('03-ask-prod-move-binding-forward.sql')); await db.exec('reset role');
  await db.exec(`set v23.binding_creation_authorized=''`);
  await db.exec(read('04-ask-prod-runtime-role-forward.sql'));
  await db.exec(read('09-ask-prod-move-binding-resolver-forward.sql'));
  await db.exec(`set v23bind.nmls_consumer_access_checked='true'`);
  await db.exec(read('12-ask-prod-lender-nmls-binding-forward.sql'));
  assert.deepEqual(await preflightSets(), [0, 0, 0, 0]); // other hubs' identities never look like an Investor claim
  await db.query(`select set_config('v23.install_session_mac',$1,false)`, [createHash('sha256').update(ask.privateKey.pem).digest('hex')]);
  await db.exec(read('05-ask-prod-session-mac-install.sql'));
  // The database itself refuses the Investor hub until the authority packet is applied.
  const authorityForward = read('14-ask-prod-investor-authority-forward.sql'), authorityRollback = read('14-ask-prod-investor-authority-rollback.sql');
  const authorityBody = async () => (await db.query(`select prosrc,proowner::regrole::text as owner,proacl::text as acl,prosecdef from pg_proc where oid=to_regprocedure('v23_private.authority()')`)).rows.map(r => ({ ...r, prosrc: r.prosrc.replace(/\r\n/g, '\n') }))[0]; // line endings of the checkout are not part of the contract
  const reviewed = await authorityBody();
  assert.ok(reviewed.prosrc.includes(`c->>'hub' in ('move','insurance','lender') and`));
  await assert.rejects(db.exec(authorityRollback), /not the four-hub body|already the three-hub body/); await db.exec('rollback');
  await db.exec(authorityForward);
  const widened = await authorityBody();
  assert.equal(widened.prosrc, reviewed.prosrc.replace(`('move','insurance','lender')`, `('move','insurance','lender','investor')`));
  assert.deepEqual([widened.owner, widened.acl, widened.prosecdef], [reviewed.owner, reviewed.acl, reviewed.prosecdef]);
  await assert.rejects(db.exec(authorityForward), /already applied/); await db.exec('rollback');
  await db.exec(authorityRollback);
  assert.deepEqual(await authorityBody(), reviewed);
  await db.exec(authorityForward);
  console.log('PASS authority packet: one token added to the reviewed body, owner and ACL unchanged, re-run refused, rollback restores the exact prior function');
  // The Investor account-context issuer: one new function, the Move issuer untouched.
  const contextForward = read('14-ask-prod-investor-context-forward.sql'), contextRollback = read('14-ask-prod-investor-context-rollback.sql');
  const moveIssuer = async () => JSON.stringify((await db.query(`select prosrc,proowner::regrole::text as owner,proacl::text as acl from pg_proc where oid=to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)')`)).rows[0]);
  const moveIssuerBefore = await moveIssuer();
  await assert.rejects(db.exec(contextRollback), /nothing to remove/); await db.exec('rollback');
  await db.exec(contextForward);
  await assert.rejects(db.exec(contextForward), /already applied/); await db.exec('rollback');
  await db.exec(contextRollback);
  assert.equal((await db.query(`select to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)') is null as gone`)).rows[0].gone, true);
  await db.exec(contextForward);
  assert.equal(await moveIssuer(), moveIssuerBefore);
  const investorIssuer = (await db.query(`select prosrc,proowner::regrole::text as owner from pg_proc where oid=to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)')`)).rows[0];
  assert.equal(investorIssuer.owner, 'myth_v23_foundation');
  assert.equal(investorIssuer.prosrc.replace(/\s+/g, ''), JSON.parse(moveIssuerBefore).prosrc.replace("subject,'move',pin.move_origin,", "subject,'investor','https://www.investortrusthub.com',").replace(/\s+/g, ''));
  console.log('PASS context packet: the Investor issuer is the Move issuer with the hub and pinned origin changed; Move issuer untouched; rollback removes only it');
  console.log('PASS production ports, runtime role and session authority packets apply on the embedded database');

  // Packet 14: preflight is clean, forward refuses without both guards, applies once, and returns the receipt.
  assert.deepEqual(await preflightSets(), [0, 0, 0, 2]); // authority and context are in place, bindings are not
  const forward = read('14-ask-prod-investor-crd-binding-forward.sql');
  const identityRows = async () => JSON.stringify((await db.query(`select (select count(*)::int from network.network_entities) e,(select count(*)::int from network.network_entity_bindings) b`)).rows[0]);
  const empty = await identityRows();
  await assert.rejects(db.exec(forward), /Confirm each firm CRD on SEC IAPD/); await db.exec('rollback');
  await db.exec(`set v23.approved_project=''; set v23bind.sec_iapd_checked='true'`);
  await assert.rejects(db.exec(forward), /Explicit production authorization required/); await db.exec('rollback');
  assert.equal(await identityRows(), empty);
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  const receipt = (await db.exec(forward)).flatMap(r => r.rows || []).filter(r => r.binding_id);
  assert.deepEqual(receipt.map(r => [r.crd, r.canonical_public_profile_ref]), [['104571', '/firm/sec-crd-104571'], ['106176', '/firm/sec-crd-106176'], ['110441', '/firm/sec-crd-110441']]);
  assert.deepEqual((await db.query(`select e.entity_type,e.canonical_name,e.primary_hub,e.jurisdiction,e.canonical_public_profile_ref,e.status,b.hub,b.specialist_entity_type,
      b.specialist_entity_id,b.identifier_namespace,b.source_identifier,b.jurisdiction as binding_jurisdiction,b.binding_status,b.valid_to,b.provenance_ref
    from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id where b.hub='investor' order by b.source_identifier::bigint`)).rows,
    [METWEST, WEINBERGER, WESTERN].map(f => ({ entity_type: 'organization', canonical_name: f.legalName, primary_hub: 'investor', jurisdiction: 'US',
      canonical_public_profile_ref: '/firm/' + f.slug, status: 'active', hub: 'investor', specialist_entity_type: 'official_firm', specialist_entity_id: 'crd-' + f.crd,
      identifier_namespace: 'sec.crd', source_identifier: f.crd, binding_jurisdiction: 'US', binding_status: 'accepted', valid_to: null, provenance_ref: 'investor_trust_hub_firms' })));
  const applied = await identityRows();
  await assert.rejects(db.exec(forward), /already applied|requires steward review/); await db.exec('rollback');
  assert.equal(await identityRows(), applied);
  assert.deepEqual(await preflightSets(), [3, 3, 3, 2]); // after apply the preflight reports every claim and every packet-14 object
  console.log('PASS packet 14: clean preflight, guarded forward, exactly three firm CRD bindings, receipt returned, re-run refused');

  // Resolver contract, as the runtime login's roles. One exact identity in; no name, slug or uuid lookup.
  const pool = { connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) };
  const store = new PreviewStore(pool, PRODUCTION_TARGET);
  const resolve = id => store.authorized(async d => (await d.query('select * from v23_private.prod_investor_crd_binding_for($1)', [id])).rows);
  for (const f of CANARIES) {
    const r = receipt.find(x => x.crd === f.crd);
    assert.deepEqual((await resolve(f.profile.nativeId)).map(x => [x.id, x.network_entity_id, x.binding_status, x.specialist_entity_type, x.specialist_entity_id, x.identifier_namespace, x.source_identifier, x.jurisdiction, x.entity_status, x.canonical_public_profile_ref]),
      [[r.binding_id, r.network_entity_id, 'accepted', 'official_firm', 'crd-' + f.crd, 'sec.crd', f.crd, 'US', 'active', '/firm/' + f.slug]]);
  }
  for (const bad of ['crd-0', 'crd-', '%', 'crd-106176 ', "crd-1' or '1'='1", 'sec-crd-106176', '106176', WEINBERGER.legalName, receipt[0].binding_id, receipt[0].network_entity_id, 'crd-105958', ''])
    assert.equal((await resolve(bad)).length, 0, bad);
  for (const role of ['myth_v23_authorizer', 'myth_v23_executor']) for (const table of ['network.network_entity_bindings', 'network.network_entities']) {
    await db.exec(`begin; set local role ${role}`);
    await assert.rejects(db.query(`select 1 from ${table} limit 1`)); await db.exec('rollback');
  }
  console.log('PASS resolver: exact firm CRD only, at most three rows, no direct table access for runtime roles');

  // Fixture identities for the denials (steward-style rows, never created by packet 14).
  const entity = async (f, status = 'active', ref = '/firm/' + f.slug) => (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
    values('organization',$1,'investor','US',$2,$3) returning id`, [f.legalName, ref, status])).rows[0].id;
  const bind = (entityId, f, status, patch = {}) => db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref) values($1,'investor',$2,$3,'sec.crd',$4,$5,$6,now()-interval '1 minute','fixture-only')`,
    [entityId, patch.type ?? 'official_firm', patch.nativeId ?? f.profile.nativeId, patch.crd ?? f.crd, 'jurisdiction' in patch ? patch.jurisdiction : 'US', status]);
  await bind(await entity(REVIEW), REVIEW, 'review_required');
  await bind(await entity(AMBIGUOUS), AMBIGUOUS, 'accepted');
  await bind(await entity({ ...AMBIGUOUS, legalName: AMBIGUOUS.legalName + ' (second claim)' }, 'active', '/firm/second-claim'), AMBIGUOUS, 'accepted', { nativeId: 'fixture-other-id', jurisdiction: null });
  await bind(await entity(WRONG_CLASS), WRONG_CLASS, 'accepted', { type: 'representative' });
  await bind(await entity(WRONG_REF, 'active', '/firm/some-other-profile'), WRONG_REF, 'accepted');
  await bind(await entity(RETIRED, 'retired'), RETIRED, 'accepted');
  await bind(await entity(WRONG_JURISDICTION), WRONG_JURISDICTION, 'accepted', { jurisdiction: 'CA' }); // a state observation is not the US firm identity
  await bind(await entity(WRONG_CRD), WRONG_CRD, 'accepted', { crd: '7770099' }); // native id and CRD disagree

  // Session authority and the verified parent.
  const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 110;
  await db.query('insert into auth.users values($1),($2)', [A, B]);
  await store.bind(A, sidA, exp, sessionMac(ask.privateKey.pem, A, sidA, exp, PRODUCTION));
  await store.bind(B, sidB, exp, sessionMac(ask.privateKey.pem, B, sidB, exp, PRODUCTION));

  // Investor source channel fixture: Investor's own verdict per identity. It
  // verifies Ask's signature exactly as the Investor route does.
  const published = new Map([...CANARIES, UNBOUND, REVIEW, AMBIGUOUS, WRONG_CLASS, WRONG_REF, RETIRED, WRONG_JURISDICTION, WRONG_CRD].map(f => [f.profile.nativeId, f.slug]));
  /** How Investor's publication re-proof misbehaves, when it does. */
  let publicationFault = null;
  const acknowledged = []; const investorCalls = [];
  const seenNonces = new Set();
  const investorFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    const scope = body.action === 'acknowledge' ? 'source:ack' : 'source:read';
    const claims = await verifyInvestorAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', scope,
      { claim: async k => !seenNonces.has(k) && !!seenNonces.add(k) });
    investorCalls.push(body.action);
    if (body.action === 'resolve' && publicationFault) {
      if (publicationFault === 'network') throw new TypeError('fetch failed');
      if (publicationFault === 'http500') return new Response('upstream error', { status: 500 });
      if (publicationFault === 'not_json') return new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (publicationFault === 'refused') return Response.json({ ok: false, error: 'unauthorized' }, { status: 403 });
      const good = { identity: body.profile, canonicalSlug: published.get(body.profile.nativeId), publicationState: 'PUBLISHABLE', reviewedClass: 'official_firm', checkedAt: Date.now() };
      const bad = { stale: { checkedAt: Date.now() - 60_000 }, future: { checkedAt: Date.now() + 60_000 }, not_publishable: { publicationState: 'INGESTED' },
        state_adviser: { reviewedClass: 'state_adviser_firm' }, other_identity: { identity: { ...body.profile, nativeId: 'crd-104571' } }, no_slug: { canonicalSlug: undefined } }[publicationFault];
      return Response.json({ ok: true, result: { ...good, ...bad } });
    }
    if (body.action === 'resolve') {
      const slug = body.profile?.hub === 'investor' && body.profile.profileClass === 'official_firm' ? published.get(body.profile.nativeId) : null;
      if (!slug) return Response.json({ ok: false, error: 'unavailable' }, { status: 503 });
      return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: slug, publicationState: 'PUBLISHABLE', reviewedClass: 'official_firm', checkedAt: Date.now() } });
    }
    if (body.action === 'source') return Response.json({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: body.manifest,
      manifestDigest: body.manifestDigest, browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser } });
    if (body.action === 'acknowledge') { acknowledged.push(body.receipts.map(r => r.parent.outcome).join()); return Response.json({ ok: true, result: { watchCreated: false } }); }
    throw Error('Unexpected source operation');
  };
  // Move and Lender source fixtures for the regression. Neither may be contacted on an Investor Save.
  const otherHubCalls = []; let moveSnapshot = null;
  const moveSource = new SourceChannel(ask.privateKey, undefined, async (_target, init) => {
    const body = JSON.parse(Buffer.from(init.body).toString()); otherHubCalls.push('move:' + body.action);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: HINDMAN.slug, publicationState: 'PUBLISHABLE', reviewedClass: 'mover', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: moveSnapshot });
    acknowledged.push('move:' + body.receipts.map(r => r.parent.outcome).join()); return Response.json({ ok: true });
  }, PRODUCTION_TARGET);
  const lenderFetch = async (_target, init) => {
    const body = JSON.parse(Buffer.from(init.body).toString()); otherHubCalls.push('lender:' + body.action);
    if (body.action === 'resolve') return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: FREEDOM.slug, publicationState: 'PUBLISHABLE', reviewedClass: 'marketplace_company', checkedAt: Date.now() } });
    if (body.action === 'source') return Response.json({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: body.manifest,
      manifestDigest: body.manifestDigest, browserProof: lenderBrowser, expiresAt: body.expiresAt, requestPrefix: lenderBrowser } });
    acknowledged.push('lender:' + body.receipts.map(r => r.parent.outcome).join()); return Response.json({ ok: true, result: { watchCreated: false } });
  };
  const lender = keys('lender-fixture'); let lenderBrowser = null;
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
  let investorConfigured = true;
  const runtime = () => {
    const assembly = new PreviewAssembly(ENV, pool, moveSource, move.publicKey, async () => parent, removeSaved);
    assembly.lenderKey = lender.publicKey; assembly.lenderSource = new LenderSourceChannel(ask.privateKey, lenderFetch, LENDER_PRODUCTION_PINS);
    if (investorConfigured) { assembly.investorKey = investor.publicKey; assembly.investorSource = new InvestorSourceChannel(ask.privateKey, investorFetch, INVESTOR_PRODUCTION_PINS); }
    return assembly;
  };
  const browser = randomRef();
  const investorSigned = (bytes, key = investor.privateKey) => signInvestorAssertion(key, 'investor', ASK + API_PATH, 'transfer:stage', bytes, browser);
  const service = async (operation, input, sign = investorSigned) => {
    const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input }));
    const request = new Request(ASK + API_PATH, { method: 'POST', body: bytes, headers: { 'content-type': 'application/json', [ASSERTION_HEADER]: sign(bytes) } });
    const response = await handleProfileSave(request, { enabled: true, runtimeForRequest: r => runtime().serviceRuntime(r) });
    return { status: response.status, body: await response.json() };
  };
  const manifestFor = f => ({ version: 'v2-3/selected-profiles/3', sourceHub: 'investor', audience: 'ask',
    selected: [{ localItemId: f.slug, revision: '1', digest: 'a'.repeat(64), profile: f.profile }],
    returnTask: { kind: 'profile', hub: 'investor', profile: f.profile, canonicalSlug: f.slug, returnPath: '/firm/' + f.slug } });
  const saves = async (subject = A) => (await db.query(`select e.canonical_name,s.source_hub,s.identity_resolution_state,s.removed_at is null as active
    from consumer.consumer_saved_entities s join network.network_entities e on e.id=s.network_entity_id where s.user_id=$1 order by e.canonical_name`, [subject])).rows;
  const active = async (subject = A) => (await saves(subject)).filter(r => r.active).map(r => r.canonical_name);
  /** The whole one-click chain for one firm: Investor-signed stage, continuation,
   * top-level arrival from the Investor origin with an intent, then the follow-up GET. */
  async function click(f, intent, from = INVESTOR) {
    const manifest = manifestFor(f);
    const stage = await service('prepareGuestProfileTransfer', manifest);
    if (stage.status !== 200) return { stage: stage.status };
    const continuation = await service('prepareProfileSaveContinuation', { sourceHub: 'investor', audience: 'ask', transferRef: stage.body.result.transferRef, manifestDigest: stage.body.result.manifestDigest });
    assert.equal(continuation.status, 200, JSON.stringify(continuation.body));
    const arrival = new Request(ASK + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: continuation.body.result.continuationRef, intent }), headers: { origin: from } });
    const arrived = await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival));
    if (arrived.status !== 303) return { stage: 200, arrival: arrived.status };
    const get = new Request(ASK + '/my/profile-save', { headers: { cookie: arrived.headers.get('set-cookie').split(';')[0] } });
    const done = await handleProfileConfirmation(get, await runtime().browserBindings(get));
    if (done.status !== 303) return { stage: 200, arrival: 303, status: done.status, page: await done.text() };
    return { stage: 200, arrival: 303, status: done.status, location: done.headers.get('location') };
  }
  const returned = f => ({ stage: 200, arrival: 303, status: 303, location: INVESTOR + '/firm/' + f.slug });
  const quiet = () => db.exec('delete from ops.consumer_rate_limit_events; delete from ops.v23_profile_runtime_quota');

  // Save: each canary saves once, attributed to Investor, and returns to its canonical profile.
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  for (const f of CANARIES) assert.deepEqual(await click(f, 'save'), returned(f), f.slug);
  assert.deepEqual(await saves(), [METWEST, WEINBERGER, WESTERN].map(f => ({ canonical_name: f.legalName, source_hub: 'investor', identity_resolution_state: 'accepted', active: true })));
  assert.deepEqual(acknowledged, ['saved', 'saved', 'saved']);
  console.log('PASS Save: three official firms resolve by exact CRD, save once each, attributed to Investor, return to /firm/sec-crd-<CRD>');

  // Repeated Save never duplicates; Saves are per owner.
  for (const f of [WEINBERGER, WEINBERGER, METWEST]) assert.deepEqual(await click(f, 'save'), returned(f));
  assert.equal((await saves()).length, 3); assert.deepEqual(acknowledged.slice(3), ['already_saved', 'already_saved', 'already_saved']);
  parent = { subject: B, session: sidB, label: 'Fixture B' };
  assert.deepEqual(await click(WEINBERGER, 'save'), returned(WEINBERGER));
  assert.deepEqual(await active(B), [WEINBERGER.legalName]); assert.equal((await saves(A)).length, 3);
  console.log('PASS repeated Save: one row per firm per owner');

  // Unsave removes only the verified owner's row for that exact firm; re-Save restores it.
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  acknowledged.length = 0;
  assert.deepEqual(await click(WEINBERGER, 'unsave'), returned(WEINBERGER));
  assert.deepEqual(await active(A), [METWEST.legalName, WESTERN.legalName]); assert.deepEqual(await active(B), [WEINBERGER.legalName]);
  assert.deepEqual(acknowledged, ['local_only']);
  assert.deepEqual(await click(WEINBERGER, 'save'), returned(WEINBERGER));
  assert.equal((await saves(A)).length, 3); assert.equal((await active(A)).length, 3);
  console.log('PASS Unsave: only the owner\'s row for that firm is removed and acknowledged; re-Save restores the same row');

  // Denials: nothing is written and nothing is acknowledged.
  const snapshot = async () => JSON.stringify((await db.query('select id,network_entity_id,removed_at,row_version from consumer.consumer_saved_entities order by id')).rows);
  const before = await snapshot();
  const denied = async (f, label) => {
    await quiet(); acknowledged.length = 0;
    await click(f, 'save');
    assert.equal(await snapshot(), before, label + ' save'); assert.deepEqual(acknowledged, [], label + ' acknowledgement');
    await click(f, 'unsave');
    assert.equal(await snapshot(), before, label + ' unsave'); assert.deepEqual(acknowledged, [], label + ' unsave acknowledgement');
  };
  await denied(UNBOUND, 'missing binding');
  await denied(REVIEW, 'review_required binding');
  await denied(AMBIGUOUS, 'ambiguous binding');
  await denied(WRONG_CLASS, 'wrong binding class');
  await denied(WRONG_REF, 'binding on another profile ref');
  await denied(RETIRED, 'retired entity');
  await denied(WRONG_JURISDICTION, 'binding under a state jurisdiction');
  await denied(WRONG_CRD, 'binding whose CRD disagrees with the native id');
  // Publication re-proof failures: Investor down, erroring, answering garbage, or answering for something else.
  for (const fault of ['network', 'http500', 'not_json', 'refused', 'stale', 'future', 'not_publishable', 'state_adviser', 'other_identity', 'no_slug']) {
    publicationFault = fault;
    await denied(WESTERN, 'publication re-proof: ' + fault);
  }
  publicationFault = null;
  // A firm that stops being published at Investor is denied even with an accepted binding.
  published.delete(WESTERN.profile.nativeId);
  await denied(WESTERN, 'unpublished at Investor');
  // Investor answering with a different slug for the CRD is not accepted either.
  published.set(WESTERN.profile.nativeId, 'sec-crd-104571');
  await denied(WESTERN, 'Investor reports another canonical slug');
  published.set(WESTERN.profile.nativeId, WESTERN.slug);
  console.log('PASS denials: missing, review_required, ambiguous, wrong class, wrong jurisdiction, wrong CRD, other profile ref, retired entity, unpublished, slug disagreement and ten publication re-proof failures write nothing');

  // Tampered or foreign stages never get past the signed service boundary.
  await quiet();
  const good = manifestFor(WEINBERGER);
  const stageStatus = async (input, sign) => (await service('prepareGuestProfileTransfer', input, sign)).status;
  assert.equal(await stageStatus(good), 200);
  for (const [label, input] of [
    ['slug of another firm', { ...good, returnTask: { ...good.returnTask, canonicalSlug: METWEST.slug, returnPath: '/firm/' + METWEST.slug }, selected: [{ ...good.selected[0], localItemId: METWEST.slug }] }],
    ['return path of another firm', { ...good, returnTask: { ...good.returnTask, returnPath: '/firm/' + METWEST.slug } }],
    ['name-style slug', { ...good, returnTask: { ...good.returnTask, canonicalSlug: 'weinberger-asset-management', returnPath: '/firm/weinberger-asset-management' }, selected: [{ ...good.selected[0], localItemId: 'weinberger-asset-management' }] }],
    ['representative class', { ...good, returnTask: { ...good.returnTask, profile: { ...WEINBERGER.profile, profileClass: 'representative' } }, selected: [{ ...good.selected[0], profile: { ...WEINBERGER.profile, profileClass: 'representative' } }] }],
    ['uuid native id', { ...good, returnTask: { ...good.returnTask, profile: { ...WEINBERGER.profile, nativeId: receipt[0].network_entity_id } }, selected: [{ ...good.selected[0], profile: { ...WEINBERGER.profile, nativeId: receipt[0].network_entity_id } }] }],
    ['two selected items', { ...good, selected: [good.selected[0], { ...manifestFor(METWEST).selected[0] }] }],
    ['Move manifest under an Investor signature', { version: 'v2-3/selected-profiles/3', sourceHub: 'move', audience: 'ask',
      selected: [{ localItemId: 'x', revision: '1', digest: 'a'.repeat(64), profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' } }],
      returnTask: { kind: 'profile', hub: 'move', profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' }, canonicalSlug: 'x', returnPath: '/companies/x' } }],
  ]) assert.notEqual(await stageStatus(input), 200, label);
  // A valid Investor assertion is bound to its exact body, its lifetime and one use.
  assert.notEqual(await stageStatus(good, () => investorSigned(Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation: 'prepareGuestProfileTransfer', input: manifestFor(METWEST) })))), 200, 'assertion signed for another body');
  assert.notEqual(await stageStatus(good, bytes => signInvestorAssertion(investor.privateKey, 'investor', ASK + API_PATH, 'transfer:stage', bytes, browser, null, null, Date.now() - 40_000)), 200, 'expired assertion');
  assert.notEqual(await stageStatus(good, bytes => signInvestorAssertion(investor.privateKey, 'investor', ASK + API_PATH, 'receipt:verify', bytes, browser)), 200, 'wrong scope');
  assert.notEqual(await stageStatus(good, bytes => investorSigned(bytes).slice(0, -4) + 'AAAA'), 200, 'altered signature');
  assert.notEqual(await stageStatus(good, () => ''), 200, 'no assertion');
  let replayed = null;
  assert.equal(await stageStatus(good, bytes => (replayed = investorSigned(bytes))), 200);
  assert.notEqual(await stageStatus(good, () => replayed), 200, 'replayed assertion');
  // The same manifest under any other signature is refused: unknown Investor key, Move key, Lender-shaped token.
  assert.notEqual(await stageStatus(good, bytes => investorSigned(bytes, keys('investor-fixture').privateKey)), 200);
  assert.notEqual(await stageStatus(good, bytes => signAssertion(move.privateKey, 'move', ASK + API_PATH, 'transfer:stage', bytes, browser, null, null, Date.now(), PRODUCTION_TARGET)), 200);
  assert.notEqual(await stageStatus(good, bytes => signLenderAssertion(investor.privateKey, 'lender', ASK + API_PATH, 'transfer:stage', bytes, browser)), 200);
  // Without the Investor verify key installed, Ask refuses every Investor handoff.
  investorConfigured = false;
  assert.notEqual(await stageStatus(good), 200);
  investorConfigured = true;
  // An arrival that does not come from the Investor origin is refused.
  for (const from of ['https://www.lendertrusthub.com', 'https://www.movetrusthub.com', 'https://evil.example']) {
    await quiet(); acknowledged.length = 0;
    const result = await click(METWEST, 'unsave', from);
    assert.notEqual(result.status, 303, from); assert.deepEqual(acknowledged, [], from);
  }
  assert.equal(await snapshot(), before);
  console.log('PASS tamper: altered slug, return path, class, uuid identity, foreign manifest, foreign signature, missing verify key and foreign origin are all refused');

  // Signed out: the chain returns to the profile and saves nothing.
  await quiet(); parent = null; acknowledged.length = 0;
  assert.deepEqual(await click(METWEST, 'save'), returned(METWEST));
  assert.equal(await snapshot(), before); assert.deepEqual(acknowledged, []);
  // No Watch or Alert relation exists on this path, and Move was never contacted.
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema in ('consumer','ops','network','v23_private') and table_name ~* '(watch|alert)'")).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from v23_private.transaction_authority')).rows[0].n, 0);
  assert.deepEqual([...new Set(investorCalls)].sort(), ['acknowledge', 'resolve', 'source']);
  // Neither Move nor Lender was contacted on any Investor request, including the
  // Investor continuations that arrived from their origins above.
  assert.deepEqual(otherHubCalls, []);
  console.log('PASS signed-out Save changes nothing; zero Watch/Alert relations; no leaked transaction authority; Move never contacted');

  // Rollback: one receipt row per execution closes exactly that binding; the firm stops being eligible.
  const rollback = read('14-ask-prod-investor-crd-binding-rollback.sql');
  const target = receipt.find(r => r.crd === METWEST.crd);
  const setRow = (r, patch = {}) => db.query(`select set_config('v23investor.crd',$1,false),set_config('v23investor.binding_id',$2,false),
    set_config('v23investor.network_entity_id',$3,false),set_config('v23investor.canonical_public_profile_ref',$4,false)`,
    [patch.crd ?? r.crd, patch.binding_id ?? r.binding_id, patch.network_entity_id ?? r.network_entity_id, patch.ref ?? r.canonical_public_profile_ref]);
  const counts = await identityRows();
  await setRow(target, { binding_id: receipt.find(r => r.crd === WEINBERGER.crd).binding_id });
  await assert.rejects(db.exec(rollback), /closed 0/); await db.exec('rollback');
  await setRow(target, { crd: '105958' });
  await assert.rejects(db.exec(rollback), /must be the same canary/); await db.exec('rollback');
  await setRow(target);
  await db.exec(rollback);
  assert.equal(await identityRows(), counts); // nothing deleted
  assert.equal((await resolve(METWEST.profile.nativeId)).length, 0);
  assert.equal((await resolve(WEINBERGER.profile.nativeId)).length, 1);
  await assert.rejects(db.exec(rollback), /closed 0/); await db.exec('rollback');
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  const afterRollback = await snapshot();
  await quiet(); acknowledged.length = 0;
  await click(METWEST, 'save'); await click(METWEST, 'unsave');
  assert.equal(await snapshot(), afterRollback); assert.deepEqual(acknowledged, []);
  assert.equal((await active(A)).includes(METWEST.legalName), true); // Saved research is preserved
  console.log('PASS rollback: exactly one receipt binding closed, nothing deleted, firm no longer eligible, existing Saved research preserved, re-run refused');

  // ---- Regression: Move and Lender behave identically with and without the Investor key ----
  const moveSigned = (bytes, b) => signAssertion(move.privateKey, 'move', ASK + API_PATH, 'transfer:stage', bytes, b, null, null, Date.now(), PRODUCTION_TARGET);
  const lenderSigned = (bytes, b) => signLenderAssertion(lender.privateKey, 'lender', ASK + API_PATH, 'transfer:stage', bytes, b);
  async function otherClick(m, hub, origin, returnPath, intent, sign) {
    const b = randomRef(); if (hub === 'lender') lenderBrowser = b;
    const manifest = { version: 'v2-3/selected-profiles/3', sourceHub: hub, audience: 'ask', selected: [{ localItemId: m.slug, revision: hub === 'move' ? 'a'.repeat(64) : '1', digest: 'a'.repeat(64), profile: m.profile }],
      returnTask: { kind: 'profile', hub, profile: m.profile, canonicalSlug: m.slug, returnPath } };
    const stage = await service('prepareGuestProfileTransfer', manifest, bytes => sign(bytes, b));
    if (stage.status !== 200) return { stage: stage.status };
    const continuation = await service('prepareProfileSaveContinuation', { sourceHub: hub, audience: 'ask', transferRef: stage.body.result.transferRef, manifestDigest: stage.body.result.manifestDigest }, bytes => sign(bytes, b));
    if (hub === 'move') moveSnapshot = { ...continuation.body.result, transferRef: stage.body.result.transferRef, manifest, manifestDigest: stage.body.result.manifestDigest, browserProof: b, requestPrefix: randomRef() };
    const arrival = new Request(ASK + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: continuation.body.result.continuationRef, intent }), headers: { origin } });
    const arrived = await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival));
    const get = new Request(ASK + '/my/profile-save', { headers: { cookie: arrived.headers.get('set-cookie').split(';')[0] } });
    const done = await handleProfileConfirmation(get, await runtime().browserBindings(get));
    return { stage: 200, arrival: arrived.status, status: done.status, location: done.headers.get('location') };
  }
  parent = { subject: B, session: sidB, label: 'Fixture B' };
  const regression = {};
  for (const configured of [false, true]) {
    investorConfigured = configured;
    await quiet(); acknowledged.length = 0;
    const moveSave = await otherClick(HINDMAN, 'move', MOVE_ORIGIN, '/companies/' + HINDMAN.slug, 'save', moveSigned);
    const savedAfterSave = (await active(B)).includes(HINDMAN.legalName);
    const moveUnsave = await otherClick(HINDMAN, 'move', MOVE_ORIGIN, '/companies/' + HINDMAN.slug, 'unsave', moveSigned);
    const savedAfterUnsave = (await active(B)).includes(HINDMAN.legalName);
    const lenderSave = await otherClick(FREEDOM, 'lender', LENDER_ORIGIN, '/lenders/' + FREEDOM.slug, 'save', lenderSigned);
    regression[configured] = JSON.stringify({ moveSave, savedAfterSave, moveUnsave, savedAfterUnsave, lenderSave, acknowledged: [...acknowledged] });
  }
  assert.equal(regression[false], regression[true]);
  const withoutInvestor = JSON.parse(regression[false]);
  assert.deepEqual(withoutInvestor.moveSave, { stage: 200, arrival: 303, status: 303, location: MOVE_ORIGIN + '/companies/' + HINDMAN.slug });
  assert.deepEqual([withoutInvestor.savedAfterSave, withoutInvestor.savedAfterUnsave], [true, false]);
  assert.deepEqual(withoutInvestor.acknowledged.filter(a => a.startsWith('move:')), ['move:saved', 'move:local_only']);
  assert.equal(withoutInvestor.lenderSave.stage, 200); // the signed Lender stage is accepted exactly as before
  investorConfigured = true; parent = { subject: A, session: sidA, label: 'Fixture A' };
  console.log('PASS regression: Move Save and Unsave complete, and a Lender stage is accepted, identically with and without the Investor verify key');

  // Without the two database packets the Investor path fails closed, and Move's issuer is still there.
  const beforePackets = await snapshot();
  await db.exec(contextRollback);
  await quiet(); acknowledged.length = 0;
  // A Save needs an account context even for a firm that is already saved, so nothing is acknowledged.
  await click(WEINBERGER, 'save'); await click(WESTERN, 'save');
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), beforePackets);
  await db.exec(authorityRollback);
  await quiet();
  assert.notEqual((await service('prepareGuestProfileTransfer', manifestFor(WEINBERGER))).status, 200);
  assert.equal((await db.query(`select to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is not null as present`)).rows[0].present, true);
  console.log('PASS packet dependence: without the context issuer no Save is committed or acknowledged; without the authority packet the database refuses the Investor stage');
} finally { await db.close(); }
console.log('PASS Investor official-firm Save (Ask side, production target, embedded database)');
