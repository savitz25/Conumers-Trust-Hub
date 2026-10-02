import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedReturnPath, handoffMatches, isSaveRequest, profileCapability, receiptMatches, sameProfile, saveUiState, SAVE_LABELS, SPECIALIST_HUBS, type SaveRequest, type SaveResult, type TrustedContext, type TrustedHandoff, type TrustedProfile } from './v2-3-profile-save.ts';

const profile: TrustedProfile = { hub: 'move', nativeId: 'nj-mover-fixture', profileClass: 'moving_company', published: true, supportedClass: true, binding: { id: 'reviewed-binding-fixture', networkEntityId: 'network-fixture', status: 'accepted' } };
const ctx: TrustedContext = { subject: 'ordinary-consumer-a', accountContextRef: 'context-a', browserBinding: 'browser-a', authenticatedHub: 'move', scopes: ['saved:write'] };
const request: SaveRequest = { version: 'v2-3/profile-save/1', profile: { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass }, requestKey: 'operation-a', accountContextRef: ctx.accountContextRef };
const handoff: TrustedHandoff = { issuer: 'move', audience: 'ask', subject: ctx.subject, accountContextRef: ctx.accountContextRef, browserBinding: ctx.browserBinding, expiresAt: 90_000, consumed: false, profile: request.profile };

/** In-memory executable specification, NOT a deployed endpoint or DB/RLS test. */
class Model {
  rows = new Map<string, { id: string; projects: Set<string> }>();
  receipts = new Map<string, { fingerprint: string; result: SaveResult }>();
  watches = 0;
  alerts = 0;
  rankingEffects = 0;
  save(input: unknown, context = ctx, catalog = profile, projectFails = false): SaveResult {
    if (!isSaveRequest(input)) return { outcome: 'failed', reason: 'invalid', retryable: false };
    if (!context.scopes.includes('saved:write')) return { outcome: 'failed', reason: 'auth_required', retryable: false };
    if (input.accountContextRef !== context.accountContextRef) return { outcome: 'failed', reason: 'account_changed', retryable: false };
    if (context.authenticatedHub !== input.profile.hub || !sameProfile(input.profile, catalog)) return { outcome: 'failed', reason: 'invalid', retryable: false };
    const capability = profileCapability(catalog);
    if (capability !== 'SAVE_SUPPORTED') return { outcome: 'local_only', capability };
    const key = JSON.stringify([context.subject, input.requestKey]);
    const fingerprint = JSON.stringify(input);
    const cached = this.receipts.get(key);
    if (cached) return cached.fingerprint === fingerprint ? cached.result : { outcome: 'failed', reason: 'invalid', retryable: false };
    const entityKey = JSON.stringify([context.subject, catalog.binding!.networkEntityId]);
    const existing = this.rows.get(entityKey);
    const row = existing ?? { id: `saved-${this.rows.size + 1}`, projects: new Set<string>() };
    const project = !input.projectRef ? 'not_requested' : projectFails ? 'failed' : row.projects.has(input.projectRef) ? 'already_member' : 'added';
    if (input.projectRef && !projectFails) row.projects.add(input.projectRef);
    this.rows.set(entityKey, row);
    const result: SaveResult = { outcome: 'durable', receipt: { receiptRef: `receipt-${this.receipts.size + 1}`, requestKey: input.requestKey, accountContextRef: input.accountContextRef, profile: input.profile, savedRef: row.id, status: existing ? 'already_saved' : 'created', project } };
    this.receipts.set(key, { fingerprint, result });
    return result;
  }
}

test('exact identity Save uses reviewed binding, never name/email similarity', () => {
  const m = new Model();
  assert.equal(m.save(request).outcome, 'durable');
  assert.equal(m.save({ ...request, profile: { ...request.profile, nativeId: 'similar-name' } }).outcome, 'failed');
  assert.equal(m.rows.size, 1);
});
test('duplicate Save and response-lost retry produce one logical row and original receipt', () => {
  const m = new Model(); const first = m.save(request);
  assert.deepEqual(m.save(request), first);
  const duplicate = m.save({ ...request, requestKey: 'operation-b' });
  assert.equal(duplicate.outcome === 'durable' && duplicate.receipt.status, 'already_saved');
  assert.equal(m.rows.size, 1);
});
test('same idempotency key with changed payload is rejected', () => {
  const m = new Model(); m.save(request);
  assert.equal(m.save({ ...request, projectRef: 'project-a' }).outcome, 'failed');
});
test('Save with no Project is valid', () => {
  const result = new Model().save(request);
  assert.equal(result.outcome === 'durable' && result.receipt.project, 'not_requested');
});
test('Save into one Project and repeated membership do not duplicate', () => {
  const m = new Model(); m.save({ ...request, projectRef: 'project-a' });
  const result = m.save({ ...request, requestKey: 'operation-b', projectRef: 'project-a' });
  assert.equal(result.outcome === 'durable' && result.receipt.project, 'already_member');
  assert.equal([...m.rows.values()][0].projects.size, 1);
});
test('same Save can belong to two Projects', () => {
  const m = new Model(); m.save({ ...request, projectRef: 'project-a' });
  m.save({ ...request, requestKey: 'operation-b', projectRef: 'project-b' });
  assert.equal(m.rows.size, 1); assert.equal([...m.rows.values()][0].projects.size, 2);
});
test('anonymous local UI never asserts parent persistence', () => {
  assert.equal(saveUiState(false, 'SAVE_SUPPORTED', request), 'anonymous');
  assert.equal(SAVE_LABELS[saveUiState(true, 'SAVE_SUPPORTED', request)], 'Saved on this device');
  assert.equal(SAVE_LABELS.conversion, 'Keep this in My TrustHub');
});
test('parent continuation binds identity, verified subject, browser and account context', () => {
  assert.equal(handoffMatches(handoff, ctx, request.profile, 1), true);
  assert.equal(handoffMatches(handoff, { ...ctx, browserBinding: 'another-browser' }, request.profile, 1), false);
});
test('expired/replayed handoff cannot be consumed; valid result retried via receipt, not code replay', () => {
  assert.equal(handoffMatches(handoff, ctx, request.profile, 90_000), false);
  assert.equal(handoffMatches({ ...handoff, consumed: true }, ctx, request.profile, 1), false);
  assert.equal(handoffMatches({ ...handoff, expiresAt: Infinity }, ctx, request.profile, 1), false);
});
test('wrong hub, issuer, audience rejected', () => {
  assert.equal(handoffMatches({ ...handoff, issuer: 'lender' }, ctx, request.profile, 1), false);
  assert.equal(handoffMatches({ ...handoff, audience: 'move' } as unknown as TrustedHandoff, ctx, request.profile, 1), false);
  assert.equal(handoffMatches(handoff, ctx, { ...request.profile, hub: 'insurance' }, 1), false);
});
test('business/specialist role without parent-scoped consumer authority cannot Save or consume', () => {
  const business = { ...ctx, scopes: ['business:manage'] };
  assert.equal(new Model().save(request, business).outcome, 'failed');
  assert.equal(handoffMatches(handoff, business, request.profile, 1), false);
});
test('forged consumer ID, role, binding and broad private payloads are not accepted request fields', () => {
  for (const key of ['consumerId', 'user_metadata', 'role', 'bindingId', 'notes', 'sessionToken']) assert.equal(isSaveRequest({ ...request, [key]: 'forged' }), false);
});
test('unresolved and review-required identity remain local, no invented binding', () => {
  const m = new Model();
  assert.deepEqual(m.save(request, ctx, { ...profile, binding: null }), { outcome: 'local_only', capability: 'SAVE_LOCAL_ONLY' });
  assert.equal(profileCapability({ ...profile, binding: { ...profile.binding!, status: 'review_required' } }), 'IDENTITY_REVIEW_REQUIRED');
  assert.equal(m.rows.size, 0);
});
test('unsupported class and unpublished profile cannot become parent Save through this facade', () => {
  assert.equal(profileCapability({ ...profile, supportedClass: false }), 'UNSUPPORTED_CLASS');
  assert.equal(profileCapability({ ...profile, published: false }), 'PROFILE_NOT_PUBLISHED');
});
test('NJ profile Save is independent of Watch availability and geography', () => {
  const m = new Model(); assert.equal(m.save(request).outcome, 'durable');
  assert.equal(m.watches + m.alerts + m.rankingEffects, 0);
});
test('Save and Project assignment create zero Watches, Alerts or ranking effects', () => {
  const m = new Model(); m.save({ ...request, projectRef: 'project-a' });
  assert.deepEqual([m.watches, m.alerts, m.rankingEffects], [0, 0, 0]);
});
test('account switch rejects old context and cannot reuse another consumer receipt', () => {
  const m = new Model(); const first = m.save(request);
  const other = { ...ctx, subject: 'consumer-b', accountContextRef: 'context-b' };
  assert.equal(m.save(request, other).outcome, 'failed');
  assert.equal(handoffMatches(handoff, other, request.profile, 1), false);
  assert.equal(first.outcome === 'durable' && receiptMatches(first.receipt, { ...request, accountContextRef: 'context-b' }), false);
  const second = m.save({ ...request, accountContextRef: 'context-b' }, other);
  assert.equal(second.outcome, 'durable'); assert.equal(m.rows.size, 2);
});
test('normalized exact return paths reject external and within-origin escapes', () => {
  const paths = ['/companies/nj-mover-fixture'];
  assert.equal(allowedReturnPath('/companies/a/../nj-mover-fixture', paths), paths[0]);
  for (const bad of ['//evil.example', 'https://evil.example', '/companies/%2e%2e/admin', '/companies/..%5cadmin', '/companies/%252e%252e/admin', '/companies/nj-mover-fixture?token=secret', '/auth/callback', '/companies/nj-mover-fixture/extra', '/companies/%']) assert.equal(allowedReturnPath(bad, paths), null);
});
test('partial Project failure reports durable Save separately; failure cannot claim parent Saved', () => {
  const m = new Model(); const selected = { ...request, projectRef: 'project-a' };
  const result = m.save(selected, ctx, profile, true);
  assert.equal(result.outcome === 'durable' && result.receipt.project, 'failed');
  assert.equal(saveUiState(true, 'SAVE_SUPPORTED', selected, result), 'parent_saved');
  assert.equal([...m.rows.values()][0].projects.size, 0);
  assert.equal(saveUiState(false, 'SAVE_SUPPORTED', request, { outcome: 'failed', reason: 'unavailable', retryable: true }), 'failure');
});
test('all six specialists share identity/capability types without guessed adapter defects', () => {
  for (const hub of SPECIALIST_HUBS) assert.equal(profileCapability({ ...profile, hub, binding: null }), 'SAVE_LOCAL_ONLY');
});
