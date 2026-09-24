import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ProfileTransferModel } from './v2-3-profile-transfer.model.ts';
import { TRANSFER_VERSION, TRANSFER_VERSION_V2, TRANSFER_VERSION_V3, KEEP_LOCAL_COPY, PRODUCTION_ORIGINS, APPROVED_PROFILE_CLASS,
  isGuestStageInput, isGuestStageInputV2, isGuestStageInputV3, isContinuationInput, isConsumeInput,
  isCommitInput, isReceiptLookup, isReceiptVerify, manifestDigest, profileKey, profileReturnDestination, validateProfileReturn, v3ReturnPath,
  type GuestStageInput, type GuestStageInputV3, type ProfileReturnTaskV2, type TrustedOriginRegistry, type AuthorizedSpecialist, type VerifiedParentContext, type TrustedCommitAdapter,
} from './v2-3-profile-transfer.ts';
import type { SpecialistHub, TrustedProfile } from './v2-3-profile-save.ts';

const ref = (s: string) => s.repeat(43);
const profile: TrustedProfile = { hub: 'insurance', nativeId: 'provider-native-id', profileClass: 'agency', published: true,
  supportedClass: true, binding: { id: 'reviewed', networkEntityId: 'network-a', status: 'accepted' } };
const identity = { hub: profile.hub, nativeId: profile.nativeId, profileClass: profile.profileClass };
const item = { localItemId: 'local-a', revision: 'revision-2', digest: 'a'.repeat(64), profile: identity };
const stage: GuestStageInput = { version: TRANSFER_VERSION, sourceHub: 'insurance', audience: 'ask', selected: [item],
  returnTask: { kind: 'profile', hub: 'insurance', canonicalSlug: 'agency-profile', profile: identity } };
const registry: TrustedOriginRegistry = { environment: 'isolated', isolatedBackendVerified: true,
  origins: { move: 'http://localhost:3001', insurance: 'http://localhost:3003', lender: 'http://localhost:3002',
    contractor: 'http://localhost:3004', senior: 'http://localhost:3005', investor: 'http://localhost:3006' } };
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
    const task: ProfileReturnTaskV2 = { kind: 'profile', hub, canonicalSlug: 'agency-profile', profile: { hub, nativeId: identity.nativeId, profileClass: identity.profileClass } };
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

const sixOrigins = {
  move: 'http://localhost:3001', insurance: 'http://localhost:3003', lender: 'http://localhost:3002',
  contractor: 'http://localhost:3004', senior: 'http://localhost:3005', investor: 'http://localhost:3006',
};
const wide: TrustedOriginRegistry = { environment: 'isolated', isolatedBackendVerified: true, origins: sixOrigins };
function v3Stage(hub: SpecialistHub, slug: string, nativeId: string, profileClass = APPROVED_PROFILE_CLASS[hub]): GuestStageInputV3 {
  const profile = { hub, nativeId, profileClass };
  const item = { localItemId: slug, revision: 'rev-1', digest: 'a'.repeat(64), profile };
  return { version: TRANSFER_VERSION_V3, sourceHub: hub, audience: 'ask', selected: [item],
    returnTask: { kind: 'profile', hub, canonicalSlug: slug, profile, returnPath: v3ReturnPath(hub, slug, nativeId) ?? '' } };
}
const moveV2: GuestStageInput = { version: TRANSFER_VERSION_V2, sourceHub: 'move', audience: 'ask', selected: [{ ...item, profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' } }],
  returnTask: { kind: 'profile', hub: 'move', canonicalSlug: 'hindman-isaacs-moving-storage-inc', profile: { hub: 'move', nativeId: 'usdot-1002530', profileClass: 'mover' } } };

test('V01 version 2 Move stays accepted and its digest bytes omit returnPath', () => {
  assert.equal(isGuestStageInput(moveV2), true);
  assert.equal(isGuestStageInputV2(moveV2), true);
  assert.equal(isGuestStageInputV3(moveV2), false);
  const legacy = createHash('sha256').update(JSON.stringify([TRANSFER_VERSION_V2, 'move', 'ask',
    moveV2.selected.map(i => [i.localItemId, i.revision, i.digest, i.profile.hub, i.profile.nativeId, i.profile.profileClass]),
    ['profile', 'move', 'hindman-isaacs-moving-storage-inc', profileKey(moveV2.returnTask.profile)]])).digest('hex');
  assert.equal(manifestDigest(moveV2), legacy);
  assert.equal(profileReturnDestination(moveV2.returnTask, wide), 'http://localhost:3001/companies/hindman-isaacs-moving-storage-inc');
});
test('V02 version 3 Move is distinct, and each version rejects the other shape', () => {
  const moveV3 = v3Stage('move', 'hindman-isaacs-moving-storage-inc', 'usdot-1002530');
  assert.equal(isGuestStageInputV3(moveV3), true);
  assert.equal(isGuestStageInputV2(moveV3), false);
  assert.notEqual(manifestDigest(moveV2), manifestDigest(moveV3));
  assert.equal(isGuestStageInputV3(stage), false);
  assert.equal(isGuestStageInputV2(moveV3), false);
  assert.equal(isGuestStageInput({ ...moveV2, returnTask: { ...moveV2.returnTask, returnPath: '/companies/hindman-isaacs-moving-storage-inc' } }), false);
  assert.equal(isGuestStageInput({ ...moveV3, version: TRANSFER_VERSION_V2 }), false);
});
test('V03 six-hub return paths, national Lender, and Senior CCN segment', () => {
  const insurance = v3Stage('insurance', 'agency-profile', 'provider-native-id');
  const lender = v3Stage('lender', 'national-bank', 'institution-100');
  const contractor = v3Stage('contractor', 'roof-co', 'license-9');
  const investor = v3Stage('investor', 'advisory-firm', 'crd-42');
  const senior = v3Stage('senior', 'harbor-facility', 'AB12CD');
  for (const [input, path] of [[insurance, '/providers/agency-profile'], [lender, '/lender/national-bank'], [contractor, '/contractors/roof-co'], [investor, '/firm/advisory-firm'], [senior, '/facility/cms/AB12CD/harbor-facility']] as const) {
    assert.equal(isGuestStageInput(input), true, input.sourceHub);
    assert.equal(profileReturnDestination(input.returnTask, wide), wide.origins[input.sourceHub] + path);
    assert.equal(validateProfileReturn(path, input.returnTask, wide), wide.origins[input.sourceHub] + path);
  }
  const legacyLender = { ...lender, version: TRANSFER_VERSION_V2, returnTask: { kind: 'profile' as const, hub: 'lender' as const, canonicalSlug: 'national-bank', profile: lender.returnTask.profile } };
  assert.equal(isGuestStageInput(legacyLender), false);
  assert.equal(profileReturnDestination(legacyLender.returnTask, wide), 'http://localhost:3002/lenders/national-bank');
  assert.equal(isGuestStageInput({ ...lender, returnTask: { ...lender.returnTask, returnPath: '/lenders/national-bank' } }), false);
  assert.equal(isGuestStageInput(v3Stage('senior', 'harbor-facility', 'sunrise')), false);
  assert.equal(isGuestStageInput({ ...senior, returnTask: { ...senior.returnTask, returnPath: '/facility/harbor-facility' } }), false);
  assert.equal(isGuestStageInput(v3Stage('lender', 'national-bank', 'institution-100', 'mover')), false);
  assert.equal(isGuestStageInput({ ...lender, returnTask: { ...lender.returnTask, returnPath: '/lender/../admin' } }), false);
  assert.equal(validateProfileReturn('/lender/national-bank?saved=1', lender.returnTask, wide), null);
  assert.equal(validateProfileReturn('/lender/national-bank#done', lender.returnTask, wide), null);
  assert.equal(profileReturnDestination(senior.returnTask, { ...wide, origins: { ...sixOrigins, senior: '' } }), null);
  assert.equal(profileReturnDestination(lender.returnTask, { ...wide, environment: 'production', origins: { ...PRODUCTION_ORIGINS, lender: PRODUCTION_ORIGINS.move } }), null);
  assert.equal(profileReturnDestination(lender.returnTask, { ...wide, environment: 'production', origins: PRODUCTION_ORIGINS }), PRODUCTION_ORIGINS.lender + '/lender/national-bank');
});
test('V04 version 3 Save still requires a parent receipt and creates no Watch', () => {
  const input = v3Stage('move', 'hindman-isaacs-moving-storage-inc', 'usdot-1002530');
  const moveProfile: TrustedProfile = { ...input.returnTask.profile, published: true, supportedClass: true, binding: { id: 'reviewed', networkEntityId: 'network-a', status: 'accepted' } };
  const moveBff: AuthorizedSpecialist = { ...bff, hub: 'move' };
  const moveCtx: VerifiedParentContext = { ...ctx, authenticatedHub: 'move' };
  const model = new ProfileTransferModel();
  const staged = model.prepareGuestProfileTransfer(input, moveBff, wide, 0, input.returnTask);
  const continuation = model.prepareProfileSaveContinuation({ sourceHub: 'move', audience: 'ask', transferRef: staged.transferRef, manifestDigest: staged.manifestDigest }, moveBff, 1);
  model.consumeProfileSaveContinuation({ continuationRef: continuation.continuationRef, issuer: 'move', audience: 'ask', browserProof: moveBff.browserBinding }, moveCtx, 2);
  assert.equal(model.getProfileSaveReceipt({ requestKey: 'request-v3', accountContextRef: moveCtx.accountContextRef }, moveCtx), null);
  assert.equal(model.savedCount, 0);
  const receipt = model.commitProfileSave({ requestKey: 'request-v3', accountContextRef: moveCtx.accountContextRef, transferRef: staged.transferRef, manifestDigest: staged.manifestDigest, item: input.selected[0] }, moveCtx, { resolveCurrent: () => moveProfile, ownsProject: () => false }, 3);
  assert.equal(receipt.parent.outcome, 'saved');
  assert.equal(model.savedCount, 1);
  assert.equal(model.watches + model.alerts, 0);
});
