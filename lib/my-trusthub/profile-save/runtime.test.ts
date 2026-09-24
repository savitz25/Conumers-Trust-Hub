import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ParentProfileSaveRuntime, type VerifiedCaller } from './runtime.ts';
import { SqliteHarnessBackend } from '../../../scripts/qa/v23-sqlite-backend.ts';
import { handleProfileSave } from './http.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from './interface.ts';
import { profileKey, TRANSFER_VERSION, type GuestStageInput, type GuestStageRef, type ItemReceipt } from '../contracts/v2-3-profile-transfer.ts';
import { saveP12, addProjectP12, consumeP13, type FoundationSql } from './p12-p13.ts';
import { resolveExactProfile } from './identity.ts';
import { PostgresRuntimeBackend, type TransactionConnection, type TransactionFoundations } from './postgres-backend.ts';

test('R14 PostgreSQL adapter commits, rolls back, retries serialization and releases (mocked SQL)', async () => {
  const calls: string[] = [];
  let releases = 0, attempts = 0;
  const connection: TransactionConnection = {
    query: async <T>(sql: string) => { calls.push(sql); return { rows: [] as T[] }; },
    release: () => { releases++; },
  };
  // No foundation methods are invoked: this test covers transaction plumbing only.
  const unexpected = async (): Promise<never> => { throw new Error('Unexpected foundation call'); };
  const foundations: TransactionFoundations = async () => ({
    resolveProfile: unexpected, resolveReturnTask: unexpected, consumeP13: unexpected,
    saveP12: unexpected, addProjectP12: unexpected,
  });
  const backend = new PostgresRuntimeBackend({ connect: async () => connection }, foundations);
  assert.equal(await backend.transaction(async tx => {
    attempts++;
    await tx.put('receipt', 'a'.repeat(64), { fixture: true });
    if (attempts === 1) throw Object.assign(new Error('serialization'), { code: '40001' });
    return 'committed';
  }), 'committed');
  assert.equal(attempts, 2); assert.equal(releases, 2);
  assert.equal(calls.filter(c => c === 'rollback').length, 1);
  assert.equal(calls.filter(c => c === 'commit').length, 1);
  assert.ok(calls.some(c => c.includes('pg_advisory_xact_lock')));
  await assert.rejects(backend.transaction(async () => { throw new Error('receipt unavailable'); }), /receipt unavailable/);
  assert.equal(releases, 3);
  assert.equal(calls.filter(c => c === 'commit').length, 1);
  attempts = 0;
  await assert.rejects(backend.transaction(async () => {
    attempts++; throw Object.assign(new Error('deadlock'), { code: '40P01' });
  }), /deadlock/);
  assert.equal(attempts, 3); assert.equal(releases, 6);
  assert.equal(await backend.rateLimit('b'.repeat(64), 1000, 30), false, 'missing quota row fails closed');
  assert.equal(releases, 7);
});

const identity = { hub: 'move' as const, nativeId: 'fixture-nj-mover', profileClass: 'fixture-only-moving-company' };
const item = { localItemId: 'fixture-nj-mover', revision: '1', digest: 'a'.repeat(64), profile: identity };
const stage: GuestStageInput = { version: TRANSFER_VERSION, sourceHub: 'move', audience: 'ask', selected: [item],
  returnTask: { kind: 'profile', hub: 'move', canonicalSlug: identity.nativeId, profile: identity } };
async function fixture() {
  const path = join(mkdtempSync(join(tmpdir(), 'v23-runtime-')), 'receipts.sqlite');
  let backend = new SqliteHarnessBackend(path);
  const profile = { ...identity, published: true, supportedClass: true, binding: { id: 'fixture-binding', networkEntityId: 'fixture-entity', status: 'accepted' as const } };
  backend.profiles.set(profileKey(identity), profile);
  let caller: VerifiedCaller = { hub: 'move', browserBinding: 'b'.repeat(43), environment: 'isolated', scopes: ['transfer:stage', 'saved:write', 'receipt:verify'] };
  let now = 1000;
  const runtime = () => new ParentProfileSaveRuntime({ enabled: true, backend,
    registry: { environment: 'isolated', isolatedBackendVerified: true, origins: { move: 'http://127.0.0.1:4421', insurance: 'http://127.0.0.1:4422', lender: 'http://127.0.0.1:4423', contractor: 'http://127.0.0.1:4424', senior: 'http://127.0.0.1:4425', investor: 'http://127.0.0.1:4426' } },
    authenticate: async () => caller, now: () => now });
  const staged = await runtime().execute('prepareGuestProfileTransfer', stage) as GuestStageRef;
  const continuation = await runtime().execute('prepareProfileSaveContinuation', { sourceHub: 'move', audience: 'ask', ...staged, expiresAt: undefined }).catch(() => null);
  assert.equal(continuation, null, 'extra fields rejected');
  const prepared = await runtime().execute('prepareProfileSaveContinuation', { sourceHub: 'move', audience: 'ask', transferRef: staged.transferRef, manifestDigest: staged.manifestDigest }) as { continuationRef: string };
  caller = { ...caller, parent: { subject: 'fixture-consumer-a', sessionBinding: 'verified-session-a', admitted: true },
    exchange: 'fixture-p13-exchange', selectionConfirmed: true, confirmedTransferRef: staged.transferRef };
  const consumed = await runtime().execute('consumeProfileSaveContinuation', { continuationRef: prepared.continuationRef, issuer: 'move', audience: 'ask', browserProof: caller.browserBinding }) as { accountContextRef: string };
  const commit = { requestKey: 'fixture-operation', accountContextRef: consumed.accountContextRef, transferRef: staged.transferRef, manifestDigest: staged.manifestDigest, item };
  return { runtime, get backend() { return backend; }, commit, prepared, profile,
    setCaller(patch: Partial<VerifiedCaller>) { caller = { ...caller, ...patch }; },
    setTime(value: number) { now = value; },
    restart() { backend.close(); backend = new SqliteHarnessBackend(path); backend.profiles.set(profileKey(identity), profile); },
    close() { backend.close(); } };
}
test('R01 Move local selected item -> durable parent receipt -> restart/retry; no local retirement', async () => {
  const f = await fixture(); try {
    const receipt = await f.runtime().execute('commitProfileSave', f.commit) as ItemReceipt;
    assert.equal(receipt.parent.outcome, 'saved'); assert.equal(receipt.localCopy, 'keep');
    assert.equal(f.backend.count('saves'), 1);
    f.restart();
    assert.deepEqual(await f.runtime().execute('getProfileSaveReceipt', { requestKey: f.commit.requestKey, accountContextRef: f.commit.accountContextRef }), receipt);
    assert.deepEqual(await f.runtime().execute('commitProfileSave', f.commit), receipt);
    assert.equal(f.backend.count('saves'), 1);
  } finally { f.close(); }
});
test('R02 parallel duplicate activation returns one durable receipt and logical Save', async () => {
  const f = await fixture(); try {
    const results = await Promise.all(Array.from({ length: 8 }, () => f.runtime().execute('commitProfileSave', f.commit)));
    for (const r of results) assert.deepEqual(r, results[0]);
    assert.equal(f.backend.count('saves'), 1);
  } finally { f.close(); }
});
test('R03 fingerprint rejects changed Project/item/digest/revision under one request key', async () => {
  const f = await fixture(); try {
    await f.runtime().execute('commitProfileSave', f.commit);
    for (const patch of [{ projectRef: 'p'.repeat(43) }, { item: { ...item, revision: '2' } }, { manifestDigest: 'c'.repeat(64) }])
      await assert.rejects(f.runtime().execute('commitProfileSave', { ...f.commit, ...patch }), /conflict/);
  } finally { f.close(); }
});
test('R04 failed receipt persistence rolls back Save; retry succeeds honestly', async () => {
  const f = await fixture(); try {
    f.backend.failReceipt = true;
    await assert.rejects(f.runtime().execute('commitProfileSave', f.commit));
    assert.equal(f.backend.count('saves'), 0);
    f.backend.failReceipt = false;
    assert.equal((await f.runtime().execute('commitProfileSave', f.commit) as ItemReceipt).parent.outcome, 'saved');
  } finally { f.close(); }
});
test('R05 partial Project failure retains Save, membership retry dedupes Save', async () => {
  const f = await fixture(); try {
    f.backend.projectFails = true;
    const input = { ...f.commit, projectRef: 'p'.repeat(43) };
    const first = await f.runtime().execute('commitProfileSave', input) as ItemReceipt;
    assert.equal(first.parent.outcome, 'saved'); assert.equal(first.project.outcome, 'failed');
    f.backend.projectFails = false;
    const second = await f.runtime().execute('commitProfileSave', { ...input, requestKey: 'membership-retry' }) as ItemReceipt;
    assert.equal(second.parent.outcome, 'already_saved'); assert.equal(second.project.outcome, 'added');
    assert.equal(f.backend.count('saves'), 1); assert.equal(f.backend.count('memberships'), 1);
  } finally { f.close(); }
});
test('R06 owner/session/browser/hub/business-scope switch cannot read another grant', async () => {
  for (const patch of [
    { parent: { subject: 'consumer-b', sessionBinding: 'verified-session-a', admitted: true as const } },
    { parent: { subject: 'fixture-consumer-a', sessionBinding: 'new-session', admitted: true as const } },
    { browserBinding: 'x'.repeat(43) }, { hub: 'lender' as const }, { scopes: ['business:manage'] }, { parent: undefined },
  ]) {
    const f = await fixture(); try {
      await f.runtime().execute('commitProfileSave', f.commit); f.setCaller(patch);
      await assert.rejects(f.runtime().execute('getProfileSaveReceipt', { requestKey: f.commit.requestKey, accountContextRef: f.commit.accountContextRef }), /unauthorized/);
      await assert.rejects(f.runtime().execute('commitProfileSave', f.commit), /unauthorized/);
    } finally { f.close(); }
  }
});
test('R07 expired grant and replayed continuation fail closed', async () => {
  const f = await fixture(); try {
    await assert.rejects(f.runtime().execute('consumeProfileSaveContinuation', { continuationRef: f.prepared.continuationRef, issuer: 'move', audience: 'ask', browserProof: 'b'.repeat(43) }), /conflict/);
    f.setTime(601001); await assert.rejects(f.runtime().execute('commitProfileSave', f.commit), /expired/);
  } finally { f.close(); }
});
test('R17 exact fresh reauthentication recovers receipt, never renews expired commit authority', async () => {
  const f = await fixture(); try {
    const receipt = await f.runtime().execute('commitProfileSave', f.commit);
    f.setTime(700000);
    const lookup = {accountContextRef:f.commit.accountContextRef,requestKey:f.commit.requestKey};
    await assert.rejects(f.runtime().execute('getProfileSaveReceipt',lookup),/expired/);
    f.setCaller({parent:{subject:'fixture-consumer-a',sessionBinding:'renewed-session',admitted:true},
      receiptRecovery:{...lookup,verifiedAt:700000}});
    assert.deepEqual(await f.runtime().execute('getProfileSaveReceipt',lookup),receipt);
    await assert.rejects(f.runtime().execute('commitProfileSave',f.commit),/unauthorized/);
    await assert.rejects(f.runtime().execute('getProfileSaveReceipt',{...lookup,consumerId:'fixture-consumer-a'}),/invalid/);
    await assert.rejects(f.runtime().execute('getProfileSaveReceipt',{...lookup,requestKey:'other-operation'}),/unauthorized/);
    f.setCaller({parent:{subject:'consumer-b',sessionBinding:'renewed-session',admitted:true}});
    assert.equal(await f.runtime().execute('getProfileSaveReceipt',lookup),null);
    f.setCaller({parent:{subject:'fixture-consumer-a',sessionBinding:'renewed-session',admitted:true},hub:'lender'});
    await assert.rejects(f.runtime().execute('getProfileSaveReceipt',lookup),/unauthorized/);
    f.setCaller({hub:'move',receiptRecovery:{...lookup,verifiedAt:0}});
    await assert.rejects(f.runtime().execute('getProfileSaveReceipt',lookup),/unauthorized/);
    f.setTime(31*86400000);f.setCaller({receiptRecovery:{...lookup,verifiedAt:31*86400000}});
    await assert.rejects(f.runtime().execute('getProfileSaveReceipt',lookup),/unauthorized/);
    assert.equal(f.backend.count('saves'),1);
  } finally {f.close();}
});
test('R08 receipt verification rejects changed manifest, item, Project and reference', async () => {
  const f = await fixture(); try {
    const r = await f.runtime().execute('commitProfileSave', f.commit) as ItemReceipt;
    const v = { requestKey: r.requestKey, accountContextRef: r.accountContextRef, receiptRef: r.receiptRef, manifestDigest: r.manifestDigest, item };
    assert.deepEqual(await f.runtime().execute('verifyProfileSaveReceipt', v), r);
    for (const patch of [{ receiptRef: 'x'.repeat(43) }, { item: { ...item, revision: '2' } }, { projectRef: 'p'.repeat(43) }, { manifestDigest: 'c'.repeat(64) }])
      assert.equal(await f.runtime().execute('verifyProfileSaveReceipt', { ...v, ...patch }), null);
  } finally { f.close(); }
});
test('R09 live publication/class/binding decision; no invented identity or Watch dependency', async () => {
  for (const [patch, outcome] of [[{ published: false }, 'profile_not_published'], [{ supportedClass: false }, 'unsupported_class'],
    [{ binding: null }, 'local_only'], [{ binding: { id: 'fixture-binding', networkEntityId: 'fixture-entity', status: 'review_required' as const } }, 'identity_review_required']] as const) {
    const f = await fixture(); try {
      f.backend.profiles.set(profileKey(identity), { ...f.profile, ...patch });
      const r = await f.runtime().execute('commitProfileSave', f.commit) as ItemReceipt;
      assert.equal(r.parent.outcome, outcome); assert.equal(f.backend.count('saves'), 0);
    } finally { f.close(); }
  }
});
test('R10 HTTP rejects malformed/extra/oversized requests; disabled/unavailable never mutate', async () => {
  const f = await fixture(); try {
    const payload = { version: PROFILE_SAVE_RUNTIME_VERSION, operation: 'commitProfileSave', input: f.commit };
    const request = (body: unknown) => new Request('http://localhost/api/my-trusthub/profile-save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const bindings = { enabled: true, runtimeForRequest: async () => f.runtime() };
    assert.equal((await handleProfileSave(request(payload), { ...bindings, enabled: false })).status, 404);
    assert.equal((await handleProfileSave(request(payload), { enabled: true, runtimeForRequest: async () => null })).status, 503);
    assert.equal((await handleProfileSave(request({ ...payload, consumerId: 'forged' }), bindings)).status, 400);
    assert.equal((await handleProfileSave(request({ ...payload, input: { ...f.commit, consumerId: 'forged' } }), bindings)).status, 400);
    assert.equal((await handleProfileSave(request({ ...payload, junk: 'x'.repeat(65536) }), bindings)).status, 413);
    assert.equal(f.backend.count('saves'), 0);
    const response = await handleProfileSave(request(payload), bindings);
    assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control')!, /no-store/);
  } finally { f.close(); }
});
test('R11 denied operations consume rate quota instead of rolling it back', async () => {
  const f = await fixture(); try {
    for (let i = 0; i < 30; i++) await assert.rejects(f.runtime().execute('commitProfileSave', {}), /invalid/);
    await assert.rejects(f.runtime().execute('commitProfileSave', f.commit), /rate_limited/);
    assert.equal(f.backend.count('saves'), 0);
  } finally { f.close(); }
});
test('R12 existing P12/P13 SQL calls remain parameterized and owner-authorized (MOCKED SQL)', async () => {
  const calls: string[] = [];
  const sql: FoundationSql = { async query<T>(query: string) {
    calls.push(query);
    return { rows: (query.includes('require_user') ? [{ subject: 'a' }] : query.includes('save_entity') ? [{ saved_entity_id: 's', created: true, restored: false }] :
      query.includes('consume_consumer') ? [{ ok: true, canonical_user_id: 'a' }] : [{ added: true }]) as T[] };
  } };
  const caller: VerifiedCaller = { hub: 'move', browserBinding: 'b'.repeat(43), environment: 'isolated', scopes: [], parent: { subject: 'a', sessionBinding: 's', admitted: true } };
  assert.equal((await saveP12(sql, 'binding', caller)).savedRef, 's');
  assert.equal(await addProjectP12(sql, 'project', 's'), 'added');
  assert.equal((await consumeP13(sql, { code: 'c', targetOrigin: 'http://localhost', state: 's', nonce: 'n', rateBucket: 'r' }, caller)).subject, 'a');
  await assert.rejects(saveP12(sql, 'binding', { ...caller, parent: { ...caller.parent!, subject: 'b' } }), /unauthorized/);
  assert.ok(calls.some(c => c.includes('consumer.save_entity($1,$2,$3)')));
});
test('R13 exact registry triple, publication and ambiguity fail closed (MOCKED SQL)', async () => {
  const queries: unknown[][] = [];
  const row = { id: 'binding', network_entity_id: 'canonical', binding_status: 'accepted' };
  let rows = [row];
  const sql: FoundationSql = { async query<T>(_sql: string, values: unknown[]) { queries.push(values); return { rows: rows as T[] }; } };
  const publication = { resolve: async () => ({ identity, published: true, supportedClass: true }) };
  assert.equal((await resolveExactProfile(identity, publication, sql))?.binding?.id, 'binding');
  assert.deepEqual(queries[0], ['move', identity.nativeId, identity.profileClass]);
  rows = [row, row]; await assert.rejects(resolveExactProfile(identity, publication, sql), /conflict/);
  await assert.rejects(resolveExactProfile(identity, { resolve: async () => ({ identity: { ...identity, nativeId: 'wrong' }, published: true, supportedClass: true }) }, sql), /invalid/);
  assert.equal(await resolveExactProfile(identity, { resolve: async () => null }, sql), null);
});
