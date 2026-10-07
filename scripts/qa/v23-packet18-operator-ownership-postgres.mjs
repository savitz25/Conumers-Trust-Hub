// Local embedded PostgreSQL only. Proves Packet 18 and the remaining
// network sequence as the hosted operator, not as a superuser.
//
// Production's operator role is named postgres. This embedded cluster's
// bootstrap superuser already uses that name, so the local substitute is
// hosted_operator. Owner, grantor, and grantee identities that production
// records as postgres are mapped to hosted_operator. The bootstrap role
// stays postgres and must not remain the only owner of an operator-owned
// dependency.
//
// Nothing here contacts a hosted database or creates a production key.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const PRODUCTION = 'qvvxvbcdmbjzrgvwjatw';
const OPERATOR = 'hosted_operator';
const REQUEST_ACTOR_MD5 = '043d6f9b6cabdd24c12efd6571c4f64a';
const BASELINE_FP = '691e2f2e05426c60af8fa3a54f38eac9';
const PACKET19_FP = '17f464ad69f3d8c7a89dd2cf9229f112';
const prod = 'docs/my-trusthub/v2/production/';
const read = file => readFileSync(prod + file, 'utf8').replace(/\r\n/g, '\n');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const SQL_PINS = {
  '18-ask-prod-senior-hub-context-forward.sql': '72e0a3cfd276c0002a8dc5c712c0c91851869588b99065c44e26439366881e38',
  '18-ask-prod-senior-hub-context-rollback.sql': 'b7a7e06713f5b61245eedfe2e99a4c99b3346bc5b5df77c4433647f8106608e1',
  '15-ask-prod-hub-account-context-rollback.sql': 'f1ce07cd207d8d0f7645a7d2ecb92b6641d762b7b6093982efc0b7fba0e207ce',
  '14-ask-prod-investor-context-rollback.sql': '6678823d2466ce60c98e016b03f70bd09eb8c1c16cda9d4cc5e94668510bcbeb',
  '14-ask-prod-investor-crd-binding-forward.sql': '453565ecd5b6ef454fed1979f7ccee6b46027647699f825080940032b0307664',
};
for (const [file, pin] of Object.entries(SQL_PINS)) {
  assert.equal(sha256(read(file)), pin, file);
}
const forwardSql = read('18-ask-prod-senior-hub-context-forward.sql');
const rollbackSql = read('18-ask-prod-senior-hub-context-rollback.sql');
const packet15RollbackSql = read('15-ask-prod-hub-account-context-rollback.sql');
const EXPECTED_MEMBERS = [
  `${OPERATOR} in myth_v23_foundation admin=true inherit=false set=false by supabase_admin`,
  `${OPERATOR} in myth_v23_prod_reader admin=true inherit=false set=false by supabase_admin`,
].join(' | ');

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
          and m.rolname = '${OPERATOR}') as members
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

async function memberText(db) {
  return (await snap(db)).members;
}

async function bindingRows(db) {
  return (await db.query(`
    select b.id::text as id, b.id::text as binding_id, b.network_entity_id::text as network_entity_id,
      b.hub, b.source_identifier, coalesce(b.jurisdiction, '') as jurisdiction,
      b.created_by, (b.valid_to is null) as open, b.binding_status, e.status as entity_status,
      e.canonical_public_profile_ref
    from network.network_entity_bindings b
    join network.network_entities e on e.id = b.network_entity_id
    order by hub, source_identifier, id`)).rows;
}

async function authorityRow(db) {
  return (await db.query(`
    select pg_get_userbyid(proowner) as owner,
      md5(regexp_replace(prosrc, '\\s+', '', 'g')) as fp, prosecdef
    from pg_proc where oid = to_regprocedure('v23_private.authority()')`)).rows[0];
}

const sessionGucs = `select set_config('v23.approved_project', '${PRODUCTION}', false),
  set_config('v23bind.nmls_consumer_access_checked', 'true', false),
  set_config('v23bind.insurance_state_license_checked', 'true', false),
  set_config('v23bind.sec_iapd_checked', 'true', false),
  set_config('v23bind.contractor_dbpr_checked', 'true', false),
  set_config('v23bind.senior_ccn_checked', 'true', false)`;

const extensions = { btree_gist, pgcrypto };
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
const seededDb = new PGlite({ database: 'postgres', loadDataDir: emptyCluster, extensions });
await seededDb.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth; create table auth.users(id uuid primary key);
  create table auth.sessions(id uuid primary key, user_id uuid references auth.users, not_after timestamptz);
  alter table auth.sessions enable row level security; alter table auth.sessions force row level security;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb$$;`);
for (const file of migrations) {
  await seededDb.exec(readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/\r\n/g, '\n'));
}
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
  create role supabase_admin nologin nosuperuser nobypassrls noinherit
    nocreatedb nocreaterole noreplication;
  create role ${OPERATOR} login nosuperuser bypassrls inherit
    createrole nocreatedb noreplication password null;
  create role hosted_operator_nobypass login nosuperuser nobypassrls inherit
    nocreaterole nocreatedb noreplication password null;
  create role hosted_operator_no_actor login nosuperuser bypassrls inherit
    nocreaterole nocreatedb noreplication password null;
  grant myth_v23_foundation to supabase_admin with admin true, inherit false, set false;
  grant myth_v23_prod_reader to supabase_admin with admin true, inherit false, set false;
  grant myth_v23_foundation to ${OPERATOR} with admin true, inherit false, set false granted by supabase_admin;
  grant myth_v23_prod_reader to ${OPERATOR} with admin true, inherit false, set false granted by supabase_admin;
`);
await seededDb.exec(`
  alter function network.request_actor() owner to ${OPERATOR};
  alter function network.audit_identity_governance() owner to ${OPERATOR};
  alter function network.set_updated_at() owner to ${OPERATOR};
  alter function network.resolve_canonical_entity(uuid) owner to ${OPERATOR};
  alter function ops.origin_allowed(text, text, text) owner to ${OPERATOR};
  alter function v23_private.authority() owner to ${OPERATOR};
  alter table network.network_entities owner to ${OPERATOR};
  alter table network.network_entity_bindings owner to ${OPERATOR};
  alter table network.network_entity_redirects owner to ${OPERATOR};
  alter table network.identity_governance_events owner to ${OPERATOR};
  alter table ops.consumer_hub_registry owner to ${OPERATOR};
  alter table consumer.consumer_saved_entities owner to ${OPERATOR};
  alter schema consumer owner to ${OPERATOR};
  alter schema network owner to ${OPERATOR};
  alter schema ops owner to ${OPERATOR};
  alter schema v23_private owner to ${OPERATOR};
`);
await seededDb.exec(`
  grant usage on schema network to hosted_operator_nobypass, hosted_operator_no_actor;
  grant select, insert, update on network.network_entities to hosted_operator_nobypass, hosted_operator_no_actor;
  grant select, insert, update on network.network_entity_bindings to hosted_operator_nobypass, hosted_operator_no_actor;
  grant execute on function network.request_actor() to hosted_operator_nobypass;
  grant execute on function network.set_updated_at() to hosted_operator_nobypass, hosted_operator_no_actor;
  grant execute on function network.audit_identity_governance() to hosted_operator_nobypass, hosted_operator_no_actor;
  create schema fixture_only;
  create function fixture_only.binding_count() returns integer
    language sql security definer set search_path = pg_catalog, network
    as $$ select count(*)::integer from network.network_entity_bindings $$;
  revoke all on function fixture_only.binding_count() from public;
  grant usage on schema fixture_only to hosted_operator_nobypass, hosted_operator_no_actor;
  grant execute on function fixture_only.binding_count() to hosted_operator_nobypass, hosted_operator_no_actor;
`);
const actor = (await seededDb.query(`
  select pg_get_userbyid(proowner) as owner, prosecdef, md5(prosrc) as md5, proacl::text as acl,
    has_function_privilege('${OPERATOR}', oid, 'EXECUTE') as operator_exec,
    has_function_privilege('public', oid, 'EXECUTE') as public_exec
  from pg_proc where oid = to_regprocedure('network.request_actor()')`)).rows[0];
assert.equal(actor.owner, OPERATOR);
assert.equal(actor.prosecdef, false);
assert.equal(actor.md5, REQUEST_ACTOR_MD5);
assert.equal(actor.operator_exec, true);
assert.equal(actor.public_exec, false);
assert.match(actor.acl, new RegExp(`${OPERATOR}=X/${OPERATOR}`));
const ownership = (await seededDb.query(`
  select
    (select nspowner::regrole::text from pg_namespace where nspname = 'consumer') as consumer_schema,
    (select nspowner::regrole::text from pg_namespace where nspname = 'auth') as auth_schema,
    (select relowner::regrole::text from pg_class where oid = 'auth.users'::regclass) as auth_users_owner,
    (select relowner::regrole::text from pg_class where oid = 'consumer.consumer_notes'::regclass) as notes_owner,
    (select relowner::regrole::text from pg_class where oid = 'consumer.consumer_saved_entities'::regclass) as saved_owner,
    (select relowner::regrole::text from pg_class where oid = 'network.identity_governance_events'::regclass) as events_owner,
    (select relowner::regrole::text from pg_class where oid = 'network.identity_governance_events_id_seq'::regclass) as seq_owner,
    (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'network.identity_governance_events'::regclass) as events_forced,
    (select proowner::regrole::text from pg_proc where oid = to_regprocedure('network.audit_identity_governance()')) as audit_owner,
    (select prosecdef from pg_proc where oid = to_regprocedure('network.audit_identity_governance()')) as audit_secdef,
    (select proowner::regrole::text from pg_proc where oid = to_regprocedure('network.set_updated_at()')) as touch_owner,
    (select prosecdef from pg_proc where oid = to_regprocedure('network.set_updated_at()')) as touch_secdef,
    (select proowner::regrole::text from pg_proc where oid = to_regprocedure('network.resolve_canonical_entity(uuid)')) as resolve_owner,
    (select prosecdef from pg_proc where oid = to_regprocedure('network.resolve_canonical_entity(uuid)')) as resolve_secdef,
    (select proowner::regrole::text from pg_proc where oid = to_regprocedure('ops.origin_allowed(text,text,text)')) as origin_owner,
    (select prosecdef from pg_proc where oid = to_regprocedure('ops.origin_allowed(text,text,text)')) as origin_secdef,
    (select pg_get_expr(adbin, adrelid) from pg_attrdef
      where adrelid = 'network.network_entity_bindings'::regclass
        and adnum = (select attnum from pg_attribute
          where attrelid = 'network.network_entity_bindings'::regclass and attname = 'created_by')) as created_by_default,
    has_sequence_privilege('myth_identity_governor', 'network.identity_governance_events_id_seq', 'USAGE') as governor_usage,
    has_sequence_privilege('myth_identity_governor', 'network.identity_governance_events_id_seq', 'SELECT') as governor_select,
    has_table_privilege('myth_identity_governor', 'network.identity_governance_events', 'SELECT') as governor_table,
    (select count(*)::int from pg_trigger where tgname in (
      'network_entities_audit', 'network_entity_bindings_audit', 'network_entity_redirects_audit',
      'network_entities_set_updated_at', 'network_entity_bindings_set_updated_at') and tgenabled = 'O') as live_triggers
`)).rows[0];
assert.equal(ownership.consumer_schema, OPERATOR);
assert.equal(ownership.auth_schema, 'postgres');
assert.equal(ownership.auth_users_owner, 'postgres');
assert.equal(ownership.notes_owner, 'postgres');
assert.equal(ownership.saved_owner, OPERATOR);
assert.equal(ownership.events_owner, OPERATOR);
assert.equal(ownership.seq_owner, OPERATOR);
assert.equal(ownership.events_forced, true);
assert.equal(ownership.audit_owner, OPERATOR);
assert.equal(ownership.audit_secdef, true);
assert.equal(ownership.touch_owner, OPERATOR);
assert.equal(ownership.touch_secdef, false);
assert.equal(ownership.resolve_owner, OPERATOR);
assert.equal(ownership.resolve_secdef, false);
assert.equal(ownership.origin_owner, OPERATOR);
assert.equal(ownership.origin_secdef, true);
assert.match(ownership.created_by_default, /network\.request_actor\(\)/);
assert.equal(ownership.governor_usage, true);
assert.equal(ownership.governor_select, true);
assert.equal(ownership.governor_table, true);
assert.equal(ownership.live_triggers, 5);
const roles = (await seededDb.query(`
  select rolname, rolsuper, rolbypassrls, rolinherit, rolcreaterole
  from pg_roles
  where rolname in ('${OPERATOR}', 'myth_v23_foundation', 'myth_v23_prod_reader', 'supabase_admin')
  order by rolname`)).rows;
const operatorRole = roles.find(row => row.rolname === OPERATOR);
assert.equal(operatorRole.rolsuper, false);
assert.equal(operatorRole.rolbypassrls, true);
assert.equal(operatorRole.rolinherit, true);
assert.equal(operatorRole.rolcreaterole, true);
for (const name of ['myth_v23_foundation', 'myth_v23_prod_reader', 'supabase_admin']) {
  const role = roles.find(row => row.rolname === name);
  assert.equal(role.rolsuper, false, name);
  assert.equal(role.rolbypassrls, false, name);
}
const issuerOwner = (await seededDb.query(`select proowner::regrole::text as owner
  from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')`)).rows[0].owner;
assert.equal(issuerOwner, 'myth_v23_foundation');
const seeded = await seededDb.dumpDataDir();
await seededDb.close();
console.log('THIS_RUN PASS seed: packet 15 installed, six receipts, hosted_operator fixture, no blanket ownership transfer');
console.log('THIS_RUN OPERATOR_ATTRIBUTES_MATCH PASS');
console.log('THIS_RUN REQUEST_ACTOR_OWNER_AND_ACL_MATCH PASS');
console.log('THIS_RUN AUDIT_TABLE_SEQUENCE_PERMISSIONS_MATCH PASS');
console.log('THIS_RUN BLANKET_OWNERSHIP_TRANSFER_REMOVED YES');
console.log('THIS_RUN FIVE_SQL_FILES_UNCHANGED YES');

async function open(role) {
  const db = new PGlite({ database: 'postgres', loadDataDir: seeded, extensions });
  await db.exec(sessionGucs);
  await db.exec(`set session authorization ${role}`);
  const who = (await db.query(`select current_user as current_user, session_user as session_user,
    (select rolsuper from pg_roles where rolname = current_user) as rolsuper`)).rows[0];
  assert.equal(who.current_user, role);
  assert.equal(who.session_user, role);
  assert.equal(who.rolsuper, false);
  return db;
}

async function bindingCount(db) {
  return (await db.query('select fixture_only.binding_count() as n')).rows[0].n;
}

async function assertPrivilegesRestored(db) {
  const row = await snap(db);
  assert.equal(row.members, EXPECTED_MEMBERS);
  assert.equal(row.foundation_create, false);
  const flags = (await db.query(`
    select pg_has_role('${OPERATOR}', 'myth_v23_foundation', 'SET') as foundation_set,
      pg_has_role('${OPERATOR}', 'myth_v23_foundation', 'USAGE') as foundation_usage,
      pg_has_role('${OPERATOR}', 'myth_v23_prod_reader', 'SET') as reader_set
  `)).rows[0];
  assert.equal(flags.foundation_set, false);
  assert.equal(flags.foundation_usage, false);
  assert.equal(flags.reader_set, false);
}

const negativeInsert = (suffix) => `begin;
  insert into network.network_entities (
    entity_type, canonical_name, primary_hub, jurisdiction, canonical_public_profile_ref, status
  ) values (
    'organization', 'Negative ${suffix}', 'investor', 'US', '/firm/neg-${suffix}', 'active'
  );
  insert into network.network_entity_bindings (
    network_entity_id, hub, specialist_entity_type, specialist_entity_id,
    identifier_namespace, source_identifier, jurisdiction, binding_status,
    valid_from, provenance_ref
  )
  select id, 'investor', 'official_firm', 'crd-neg-${suffix}',
    'sec.crd', 'neg-${suffix}', 'US', 'accepted', transaction_timestamp(), 'fixture-negative'
  from network.network_entities where canonical_public_profile_ref = '/firm/neg-${suffix}';
  commit;`;

const operator = await open(OPERATOR);
try {
  assert.equal((await snap(operator)).bypassrls, true);
  await assertPrivilegesRestored(operator);
  const actorCall = (await operator.query('select network.request_actor() as actor')).rows[0].actor;
  assert.equal(actorCall, OPERATOR);
  const before = await snap(operator);
  assert.equal(before.owner, 'myth_v23_foundation');
  assert.equal(before.members, EXPECTED_MEMBERS);
  console.log('THIS_RUN INITIAL_SET_FALSE_MATCH PASS');
  const setRefused = await expectFail(operator, 'set role myth_v23_foundation', /42501/);
  assert.match(setRefused, /permission denied to set role/);
  const readerRefused = await expectFail(operator, 'set role myth_v23_prod_reader', /42501/);
  assert.match(readerRefused, /permission denied to set role/);
  assert.equal(privilegeView(await snap(operator)), privilegeView(before));
  console.log(`THIS_RUN PASS SET ROLE refused before the temporary grant: ${setRefused}`);

  await operator.exec('begin');
  await operator.exec(`grant myth_v23_foundation to current_user with admin false, inherit false, set true granted by current_user`);
  await operator.exec(`grant myth_v23_prod_reader to current_user with admin false, inherit false, set true granted by current_user`);
  const mid = (await operator.query(`
    select r.rolname as role, g.rolname as grantor, a.admin_option as admin, a.inherit_option as inherit, a.set_option as set_ok
    from pg_auth_members a
    join pg_roles r on r.oid = a.roleid
    join pg_roles m on m.oid = a.member
    join pg_roles g on g.oid = a.grantor
    where m.rolname = '${OPERATOR}'
      and r.rolname in ('myth_v23_foundation', 'myth_v23_prod_reader')
    order by 1, 2`)).rows;
  assert.deepEqual(mid, [
    { role: 'myth_v23_foundation', grantor: OPERATOR, admin: false, inherit: false, set_ok: true },
    { role: 'myth_v23_foundation', grantor: 'supabase_admin', admin: true, inherit: false, set_ok: false },
    { role: 'myth_v23_prod_reader', grantor: OPERATOR, admin: false, inherit: false, set_ok: true },
    { role: 'myth_v23_prod_reader', grantor: 'supabase_admin', admin: true, inherit: false, set_ok: false },
  ]);
  await operator.exec('set local role myth_v23_foundation');
  assert.equal((await operator.query('select current_user as u')).rows[0].u, 'myth_v23_foundation');
  await operator.exec('reset role');
  await operator.exec(`revoke myth_v23_foundation from current_user granted by current_user`);
  await operator.exec(`revoke myth_v23_prod_reader from current_user granted by current_user`);
  assert.equal(await memberText(operator), EXPECTED_MEMBERS);
  await operator.exec('rollback');
  await assertPrivilegesRestored(operator);
  console.log('THIS_RUN DISTINCT_GRANTOR_PRESERVED PASS');

  const oldStatement = await expectFail(operator, `begin; ${bareReplace(forwardSql)}; commit;`, /42501/);
  assert.match(oldStatement, /must be owner of function/);
  assert.equal(privilegeView(await snap(operator)), privilegeView(before));
  console.log(`THIS_RUN PASS bare CREATE OR REPLACE as non-superuser: ${oldStatement}`);
  assert.equal(ownerContextPrecedesReplace(forwardSql), true);
  assert.equal(ownerContextPrecedesReplace(rollbackSql), true);
  console.log('THIS_RUN OLD_FAILURE_REPRODUCED_AS_NON_SUPERUSER mechanism=YES');

  const forced = forwardSql.replace(/\ncommit;\s*$/, `\ndo $forced$ begin raise exception 'V23_PACKET18_FORCED_FAIL'; end $forced$;\n`);
  const forcedText = await expectFail(operator, forced, /V23_PACKET18_FORCED_FAIL/);
  assert.equal(privilegeView(await snap(operator)), privilegeView(before));
  console.log(`THIS_RUN PASS failed apply leaves no privilege or function changes: ${forcedText}`);
} finally {
  await operator.close();
}

async function openMutated(mutate) {
  const db = new PGlite({ database: 'postgres', loadDataDir: seeded, extensions });
  await db.exec(sessionGucs);
  await mutate(db);
  await db.exec(`set session authorization ${OPERATOR}`);
  return db;
}

const predecessor = await openMutated(async db => {
  const body = (await db.query(`select prosrc from pg_proc
    where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')`)).rows[0].prosrc;
  const drifted = body.replace('https://www.lendertrusthub.com', 'https://www.lendertrusthub.com/');
  assert.notEqual(drifted, body);
  await db.exec(`create or replace function v23_private.prod_hub_issue_context(proof jsonb, subject uuid, session uuid, p_hub text)
    returns boolean language plpgsql security definer set search_path = pg_catalog, v23_private, ops as $body$${drifted}$body$`);
});
try {
  const before = await snap(predecessor);
  const refused = await expectFail(predecessor, forwardSql, /frozen packet 15 body/);
  assert.equal(privilegeView(await snap(predecessor)), privilegeView(before));
  console.log(`THIS_RUN PASS unexpected predecessor refused without mutation: ${refused}`);
} finally {
  await predecessor.close();
}

const security = await openMutated(async db => {
  await db.exec(`alter function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text) owner to service_role`);
});
try {
  const before = await snap(security);
  assert.equal(before.owner, 'service_role');
  const refused = await expectFail(security, forwardSql, /owner or security mode drifted/);
  assert.equal(privilegeView(await snap(security)), privilegeView(before));
  console.log(`THIS_RUN PASS security drift refused without mutation: ${refused}`);
} finally {
  await security.close();
}

const nobypass = await open('hosted_operator_nobypass');
try {
  assert.equal((await nobypass.query(`select rolbypassrls from pg_roles where rolname = current_user`)).rows[0].rolbypassrls, false);
  const before = await bindingCount(nobypass);
  const refused = await expectFail(nobypass, negativeInsert('bypass'), /row-level security policy/);
  assert.equal(await bindingCount(nobypass), before);
  console.log(`THIS_RUN PASS operator without RLS bypass refused: ${refused}`);
} finally {
  await nobypass.close();
}

const noActor = await open('hosted_operator_no_actor');
try {
  assert.equal((await noActor.query(`select rolbypassrls from pg_roles where rolname = current_user`)).rows[0].rolbypassrls, true);
  const before = await bindingCount(noActor);
  const refused = await expectFail(noActor, negativeInsert('actor'), /request_actor/);
  assert.equal(await bindingCount(noActor), before);
  console.log(`THIS_RUN PASS operator lacking request_actor EXECUTE refused: ${refused}`);
} finally {
  await noActor.close();
}

const forward = await open(OPERATOR);
try {
  const before = await snap(forward);
  const predecessorBody = before.prosrc;
  await apply(forward, read('18-ask-prod-senior-hub-context-preflight.sql'), 'packet 18 preflight');
  await apply(forward, forwardSql, 'packet 18 forward');
  const applied = await snap(forward);
  assert.equal(applied.owner, 'myth_v23_foundation');
  assert.equal(applied.secdef, true);
  assert.equal(applied.config.replace(/\s+/g, ''), before.config.replace(/\s+/g, ''));
  assert.equal(applied.config.replace(/\s+/g, ''), 'search_path=pg_catalog,v23_private,ops');
  assert.equal(applied.args, 'proof jsonb, subject uuid, session uuid, p_hub text');
  assert.equal(applied.acl, before.acl);
  assert.equal(applied.members, EXPECTED_MEMBERS);
  assert.equal(applied.foundation_create, false);
  assert.match(applied.prosrc, /when 'senior' then 'https:\/\/www\.seniortrusthub\.com'/);
  assert.equal((applied.prosrc.match(/when '/g) || []).length, 4);
  const fileBody = bareReplace(forwardSql).match(/as \$\$([\s\S]*?)\$\$;/)[1];
  assert.equal(applied.prosrc, fileBody);
  console.log('THIS_RUN PASS packet 18 non-superuser forward; body, owner, ACL, search_path, signature, and senior pin preserved');

  await apply(forward, rollbackSql, 'packet 18 rollback');
  const restored = await snap(forward);
  assert.equal(restored.prosrc, predecessorBody);
  assert.equal(restored.owner, 'myth_v23_foundation');
  assert.equal(restored.acl, before.acl);
  assert.equal(restored.members, EXPECTED_MEMBERS);
  assert.equal(restored.foundation_create, false);
  assert.equal(restored.prosrc.includes("when 'senior'"), false);
  console.log('THIS_RUN PASS packet 18 rollback restored the exact packet 15 predecessor');

  await apply(forward, packet15RollbackSql, 'packet 15 rollback');
  const gone = (await forward.query(`select to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is null as gone,
    to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is not null as move_remains`)).rows[0];
  assert.equal(gone.gone, true);
  assert.equal(gone.move_remains, true);
  await assertPrivilegesRestored(forward);
  console.log('THIS_RUN PASS packet 15 rollback accepted the restored predecessor and removed only that function');
  console.log('THIS_RUN TEMPORARY_PRIVILEGES_RESTORED PASS');
} finally {
  await forward.close();
}

const forwardSteps = [
  ['packet 18 preflight', read('18-ask-prod-senior-hub-context-preflight.sql')],
  ['packet 18', forwardSql],
  ['investor context', read('14-ask-prod-investor-context-forward.sql')],
  ['investor bindings', read('14-ask-prod-investor-crd-binding-forward.sql')],
  ['contractor bindings', read('16-ask-prod-contractor-dbpr-binding-forward.sql')],
  ['senior bindings', read('17-ask-prod-senior-ccn-binding-forward.sql')],
  ['packet 19 preflight', read('19-ask-prod-network-authority-preflight.sql')],
  ['packet 19', read('19-ask-prod-network-authority-forward.sql')],
];

async function runRemainingForward(db) {
  const original = await bindingRows(db);
  const originalSix = original.filter(row => row.hub === 'lender' || row.hub === 'insurance');
  assert.equal(originalSix.length, 6);
  const authorityBefore = await authorityRow(db);
  assert.equal(authorityBefore.prosecdef, false);
  assert.equal(authorityBefore.owner, OPERATOR);
  assert.equal(authorityBefore.fp, BASELINE_FP);
  const auditBefore = (await db.query(`select count(*)::int as n from network.identity_governance_events`)).rows[0].n;
  for (const [label, sql] of forwardSteps) {
    await apply(db, sql, label);
    await assertPrivilegesRestored(db);
    console.log(`THIS_RUN PASS forward step ${label}`);
  }
  const after = await bindingRows(db);
  const same = after.filter(row => originalSix.some(item => item.id === row.id));
  assert.deepEqual(same.map(row => ({
    id: row.id, hub: row.hub, source_identifier: row.source_identifier,
    created_by: row.created_by, open: row.open, binding_status: row.binding_status,
  })), originalSix.map(row => ({
    id: row.id, hub: row.hub, source_identifier: row.source_identifier,
    created_by: row.created_by, open: row.open, binding_status: row.binding_status,
  })));
  const created = after.filter(row => row.created_by === OPERATOR && row.open);
  assert.equal(created.length, 9);
  assert.deepEqual(created.map(row => row.hub).sort(), [
    'contractor', 'contractor', 'contractor',
    'investor', 'investor', 'investor',
    'senior', 'senior', 'senior',
  ]);
  const openCanaries = after.filter(row => row.open && row.hub !== 'move');
  assert.equal(openCanaries.length, 15);
  const keys = openCanaries.map(row => `${row.hub}:${row.source_identifier}`);
  for (const key of ['insurance:9982', 'contractor:CGC1517216', 'investor:106176', 'senior:015009']) {
    assert.equal(keys.includes(key), true, key);
  }
  assert.equal(keys.includes('insurance:19068455'), false);
  assert.equal(keys.includes('contractor:CGC1506243'), false);
  const receiptsNew = (await db.query(`
    select (select count(*)::int from pg_temp.v23investor_receipt)
      + (select count(*)::int from pg_temp.v23contractor_receipt)
      + (select count(*)::int from pg_temp.v23senior_receipt) as n`)).rows[0].n;
  assert.equal(receiptsNew, 9);
  const audited = (await db.query(`
    select action, count(*)::int as n
    from network.identity_governance_events
    where actor = '${OPERATOR}' and binding_id = any($1::uuid[])
    group by action order by action`, [created.map(row => row.id)])).rows;
  assert.deepEqual(audited, [{ action: 'binding.accepted', n: 9 }]);
  const entityEvents = (await db.query(`
    select count(*)::int as n from network.identity_governance_events
    where actor = '${OPERATOR}' and action = 'entity.created'`)).rows[0].n;
  assert.equal(entityEvents, 9);
  const auditAfter = (await db.query(`select count(*)::int as n from network.identity_governance_events`)).rows[0].n;
  assert.ok(auditAfter > auditBefore);
  const defaults = (await db.query(`
    select network.request_actor() as actor,
      (select pg_get_expr(adbin, adrelid) from pg_attrdef
        where adrelid = 'network.network_entity_bindings'::regclass
          and adnum = (select attnum from pg_attribute
            where attrelid = 'network.network_entity_bindings'::regclass and attname = 'created_by')) as created_by_default,
      (select count(*)::int from pg_trigger where tgname in (
        'network_entities_audit', 'network_entity_bindings_audit', 'network_entity_redirects_audit',
        'network_entities_set_updated_at', 'network_entity_bindings_set_updated_at') and tgenabled = 'O') as live_triggers
  `)).rows[0];
  assert.equal(defaults.actor, OPERATOR);
  assert.match(defaults.created_by_default, /network\.request_actor\(\)/);
  assert.equal(defaults.live_triggers, 5);
  const authorityAfter = await authorityRow(db);
  assert.equal(authorityAfter.prosecdef, false);
  assert.equal(authorityAfter.owner, authorityBefore.owner);
  assert.equal(authorityAfter.fp, PACKET19_FP);
  console.log('THIS_RUN EXISTING_SIX_BINDINGS_PRESERVED PASS');
  console.log('THIS_RUN NEW_RECEIPTS 9');
  console.log('THIS_RUN FINAL_BINDINGS 15');
  console.log('THIS_RUN CREATED_BY_DEFAULT_EXERCISED PASS');
  console.log('THIS_RUN AUDIT_TRIGGER_CHAIN_EXERCISED PASS');
  console.log(`THIS_RUN PASS remaining forward sequence authority ${authorityBefore.fp} -> ${authorityAfter.fp} owner ${authorityAfter.owner}`);
  console.log('THIS_RUN REMAINING_FORWARD_SEQUENCE PASS');
  return { originalSix, authorityBefore };
}

const sequence = await open(OPERATOR);
try {
  await runRemainingForward(sequence);
} finally {
  await sequence.close();
}

const REVERSE_CLOSERS = [
  ['lender', {
    nmls: 'v23lender.nmls', binding_id: 'v23lender.binding_id',
    network_entity_id: 'v23lender.network_entity_id',
    canonical_public_profile_ref: 'v23lender.canonical_public_profile_ref',
  }, '12-ask-prod-lender-nmls-binding-rollback.sql', row => ({ ...row, nmls: row.source_identifier })],
  ['insurance', {
    jurisdiction: 'v23insurance.jurisdiction', license: 'v23insurance.license',
    binding_id: 'v23insurance.binding_id', network_entity_id: 'v23insurance.network_entity_id',
    canonical_public_profile_ref: 'v23insurance.canonical_public_profile_ref',
  }, '13-ask-prod-insurance-state-license-binding-rollback.sql', row => ({ ...row, license: row.source_identifier })],
  ['investor', {
    crd: 'v23investor.crd', binding_id: 'v23investor.binding_id',
    network_entity_id: 'v23investor.network_entity_id',
    canonical_public_profile_ref: 'v23investor.canonical_public_profile_ref',
  }, '14-ask-prod-investor-crd-binding-rollback.sql', row => ({ ...row, crd: row.source_identifier })],
  ['contractor', {
    external_key: 'v23contractor.external_key', binding_id: 'v23contractor.binding_id',
    network_entity_id: 'v23contractor.network_entity_id',
    canonical_public_profile_ref: 'v23contractor.canonical_public_profile_ref',
  }, '16-ask-prod-contractor-dbpr-binding-rollback.sql', row => ({ ...row, external_key: row.source_identifier })],
  ['senior', {
    ccn: 'v23senior.ccn', binding_id: 'v23senior.binding_id',
    network_entity_id: 'v23senior.network_entity_id',
    canonical_public_profile_ref: 'v23senior.canonical_public_profile_ref',
  }, '17-ask-prod-senior-ccn-binding-rollback.sql', row => ({ ...row, ccn: row.source_identifier })],
];

async function loadReceipt(db, gucs, row) {
  for (const [column, name] of Object.entries(gucs)) {
    await db.query('select set_config($1, $2, false)', [name, String(row[column])]);
  }
}

async function installSavedResearch(db) {
  const fl = receipts.find(row => row.hub === 'insurance' && row.key === 'FL:L106287');
  assert.ok(fl, 'Florida insurance receipt is missing from the seed');
  const userId = '11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users(id) values ($1)', [userId]);
  await db.query(`insert into consumer.consumer_saved_entities
    (user_id, network_entity_id, source_binding_id, identity_resolution_state, source_hub, source_context)
    values ($1::uuid, $2::uuid, $3::uuid, 'accepted', 'insurance', '{"fixture":"local-saved-research"}'::jsonb)`,
    [userId, fl.network_entity_id, fl.binding_id]);
  const savedId = (await db.query('select id from consumer.consumer_saved_entities where user_id = $1::uuid', [userId])).rows[0].id;
  await db.query(`insert into consumer.consumer_projects (user_id, creation_key, name, life_event_type)
    values ($1::uuid, '22222222-2222-4222-8222-222222222222', 'Local insurance research', 'protecting')`, [userId]);
  const projectId = (await db.query('select id from consumer.consumer_projects where user_id = $1::uuid', [userId])).rows[0].id;
  await db.query(`insert into consumer.consumer_project_saved_entities (project_id, saved_entity_id, project_role)
    values ($1, $2, 'compare')`, [projectId, savedId]);
  await db.query(`insert into consumer.consumer_notes
    (user_id, client_request_id, project_id, saved_entity_id, note_type, body)
    values ($1::uuid, '33333333-3333-4333-8333-333333333333', $2, $3, 'research', 'Local fixture note on the Florida license')`,
    [userId, projectId, savedId]);
  await db.exec(`
    create function fixture_only.saved_research_digest() returns text
    language sql security definer set search_path = pg_catalog, consumer, auth as $$
      select md5(convert_to(jsonb_build_object(
        'users', (select count(*) from auth.users),
        'saved', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from consumer.consumer_saved_entities t),
        'projects', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from consumer.consumer_projects t),
        'memberships', (select coalesce(jsonb_agg(to_jsonb(t) order by t.project_id, t.saved_entity_id), '[]'::jsonb)
          from consumer.consumer_project_saved_entities t),
        'notes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from consumer.consumer_notes t)
      )::text, 'UTF8'))
    $$;
    revoke all on function fixture_only.saved_research_digest() from public;
    grant usage on schema fixture_only to ${OPERATOR};
    grant execute on function fixture_only.saved_research_digest() to ${OPERATOR};
  `);
}

async function digest(db) {
  return (await db.query('select fixture_only.saved_research_digest() as digest')).rows[0].digest;
}

async function moveMeta(db) {
  return (await db.query(`
    select
      (select md5(regexp_replace(prosrc, '\\s+', '', 'g')) || ':' || proowner::regrole::text
        from pg_proc where oid = to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)')) as issuer,
      (select md5(regexp_replace(prosrc, '\\s+', '', 'g')) || ':' || proowner::regrole::text
        from pg_proc where oid = to_regprocedure('v23_private.prod_move_binding()')) as resolver,
      (select count(*)::int from network.network_entity_bindings where hub = 'move' and valid_to is null) as open_bindings,
      (select count(*)::int from information_schema.tables
        where table_schema in ('consumer', 'ops', 'network', 'v23_private')
          and table_name ~* '(watch|alert)') as watch_tables
  `)).rows[0];
}

const reverse = new PGlite({ database: 'postgres', loadDataDir: seeded, extensions });
try {
  await installSavedResearch(reverse);
  await reverse.exec(sessionGucs);
  const researchBefore = await digest(reverse);
  const moveBefore = await moveMeta(reverse);
  await reverse.exec(`set session authorization ${OPERATOR}`);
  assert.equal(await digest(reverse), researchBefore);
  await runRemainingForward(reverse);
  assert.equal(await digest(reverse), researchBefore);
  const moveAfterForward = await moveMeta(reverse);
  assert.deepEqual(moveAfterForward, moveBefore);

  await apply(reverse, read('19-ask-prod-network-authority-rollback.sql'), 'packet 19 rollback');
  const restoredAuthority = await authorityRow(reverse);
  assert.equal(restoredAuthority.fp, BASELINE_FP);
  assert.equal(restoredAuthority.owner, OPERATOR);
  await assertPrivilegesRestored(reverse);
  const stillOpen = (await bindingRows(reverse)).filter(row => row.open && row.hub !== 'move');
  assert.equal(stillOpen.length, 15);

  let closedReceipts = 0;
  for (const [hub, gucs, file, shape] of REVERSE_CLOSERS) {
    const rows = (await bindingRows(reverse)).filter(row => row.hub === hub && row.open);
    assert.equal(rows.length, 3, hub);
    for (const row of rows) {
      await loadReceipt(reverse, gucs, shape(row));
      await apply(reverse, read(file), `${hub} rollback ${row.source_identifier}`);
      const updated = (await bindingRows(reverse)).find(item => item.id === row.id);
      assert.equal(updated.open, false);
      assert.equal(updated.binding_status, 'accepted');
      assert.equal(updated.entity_status, 'active');
      closedReceipts += 1;
    }
    console.log(`THIS_RUN ${hub.toUpperCase()}_BINDING_ROLLBACK PASS 3`);
  }
  assert.equal(closedReceipts, 15);
  const moveStillOpen = (await bindingRows(reverse)).filter(row => row.hub === 'move' && row.open);
  assert.equal(moveStillOpen.length, moveBefore.open_bindings);

  await apply(reverse, rollbackSql, 'packet 18 rollback');
  const issuerAfter18 = await snap(reverse);
  assert.notEqual(issuerAfter18.prosrc, null);
  assert.equal(issuerAfter18.prosrc.includes("when 'senior'"), false);
  assert.equal(issuerAfter18.owner, 'myth_v23_foundation');
  await apply(reverse, packet15RollbackSql, 'packet 15 rollback');
  const issuerGone = (await reverse.query(`select to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is null as gone`)).rows[0].gone;
  assert.equal(issuerGone, true);
  await apply(reverse, read('14-ask-prod-investor-context-rollback.sql'), 'investor context rollback');
  const investorGone = (await reverse.query(`select to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)') is null as gone,
    to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is not null as move_remains`)).rows[0];
  assert.equal(investorGone.gone, true);
  assert.equal(investorGone.move_remains, true);
  const authorityEnd = await authorityRow(reverse);
  assert.equal(authorityEnd.fp, BASELINE_FP);
  assert.equal(authorityEnd.owner, OPERATOR);
  await assertPrivilegesRestored(reverse);
  assert.equal(await digest(reverse), researchBefore);
  assert.deepEqual(await moveMeta(reverse), moveBefore);
  console.log('THIS_RUN FULL_REVERSE_ACTUALLY_RERUN YES');
  console.log('THIS_RUN FULL_REVERSE PASS');
  console.log('THIS_RUN SAVED_RESEARCH_PRESERVED PASS');
  console.log('THIS_RUN MOVE_PRESERVED PASS');
  console.log(`THIS_RUN BINDING_RECEIPTS_CLOSED ${closedReceipts}`);
  console.log('THIS_RUN prior ca1a58a harness output is not reused as this proof');
} finally {
  await reverse.close();
}
