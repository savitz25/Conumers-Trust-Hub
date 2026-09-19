/** Executable HTTP integration harness; local synthetic identities ONLY.
 * Actual parent runtime/wire/storage, MOCKED parent admission, BFF and P12/P13.
 * Uses neither a specialist application backend nor a deployed Next route.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteHarnessBackend } from './v23-sqlite-backend.ts';
import { ParentProfileSaveRuntime, RuntimeError, type VerifiedCaller } from '../../lib/my-trusthub/profile-save/runtime.ts';
import { handleProfileSave } from '../../lib/my-trusthub/profile-save/http.ts';
import { PROFILE_SAVE_RUNTIME_VERSION } from '../../lib/my-trusthub/profile-save/interface.ts';
import { TRANSFER_VERSION, manifestDigest, profileKey, type GuestStageInput, type ItemReceipt } from '../../lib/my-trusthub/contracts/v2-3-profile-transfer.ts';

const backend = new SqliteHarnessBackend(join(mkdtempSync(join(tmpdir(), 'v23-move-http-')), 'receipts.sqlite'));
const profile = { hub: 'move' as const, nativeId: 'fixture-nj-mover', profileClass: 'fixture-only-moving-company' };
backend.profiles.set(profileKey(profile), { ...profile, published: true, supportedClass: true,
  binding: { id: 'fixture-binding', networkEntityId: 'fixture-network', status: 'accepted' } });
// Exact Move local row remains untouched: no implicit conversion/retirement.
const moveLocal = [{ companySlug: profile.nativeId, companyName: 'Fixture NJ mover', notes: 'private note never transferred', savedAt: '2026-09-19T00:00:00Z' }];
const before = JSON.stringify(moveLocal);
const stage: GuestStageInput = { version: TRANSFER_VERSION, sourceHub: 'move', audience: 'ask',
  selected: [{ localItemId: profile.nativeId, revision: '1', digest: 'a'.repeat(64), profile }],
  returnTask: { kind: 'profile', hub: 'move', canonicalSlug: profile.nativeId, profile } };
let origin = '', confirmedTransferRef: string | undefined;
let signedIn = false;
const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) { chunks.push(Buffer.from(c)); if (Buffer.concat(chunks).length > 65536) { res.writeHead(413); res.end(); return; } }
    const request = new Request(origin + req.url, { method: req.method, headers: req.headers as Record<string, string>, body: Buffer.concat(chunks) });
    const result = await handleProfileSave(request, { enabled: true, runtimeForRequest: async request => {
      // Test adapter stands in for existing authenticated BFF + Origin/CSRF layer.
      if (request.headers.get('origin') !== origin || request.headers.get('x-fixture-csrf') !== 'synthetic-browser-binding') throw new RuntimeError('unauthorized');
      const caller: VerifiedCaller = { hub: 'move', environment: 'isolated', browserBinding: 'b'.repeat(43), scopes: ['transfer:stage', 'saved:write', 'receipt:verify'],
        ...(signedIn ? { parent: { subject: 'fixture-consumer-a', sessionBinding: 'fixture-session', admitted: true as const },
          exchange: 'fixture-exchange', selectionConfirmed: true, confirmedTransferRef } : {}) };
      return new ParentProfileSaveRuntime({ enabled: true, backend, registry: { environment: 'isolated', isolatedBackendVerified: true,
        origins: { move: 'http://127.0.0.1:4421', insurance: 'http://127.0.0.1:4422', lender: 'http://127.0.0.1:4423' } }, authenticate: async () => caller });
    } });
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
  } catch { res.writeHead(500); res.end('Fixture failure'); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
async function post(operation: string, input: unknown, expectedStatus = 200, csrf = true) {
  const r = await fetch(origin + '/api/my-trusthub/profile-save', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin,
    ...(csrf ? { 'x-fixture-csrf': 'synthetic-browser-binding' } : {}) }, body: JSON.stringify({ version: PROFILE_SAVE_RUNTIME_VERSION, operation, input }) });
  assert.equal(r.status, expectedStatus); const body = await r.json(); return body.result;
}
try {
  await post('prepareGuestProfileTransfer', stage, 403, false);
  const staged = await post('prepareGuestProfileTransfer', stage);
  assert.equal(staged.manifestDigest, manifestDigest(stage));
  const continuation = await post('prepareProfileSaveContinuation', { sourceHub: 'move', audience: 'ask', transferRef: staged.transferRef, manifestDigest: staged.manifestDigest });
  const consume = { continuationRef: continuation.continuationRef, issuer: 'move', audience: 'ask', browserProof: 'b'.repeat(43) };
  await post('consumeProfileSaveContinuation', consume, 403);
  signedIn = true; confirmedTransferRef = staged.transferRef; // explicit isolated fixture confirmation
  const grant = await post('consumeProfileSaveContinuation', consume);
  const commit = { requestKey: 'http-move-save', accountContextRef: grant.accountContextRef, transferRef: grant.transferRef,
    manifestDigest: grant.manifestDigest, item: stage.selected[0] };
  const receipt: ItemReceipt = await post('commitProfileSave', commit);
  assert.equal(receipt.parent.outcome, 'saved'); assert.equal(receipt.localCopy, 'keep');
  assert.deepEqual(await post('commitProfileSave', commit), receipt);
  assert.deepEqual(await post('getProfileSaveReceipt', { requestKey: commit.requestKey, accountContextRef: grant.accountContextRef }), receipt);
  assert.deepEqual(await post('verifyProfileSaveReceipt', { requestKey: commit.requestKey, accountContextRef: grant.accountContextRef,
    receiptRef: receipt.receiptRef, manifestDigest: grant.manifestDigest, item: stage.selected[0] }), receipt);
  signedIn = false;
  await post('getProfileSaveReceipt', { requestKey: commit.requestKey, accountContextRef: grant.accountContextRef }, 403);
  assert.equal(JSON.stringify(moveLocal), before);
  assert.equal(backend.count('saves'), 1);
  console.log('MOVE HTTP HARNESS PASS: selected identity -> explicit MOCKED parent admission/P13 -> durable local receipt -> retry/verify; device row retained, no notes transferred. NOT live parent sync certification.');
} finally {
  server.close(); server.closeAllConnections(); await once(server, 'close'); backend.close();
}
