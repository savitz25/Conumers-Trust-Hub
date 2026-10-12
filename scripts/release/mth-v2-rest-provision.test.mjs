import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HUBS, PROJECTS, SCOPE, fingerprint } from './mth-v2-specialist-keys.mjs';
import { createRestEnvWriter } from './mth-v2-rest-env-writer.mjs';
import { executeRestProvision, parseRestArgs } from './mth-v2-rest-provision.mjs';

const TOKEN = 'syntheticProjectToken0001';
const DAY = '2026-10-08T12:00:00.000Z';
const now = Date.parse(DAY);
const pairs = Array.from({ length: 4 }, () => generateKeyPairSync('ed25519'));
const publicPem = pair => pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const record = (hub, n) => ({ kid: `${hub}-v23-prod-20261008`, publicKeyPem: publicPem(pairs[n]) });
const tokenHash = value => createHash('sha256').update(value).digest('hex');

function gitBlob(path) {
  const result = spawnSync('git', ['hash-object', path], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  return result.stdout.trim();
}

function projects() {
  return Object.fromEntries(Object.entries(PROJECTS).map(([hub, name], index) => [hub, {
    name, id: `prj_RESTTEST${index}ID`, environment: 'production', env: [],
  }]));
}

function baseConfig(destination = 'lender') {
  const metadata = {
    source: 'approved-vercel-connector', scope: SCOPE, decrypted: false, capturedAt: DAY, projects: projects(),
  };
  const inventory = {
    source: 'approved-public-key-inventory', scope: SCOPE, capturedAt: DAY, complete: true, additionalKeys: [],
    askCopies: Object.fromEntries(HUBS.map(hub => [hub, { kid: null, publicKeyPem: null }])),
    keys: { ask: record('ask', 0), move: record('move', 1), ...Object.fromEntries(HUBS.map(hub => [hub, null])) },
  };
  return {
    credential: TOKEN, destination, placement: 'specialist', hubs: [destination], date: '20261008',
    metadata: 'metadata', inventory: 'inventory', askFingerprint: fingerprint(inventory.keys.ask.publicKeyPem),
    bundles: ['bundle.json'], closedGates: true, metadataObject: metadata, inventoryObject: inventory,
  };
}

function harness(config = baseConfig(), fetchImpl) {
  const logs = [];
  const calls = [];
  let generated = 0;
  let receipt;
  const fetch = fetchImpl ?? (async (url, init) => {
    calls.push({ url, init });
    const payload = JSON.parse(init.body);
    return Response.json({
      created: { key: payload.key, type: payload.type, target: ['production'], value: payload.value },
      failed: [],
    }, { status: 201 });
  });
  const deps = {
    now, fetch, output: line => logs.push(line),
    readJson: path => structuredClone(path === 'metadata' ? config.metadataObject : path === 'inventory' ? config.inventoryObject : receipt),
    generate: () => pairs[2 + generated++],
    reserveBundle: (_path, value) => {
      receipt = structuredClone(value);
      return { save: next => { receipt = structuredClone(next); }, close: () => {} };
    },
  };
  return { config, deps, logs, calls, get generated() { return generated; }, get receipt() { return receipt; } };
}

const hidden = (error, secret) => typeof error?.message === 'string' && !error.message.includes(secret);
const rejects = async (run, code, state) => {
  await assert.rejects(run, error => error.message === code && hidden(error, TOKEN) && hidden(error, 'PRIVATE KEY'));
  if (state) {
    assert.equal(state.generated, 0);
    assert.equal(state.calls.length, 0);
  }
};

test('certified script blob is unchanged', () => {
  const path = fileURLToPath(new URL('./mth-v2-specialist-keys.mjs', import.meta.url));
  assert.equal(gitBlob(path), '40707cf236d6507a001ef73ddf054baf50ff8b6d');
});

test('REST sources do not name a CLI launch, scope lookup, upsert, or saved token', () => {
  for (const name of ['./mth-v2-rest-env-writer.mjs', './mth-v2-rest-provision.mjs']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8');
    for (const banned of ['cliWriter', 'spawn', 'child_process', '--scope', 'upsert', 'teamId', 'auth.json']) {
      assert.equal(source.includes(banned), false, name);
    }
  }
  const provision = readFileSync(new URL('./mth-v2-rest-provision.mjs', import.meta.url), 'utf8');
  const writer = readFileSync(new URL('./mth-v2-rest-env-writer.mjs', import.meta.url), 'utf8');
  assert.equal(writer.includes('VERCEL_TOKEN'), false);
  assert.equal(provision.includes('REST_SAVED_TOKEN_PRESENT'), true);
  assert.equal(provision.includes('MTH_V23_PROJECT_TOKEN'), true);
});

test('unknown transport flags are rejected', () => {
  for (const args of [['--vercel-cli', 'cli.js'], ['--token', TOKEN], ['--scope', 'team'], ['--replace', 'NAME'], ['--force']]) {
    assert.throws(() => parseRestArgs(args), error => error.message === 'REST_UNKNOWN_OPTION' && hidden(error, TOKEN));
  }
});

test('missing, empty, and invalid credentials fail before key generation', async () => {
  for (const credential of [undefined, '', '   ', 'short', 'has space token value!!']) {
    const state = harness({ ...baseConfig(), credential });
    const code = credential === undefined || credential === '' ? 'REST_CREDENTIAL_MISSING' : 'REST_CREDENTIAL_INVALID';
    await rejects(() => executeRestProvision(state.config, state.deps), code, state);
  }
});

test('missing fetch and an injected writer cannot reach generation or a saved login', async () => {
  const missing = harness();
  delete missing.deps.fetch;
  await rejects(() => executeRestProvision(missing.config, missing.deps), 'REST_FETCH_REQUIRED', missing);
  const injected = harness();
  injected.deps.writeEnv = () => { throw new Error('CLI_MUST_NOT_RUN'); };
  await rejects(() => executeRestProvision(injected.config, injected.deps), 'REST_WRITER_INJECTION_FORBIDDEN', injected);
});

test('Move, a second specialist, replacement, CLI, and the UTC date window stop before generation', async () => {
  const move = harness({ ...baseConfig(), destination: 'move', hubs: ['lender'] });
  await rejects(() => executeRestProvision(move.config, move.deps), 'DESTINATION_FORBIDDEN', move);
  const two = harness({ ...baseConfig(), hubs: ['lender', 'investor'] });
  await rejects(() => executeRestProvision(two.config, two.deps), 'REST_SINGLE_PROJECT_REQUIRED', two);
  const replaced = harness({ ...baseConfig(), replace: ['MY_TRUSTHUB_V23_LENDER_KEY_ID'] });
  await rejects(() => executeRestProvision(replaced.config, replaced.deps), 'REST_REPLACE_FORBIDDEN', replaced);
  const cli = harness({ ...baseConfig(), cli: 'vercel/dist/index.js' });
  await rejects(() => executeRestProvision(cli.config, cli.deps), 'REST_CLI_FORBIDDEN', cli);
  const otherDay = harness();
  otherDay.deps.now = Date.parse('2026-10-09T12:00:00.000Z');
  await rejects(() => executeRestProvision(otherDay.config, otherDay.deps), 'REST_KID_DATE_NOT_UTC_TODAY', otherDay);
  const late = harness();
  late.deps.now = Date.parse('2026-10-08T23:56:00.000Z');
  await rejects(() => executeRestProvision(late.config, late.deps), 'REST_MIDNIGHT_WINDOW', late);
});

test('one specialist credential writes only that project, Production, and Sensitive private PEM text', async () => {
  const state = harness();
  await executeRestProvision(state.config, state.deps);
  assert.equal(state.generated, 1);
  assert.equal(state.calls.length, 4);
  assert.equal(state.receipt.state, 'specialists-written');
  assert.equal(/PRIVATE KEY/.test(JSON.stringify(state.receipt)), false);
  assert.equal(state.logs.some(line => line.includes('PRIVATE KEY') || line.includes(TOKEN)), false);
  const projectId = state.config.metadataObject.projects.lender.id;
  for (const call of state.calls) {
    const payload = JSON.parse(call.init.body);
    const header = call.init.headers.Authorization;
    assert.equal(call.url, `https://api.vercel.com/v10/projects/${projectId}/env`);
    assert.equal(call.url.includes('?'), false);
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.redirect, 'error');
    assert.equal(tokenHash(header.slice('Bearer '.length)), tokenHash(TOKEN));
    assert.equal(Array.isArray(payload.target) && payload.target.length === 1 && payload.target[0] === 'production', true);
    const isPrivate = payload.key.endsWith('_SIGNING_PRIVATE_KEY_PEM');
    assert.equal(payload.type, isPrivate ? 'sensitive' : 'encrypted');
    assert.equal(!isPrivate || (payload.value.startsWith('-----BEGIN PRIVATE KEY-----') && !payload.value.includes('"type":"Buffer"')), true);
    assert.equal(call.init.body.includes('"type":"Buffer"'), false);
  }
  assert.equal(state.calls.some(call => call.url.includes(state.config.metadataObject.projects.ask.id)), false);
  assert.equal(state.calls.some(call => call.url.includes(state.config.metadataObject.projects.move.id)), false);
});

test('Ask and specialist credentials reject each other and Move before any request', async () => {
  const lenderId = projects().lender.id;
  const askId = projects().ask.id;
  let calls = 0;
  const fetch = async () => { calls += 1; throw new Error('network must not run'); };
  const lender = createRestEnvWriter({ credential: TOKEN, destination: 'lender', projectId: lenderId, fetchImpl: fetch });
  const ask = createRestEnvWriter({ credential: 'syntheticAskToken0000001', destination: 'ask', projectId: askId, fetchImpl: fetch });
  const pem = publicPem(pairs[0]);
  await assert.rejects(lender({ projectId: askId, project: PROJECTS.ask, name: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', value: 'lender-v23-prod-20261008', replace: false }), error => error.message === 'REST_PROJECT_FORBIDDEN');
  await assert.rejects(ask({ projectId: lenderId, project: PROJECTS.lender, name: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', value: 'lender-v23-prod-20261008', replace: false }), error => error.message === 'REST_PROJECT_FORBIDDEN');
  await assert.rejects(lender({ projectId: lenderId, project: PROJECTS.move, name: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', value: 'lender-v23-prod-20261008', replace: false }), error => error.message === 'MOVE_WRITE_FORBIDDEN');
  await assert.rejects(lender({ projectId: lenderId, project: PROJECTS.lender, name: 'MY_TRUSTHUB_V23_MOVE_KEY_ID', value: 'move-v23-prod-20261008', replace: false }), error => error.message === 'REST_NAME_FORBIDDEN');
  await assert.rejects(lender({ projectId: lenderId, project: PROJECTS.lender, name: 'MY_TRUSTHUB_V23_PARENT_ORIGIN', value: 'https://www.asktrusthub.com', replace: false }), error => error.message === 'REST_NAME_FORBIDDEN');
  const insurance = createRestEnvWriter({ credential: TOKEN, destination: 'insurance', projectId: projects().insurance.id, fetchImpl: fetch });
  await assert.rejects(insurance({ projectId: projects().insurance.id, project: PROJECTS.insurance, name: 'MY_TRUSTHUB_V23_PARENT_ORIGIN', value: 'https://example.invalid', replace: false }), error => error.message === 'PARENT_ORIGIN_MISMATCH');
  assert.equal(calls, 0);
  assert.equal(pem.includes('PRIVATE KEY'), false);
});

test('ambiguous, conflict, and transport failures are not retried and do not echo secrets', async () => {
  const secretPem = pairs[2].privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const cases = [
    [500, { error: { message: `${TOKEN} ${secretPem}` } }, 'REST_SERVER_AMBIGUOUS'],
    [401, { error: { message: TOKEN } }, 'REST_UNAUTHORIZED'],
    [403, { error: { code: 'ENV_ALREADY_EXISTS', message: secretPem } }, 'REST_CONFLICT'],
    [403, { error: { code: 'forbidden', message: TOKEN } }, 'REST_FORBIDDEN'],
    [409, { error: { message: TOKEN } }, 'REST_CONFLICT'],
    [429, { error: { message: TOKEN } }, 'REST_RATE_LIMITED'],
    [200, { created: { key: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', type: 'encrypted', target: ['production'] }, failed: [] }, 'REST_AMBIGUOUS'],
    [201, { created: [{ key: 'MY_TRUSTHUB_V23_LENDER_KEY_ID' }], failed: [] }, 'REST_AMBIGUOUS'],
    [201, { created: { key: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', type: 'encrypted', target: ['preview'] }, failed: [] }, 'REST_TARGET_AMBIGUOUS'],
    [201, { created: { key: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', type: 'encrypted', target: ['production'], value: secretPem }, failed: [{ error: { message: TOKEN } }] }, 'REST_PARTIAL'],
  ];
  for (const [status, body, code] of cases) {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return Response.json(body, { status });
    };
    const writer = createRestEnvWriter({ credential: TOKEN, destination: 'lender', projectId: projects().lender.id, fetchImpl: fetch });
    await assert.rejects(writer({
      projectId: projects().lender.id, project: PROJECTS.lender, name: 'MY_TRUSTHUB_V23_LENDER_KEY_ID',
      value: 'lender-v23-prod-20261008', replace: false,
    }), error => error.message === code && hidden(error, TOKEN) && hidden(error, secretPem));
    assert.equal(calls, 1);
  }
  for (const failure of [Object.assign(new TypeError(`redirect to ${TOKEN}`), { name: 'TypeError' }), Object.assign(new Error(`socket ${TOKEN} ${secretPem}`), { name: 'AbortError' }), new Error(`connect ${TOKEN}`)]) {
    let calls = 0;
    const fetch = async () => { calls += 1; throw failure; };
    const writer = createRestEnvWriter({ credential: TOKEN, destination: 'lender', projectId: projects().lender.id, fetchImpl: fetch });
    const expected = failure.name === 'AbortError' ? 'REST_TIMEOUT' : /redirect/i.test(failure.message) ? 'REST_REDIRECT' : 'REST_NETWORK';
    await assert.rejects(writer({
      projectId: projects().lender.id, project: PROJECTS.lender, name: 'MY_TRUSTHUB_V23_LENDER_KEY_ID',
      value: 'lender-v23-prod-20261008', replace: false,
    }), error => error.message === expected && hidden(error, TOKEN) && hidden(error, secretPem));
    assert.equal(calls, 1);
  }
});

test('a failed specialist write leaves the pending receipt and does not generate a retry', async () => {
  let calls = 0;
  const state = harness(baseConfig(), async (url, init) => {
    calls += 1;
    if (calls === 2) return Response.json({ error: { message: `${TOKEN} BEGIN PRIVATE KEY` } }, { status: 500 });
    const payload = JSON.parse(init.body);
    return Response.json({ created: { key: payload.key, type: payload.type, target: ['production'] }, failed: [] }, { status: 201 });
  });
  await assert.rejects(executeRestProvision(state.config, state.deps), error => error.message === 'REST_SERVER_AMBIGUOUS' && hidden(error, TOKEN));
  assert.equal(calls, 2);
  assert.equal(state.receipt.state, 'pending');
  assert.equal(/PRIVATE KEY/.test(JSON.stringify(state.receipt)), false);
});

test('Ask placement writes only Ask public names and does not generate a key', async () => {
  const config = baseConfig('ask');
  config.placement = 'ask';
  config.hubs = ['lender'];
  config.bundles = ['lender-public.json'];
  const specialist = record('lender', 2);
  config.inventoryObject.keys.lender = specialist;
  config.inventoryObject.askCopies.lender = { kid: config.inventoryObject.keys.ask.kid, publicKeyPem: config.inventoryObject.keys.ask.publicKeyPem };
  config.metadataObject.projects.lender.env = [
    { key: 'MY_TRUSTHUB_V23_LENDER_KEY_ID', type: 'encrypted' },
    { key: 'MY_TRUSTHUB_V23_LENDER_SIGNING_PRIVATE_KEY_PEM', type: 'sensitive' },
    { key: 'MY_TRUSTHUB_V23_ASK_KEY_ID', type: 'encrypted' },
    { key: 'MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM', type: 'encrypted' },
  ];
  const bundle = {
    version: 1, scope: SCOPE, state: 'specialists-written', askFingerprint: config.askFingerprint,
    keys: { lender: { kid: specialist.kid, publicKeyPem: specialist.publicKeyPem } },
  };
  const state = harness(config);
  state.deps.readJson = path => path === 'metadata' ? structuredClone(config.metadataObject)
    : path === 'inventory' ? structuredClone(config.inventoryObject) : structuredClone(bundle);
  await executeRestProvision(config, state.deps);
  assert.equal(state.generated, 0);
  assert.equal(state.calls.length, 2);
  const names = state.calls.map(call => JSON.parse(call.init.body).key);
  assert.deepEqual(names, ['MY_TRUSTHUB_V23_LENDER_KEY_ID', 'MY_TRUSTHUB_V23_LENDER_VERIFY_PUBLIC_KEY_PEM']);
  assert.equal(state.calls.every(call => call.url.endsWith(`/projects/${config.metadataObject.projects.ask.id}/env`)), true);
  assert.equal(state.calls.every(call => JSON.parse(call.init.body).type === 'encrypted'), true);
});
