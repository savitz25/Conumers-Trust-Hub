import { NextResponse } from 'next/server';
import { HandoffError } from '@/lib/customer/handoff';
import { ClaimError } from '@/lib/customer/store';
import { currentContext, setIntentCookie, withPlatform } from '@/lib/customer/server';
import { customerLog } from '@/lib/customer/log';

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
            ? e.message.slice(0, 80)
            : 'unavailable';
    const errorMap:Record<string,string>={unsupported_hub:'UNSUPPORTED_CUSTOMER_HUB',missing_profile:'PROFILE_NOT_FOUND',thin_profile:'PROFILE_NOT_PUBLIC',slug_mismatch:'PROFILE_IDENTITY_MISMATCH',credential_mismatch:'PROFILE_IDENTITY_MISMATCH',unsupported_source:'PROFILE_CLASS_NOT_CLAIMABLE',expired:'HANDOFF_EXPIRED',reused_nonce:'HANDOFF_REPLAYED',malformed:'HANDOFF_INVALID',tampered:'HANDOFF_INVALID',wrong_audience:'HANDOFF_INVALID',unavailable:'SPECIALIST_VALIDATION_UNAVAILABLE',specialist_unavailable:'SPECIALIST_VALIDATION_UNAVAILABLE'};
    const code=errorMap[internalCode]||internalCode;
    customerLog('claim_accept_failed', { code, errName: e instanceof Error ? e.name : 'unknown' }, 'warn');
    return NextResponse.redirect(new URL(`/claim/continue?auth_error=${encodeURIComponent(code)}`, url.origin));
  }
}
