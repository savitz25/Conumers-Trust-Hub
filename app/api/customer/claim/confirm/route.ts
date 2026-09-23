import { NextResponse } from 'next/server';
import { HandoffError } from '@/lib/customer/handoff';
import { ClaimError } from '@/lib/customer/store';
import { clearClaimReceiptCookie, currentContext, readClaimReceipt, setIntentCookie, withPlatform } from '@/lib/customer/server';
import { customerLog } from '@/lib/customer/log';
import { claimAcceptErrorCode } from '@/lib/customer/auth-error-code';
import { checkSameOrigin } from '@/lib/customer/request-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/**
 * ATH-CLAIM-V2-001 — EXPLICIT CONTINUE. The only public path that creates a durable claim intent.
 * Requires: same-origin POST, a valid browser receipt, a still-valid signed token, exact profile revalidation.
 * Idempotent for the same receipt (double-click), fail-closed for anyone else holding the same nonce.
 * Progressive enhancement: works as a plain HTML form post without JavaScript.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = checkSameOrigin(request.headers, request.url, [process.env.NEXT_PUBLIC_SITE_URL || '']);
  if (!origin.ok) {
    customerLog('claim_continue_rejected', { code: origin.reason }, 'warn');
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  const receipt = await readClaimReceipt();
  const ctx = await currentContext();
  if (!receipt) {
    return NextResponse.redirect(new URL('/claim/continue?auth_error=HANDOFF_INVALID', url.origin), { status: 303, headers: NO_STORE });
  }
  try {
    const confirmed = await withPlatform((p) => p.confirmClaimIntent({ token: receipt.token, receiptId: receipt.receiptId, acquisitionSource: receipt.source, ctx }));
    await setIntentCookie(confirmed.intentId);
    await clearClaimReceiptCookie();
    return NextResponse.redirect(new URL(`/claim/continue?confirmed=${confirmed.created ? '1' : '0'}`, url.origin), { status: 303, headers: NO_STORE });
  } catch (e) {
    const internalCode = e instanceof HandoffError || e instanceof ClaimError ? e.code : 'unavailable';
    const code = claimAcceptErrorCode(internalCode);
    customerLog('claim_continue_failed', { code, internalCode: String(internalCode).slice(0, 40) }, 'warn');
    await clearClaimReceiptCookie();
    return NextResponse.redirect(new URL(`/claim/continue?auth_error=${encodeURIComponent(code)}`, url.origin), { status: 303, headers: NO_STORE });
  }
}
