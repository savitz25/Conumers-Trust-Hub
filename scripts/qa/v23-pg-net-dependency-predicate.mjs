// Disposable embedded PostgreSQL only. No hosted connection and no durable objects.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = 'docs/my-trusthub/v2/final-parent-wiring/';
const readSql = (name) => readFileSync(root + name, 'utf8');
const guard = "case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) ~* '(net\\s*\\.|pg_net|supabase_functions\\s*\\.\\s*http_request)' else false end";
const ownedEdges = [
  ['column method of table net.http_request_queue', 'type net.http_method'],
  ['column response of composite type net.http_response_result', 'type net.http_response'],
  ['column status of composite type net.http_response_result', 'type net.request_status'],
];

const extensionSql = `
create schema net;
create domain net.http_method as text
  check (value ilike 'get' or value ilike 'post' or value ilike 'delete');
create unlogged table net.http_request_queue(
  id bigserial,
  method net.http_method not null,
  url text not null,
  headers jsonb,
  body bytea,
  timeout_milliseconds int not null
);
create unlogged table net._http_response(
  id bigint,
  status_code integer,
  content_type text,
  headers jsonb,
  content text,
  timed_out bool,
  error_msg text,
  created timestamptz not null default now()
);
create index on net._http_response (created);
create type net.request_status as enum ('PENDING', 'SUCCESS', 'ERROR');
create type net.http_response as (
  status_code integer,
  headers jsonb,
  body text
);
create type net.http_response_result as (
  status net.request_status,
  message text,
  response net.http_response
);
create function net._http_collect_response(request_id bigint, async bool default true)
returns net.http_response_result language plpgsql as $fn$
declare rec net._http_response;
begin
  select * into rec from net._http_response where id = request_id;
  if rec is null or rec.error_msg is not null then
    return ('ERROR', coalesce(rec.error_msg, 'missing'), null)::net.http_response_result;
  end if;
  return ('SUCCESS', 'ok', (rec.status_code, rec.headers, rec.content)::net.http_response)::net.http_response_result;
end
$fn$;
`;

const legacyPredicate = `
select pg_describe_object(dependent.classid, dependent.objid, dependent.objsubid) as dependent,
       pg_describe_object(dependent.refclassid, dependent.refobjid, dependent.refobjsubid) as referenced
from pg_extension ext
join pg_depend member on member.refclassid='pg_extension'::regclass and member.refobjid=ext.oid and member.deptype='e'
join pg_depend dependent on dependent.refclassid=member.classid and dependent.refobjid=member.objid
where ext.extname='pg_net' and dependent.deptype='n'
  and not exists(select 1 from pg_depend own where own.classid=dependent.classid and own.objid=dependent.objid
    and own.refclassid='pg_extension'::regclass and own.refobjid=ext.oid and own.deptype='e')
`;

function predicateBody(sql) {
  const match = sql.match(/if exists\((select 1 from pg_extension ext[\s\S]*)\) then\r?\n\s*raise exception 'External catalog dependency would make DROP EXTENSION unsafe'/);
  assert.ok(match, 'external-dependency predicate missing');
  return match[1].replaceAll('\r\n', '\n');
}

function listSql(body) {
  return body.replace(/^select 1/, `select pg_describe_object(dependent.classid, dependent.objid, dependent.objsubid) as dependent,
       pg_describe_object(dependent.refclassid, dependent.refobjid, dependent.refobjsubid) as referenced`);
}

async function installExtension(db, script) {
  const share = (await db.query("select setting from pg_config where name='SHAREDIR'")).rows[0].setting;
  db.Module.FS.writeFile(share + '/extension/pg_net.control', "comment='LOCAL FIXTURE'\ndefault_version='0.20.4'\nrelocatable=false\nsuperuser=true\n");
  db.Module.FS.writeFile(share + '/extension/pg_net--0.20.4.sql', script);
  await db.exec('create extension pg_net');
}

async function clearTx(db) {
  try { await db.exec('rollback'); } catch { /* no aborted transaction */ }
}

async function flags(db, body) {
  return (await db.query(listSql(body))).rows;
}

function hasEdge(rows, dependent, referenced) {
  return rows.some((row) => row.dependent === dependent && row.referenced === referenced);
}

export async function assertPgNetDependencyPredicate() {
  const preflight = readSql('pg-net-preflight.sql');
  const disable = readSql('pg-net-disable.sql');
  const preflightPredicate = predicateBody(preflight);
  const disablePredicate = predicateBody(disable);
  assert.equal(preflightPredicate, disablePredicate);
  assert.equal(preflight.split(guard).length - 1, 2);
  assert.equal(disable.split(guard).length - 1, 2);
  assert.doesNotMatch(preflightPredicate, /nspname|cascade|\bnet\.|schema\s*'net'/i);
  assert.doesNotMatch(disablePredicate, /nspname|cascade|\bnet\.|schema\s*'net'/i);
  assert.match(preflightPredicate, /dependent\.deptype='n'/);
  assert.match(preflightPredicate, /owned_parent\.objsubid=0/);
  assert.match(preflightPredicate, /internal_rel\.deptype='i'/);
  assert.match(preflightPredicate, /composite_type\.typtype='c'/);
  assert.doesNotMatch(preflight, /drop\s+extension\s+pg_net\s+cascade/i);
  assert.doesNotMatch(disable, /drop\s+extension\s+pg_net\s+cascade/i);
  assert.doesNotMatch(preflightPredicate, /\b\d{5,}\b/);

  const db = new PGlite();
  try {
    const aggregates = await db.query(`select count(*)::int aggregates,
      count(*) filter (where ${guard})::int hits
      from pg_proc p where p.prokind='a'`);
    assert.ok(aggregates.rows[0].aggregates > 0);
    assert.equal(aggregates.rows[0].hits, 0);
    const arrayAgg = await db.query(`select ${guard} as hit from pg_proc p where p.proname='array_agg' and p.prokind='a'`);
    assert.ok(arrayAgg.rows.length > 0);
    assert.ok(arrayAgg.rows.every((row) => row.hit === false));
    await assert.rejects(
      db.query("select pg_get_functiondef(p.oid) from pg_proc p where p.proname='array_agg' and p.prokind='a' limit 1"),
      (error) => error.code === '42809' || /42809|aggregate function/i.test(String(error.message)),
    );
    console.log('PASS array_agg guarded scan does not raise 42809');

    await installExtension(db, extensionSql);
    await db.exec("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false), set_config('v23.pg_net_disable_authorized','true',false)");
    const present = await db.query(`select pg_describe_object(d.classid, d.objid, d.objsubid) as dependent,
      pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as referenced,
      exists(select 1 from pg_depend own where own.classid=d.classid and own.objid=d.objid and own.objsubid=d.objsubid
        and own.refclassid='pg_extension'::regclass and own.deptype='e') as exact_triple_member,
      exists(select 1 from pg_depend own where own.classid=d.classid and own.objid=d.objid and own.objsubid=0
        and own.refclassid='pg_extension'::regclass and own.deptype='e') as parent_member
      from pg_depend d where d.deptype='n'`);
    for (const [dependent, referenced] of ownedEdges) {
      const edge = present.rows.find((row) => row.dependent === dependent && row.referenced === referenced);
      assert.ok(edge, `missing extension edge ${dependent} -> ${referenced}`);
      assert.equal(edge.exact_triple_member, false);
    }
    assert.equal(present.rows.find((row) => row.dependent === ownedEdges[0][0]).parent_member, true);
    const legacy = await db.query(legacyPredicate);
    assert.ok(hasEdge(legacy.rows, ownedEdges[1][0], ownedEdges[1][1]));
    assert.ok(hasEdge(legacy.rows, ownedEdges[2][0], ownedEdges[2][1]));
    assert.equal(hasEdge(legacy.rows, ownedEdges[0][0], ownedEdges[0][1]), false);
    assert.ok(legacy.rows.some((row) => row.dependent === 'default value for column id of table net.http_request_queue'));

    assert.deepEqual(await flags(db, preflightPredicate), []);
    assert.deepEqual(await flags(db, disablePredicate), []);
    const passed = await db.exec(preflight);
    assert.ok(passed.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    console.log('PASS extension-owned subobjects are not external');

    await db.exec(`create function public.app_uses_net(s net.request_status) returns net.http_response
      language sql as 'select null::net.http_response'`);
    assert.ok((await flags(db, preflightPredicate)).some((row) => row.dependent === 'function app_uses_net(net.request_status)'));
    await assert.rejects(db.exec(preflight), /Application-owned function depends on pg_net/);
    await clearTx(db);
    await db.exec('drop function public.app_uses_net(net.request_status)');
    await db.exec(`create table public.app_user(method net.http_method);
      create table public.app_seq(id bigint default nextval('net.http_request_queue_id_seq'));
      create table net.shadow_queue(method net.http_method);
      create table net.plain_app(id int);
      create type public.app_result as (status net.request_status);
      create type net.shadow_result as (status net.request_status, response net.http_response)`);
    const external = await flags(db, preflightPredicate);
    for (const expected of [
      'column method of table app_user',
      'default value for column id of table app_seq',
      'column method of table net.shadow_queue',
      'table net.plain_app',
      'column status of composite type app_result',
      'column status of composite type net.shadow_result',
      'column response of composite type net.shadow_result',
    ]) assert.ok(external.some((row) => row.dependent === expected), `missing external classification ${expected}: ${JSON.stringify(external)}`);
    for (const [dependent] of ownedEdges) assert.equal(external.some((row) => row.dependent === dependent), false);
    assert.equal(external.some((row) => row.dependent === 'default value for column id of table net.http_request_queue'), false);
    await assert.rejects(db.exec(preflight), /External catalog dependency would make DROP EXTENSION unsafe/);
    await clearTx(db);
    await assert.rejects(db.exec(disable), /External catalog dependency would make DROP EXTENSION unsafe/);
    await clearTx(db);
    assert.equal((await db.query("select count(*)::int n from pg_extension where extname='pg_net'")).rows[0].n, 1);
    await db.exec(`drop type public.app_result; drop type net.shadow_result;
      drop table public.app_user; drop table public.app_seq; drop table net.shadow_queue; drop table net.plain_app`);
    assert.deepEqual(await flags(db, preflightPredicate), []);
    const again = await db.exec(preflight);
    assert.ok(again.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    console.log('PASS true external dependency is still rejected');

    const disabled = await db.exec(disable);
    assert.ok(disabled.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_DISABLE_PASS')));
    assert.equal((await db.query("select to_regnamespace('net') is null and not exists(select 1 from pg_extension where extname='pg_net') done")).rows[0].done, true);
  } finally {
    await db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertPgNetDependencyPredicate().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
