import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { profileKey, TRANSFER_VERSION, TRANSFER_VERSION_V3, type GuestStageInput, type GuestStageRef, type ItemReceipt } from '../contracts/v2-3-profile-transfer.ts';
import { SqliteHarnessBackend } from '../../../scripts/qa/v23-sqlite-backend.ts';
import { fixture } from './browser.fixture.ts';
import { accountContextIssueCall, accountContextIssueQuery, CONTRACTOR_CONTEXT_HUB, type AccountContextProof } from './contractor-context-seam.ts';
import { PRODUCTION_TARGET } from './isolated-config.ts';
import { ParentProfileSaveRuntime, RuntimeError, type VerifiedCaller } from './runtime.ts';

const SUBJECT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;

/** Local stand-in for packet 15 issue plus consume_context audience check.
 * It does not connect to Postgres and does not apply SQL. */
class ContextBroker {
  readonly handoffs = new Map<string, { hub: string; subject: string; nonce: string; state: string; used: boolean; expiresAt: number }>();
  readonly saves: string[] = [];
  issue(verifiedHub: string, proof: AccountContextProof, now: number) {
    const call = accountContextIssueCall(PRODUCTION_TARGET, verifiedHub, proof, SUBJECT, SESSION);
    const body = JSON.parse(String(call.values[0])) as AccountContextProof & Record<string, unknown>;
    if (['hub', 'sourceHub', 'issuer', 'issuerHub', 'origin'].some(key => Object.hasOwn(body, key))) throw Object.assign(new Error('42501'), { code: '42501' });
    if (![body.code, body.state, body.nonce, body.intent].every(value => OPAQUE.test(String(value)))) throw Object.assign(new Error('42501'), { code: '42501' });
    if (body.targetOrigin !== PRODUCTION_TARGET.parentOrigin) throw Object.assign(new Error('42501'), { code: '42501' });
    const issuedHub = call.values.length === 4 ? String(call.values[3]) : verifiedHub === 'investor' ? 'investor' : 'move';
    if (call.text.includes('hub_issue_context') && !['lender', 'insurance', 'contractor'].includes(issuedHub)) throw Object.assign(new Error('42501'), { code: '42501' });
    if (this.handoffs.has(body.code)) throw Object.assign(new Error('42501'), { code: '42501' });
    this.handoffs.set(body.code, { hub: issuedHub, subject: SUBJECT, nonce: body.nonce, state: body.state, used: false, expiresAt: now + 90_000 });
    return call;
  }
  consume(proof: AccountContextProof, callerHub: string, now: number) {
    const row = this.handoffs.get(proof.code);
    if (!row || row.used || row.expiresAt <= now || row.hub !== callerHub || row.nonce !== proof.nonce || row.state !== proof.state) {
      throw Object.assign(new Error('42501'), { code: '42501' });
    }
    row.used = true;
    return { subject: row.subject };
  }
}

let sequence = 0;
function proof(patch: Partial<AccountContextProof> = {}): AccountContextProof {
  sequence += 1;
  const token = (mark: string) => (mark + String(sequence)).padEnd(43, mark).slice(0, 43);
  return {
    code: token('c'), state: token('s'), nonce: token('n'), intent: token('i'),
    creationKey: '33333333-3333-4333-8333-333333333333',
    targetOrigin: PRODUCTION_TARGET.parentOrigin, rateBucket: 'r'.repeat(64), ...patch,
  };
}

function commit(broker: ContextBroker, issuedHub: string, callerHub: string, now = 1_000) {
  const body = proof();
  const call = broker.issue(issuedHub, body, now);
  let acked = false;
  try {
    broker.consume(body, callerHub, now);
    broker.saves.push(body.code);
    acked = true;
  } catch { /* A refused consume writes nothing and acknowledges nothing. */ }
  return { call, body, acked };
}

test('C D E F G the verified hub selects the issuer and the wrong hub cannot consume', () => {
  const broker = new ContextBroker();
  const shared = 'select v23_private.prod_hub_issue_context($1,$2,$3,$4) as issued';
  assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, 'move'), { text: 'select v23_private.prod_issue_context($1,$2,$3) as issued', hubArgument: false });
  assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, 'investor'), { text: 'select v23_private.prod_investor_issue_context($1,$2,$3) as issued', hubArgument: false });
  for (const hub of ['lender', 'insurance', 'contractor'] as const) {
    assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, hub), { text: shared, hubArgument: true }, hub);
  }
  for (const hub of ['senior', 'ask', '', 'move ', 'LENDER', 'contractor ']) {
    assert.throws(() => accountContextIssueQuery(PRODUCTION_TARGET, hub), (error: unknown) => error instanceof RuntimeError && error.message === 'unavailable');
  }

  const contractor = commit(broker, CONTRACTOR_CONTEXT_HUB, 'contractor');
  assert.equal(contractor.call.text, shared);
  assert.equal(contractor.call.values[3], 'contractor');
  assert.equal(Object.hasOwn(JSON.parse(String(contractor.call.values[0])), 'hub'), false);
  assert.equal(broker.handoffs.get(contractor.body.code)?.hub, 'contractor');
  assert.equal(contractor.acked, true);
  assert.equal(broker.saves.length, 1);

  const asLender = commit(broker, 'contractor', 'lender');
  assert.equal(asLender.call.values[3], 'contractor');
  assert.equal(asLender.acked, false);
  const asInsurance = commit(broker, 'contractor', 'insurance');
  assert.equal(asInsurance.acked, false);
  const moveIssued = commit(broker, 'move', 'contractor');
  assert.equal(moveIssued.call.text, 'select v23_private.prod_issue_context($1,$2,$3) as issued');
  assert.equal(moveIssued.call.values.length, 3);
  assert.equal(broker.handoffs.get(moveIssued.body.code)?.hub, 'move');
  assert.equal(moveIssued.acked, false);
  assert.equal(broker.saves.length, 1);
  assert.equal(JSON.stringify(broker.saves).toLowerCase().includes('watch'), false);
});

test('browser hub, sourceHub, issuer, and origin are not accepted on the proof', () => {
  const broker = new ContextBroker();
  for (const key of ['hub', 'sourceHub', 'issuer', 'issuerHub', 'origin'] as const) {
    const dirty = { ...proof(), [key]: key === 'origin' ? 'https://evil.example' : 'lender' };
    assert.throws(() => broker.issue('contractor', dirty as AccountContextProof, 1_000), (error: unknown) => error instanceof RuntimeError && error.message === 'unavailable');
  }
  assert.throws(() => broker.issue('contractor', proof({ targetOrigin: 'https://www.contractortrusthub.com' }), 1_000), (error: unknown) => error instanceof Error && (error as { code?: string }).code === '42501');
  assert.equal(broker.handoffs.size, 0);
  assert.equal(broker.saves.length, 0);
});

test('nonce, TTL, and single use still bind the contractor context', () => {
  const broker = new ContextBroker();
  const body = proof();
  broker.issue('contractor', body, 5_000);
  assert.throws(() => broker.consume({ ...body, nonce: 'n'.repeat(43) }, 'contractor', 5_000), (error: unknown) => (error as { code?: string }).code === '42501');
  broker.consume(body, 'contractor', 5_000);
  broker.saves.push(body.code);
  assert.throws(() => broker.consume(body, 'contractor', 5_000), (error: unknown) => (error as { code?: string }).code === '42501');
  const expired = proof();
  broker.issue('contractor', expired, 5_000);
  assert.throws(() => broker.consume(expired, 'contractor', 95_000), (error: unknown) => (error as { code?: string }).code === '42501');
  assert.equal(broker.saves.length, 1);
});

test('the exchange uses the verified caller hub and packet 16 adds no context SQL', () => {
  const assembly = readFileSync(new URL('./preview-assembly.ts', import.meta.url), 'utf8');
  const exchange = assembly.slice(assembly.indexOf('private async exchange'), assembly.indexOf('private ports('));
  assert.match(exchange, /const hub = a\.caller\.hub;/);
  assert.match(exchange, /accountContextIssueCall\(this\.target, hub, proof, p\.subject, p\.sessionBinding\)/);
  assert.match(exchange, /targetOrigin: this\.target\.parentOrigin/);
  assert.doesNotMatch(exchange, /sourceHub|issuerHub|headers\.get\('origin'\)/);
  const packet = ['16-ask-prod-contractor-dbpr-preflight.sql', '16-ask-prod-contractor-dbpr-binding-forward.sql', '16-ask-prod-contractor-dbpr-binding-rollback.sql'];
  for (const name of packet) {
    const sql = readFileSync(new URL(`../../../docs/my-trusthub/v2/production/${name}`, import.meta.url), 'utf8');
    assert.equal(sql.includes('hub_issue_context'), false, name);
    assert.equal(sql.includes('issue_context'), false, name);
  }
});

const nativeId = 'fl.dbpr.license:CCC057187';
const slug = 'ccc057187-a-r-roofing-inc';
const contractorIdentity = { hub: 'contractor' as const, nativeId, profileClass: 'contractor_profile' as const };

function stageFor(hub: 'move' | 'contractor'): GuestStageInput {
  if (hub === 'move') {
    const profile = { hub: 'move' as const, nativeId: 'fixture-mover', profileClass: 'mover' };
    return { version: TRANSFER_VERSION, sourceHub: 'move', audience: 'ask', selected: [{ localItemId: 'fixture-mover', revision: '1', digest: 'a'.repeat(64), profile }],
      returnTask: { kind: 'profile', hub: 'move', canonicalSlug: profile.nativeId, profile } };
  }
  return { version: TRANSFER_VERSION_V3, sourceHub: 'contractor', audience: 'ask', selected: [{ localItemId: slug, revision: '1', digest: 'a'.repeat(64), profile: contractorIdentity }],
    returnTask: { kind: 'profile', hub: 'contractor', canonicalSlug: slug, profile: contractorIdentity, returnPath: `/contractors/${slug}` } };
}

async function opened(hub: 'move' | 'contractor') {
  const backend = new SqliteHarnessBackend(join(mkdtempSync(join(tmpdir(), 'contractor-context-')), 'qa.sqlite'));
  const manifest = stageFor(hub);
  const profile = manifest.selected[0]!.profile;
  backend.profiles.set(profileKey(profile), { ...profile, published: true, supportedClass: true, binding: { id: 'fixture-binding', networkEntityId: 'fixture-entity', status: 'accepted' } });
  if (hub === 'contractor') backend.slugs.set(profileKey(profile), slug);
  let caller: VerifiedCaller = { hub, browserBinding: 'b'.repeat(43), environment: 'isolated', scopes: ['transfer:stage', 'saved:write', 'receipt:verify'] };
  const registry = { environment: 'isolated' as const, isolatedBackendVerified: true, origins: {
    move: 'http://127.0.0.1:4421', insurance: 'http://127.0.0.1:4422', lender: 'http://127.0.0.1:4423',
    contractor: 'http://127.0.0.1:4424', senior: 'http://127.0.0.1:4425', investor: 'http://127.0.0.1:4426' } };
  const runtime = new ParentProfileSaveRuntime({ enabled: true, backend, registry, now: () => 1_000, authenticate: async () => caller });
  const staged = await runtime.execute('prepareGuestProfileTransfer', manifest) as GuestStageRef;
  const prepared = await runtime.execute('prepareProfileSaveContinuation', { sourceHub: hub, audience: 'ask', transferRef: staged.transferRef, manifestDigest: staged.manifestDigest }) as { continuationRef: string };
  caller = { ...caller, parent: { subject: 'consumer-a', sessionBinding: 'session-a', admitted: true }, exchange: 'fixture-exchange', selectionConfirmed: true, confirmedTransferRef: staged.transferRef };
  return { backend, runtime, staged, prepared, manifest, use(next: VerifiedCaller['hub']) { caller = { ...caller, hub: next }; }, close: () => backend.close() };
}

test('B D E F G a contractor continuation is consumed only as contractor', async () => {
  const saved = await opened('contractor');
  try {
    assert.equal(saved.manifest.sourceHub, 'contractor');
    assert.equal(saved.manifest.selected[0]?.profile.hub, 'contractor');
    const consumed = await saved.runtime.execute('consumeProfileSaveContinuation', {
      continuationRef: saved.prepared.continuationRef, issuer: 'contractor', audience: 'ask', browserProof: 'b'.repeat(43),
    }) as { accountContextRef: string };
    const receipt = await saved.runtime.execute('commitProfileSave', {
      requestKey: 'r'.repeat(43) + ':0', accountContextRef: consumed.accountContextRef, transferRef: saved.staged.transferRef,
      manifestDigest: saved.staged.manifestDigest, item: saved.manifest.selected[0],
    }) as ItemReceipt;
    assert.equal(receipt.parent.outcome, 'saved');
    assert.equal(receipt.localCopy, 'keep');
    assert.equal(Object.hasOwn(receipt, 'watch'), false);
    assert.equal(Object.hasOwn(receipt, 'watchCreated'), false);
    assert.equal(saved.backend.count('saves'), 1);
  } finally { saved.close(); }

  for (const callerHub of ['lender', 'insurance'] as const) {
    const denied = await opened('contractor');
    try {
      denied.use(callerHub);
      await assert.rejects(() => denied.runtime.execute('consumeProfileSaveContinuation', {
        continuationRef: denied.prepared.continuationRef, issuer: callerHub, audience: 'ask', browserProof: 'b'.repeat(43),
      }), (error: unknown) => error instanceof RuntimeError);
      await assert.rejects(() => denied.runtime.execute('commitProfileSave', {
        requestKey: 'r'.repeat(43) + ':0', accountContextRef: 'a'.repeat(43), transferRef: denied.staged.transferRef,
        manifestDigest: denied.staged.manifestDigest, item: denied.manifest.selected[0],
      }));
      assert.equal(denied.backend.count('saves'), 0);
    } finally { denied.close(); }
  }

  const moveIssued = await opened('move');
  try {
    moveIssued.use('contractor');
    await assert.rejects(() => moveIssued.runtime.execute('consumeProfileSaveContinuation', {
      continuationRef: moveIssued.prepared.continuationRef, issuer: 'contractor', audience: 'ask', browserProof: 'b'.repeat(43),
    }), (error: unknown) => error instanceof RuntimeError);
    assert.equal(moveIssued.backend.count('saves'), 0);
  } finally { moveIssued.close(); }

  const lied = await opened('contractor');
  try {
    await assert.rejects(() => lied.runtime.execute('consumeProfileSaveContinuation', {
      continuationRef: lied.prepared.continuationRef, issuer: 'lender', audience: 'ask', browserProof: 'b'.repeat(43),
    }), (error: unknown) => error instanceof RuntimeError);
    assert.equal(lied.backend.count('saves'), 0);
  } finally { lied.close(); }
});

test('K L a failed contractor consume writes no Saved row and is not acknowledged', async () => {
  const hubs: string[] = [];
  const saved = await fixture({ environment: 'production', hub: 'contractor', intent: 'save', nativeId, slug, beforeConsume: caller => { hubs.push(caller.hub); } });
  try {
    saved.login();
    const response = await saved.get();
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), `https://www.contractortrusthub.com/contractors/${slug}`);
    assert.deepEqual(hubs, ['contractor']);
    assert.equal(saved.backend.count('saves'), 1);
    assert.equal(saved.acks, 1);
    const names = saved.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as { names: string };
    assert.equal(names.names, 'consumed,memberships,objects,quota,saves');
  } finally { saved.close(); }

  const failed = await fixture({ environment: 'production', hub: 'contractor', intent: 'save', nativeId, slug, beforeConsume: () => { throw new RuntimeError('unauthorized'); } });
  try {
    failed.login();
    const response = await failed.get();
    assert.equal(response.status, 303);
    assert.equal(failed.backend.count('saves'), 0);
    assert.equal(failed.acks, 0);
    assert.equal(failed.backend.count('consumed'), 0);
  } finally { failed.close(); }
});
