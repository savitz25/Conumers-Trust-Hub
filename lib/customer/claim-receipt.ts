/**
 * ATH-CLAIM-V2-001 — passive handoff receipt (cookie payload).
 *
 * The receipt is NOT durable state. It carries the already-signed specialist token (re-authenticated on every
 * use), a random browser-bound receipt id, and the out-of-band acquisition source declared by the specialist.
 * It lives in an httpOnly, sameSite=lax cookie for the token TTL. No secret is derived from it and it is
 * never logged. Pure module (no Next.js imports) so it is unit-testable.
 */
import { claimAcquisitionSourceV2, type ClaimAcquisitionSourceV2 } from './claim-v2-funnel.ts';

export type ClaimReceipt = { token: string; receiptId: string; source: ClaimAcquisitionSourceV2; receivedAt: number };

const TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const RECEIPT_ID_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

export function encodeClaimReceipt(receipt: ClaimReceipt): string {
  return Buffer.from(JSON.stringify({ t: receipt.token, r: receipt.receiptId, s: receipt.source, a: receipt.receivedAt }), 'utf8').toString('base64url');
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

export function decodeClaimReceipt(raw: string | undefined | null): ClaimReceipt | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { t?: unknown; r?: unknown; s?: unknown; a?: unknown };
    if (typeof parsed.t !== 'string' || !TOKEN_SHAPE.test(parsed.t)) return null;
    if (typeof parsed.r !== 'string' || !RECEIPT_ID_SHAPE.test(parsed.r)) return null;
    const receivedAt = typeof parsed.a === 'number' && Number.isFinite(parsed.a) ? parsed.a : 0;
    return { token: parsed.t, receiptId: parsed.r, source: claimAcquisitionSourceV2(parsed.s), receivedAt };
  } catch {
    return null;
  }
}
