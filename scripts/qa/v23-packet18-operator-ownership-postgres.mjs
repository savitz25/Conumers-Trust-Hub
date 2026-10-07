// Local embedded PostgreSQL only. Proves Packet 18 as a non-superuser packet
// operator: the role is not a superuser, does not own prod_hub_issue_context,
// and can still assume myth_v23_foundation for the reviewed replace.
// Nothing here contacts a hosted database or creates a production key.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const forwardSql = read('18-ask-prod-senior-hub-context-forward.sql');
const rollbackSql = read('18-ask-prod-senior-hub-context-rollback.sql');
const packet15RollbackSql = read('15-ask-prod-hub-account-context-rollback.sql');

function ownerContextPrecedesReplace(sql) {
  const replaceAt = sql.search(/create or replace function v23_private\.prod_hub_issue_context/);
  const roleAt = sql.lastIndexOf('set local role myth_v23_foundation', replaceAt);
  const preAt = sql.indexOf('$pre$;');
  return replaceAt > 0 && roleAt >= 0 && preAt >= 0 && preAt < roleAt && roleAt < replaceAt;
}

function bareReplace(sql) {
  const match = sql.match(/create or replace function v23_private\.prod_hub_issue_context[\s\S]*?\nend \$\$;/);
  assert.ok(match, 'shared-issuer replace statement is missing');
  return match[0];
}

function errText(error) {
  const code = error?.code ?? error?.cause?.code ?? '';
  const message = String(error?.message ?? error).split('\n')[0];
  return `${code} ${message}`.trim();
}

async function clear(db) {
  try { await db.exec('rollback'); } catch { /* no open transaction */ }
}

async function expectFail(db, sql, pattern) {
  let caught = null;
  try { await db.exec(sql); }
  catch (error) { caught = error; }
  await clear(db);
  assert.ok(caught, 'expected a refusal, and the statement succeeded');
  const text = errText(caught);
  assert.match(text, pattern, text);
  return text;
}

async function apply(db, sql, label) {
  try { await db.exec(sql); }
  catch (error) {
    await clear(db);
    throw new Error(`${label}: ${errText(error)}`);
  }
}

async function snap(db) {
  const row = (await db.query(`
    select current_user as current_user, session_user as session_user,
      (select rolsuper from pg_roles where rolname = current_user) as rolsuper,
      (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls,
      (select prosrc from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) as prosrc,
      (select proowner::regrole::text from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) as owner,
      (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) as secdef,
      (select coalesce(array_to_string(proconfig, ','), '') from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) as config,
      (select pg_get_function_identity_arguments(oid) from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) as args,
      (select coalesce(string_agg(line, E'\\n' order by line), '') from (
        select format('grantor=%s grantee=%s privilege=%s grantable=%s',
          case when a.grantor = 0 then 'public' else a.grantor::regrole::text end,
          case when a.grantee = 0 then 'public' else a.grantee::regrole::text end,
          a.privilege_type, a.is_grantable::text) as line
        from pg_proc p
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')
      ) s) as acl,
      has_schema_privilege('myth_v23_foundation', 'v23_private', 'CREATE') as foundation_create,
      (select coalesce(string_agg(m.rolname || ' in ' || r.rolname || ' admin=' || a.admin_option::text
        || ' inherit=' || a.inherit_option::text || ' set=' || a.set_option::text || ' by ' || g.rolname,
        ' | ' order by r.rolname, m.rolname, g.rolname), '')
        from pg_auth_members a
        join pg_roles r on r.oid = a.roleid
        join pg_roles m on m.oid = a.member
        join pg_roles g on g.oid = a.grantor
        where r.rolname in ('myth_v23_foundation', 'myth_v23_prod_reader')
          and m.rolname in ('v23_packet_operator', 'v23_packet_observer')) as members
  `)).rows[0];
  return row;
}

function privilegeView(row) {
  return JSON.stringify({
    prosrc: row.prosrc,
    owner: row.owner,
    secdef: row.secdef,
    config: row.config,
    args: row.args,
    acl: row.acl,
    foundation_create: row.foundation_create,
    members: row.members,
  });
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
await seededDb.exec(`select set_config('v23bind.nmls_consumer_access_checked', 'true', false),
  set_config('v23bind.insurance_state_license_checked', 'true', false)`);
await seededDb.exec(read('12-ask-prod-lender-nmls-binding-forward.sql'));
await seededDb.exec(read('13-ask-prod-insurance-state-license-binding-forward.sql'));
await seededDb.exec(read('15-ask-prod-hub-account-context-forward.sql'));
const receipts = (await seededDb.query(`
  select hub, key, binding_id::text, network_entity_id::text, canonical_public_profile_ref
  from (
    select 'lender' as hub, nmls as key, binding_id, network_entity_id, canonical_public_profile_ref
      from pg_temp.v23lender_receipt
    union all
    select 'insurance', jurisdiction || ':' || license, binding_id, network_entity_id, canonical_public_profile_ref
      from pg_temp.v23insurance_receipt
  ) s order by hub, key`)).rows;
assert.equal(receipts.length, 6, JSON.stringify(receipts));
assert.deepEqual(receipts.map(row => `${row.hub}:${row.key}`), [
  'insurance:FL:L106287', 'insurance:TX:1365714', 'insurance:TX:9982',
  'lender:174457', 'lender:2611', 'lender:2767',
]);
assert.equal(receipts.some(row => String(row.key).includes('19068455')), false);

await seededDb.exec(`
  create role v23_packet_operator login nosuperuser bypassrls noinherit
    nocreatedb nocreaterole noreplication password null;
  create role v23_packet_observer login nosuperuser nobypassrls noinherit
    nocreatedb nocreaterole noreplication password null;
  grant myth_v23_foundation to v23_packet_operator with admin true, inherit false, set true;
  grant myth_v23_prod_reader to v23_packet_operator with admin true, inherit false, set true;
`);
await seededDb.exec(`
do $own$
declare r record;
begin
  for r in
    select n.nspname, c.relname, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('v23_private', 'ops', 'network', 'consumer', 'auth')
      and c.relkind in ('r', 'p', 'v', 'm')
      and pg_get_userbyid(c.relowner) not in ('myth_v23_foundation', 'v23_packet_operator')
  loop
    execute format('alter table %I.%I owner to v23_packet_operator', r.nspname, r.relname);
  end loop;
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('v23_private', 'ops', 'network', 'consumer', 'auth')
      and p.prokind in ('f', 'p')
      and pg_get_userbyid(p.proowner) not in ('myth_v23_foundation', 'v23_packet_operator')
  loop
    execute format('alter function %I.%I(%s) owner to v23_packet_operator', r.nspname, r.proname, r.args);
  end loop;
  for r in select nspname from pg_namespace
    where nspname in ('v23_private', 'ops', 'network', 'consumer', 'auth')
  loop
    execute format('alter schema %I owner to v23_packet_operator', r.nspname);
  end loop;
end
$own$;
`);
await seededDb.exec(`
  grant usage on schema v23_private, ops to v23_packet_observer;
  grant create on schema v23_private to v23_packet_observer with grant option;
  grant execute on function ops.origin_allowed(text, text, text) to v23_packet_observer;
`);
const issuerOwner = (await seededDb.query(`select proowner::regrole::text as owner
  from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')`)).rows[0].owner;
assert.equal(issuerOwner, 'myth_v23_foundation');
const seeded = await seededDb.dumpDataDir();
await seededDb.close();
console.log('PASS seed: real packet 15 installed, issuer owned by myth_v23_foundation, six binding receipts');

async function open(role) {
  const db = new PGlite({ database: 'postgres', loadDataDir: seeded, extensions: { btree_gist, pgcrypto } });
  await db.exec(`select set_config('v23.approved_project', '${PRODUCTION}', false),
    set_config('v23bind.nmls_consumer_access_checked', 'true', false),
    set_config('v23bind.insurance_state_license_checked', 'true', false),
    set_config('v23bind.sec_iapd_checked', 'true', false),
    set_config('v23bind.contractor_dbpr_checked', 'true', false),
    set_config('v23bind.senior_ccn_checked', 'true', false)`);
  await db.exec(`set session authorization ${role}`);
  const who = await snap(db);
  assert.equal(who.current_user, role);
  assert.equal(who.session_user, role);
  assert.equal(who.rolsuper, false);
  return db;
}

const operator = await open('v23_packet_operator');
try {
  assert.equal(operatorBypass(await snap(operator)), true);
  const before = await snap(operator);
  assert.equal(before.owner, 'myth_v23_foundation');
  assert.equal(before.foundation_create, false);
  const oldStatement = await expectFail(operator, `begin; ${bareReplace(forwardSql)}; commit;`, /42501/);
  assert.match(oldStatement, /must be owner of function/);
  assert.equal(privilegeView(await snap(operator)), privilegeView(before));
  console.log(`PASS bare CREATE OR REPLACE as non-superuser: ${oldStatement}`);

  if (!ownerContextPrecedesReplace(forwardSql) || !ownerContextPrecedesReplace(rollbackSql)) {
    const oldFile = await expectFail(operator, forwardSql, /42501/);
    assert.match(oldFile, /must be owner of function/);
    assert.equal(privilegeView(await snap(operator)), privilegeView(before));
    console.log(`OLD_FAILURE_REPRODUCED_AS_NON_SUPERUSER file=YES detail=${oldFile}`);
    console.log('STOP unpatched packet; the corrected proof runs after the owner context is moved.');
    process.exit(0);
  }

  console.log('OLD_FAILURE_REPRODUCED_AS_NON_SUPERUSER mechanism=YES');
  const predecessor = before.prosrc;
  await replaceIssuer(operator, predecessor.replace('https://www.lendertrusthub.com', 'https://www.lendertrusthub.com/'));
  const drifted = await snap(operator);
  assert.notEqual(drifted.prosrc, predecessor);
  const refused = await expectFail(operator, forwardSql, /frozen packet 15 body/);
  assert.equal(privilegeView(await snap(operator)), privilegeView(drifted));
  console.log(`PASS unexpected predecessor refused without mutation: ${refused}`);
  await replaceIssuer(operator, predecessor);
  assert.equal(privilegeView(await snap(operator)), privilegeView(before));

  const forced = forwardSql.replace(/\ncommit;\s*$/, `\ndo $forced$ begin raise exception 'V23_PACKET18_FORCED_FAIL'; end $forced$;\n`);
  const forcedText = await expectFail(operator, forced, /V23_PACKET18_FORCED_FAIL/);
  assert.equal(privilegeView(await snap(operator)), privilegeView(before));
  console.log(`PASS failed apply leaves no privilege or function changes: ${forcedText}`);
} finally {
  await operator.close();
}

function operatorBypass(row) {
  return row.bypassrls;
}

async function replaceIssuer(db, body) {
  await db.exec('grant create on schema v23_private to myth_v23_foundation');
  await db.exec('set role myth_v23_foundation');
  try {
    await db.exec(`create or replace function v23_private.prod_hub_issue_context(proof jsonb, subject uuid, session uuid, p_hub text)
      returns boolean language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $body$${body}$body$`);
  } finally {
    await db.exec('reset role');
    await db.exec('revoke create on schema v23_private from myth_v23_foundation');
  }
}

const observer = await open('v23_packet_observer');
try {
  const before = await snap(observer);
  assert.equal(before.rolsuper, false);
  assert.equal(before.bypassrls, false);
  const refused = await expectFail(observer, forwardSql, /42501/);
  assert.match(refused, /permission denied to grant role|must be owner of function|permission denied for schema/);
  assert.equal(privilegeView(await snap(observer)), privilegeView(before));
  console.log(`PASS insufficient operator refused without mutation: ${refused}`);
} finally {
  await observer.close();
}

const forward = await open('v23_packet_operator');
try {
  const before = await snap(forward);
  const predecessor = before.prosrc;
  assert.equal(before.owner, 'myth_v23_foundation');
  assert.match(forwardSql, /V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: installed shared issuer is not the frozen packet 15 body/);
  assert.match(forwardSql, /owner or security mode drifted/);
  assert.match(forwardSql, /already applied; review, do not re-apply/);
  assert.doesNotMatch(forwardSql, /drop\s+function[\s\S]*cascade/i);
  assert.doesNotMatch(rollbackSql, /drop\s+function[\s\S]*cascade/i);
  await apply(forward, read('18-ask-prod-senior-hub-context-preflight.sql'), 'packet 18 preflight');
  await apply(forward, forwardSql, 'packet 18 forward');
  const applied = await snap(forward);
  assert.equal(applied.owner, 'myth_v23_foundation');
  assert.equal(applied.secdef, true);
  assert.equal(applied.config.replace(/\s+/g, ''), before.config.replace(/\s+/g, ''));
  assert.equal(applied.config.replace(/\s+/g, ''), 'search_path=pg_catalog,v23_private,ops');
  assert.equal(applied.args, 'proof jsonb, subject uuid, session uuid, p_hub text');
  assert.equal(applied.acl, before.acl);
  assert.equal(applied.foundation_create, false);
  assert.equal(applied.members, before.members);
  assert.match(applied.prosrc, /when 'senior' then 'https:\/\/www\.seniortrusthub\.com'/);
  assert.equal((applied.prosrc.match(/when '/g) || []).length, 4);
  const fileBody = bareReplace(forwardSql).match(/as \$\$([\s\S]*?)\$\$;/)[1];
  assert.equal(applied.prosrc, fileBody);
  console.log('PASS packet 18 non-superuser forward; body, owner, ACL, search_path, signature, and senior pin preserved');
  console.log('PASS temporary foundation membership and schema CREATE restored');

  await apply(forward, rollbackSql, 'packet 18 rollback');
  const restored = await snap(forward);
  assert.equal(restored.prosrc, predecessor);
  assert.equal(restored.owner, 'myth_v23_foundation');
  assert.equal(restored.acl, before.acl);
  assert.equal(restored.config.replace(/\s+/g, ''), before.config.replace(/\s+/g, ''));
  assert.equal(restored.args, before.args);
  assert.equal(restored.secdef, true);
  assert.equal(restored.foundation_create, false);
  assert.equal(restored.members, before.members);
  assert.equal(restored.prosrc.includes("when 'senior'"), false);
  console.log('PASS packet 18 rollback restored the exact packet 15 predecessor');

  await apply(forward, packet15RollbackSql, 'packet 15 rollback');
  const gone = (await forward.query(`select to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is null as gone,
    to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is not null as move_remains`)).rows[0];
  assert.equal(gone.gone, true);
  assert.equal(gone.move_remains, true);
  const afterDrop = await snap(forward);
  assert.equal(afterDrop.foundation_create, false);
  assert.equal(afterDrop.members, before.members);
  console.log('PASS corrected packet 15 rollback accepted the restored predecessor and removed only that function');
} finally {
  await forward.close();
}

const sequence = await open('v23_packet_operator');
try {
  const bindingIds = (await sequence.query(`select hub, source_identifier, id::text
    from network.network_entity_bindings
    where hub in ('lender', 'insurance') and valid_to is null
    order by hub, source_identifier`)).rows;
  assert.equal(bindingIds.length, 6);
  assert.deepEqual(bindingIds.map(row => `${row.hub}:${row.source_identifier}`), [
    'insurance:1365714', 'insurance:9982', 'insurance:L106287',
    'lender:174457', 'lender:2611', 'lender:2767',
  ]);
  const authorityBefore = (await sequence.query(`select pg_get_userbyid(proowner) as owner,
    md5(regexp_replace(prosrc, '\\s+', '', 'g')) as fp, prosecdef
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0];
  assert.equal(authorityBefore.prosecdef, false);
  assert.equal(authorityBefore.owner, 'v23_packet_operator');

  const steps = [
    ['packet 18', forwardSql],
    ['investor context', read('14-ask-prod-investor-context-forward.sql')],
    ['investor bindings', read('14-ask-prod-investor-crd-binding-forward.sql')],
    ['contractor bindings', read('16-ask-prod-contractor-dbpr-binding-forward.sql')],
    ['senior bindings', read('17-ask-prod-senior-ccn-binding-forward.sql')],
    ['packet 19', read('19-ask-prod-network-authority-forward.sql')],
  ];
  for (const [label, sql] of steps) {
    const replaces = [...sql.matchAll(/create or replace function\s+([^\s(]+)/gi)].map(match => match[1]);
    for (const name of replaces) {
      const signature = name === 'v23_private.authority' ? 'v23_private.authority()' : name;
      const found = (await sequence.query(`select to_regprocedure($1) is not null as present,
        pg_get_userbyid(proowner) as owner
        from pg_proc where oid = to_regprocedure($1)`, [signature.includes('(') ? signature : `${signature}()`])).rows[0];
      if (found?.present && found.owner !== 'v23_packet_operator' && !ownerContextPrecedesReplace(sql) && !sql.includes('set local role myth_v23_foundation') && !sql.includes(`set local role ${found.owner}`)) {
        console.log(`OWNERSHIP_SCAN ${label} replaces ${signature} owned by ${found.owner}`);
      }
    }
    await apply(sequence, sql, label);
    console.log(`PASS forward step ${label}`);
  }

  const keys = (await sequence.query(`select hub, source_identifier
    from network.network_entity_bindings where valid_to is null
    order by hub, source_identifier`)).rows.map(row => `${row.hub}:${row.source_identifier}`);
  for (const key of ['insurance:9982', 'contractor:CGC1517216', 'investor:106176', 'senior:015009']) {
    assert.equal(keys.includes(key), true, key);
  }
  assert.equal(keys.includes('insurance:19068455'), false);
  assert.equal(keys.includes('contractor:CGC1506243'), false);
  const sameCommitted = (await sequence.query(`select id::text from network.network_entity_bindings
    where id = any($1::uuid[]) and valid_to is null order by id::text`, [bindingIds.map(row => row.id)])).rows;
  assert.equal(sameCommitted.length, 6);
  const authorityAfter = (await sequence.query(`select pg_get_userbyid(proowner) as owner,
    md5(regexp_replace(prosrc, '\\s+', '', 'g')) as fp, prosecdef
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0];
  assert.equal(authorityAfter.prosecdef, false);
  assert.equal(authorityAfter.owner, authorityBefore.owner);
  assert.notEqual(authorityAfter.fp, authorityBefore.fp);
  console.log(`PASS remaining forward sequence authority ${authorityBefore.fp} -> ${authorityAfter.fp} owner ${authorityAfter.owner}`);
  console.log(`PASS canaries include TX 9982 and CGC1517216`);

  let investorRollback = 'not-run';
  try {
    await sequence.exec(read('14-ask-prod-investor-context-rollback.sql'));
    investorRollback = 'PASS';
  } catch (error) {
    await clear(sequence);
    investorRollback = errText(error);
  }
  console.log(`INVESTOR_CONTEXT_ROLLBACK ${investorRollback}`);
  let packet19Rollback = 'not-run';
  try {
    await sequence.exec(read('19-ask-prod-network-authority-rollback.sql'));
    packet19Rollback = 'PASS';
  } catch (error) {
    await clear(sequence);
    packet19Rollback = errText(error);
  }
  console.log(`PACKET19_ROLLBACK ${packet19Rollback}`);
  console.log(`AUTHORITY_BASELINE_MD5 ${authorityBefore.fp}`);
  console.log(`AUTHORITY_PACKET19_MD5 ${authorityAfter.fp}`);
  console.log(`PACKET18_FORWARD_SHA256 ${sha256(forwardSql)}`);
  console.log(`PACKET18_ROLLBACK_SHA256 ${sha256(rollbackSql)}`);
  console.log(`PACKET15_ROLLBACK_SHA256 ${sha256(packet15RollbackSql)}`);
} finally {
  await sequence.close();
}
