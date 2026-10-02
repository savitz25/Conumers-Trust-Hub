/**
 * ATH-CLAIM-V2-001R5-P1-AUTH-REDIRECT — the one authoritative "safe internal next path" validator.
 *
 * Every post-sign-in redirect target (magic-link creation AND consumption) goes through here. A `next` value is
 * user-influenced: it arrives in the request-link POST body and, for already-issued links, in the verify URL. The
 * previous check (`startsWith('/')`) let `//evil.example/x` through, which URL resolution treats as a
 * protocol-relative external URL — an open redirect on the sign-in path.
 *
 * Contract: returns an application-relative path (`/path?query`) that resolves to the SAME origin as an inert
 * base, or `fallback`. Nothing else is ever returned. Pure module (no Next.js imports) so it is unit-testable.
 */
const MAX_NEXT_LENGTH = 2048;
/** Inert same-origin base used only for resolution; never a real host. */
const INERT_BASE = 'https://ath-internal.invalid';
/** Control characters, whitespace and backslashes never appear in a legitimate application path. */
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\s\\]/;

export const DEFAULT_NEXT_PATH = '/claim/continue';

export function safeInternalNextPath(candidate: unknown, fallback: string = DEFAULT_NEXT_PATH): string {
  if (typeof candidate !== 'string') return fallback;
  if (candidate.length === 0 || candidate.length > MAX_NEXT_LENGTH) return fallback;
  if (FORBIDDEN_CHARS.test(candidate)) return fallback;
  // Must be a single-leading-slash path: `//host`, `///host` and scheme-prefixed values are rejected outright.
  if (candidate.charCodeAt(0) !== 0x2f /* '/' */ || candidate.charCodeAt(1) === 0x2f) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(candidate, INERT_BASE);
  } catch {
    return fallback;
  }
  // Belt and braces: whatever the parser did, the result must still be on the inert origin.
  if (resolved.origin !== new URL(INERT_BASE).origin) return fallback;
  const normalized = `${resolved.pathname}${resolved.search}`;
  if (normalized.charCodeAt(0) !== 0x2f || normalized.charCodeAt(1) === 0x2f) return fallback;
  return normalized;
}

/**
 * Absolute redirect target for a post-sign-in hop: always `origin` + a validated internal path. The returned
 * string's origin is guaranteed to equal `origin`; callers never build the redirect URL themselves.
 */
export function internalRedirectUrl(candidate: unknown, origin: string, fallback: string = DEFAULT_NEXT_PATH): string {
  const path = safeInternalNextPath(candidate, fallback);
  const target = new URL(path, origin);
  if (target.origin !== new URL(origin).origin) return new URL(fallback, origin).toString();
  return target.toString();
}
