// Disposable embedded PostgreSQL only. No hosted connection and no durable objects.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = 'docs/my-trusthub/v2/final-parent-wiring/';
const readSql = (name) => readFileSync(root + name, 'utf8');
const guard = "case when p.prokind in ('f','p','w') then pg_get_functiondef(p.oid) ~* '(net\\s*\\.|pg_net|supabase_functions\\s*\\.\\s*http_request)' else false end";
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

function closureSlice(sql) {
  const match = sql.match(/-- V23_PG_NET_OWNERSHIP_CLOSURE_START\r?\n([\s\S]*?)-- V23_PG_NET_OWNERSHIP_CLOSURE_END/);
  assert.ok(match, 'ownership closure block missing');
  return match[1].replaceAll('\r\n', '\n');
}

/** The trigger/webhook, cron and application-routine predicates must be textually
 * identical in preflight and disable; only exception wording may differ. */
function dependencyPredicates(sql) {
  const text = sql.replaceAll('\r\n', '\n');
  const trigger = text.match(/if exists\((select 1 from pg_trigger[\s\S]*?)\) then\n\s*raise exception 'Database webhook/);
  const cron = text.match(/(if to_regclass\('cron\.job'\) is not null then\n[\s\S]*?end if;)/);
  const routine = text.match(/if exists\((select 1 from pg_proc p join pg_namespace n on n\.oid=p\.pronamespace\n\s*where n\.nspname in \('public'[\s\S]*?)\) then\n\s*raise exception 'Application-owned function depends on pg_net'/);
  assert.ok(trigger && cron && routine, 'Gate 1 dependency predicates missing');
  return [trigger[1], cron[1], routine[1]].map((p) => p.replace(/\s+/g, ' ').trim());
}

function checkOnly(sql) {
  const cut = sql.search(/\r?\ndrop extension pg_net;/);
  return cut === -1 ? sql : sql.slice(0, cut) + '\nrollback;\n';
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

function hasEdge(rows, dependent, referenced) {
  return rows.some((row) => row.dependent === dependent && row.referenced === referenced);
}

async function expectBlock(db, sql, pattern) {
  let message = '';
  try {
    await db.exec(sql);
  } catch (error) {
    message = String(error?.message || error);
  }
  await clearTx(db);
  assert.match(message, pattern);
}

export async function assertPgNetDependencyPredicate() {
  const preflight = readSql('pg-net-preflight.sql');
  const disable = readSql('pg-net-disable.sql');
  const alreadyAbsent = readSql('pg-net-already-absent.sql');
  const postcheck = readSql('pg-net-postcheck.sql');
  const preflightClosure = closureSlice(preflight);
  const disableClosure = closureSlice(disable);
  assert.equal(preflightClosure, disableClosure);
  assert.equal(preflight.split(guard).length - 1, 2);
  assert.equal(disable.split(guard).length - 1, 2);
  assert.equal(preflight.includes("prokind in ('f','p')"), false);
  assert.equal(disable.includes("prokind in ('f','p')"), false);
  assert.deepEqual(dependencyPredicates(preflight), dependencyPredicates(disable));
  assert.deepEqual(dependencyPredicates(alreadyAbsent), dependencyPredicates(preflight));
  assert.doesNotMatch(alreadyAbsent, /select\s+'V23_PG_NET_DISABLE_PASS'/i);
  assert.doesNotMatch(alreadyAbsent, /select\s+'V23_PG_NET_PREFLIGHT_PASS'/i);
  assert.doesNotMatch(alreadyAbsent, /drop\s+(extension|schema)/i);
  assert.doesNotMatch(alreadyAbsent, /create\s+extension/i);
  assert.equal(dependencyPredicates(preflight).length, 3);
  assert.match(preflightClosure, /deptype in \('i','a','x','P','S'\)/);
  assert.match(preflightClosure, /while expand_at<=c_n/);
  assert.match(preflightClosure, /d\.refobjsubid=c_sub\[expand_at\]/);
  assert.match(preflightClosure, /d\.refobjsubid>0/);
  assert.match(preflightClosure, /d\.objsubid>0/);
  assert.match(preflightClosure, /Object in schema net is outside pg_net ownership closure/);
  assert.doesNotMatch(preflightClosure, /nspname\s*(<>|!=)/i);
  assert.doesNotMatch(preflightClosure, /deptype\s*(<>|!=)\s*'n'/i);
  assert.doesNotMatch(preflightClosure, /http_request_queue|http_response_result|http_method/);
  assert.doesNotMatch(preflightClosure.replaceAll('100000', ''), /\b\d{5,}\b/);
  assert.doesNotMatch(preflight, /drop\s+(extension|schema)[^;]*\bcascade\b/i);
  assert.doesNotMatch(disable, /drop\s+(extension|schema)[^;]*\bcascade\b/i);
  assert.match(disable, /drop extension pg_net;/);

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
    await db.exec(`
      create function public.sum_sfunc(state integer, value integer) returns integer
      language sql immutable as 'select coalesce(state, 0) + coalesce(value, 0)';
      create aggregate public.array_agg(integer) (sfunc = public.sum_sfunc, stype = integer);
    `);
    console.log('PASS I array_agg guarded scan does not raise 42809');

    await installExtension(db, extensionSql);
    await db.exec("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false), set_config('v23.pg_net_disable_authorized','true',false)");
    const queueMember = await db.query(`select exists(
      select 1 from pg_depend own
      where own.classid='pg_class'::regclass and own.objid='net.http_request_queue'::regclass and own.objsubid=0
        and own.refclassid='pg_extension'::regclass and own.deptype='e') as member`);
    assert.equal(queueMember.rows[0].member, true);
    const backing = await db.query(`select exists(
      select 1 from pg_type t
      join pg_class c on c.oid=t.typrelid and c.relkind='c'
      join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.objsubid=0
        and d.refclassid='pg_type'::regclass and d.refobjid=t.oid and d.deptype='i'
      where t.typname='http_response_result') as internal`);
    assert.equal(backing.rows[0].internal, true);
    const legacy = await db.query(legacyPredicate);
    assert.equal(hasEdge(legacy.rows, ownedEdges[0][0], ownedEdges[0][1]), false);
    assert.ok(hasEdge(legacy.rows, ownedEdges[1][0], ownedEdges[1][1]));
    assert.ok(hasEdge(legacy.rows, ownedEdges[2][0], ownedEdges[2][1]));
    assert.ok(legacy.rows.some((row) => row.dependent === 'default value for column id of table net.http_request_queue'));
    const impl = await db.query(`select
      exists(select 1 from pg_class where oid='net.http_request_queue'::regclass and reltoastrelid<>0) as toast,
      exists(select 1 from pg_class seq join pg_namespace n on n.oid=seq.relnamespace
        where n.nspname='net' and seq.relkind='S') as sequence,
      exists(select 1 from pg_class idx join pg_namespace n on n.oid=idx.relnamespace
        where n.nspname='net' and idx.relkind='i') as index,
      exists(select 1 from pg_attrdef where adrelid='net.http_request_queue'::regclass) as attrdef`);
    assert.equal(impl.rows[0].toast, true);
    assert.equal(impl.rows[0].sequence, true);
    assert.equal(impl.rows[0].index, true);
    assert.equal(impl.rows[0].attrdef, true);

    const passed = await db.exec(preflight);
    assert.ok(passed.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    const disableCheck = await db.exec(checkOnly(disable));
    assert.equal(disableCheck.some((result) => String(result.rows || '').includes('V23_PG_NET_DISABLE')), false);
    console.log('PASS E direct member column accepted');
    console.log('PASS F internal composite columns accepted');
    console.log('PASS G toast, index, default, and owned sequence accepted');

    await db.exec('create table public.app_user(method net.http_method)');
    await expectBlock(db, preflight, /External catalog dependency would make DROP EXTENSION unsafe:[\s\S]*column method of table app_user/);
    await expectBlock(db, checkOnly(disable), /External catalog dependency would make DROP EXTENSION unsafe:[\s\S]*column method of table app_user/);
    await db.exec('drop table public.app_user');
    console.log('PASS A external table using a net type blocked');

    await db.exec(`create function public.sql_depends_on_net(m net.http_method) returns text language sql as 'select m::text'`);
    const catalogEdge = await db.query(`select exists(
      select 1 from pg_depend d
      join pg_extension e on e.extname='pg_net'
      join pg_depend member on member.refclassid='pg_extension'::regclass and member.refobjid=e.oid
        and member.deptype='e' and member.classid=d.refclassid and member.objid=d.refobjid
      where d.classid='pg_proc'::regclass
        and d.objid='public.sql_depends_on_net(net.http_method)'::regprocedure
        and d.deptype='n') as recorded`);
    assert.equal(catalogEdge.rows[0].recorded, true);
    const catalogScript = preflight.replace(
      /if exists\(select 1 from pg_proc p join pg_namespace n on n\.oid=p\.pronamespace\r?\n\s*where n\.nspname in \('public','auth','consumer','network','ops','v23_private'\)\r?\n\s*and case when p\.prokind in \('f','p','w'\) then pg_get_functiondef\(p\.oid\) ~\* '\(net\\s\*\\\.\|pg_net\|supabase_functions\\s\*\\\.\\s\*http_request\)' else false end\) then\r?\n\s*raise exception 'Application-owned function depends on pg_net'; end if;\r?\n/,
      '',
    );
    assert.notEqual(catalogScript, preflight);
    await expectBlock(db, catalogScript, /External catalog dependency would make DROP EXTENSION unsafe:[\s\S]*function sql_depends_on_net\(net\.http_method\)/);
    await db.exec('drop function public.sql_depends_on_net(net.http_method)');
    console.log('PASS B external SQL function catalog dependency blocked');

    await db.exec(`create function public.plpgsql_mentions_net() returns void language plpgsql as $fn$
      begin raise notice 'net.http_get'; end $fn$`);
    const bodyEdge = await db.query(`select exists(
      select 1 from pg_depend d
      where d.classid='pg_proc'::regclass and d.objid='public.plpgsql_mentions_net()'::regprocedure and d.deptype='n'
        and d.refclassid='pg_extension'::regclass) as recorded`);
    assert.equal(bodyEdge.rows[0].recorded, false);
    await expectBlock(db, preflight, /Application-owned function depends on pg_net/);
    await db.exec('drop function public.plpgsql_mentions_net()');
    console.log('PASS C scanned-schema PL/pgSQL body blocked');

    // Hosted 42809 reproduction: the guarded scan must run over aggregates in a
    // watched schema without raising and without a false dependency, while the
    // same scan still finds a real routine body. The raw call proves the guard is
    // necessary rather than an error being swallowed.
    await assert.rejects(
      db.query("select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='a'"),
      (error) => error.code === '42809' || /aggregate function/i.test(String(error.message)),
    );
    const publicAggregates = await db.query(`select count(*)::int aggregates, count(*) filter (where ${guard})::int hits
      from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='a'`);
    assert.ok(publicAggregates.rows[0].aggregates > 0);
    assert.equal(publicAggregates.rows[0].hits, 0);
    console.log('PASS J aggregate in watched schema: no 42809, no false dependency');

    await db.exec(`create function public.net_sfunc(state integer, value integer) returns integer
      language sql immutable as $fn$ select coalesce(state, 0) + coalesce(value, 0) + length('net.http_post') $fn$;
      create aggregate public.net_total(integer) (sfunc = public.net_sfunc, stype = integer)`);
    await expectBlock(db, preflight, /Application-owned function depends on pg_net/);
    await expectBlock(db, checkOnly(disable), /Application-owned function depends on pg_net/);
    await db.exec('drop aggregate public.net_total(integer); drop function public.net_sfunc(integer, integer)');
    console.log('PASS K aggregate transition function body still blocked');

    await db.exec(`create procedure public.proc_mentions_net() language plpgsql as $fn$
      begin raise notice 'net.http_post'; end $fn$`);
    await expectBlock(db, preflight, /Application-owned function depends on pg_net/);
    await expectBlock(db, checkOnly(disable), /Application-owned function depends on pg_net/);
    await db.exec('drop procedure public.proc_mentions_net()');
    console.log('PASS L procedure body blocked');

    await db.exec("create function public.window_fixture() returns bigint language internal window as 'window_row_number'");
    const windowRows = await db.query(`select p.prokind, ${guard} as hit, pg_get_functiondef(p.oid) is not null as inspected
      from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='w'`);
    assert.equal(windowRows.rows.length, 1);
    assert.equal(windowRows.rows[0].hit, false);
    assert.equal(windowRows.rows[0].inspected, true);
    const withWindow = await db.exec(preflight);
    assert.ok(withWindow.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    await db.exec('drop function public.window_fixture()');
    console.log('PASS M window function inspected without error or false dependency');

    await db.exec(`create table public.trigger_target(id int);
      create function public.trigger_mentions_net() returns trigger language plpgsql as $fn$
      begin perform 'net.http_post'; return null; end $fn$;
      create trigger trigger_target_net after insert on public.trigger_target
      for each row execute function public.trigger_mentions_net()`);
    await expectBlock(db, preflight, /Database webhook or non-internal trigger depends on pg_net/);
    await expectBlock(db, checkOnly(disable), /Database webhook or trigger depends on pg_net/);
    await db.exec('drop trigger trigger_target_net on public.trigger_target; drop function public.trigger_mentions_net()');
    await db.exec(`create schema supabase_functions;
      create function supabase_functions.http_request() returns trigger language plpgsql as $fn$
      begin return null; end $fn$;
      create trigger trigger_target_webhook after insert on public.trigger_target
      for each row execute function supabase_functions.http_request()`);
    await expectBlock(db, preflight, /Database webhook or non-internal trigger depends on pg_net/);
    await expectBlock(db, checkOnly(disable), /Database webhook or trigger depends on pg_net/);
    await db.exec('drop trigger trigger_target_webhook on public.trigger_target; drop schema supabase_functions cascade; drop table public.trigger_target');
    console.log('PASS N trigger body and webhook entry point blocked');

    await db.exec(`create schema cron; create table cron.job(jobid bigint, command text);
      insert into cron.job values (1, 'select net.http_post(''https://example.invalid'')')`);
    await expectBlock(db, preflight, /Scheduled job depends on pg_net/);
    await expectBlock(db, checkOnly(disable), /Scheduled job depends on pg_net/);
    await db.exec("update cron.job set command='select 1'");
    const cronClean = await db.exec(preflight);
    assert.ok(cronClean.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    await db.exec('drop schema cron cascade');
    console.log('PASS O scheduled job dependency blocked');

    await db.exec('create table net.user_owned(id int)');
    await expectBlock(db, preflight, /table net\.user_owned/);
    await db.exec(`delete from pg_depend
      where classid='pg_class'::regclass and objid='net.user_owned'::regclass
        and deptype='n'`);
    await expectBlock(db, preflight, /Object in schema net is outside pg_net ownership closure:[\s\S]*table net\.user_owned/);
    await db.exec('drop table net.user_owned');
    console.log('PASS D user object inside schema net blocked');

    await db.exec('create table public.column_target(id int)');
    await db.exec(`insert into pg_depend(classid, objid, objsubid, refclassid, refobjid, refobjsubid, deptype)
      select 'pg_class'::regclass, 'public.column_target'::regclass, 0,
             'pg_class'::regclass, 'net.http_request_queue'::regclass, att.attnum, 'n'
      from pg_attribute att
      where att.attrelid='net.http_request_queue'::regclass and att.attname='method' and att.attnum>0`);
    const columnEdge = await db.query(`select d.refobjsubid from pg_depend d
      where d.classid='pg_class'::regclass and d.objid='public.column_target'::regclass and d.deptype='n' and d.refobjsubid>0`);
    assert.ok(columnEdge.rows[0].refobjsubid > 0);
    await expectBlock(db, preflight, /table column_target depends on column method of table net\.http_request_queue/);
    await db.exec(`delete from pg_depend
      where classid='pg_class'::regclass and objid='public.column_target'::regclass and refobjsubid>0`);
    await db.exec('drop table public.column_target');
    console.log('PASS H dependency on one extension-owned column blocked');

    await db.exec(`insert into pg_depend(classid, objid, objsubid, refclassid, refobjid, refobjsubid, deptype)
      select 'pg_class'::regclass, idx.oid, 0, 'pg_type'::regclass, 'net.http_method'::regtype, 0, 'n'
      from pg_class queue
      join pg_class toast on toast.oid=queue.reltoastrelid
      join pg_index ix on ix.indrelid=toast.oid
      join pg_class idx on idx.oid=ix.indexrelid
      where queue.oid='net.http_request_queue'::regclass
      limit 1`);
    const hop = await db.query(`select idx.relname,
      exists(select 1 from pg_depend e where e.classid='pg_class'::regclass and e.objid=idx.oid and e.objsubid=0
        and e.refclassid='pg_extension'::regclass and e.deptype='e') as direct_member,
      exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=idx.oid and d.objsubid=0
        and d.refclassid='pg_class'::regclass and d.refobjid=toast.oid and d.deptype in ('i','a')) as second_hop
      from pg_class queue
      join pg_class toast on toast.oid=queue.reltoastrelid
      join pg_index ix on ix.indrelid=toast.oid
      join pg_class idx on idx.oid=ix.indexrelid
      where queue.oid='net.http_request_queue'::regclass
      limit 1`);
    assert.equal(hop.rows[0].direct_member, false);
    assert.equal(hop.rows[0].second_hop, true);
    const stillOwned = await db.exec(preflight);
    assert.ok(stillOwned.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    await db.exec(`delete from pg_depend d
      using pg_class queue, pg_class toast, pg_index ix, pg_class idx
      where queue.oid='net.http_request_queue'::regclass and toast.oid=queue.reltoastrelid
        and ix.indrelid=toast.oid and idx.oid=ix.indexrelid
        and d.classid='pg_class'::regclass and d.objid=idx.oid and d.refobjid='net.http_method'::regtype and d.deptype='n'`);
    console.log('PASS G two-hop toast index remains inside the closure');

    const clean = await db.exec(preflight);
    assert.ok(clean.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_PREFLIGHT_PASS')));
    assert.equal((await db.query("select count(*)::int n from pg_extension where extname='pg_net'")).rows[0].n, 1);
    console.log('PASS closure restored and extension still present');
    await expectBlock(db, alreadyAbsent, /Already-absent path refuses installed pg_net/);
    console.log('PASS installed baseline rejected by already-absent');
  } finally {
    await db.close();
  }

  const absent = new PGlite();
  try {
    await absent.exec("select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false)");
    await expectBlock(absent, alreadyAbsent, /attestation required/);
    await absent.exec("select set_config('v23.approved_project','xkkiicsassizmakcvxml',false)");
    const absentPass = await absent.exec(alreadyAbsent);
    assert.ok(absentPass.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_ALREADY_ABSENT_PASS')));
    assert.equal(JSON.stringify(absentPass).includes('V23_PG_NET_DISABLE_PASS'), false);
    const absentPost = await absent.exec(postcheck);
    assert.ok(absentPost.some((result) => result.rows?.some((row) => row.result === 'V23_PG_NET_ABSENT_PASS')));
    console.log('PASS fully absent baseline');

    await absent.exec('create schema net');
    await expectBlock(absent, alreadyAbsent, /schema net remains/);
    await absent.exec('create function net.http_get(url text, headers jsonb, params jsonb, timeout integer) returns bigint language sql as $$ select 1 $$');
    await expectBlock(absent, alreadyAbsent, /pg_net HTTP routine or relation remains/);
    await absent.exec('drop function net.http_get(text,jsonb,jsonb,integer)');
    await absent.exec('create table net.http_request_queue(id int)');
    await expectBlock(absent, alreadyAbsent, /pg_net HTTP routine or relation remains/);
    await absent.exec('drop table net.http_request_queue');
    await absent.exec('create table net.user_owned(id int)');
    await expectBlock(absent, alreadyAbsent, /Object remains in schema net/);
    await absent.exec('drop schema net cascade');
    console.log('PASS leftover schema, routine, relation, and user object fail closed');

    await absent.exec(`create function public.plpgsql_mentions_net() returns void language plpgsql as $fn$
      begin raise notice 'net.http_get'; end $fn$`);
    await expectBlock(absent, alreadyAbsent, /Application-owned function depends on pg_net/);
    await absent.exec('drop function public.plpgsql_mentions_net()');
    const extensionWithoutQueue = extensionSql.replace(
      /create unlogged table net\.http_request_queue\([\s\S]*?\);\n/,
      '',
    );
    assert.notEqual(extensionWithoutQueue, extensionSql);
    await installExtension(absent, extensionWithoutQueue);
    await expectBlock(absent, preflight, /queue\/response relations missing/);
    await expectBlock(absent, alreadyAbsent, /Already-absent path refuses installed pg_net/);
    await absent.exec('drop extension pg_net');
    console.log('PASS extension present with missing queue fails both paths');
    await installExtension(absent, extensionSql);
    await absent.exec('create table public.app_user(method net.http_method)');
    await expectBlock(absent, alreadyAbsent, /Already-absent path refuses installed pg_net|Application-owned function depends on pg_net|External catalog dependency/);
    await expectBlock(absent, preflight, /External catalog dependency would make DROP EXTENSION unsafe/);
    console.log('PASS installed external dependency fails closed');
  } finally {
    await absent.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertPgNetDependencyPredicate().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
