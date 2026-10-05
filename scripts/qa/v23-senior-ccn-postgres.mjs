// Local embedded PostgreSQL ONLY. Builder C-B1; header corrected by C-B2.
// Proves the Ask side of the Senior CMS nursing-home Save on the PRODUCTION
// target shape: the real identity migrations, the real production packets
// 02/03/04/05/09/12, packet 17's preflight and three exact CMS CCN bindings +
// resolver, then the production assembly end to end: a Senior-signed stage, the
// top-level arrival, Save, repeated Save, Unsave, and every denial. Auth and the
// Senior source channel are explicit fixtures. Nothing here contacts a hosted
// database, Ask, or Senior.
//
// AUTHORITY: packet 19 (PR #236, certified head 3b56570) is the only authority on
// the Save path. Packet 17's own authority forward is SUPERSEDED BY PACKET 19; it
// is applied here only in a labelled historical comparison, to prove the packet 17
// preflight classifies its body as a legacy HOLD and packet 19 converges it.
// ACCOUNT CONTEXT: the real packets 15 and 18 from this tree. The harness first
// proves a Senior Save fails closed with no shared issuer and with packet 15
// alone, then applies packet 18 so prod_hub_issue_context admits senior at its
// pinned origin. There is no stand-in issuer.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PreviewAssembly } from '../../lib/my-trusthub/profile-save/preview-assembly.ts';
import { PreviewStore, randomRef } from '../../lib/my-trusthub/profile-save/preview-store.ts';
import { SourceChannel } from '../../lib/my-trusthub/profile-save/source-channel.ts';
import { SeniorSourceChannel } from '../../lib/my-trusthub/profile-save/senior-channel.ts';
import { SENIOR_PRODUCTION_PINS, signSeniorAssertion, verifySeniorAssertion } from '../../lib/my-trusthub/profile-save/senior-assertion.ts';
import { LENDER_PRODUCTION_PINS, signLenderAssertion } from '../../lib/my-trusthub/profile-save/lender-assertion.ts';
import { LenderSourceChannel } from '../../lib/my-trusthub/profile-save/lender-channel.ts';
import { handleProfileConfirmation } from '../../lib/my-trusthub/profile-save/browser.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { ASSERTION_HEADER, signAssertion } from '../../lib/my-trusthub/profile-save/service-assertion.ts';
import { API_PATH, PRODUCTION_TARGET } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
import { sessionMac } from '../../lib/my-trusthub/profile-save/session-authority.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';
import { classifySeniorRows } from '../../lib/my-trusthub/profile-save/senior-binding.ts';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const ASK = 'https://www.asktrusthub.com', SENIOR = 'https://www.seniortrusthub.com';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
// Packet 19 is owned by PR #236 and is not carried on this branch. It is read
// from the working tree once #236 is on main, otherwise from the certified #236
// commit with git show. Either way the bytes must be the certified ones.
const PACKET19_HEAD = '3b565707946b7c93252b767cf10aa185336ec8b1';
const PACKET19_SHA256 = {
  '19-ask-prod-network-authority-forward.sql': '30e1e557b169d3890b850d45c4fdc3c31d2b18bddc4f23c74e9ac33767c4c06c',
  '19-ask-prod-network-authority-preflight.sql': '8326b58efad23103c3b630e9c5c162a382534895fc54aeb8e1c80b6dc8f683db',
  '19-ask-prod-network-authority-rollback.sql': 'ed830ee1b294c9a2b2a77f05c2c55eb7636bbb8d063887c0fe6d41414551c242',
};
const packet19 = file => {
  let text;
  if (existsSync(prod + file)) text = read(file);
  else {
    try { text = execFileSync('git', ['show', `${PACKET19_HEAD}:${prod}${file}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n'); }
    catch { throw new Error(`packet 19 (${PACKET19_HEAD}) is not in this checkout; fetch PR #236 (git fetch origin mth-network-authority-19) to run this harness`); }
  }
  assert.equal(createHash('sha256').update(text).digest('hex'), PACKET19_SHA256[file], file + ' is not the certified packet 19 file');
  return text;
};
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ENV = {
  VERCEL_ENV: 'production', MY_TRUSTHUB_V23_PRODUCTION_HANDOFF_ENABLED: 'true',
  MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED: 'true', MY_TRUSTHUB_ENABLED: 'true', MY_TRUSTHUB_SAVED_ENABLED: 'true',
  MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED: 'true', NEXT_PUBLIC_SITE_URL: ASK,
  NEXT_PUBLIC_MY_TRUSTHUB_SUPABASE_URL: `https://${PRODUCTION}.supabase.co`,
  MY_TRUSTHUB_V23_PARENT_ORIGIN: ASK, MY_TRUSTHUB_V23_MOVE_ORIGIN: 'https://www.movetrusthub.com',
  MY_TRUSTHUB_V23_PRODUCTION_PROJECT: PRODUCTION, MY_TRUSTHUB_V23_SESSION_AFFINITY: 'dedicated',
};
const facility = (ccn, legalName, slug) => ({ ccn, legalName, slug, ref: '/facility/cms/' + ccn + '/' + slug, profile: { hub: 'senior', nativeId: ccn, profileClass: 'cms_facility' } });
const BURNS = facility('015009', 'BURNS NURSING HOME, INC.', 'burns-nursing-home-inc');
const SANJAC = facility('055223', 'SAN JACINTO VALLEY POST ACUTE', 'san-jacinto-valley-post-acute');
const ADDISON = facility('155805', 'ADDISON POINTE HEALTH & REHABILITATION CENTER', 'addison-pointe-health-and-rehabilitation-center');
const CANARIES = [BURNS, SANJAC, ADDISON];
const UNBOUND = facility('105001', 'FIXTURE UNBOUND NURSING HOME', 'fixture-unbound-nursing-home');
const REVIEW = facility('777001', 'FIXTURE REVIEW FACILITY', 'fixture-review-facility');
const AMBIGUOUS = facility('777002', 'FIXTURE AMBIGUOUS FACILITY', 'fixture-ambiguous-facility');
const WRONG_CLASS = facility('017000', 'FIXTURE HOME HEALTH AGENCY', 'fixture-home-health-agency');
const HOSPICE = facility('011500', 'FIXTURE HOSPICE', 'fixture-hospice');
const WRONG_REF = facility('777004', 'FIXTURE WRONG PROFILE REF', 'fixture-wrong-profile-ref');
const RETIRED = facility('777005', 'FIXTURE RETIRED ENTITY', 'fixture-retired-entity');
const WRONG_JURISDICTION = facility('777006', 'FIXTURE STATE JURISDICTION', 'fixture-state-jurisdiction');
const WRONG_CCN = facility('777007', 'FIXTURE OTHER CCN', 'fixture-other-ccn');
const WRONG_NAMESPACE = facility('777008', 'FIXTURE STATE LICENSE NAMESPACE', 'fixture-state-license-namespace');
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
  const forward = body(read('17-ask-prod-senior-ccn-binding-forward.sql')), rollback = body(read('17-ask-prod-senior-ccn-binding-rollback.sql')), preflight = body(read('17-ask-prod-senior-ccn-preflight.sql'));
  for (const text of ["select e.id, 'senior', 'cms_facility', c.ccn,", "'cms.ccn', c.ccn, 'US', 'accepted'", "('015009', 'BURNS NURSING HOME, INC.', '/facility/cms/015009/burns-nursing-home-inc')",
    "('055223', 'SAN JACINTO VALLEY POST ACUTE', '/facility/cms/055223/san-jacinto-valley-post-acute')",
    "('155805', 'ADDISON POINTE HEALTH & REHABILITATION CENTER', '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center')"]) assert.ok(forward.includes(text), text);
  assert.ok(!/\bdelete\s+from\b|\btruncate\b|\bon\s+conflict\b|\bupdate\s+network\./i.test(forward), 'forward is INSERT only');
  assert.ok(!/\bdelete\s+from\b|\btruncate\b|\bdrop\b|\binsert\s+into\b/i.test(rollback), 'rollback closes a validity window and nothing else');
  assert.ok(!/\b(insert|update|delete|create|alter|drop|grant)\b/i.test(preflight), 'preflight is read only');
  for (const text of [forward, rollback, preflight, body(read('17-ask-prod-senior-authority-forward.sql')), body(read('17-ask-prod-senior-authority-rollback.sql'))])
    assert.ok(!/issue_context|consume_context|create_consumer_auth_handoff/.test(text), 'packet 17 carries no account-context SQL');
  console.log('PASS packet 17 text: locked identity contract, INSERT-only forward, validity-only rollback, read-only preflight, no account-context SQL');
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
  const ask = keys('ask-fixture'), move = keys('move-fixture'), senior = keys('senior-fixture');
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  await db.exec(read('02-ask-prod-ports-forward.sql'));
  // Nothing of packet 17 is applied yet: results 1-5 are empty; result 6 is the one authority-state row.
  const preflightSets = async () => (await db.exec(read('17-ask-prod-senior-ccn-preflight.sql'))).map(r => r.rows.length);
  const readiness = async () => (await db.exec(read('17-ask-prod-senior-ccn-preflight.sql'))).at(-1).rows[0];
  assert.deepEqual(await preflightSets(), [0, 0, 0, 0, 0, 1]);
  assert.deepEqual(await readiness(), { authority_state: 'baseline', next_step: 'binding packet may proceed; authority step later = packet 19', resolver_installed: false });
  // The other hubs' own packets, unmodified, for the regression at the end.
  await db.exec(`set v23.binding_creation_authorized='true'; set v23bind.candidate_unchanged='true'; set v23bind.evidence_ref='local-sql-packet-fixture-only';
    select set_config('v23bind.preflight_checked_at',clock_timestamp()::text,false);`);
  await db.exec(read('03-ask-prod-move-binding-forward.sql')); await db.exec('reset role');
  await db.exec(`set v23.binding_creation_authorized=''`);
  await db.exec(read('04-ask-prod-runtime-role-forward.sql'));
  await db.exec(read('09-ask-prod-move-binding-resolver-forward.sql'));
  await db.exec(`set v23bind.nmls_consumer_access_checked='true'`);
  await db.exec(read('12-ask-prod-lender-nmls-binding-forward.sql'));
  assert.deepEqual(await preflightSets(), [0, 0, 0, 0, 0, 1]); // other hubs' identities never look like a Senior claim
  await db.query(`select set_config('v23.install_session_mac',$1,false)`, [createHash('sha256').update(ask.privateKey.pem).digest('hex')]);
  await db.exec(read('05-ask-prod-session-mac-install.sql'));
  // ---- AUTHORITY: classification by the packet 17 preflight, then packet 19 ----
  const p19 = { preflight: packet19('19-ask-prod-network-authority-preflight.sql'), forward: packet19('19-ask-prod-network-authority-forward.sql'), rollback: packet19('19-ask-prod-network-authority-rollback.sql') };
  const authorityBody = async () => (await db.query(`select prosrc,proowner::regrole::text as owner,proacl::text as acl,prosecdef from pg_proc where oid=to_regprocedure('v23_private.authority()')`)).rows.map(r => ({ ...r, prosrc: r.prosrc.replace(/\r\n/g, '\n') }))[0];
  const reviewed = await authorityBody();
  assert.ok(reviewed.prosrc.includes(`c->>'hub' in ('move','insurance','lender') and`));
  const setBody = text => db.query(`select 1 from (select set_config('v23.fixture_body',$1,true)) s`, [text]).then(() =>
    db.exec(`do $f$ begin execute format('create or replace function v23_private.authority() returns jsonb language plpgsql security invoker set search_path=pg_catalog,v23_private as %L', current_setting('v23.fixture_body')); end $f$`));
  const applyBody = async text => { await db.exec('begin'); await setBody(text); await db.exec('commit'); };
  const state = async () => (await readiness()).authority_state;
  const sub = (s, a, b) => { assert.ok(s.includes(a)); return s.split(a).join(b); };
  // S. baseline
  assert.equal(await state(), 'baseline');
  // The Senior hub is refused by the database at baseline.
  // U. HISTORICAL LOCAL COMPARISON ONLY: the superseded packet 17 authority forward. Its body reads as a legacy HOLD.
  const legacy17 = read('17-ask-prod-senior-authority-forward.sql');
  assert.ok(legacy17.startsWith('-- ====') && legacy17.includes('SUPERSEDED BY PACKET 19'));
  await db.exec(legacy17);
  assert.deepEqual(await readiness(), { authority_state: 'legacy_packet17_hold', next_step: 'HOLD: legacy packet 17 authority body; converge with packet 19', resolver_installed: false });
  // ... and packet 19 converges it.
  await db.exec(p19.preflight); await db.exec(p19.forward);
  const final = await authorityBody();
  assert.deepEqual([final.owner, final.acl, final.prosecdef], [reviewed.owner, reviewed.acl, reviewed.prosecdef]);
  assert.deepEqual(await readiness(), { authority_state: 'network_authority_final', next_step: 'network authority final (packet 19); no authority step', resolver_installed: false });
  await db.exec(p19.rollback);
  assert.equal(await state(), 'baseline');
  // V. unknown bodies HOLD, including ones that carry a bare 'senior' token.
  const finalSrc = final.prosrc;
  const unknowns = {
    'bare senior token in an otherwise changed list': sub(reviewed.prosrc, `('move','insurance','lender')`, `('move','insurance','lender','senior','everyone')`),
    'senior in list, a check removed': sub(sub(reviewed.prosrc, `('move','insurance','lender')`, `('move','insurance','lender','senior')`), `and c->>'service' = 'svc:trusthub:'||(c->>'hub')||':bff:v1'`, ''),
    'packet 19 body with the lower-case Senior pattern': sub(finalSrc, `'^[A-Z0-9]{6}$'`, `'^[A-Za-z0-9]{6}$'`),
    'packet 19 body with the cms_facility guard removed': finalSrc.split(`\n`).filter(l => !l.includes(`'cms_facility'`)).join(`\n`),
    'senior named only in a comment': `-- 'senior' cms_facility cms.ccn\n` + reviewed.prosrc,
    'trivial body': `begin return '{}'::jsonb; end`,
  };
  for (const [label, body] of Object.entries(unknowns)) {
    await applyBody(body);
    assert.deepEqual(await readiness(), { authority_state: 'unknown_hold', next_step: 'HOLD: unknown authority body; stop and review', resolver_installed: false }, label);
  }
  await applyBody(reviewed.prosrc); assert.equal(await state(), 'baseline');
  // T. the production authority step: packet 19 from baseline.
  await db.exec(p19.preflight); await db.exec(p19.forward);
  assert.equal(await state(), 'network_authority_final');
  // R (authority layer). The final authority refuses a lower-case native CCN for Senior.
  const authorityVerdict = async c => { await db.exec('begin'); try { await db.exec('set local role myth_v23_authorizer');
    await db.query(`insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)`, [JSON.stringify(c)]);
    await db.exec('set local role myth_v23_executor'); await db.query('select v23_private.authority()'); await db.exec('rollback'); return 'ok'; } catch (e) { await db.exec('rollback'); return e.message; } };
  const commitAuth = nativeId => ({ hub: 'senior', audience: 'ask', service: 'svc:trusthub:senior:bff:v1', browser: 'a'.repeat(64), subject: A, session: 'f'.repeat(64), scopes: ['saved:write'], operation: 'commitProfileSave',
    input: { item: { profile: { hub: 'senior', nativeId, profileClass: 'cms_facility' } } } });
  assert.equal(await authorityVerdict(commitAuth('015009')), 'ok');
  for (const bad of ['ab12cd', '05a123', ' 015009', 'cms.ccn:015009']) assert.equal(await authorityVerdict(commitAuth(bad)), 'invalid authority', bad);
  console.log('PASS authority states (S T U V): baseline reads baseline; the certified packet 19 body reads network_authority_final; a superseded packet 17 body (historical comparison only) reads legacy_packet17_hold and packet 19 converges it; six unknown bodies, including a bare senior token, a lower-case Senior pattern and a removed cms_facility guard, read unknown_hold; packet 19 refuses a lower-case Senior CCN');
  const moveIssuer = async () => JSON.stringify((await db.query(`select prosrc,proowner::regrole::text as owner,proacl::text as acl from pg_proc where oid=to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)')`)).rows[0]);
  const moveIssuerBefore = await moveIssuer();
  console.log('PASS production ports, runtime role and session authority packets apply on the embedded database');

  // Packet 17: preflight is clean, forward refuses without both guards, applies once, and returns the receipt.
  assert.deepEqual(await preflightSets(), [0, 0, 0, 0, 0, 1]);
  const forward = read('17-ask-prod-senior-ccn-binding-forward.sql');
  const identityRows = async () => JSON.stringify((await db.query(`select (select count(*)::int from network.network_entities) e,(select count(*)::int from network.network_entity_bindings) b`)).rows[0]);
  const empty = await identityRows();
  await assert.rejects(db.exec(forward), /Confirm each exact CMS CCN/); await db.exec('rollback');
  await db.exec(`set v23.approved_project=''; set v23bind.senior_ccn_checked='true'`);
  await assert.rejects(db.exec(forward), /Explicit production authorization required/); await db.exec('rollback');
  assert.equal(await identityRows(), empty);
  await db.exec(`set v23.approved_project='${PRODUCTION}'`);
  const receipt = (await db.exec(forward)).flatMap(r => r.rows || []).filter(r => r.binding_id);
  assert.equal(receipt.length, 3);
  assert.deepEqual(receipt.map(r => [r.ccn, r.canonical_public_profile_ref]), CANARIES.map(f => [f.ccn, f.ref]));
  assert.deepEqual((await db.query(`select e.entity_type,e.canonical_name,e.primary_hub,e.jurisdiction,e.canonical_public_profile_ref,e.status,b.hub,b.specialist_entity_type,
      b.specialist_entity_id,b.identifier_namespace,b.source_identifier,b.jurisdiction as binding_jurisdiction,b.binding_status,b.valid_to,b.provenance_ref
    from network.network_entity_bindings b join network.network_entities e on e.id=b.network_entity_id where b.hub='senior' order by b.source_identifier`)).rows,
    CANARIES.map(f => ({ entity_type: 'organization', canonical_name: f.legalName, primary_hub: 'senior', jurisdiction: 'US',
      canonical_public_profile_ref: f.ref, status: 'active', hub: 'senior', specialist_entity_type: 'cms_facility', specialist_entity_id: f.ccn,
      identifier_namespace: 'cms.ccn', source_identifier: f.ccn, binding_jurisdiction: 'US', binding_status: 'accepted', valid_to: null, provenance_ref: 'senior_trust_hub_cms_provider_information' })));
  const applied = await identityRows();
  await assert.rejects(db.exec(forward), /already applied|requires steward review/); await db.exec('rollback');
  assert.equal(await identityRows(), applied);
  assert.deepEqual(await preflightSets(), [3, 3, 0, 3, 0, 1]); // after apply the preflight reports every claim; no ambiguity, no review conflict
  assert.deepEqual(await readiness(), { authority_state: 'network_authority_final', next_step: 'network authority final (packet 19); no authority step', resolver_installed: true });
  console.log('PASS packet 17: clean preflight, guarded forward, exactly three CMS CCN bindings, receipt returned, re-run refused');

  // Resolver contract, as the runtime login's roles. One exact identity in; no name, slug or uuid lookup.
  const pool = { connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }) };
  const store = new PreviewStore(pool, PRODUCTION_TARGET);
  const resolve = id => store.authorized(async d => (await d.query('select * from v23_private.prod_senior_ccn_binding_for($1)', [id])).rows);
  for (const f of CANARIES) {
    const r = receipt.find(x => x.ccn === f.ccn);
    assert.deepEqual((await resolve(f.profile.nativeId)).map(x => [x.id, x.network_entity_id, x.binding_status, x.specialist_entity_type, x.specialist_entity_id, x.identifier_namespace, x.source_identifier, x.jurisdiction, x.entity_status, x.canonical_public_profile_ref]),
      [[r.binding_id, r.network_entity_id, 'accepted', 'cms_facility', f.ccn, 'cms.ccn', f.ccn, 'US', 'active', f.ref]]);
  }
  for (const bad of ['15009', '0150090', '%', '015009 ', '01500*', ' QR90ST', 'QR-90S', 'QR90ST!', 'ＱＲ９０ＳＴ', "0' or '1", 'cms.ccn:015009', 'burns-nursing-home-inc', '01500g', BURNS.legalName, receipt[0].binding_id, receipt[0].network_entity_id, '105001', 'nmls:2767', ''])
    assert.equal((await resolve(bad)).length, 0, bad);
  for (const role of ['myth_v23_authorizer', 'myth_v23_executor']) for (const table of ['network.network_entity_bindings', 'network.network_entities']) {
    await db.exec(`begin; set local role ${role}`);
    await assert.rejects(db.query(`select 1 from ${table} limit 1`)); await db.exec('rollback');
  }
  console.log('PASS resolver: exact CMS CCN only, Senior hub only, at most three rows, no direct table access for runtime roles');

  // Fixture identities for the denials (steward-style rows, never created by packet 17).
  const entity = async (f, status = 'active', ref = f.ref) => (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
    values('organization',$1,'senior','US',$2,$3) returning id`, [f.legalName, ref, status])).rows[0].id;
  const bind = (entityId, f, status, patch = {}) => db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref) values($1,'senior',$2,$3,$4,$5,$6,$7,now()-interval '1 minute','fixture-only')`,
    [entityId, patch.type ?? 'cms_facility', patch.nativeId ?? f.profile.nativeId, patch.namespace ?? 'cms.ccn', patch.ccn ?? f.ccn, 'jurisdiction' in patch ? patch.jurisdiction : 'US', status]);
  await bind(await entity(REVIEW), REVIEW, 'review_required');
  await bind(await entity(AMBIGUOUS), AMBIGUOUS, 'accepted');
  await bind(await entity({ ...AMBIGUOUS, legalName: AMBIGUOUS.legalName + ' (second claim)' }, 'active', '/facility/cms/777002/second-claim'), AMBIGUOUS, 'accepted', { nativeId: 'fixture-other-id', jurisdiction: null });
  await bind(await entity(WRONG_CLASS, 'active', '/home-health/cms/017000/' + WRONG_CLASS.slug), WRONG_CLASS, 'accepted', { type: 'home_health' }); // a home health agency carries a CCN too
  await bind(await entity(HOSPICE, 'active', '/hospice/cms/011500/' + HOSPICE.slug), HOSPICE, 'accepted', { type: 'hospice' });
  await bind(await entity(WRONG_REF, 'active', '/facility/cms/777099/some-other-profile'), WRONG_REF, 'accepted');
  await bind(await entity(RETIRED, 'retired'), RETIRED, 'accepted');
  await bind(await entity(WRONG_JURISDICTION), WRONG_JURISDICTION, 'accepted', { jurisdiction: 'FL' }); // a state observation is not the federal CMS identity
  await bind(await entity(WRONG_CCN), WRONG_CCN, 'accepted', { ccn: '777099' }); // native id and CCN disagree
  await bind(await entity(WRONG_NAMESPACE), WRONG_NAMESPACE, 'accepted', { namespace: 'fl.ahca.license' }); // a state-license namespace under the same digits
  // C-B2: two current accepted cms.ccn claims for one logical CCN, differing only by case,
  // under two jurisdiction keys so the accepted-binding exclusion allows both rows.
  const ALPHA = facility('AB12CD', 'ALPHA CASE NURSING HOME', 'alpha-case-nursing-home');
  const EXACT_ALPHA = facility('CD34EF', 'EXACT ALPHA NURSING HOME', 'exact-alpha-nursing-home');
  await bind(await entity(ALPHA), ALPHA, 'accepted');
  await bind(await entity({ ...ALPHA, legalName: 'ALPHA CASE NURSING HOME LOWER' }, 'active', '/facility/cms/AB12CD/alpha-case-lower-claim'), ALPHA, 'accepted', { nativeId: 'ab12cd', ccn: 'ab12cd', jurisdiction: 'AL' });
  await bind(await entity(EXACT_ALPHA), EXACT_ALPHA, 'accepted');
  const caseRows = async (id) => await resolve(id);
  const upperCaseRows = await caseRows('AB12CD');
  const lowerCaseRows = await caseRows('ab12cd');
  assert.equal(upperCaseRows.length, 2, 'uppercase lookup must see both case variants');
  assert.equal(lowerCaseRows.length, 2, 'lowercase lookup must see both case variants');
  assert.equal(classifySeniorRows('AB12CD', upperCaseRows).outcome, 'denied');
  assert.equal(classifySeniorRows('AB12CD', upperCaseRows).reason, 'ambiguous');
  assert.equal(classifySeniorRows('ab12cd', lowerCaseRows).reason, 'ambiguous');
  const exactAlphaUpper = await caseRows('CD34EF');
  const exactAlphaLower = await caseRows('cd34ef');
  assert.equal(exactAlphaUpper.length, 1);
  assert.equal(exactAlphaLower.length, 1);
  assert.equal(exactAlphaUpper[0].id, exactAlphaLower[0].id);
  assert.equal(classifySeniorRows('CD34EF', exactAlphaUpper).outcome, 'eligible');
  assert.equal(classifySeniorRows('cd34ef', exactAlphaLower).outcome, 'eligible');
  console.log('PASS case normalization: one alphanumeric CCN resolves from either case; upper/lower accepted claims are ambiguous');

  // Preflight must report the same logical CCN the resolver would collide on.
  // A second current claim stored with padding is invisible to a raw equality
  // check and visible once both sides use lower(btrim(...)). The window is
  // then closed, the same way packet 17 rollback closes a binding.
  const paddedEntity = (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
    values('organization','BURNS NURSING HOME PADDED','senior','US','/facility/cms/015009/burns-nursing-home-padded','active') returning id`)).rows[0].id;
  const paddedBinding = (await db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref)
    values($1,'senior','cms_facility',' 015009','cms.ccn',' 015009','AL','accepted',now()-interval '1 minute','fixture-only') returning id`, [paddedEntity])).rows[0].id;
  const dirtyPreflight = await preflightSets();
  const ambiguity = (await db.exec(read('17-ask-prod-senior-ccn-preflight.sql')))[2].rows;
  assert.ok(dirtyPreflight[2] >= 1, 'preflight result 3 must see the padded logical duplicate');
  assert.ok(ambiguity.some(r => r.owner_key === '015009' && Number(r.rows) > 1), JSON.stringify(ambiguity));
  assert.equal((await resolve('015009')).length, 2, 'resolver and preflight agree that the padded claim collides');
  const closed = await db.query(`update network.network_entity_bindings set valid_to = clock_timestamp() where id = $1 and valid_to is null returning id`, [paddedBinding]);
  assert.equal(closed.rows.length, 1);
  assert.deepEqual(await preflightSets(), [3, 3, 0, 3, 0, 1]);
  assert.equal((await resolve('015009')).length, 1);
  console.log('PASS preflight: a padded claim of a canary CCN is the same logical identity the resolver collides on');

  // Other-namespace specialist id padded with spaces. Preflight folds it with
  // lower(btrim). The reader policy must expose that same row to the resolver.
  const crossEntity = (await db.query(`insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
    values('organization','BURNS CROSS NAMESPACE','senior','US','/facility/cms/015009/cross-namespace-padded','active') returning id`)).rows[0].id;
  const crossBinding = (await db.query(`insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref)
    values($1,'senior','cms_facility',' 015009 ','fl.ahca.license','XXXXXX','US','accepted',now()-interval '1 minute','fixture-cross-namespace') returning id`, [crossEntity])).rows[0].id;
  const crossAmbiguity = (await db.exec(read('17-ask-prod-senior-ccn-preflight.sql')))[2].rows;
  const policyGap = {
    crossFlagged: crossAmbiguity.some(r => r.owner_key === '015009' && Number(r.rows) > 1),
    crossResolver: (await resolve('015009')).length,
  };
  await db.query(`update network.network_entity_bindings set valid_to = clock_timestamp() where id = $1 and valid_to is null`, [crossBinding]);
  assert.deepEqual(await preflightSets(), [3, 3, 0, 3, 0, 1]);
  assert.equal((await resolve('015009')).length, 1);

  const QR = facility('QR90ST', 'QR POLICY NURSING HOME', 'qr-policy-nursing-home');
  const PAD = facility('ZX81CV', 'PADDED CMS NURSING HOME', 'padded-cms-nursing-home');
  const SRC = facility('YW70BU', 'PADDED SOURCE NURSING HOME', 'padded-source-nursing-home');
  const XJ = facility('VT63AS', 'CROSS JURISDICTION NURSING HOME', 'cross-jurisdiction-nursing-home');
  const WC = facility('HK52RD', 'WRONG CLASS DUPLICATE NURSING HOME', 'wrong-class-duplicate-nursing-home');
  const RR = facility('JP41QE', 'REVIEW DUPLICATE NURSING HOME', 'review-duplicate-nursing-home');
  const MANY = facility('LM45NO', 'MANY CLAIMS NURSING HOME', 'many-claims-nursing-home');
  const extra = async (f, patch, slug) => bind(await entity({ ...f, legalName: f.legalName + ' ' + slug }, 'active', '/facility/cms/' + f.ccn + '/' + slug), f, patch.status ?? 'accepted', patch);
  await bind(await entity(QR), QR, 'accepted');
  await extra(QR, { nativeId: ' QR90ST ', namespace: 'fl.ahca.license', ccn: 'QR90ST' }, 'qr-other-namespace');
  await bind(await entity(PAD), PAD, 'accepted');
  await extra(PAD, { nativeId: ' ZX81CV ', ccn: 'ZX81CV', jurisdiction: 'AL' }, 'padded-specialist');
  await bind(await entity(SRC), SRC, 'accepted');
  await extra(SRC, { nativeId: 'YW70BUX', ccn: ' YW70BU ', jurisdiction: 'NJ' }, 'padded-source');
  await bind(await entity(XJ), XJ, 'accepted');
  await extra(XJ, { nativeId: 'fixture-vt63as', ccn: 'VT63AS', jurisdiction: 'NJ' }, 'other-jurisdiction');
  await bind(await entity(WC), WC, 'accepted');
  await extra(WC, { nativeId: 'fixture-hk52rd', type: 'home_health', ccn: 'HK52RD', jurisdiction: 'AL' }, 'other-class');
  await bind(await entity(RR), RR, 'accepted');
  await extra(RR, { status: 'review_required' }, 'review-required-claim');
  await bind(await entity(MANY), MANY, 'accepted');
  await extra(MANY, { nativeId: 'lm45no', ccn: 'LM45NO', jurisdiction: 'NJ' }, 'second-claim');
  await extra(MANY, { nativeId: ' LM45NO ', namespace: 'fl.ahca.license', ccn: 'LM45NO', jurisdiction: 'AL' }, 'third-claim');

  // Session authority and the verified parent.
  const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', exp = Math.floor(Date.now() / 1000) + 110;
  await db.query('insert into auth.users values($1),($2)', [A, B]);
  await store.bind(A, sidA, exp, sessionMac(ask.privateKey.pem, A, sidA, exp, PRODUCTION));
  await store.bind(B, sidB, exp, sessionMac(ask.privateKey.pem, B, sidB, exp, PRODUCTION));

  // Senior source channel fixture: Senior's own verdict per identity. It
  // verifies Ask's signature exactly as the Senior route does.
  const published = new Map([...CANARIES, UNBOUND, REVIEW, AMBIGUOUS, ALPHA, EXACT_ALPHA, QR, PAD, SRC, XJ, WC, RR, MANY, WRONG_CLASS, HOSPICE, WRONG_REF, RETIRED, WRONG_JURISDICTION, WRONG_CCN, WRONG_NAMESPACE].map(f => [f.profile.nativeId, f.slug]));
  /** How Senior's publication re-proof misbehaves, when it does. */
  let publicationFault = null;
  const acknowledged = []; const seniorCalls = []; const ackEvidence = [];
  const seenNonces = new Set();
  const seniorFetch = async (target, init) => {
    const bytes = Buffer.from(init.body), body = JSON.parse(bytes.toString());
    const scope = body.action === 'acknowledge' ? 'source:ack' : 'source:read';
    const claims = await verifySeniorAssertion(new Request(target, { method: 'POST', headers: init.headers, body: bytes }), bytes, ask.publicKey, 'ask', scope,
      { claim: async k => !seenNonces.has(k) && !!seenNonces.add(k) });
    seniorCalls.push(body.action); assert.equal(target, SENIOR + '/api/my-trusthub/profile-save/source');
    if (body.action === 'resolve' && publicationFault) {
      if (publicationFault === 'network') throw new TypeError('fetch failed');
      if (publicationFault === 'http500') return new Response('upstream error', { status: 500 });
      if (publicationFault === 'not_json') return new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (publicationFault === 'refused') return Response.json({ ok: false, error: 'unauthorized' }, { status: 403 });
      const good = { identity: body.profile, canonicalSlug: published.get(body.profile.nativeId), publicationState: 'PUBLISHABLE', reviewedClass: 'cms_facility', checkedAt: Date.now() };
      const bad = { stale: { checkedAt: Date.now() - 60_000 }, future: { checkedAt: Date.now() + 60_000 }, not_publishable: { publicationState: 'HELD' },
        home_health: { reviewedClass: 'home_health' }, hospice: { identity: { ...body.profile, profileClass: 'hospice' } }, other_identity: { identity: { ...body.profile, nativeId: '055223' } }, no_slug: { canonicalSlug: undefined } }[publicationFault];
      return Response.json({ ok: true, result: { ...good, ...bad } });
    }
    if (body.action === 'resolve') {
      const slug = body.profile?.hub === 'senior' && body.profile.profileClass === 'cms_facility' ? published.get(body.profile.nativeId) : null;
      if (!slug) return Response.json({ ok: false, error: 'unavailable' }, { status: 503 });
      return Response.json({ ok: true, result: { identity: body.profile, canonicalSlug: slug, publicationState: 'PUBLISHABLE', reviewedClass: 'cms_facility', checkedAt: Date.now() } });
    }
    if (body.action === 'source') return Response.json({ ok: true, result: { continuationRef: body.continuationRef, transferRef: body.transferRef, manifest: body.manifest,
      manifestDigest: body.manifestDigest, browserProof: claims.browser, expiresAt: body.expiresAt, requestPrefix: claims.browser } });
    if (body.action === 'acknowledge') {
      const r0 = body.receipts[0];
      const rows = (await db.query(`select s.removed_at is null as active from consumer.consumer_saved_entities s join network.network_entity_bindings b on b.network_entity_id=s.network_entity_id
        where b.hub='senior' and b.specialist_entity_id=$1 and s.user_id=$2`, [r0.item.profile.nativeId, parent?.subject ?? A])).rows;
      ackEvidence.push({ outcome: r0.parent.outcome, ccn: r0.item.profile.nativeId, activeAtAck: rows.filter(x => x.active).length });
      acknowledged.push(body.receipts.map(r => r.parent.outcome).join()); return Response.json({ ok: true, result: { watchCreated: false } });
    }
    throw Error('Unexpected source operation');
  };
  // Move and Lender source fixtures for the regression. Neither may be contacted on a Senior Save.
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
  let seniorConfigured = true;
  const runtime = () => {
    const assembly = new PreviewAssembly(ENV, pool, moveSource, move.publicKey, async () => parent, removeSaved);
    assembly.lenderKey = lender.publicKey; assembly.lenderSource = new LenderSourceChannel(ask.privateKey, lenderFetch, LENDER_PRODUCTION_PINS);
    if (seniorConfigured) { assembly.seniorKey = senior.publicKey; assembly.seniorSource = new SeniorSourceChannel(ask.privateKey, seniorFetch, SENIOR_PRODUCTION_PINS); }
    return assembly;
  };
  const browser = randomRef();
  const seniorSigned = (bytes, key = senior.privateKey) => signSeniorAssertion(key, 'senior', ASK + API_PATH, 'transfer:stage', bytes, browser);
  const service = async (operation, input, sign = seniorSigned) => {
    const bytes = Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input }));
    const request = new Request(ASK + API_PATH, { method: 'POST', body: bytes, headers: { 'content-type': 'application/json', [ASSERTION_HEADER]: sign(bytes) } });
    const response = await handleProfileSave(request, { enabled: true, runtimeForRequest: r => runtime().serviceRuntime(r) });
    return { status: response.status, body: await response.json() };
  };
  const manifestFor = f => ({ version: 'v2-3/selected-profiles/3', sourceHub: 'senior', audience: 'ask',
    selected: [{ localItemId: f.ccn, revision: '1', digest: 'a'.repeat(64), profile: f.profile }],
    returnTask: { kind: 'profile', hub: 'senior', profile: f.profile, canonicalSlug: f.slug, returnPath: f.ref } });
  const saves = async (subject = A) => (await db.query(`select e.canonical_name,s.source_hub,s.identity_resolution_state,s.removed_at is null as active
    from consumer.consumer_saved_entities s join network.network_entities e on e.id=s.network_entity_id where s.user_id=$1 order by e.canonical_name`, [subject])).rows;
  const active = async (subject = A) => (await saves(subject)).filter(r => r.active).map(r => r.canonical_name);
  /** The whole one-click chain for one facility: Senior-signed stage, continuation,
   * top-level arrival from the Senior origin with an intent, then the follow-up GET. */
  async function click(f, intent, from = SENIOR) {
    const manifest = manifestFor(f);
    const stage = await service('prepareGuestProfileTransfer', manifest);
    if (stage.status !== 200) return { stage: stage.status };
    const continuation = await service('prepareProfileSaveContinuation', { sourceHub: 'senior', audience: 'ask', transferRef: stage.body.result.transferRef, manifestDigest: stage.body.result.manifestDigest });
    assert.equal(continuation.status, 200, JSON.stringify(continuation.body));
    const arrival = new Request(ASK + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: continuation.body.result.continuationRef, intent }), headers: { origin: from } });
    const arrived = await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival));
    if (arrived.status !== 303) return { stage: 200, arrival: arrived.status };
    const get = new Request(ASK + '/my/profile-save', { headers: { cookie: arrived.headers.get('set-cookie').split(';')[0] } });
    const done = await handleProfileConfirmation(get, await runtime().browserBindings(get));
    if (done.status !== 303) return { stage: 200, arrival: 303, status: done.status, page: await done.text() };
    return { stage: 200, arrival: 303, status: done.status, location: done.headers.get('location') };
  }
  const returned = f => ({ stage: 200, arrival: 303, status: 303, location: SENIOR + f.ref });
  const quiet = () => db.exec('delete from ops.consumer_rate_limit_events; delete from ops.v23_profile_runtime_quota');

  // ---- SHARED ACCOUNT CONTEXT (real packets from this tree) ----
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  // No shared issuer yet: the stage is admitted, the commit cannot obtain a context, nothing is saved or acknowledged.
  assert.equal((await db.query(`select to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is null as absent`)).rows[0].absent, true);
  for (const f of CANARIES) assert.deepEqual(await click(f, 'save'), returned(f), f.slug);
  assert.deepEqual(await saves(), []); assert.deepEqual(acknowledged, []);
  assert.equal(await moveIssuer(), moveIssuerBefore);
  assert.equal((await db.query(`select count(*)::int n from ops.consumer_auth_handoffs`)).rows[0].n, 0, 'no Move or other context was issued for a Senior caller');
  // Packet 15 only: the shared issuer refuses hub senior; still nothing.
  await db.exec(read('15-ask-prod-hub-account-context-forward.sql'));
  await quiet();
  for (const f of CANARIES) assert.deepEqual(await click(f, 'save'), returned(f), f.slug);
  assert.deepEqual(await saves(), []); assert.deepEqual(acknowledged, []);
  console.log('PASS without packet 18 (no issuer, then packet 15 alone) a Senior Save stages, returns to the profile, saves nothing and acknowledges nothing; no Move context is ever issued');
  // Packet 18: senior joins the shared issuer with its pinned origin.
  await db.exec(read('18-ask-prod-senior-hub-context-preflight.sql'));
  await db.exec(read('18-ask-prod-senior-hub-context-forward.sql'));
  await quiet();

  // Save: each canary saves once, attributed to Senior, and returns to its canonical profile.
  for (const f of CANARIES) assert.deepEqual(await click(f, 'save'), returned(f), f.slug);
  assert.deepEqual(await saves(), [ADDISON, BURNS, SANJAC].map(f => ({ canonical_name: f.legalName, source_hub: 'senior', identity_resolution_state: 'accepted', active: true })));
  assert.deepEqual(acknowledged, ['saved', 'saved', 'saved']);
  assert.deepEqual(ackEvidence.map(e => [e.ccn, e.outcome, e.activeAtAck]), CANARIES.map(f => [f.ccn, 'saved', 1]), 'each acknowledgement arrived after its Saved row was committed');
  assert.deepEqual((await db.query(`select issuer_hub, initiating_origin, count(*)::int n from ops.consumer_auth_handoffs group by 1,2 order by 1`)).rows,
    [{ issuer_hub: 'senior', initiating_origin: 'https://www.seniortrusthub.com', n: 3 }]);
  console.log('PASS shared Senior context: every context was issued by prod_hub_issue_context as hub senior at the pinned origin https://www.seniortrusthub.com; no Move or Senior-specific issuer was used');
  console.log('PASS Save: three CMS nursing homes resolve by exact CCN, save once each, attributed to Senior, return to /facility/cms/<CCN>/<slug>, acknowledged only after the commit');

  // Repeated Save never duplicates; Saves are per owner.
  for (const f of [BURNS, BURNS, SANJAC]) assert.deepEqual(await click(f, 'save'), returned(f));
  assert.equal((await saves()).length, 3); assert.deepEqual(acknowledged.slice(3), ['already_saved', 'already_saved', 'already_saved']);
  parent = { subject: B, session: sidB, label: 'Fixture B' };
  assert.deepEqual(await click(BURNS, 'save'), returned(BURNS));
  assert.deepEqual(await active(B), [BURNS.legalName]); assert.equal((await saves(A)).length, 3);
  console.log('PASS repeated Save: one row per facility per owner');

  // Unsave removes only the verified owner's row for that exact facility; re-Save restores it.
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  acknowledged.length = 0;
  assert.deepEqual(await click(BURNS, 'unsave'), returned(BURNS));
  assert.deepEqual(await active(A), [ADDISON.legalName, SANJAC.legalName]); assert.deepEqual(await active(B), [BURNS.legalName]);
  assert.deepEqual(acknowledged, ['local_only']);
  assert.equal(ackEvidence.at(-1).activeAtAck, 0, 'the Unsave was acknowledged only after the row was removed');
  assert.deepEqual(await click(BURNS, 'save'), returned(BURNS));
  assert.equal((await saves(A)).length, 3); assert.equal((await active(A)).length, 3);
  console.log('PASS Unsave: only the owner\'s row for that facility is removed and acknowledged; re-Save restores the same row');

  await quiet(); acknowledged.length = 0;
  assert.deepEqual(await click(EXACT_ALPHA, 'save'), returned(EXACT_ALPHA));
  assert.deepEqual(acknowledged, ['saved']);
  const lowerAlpha = { ...EXACT_ALPHA, profile: { ...EXACT_ALPHA.profile, nativeId: 'cd34ef' } };
  const lowerLookup = await resolve('cd34ef');
  assert.equal(lowerLookup.length, 1);
  assert.equal(classifySeniorRows('cd34ef', lowerLookup).outcome, 'eligible');
  await quiet(); acknowledged.length = 0;
  const lowerStage = await click(lowerAlpha, 'save');
  assert.notEqual(lowerStage.stage, 200, JSON.stringify(lowerStage));
  assert.deepEqual(acknowledged, []);
  await quiet(); acknowledged.length = 0;
  assert.deepEqual(await click(EXACT_ALPHA, 'unsave'), returned(EXACT_ALPHA));
  console.log('PASS alphanumeric CCN saves from the uppercase wire; a lowercase lookup resolves and does not stage');

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
  const qrRows = await resolve('QR90ST');
  await quiet(); acknowledged.length = 0;
  const qrSave = await click(QR, 'save');
  const evidence = {
    policyGap, qrRows: qrRows.length, manyRows: (await resolve('LM45NO')).length,
    save: qrSave, ack: acknowledged.slice(), snapshotSame: (await snapshot()) === before,
  };
  assert.equal(evidence.policyGap.crossFlagged === true && evidence.policyGap.crossResolver === 2 && evidence.qrRows === 2 && evidence.manyRows === 3 && evidence.ack.length === 0 && evidence.snapshotSame, true, JSON.stringify(evidence));
  assert.equal(classifySeniorRows('QR90ST', qrRows).reason, 'ambiguous');
  const logicalClaims = async (ccn) => Number((await db.query(`select count(*)::int as n from network.network_entity_bindings
    where hub='senior' and binding_status in ('accepted','review_required')
      and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
      and (lower(btrim(specialist_entity_id))=lower($1) or (identifier_namespace='cms.ccn' and source_identifier_normalized=lower($1)))`, [ccn])).rows[0].n);
  for (const [id, label] of [['015009', 'canary after the padded windows close'], ['QR90ST', 'padded other namespace'], ['ZX81CV', 'padded cms.ccn specialist'], ['YW70BU', 'padded source'], ['VT63AS', 'cross jurisdiction'], ['HK52RD', 'wrong class'], ['JP41QE', 'review_required'], ['LM45NO', 'three claims'], ['AB12CD', 'case variant'], ['CD34EF', 'clean alphanumeric']]) {
    const seen = (await resolve(id)).length;
    const logical = await logicalClaims(id);
    assert.equal(seen, logical, label + ': resolver ' + seen + ', logical ' + logical);
    if (logical > 1) assert.equal(classifySeniorRows(id, await resolve(id)).reason, 'ambiguous', label);
  }
  console.log('PASS padded other-namespace claim: preflight and resolver agree, Save writes nothing and acknowledges nothing');
  await denied(QR, 'padded specialist id under another namespace');
  await denied(PAD, 'padded specialist id under cms.ccn');
  await denied(SRC, 'padded source identifier');
  await denied(XJ, 'cross-jurisdiction duplicate');
  await denied(WC, 'wrong-class logical duplicate');
  await denied(RR, 'review_required logical duplicate');
  await denied(MANY, 'three logical claims');
  await denied(UNBOUND, 'missing binding');
  await denied(REVIEW, 'review_required binding');
  await denied(AMBIGUOUS, 'ambiguous binding');
  await denied(ALPHA, 'upper/lower duplicate accepted claims');
  await denied(WRONG_CLASS, 'home health agency (CCN, wrong class and route)');
  await denied(HOSPICE, 'hospice (CCN, wrong class and route)');
  await denied(WRONG_REF, 'binding on another profile ref');
  await denied(RETIRED, 'retired entity');
  await denied(WRONG_JURISDICTION, 'binding under a state jurisdiction');
  await denied(WRONG_CCN, 'binding whose CCN disagrees with the native id');
  await denied(WRONG_NAMESPACE, 'binding under a state-license namespace');
  published.set(ALPHA.profile.nativeId, ALPHA.slug); await denied(ALPHA, 'case duplicate (AB12CD and ab12cd both accepted)');
  console.log('PASS case duplicate: a full Save of a CCN with an upper/lower duplicate claim writes nothing and acknowledges nothing');
  // Source re-proof failures: Senior down, erroring, answering garbage, or answering for something else.
  for (const fault of ['network', 'http500', 'not_json', 'refused', 'stale', 'future', 'not_publishable', 'home_health', 'hospice', 'other_identity', 'no_slug']) {
    publicationFault = fault;
    await denied(ADDISON, 'source re-proof: ' + fault);
  }
  publicationFault = null;
  // A facility that stops being published at Senior is denied even with an accepted binding.
  published.delete(ADDISON.profile.nativeId);
  await denied(ADDISON, 'unpublished at Senior');
  // Senior answering with a different canonical slug for the CCN is not accepted either.
  published.set(ADDISON.profile.nativeId, 'some-other-facility-name');
  await denied(ADDISON, 'Senior reports another canonical slug');
  published.set(ADDISON.profile.nativeId, ADDISON.slug);
  console.log('PASS denials: missing, review_required, ambiguous, home health, hospice, wrong jurisdiction, wrong CCN, wrong namespace, other profile ref, retired entity, unpublished, slug disagreement and eleven source re-proof failures write nothing and acknowledge nothing');

  // Tampered or foreign stages never get past the signed service boundary.
  await quiet();
  const good = manifestFor(BURNS);
  const stageStatus = async (input, sign) => (await service('prepareGuestProfileTransfer', input, sign)).status;
  assert.equal(await stageStatus(good), 200);
  const withProfile = profile => ({ ...good, returnTask: { ...good.returnTask, profile }, selected: [{ ...good.selected[0], profile }] });
  for (const [label, input] of [
    ['return path of another facility', { ...good, returnTask: { ...good.returnTask, returnPath: SANJAC.ref } }],
    ['return path CCN disagrees with the signed CCN', { ...good, returnTask: { ...good.returnTask, returnPath: '/facility/cms/055223/' + BURNS.slug } }],
    ['home-health route', { ...good, returnTask: { ...good.returnTask, returnPath: '/home-health/cms/015009/' + BURNS.slug } }],
    ['hospice route', { ...good, returnTask: { ...good.returnTask, returnPath: '/hospice/cms/015009/' + BURNS.slug } }],
    ['assisted-living route', { ...good, returnTask: { ...good.returnTask, returnPath: '/assisted-living/al/015009/' + BURNS.slug } }],
    ['home_health class', withProfile({ ...BURNS.profile, profileClass: 'home_health' })],
    ['hospice class', withProfile({ ...BURNS.profile, profileClass: 'hospice' })],
    ['assisted_living class', withProfile({ ...BURNS.profile, profileClass: 'assisted_living' })],
    ['namespaced native id', withProfile({ ...BURNS.profile, nativeId: 'cms.ccn:015009' })],
    ['state license native id', withProfile({ ...BURNS.profile, nativeId: 'AL12345' })],
    ['uuid native id', withProfile({ ...BURNS.profile, nativeId: receipt[0].network_entity_id })],
    ['slug as the local item id', { ...good, selected: [{ ...good.selected[0], localItemId: BURNS.slug }] }],
    ['item CCN disagrees with the return task', { ...good, selected: [{ ...good.selected[0], localItemId: SANJAC.ccn, profile: SANJAC.profile }] }],
    ['two selected items', { ...good, selected: [good.selected[0], { ...manifestFor(SANJAC).selected[0] }] }],
    ['browser-supplied network uuid', { ...good, networkEntityId: receipt[0].network_entity_id }],
    ['Move manifest under a Senior signature', { version: 'v2-3/selected-profiles/3', sourceHub: 'move', audience: 'ask',
      selected: [{ localItemId: 'x', revision: '1', digest: 'a'.repeat(64), profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' } }],
      returnTask: { kind: 'profile', hub: 'move', profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' }, canonicalSlug: 'x', returnPath: '/companies/x' } }],
  ]) assert.notEqual(await stageStatus(input), 200, label);
  // A slug that is not Senior's canonical slug passes the shape (the slug is navigation only) and is then refused by the re-proof.
  {
    const wrongSlug = { ...good, returnTask: { ...good.returnTask, canonicalSlug: 'some-other-name', returnPath: '/facility/cms/015009/some-other-name' } };
    assert.notEqual(await stageStatus(wrongSlug), 200, 'a non-canonical slug for the signed CCN');
  }
  // A valid Senior assertion is bound to its exact body, its lifetime and one use.
  assert.notEqual(await stageStatus(good, () => seniorSigned(Buffer.from(JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation: 'prepareGuestProfileTransfer', input: manifestFor(SANJAC) })))), 200, 'assertion signed for another body');
  assert.notEqual(await stageStatus(good, bytes => signSeniorAssertion(senior.privateKey, 'senior', ASK + API_PATH, 'transfer:stage', bytes, browser, null, null, Date.now() - 40_000)), 200, 'expired assertion');
  assert.notEqual(await stageStatus(good, bytes => signSeniorAssertion(senior.privateKey, 'senior', ASK + API_PATH, 'receipt:verify', bytes, browser)), 200, 'wrong scope');
  assert.notEqual(await stageStatus(good, bytes => seniorSigned(bytes).slice(0, -4) + 'AAAA'), 200, 'altered signature');
  assert.notEqual(await stageStatus(good, () => ''), 200, 'no assertion');
  let replayed = null;
  assert.equal(await stageStatus(good, bytes => (replayed = seniorSigned(bytes))), 200);
  assert.notEqual(await stageStatus(good, () => replayed), 200, 'replayed assertion');
  // The same manifest under any other signature is refused: unknown Senior key, Move key, Lender-shaped token.
  assert.notEqual(await stageStatus(good, bytes => seniorSigned(bytes, keys('senior-fixture').privateKey)), 200);
  assert.notEqual(await stageStatus(good, bytes => signAssertion(move.privateKey, 'move', ASK + API_PATH, 'transfer:stage', bytes, browser, null, null, Date.now(), PRODUCTION_TARGET)), 200);
  assert.notEqual(await stageStatus(good, bytes => signLenderAssertion(senior.privateKey, 'lender', ASK + API_PATH, 'transfer:stage', bytes, browser)), 200);
  // Without the Senior verify key installed, Ask refuses every Senior handoff.
  seniorConfigured = false;
  assert.notEqual(await stageStatus(good), 200);
  seniorConfigured = true;
  // An arrival that does not come from the Senior origin is refused.
  for (const from of ['https://www.lendertrusthub.com', 'https://www.movetrusthub.com', 'https://evil.example']) {
    await quiet(); acknowledged.length = 0;
    const result = await click(SANJAC, 'unsave', from);
    assert.notEqual(result.status, 303, from); assert.deepEqual(acknowledged, [], from);
  }
  assert.equal(await snapshot(), before);
  console.log('PASS tamper: altered return path, class, namespace, uuid identity, extra field, foreign manifest, tampered/expired/replayed/foreign signature, missing verify key and foreign origin are all refused');

  // Signed out: the chain returns to the profile and saves nothing.
  await quiet(); parent = null; acknowledged.length = 0;
  assert.deepEqual(await click(SANJAC, 'save'), returned(SANJAC));
  assert.equal(await snapshot(), before); assert.deepEqual(acknowledged, []);
  // No Watch or Alert relation exists on this path, and Move was never contacted.
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema in ('consumer','ops','network','v23_private') and table_name ~* '(watch|alert)'")).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from v23_private.transaction_authority')).rows[0].n, 0);
  assert.deepEqual([...new Set(seniorCalls)].sort(), ['acknowledge', 'resolve', 'source']);
  // Neither Move nor Lender was contacted on any Senior request, including the
  // Senior continuations that arrived from their origins above.
  assert.deepEqual(otherHubCalls, []);
  console.log('PASS signed-out Save changes nothing; zero Watch/Alert relations; no leaked transaction authority; Move never contacted');

  // Rollback: one receipt row per execution closes exactly that binding; the firm stops being eligible.
  const rollback = read('17-ask-prod-senior-ccn-binding-rollback.sql');
  const target = receipt.find(r => r.ccn === SANJAC.ccn);
  const setRow = (r, patch = {}) => db.query(`select set_config('v23senior.ccn',$1,false),set_config('v23senior.binding_id',$2,false),
    set_config('v23senior.network_entity_id',$3,false),set_config('v23senior.canonical_public_profile_ref',$4,false)`,
    [patch.ccn ?? r.ccn, patch.binding_id ?? r.binding_id, patch.network_entity_id ?? r.network_entity_id, patch.ref ?? r.canonical_public_profile_ref]);
  const counts = await identityRows();
  await setRow(target, { binding_id: receipt.find(r => r.ccn === BURNS.ccn).binding_id });
  await assert.rejects(db.exec(rollback), /closed 0/); await db.exec('rollback');
  await setRow(target, { ccn: '105001' });
  await assert.rejects(db.exec(rollback), /must be the same canary/); await db.exec('rollback');
  await setRow(target);
  await db.exec(rollback);
  assert.equal(await identityRows(), counts); // nothing deleted
  assert.equal((await resolve(SANJAC.profile.nativeId)).length, 0);
  assert.equal((await resolve(BURNS.profile.nativeId)).length, 1);
  await assert.rejects(db.exec(rollback), /closed 0/); await db.exec('rollback');
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  const afterRollback = await snapshot();
  await quiet(); acknowledged.length = 0;
  await click(SANJAC, 'save'); await click(SANJAC, 'unsave');
  assert.equal(await snapshot(), afterRollback); assert.deepEqual(acknowledged, []);
  assert.equal((await active(A)).includes(SANJAC.legalName), true); // Saved research is preserved
  console.log('PASS rollback: exactly one receipt binding closed, nothing deleted, facility no longer eligible, existing Saved research preserved, re-run refused');

  // ---- Regression: Move and Lender behave identically with and without the Senior key ----
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
    seniorConfigured = configured;
    await quiet(); acknowledged.length = 0;
    const moveSave = await otherClick(HINDMAN, 'move', MOVE_ORIGIN, '/companies/' + HINDMAN.slug, 'save', moveSigned);
    const savedAfterSave = (await active(B)).includes(HINDMAN.legalName);
    const moveUnsave = await otherClick(HINDMAN, 'move', MOVE_ORIGIN, '/companies/' + HINDMAN.slug, 'unsave', moveSigned);
    const savedAfterUnsave = (await active(B)).includes(HINDMAN.legalName);
    const lenderSave = await otherClick(FREEDOM, 'lender', LENDER_ORIGIN, '/lenders/' + FREEDOM.slug, 'save', lenderSigned);
    const lenderSaved = (await db.query(`select count(*)::int n from consumer.consumer_saved_entities where user_id=$1 and source_hub='lender' and removed_at is null`, [B])).rows[0].n;
    const lenderUnsave = await otherClick(FREEDOM, 'lender', LENDER_ORIGIN, '/lenders/' + FREEDOM.slug, 'unsave', lenderSigned);
    const lenderSavedAfter = (await db.query(`select count(*)::int n from consumer.consumer_saved_entities where user_id=$1 and source_hub='lender' and removed_at is null`, [B])).rows[0].n;
    regression[configured] = JSON.stringify({ moveSave, savedAfterSave, moveUnsave, savedAfterUnsave, lenderSave, lenderSaved, lenderUnsave, lenderSavedAfter, acknowledged: [...acknowledged] });
  }
  assert.equal(regression[false], regression[true]);
  { const r = JSON.parse(regression[false]); assert.deepEqual([r.lenderSaved, r.lenderSavedAfter], [1, 0]); assert.deepEqual(r.acknowledged, ['move:saved', 'move:local_only', 'lender:saved', 'lender:local_only']);
    console.log('PASS Lender full Save and Unsave through packet 15 on the stack: committed, removed, acknowledged each time'); }
  const withoutSenior = JSON.parse(regression[false]);
  assert.deepEqual(withoutSenior.moveSave, { stage: 200, arrival: 303, status: 303, location: MOVE_ORIGIN + '/companies/' + HINDMAN.slug });
  assert.deepEqual([withoutSenior.savedAfterSave, withoutSenior.savedAfterUnsave], [true, false]);
  assert.deepEqual(withoutSenior.acknowledged.filter(a => a.startsWith('move:')), ['move:saved', 'move:local_only']);
  assert.equal(withoutSenior.lenderSave.stage, 200); // the signed Lender stage is accepted exactly as before
  seniorConfigured = true; parent = { subject: A, session: sidA, label: 'Fixture A' };
  console.log('PASS regression: Move Save and Unsave complete, and a Lender stage is accepted, identically with and without the Senior verify key');

  {
    // Signed-out continuation: save_signin with no session shows the sign-in step, then the same continuation completes after sign-in.
    await db.exec(read('17-ask-prod-senior-ccn-binding-rollback.sql').replace(/^/, '-- not executed\n').slice(0, 0));
    await quiet(); parent = null; acknowledged.length = 0;
    const target = CANARIES[2];
    assert.equal((await active(A)).includes(target.legalName), true);
    const unsave = await click(target, 'unsave'); assert.deepEqual(unsave, returned(target)); // signed out: unsave is not acted on
    assert.equal((await active(A)).includes(target.legalName), true); assert.deepEqual(acknowledged, []);
    parent = { subject: A, session: sidA, label: 'Fixture A' }; await click(target, 'unsave'); assert.equal((await active(A)).includes(target.legalName), false);
    parent = null; acknowledged.length = 0;
    const stage = await service('prepareGuestProfileTransfer', manifestFor(target));
    const cont = await service('prepareProfileSaveContinuation', { sourceHub: 'senior', audience: 'ask', transferRef: stage.body.result.transferRef, manifestDigest: stage.body.result.manifestDigest });
    const arrival = new Request(ASK + '/my/profile-save', { method: 'POST', body: new URLSearchParams({ continuationRef: cont.body.result.continuationRef, intent: 'save_signin' }), headers: { origin: SENIOR } });
    const arrived = await handleProfileConfirmation(arrival, await runtime().browserBindings(arrival));
    assert.equal(arrived.status, 303);
    const cookie = arrived.headers.get('set-cookie').split(';')[0];
    const gate = await handleProfileConfirmation(new Request(ASK + '/my/profile-save', { headers: { cookie } }), await runtime().browserBindings(new Request(ASK + '/my/profile-save', { headers: { cookie } })));
    assert.equal(gate.status, 200); assert.match(await gate.text(), /Sign in to continue/);
    assert.equal((await active(A)).includes(target.legalName), false); assert.deepEqual(acknowledged, []);
    parent = { subject: A, session: sidA, label: 'Fixture A' };
    const done = await handleProfileConfirmation(new Request(ASK + '/my/profile-save', { headers: { cookie } }), await runtime().browserBindings(new Request(ASK + '/my/profile-save', { headers: { cookie } })));
    assert.equal(done.status, 303); assert.equal(done.headers.get('location'), SENIOR + target.ref);
    assert.equal((await active(A)).includes(target.legalName), true); assert.deepEqual(acknowledged, ['saved']);
    console.log('PASS signed-out continuation: a signed-out Unsave changes nothing; save_signin shows the sign-in step, saves nothing until sign-in, then the same continuation commits once and is acknowledged');
  }
  parent = { subject: A, session: sidA, label: 'Fixture A' };
  // Without the per-hub issuer or the authority packet the Senior path fails closed, and Move's issuer is still there, unchanged.
  const beforePackets = await snapshot();
  await db.exec(read('18-ask-prod-senior-hub-context-rollback.sql')); // packet 18 rollback: senior leaves the shared issuer
  await quiet(); acknowledged.length = 0;
  // A Save needs an account context even for a facility that is already saved, so nothing is acknowledged.
  await click(BURNS, 'save'); await click(ADDISON, 'save');
  assert.deepEqual(acknowledged, []);
  assert.equal(await snapshot(), beforePackets);
  await db.exec(p19.rollback); // packet 19 rollback: Senior leaves the network authority
  await quiet();
  assert.notEqual((await service('prepareGuestProfileTransfer', manifestFor(BURNS))).status, 200);
  assert.equal(await moveIssuer(), moveIssuerBefore);
  console.log('PASS packet dependence: without the shared per-hub issuer no Senior Save is committed or acknowledged; without the authority packet the database refuses the Senior stage; the Move issuer is byte-identical throughout');
} finally { await db.close(); }
console.log('PASS Senior CMS nursing-home Save on the final stack (#231 + #234 + #233 + #235; packets 15 + 18 + 17 binding + 19 authority, all real)');
