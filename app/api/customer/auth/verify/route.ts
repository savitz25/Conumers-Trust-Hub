import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/customer/store';
import { currentContext, setSessionCookie, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const nextRaw = url.searchParams.get('next') || '/claim/continue';
  const next = nextRaw.startsWith('/') ? nextRaw : '/claim/continue';
  const ctx = await currentContext();
  try {
    const result = await withPlatform((p) => p.consumeMagicLink(token, ctx));
    await setSessionCookie(result.sessionToken);
    return NextResponse.redirect(new URL(next, url.origin));
  } catch (e) {
    const code = e instanceof AuthError ? e.code : 'expired_link';
    return NextResponse.redirect(new URL(`/claim/continue?auth_error=${code}`, url.origin));
  }
}
