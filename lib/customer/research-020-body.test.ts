import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MIGRATION_020_BYTES,
  MIGRATION_020_SHA256,
  assertDirectDatabaseUrl,
  certifiedMigration020,
  readMigration020File,
  runMigration020,
  type Migration020Client,
  type Migration020State,
} from './research-020-body.ts';

const ABSENT = {
  present: false,
  rls: false,
  forced: false,
  updated_at_trigger: false,
  server_policy: false,
  fingerprint_idx: false,
  notification_idx: false,
  no_browser_grants: true,
};

const COMPLETE = {
  present: true,
  rls: true,
  forced: true,
  updated_at_trigger: true,
  server_policy: true,
  fingerprint_idx: true,
  notification_idx: true,
  no_browser_grants: true,
};

const PARTIAL = { ...COMPLETE, rls: false, forced: false };

function clientFor(rows: Record<string, unknown>[]): { client: Migration020Client; calls: string[]; body: string } {
  const calls: string[] = [];
  let body = '';
  let select = 0;
  const client: Migration020Client = {
    async query(text) {
      calls.push(text.startsWith('SELECT') ? 'SELECT' : text);
      if (text.startsWith('SELECT')) {
        const row = rows[Math.min(select, rows.length - 1)];
        select += 1;
        return { rows: [row] };
      }
      return { rows: [] };
    },
    async exec(sql) {
      body = sql;
      calls.push('EXEC');
    },
  };
  return { client, calls, get body() { return body; } };
}

test('the certified 020 file is the LF body and the intake gate is unchanged', () => {
  const read = readMigration020File();
  assert.equal(read.sha256, MIGRATION_020_SHA256);
  assert.equal(Buffer.byteLength(read.sql), MIGRATION_020_BYTES);
  assert.equal(read.sql.includes('\r'), false);
  assert.match(read.sql, /FORCE ROW LEVEL SECURITY/);
  const http = readFileSync('lib/research-services/http.ts', 'utf8');
  assert.match(http, /const MAX_BODY_BYTES = 8_000/);
  assert.match(http, /payload\.byteLength > MAX_BODY_BYTES/);
  const migrator = readFileSync('scripts/ath-cust-002-migrate.ts', 'utf8');
  assert.match(migrator, /Do not use this script for migration 020/);
  const runner = readFileSync('scripts/research-services-020-apply.ts', 'utf8');
  assert.match(runner, /exec: async \(text\) => \{ await client\.query\(text\); \}/);
  assert.doesNotMatch(runner, /loadEnvFile/);
});

test('a pooled host is refused and the direct host is accepted', () => {
  const direct = 'postgres://migrate:placeholder@ep-square-example.eu-central-1.aws.neon.tech/neondb';
  assert.equal(assertDirectDatabaseUrl(direct), 'ep-square-example.eu-central-1.aws.neon.tech');
  const pooled = 'postgres://migrate:placeholder@ep-square-example-pooler.eu-central-1.aws.neon.tech/neondb';
  assert.throws(() => assertDirectDatabaseUrl(pooled), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, '020 requires the Neon direct connection');
    assert.equal(error.message.includes('placeholder'), false);
    return true;
  });
});

test('verify reads the schema and does not send the migration body', async () => {
  const { client, calls } = clientFor([COMPLETE]);
  const result = await runMigration020(client, 'verify', readMigration020File().sql);
  assert.equal(result.executed, false);
  assert.equal(result.committed, false);
  assert.equal(result.state.complete, true);
  assert.deepEqual(calls, ['SELECT']);
});

test('a complete schema is not sent again', async () => {
  const { client, calls } = clientFor([COMPLETE]);
  const result = await runMigration020(client, 'apply', readMigration020File().sql);
  assert.equal(result.executed, false);
  assert.equal(result.committed, false);
  assert.deepEqual(calls, ['BEGIN', `SET LOCAL lock_timeout = '3s'`, `SET LOCAL statement_timeout = '60s'`, 'SELECT', 'ROLLBACK']);
});

test('rehearse sends the whole LF body once and rolls back', async () => {
  const harness = clientFor([ABSENT, COMPLETE]);
  const result = await runMigration020(harness.client, 'rehearse', readMigration020File().sql);
  assert.equal(result.executed, true);
  assert.equal(result.committed, false);
  assert.equal(result.state.complete, true);
  assert.equal(Buffer.byteLength(harness.body), MIGRATION_020_BYTES);
  assert.equal(harness.body.includes('\r'), false);
  assert.equal(harness.calls.filter((call) => call === 'EXEC').length, 1);
  assert.equal(harness.calls.includes('COMMIT'), false);
  assert.equal(harness.calls.at(-1), 'ROLLBACK');
});

test('apply commits only after the body verifies', async () => {
  const harness = clientFor([ABSENT, COMPLETE]);
  const result = await runMigration020(harness.client, 'apply', readMigration020File().sql);
  assert.equal(result.committed, true);
  assert.equal(harness.calls.at(-1), 'COMMIT');
  const state: Migration020State = result.state;
  assert.equal(state.absent, false);
});

test('a partial schema is not repaired', async () => {
  const { client, calls } = clientFor([PARTIAL]);
  await assert.rejects(() => runMigration020(client, 'apply', readMigration020File().sql), /partial/);
  assert.equal(calls.includes('EXEC'), false);
  assert.equal(calls.includes('COMMIT'), false);
  assert.equal(calls.at(-1), 'ROLLBACK');
});

test('a drifted file is refused before a query', async () => {
  const { client, calls } = clientFor([ABSENT]);
  await assert.rejects(() => runMigration020(client, 'apply', 'select 1;'), /certified/);
  assert.deepEqual(calls, []);
  assert.throws(() => certifiedMigration020('select 1;'), /certified/);
});
