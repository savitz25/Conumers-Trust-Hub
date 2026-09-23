/**
 * ATH-OBS-002E (application layer): `/claim/continue?auth_error=` carries a BOUNDED enum only.
 *
 * Before this module the claim-accept route could place an arbitrary driver/provider error code or
 * the first 80 characters of an exception message in the URL, and the page passed whatever the URL
 * held to analytics. Both directions now go through the same allow-list: a value that is not a known
 * code is replaced by a generic one. Nothing here echoes its input.
 */
import { CUSTOMER_CLAIM_ERROR_CODES, type CustomerClaimErrorCode } from './claim-recovery.ts';

/** Sign-in link states that can reach the claim page from /api/customer/auth/verify. */
export const CLAIM_SIGN_IN_ERROR_CODES = ['expired_link', 'consumed_link', 'rate_limited', 'auth_failed'] as const;
export type ClaimSignInErrorCode = (typeof CLAIM_SIGN_IN_ERROR_CODES)[number];
export type ClaimAuthErrorCode = CustomerClaimErrorCode | ClaimSignInErrorCode;

export const CLAIM_AUTH_ERROR_CODES: readonly ClaimAuthErrorCode[] = [...CUSTOMER_CLAIM_ERROR_CODES, ...CLAIM_SIGN_IN_ERROR_CODES];

/** Internal handoff/claim error codes -> public claim recovery codes (moved verbatim from the accept route). */
const HANDOFF_ERROR_MAP: Record<string, CustomerClaimErrorCode> = {
  unsupported_hub: 'UNSUPPORTED_CUSTOMER_HUB', missing_profile: 'PROFILE_NOT_FOUND', thin_profile: 'PROFILE_NOT_PUBLIC', historical_profile: 'PROFILE_NOT_PUBLIC',
  profile_not_public: 'PROFILE_NOT_PUBLIC', slug_mismatch: 'PROFILE_IDENTITY_MISMATCH', credential_mismatch: 'PROFILE_IDENTITY_MISMATCH', unsupported_source: 'PROFILE_CLASS_NOT_CLAIMABLE',
  expired: 'HANDOFF_EXPIRED', reused_nonce: 'HANDOFF_REPLAYED', malformed: 'HANDOFF_INVALID', tampered: 'HANDOFF_INVALID', wrong_audience: 'HANDOFF_INVALID',
  unavailable: 'SPECIALIST_VALIDATION_UNAVAILABLE', specialist_unavailable: 'SPECIALIST_VALIDATION_UNAVAILABLE',
  // ATH-CLAIM-V2-001R: V2 code running ahead of migration 019 fails closed as a temporary unavailability.
  schema_not_ready: 'SPECIALIST_VALIDATION_UNAVAILABLE',
};

const isKnown = (value: unknown): value is ClaimAuthErrorCode => typeof value === 'string' && (CLAIM_AUTH_ERROR_CODES as readonly string[]).includes(value);

/** Claim-accept failures. Unknown codes and exception text collapse to the generic invalid-handoff state the page already showed for them. */
export function claimAcceptErrorCode(internalCode: unknown): ClaimAuthErrorCode {
  if (typeof internalCode !== 'string') return 'HANDOFF_INVALID';
  const mapped = HANDOFF_ERROR_MAP[internalCode] ?? internalCode;
  return isKnown(mapped) ? mapped : 'HANDOFF_INVALID';
}

/** Magic-link verification failures. */
export function signInLinkErrorCode(internalCode: unknown): ClaimSignInErrorCode {
  return typeof internalCode === 'string' && (CLAIM_SIGN_IN_ERROR_CODES as readonly string[]).includes(internalCode) ? (internalCode as ClaimSignInErrorCode) : 'auth_failed';
}

/** INBOUND: the query string is attacker/user controlled, so the page re-validates before display or analytics. */
export function readClaimAuthErrorParam(raw: unknown): ClaimAuthErrorCode | null {
  if (raw === undefined || raw === null || raw === '') return null;
  return isKnown(raw) ? raw : 'HANDOFF_INVALID';
}

/** Human copy for sign-in link states. Claim recovery codes keep their existing copy in claim-recovery.ts. */
export const CLAIM_SIGN_IN_ERROR_COPY: Record<ClaimSignInErrorCode, string> = {
  expired_link: 'This sign-in link has expired. Request a new link to continue.',
  consumed_link: 'This sign-in link was already used. Request a new link to continue.',
  rate_limited: 'Too many sign-in attempts. Please wait a few minutes, then request a new link.',
  auth_failed: 'We could not complete sign-in. Request a new link to continue.',
};

export function claimSignInErrorMessage(code: ClaimAuthErrorCode | null): string | null {
  return code && (CLAIM_SIGN_IN_ERROR_CODES as readonly string[]).includes(code) ? CLAIM_SIGN_IN_ERROR_COPY[code as ClaimSignInErrorCode] : null;
}
