import { createHash, randomBytes } from 'node:crypto';
import { profileCapability } from '../contracts/v2-3-profile-save.ts';
import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import {
  STAGING_TTL_MS, isGuestStageInput, isContinuationInput, isConsumeInput,
  isCommitInput, isReceiptLookup, isReceiptVerify, itemKey, manifestDigest,
  profileKey, profileReturnDestination,
  type GuestStageInput, type ItemReceipt, type ProfileReturnTask, type TrustedOriginRegistry,
  type FirstWaveHub,
} from '../contracts/v2-3-profile-transfer.ts';
import type { Operation } from './interface.ts';

export type RuntimeErrorCode = 'disabled' | 'unavailable' | 'invalid' | 'unauthorized' | 'expired' | 'conflict' | 'rate_limited';
export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  constructor(code: RuntimeErrorCode) { super(code); this.code = code; }
}
const deny = (code: RuntimeErrorCode = 'unauthorized'): never => { throw new RuntimeError(code); };
export const hash = (input: string) => createHash('sha256').update(input).digest('hex');
const opaque = () => randomBytes(32).toString('base64url');

/** Auth adapter output ONLY. Never construct from JSON, headers or URL claims.
 * sessionBinding changes on logout/account/session switch, not token refresh.
 */
export type VerifiedCaller = {
  hub: FirstWaveHub; browserBinding: string; environment: 'isolated';
  scopes: readonly string[];
  parent?: { subject: string; sessionBinding: string; admitted: true };
  /** Server-side reference to a fresh P13 exchange, not the guest continuation. */
  exchange?: string;
  selectionConfirmed?: boolean;
  /** From the server-held confirmation, not an extra wire/body field. */
  confirmedTransferRef?: string;
};
type Stage = { input: GuestStageInput; browser: string; digest: string; expiresAt: number };
type Continuation = { stageKey: string; used: boolean; expiresAt: number };
type Grant = { subject: string; session: string; browser: string; hub: FirstWaveHub; stageKey: string; expiresAt: number };
type StoredReceipt = { fingerprint: string; receipt: ItemReceipt };

/** One serializable transaction. All reads/writes, P13 consume, P12 Save and
 * receipt publication must commit together. No HTTP RPC inside this boundary.
 * Adapter MUST lock absent keys too (unique constraints + serializable retry).
 */
export interface RuntimeTransaction {
  read<T>(kind: 'stage' | 'continuation' | 'grant' | 'receipt', key: string): Promise<T | null>;
  put(kind: 'stage' | 'continuation' | 'grant' | 'receipt', key: string, value: unknown): Promise<void>;
  resolveProfile(identity: ProfileIdentity): Promise<TrustedProfile | null>;
  resolveReturnTask(identity: ProfileIdentity): Promise<ProfileReturnTask | null>;
  /** Existing P13 atomic broker consume; must return the verified subject. */
  consumeP13(exchange: string, caller: VerifiedCaller): Promise<{ subject: string }>;
  /** Existing P12 owner RPC in this transaction, with freshly verified owner. */
  saveP12(bindingId: string, caller: VerifiedCaller): Promise<{ savedRef: string; created: boolean; restored: boolean }>;
  /** Scoped Project reference resolver + P12 membership. Use a SAVEPOINT so
   * membership failure rolls back only membership, never a successful Save. */
  addProjectP12(projectRef: string, savedRef: string, caller: VerifiedCaller): Promise<'added' | 'already_member' | 'failed'>;
}
export interface RuntimeBackend {
  /** Committed separately so denied/rolled-back operations also consume quota. */
  rateLimit(key: string, now: number, maximum: number): Promise<boolean>;
  transaction<T>(work: (tx: RuntimeTransaction) => Promise<T>): Promise<T>;
}
export type RuntimeOptions = {
  enabled: boolean;
  registry: TrustedOriginRegistry;
  backend: RuntimeBackend;
  /** Revalidate current authenticated channel/session/admission every call. */
  authenticate: () => Promise<VerifiedCaller | null>;
  now?: () => number;
};

export class ParentProfileSaveRuntime {
  readonly options: RuntimeOptions;
  constructor(options: RuntimeOptions) { this.options = options; }

  async execute(operation: Operation, raw: unknown): Promise<unknown> {
    const { registry, backend } = this.options;
    if (!this.options.enabled || registry.environment !== 'isolated' || !registry.isolatedBackendVerified) deny('disabled');
    const caller = await this.options.authenticate();
    if (!caller || caller.environment !== 'isolated' || !['move', 'insurance', 'lender'].includes(caller.hub) ||
        !/^[A-Za-z0-9_-]{43}$/.test(caller.browserBinding)) deny();
    const c = caller!;
    const now = (this.options.now ?? Date.now)();
    if (!Number.isFinite(now)) deny('unavailable');
    // Snapshot mutable request/principal objects before crossing async boundaries.
    const input = structuredClone(raw), who = structuredClone(c);
    if (!await backend.rateLimit(hash(JSON.stringify([who.hub, who.browserBinding, operation])), now, 30)) deny('rate_limited');
    return backend.transaction(async tx => {
      const requireScope = (scope: string) => { if (!who.scopes.includes(scope)) deny(); };
      const requireParent = () => {
        requireScope('saved:write');
        if (!who.parent?.admitted || !who.parent.subject || !who.parent.sessionBinding) deny();
        return who.parent!;
      };
      const stageFor = async (key: string): Promise<Stage> => {
        const stage = await tx.read<Stage>('stage', key);
        if (!stage || stage.browser !== hash(who.browserBinding) || stage.input.sourceHub !== who.hub) deny();
        if (stage!.expiresAt <= now) deny('expired');
        return stage!;
      };
      const grantFor = async (ref: string): Promise<Grant> => {
        const parent = requireParent(), grant = await tx.read<Grant>('grant', hash(ref));
        if (!grant || grant.subject !== parent.subject || grant.session !== hash(parent.sessionBinding) ||
            grant.browser !== hash(who.browserBinding) || grant.hub !== who.hub) deny();
        if (grant!.expiresAt <= now) deny('expired');
        return grant!;
      };
      const receiptKey = (ref: string, key: string) => hash(JSON.stringify([requireParent().subject, ref, key]));

      if (operation === 'prepareGuestProfileTransfer') {
        requireScope('transfer:stage');
        if (!isGuestStageInput(input) || input.sourceHub !== who.hub) deny('invalid');
        const value = input as GuestStageInput;
        const task = await tx.resolveReturnTask(value.returnTask.profile);
        if (!task || profileKey(task.profile) !== profileKey(value.returnTask.profile) ||
            task.hub !== value.returnTask.hub || task.canonicalSlug !== value.returnTask.canonicalSlug ||
            !profileReturnDestination(task, registry)) deny('invalid');
        const transferRef = opaque(), digest = manifestDigest(value), expiresAt = now + STAGING_TTL_MS;
        await tx.put('stage', hash(transferRef), { input: value, browser: hash(who.browserBinding), digest, expiresAt } satisfies Stage);
        return { transferRef, manifestDigest: digest, expiresAt };
      }
      if (operation === 'prepareProfileSaveContinuation') {
        requireScope('transfer:stage');
        if (!isContinuationInput(input) || input.sourceHub !== who.hub) deny('invalid');
        const v = input as Parameters<typeof isContinuationInput>[0] & { transferRef: string; manifestDigest: string };
        const stageKey = hash(v.transferRef), stage = await stageFor(stageKey);
        if (stage.digest !== v.manifestDigest) deny('conflict');
        const continuationRef = opaque();
        await tx.put('continuation', hash(continuationRef), { stageKey, used: false, expiresAt: stage.expiresAt } satisfies Continuation);
        return { continuationRef, expiresAt: stage.expiresAt };
      }
      if (operation === 'consumeProfileSaveContinuation') {
        const parent = requireParent();
        if (!isConsumeInput(input)) deny('invalid');
        const v = input as { continuationRef: string; issuer: string; browserProof: string };
        if (v.issuer !== who.hub || v.browserProof !== who.browserBinding || !who.exchange || who.selectionConfirmed !== true) deny();
        const key = hash(v.continuationRef), continuation = await tx.read<Continuation>('continuation', key);
        if (!continuation || continuation.used) deny('conflict');
        const stage = await stageFor(continuation!.stageKey);
        if (continuation!.expiresAt <= now) deny('expired');
        const exchange = await tx.consumeP13(who.exchange!, who);
        if (exchange.subject !== parent.subject) deny();
        const accountContextRef = opaque();
        await tx.put('grant', hash(accountContextRef), { subject: parent.subject, session: hash(parent.sessionBinding),
          browser: hash(who.browserBinding), hub: who.hub, stageKey: continuation!.stageKey,
          expiresAt: now + STAGING_TTL_MS } satisfies Grant);
        await tx.put('continuation', key, { ...continuation, used: true });
        // The original reference is carried by verified confirmation; storage
        // retains only its hash and never exposes another browser's manifest.
        const transferRef = who.confirmedTransferRef;
        if (!transferRef || hash(transferRef) !== continuation!.stageKey) deny();
        return { accountContextRef, transferRef, manifestDigest: stage.digest };
      }
      if (operation === 'commitProfileSave') {
        if (!isCommitInput(input)) deny('invalid');
        const v = input as import('../contracts/v2-3-profile-transfer.ts').CommitInput;
        const grant = await grantFor(v.accountContextRef);
        if (grant.stageKey !== hash(v.transferRef) || v.item.profile.hub !== who.hub) deny();
        const key = receiptKey(v.accountContextRef, v.requestKey);
        const fingerprint = hash(JSON.stringify([hash(v.transferRef), v.manifestDigest, itemKey(v.item), v.projectRef ?? null]));
        const previous = await tx.read<StoredReceipt>('receipt', key);
        if (previous) {
          if (previous.fingerprint !== fingerprint) deny('conflict');
          return previous.receipt;
        }
        const stage = await stageFor(grant.stageKey);
        if (stage.digest !== v.manifestDigest || !stage.input.selected.some(i => itemKey(i) === itemKey(v.item))) deny('conflict');
        const profile = await tx.resolveProfile(v.item.profile);
        if (profile && profileKey(profile) !== profileKey(v.item.profile)) deny('invalid');
        const capability = profile ? profileCapability(profile) : 'SAVE_LOCAL_ONLY';
        const outcomes = { SAVE_SUPPORTED: 'saved', SAVE_LOCAL_ONLY: 'local_only', IDENTITY_REVIEW_REQUIRED: 'identity_review_required',
          PROFILE_NOT_PUBLISHED: 'profile_not_published', UNSUPPORTED_CLASS: 'unsupported_class' } as const;
        const receipt: ItemReceipt = { receiptRef: opaque(), requestKey: v.requestKey, accountContextRef: v.accountContextRef,
          manifestDigest: v.manifestDigest, item: v.item, parent: { outcome: outcomes[capability] },
          project: v.projectRef ? { outcome: 'failed', projectRef: v.projectRef } : { outcome: 'not_requested' }, localCopy: 'keep' };
        if (capability === 'SAVE_SUPPORTED' && profile?.binding) {
          const saved = await tx.saveP12(profile.binding.id, who);
          if (!saved.savedRef) deny('unavailable');
          receipt.parent = { outcome: saved.created || saved.restored ? 'saved' : 'already_saved', savedRef: saved.savedRef };
          if (v.projectRef) receipt.project.outcome = await tx.addProjectP12(v.projectRef, saved.savedRef, who);
        }
        await tx.put('receipt', key, { fingerprint, receipt } satisfies StoredReceipt);
        return receipt;
      }
      if (operation === 'getProfileSaveReceipt' || operation === 'verifyProfileSaveReceipt') {
        if (!(operation === 'getProfileSaveReceipt' ? isReceiptLookup(input) : isReceiptVerify(input))) deny('invalid');
        const v = input as import('../contracts/v2-3-profile-transfer.ts').ReceiptVerifyInput;
        await grantFor(v.accountContextRef);
        if (operation === 'verifyProfileSaveReceipt') requireScope('receipt:verify');
        const row = await tx.read<StoredReceipt>('receipt', receiptKey(v.accountContextRef, v.requestKey));
        if (!row) return null;
        const r = row.receipt;
        if (operation === 'verifyProfileSaveReceipt' && (r.receiptRef !== v.receiptRef || r.manifestDigest !== v.manifestDigest ||
            itemKey(r.item) !== itemKey(v.item) || r.project.projectRef !== v.projectRef)) return null;
        return r;
      }
      return deny('invalid');
    });
  }
}
