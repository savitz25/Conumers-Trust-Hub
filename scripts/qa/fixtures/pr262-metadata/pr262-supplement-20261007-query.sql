-- PR #262 C-B1 metadata supplement. Oct 7 2026 observation. READ ONLY catalog reads only.
begin read only;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
set local row_security = off;
with
sess as (
  select now() as captured_at, clock_timestamp() as clock_ts,
         session_user::text as session_user_name, current_user::text as current_user_name,
         current_setting('transaction_read_only') as transaction_read_only,
         current_setting('row_security') as row_security,
         current_database() as database,
         txid_current_if_assigned() as write_xid_assigned,
         (select rolsuper from pg_roles where rolname = current_user) as op_rolsuper,
         (select rolbypassrls from pg_roles where rolname = current_user) as op_rolbypassrls
),
a_gov as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.rolname, 'member', m.rolname, 'grantor', g.rolname,
    'admin_option', am.admin_option, 'inherit_option', am.inherit_option, 'set_option', am.set_option)), '[]'::jsonb) as v
  from pg_auth_members am
  join pg_roles r on r.oid = am.roleid
  join pg_roles m on m.oid = am.member
  left join pg_roles g on g.oid = am.grantor
  where r.rolname = 'myth_identity_governor' and m.rolname = current_user
),
a_gov_exists as (select to_regrole('myth_identity_governor') is not null as v),
b_role as (
  select coalesce((select jsonb_build_object(
    'rolname', rolname, 'rolsuper', rolsuper, 'rolinherit', rolinherit, 'rolcreaterole', rolcreaterole,
    'rolcreatedb', rolcreatedb, 'rolcanlogin', rolcanlogin, 'rolreplication', rolreplication,
    'rolbypassrls', rolbypassrls, 'rolconnlimit', rolconnlimit,
    'rolvaliduntil_set', rolvaliduntil is not null, 'rolconfig', rolconfig)
    from pg_roles where rolname = 'myth_v23_parent_prod'), 'null'::jsonb) as v
),
b_member_of as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.rolname, 'grantor', g.rolname, 'admin_option', am.admin_option,
    'inherit_option', am.inherit_option, 'set_option', am.set_option) order by r.rolname), '[]'::jsonb) as v
  from pg_auth_members am
  join pg_roles r on r.oid = am.roleid
  left join pg_roles g on g.oid = am.grantor
  where am.member = to_regrole('myth_v23_parent_prod')
),
b_members as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'member', m.rolname, 'grantor', g.rolname, 'admin_option', am.admin_option,
    'inherit_option', am.inherit_option, 'set_option', am.set_option) order by m.rolname), '[]'::jsonb) as v
  from pg_auth_members am
  join pg_roles m on m.oid = am.member
  left join pg_roles g on g.oid = am.grantor
  where am.roleid = to_regrole('myth_v23_parent_prod')
),
c_schema as (
  select coalesce((select jsonb_build_object(
    'nspname', n.nspname, 'owner', pg_get_userbyid(n.nspowner), 'acl', n.nspacl::text[],
    'operator_usage', has_schema_privilege(current_user, n.oid, 'USAGE'),
    'operator_create', has_schema_privilege(current_user, n.oid, 'CREATE'))
    from pg_namespace n where n.nspname = 'consumer'), 'null'::jsonb) as v
),
d_table as (
  select coalesce((select jsonb_build_object(
    'relation', 'consumer.consumer_saved_entities', 'owner', pg_get_userbyid(c.relowner),
    'acl', c.relacl::text[], 'relrowsecurity', c.relrowsecurity, 'relforcerowsecurity', c.relforcerowsecurity,
    'operator_select', has_table_privilege(current_user, c.oid, 'SELECT'),
    'operator_insert', has_table_privilege(current_user, c.oid, 'INSERT'),
    'operator_update', has_table_privilege(current_user, c.oid, 'UPDATE'),
    'operator_delete', has_table_privilege(current_user, c.oid, 'DELETE'),
    'policy_names', (select coalesce(jsonb_agg(polname order by polname), '[]'::jsonb) from pg_policy where polrelid = c.oid))
    from pg_class c where c.oid = to_regclass('consumer.consumer_saved_entities')), 'null'::jsonb) as v
)
select jsonb_build_object(
  'label', 'PR262 C-B1 metadata supplement - Oct 7 2026 observation (separate from Oct 6 extracts)',
  'session', (select to_jsonb(sess) from sess),
  'a_operator_membership_in_myth_identity_governor', jsonb_build_object('role_exists', (select v from a_gov_exists), 'memberships', (select v from a_gov)),
  'b_myth_v23_parent_prod', jsonb_build_object('attributes', (select v from b_role), 'member_of', (select v from b_member_of), 'members', (select v from b_members)),
  'c_consumer_schema', (select v from c_schema),
  'd_consumer_saved_entities', (select v from d_table)
) as supplement;
commit;
