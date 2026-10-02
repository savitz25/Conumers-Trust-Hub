/**
 * ATH-CLAIM-V2-001 — passive handoff receipt (cookie payload).
 *
 * The receipt is NOT durable state. It carries the already-signed specialist token (re-authenticated on every
 * use), a random browser-bound receipt id, and the out-of-band acquisition source declared by the specialist.
 * It lives in an httpOnly, sameSite=lax cookie for the token TTL. No secret is derived from it and it is
 * never logged. Pure module (no Next.js imports) so it is unit-testable.
 *
 * ATH-CLAIM-V2-001R2 (Q1) — the cookie is an authenticated envelope, not bare base64url JSON. A browser (or
 * anything reading document cookies via XSS, or an old unsigned cookie left over from a prior deploy) cannot
 * forge or edit any field: receiptId, source, receivedAt, or the embedded token. Format is `body.sig` where
 * `body` is base64url(canonical JSON) and `sig` is HMAC-SHA256 over a domain-separated message, so a valid
 * receipt signature can never be mistaken for (or replayed as) a valid handoff-token signature even though both
 * currently derive from `ATH_HANDOFF_SECRET` — see `RECEIPT_DOMAIN` below vs. handoff.ts's unprefixed
 * `hmacSha256(secret, body)`. Verification is timing-safe. A cookie with no `.` separator, a bad signature, a
 * mismatched signature, or a body that fails to parse is treated as absent (fails closed), including any
 * legacy unsigned receipt from before this change.
 */
import { claimAcquisitionSourceV2, type ClaimAcquisitionSourceV2 } from './claim-v2-funnel.ts';
import { hmacSha256, timingSafeEqualText } from './crypto.ts';

export type ClaimReceipt = { token: string; receiptId: string; source: ClaimAcquisitionSourceV2; receivedAt: number };

const TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const RECEIPT_ID_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

/** Domain separator for receipt-cookie signing. Must never collide with handoff-token signing's bare `body`. */
const RECEIPT_DOMAIN = 'ATH_CLAIM_RECEIPT_V1';

function receiptBody(receipt: ClaimReceipt): string {
  return Buffer.from(JSON.stringify({ t: receipt.token, r: receipt.receiptId, s: receipt.source, a: receipt.receivedAt }), 'utf8').toString('base64url');
}

function receiptSignature(secret: string, body: string): string {
  return hmacSha256(secret, `${RECEIPT_DOMAIN}:${body}`);
}

/** ATH-CLAIM-V2-001R4: no receipt is signed or verified with an absent/short secret. */
const MIN_RECEIPT_SECRET_LENGTH = 32;

export function encodeClaimReceipt(receipt: ClaimReceipt, secret: string): string {
  if (!secret || secret.length < MIN_RECEIPT_SECRET_LENGTH) throw new Error('receipt_secret_misconfigured');
  const body = receiptBody(receipt);
  return `${body}.${receiptSignature(secret, body)}`;
}

/**
 * ATH-CLAIM-V2-001R — multi-tab binding. The Continue form carries the receipt id of the identity it rendered;
 * the confirm route only acts when that id equals the receipt currently held by the browser. A tab that still
 * shows an earlier profile after a newer handoff replaced the cookie is sent back to re-render, never confirmed
 * against the wrong identity. Comparison is exact and case-sensitive.
 */
export function receiptMatchesConfirmation(receipt: ClaimReceipt | null, submitted: unknown): boolean {
  return Boolean(receipt) && typeof submitted === 'string' && RECEIPT_ID_SHAPE.test(submitted) && submitted === receipt!.receiptId;
}

export function decodeClaimReceipt(raw: string | undefined | null, secret: string): ClaimReceipt | null {
  if (!raw || raw.length > 4096) return null;
  if (!secret || secret.length < MIN_RECEIPT_SECRET_LENGTH) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return null; // no separator (e.g. a legacy unsigned candidate) never verifies
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = receiptSignature(secret, body);
  if (!timingSafeEqualText(sig, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { t?: unknown; r?: unknown; s?: unknown; a?: unknown };
    if (typeof parsed.t !== 'string' || !TOKEN_SHAPE.test(parsed.t)) return null;
    if (typeof parsed.r !== 'string' || !RECEIPT_ID_SHAPE.test(parsed.r)) return null;
    const receivedAt = typeof parsed.a === 'number' && Number.isFinite(parsed.a) ? parsed.a : 0;
    return { token: parsed.t, receiptId: parsed.r, source: claimAcquisitionSourceV2(parsed.s), receivedAt };
  } catch {
    return null;
  }
}
