import { NextResponse } from 'next/server';
import { isDbUnavailableError, serviceUnavailableResponse } from '@/lib/customer/db-unavailable';
import { AuthError } from '@/lib/customer/store';
import { signInLinkErrorCode } from '@/lib/customer/auth-error-code';
import { currentContext, setSessionCookie, withPlatform } from '@/lib/customer/server';
import { internalRedirectUrl } from '@/lib/customer/safe-next-path';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  // ATH-CLAIM-V2-001R5-P1-AUTH-REDIRECT: validated at consumption too, so a link issued before this fix (or a
  // hand-crafted one) with a dangerous `next` still lands on an Ask same-origin path after sign-in.
  const next = internalRedirectUrl(url.searchParams.get('next'), url.origin);
  const ctx = await currentContext();
  try {
    const result = await withPlatform((p) => p.consumeMagicLink(token, ctx));
    await setSessionCookie(result.sessionToken);
    return NextResponse.redirect(next);
  } catch (e) {
    if (isDbUnavailableError(e)) return serviceUnavailableResponse();
    // ATH-OBS-002E: the URL carries a bounded enum only -- never an exception message.
    const code = signInLinkErrorCode(e instanceof AuthError ? e.code : 'expired_link');
    return NextResponse.redirect(new URL(`/claim/continue?auth_error=${code}`, url.origin));
  }
}
