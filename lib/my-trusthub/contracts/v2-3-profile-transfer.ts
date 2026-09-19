/** V2-3C wire specification. No endpoint, credentials, adapter or database writes.
 * All Trusted* arguments come from verified server adapters, never request JSON.
 */
import { createHash } from 'node:crypto';
import type { ProfileIdentity, SpecialistHub, TrustedContext, TrustedProfile } from './v2-3-profile-save.ts';

export const TRANSFER_VERSION = 'v2-3/selected-profiles/2' as const;
export const KEEP_LOCAL_COPY = true as const;
export const MAX_ITEMS = 50;
export const MAX_BYTES = 65_536;
export const STAGING_TTL_MS = 600_000;
export const EXCHANGE_TTL_MS = 90_000;
export type FirstWaveHub = 'move' | 'insurance' | 'lender';
export type Environment = 'production' | 'isolated';
export const PROFILE_ROUTES = { move: '/companies/', insurance: '/providers/', lender: '/lenders/' } as const;
export const PRODUCTION_ORIGINS = {
  move: 'https://www.movetrusthub.com', insurance: 'https://www.insurancetrusthub.com', lender: 'https://www.lendertrusthub.com',
} as const;
export type TrustedOriginRegistry = { environment: Environment; origins: Record<FirstWaveHub, string>; isolatedBackendVerified: boolean };
export type ProfileReturnTask = { kind: 'profile'; hub: FirstWaveHub; canonicalSlug: string; profile: ProfileIdentity };
export type SelectedItem = { localItemId: string; revision: string; digest: string; profile: ProfileIdentity };
export type GuestStageInput = {
  version: typeof TRANSFER_VERSION; sourceHub: FirstWaveHub; audience: 'ask'; selected: SelectedItem[]; returnTask: ProfileReturnTask;
};
export type GuestStageRef = { transferRef: string; manifestDigest: string; expiresAt: number };
export type ContinuationInput = { sourceHub: FirstWaveHub; audience: 'ask'; transferRef: string; manifestDigest: string };
export type ConsumeInput = { continuationRef: string; issuer: FirstWaveHub; audience: 'ask'; browserProof: string };
export type CommitInput = {
  requestKey: string; accountContextRef: string; transferRef: string; manifestDigest: string; item: SelectedItem; projectRef?: string;
};
export type ReceiptLookupInput = { requestKey: string; accountContextRef: string };
export type ReceiptVerifyInput = ReceiptLookupInput & { receiptRef: string; manifestDigest: string; item: SelectedItem; projectRef?: string };
export type ParentSaveOutcome = 'saved' | 'already_saved' | 'local_only' | 'identity_review_required' | 'profile_not_published' | 'unsupported_class' | 'failed';
export type ProjectOutcome = 'not_requested' | 'added' | 'already_member' | 'failed';
export type ItemReceipt = {
  receiptRef: string; requestKey: string; accountContextRef: string; manifestDigest: string; item: SelectedItem;
  parent: { outcome: ParentSaveOutcome; savedRef?: string };
  project: { outcome: ProjectOutcome; projectRef?: string };
  localCopy: 'keep';
};
/** Fixed operation names shared by parent and specialist BFF implementations.
 * Scoped authenticated channels/verified contexts are implicit, not body fields.
 * No operation accepts a consumer UUID, email, private notes or tool payload.
 */
export interface ProfileTransferPort {
  prepareGuestProfileTransfer(input: GuestStageInput): Promise<GuestStageRef>;
  prepareProfileSaveContinuation(input: ContinuationInput): Promise<{ continuationRef: string; expiresAt: number }>;
  consumeProfileSaveContinuation(input: ConsumeInput): Promise<{ accountContextRef: string; transferRef: string; manifestDigest: string }>;
  commitProfileSave(input: CommitInput): Promise<ItemReceipt>;
  getProfileSaveReceipt(input: ReceiptLookupInput): Promise<ItemReceipt | null>;
  verifyProfileSaveReceipt(input: ReceiptVerifyInput): Promise<ItemReceipt | null>;
}

const hubs: readonly string[] = ['move', 'insurance', 'lender'];
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\u0000-\u001f\u007f]/.test(v);
const opaque = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function exact(v: unknown, required: string[], optional: string[] = []): v is Record<string, unknown> {
  return record(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
}
export function isProfileIdentity(v: unknown): v is ProfileIdentity {
  return exact(v, ['hub', 'nativeId', 'profileClass']) && hubs.includes(v.hub as string) && text(v.nativeId) && text(v.profileClass);
}
export function isSelectedItem(v: unknown): v is SelectedItem {
  return exact(v, ['localItemId', 'revision', 'digest', 'profile']) && text(v.localItemId) && text(v.revision) && digest(v.digest) && isProfileIdentity(v.profile);
}
export function isReturnTask(v: unknown): v is ProfileReturnTask {
  return exact(v, ['kind', 'hub', 'canonicalSlug', 'profile']) && v.kind === 'profile' && hubs.includes(v.hub as string) &&
    typeof v.canonicalSlug === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(v.canonicalSlug) &&
    isProfileIdentity(v.profile) && v.profile.hub === v.hub;
}
export function profileKey(p: ProfileIdentity): string { return JSON.stringify([p.hub, p.nativeId, p.profileClass]); }
export function itemKey(i: SelectedItem): string { return JSON.stringify([i.localItemId, i.revision, i.digest, profileKey(i.profile)]); }
export function isGuestStageInput(v: unknown): v is GuestStageInput {
  if (!exact(v, ['version', 'sourceHub', 'audience', 'selected', 'returnTask']) || v.version !== TRANSFER_VERSION ||
      !hubs.includes(v.sourceHub as string) || v.audience !== 'ask' || !Array.isArray(v.selected) ||
      !v.selected.length || v.selected.length > MAX_ITEMS || !isReturnTask(v.returnTask) || v.returnTask.hub !== v.sourceHub) return false;
  if (!v.selected.every(i => isSelectedItem(i) && i.profile.hub === v.sourceHub)) return false;
  const items = v.selected as SelectedItem[];
  if (new Set(items.map(i => i.localItemId)).size !== items.length || !items.some(i => profileKey(i.profile) === profileKey((v.returnTask as ProfileReturnTask).profile))) return false;
  try { return new TextEncoder().encode(JSON.stringify(v)).length <= MAX_BYTES; } catch { return false; }
}
/** SHA-256 of versioned positional UTF-8 JSON. Selection order is significant;
 * arbitrary object property insertion order is not. No notes enter this digest.
 */
export function manifestDigest(v: GuestStageInput): string {
  if (!isGuestStageInput(v)) throw new Error('INVALID_MANIFEST');
  return createHash('sha256').update(JSON.stringify([v.version, v.sourceHub, v.audience,
    v.selected.map(i => [i.localItemId, i.revision, i.digest, i.profile.hub, i.profile.nativeId, i.profile.profileClass]),
    [v.returnTask.kind, v.returnTask.hub, v.returnTask.canonicalSlug, profileKey(v.returnTask.profile)]])).digest('hex');
}
export function isContinuationInput(v: unknown): v is ContinuationInput {
  return exact(v, ['sourceHub', 'audience', 'transferRef', 'manifestDigest']) && hubs.includes(v.sourceHub as string) &&
    v.audience === 'ask' && opaque(v.transferRef) && digest(v.manifestDigest);
}
export function isConsumeInput(v: unknown): v is ConsumeInput {
  return exact(v, ['continuationRef', 'issuer', 'audience', 'browserProof']) && hubs.includes(v.issuer as string) &&
    v.audience === 'ask' && opaque(v.continuationRef) && opaque(v.browserProof);
}
export function isCommitInput(v: unknown): v is CommitInput {
  return exact(v, ['requestKey', 'accountContextRef', 'transferRef', 'manifestDigest', 'item'], ['projectRef']) &&
    text(v.requestKey) && opaque(v.accountContextRef) && opaque(v.transferRef) && digest(v.manifestDigest) && isSelectedItem(v.item) &&
    (v.projectRef === undefined || opaque(v.projectRef));
}
export function isReceiptLookup(v: unknown): v is ReceiptLookupInput {
  return exact(v, ['requestKey', 'accountContextRef']) && text(v.requestKey) && opaque(v.accountContextRef);
}
export function isReceiptVerify(v: unknown): v is ReceiptVerifyInput {
  return exact(v, ['requestKey', 'accountContextRef', 'receiptRef', 'manifestDigest', 'item'], ['projectRef']) &&
    text(v.requestKey) && opaque(v.accountContextRef) && opaque(v.receiptRef) && digest(v.manifestDigest) && isSelectedItem(v.item) &&
    (v.projectRef === undefined || opaque(v.projectRef));
}
/** Use ONLY a server-resolved task. Browser input must not choose canonicalSlug or profile. */
export function profileReturnDestination(task: ProfileReturnTask, registry: TrustedOriginRegistry): string | null {
  if (!isReturnTask(task) || !['production', 'isolated'].includes(registry.environment)) return null;
  const origin = registry.origins[task.hub];
  try {
    const u = new URL(origin);
    if (u.origin !== origin || u.username || u.password || u.search || u.hash) return null;
    if (registry.environment === 'production' ? origin !== PRODUCTION_ORIGINS[task.hub] :
      !registry.isolatedBackendVerified || Object.values(PRODUCTION_ORIGINS).includes(origin as typeof PRODUCTION_ORIGINS.move) ||
      (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))) return null;
    return origin + PROFILE_ROUTES[task.hub] + task.canonicalSlug;
  } catch { return null; }
}
export function validateProfileReturn(input: unknown, task: ProfileReturnTask, registry: TrustedOriginRegistry): string | null {
  const expected = profileReturnDestination(task, registry);
  if (!expected || typeof input !== 'string' || input.length > 500 || !input.startsWith('/') || input.startsWith('//')) return null;
  try {
    const decoded = decodeURIComponent(input);
    if (/[\\\s?#%\u0000-\u001f]/.test(decoded) || decoded.startsWith('//')) return null;
    const normalized = new URL(decoded, registry.origins[task.hub]);
    // Reject traversal even when normalization happens to land on the allowed profile.
    if (decoded.split('/').some(segment => segment === '.' || segment === '..')) return null;
    return normalized.href === expected ? expected : null;
  } catch { return null; }
}
export type TrustedMapper = {
  /** Backend resolver validates native namespace/class and current publication.
   * No name/email/geography matching. Null => retain local copy, no parent Save.
   */
  resolveLocalItem(localItemId: string, capturedRevision: string): Promise<TrustedProfile | null>;
};
export type VerifiedParentContext = TrustedContext & { admitted: true; environment: Environment };
export type AuthorizedSpecialist = { hub: FirstWaveHub; browserBinding: string; environment: Environment; scopes: readonly string[] };
export type TrustedCommitAdapter = {
  resolveCurrent(profile: ProfileIdentity): TrustedProfile | null;
  ownsProject(subject: string, projectRef: string): boolean;
};
export type SpecialistIdentityHub = SpecialistHub;
