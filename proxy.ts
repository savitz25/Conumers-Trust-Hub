import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { refreshMyTrustHubSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();
  const canonicalHost = 'www.asktrusthub.com';
  if ((pathname.startsWith('/my') || pathname.startsWith('/auth/')) && host && host !== canonicalHost) {
    const canonical = new URL(request.url);
    canonical.protocol = 'https:';
    canonical.host = canonicalHost;
    return NextResponse.redirect(canonical, 308);
  }
  return refreshMyTrustHubSession(request);
}

export const config = {
  matcher: ['/my/:path*', '/auth/:path*'],
};
