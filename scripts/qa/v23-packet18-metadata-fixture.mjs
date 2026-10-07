// Offline reference files only. No connector, credentials, or hosted SQL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const OPERATOR = 'hosted_operator';
const hashes = {
  'operator-evidence.json': 'fd1b5bd77d8d8f50d2249678c355c034a70af14f28b9a59ec9425fc25e67827a',
  'binding-dependency-evidence.json': '809ac10be00402de39b6ecfdde094154fe8ff54a296edaf3f176098a486ea75f',
  'pr262-supplement-20261007-result.json': 'f55eff781e11bb0e5e6a27d95a0abcdad8f0ff18042516a397022c3be0bfd0c1',
  'pr262-supplement-20261007-query.sql': 'f05f94fb46b5309793f4b8e65c1dbdc39153f32354e8ac6d0a1183687347235f',
};
const evidence = {};
for (const [file, hash] of Object.entries(hashes)) {
  const bytes = readFileSync(new URL(`./fixtures/pr262-metadata/${file}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
  if (file.endsWith('.json')) evidence[file] = JSON.parse(bytes.toString('utf8'));
}
export const originalOperator = evidence['operator-evidence.json'];
export const originalDependencies = evidence['binding-dependency-evidence.json'];
export const supplement = evidence['pr262-supplement-20261007-result.json'].result.supplement;
const runtime = supplement.b_myth_v23_parent_prod;
const roleName = name => name === 'postgres' ? OPERATOR : name;
const ident = name => '"' + name.replaceAll('"', '""') + '"';
const sorted = rows => [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const acl = rows => [...rows].map(row => row.replace(/\bpostgres\b/g, OPERATOR)).sort();
const member = row => ({ role: row.role, member: roleName(row.member), grantor: roleName(row.grantor),
  admin_option: row.admin_option, inherit_option: row.inherit_option, set_option: row.set_option });
export const observedMemberships = sorted([
  ...originalOperator.relevant_operator_memberships,
  ...runtime.member_of.map(row => ({ ...row, member: runtime.attributes.rolname })),
  ...runtime.members.map(row => ({ ...row, role: runtime.attributes.rolname })),
].map(member));
assert.deepEqual(supplement.a_operator_membership_in_myth_identity_governor.memberships,
  originalOperator.relevant_operator_memberships.filter(row => row.role === 'myth_identity_governor'));

// A non-bootstrap grantor needs ADMIN OPTION to support its dependent grants.
// These two local-only support edges are NOT observations of production.
// Both SET and INHERIT stay false, and packets must never grant these roles.
const supportMemberships = ['myth_v23_authorizer', 'myth_v23_executor'].map(role => ({
  role, member: OPERATOR, grantor: 'postgres', admin_option: true, inherit_option: false, set_option: false,
}));
for (const role of ['myth_identity_governor', 'myth_v23_foundation', 'myth_v23_parent_prod', 'myth_v23_prod_reader']) {
  supportMemberships.push({ role, member: 'supabase_admin', grantor: 'postgres',
    admin_option: true, inherit_option: false, set_option: false });
}

export async function installSupplement(db) {
  await db.exec(`
    create role myth_v23_parent_prod login nosuperuser nobypassrls noinherit
      nocreatedb nocreaterole noreplication connection limit 6 password null;
    alter role myth_v23_parent_prod set statement_timeout = '5s';
    alter role myth_v23_parent_prod set lock_timeout = '3s';
    alter role myth_v23_parent_prod set idle_in_transaction_session_timeout = '10s';
    grant myth_identity_governor, myth_v23_parent_prod to supabase_admin
      with admin true, inherit false, set false;
    grant myth_identity_governor, myth_v23_parent_prod to ${OPERATOR}
      with admin true, inherit false, set false granted by supabase_admin;
    grant myth_v23_authorizer, myth_v23_executor to ${OPERATOR}
      with admin true, inherit false, set false;
    grant myth_v23_authorizer, myth_v23_executor to myth_v23_parent_prod
      with admin false, inherit false, set true granted by ${OPERATOR};
  `);
  // Complete observed schema ACL. Missing grantee identities are inert local
  // placeholders; their production attributes are not provided by the extract.
  for (const entry of supplement.c_consumer_schema.acl) {
    const match = entry.match(/^([^=]+)=(U|UC)\/postgres$/);
    assert.ok(match, `unexpected consumer ACL ${entry}`);
    const name = roleName(match[1]);
    if (!(await db.query('select 1 from pg_roles where rolname=$1', [name])).rows.length) {
      await db.exec(`create role ${ident(name)} nologin nosuperuser nobypassrls noinherit nocreaterole`);
    }
    if (name !== OPERATOR) await db.exec(`grant usage on schema consumer to ${ident(name)}`);
  }
  // The saved-table ACL and own-row policy already come from the migration.
  // Exact comparisons below reject extra grants instead of silently repairing them.
  const password = (await db.query(`select rolpassword is null as absent from pg_authid
    where rolname='myth_v23_parent_prod'`)).rows[0];
  assert.equal(password.absent, true);
  await assertSupplement(db);
}

export async function metadataSnapshot(db) {
  const attributes = (await db.query(`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,
    rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil is not null as rolvaliduntil_set,rolconfig
    from pg_roles where rolname='myth_v23_parent_prod'`)).rows[0];
  const memberships = (await db.query(`select r.rolname as role,m.rolname as member,g.rolname as grantor,
    a.admin_option,a.inherit_option,a.set_option from pg_auth_members a
    join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor
    where m.rolname in ('${OPERATOR}','myth_v23_parent_prod','supabase_admin') or r.rolname='myth_v23_parent_prod'
    order by r.rolname,m.rolname,g.rolname`)).rows.map(row => ({
      role: row.role, member: row.member, grantor: row.grantor,
      admin_option: row.admin_option, inherit_option: row.inherit_option, set_option: row.set_option,
    }));
  const schema = (await db.query(`select nspname,nspowner::regrole::text as owner,nspacl::text[] as acl,
    has_schema_privilege('${OPERATOR}',oid,'USAGE') as operator_usage,
    has_schema_privilege('${OPERATOR}',oid,'CREATE') as operator_create
    from pg_namespace where nspname='consumer'`)).rows[0];
  const saved = (await db.query(`select 'consumer.consumer_saved_entities' as relation,
    relowner::regrole::text as owner,relacl::text[] as acl,relrowsecurity,relforcerowsecurity,
    has_table_privilege('${OPERATOR}',oid,'SELECT') as operator_select,
    has_table_privilege('${OPERATOR}',oid,'INSERT') as operator_insert,
    has_table_privilege('${OPERATOR}',oid,'UPDATE') as operator_update,
    has_table_privilege('${OPERATOR}',oid,'DELETE') as operator_delete,
    (select array_agg(polname::text order by polname) from pg_policy where polrelid=c.oid) as policy_names
    from pg_class c where oid='consumer.consumer_saved_entities'::regclass`)).rows[0];
  const policies = (await db.query(`select polname,polcmd,polpermissive,
    array(select rolname from pg_roles where oid=any(polroles) order by rolname) as roles,
    pg_get_expr(polqual,polrelid) as qual,pg_get_expr(polwithcheck,polrelid) as with_check
    from pg_policy where polrelid='consumer.consumer_saved_entities'::regclass order by polname`)).rows;
  const schemas = (await db.query(`select nspname,nspowner::regrole::text as owner,
    array(select x from unnest(nspacl::text[]) x order by x) as acl from pg_namespace
    where nspname in ('consumer','network','ops','v23_private') order by nspname`)).rows;
  return { attributes: { ...attributes, rolconfig: [...attributes.rolconfig].sort() }, memberships: sorted(memberships),
    schema: { ...schema, acl: [...schema.acl].sort() }, saved: { ...saved, acl: [...saved.acl].sort() }, policies, schemas };
}

export async function assertSupplement(db) {
  const actual = await metadataSnapshot(db);
  assert.deepEqual(actual.attributes, { ...runtime.attributes, rolconfig: [...runtime.attributes.rolconfig].sort() });
  assert.deepEqual(actual.memberships, sorted([...observedMemberships, ...supportMemberships]));
  assert.deepEqual(actual.schema, { ...supplement.c_consumer_schema,
    owner: roleName(supplement.c_consumer_schema.owner), acl: acl(supplement.c_consumer_schema.acl) });
  assert.deepEqual(actual.saved, { ...supplement.d_consumer_saved_entities,
    owner: roleName(supplement.d_consumer_saved_entities.owner), acl: acl(supplement.d_consumer_saved_entities.acl) });
  assert.equal(actual.policies.length, 1);
  const policy = actual.policies[0];
  assert.equal(policy.polname, 'consumer_saved_entities_select_own');
  assert.equal(policy.polcmd, 'r');
  assert.equal(policy.polpermissive, true);
  assert.deepEqual(policy.roles, ['authenticated']);
  assert.match(policy.qual, /SELECT auth\.uid\(\).*user_id/s);
  assert.equal(policy.with_check, null);
  return actual;
}

export async function assertOperatorPath(db) {
  const row = (await db.query(`select session_user,current_user,
    (select rolsuper from pg_roles where rolname=current_user) as superuser,
    pg_has_role(current_user,'myth_identity_governor','SET') as governor_set,
    pg_has_role(current_user,'myth_identity_governor','USAGE') as governor_inherit,
    pg_has_role(current_user,'myth_v23_parent_prod','SET') as runtime_set,
    pg_has_role(current_user,'myth_v23_parent_prod','USAGE') as runtime_inherit`)).rows[0];
  assert.deepEqual(row, { session_user: OPERATOR, current_user: OPERATOR, superuser: false,
    governor_set: false, governor_inherit: false, runtime_set: false, runtime_inherit: false });
}

// No normalization of production data or policy definitions: the supplement
// records policy names only. We preserve the migration's existing own-row body.
