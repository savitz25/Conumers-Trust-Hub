/** V2-3C wire specification. No endpoint, credentials, adapter or database writes.
 * All Trusted* arguments come from verified server adapters, never request JSON.
 */
import { createHash } from 'node:crypto';
import { SPECIALIST_HUBS, type ProfileIdentity, type SpecialistHub, type TrustedContext, type TrustedProfile } from './v2-3-profile-save.ts';

/** Compatibility wire. Do not reinterpret /2 as national Lender or as /3. */
export const TRANSFER_VERSION_V2 = 'v2-3/selected-profiles/2' as const;
export const TRANSFER_VERSION_V3 = 'v2-3/selected-profiles/3' as const;
export const TRANSFER_VERSION = TRANSFER_VERSION_V2;
export const KEEP_LOCAL_COPY = true as const;
export const MAX_ITEMS = 50;
export const MAX_BYTES = 65_536;
export const STAGING_TTL_MS = 600_000;
export const EXCHANGE_TTL_MS = 90_000;
export type Environment = 'production' | 'isolated';
/** V2 route map only. National Lender uses /lender/{slug} on version 3. */
export const PROFILE_ROUTES = { move: '/companies/', insurance: '/providers/', lender: '/lenders/' } as const;
type V2RouteHub = keyof typeof PROFILE_ROUTES;
/** Version 2 stages that remain admissible. Lender /2 is not in this subset. */
const V2_STAGE_HUBS = ['move', 'insurance'] as const satisfies readonly SpecialistHub[];
export const APPROVED_PROFILE_CLASS = {
  move: 'mover', insurance: 'insurance_provider', lender: 'national_institution',
  contractor: 'contractor_profile', senior: 'cms_facility', investor: 'official_firm',
} as const satisfies Record<SpecialistHub, string>;
const SENIOR_CCN = /^[A-Z0-9]{6}$/;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
export const PRODUCTION_ORIGINS = {
  move: 'https://www.movetrusthub.com',
  insurance: 'https://www.insurancetrusthub.com',
  lender: 'https://www.lendertrusthub.com',
  contractor: 'https://www.contractortrusthub.com',
  senior: 'https://www.seniortrusthub.com',
  investor: 'https://www.investortrusthub.com',
} as const satisfies Record<SpecialistHub, string>;
export type TrustedOriginRegistry = { environment: Environment; origins: Record<SpecialistHub, string>; isolatedBackendVerified: boolean };
export type ProfileReturnTaskV2 = { kind: 'profile'; hub: V2RouteHub; canonicalSlug: string; profile: ProfileIdentity };
export type ProfileReturnTaskV3 = { kind: 'profile'; hub: SpecialistHub; canonicalSlug: string; profile: ProfileIdentity; returnPath: string };
export type ProfileReturnTask = ProfileReturnTaskV2 | ProfileReturnTaskV3;
export type SelectedItem = { localItemId: string; revision: string; digest: string; profile: ProfileIdentity };
export type GuestStageInputV2 = {
  version: typeof TRANSFER_VERSION_V2; sourceHub: typeof V2_STAGE_HUBS[number]; audience: 'ask'; selected: SelectedItem[]; returnTask: ProfileReturnTaskV2;
};
export type GuestStageInputV3 = {
  version: typeof TRANSFER_VERSION_V3; sourceHub: SpecialistHub; audience: 'ask'; selected: SelectedItem[]; returnTask: ProfileReturnTaskV3;
};
export type GuestStageInput = GuestStageInputV2 | GuestStageInputV3;
export type GuestStageRef = { transferRef: string; manifestDigest: string; expiresAt: number };
export type ContinuationInput = { sourceHub: SpecialistHub; audience: 'ask'; transferRef: string; manifestDigest: string };
export type ConsumeInput = { continuationRef: string; issuer: SpecialistHub; audience: 'ask'; browserProof: string };
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

const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\u0000-\u001f\u007f]/.test(v);
const opaque = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function exact(v: unknown, required: string[], optional: string[] = []): v is Record<string, unknown> {
  return record(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
}
const specialistHub = (v: unknown): v is SpecialistHub => SPECIALIST_HUBS.includes(v as SpecialistHub);
const v2RouteHub = (v: unknown): v is V2RouteHub => v === 'move' || v === 'insurance' || v === 'lender';
const v2StageHub = (v: unknown): v is GuestStageInputV2['sourceHub'] => v === 'move' || v === 'insurance';
export function v3ReturnPath(hub: SpecialistHub, canonicalSlug: string, nativeId: string): string | null {
  if (!SLUG.test(canonicalSlug)) return null;
  if (hub === 'move') return `/companies/${canonicalSlug}`;
  if (hub === 'insurance') return `/providers/${canonicalSlug}`;
  if (hub === 'lender') return `/lender/${canonicalSlug}`;
  if (hub === 'contractor') return `/contractors/${canonicalSlug}`;
  if (hub === 'investor') return `/firm/${canonicalSlug}`;
  return SENIOR_CCN.test(nativeId) ? `/facility/cms/${nativeId}/${canonicalSlug}` : null;
}
export function isProfileIdentity(v: unknown): v is ProfileIdentity {
  return exact(v, ['hub', 'nativeId', 'profileClass']) && specialistHub(v.hub) && text(v.nativeId) && text(v.profileClass);
}
export function isSelectedItem(v: unknown): v is SelectedItem {
  return exact(v, ['localItemId', 'revision', 'digest', 'profile']) && text(v.localItemId) && text(v.revision) && digest(v.digest) && isProfileIdentity(v.profile);
}
export function isReturnTaskV2(v: unknown): v is ProfileReturnTaskV2 {
  return exact(v, ['kind', 'hub', 'canonicalSlug', 'profile']) && v.kind === 'profile' && v2RouteHub(v.hub) && SLUG.test(String(v.canonicalSlug)) &&
    isProfileIdentity(v.profile) && v.profile.hub === v.hub;
}
export function isReturnTaskV3(v: unknown): v is ProfileReturnTaskV3 {
  if (!exact(v, ['kind', 'hub', 'canonicalSlug', 'profile', 'returnPath']) || v.kind !== 'profile' || !specialistHub(v.hub) || !SLUG.test(String(v.canonicalSlug))) return false;
  if (!isProfileIdentity(v.profile) || v.profile.hub !== v.hub || v.profile.profileClass !== APPROVED_PROFILE_CLASS[v.hub]) return false;
  if (v.hub === 'senior' && !SENIOR_CCN.test(v.profile.nativeId)) return false;
  return v.returnPath === v3ReturnPath(v.hub, String(v.canonicalSlug), v.profile.nativeId);
}
export function isReturnTask(v: unknown): v is ProfileReturnTask {
  return isReturnTaskV2(v) || isReturnTaskV3(v);
}
export function profileKey(p: ProfileIdentity): string { return JSON.stringify([p.hub, p.nativeId, p.profileClass]); }
export function itemKey(i: SelectedItem): string { return JSON.stringify([i.localItemId, i.revision, i.digest, profileKey(i.profile)]); }
function stageShape(v: unknown, version: string, returnTask: (value: unknown) => boolean, sourceHub: (value: unknown) => boolean): v is GuestStageInput {
  if (!exact(v, ['version', 'sourceHub', 'audience', 'selected', 'returnTask']) || v.version !== version ||
      !sourceHub(v.sourceHub) || v.audience !== 'ask' || !Array.isArray(v.selected) ||
      !v.selected.length || v.selected.length > MAX_ITEMS || !returnTask(v.returnTask) || (v.returnTask as ProfileReturnTask).hub !== v.sourceHub) return false;
  if (!v.selected.every(i => isSelectedItem(i) && i.profile.hub === v.sourceHub)) return false;
  const items = v.selected as SelectedItem[], task = v.returnTask as ProfileReturnTask;
  if (task.hub === 'senior' || v.version === TRANSFER_VERSION_V3) {
    const expected = APPROVED_PROFILE_CLASS[task.hub];
    if (task.profile.profileClass !== expected || items.some(i => i.profile.profileClass !== expected)) return false;
    if (task.hub === 'senior' && items.some(i => !SENIOR_CCN.test(i.profile.nativeId))) return false;
  }
  if (new Set(items.map(i => i.localItemId)).size !== items.length || !items.some(i => profileKey(i.profile) === profileKey(task.profile))) return false;
  try { return new TextEncoder().encode(JSON.stringify(v)).length <= MAX_BYTES; } catch { return false; }
}
export function isGuestStageInputV2(v: unknown): v is GuestStageInputV2 {
  return stageShape(v, TRANSFER_VERSION_V2, value => isReturnTaskV2(value) && value.hub !== 'lender', v2StageHub);
}
export function isGuestStageInputV3(v: unknown): v is GuestStageInputV3 {
  return stageShape(v, TRANSFER_VERSION_V3, isReturnTaskV3, specialistHub);
}
export function isGuestStageInput(v: unknown): v is GuestStageInput {
  return isGuestStageInputV2(v) || isGuestStageInputV3(v);
}
/** SHA-256 of versioned positional UTF-8 JSON. Selection order is significant;
 * arbitrary object property insertion order is not. No notes enter this digest.
 */
export function manifestDigest(v: GuestStageInput): string {
  if (!isGuestStageInput(v)) throw new Error('INVALID_MANIFEST');
  const task = v.version === TRANSFER_VERSION_V3
    ? [v.returnTask.kind, v.returnTask.hub, v.returnTask.canonicalSlug, v.returnTask.returnPath, profileKey(v.returnTask.profile)]
    : [v.returnTask.kind, v.returnTask.hub, v.returnTask.canonicalSlug, profileKey(v.returnTask.profile)];
  return createHash('sha256').update(JSON.stringify([v.version, v.sourceHub, v.audience,
    v.selected.map(i => [i.localItemId, i.revision, i.digest, i.profile.hub, i.profile.nativeId, i.profile.profileClass]),
    task])).digest('hex');
}
export function isContinuationInput(v: unknown): v is ContinuationInput {
  return exact(v, ['sourceHub', 'audience', 'transferRef', 'manifestDigest']) && specialistHub(v.sourceHub) &&
    v.audience === 'ask' && opaque(v.transferRef) && digest(v.manifestDigest);
}
export function isConsumeInput(v: unknown): v is ConsumeInput {
  return exact(v, ['continuationRef', 'issuer', 'audience', 'browserProof']) && specialistHub(v.issuer) &&
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
/** Use ONLY a server-resolved task. Browser input must not choose canonicalSlug, returnPath, or profile. */
export function profileReturnDestination(task: ProfileReturnTask, registry: TrustedOriginRegistry): string | null {
  const v2 = isReturnTaskV2(task), v3 = isReturnTaskV3(task);
  if ((!v2 && !v3) || !registry?.origins || !['production', 'isolated'].includes(registry.environment)) return null;
  const origin = registry.origins[task.hub];
  const path = v3 ? task.returnPath : PROFILE_ROUTES[task.hub] + task.canonicalSlug;
  try {
    const u = new URL(origin);
    if (!origin || u.origin !== origin || u.username || u.password || u.search || u.hash) return null;
    if (registry.environment === 'production' ? origin !== PRODUCTION_ORIGINS[task.hub] :
      !registry.isolatedBackendVerified || (Object.values(PRODUCTION_ORIGINS) as string[]).includes(origin) ||
      (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))) return null;
    return origin + path;
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
export type AuthorizedSpecialist = { hub: SpecialistHub; browserBinding: string; environment: Environment; scopes: readonly string[] };
export type TrustedCommitAdapter = {
  resolveCurrent(profile: ProfileIdentity): TrustedProfile | null;
  ownsProject(subject: string, projectRef: string): boolean;
};
export type SpecialistIdentityHub = SpecialistHub;
