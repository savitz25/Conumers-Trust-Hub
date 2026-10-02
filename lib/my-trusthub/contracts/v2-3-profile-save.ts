/** V2-3 executable specification only. No endpoints, credentials, DB or hub adapters.
 * Trusted* inputs below are server-resolved records, NEVER browser authorization.
 */
import type { ProfileTransferPort } from './v2-3-profile-transfer.ts';
export const SPECIALIST_HUBS = ['move', 'insurance', 'lender', 'contractor', 'senior', 'investor'] as const;
export type SpecialistHub = typeof SPECIALIST_HUBS[number];
export type ResearchKind = 'profile' | 'comparison' | 'calculator' | 'inventory' | 'plan' | 'worksheet';
export type SaveCapability = 'SAVE_SUPPORTED' | 'SAVE_LOCAL_ONLY' | 'IDENTITY_REVIEW_REQUIRED' | 'PROFILE_NOT_PUBLISHED' | 'UNSUPPORTED_CLASS';
export type ProfileIdentity = { hub: SpecialistHub; nativeId: string; profileClass: string };
export type TrustedProfile = ProfileIdentity & {
  published: boolean;
  supportedClass: boolean;
  binding: null | { id: string; networkEntityId: string; status: 'accepted' | 'review_required' };
};
export function profileCapability(profile: TrustedProfile): SaveCapability {
  if (!profile.published) return 'PROFILE_NOT_PUBLISHED';
  if (!profile.supportedClass) return 'UNSUPPORTED_CLASS';
  if (!profile.binding) return 'SAVE_LOCAL_ONLY';
  return profile.binding.status === 'accepted' ? 'SAVE_SUPPORTED' : 'IDENTITY_REVIEW_REQUIRED';
}
export function sameProfile(a: ProfileIdentity, b: ProfileIdentity): boolean {
  return a.hub === b.hub && a.nativeId === b.nativeId && a.profileClass === b.profileClass;
}
/** Exact server-generated destinations, not a broad prefix allowlist. */
export function allowedReturnPath(input: unknown, exactPaths: readonly string[]): string | null {
  if (typeof input !== 'string' || input.length > 500 || !input.startsWith('/') || input.startsWith('//')) return null;
  try {
    const decoded = decodeURIComponent(input);
    if (/[\\\s?#%\u0000-\u001f]/.test(decoded) || decoded.startsWith('//')) return null;
    const url = new URL(decoded, 'https://return.invalid');
    return url.origin === 'https://return.invalid' && exactPaths.includes(url.pathname) ? url.pathname : null;
  } catch { return null; }
}
export type SaveRequest = {
  version: 'v2-3/profile-save/1';
  profile: ProfileIdentity;
  requestKey: string;
  accountContextRef: string;
  projectRef?: string;
};
const bounded = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && !/[\u0000-\u001f]/.test(v);
export function isSaveRequest(input: unknown): input is SaveRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(k => !['version', 'profile', 'requestKey', 'accountContextRef', 'projectRef'].includes(k))) return false;
  if (value.version !== 'v2-3/profile-save/1' || !bounded(value.requestKey) || !bounded(value.accountContextRef) ||
      (value.projectRef !== undefined && !bounded(value.projectRef))) return false;
  if (!value.profile || typeof value.profile !== 'object' || Array.isArray(value.profile)) return false;
  const p = value.profile as Record<string, unknown>;
  return Object.keys(p).every(k => ['hub', 'nativeId', 'profileClass'].includes(k)) &&
    SPECIALIST_HUBS.includes(p.hub as SpecialistHub) && bounded(p.nativeId) && bounded(p.profileClass);
}
export type TrustedContext = {
  subject: string; // Derived by parent from verified admitted session, never SaveRequest.
  accountContextRef: string;
  browserBinding: string;
  authenticatedHub: SpecialistHub; // Authenticated BFF identity, not a request field.
  scopes: readonly string[]; // Parent-issued, operation-specific grants.
};
export type TrustedHandoff = {
  issuer: SpecialistHub;
  audience: 'ask';
  subject: string;
  accountContextRef: string;
  browserBinding: string;
  expiresAt: number;
  consumed: boolean;
  profile: ProfileIdentity;
};
/** Validation predicate only. Deployment must atomically consume in existing P13 broker. */
export function handoffMatches(h: TrustedHandoff, ctx: TrustedContext, profile: ProfileIdentity, now: number): boolean {
  return ctx.scopes.includes('saved:write') && !h.consumed && Number.isFinite(h.expiresAt) && h.expiresAt > now && h.expiresAt <= now + 90_000 &&
    h.issuer === ctx.authenticatedHub && h.audience === 'ask' && h.profile.hub === h.issuer &&
    h.subject === ctx.subject && h.accountContextRef === ctx.accountContextRef &&
    h.browserBinding === ctx.browserBinding && sameProfile(h.profile, profile);
}
export type SaveReceipt = {
  receiptRef: string;
  requestKey: string;
  accountContextRef: string;
  profile: ProfileIdentity;
  savedRef: string;
  status: 'created' | 'already_saved' | 'restored';
  project: 'not_requested' | 'added' | 'already_member' | 'failed';
};
export type SaveResult =
  | { outcome: 'durable'; receipt: SaveReceipt }
  | { outcome: 'local_only'; capability: Exclude<SaveCapability, 'SAVE_SUPPORTED'> }
  | { outcome: 'failed'; reason: 'auth_required' | 'account_changed' | 'invalid' | 'expired_or_replayed' | 'unavailable'; retryable: boolean };
export function receiptMatches(receipt: SaveReceipt, request: SaveRequest): boolean {
  return Boolean(receipt.receiptRef && receipt.savedRef) && receipt.requestKey === request.requestKey &&
    receipt.accountContextRef === request.accountContextRef && sameProfile(receipt.profile, request.profile) &&
    ['created', 'already_saved', 'restored'].includes(receipt.status);
}
export type SaveUiState = 'anonymous' | 'local_saved' | 'conversion' | 'parent_saved' | 'already_saved' | 'failure' | 'identity_unresolved';
export const SAVE_LABELS: Record<SaveUiState, string> = {
  anonymous: 'Save', local_saved: 'Saved on this device', conversion: 'Keep this in My TrustHub',
  parent_saved: 'Saved to My TrustHub', already_saved: 'Saved', failure: 'Could not save / Retry',
  identity_unresolved: 'Saved locally — account sync unavailable',
};
/** Caller must supply a server-verified receipt, not URL/localStorage success markers. */
export function saveUiState(localSaved: boolean, capability: SaveCapability, request: SaveRequest, result?: SaveResult): SaveUiState {
  if (result?.outcome === 'durable' && receiptMatches(result.receipt, request)) return result.receipt.status === 'already_saved' ? 'already_saved' : 'parent_saved';
  if (localSaved) return capability === 'SAVE_SUPPORTED' ? 'local_saved' : 'identity_unresolved';
  return result ? 'failure' : 'anonymous';
}
export type SelectedProfile = { clientItemId: string; revision: string; digest: string; profile: ProfileIdentity };
export type GuestTransfer = { version: 'v2-3/selected-profiles/1'; selected: SelectedProfile[]; returnContextRef: string };
export type ContinueHook = { kind: ResearchKind; hub: SpecialistHub; schemaKey?: string; opaqueContextRef?: string };

/** Proposed logical facade over P13 broker + P12 owner RPCs. NOT implemented/exposed. */
export interface ParentProfileSavePort extends ProfileTransferPort {
  prepareAuthenticatedHandoff(input: { profile: ProfileIdentity; returnContextRef: string }): Promise<{ formPostRef: string; expiresAt: number }>;
  consumeAuthenticatedHandoff(input: { formPostRef: string; browserProof: string }): Promise<{ accountContextRef: string }>;
  resolveExactBinding(profile: ProfileIdentity): Promise<{ capability: SaveCapability }>;
  /** @deprecated P12 logical example only. V2-3 adapters MUST use commitProfileSave
   * with selected item/manifest/Project bindings, not this v1 illustrative shape. */
  save(request: SaveRequest): Promise<SaveResult>;
  readSaved(input: { profile: ProfileIdentity; accountContextRef: string }): Promise<{ saved: boolean; savedRef?: string }>;
  unsave(input: { savedRef: string; accountContextRef: string; requestKey: string }): Promise<{ removed: boolean }>;
  changeProjectMembership(input: { savedRef: string; projectRef: string; accountContextRef: string; requestKey: string; operation: 'add' | 'remove' }): Promise<{ applied: boolean }>;
}
