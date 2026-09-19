/** Deterministic reference model ONLY. Not imported by routes or hub adapters.
 * Maps stand in for atomic transactions and authenticated server storage.
 * Runtime must hash random references, enforce Origin/CSRF/rate limits, and
 * use P13 atomic consume + P12 owner/RLS operations. This is NOT RLS evidence.
 */
import { profileCapability } from './v2-3-profile-save.ts';
import {
  EXCHANGE_TTL_MS, STAGING_TTL_MS, isCommitInput, isConsumeInput, isContinuationInput, isGuestStageInput,
  isReceiptLookup, isReceiptVerify, itemKey, manifestDigest, profileKey, profileReturnDestination,
  type AuthorizedSpecialist, type CommitInput, type GuestStageInput, type ItemReceipt, type TrustedCommitAdapter,
  type TrustedOriginRegistry, type VerifiedParentContext, type ProfileReturnTask,
} from './v2-3-profile-transfer.ts';

export class ProfileTransferModel {
  #sequence = 0;
  #stages = new Map<string, { input: GuestStageInput; digest: string; browser: string; environment: string; expiresAt: number }>();
  #continuations = new Map<string, { transferRef: string; used: boolean; expiresAt: number }>();
  #grants = new Map<string, { subject: string; browser: string; hub: string; environment: string; transferRef: string }>();
  #receipts = new Map<string, { subject: string; browser: string; hub: string; environment: string; fingerprint: string; receipt: ItemReceipt }>();
  #rows = new Map<string, { ref: string; projects: Set<string> }>();
  readonly watches = 0;
  readonly alerts = 0;
  get savedCount() { return this.#rows.size; }
  #ref() { return String(++this.#sequence).padStart(43, '0'); } // fixture only; runtime CSPRNG
  #deny(): never { throw new Error('PROFILE_TRANSFER_UNAVAILABLE'); }
  #grant(ctx: VerifiedParentContext) {
    const grant = this.#grants.get(ctx.accountContextRef);
    if (!ctx.admitted || !ctx.scopes.includes('saved:write') || !grant || grant.subject !== ctx.subject ||
        grant.browser !== ctx.browserBinding || grant.hub !== ctx.authenticatedHub || grant.environment !== ctx.environment) this.#deny();
    return grant;
  }
  prepareGuestProfileTransfer(raw: unknown, bff: AuthorizedSpecialist, registry: TrustedOriginRegistry, now: number, trustedTask: ProfileReturnTask) {
    if (!isGuestStageInput(raw) || raw.sourceHub !== bff.hub || !bff.browserBinding || !bff.scopes.includes('transfer:stage') ||
        bff.environment !== registry.environment || !Number.isFinite(now) || !profileReturnDestination(trustedTask, registry) ||
        raw.returnTask.hub !== trustedTask.hub || raw.returnTask.canonicalSlug !== trustedTask.canonicalSlug ||
        profileKey(raw.returnTask.profile) !== profileKey(trustedTask.profile)) this.#deny();
    const input = structuredClone(raw);
    const transferRef = this.#ref(), digest = manifestDigest(input), expiresAt = now + STAGING_TTL_MS;
    this.#stages.set(transferRef, { input, digest, browser: bff.browserBinding, environment: bff.environment, expiresAt });
    return { transferRef, manifestDigest: digest, expiresAt };
  }
  prepareProfileSaveContinuation(raw: unknown, bff: AuthorizedSpecialist, now: number) {
    if (!isContinuationInput(raw) || raw.sourceHub !== bff.hub || !bff.scopes.includes('transfer:stage')) this.#deny();
    const stage = this.#stages.get(raw.transferRef);
    if (!stage || !Number.isFinite(now) || stage.expiresAt <= now || stage.digest !== raw.manifestDigest ||
        stage.input.sourceHub !== bff.hub || stage.browser !== bff.browserBinding || stage.environment !== bff.environment) this.#deny();
    const continuationRef = this.#ref();
    // Parent-held context may span account UI only until stage expiry. A fresh
    // authenticated 90-second exchange is minted after verification, not here.
    this.#continuations.set(continuationRef, { transferRef: raw.transferRef, used: false, expiresAt: stage.expiresAt });
    return { continuationRef, expiresAt: stage.expiresAt };
  }
  consumeProfileSaveContinuation(raw: unknown, ctx: VerifiedParentContext, now: number) {
    if (!isConsumeInput(raw) || !ctx.admitted || !ctx.scopes.includes('saved:write') || raw.issuer !== ctx.authenticatedHub ||
        raw.browserProof !== ctx.browserBinding) this.#deny();
    const continuation = this.#continuations.get(raw.continuationRef);
    const stage = continuation && this.#stages.get(continuation.transferRef);
    if (!continuation || continuation.used || !stage || !Number.isFinite(now) || continuation.expiresAt <= now || stage.expiresAt <= now ||
        stage.input.sourceHub !== raw.issuer || stage.browser !== ctx.browserBinding || stage.environment !== ctx.environment) this.#deny();
    // Model a trusted runtime-issued account-context reference; cannot rebind it.
    const prior = this.#grants.get(ctx.accountContextRef);
    if (prior && (prior.subject !== ctx.subject || prior.browser !== ctx.browserBinding || prior.hub !== raw.issuer ||
        prior.environment !== ctx.environment || prior.transferRef !== continuation.transferRef)) this.#deny();
    continuation.used = true;
    this.#grants.set(ctx.accountContextRef, { subject: ctx.subject, browser: ctx.browserBinding, hub: raw.issuer, environment: ctx.environment, transferRef: continuation.transferRef });
    return { accountContextRef: ctx.accountContextRef, transferRef: continuation.transferRef, manifestDigest: stage.digest,
      authenticatedExchangeExpiresAt: now + EXCHANGE_TTL_MS };
  }
  commitProfileSave(raw: unknown, ctx: VerifiedParentContext, adapter: TrustedCommitAdapter, now: number, projectFails = false): ItemReceipt {
    if (!isCommitInput(raw) || raw.accountContextRef !== ctx.accountContextRef) this.#deny();
    const grant = this.#grant(ctx), input: CommitInput = structuredClone(raw);
    if (grant.transferRef !== input.transferRef || input.item.profile.hub !== ctx.authenticatedHub) this.#deny();
    const key = JSON.stringify([ctx.subject, input.accountContextRef, input.requestKey]);
    const fingerprint = JSON.stringify([input.transferRef, input.manifestDigest, itemKey(input.item), input.projectRef ?? null]);
    const old = this.#receipts.get(key);
    if (old) {
      if (old.fingerprint !== fingerprint) this.#deny();
      return structuredClone(old.receipt);
    }
    const stage = this.#stages.get(input.transferRef);
    if (!stage || !Number.isFinite(now) || stage.expiresAt <= now || stage.digest !== input.manifestDigest ||
        !stage.input.selected.some(item => itemKey(item) === itemKey(input.item))) this.#deny();
    const current = adapter.resolveCurrent(input.item.profile); // commit-time lookup, never client binding
    if (current && profileKey(current) !== profileKey(input.item.profile)) this.#deny();
    const capability = current ? profileCapability(current) : 'SAVE_LOCAL_ONLY';
    const outcome = { SAVE_SUPPORTED: 'saved', SAVE_LOCAL_ONLY: 'local_only', IDENTITY_REVIEW_REQUIRED: 'identity_review_required',
      PROFILE_NOT_PUBLISHED: 'profile_not_published', UNSUPPORTED_CLASS: 'unsupported_class' }[capability] as ItemReceipt['parent']['outcome'];
    const receipt: ItemReceipt = { receiptRef: this.#ref(), requestKey: input.requestKey, accountContextRef: input.accountContextRef,
      manifestDigest: input.manifestDigest, item: input.item, parent: { outcome },
      project: input.projectRef ? { outcome: 'failed', projectRef: input.projectRef } : { outcome: 'not_requested' }, localCopy: 'keep' };
    if (capability === 'SAVE_SUPPORTED' && current?.binding) {
      const entityKey = JSON.stringify([ctx.subject, current.binding.networkEntityId]);
      const existing = this.#rows.get(entityKey), row = existing ?? { ref: this.#ref(), projects: new Set<string>() };
      receipt.parent = { outcome: existing ? 'already_saved' : 'saved', savedRef: row.ref };
      if (input.projectRef && !projectFails && adapter.ownsProject(ctx.subject, input.projectRef)) {
        receipt.project.outcome = row.projects.has(input.projectRef) ? 'already_member' : 'added';
        row.projects.add(input.projectRef);
      }
      this.#rows.set(entityKey, row);
    }
    this.#receipts.set(key, { subject: ctx.subject, browser: ctx.browserBinding, hub: ctx.authenticatedHub,
      environment: ctx.environment, fingerprint, receipt: structuredClone(receipt) });
    return structuredClone(receipt);
  }
  getProfileSaveReceipt(raw: unknown, ctx: VerifiedParentContext): ItemReceipt | null {
    if (!isReceiptLookup(raw) || raw.accountContextRef !== ctx.accountContextRef) this.#deny();
    this.#grant(ctx); // runtime verifies CURRENT session/admission on every call
    const value = this.#receipts.get(JSON.stringify([ctx.subject, raw.accountContextRef, raw.requestKey]));
    return value ? structuredClone(value.receipt) : null;
  }
  verifyProfileSaveReceipt(raw: unknown, bff: AuthorizedSpecialist, ctx: VerifiedParentContext): ItemReceipt | null {
    if (!isReceiptVerify(raw) || !bff.scopes.includes('receipt:verify') || bff.hub !== ctx.authenticatedHub ||
        bff.browserBinding !== ctx.browserBinding || bff.environment !== ctx.environment) this.#deny();
    const receipt = this.getProfileSaveReceipt({ requestKey: raw.requestKey, accountContextRef: raw.accountContextRef }, ctx);
    if (!receipt || receipt.receiptRef !== raw.receiptRef || receipt.manifestDigest !== raw.manifestDigest ||
        itemKey(receipt.item) !== itemKey(raw.item) || receipt.project.projectRef !== raw.projectRef) return null;
    return receipt; // authoritative stored outcome, NEVER browser-supplied success
  }
}
