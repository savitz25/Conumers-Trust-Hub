import { NextResponse } from 'next/server';
import { HandoffError } from '@/lib/customer/handoff';
import { ClaimError } from '@/lib/customer/store';
import { clearIntentCookie, currentContext, readClaimReceipt, readIntentId, setClaimReceiptCookie, withPlatform } from '@/lib/customer/server';
import { peekHandoffIdentity } from '@/lib/customer/handoff';
import { customerLog } from '@/lib/customer/log';
import { claimAcceptErrorCode } from '@/lib/customer/auth-error-code';
import { randomToken } from '@/lib/customer/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/**
 * ATH-CLAIM-V2-001 — PASSIVE RECEIPT.
 * Authenticates the signed handoff and revalidates the exact profile, then stores a browser-bound receipt
 * cookie and shows the identity page. It creates NO durable claim intent. Only the explicit Continue
 * (POST /api/customer/claim/confirm) does. A bot or crawler that follows this URL 1,000 times creates
 * 0 intents.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('handoff') || '';
  // ATH-CLAIM-V2-001R2 (Q2): acquisition source comes ONLY from the authenticated payload inside the signed
  // handoff token. The `source` query string (if a specialist's redirect still includes one) is never read —
  // a browser could otherwise navigate straight to this URL with any `source=` it likes.
  const ctx = await currentContext();
  try {
    const priorReceipt = await readClaimReceipt();
    const priorIntentId = (await readIntentId()) || null;
    const { received, keepIntent } = await withPlatform(async (p) => {
      const received = await p.receiveHandoff(token, ctx);
      // ATH-CLAIM-V2-FLNJ-001R1 (double-intent P1): an open intent this browser already holds for the SAME exact
      // profile survives a fresh handoff (the specialist may have minted twice for one click); anything else is
      // superseded as before.
      let keepIntent = false;
      if (priorIntentId) {
        const preview = await p.intentPreview(priorIntentId).catch(() => null);
        keepIntent = Boolean(preview && !preview.consumed && preview.payload.hub_id === received.payload.hub_id && preview.payload.native_profile_id.toLowerCase() === received.payload.native_profile_id.toLowerCase());
      }
      return { received, keepIntent };
    });
    if (!keepIntent) await clearIntentCookie();
    // Same browser + same exact profile keeps its receipt id, so a second mint for one click shares the idempotency key.
    const prior = priorReceipt ? peekHandoffIdentity(priorReceipt.token) : null;
    const sameProfile = Boolean(prior && prior.hub_id === received.payload.hub_id && prior.native_profile_id === received.payload.native_profile_id.toLowerCase());
    const receiptId = sameProfile && priorReceipt ? priorReceipt.receiptId : randomToken(24);
    await setClaimReceiptCookie({ token, receiptId, source: received.acquisitionSource, receivedAt: Date.now() });
    return NextResponse.redirect(new URL('/claim/continue', url.origin), { headers: NO_STORE });
  } catch (e) {
    const internalCode =
      e instanceof HandoffError || e instanceof ClaimError
        ? e.code
        : e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string'
          ? (e as { code: string }).code
          : e instanceof Error
            ? 'unclassified_error' // exception text must never reach the URL
            : 'unavailable';
    // ATH-OBS-002E: only an allow-listed recovery code may enter the redirect URL.
    const code = claimAcceptErrorCode(internalCode);
    customerLog('claim_accept_failed', { code, internalCode: String(internalCode).slice(0, 40), errName: e instanceof Error ? e.name : 'unknown' }, 'warn');
    return NextResponse.redirect(new URL(`/claim/continue?auth_error=${encodeURIComponent(code)}`, url.origin), { headers: NO_STORE });
  }
}
