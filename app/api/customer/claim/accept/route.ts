import { NextResponse } from 'next/server';
import { HandoffError } from '@/lib/customer/handoff';
import { ClaimError } from '@/lib/customer/store';
import { currentContext, setIntentCookie, withPlatform } from '@/lib/customer/server';
import { customerLog } from '@/lib/customer/log';
import { claimAcceptErrorCode } from '@/lib/customer/auth-error-code';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('handoff') || '';
  const ctx = await currentContext();
  try {
    const accepted = await withPlatform((p) => p.acceptHandoff(token, ctx));
    await setIntentCookie(accepted.intentId);
    return NextResponse.redirect(new URL('/claim/continue', url.origin));
  } catch (e) {
    const internalCode =
      e instanceof HandoffError || e instanceof ClaimError
        ? e.code
        : e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string'
          ? (e as { code: string }).code
          : e instanceof Error
            ? 'unclassified_error' // was: e.message.slice(0, 80) -- exception text must never reach the URL
            : 'unavailable';
    // ATH-OBS-002E: only an allow-listed recovery code may enter the redirect URL. Unknown driver/provider
    // codes collapse to HANDOFF_INVALID (the state the page already rendered for them); detail stays in server logs.
    const code = claimAcceptErrorCode(internalCode);
    customerLog('claim_accept_failed', { code, internalCode: String(internalCode).slice(0, 40), errName: e instanceof Error ? e.name : 'unknown' }, 'warn');
    return NextResponse.redirect(new URL(`/claim/continue?auth_error=${encodeURIComponent(code)}`, url.origin));
  }
}
