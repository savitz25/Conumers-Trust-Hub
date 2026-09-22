import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfileTransferModel } from './v2-3-profile-transfer.model.ts';
import { TRANSFER_VERSION, KEEP_LOCAL_COPY, PRODUCTION_ORIGINS, isGuestStageInput, isContinuationInput, isConsumeInput,
  isCommitInput, isReceiptLookup, isReceiptVerify, manifestDigest, profileReturnDestination, validateProfileReturn,
  type GuestStageInput, type TrustedOriginRegistry, type AuthorizedSpecialist, type VerifiedParentContext, type TrustedCommitAdapter,
} from './v2-3-profile-transfer.ts';
import type { TrustedProfile } from './v2-3-profile-save.ts';

const ref = (s: string) => s.repeat(43);
const profile: TrustedProfile = { hub: 'insurance', nativeId: 'provider-native-id', profileClass: 'agency', published: true,
  supportedClass: true, binding: { id: 'reviewed', networkEntityId: 'network-a', status: 'accepted' } };
const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
const item = { localItemId: 'local-a', revision: 'revision-2', digest: 'a'.repeat(64), profile: identity };
const stage: GuestStageInput = { version: TRANSFER_VERSION, sourceHub: 'insurance', audience: 'ask', selected: [item],
  returnTask: { kind: 'profile', hub: 'insurance', canonicalSlug: 'agency-profile', profile: identity } };
const registry: TrustedOriginRegistry = { environment: 'isolated', isolatedBackendVerified: true,
  origins: { move: 'http://localhost:3001', insurance: 'http://localhost:3003', lender: 'http://localhost:3002' } };
const bff: AuthorizedSpecialist = { hub: 'insurance', browserBinding: ref('b'), environment: 'isolated', scopes: ['transfer:stage', 'receipt:verify'] };
const ctx: VerifiedParentContext = { admitted: true, subject: 'consumer-a', authenticatedHub: 'insurance', browserBinding: ref('b'),
  environment: 'isolated', accountContextRef: ref('c'), scopes: ['saved:write'] };
const adapter: TrustedCommitAdapter = { resolveCurrent: () => profile, ownsProject: (subject, project) => subject === 'consumer-a' && [ref('p'), ref('q')].includes(project) };
function fixture(consumed = true) {
  const model = new ProfileTransferModel();
  const staged = model.prepareGuestProfileTransfer(stage, bff, registry, 0, stage.returnTask);
  const prepare = { sourceHub: stage.sourceHub, audience: 'ask' as const, transferRef: staged.transferRef, manifestDigest: staged.manifestDigest };
  const continuation = model.prepareProfileSaveContinuation(prepare, bff, 1);
  const consume = { continuationRef: continuation.continuationRef, issuer: bff.hub, audience: 'ask' as const, browserProof: bff.browserBinding };
  if (consumed) model.consumeProfileSaveContinuation(consume, ctx, 2);
  const commit = { requestKey: 'request-a', accountContextRef: ctx.accountContextRef, transferRef: staged.transferRef, manifestDigest: staged.manifestDigest, item };
  return { model, staged, prepare, consume, commit };
}
test('C01 bounded Insurance route, correct production host and isolated origin', () => {
  assert.equal(profileReturnDestination(stage.returnTask, registry), 'http://localhost:3003/providers/agency-profile');
  assert.equal(profileReturnDestination(stage.returnTask, { ...registry, environment: 'production', origins: PRODUCTION_ORIGINS }), 'https://www.insurancetrusthub.com/providers/agency-profile');
  assert.equal(validateProfileReturn('/providers/%61gency-profile', stage.returnTask, registry), 'http://localhost:3003/providers/agency-profile');
  assert.equal(profileReturnDestination(stage.returnTask, { ...registry, isolatedBackendVerified: false }), null);
  assert.equal(profileReturnDestination(stage.returnTask, { ...registry, origins: PRODUCTION_ORIGINS }), null);
  assert.equal(profileReturnDestination(stage.returnTask, { ...registry, environment: 'production' }), null);
});
test('C02 no arbitrary providers paths or normalized traversal/backslash/external escape', () => {
  for (const path of ['/providers/other', '//evil.invalid', 'https://evil.invalid/providers/agency-profile', '/providers/../providers/agency-profile',
    '/providers/%2e%2e/providers/agency-profile', '/providers/%252e%252e/admin', '/providers/a\\..\\agency-profile', '/providers/agency-profile?done=1',
    '/providers/agency-profile#x', '/auth/callback', '/providers/agency-profile/extra', '/providers/%', '/providers/%2f%2fevil.invalid'])
    assert.equal(validateProfileReturn(path, stage.returnTask, registry), null, path);
  assert.equal(profileReturnDestination({ ...stage.returnTask, canonicalSlug: '../admin' }, registry), null);
});
test('C03 Move and Lender keep distinct reviewed routes, identity-bound destination', () => {
  for (const [hub, prefix] of [['move', 'companies'], ['lender', 'lenders']] as const) {
    const task = { ...stage.returnTask, hub, profile: { ...identity, hub } };
    assert.equal(validateProfileReturn(`/${prefix}/agency-profile`, task, registry), `${registry.origins[hub]}/${prefix}/agency-profile`);
    assert.equal(validateProfileReturn('/providers/agency-profile', task, registry), null);
  }
  assert.equal(profileReturnDestination({ ...stage.returnTask, profile: { ...identity, hub: 'move' } }, registry), null);
});
test('C04 all six operations strictly reject missing/extra/forged input fields', () => {
  const f = fixture(); const receipt = f.model.commitProfileSave(f.commit, ctx, adapter, 3);
  const verify = { requestKey: receipt.requestKey, accountContextRef: receipt.accountContextRef, receiptRef: receipt.receiptRef, manifestDigest: receipt.manifestDigest, item };
  const samples: [unknown, (input: unknown) => boolean][] = [[stage, isGuestStageInput], [f.prepare, isContinuationInput], [f.consume, isConsumeInput],
    [f.commit, isCommitInput], [{ requestKey: 'request-a', accountContextRef: ctx.accountContextRef }, isReceiptLookup], [verify, isReceiptVerify]];
  for (const [input, validate] of samples) {
    assert.equal(validate(input), true);
    for (const key of Object.keys(input as object)) { const missing = { ...input as Record<string, unknown> }; delete missing[key]; assert.equal(validate(missing), false, key); }
    for (const field of ['consumerId', 'email', 'user_metadata', 'notes', 'session', 'binding', 'parentOutcome', 'returnUrl'])
      assert.equal(validate({ ...input as object, [field]: 'forged' }), false, field);
  }
  assert.equal(isGuestStageInput({ ...stage, selected: [{ ...item, notes: 'private' }] }), false);
  assert.equal(isCommitInput({ ...f.commit, item: { ...item, profile: { ...identity, networkEntityId: 'forged' } } }), false);
});
test('C05 explicit bounded staging rejects oversize, duplicate local IDs, wrong hub/audience', () => {
  assert.equal(isGuestStageInput({ ...stage, audience: 'move' }), false);
  assert.equal(isGuestStageInput({ ...stage, sourceHub: 'lender' }), false);
  assert.equal(isGuestStageInput({ ...stage, selected: [item, item] }), false);
  assert.equal(isGuestStageInput({ ...stage, selected: Array.from({ length: 51 }, (_, i) => ({ ...item, localItemId: String(i) })) }), false);
  const wide = Array.from({ length: 50 }, (_, i) => ({ ...item, localItemId: '界'.repeat(180) + i, revision: '界'.repeat(200), profile: { ...identity, nativeId: '界'.repeat(200), profileClass: '界'.repeat(200) } }));
  assert.equal(isGuestStageInput({ ...stage, selected: wide, returnTask: { ...stage.returnTask, profile: wide[0].profile } }), false);
  assert.throws(() => new ProfileTransferModel().prepareGuestProfileTransfer(stage, { ...bff, hub: 'lender' }, registry, 0, stage.returnTask));
  assert.throws(() => new ProfileTransferModel().prepareGuestProfileTransfer({ ...stage, returnTask: { ...stage.returnTask, canonicalSlug: 'forged-profile' } }, bff, registry, 0, stage.returnTask));
});
test('C06 canonical manifest digest is stable under property order, binds revision and return task', () => {
  assert.equal(manifestDigest(stage), manifestDigest({ returnTask: stage.returnTask, selected: stage.selected, audience: 'ask', sourceHub: 'insurance', version: TRANSFER_VERSION }));
  assert.notEqual(manifestDigest(stage), manifestDigest({ ...stage, selected: [{ ...item, revision: 'edited' }] }));
  assert.notEqual(manifestDigest(stage), manifestDigest({ ...stage, returnTask: { ...stage.returnTask, canonicalSlug: 'other-allowed-profile' } }));
});
test('C07 expired stage/continuation, replay and wrong browser/audience fail closed', () => {
  const f = fixture();
  assert.throws(() => f.model.prepareProfileSaveContinuation(f.prepare, bff, 600_000));
  assert.throws(() => f.model.consumeProfileSaveContinuation(f.consume, ctx, 4));
  for (const patch of [{ audience: 'move' }, { issuer: 'move' }, { browserProof: ref('x') }])
    { const fresh = fixture(false); assert.throws(() => fresh.model.consumeProfileSaveContinuation({ ...fresh.consume, ...patch }, ctx, 4)); }
  const expired = fixture(false);
  assert.throws(() => expired.model.consumeProfileSaveContinuation(expired.consume, ctx, 600_000));
  assert.throws(() => f.model.commitProfileSave(f.commit, ctx, adapter, 600_000));
});
test('C08 Save commit, lost-response lookup and duplicate retry retain one logical Save', () => {
  const f = fixture(), first = f.model.commitProfileSave(f.commit, ctx, adapter, 3);
  assert.equal(first.parent.outcome, 'saved');
  assert.deepEqual(f.model.commitProfileSave(f.commit, ctx, adapter, 999_999), first); // stored receipt, not new mutation
  assert.deepEqual(f.model.getProfileSaveReceipt({ requestKey: f.commit.requestKey, accountContextRef: ctx.accountContextRef }, ctx), first);
  assert.equal(f.model.savedCount, 1);
  assert.throws(() => f.model.commitProfileSave({ ...f.commit, projectRef: ref('p') }, ctx, adapter, 4));
});
test('C09 consumer switch, forged context, wrong BFF and business role cannot read/write receipt', () => {
  const f = fixture(); f.model.commitProfileSave(f.commit, ctx, adapter, 3);
  for (const other of [{ ...ctx, subject: 'consumer-b' }, { ...ctx, accountContextRef: ref('d') },
    { ...ctx, authenticatedHub: 'lender' as const }, { ...ctx, scopes: ['business:manage'] }, { ...ctx, browserBinding: ref('x') }]) {
    assert.throws(() => f.model.getProfileSaveReceipt({ requestKey: 'request-a', accountContextRef: ctx.accountContextRef }, other));
    assert.throws(() => f.model.commitProfileSave(f.commit, other, adapter, 4));
  }
});
test('C10 specialist verification uses authoritative receipt, rejects forged/stale digest and wrong Project', () => {
  const f = fixture(), receipt = f.model.commitProfileSave({ ...f.commit, projectRef: ref('p') }, ctx, adapter, 3);
  const verify = { requestKey: receipt.requestKey, accountContextRef: receipt.accountContextRef, receiptRef: receipt.receiptRef,
    manifestDigest: receipt.manifestDigest, item, projectRef: ref('p') };
  assert.deepEqual(f.model.verifyProfileSaveReceipt(verify, bff, ctx), receipt);
  for (const patch of [{ receiptRef: ref('z') }, { manifestDigest: 'b'.repeat(64) }, { item: { ...item, digest: 'b'.repeat(64) } }, { projectRef: ref('q') }])
    assert.equal(f.model.verifyProfileSaveReceipt({ ...verify, ...patch }, bff, ctx), null);
  assert.throws(() => f.model.verifyProfileSaveReceipt({ ...verify, parent: { outcome: 'saved' } }, bff, ctx));
  assert.throws(() => f.model.verifyProfileSaveReceipt(verify, { ...bff, hub: 'move' }, ctx));
  receipt.parent.outcome = 'failed'; // caller mutation cannot alter durable stored receipt
  assert.equal(f.model.verifyProfileSaveReceipt(verify, bff, ctx)?.parent.outcome, 'saved');
});
test('C11 Save success + Project failure, retry adds Project without duplicate Save or local deletion', () => {
  const f = fixture();
  const partial = f.model.commitProfileSave({ ...f.commit, projectRef: ref('p') }, ctx, adapter, 3, true);
  assert.equal(partial.parent.outcome, 'saved'); assert.equal(partial.project.outcome, 'failed'); assert.equal(partial.localCopy, 'keep');
  const retry = f.model.commitProfileSave({ ...f.commit, requestKey: 'project-retry', projectRef: ref('p') }, ctx, adapter, 4);
  assert.equal(retry.parent.outcome, 'already_saved'); assert.equal(retry.project.outcome, 'added');
  const second = f.model.commitProfileSave({ ...f.commit, requestKey: 'second-project', projectRef: ref('q') }, ctx, adapter, 5);
  assert.equal(second.project.outcome, 'added'); assert.equal(f.model.savedCount, 1);
  assert.equal(f.model.watches + f.model.alerts, 0); assert.equal(KEEP_LOCAL_COPY, true);
});
test('C12 commit-time publication, unsupported class, unresolved binding and review-required are distinct', () => {
  for (const [patch, outcome] of [[{ published: false }, 'profile_not_published'], [{ supportedClass: false }, 'unsupported_class'],
    [{ binding: null }, 'local_only'], [{ binding: { ...profile.binding!, status: 'review_required' as const } }, 'identity_review_required']] as const) {
    const f = fixture(), receipt = f.model.commitProfileSave(f.commit, ctx, { ...adapter, resolveCurrent: () => ({ ...profile, ...patch }) }, 3);
    assert.equal(receipt.parent.outcome, outcome); assert.equal(receipt.parent.savedRef, undefined);
    assert.equal(receipt.localCopy, 'keep'); assert.equal(f.model.savedCount, 0);
  }
});
test('C13 stale selected item and publication resolver identity substitution are rejected', () => {
  const f = fixture();
  assert.throws(() => f.model.commitProfileSave({ ...f.commit, item: { ...item, revision: 'new' } }, ctx, adapter, 3));
  assert.throws(() => f.model.commitProfileSave(f.commit, ctx, { ...adapter, resolveCurrent: () => ({ ...profile, nativeId: 'other' }) }, 3));
});

test('C14 no Project is required, another owner Project fails separately, no private receipt fields', () => {
  const f = fixture();
  const receipt = f.model.commitProfileSave(f.commit, ctx, adapter, 3);
  assert.deepEqual(receipt.project, {outcome:'not_requested'});
  const deniedProject = f.model.commitProfileSave({...f.commit, requestKey:'bad-project', projectRef:ref('z')},ctx,adapter,4);
  assert.equal(deniedProject.parent.outcome,'already_saved'); assert.equal(deniedProject.project.outcome,'failed');
  assert.doesNotMatch(JSON.stringify(deniedProject),/consumer-a|subject|email|notes/);
  assert.equal(f.model.savedCount,1); assert.equal(f.model.watches,0);
});
