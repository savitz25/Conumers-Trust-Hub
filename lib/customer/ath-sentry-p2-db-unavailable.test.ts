/**
 * ATH-SENTRY-P2 — database-availability failures produce a controlled, sanitized 503; everything else keeps its
 * existing semantics. Runs with an injected fake pool: no Neon, no network, no production dependency.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DbUnavailableError, SERVICE_UNAVAILABLE_BODY, classifyDbError, isDbUnavailableError, serviceUnavailableResponse } from './db-unavailable.ts';
import { runTransaction, type TxClient, type TxPool } from './db-tx.ts';
import { claimAcceptErrorCode, claimSignInErrorMessage, signInLinkErrorCode } from './auth-error-code.ts';

const pgError = (code: string, message = 'x', extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { code, ...extra });
const NEON_QUOTA = pgError('53000', 'FATAL: the account or project has exceeded the quota. Upgrade your plan to increase limits.', { severity: 'FATAL', routine: 'ProcessStartupPacket' });
const HOST_LEAK = 'ep-cool-name-123456.us-east-2.aws.neon.tech';

test('classifier: provider/connectivity failures are unavailable', () => {
  const yes: unknown[] = [
    NEON_QUOTA, pgError('53300', 'too many connections for role'), pgError('08006', 'connection failure'), pgError('08001'), pgError('57P01', 'terminating connection due to administrator command'), pgError('57P03', 'the database system is starting up'),
    Object.assign(new Error(`connect ECONNREFUSED 10.0.0.5:5432`), { code: 'ECONNREFUSED', errno: 'ECONNREFUSED' }), Object.assign(new Error(`getaddrinfo ENOTFOUND ${HOST_LEAK}`), { code: 'ENOTFOUND' }),
    Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }), Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
    new Error('timeout exceeded when trying to connect'), new Error('Connection terminated unexpectedly'), new Error('Connection terminated due to connection timeout'),
    new Error('Connection ended unexpectedly'), new Error('Client has encountered a connection error and is not queryable'),
    Object.assign(new Error('connect ECONNABORTED'), { code: 'ECONNABORTED' }),
    Object.assign(new Error('wrapped'), { cause: pgError('53000', 'exceeded the quota') }),
    new AggregateError([pgError('53300', 'sorry, too many clients already')]),
  ];
  for (const e of yes) assert.equal(classifyDbError(e).unavailable, true, (e as Error).message);
  const c = classifyDbError(NEON_QUOTA); assert.ok(c.unavailable && c.reason === 'sqlstate_53' && c.sqlstate === '53000');
});

test('classifier: application / query defects are NOT unavailable', () => {
  const no: unknown[] = [
    pgError('42601', 'syntax error at or near "SELEC"'), pgError('42P01', 'relation "nope" does not exist'), pgError('42501', 'permission denied for table ath_claims'), pgError('42703', 'column does not exist'),
    pgError('23505', 'duplicate key value violates unique constraint'), pgError('23503', 'foreign key violation'), pgError('23514', 'check constraint'), pgError('22P02', 'invalid input syntax for type uuid'),
    pgError('25P02', 'current transaction is aborted'), pgError('40001', 'could not serialize access'), pgError('40P01', 'deadlock detected'), pgError('28P01', 'password authentication failed'), pgError('28000', 'no pg_hba.conf entry for host'),
    pgError('57014', 'canceling statement due to user request'), pgError('22023', 'invalid parameter value'),
    new Error('row-level security violation'), new TypeError('Cannot read properties of undefined'), Object.assign(new Error('rate_limited'), { code: 'rate_limited' }), 'string error', null, undefined, 42,
    new Error('FATAL: the account or project has exceeded the quota. Upgrade your plan to increase limits.'),
    new Error('remaining connection slots are reserved for non-replication superuser connections'),
    new Error('the database system is starting up'), new Error('the database system is shutting down'), new Error('too many connections for role "web"'),
    new Error('could not connect to server: Connection refused'), new Error('no pg_hba.conf entry for host'),
    new Error('historical: timeout exceeded when trying to connect'),
    Object.assign(new Error('Connection terminated unexpectedly'), { code: '42601' }),
  ];
  for (const e of no) assert.equal(classifyDbError(e).unavailable, false, String((e as Error)?.message ?? e));
});

function fakePool(opts: { connect?: () => Promise<TxClient>; queryImpl?: (text: string) => Promise<unknown> } = {}) {
  const log: string[] = []; let connects = 0; let releases = 0;
  const client: TxClient = { async query(text) { log.push(text.split(' ')[0]); return opts.queryImpl ? opts.queryImpl(text) : { rows: [] }; }, release() { releases += 1; } };
  const pool: TxPool = { async connect() { connects += 1; if (opts.connect) return opts.connect(); return client; } };
  return { pool, log, connects: () => connects, releases: () => releases };
}

test('runTransaction: connection unavailable → DbUnavailableError (phase connect), hook once, no retry', async () => {
  const p = fakePool({ connect: async () => { throw NEON_QUOTA; } }); const seen: DbUnavailableError[] = [];
  await assert.rejects(() => runTransaction(p.pool, async () => 'never', { onUnavailable: (e) => seen.push(e) }), (e: unknown) => e instanceof DbUnavailableError && e.phase === 'connect' && e.sqlstate === '53000');
  assert.equal(p.connects(), 1); assert.equal(seen.length, 1); assert.equal(seen[0].cause, NEON_QUOTA); assert.doesNotMatch(seen[0].message, /quota|neon|Upgrade/);
});

test('runTransaction: pool acquire timeout → 503 class; failure mid-transaction → ROLLBACK attempted, DbUnavailableError (phase query)', async () => {
  const p1 = fakePool({ connect: async () => { throw new Error('timeout exceeded when trying to connect'); } });
  await assert.rejects(() => runTransaction(p1.pool, async () => 1), (e: unknown) => isDbUnavailableError(e) && (e as DbUnavailableError).reason === 'pool_connect_timeout');
  const p2 = fakePool({ queryImpl: async (t) => { if (t.startsWith('SELECT 1')) throw pgError('57P01', 'terminating connection due to administrator command'); return { rows: [] }; } });
  await assert.rejects(() => runTransaction(p2.pool, async (c) => c.query('SELECT 1')), (e: unknown) => isDbUnavailableError(e) && (e as DbUnavailableError).phase === 'query');
  assert.deepEqual(p2.log, ['BEGIN', 'SELECT', 'SELECT', 'ROLLBACK']); assert.equal(p2.releases(), 1); assert.equal(p2.connects(), 1, 'no retry');
});

test('runTransaction: success path unchanged (BEGIN, app_role, fn, COMMIT, release)', async () => {
  const p = fakePool(); const r = await runTransaction(p.pool, async (c) => { await c.query('SELECT 42'); return 'ok'; });
  assert.equal(r, 'ok'); assert.deepEqual(p.log, ['BEGIN', 'SELECT', 'SELECT', 'COMMIT']); assert.equal(p.releases(), 1);
});

test('runTransaction: syntax / constraint / serialization / app errors are rethrown RAW (not 503), rollback still attempted, no retry', async () => {
  for (const err of [pgError('42601', 'syntax error'), pgError('23505', 'duplicate key'), pgError('40001', 'could not serialize access'), Object.assign(new Error('rate_limited'), { code: 'rate_limited' })]) {
    const p = fakePool({ queryImpl: async (t) => { if (t.startsWith('INSERT')) throw err; return { rows: [] }; } }); const seen: unknown[] = [];
    await assert.rejects(() => runTransaction(p.pool, async (c) => c.query('INSERT INTO x VALUES (1)'), { onUnavailable: (e) => seen.push(e) }), (e: unknown) => e === err);
    assert.equal(seen.length, 0); assert.ok(p.log.includes('ROLLBACK')); assert.equal(p.connects(), 1);
  }
  // RLS diagnostics hook still fires for permission failures, and they are not 503
  const p = fakePool({ queryImpl: async (t) => { if (t.startsWith('UPDATE')) throw pgError('42501', 'permission denied for table ath_claims (row-level security)'); return { rows: [] }; } }); const auth: string[] = [];
  await assert.rejects(() => runTransaction(p.pool, async (c) => c.query('UPDATE x SET y=1'), { onAuthorizationFailure: (m) => auth.push(m) }), (e: unknown) => !isDbUnavailableError(e));
  assert.equal(auth.length, 1);
  // an already-classified error from a nested transaction is passed through, not double-wrapped, and not re-signalled
  const inner = new DbUnavailableError({ reason: 'errno', sqlstate: null, errno: 'ECONNREFUSED', phase: 'connect' }); const seen2: unknown[] = [];
  const p3 = fakePool(); await assert.rejects(() => runTransaction(p3.pool, async () => { throw inner; }, { onUnavailable: (e) => seen2.push(e) }), (e: unknown) => e === inner); assert.equal(seen2.length, 0);
});

test('response contract: 503, stable sanitized body, Retry-After, no-store, no provider details', async () => {
  const res = serviceUnavailableResponse(); assert.equal(res.status, 503);
  assert.equal(res.headers.get('retry-after'), '30'); assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.text(); assert.deepEqual(JSON.parse(body), SERVICE_UNAVAILABLE_BODY); assert.deepEqual(SERVICE_UNAVAILABLE_BODY, { ok: false, error: 'service_unavailable' });
  const wrapped = new DbUnavailableError({ reason: 'sqlstate_53', sqlstate: '53000', errno: null, phase: 'connect', cause: Object.assign(new Error(`FATAL: quota at ${HOST_LEAK} postgres://user:pw@${HOST_LEAK}/db`), { code: '53000' }) });
  for (const text of [body, wrapped.message, JSON.stringify({ reason: wrapped.reason, sqlstate: wrapped.sqlstate, errno: wrapped.errno, phase: wrapped.phase })]) {
    assert.doesNotMatch(text, /neon\.tech|postgres:\/\/|pw@|FATAL|quota|SELECT|at .*\.ts:/, text.slice(0, 80));
  }
});

test('historical incident sentences are not a classifier input (exact NEXTJS-3/-4 text is NOT VERIFIED)', () => {
  const src = readFileSync('lib/customer/db-unavailable.ts', 'utf8');
  assert.doesNotMatch(src, /pg_hba|exceeded the quota|provider_quota|too many \(connections/);
  assert.match(src, /NOT VERIFIED/);
  assert.equal(classifyDbError(new Error('NEXTJS-3 Neon provider outage at ep-example.aws.neon.tech')).unavailable, false);
});

test('recovery-code maps stay bounded; unknown text still collapses', () => {
  assert.equal(signInLinkErrorCode('service_unavailable'), 'service_unavailable');
  assert.match(claimSignInErrorMessage('service_unavailable') ?? '', /temporarily unavailable/);
  assert.equal(signInLinkErrorCode('db_unavailable'), 'auth_failed', 'internal code never reaches the URL unmapped');
  assert.equal(claimAcceptErrorCode('db_unavailable'), 'SPECIALIST_VALIDATION_UNAVAILABLE');
  assert.equal(claimAcceptErrorCode('FATAL: quota'), 'HANDOFF_INVALID');
});

test('observability: db.ts logs one sanitized line per failure and throttles the Sentry signal; unexpected errors bypass both', () => {
  const src = readFileSync('lib/customer/db.ts', 'utf8');
  assert.match(src, /customerLog\('db_unavailable', \{ reason: error\.reason, sqlstate: error\.sqlstate, errno: error\.errno, phase: error\.phase \}, 'error'\)/, 'log carries classification only, never message/host/url');
  assert.match(src, /DB_UNAVAILABLE_SENTRY_INTERVAL_MS = 60_000/); assert.match(src, /fingerprint: \['db_unavailable'\]/); assert.match(src, /Sentry\.captureMessage\('db_unavailable'/);
  assert.doesNotMatch(src, /captureException\(/, 'the raw provider error (with host text) is never sent');
  assert.doesNotMatch(src, /retry|attempt/i, 'no retry framework');
});

test('route coverage: API routes that reach the database map availability failures to the sanitized 503; app/go and server components are out of scope', () => {
  const files: string[] = [];
  const walk = (d: string, into: string[]) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p, into); else if (/\.(ts|tsx)$/.test(e)) into.push(p.replace(/\\/g, '/')); } };
  walk('app/api', files);
  const reaching = files.filter((f) => /withPlatform\(|withAskTx\(|withAdminSecurity\(|readPublicContractorState\(|new Pool\(/.test(readFileSync(f, 'utf8')));
  const uncovered = reaching.filter((f) => { const s = readFileSync(f, 'utf8'); return !/isDbUnavailableError\(/.test(s) && !/adminErrorResponse\(/.test(s) && !/classifyDbError\(/.test(s) && !/start-preflight|search-canaries/.test(f); });
  assert.deepEqual(uncovered, [], 'uncovered API routes');
  const missingImport = files.filter((f) => {
    const s = readFileSync(f, 'utf8');
    const uses = /isDbUnavailableError\(/.test(s) || /serviceUnavailableResponse\(/.test(s);
    return uses && !/import[^;]*isDbUnavailableError/.test(s);
  });
  assert.deepEqual(missingImport, [], 'symbol used without import');
  assert.equal(files.some((f) => /serviceUnavailableResponse\([^)]+\)/.test(readFileSync(f, 'utf8'))), false, '503 helper takes no error payload');
  assert.match(readFileSync('lib/control-plane/http.ts', 'utf8'), /if\(isDbUnavailableError\(error\)\)return serviceUnavailableResponse\(\);/);
  assert.doesNotMatch(readFileSync('lib/control-plane/http.ts', 'utf8'), /db-availability/);
  assert.match(readFileSync('app/api/internal/claim/start-preflight/route.ts', 'utf8'), /reason: 'unavailable' \}, 503\)/);
  assert.match(readFileSync('app/api/cron/search-canaries/route.ts', 'utf8'), /CANARY_RUN_UNAVAILABLE/);
  assert.doesNotMatch(readFileSync('app/api/cron/search-canaries/route.ts', 'utf8'), /error\.message/);
  for (const redirectRoute of ['app/api/customer/auth/verify/route.ts', 'app/api/customer/claim/accept/route.ts', 'app/api/customer/claim/confirm/route.ts']) {
    assert.match(readFileSync(redirectRoute, 'utf8'), /if \(isDbUnavailableError\(e\)\) return serviceUnavailableResponse\(\);/);
  }
  const submit = readFileSync('app/api/customer/claim/submit/route.ts', 'utf8');
  const attribution = submit.slice(submit.indexOf('attributeClaim'), submit.indexOf('return NextResponse.json({ ok: true'));
  assert.doesNotMatch(attribution, /serviceUnavailableResponse/, 'a committed claim is not turned into 503 by a later attribution failure');
  for (const claimsRoute of ['app/api/admin/operations/claims/[claimId]/route.ts', 'app/api/admin/operations/claims/[claimId]/revoke/route.ts', 'app/api/admin/operations/claims/[claimId]/review-session/route.ts', 'app/api/internal/ath-launch-001b-r2/route.ts']) {
    assert.match(readFileSync(claimsRoute, 'utf8'), /\[0-9A-Z\]\{5\}/, `${claimsRoute} must not echo a SQLSTATE message`);
  }
  const outsideApi: string[] = [];
  walk('app', outsideApi);
  const leaked = outsideApi.filter((f) => !f.startsWith('app/api/') && /db-unavailable|serviceUnavailableResponse|isDbUnavailableError/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(leaked, [], 'no app/go or server-component scope');
  assert.doesNotMatch(readFileSync('app/go/claim/[token]/route.ts', 'utf8'), /db-unavailable/);
  assert.doesNotMatch(readFileSync('app/go/unsubscribe/[token]/route.ts', 'utf8'), /db-unavailable/);
});
