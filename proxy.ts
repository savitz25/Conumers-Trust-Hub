import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { refreshMyTrustHubSession } from '@/lib/supabase/middleware';
import { normalizedPublishedStatePath } from '@/lib/network/published-state-path';
import { accountRuntime } from '@/lib/my-trusthub/account-policy';

export async function proxy(request: NextRequest) {
  const statePath = normalizedPublishedStatePath(request.nextUrl.pathname);
  if (statePath) {
    const url = request.nextUrl.clone();
    url.pathname = statePath;
    return NextResponse.redirect(url, 308);
  }
  const pathname = request.nextUrl.pathname;
  if (pathname === '/my' || pathname.startsWith('/my/') || pathname.startsWith('/auth/')) {
    const runtime = accountRuntime(process.env);
    if (runtime && request.nextUrl.origin !== runtime.origin) {
      if (process.env.VERCEL_ENV !== 'production') return new NextResponse('Account origin unavailable.', { status: 503 });
      return NextResponse.redirect(new URL(pathname + request.nextUrl.search, runtime.origin), 308);
    }
    if (!runtime) return NextResponse.next();
  }
  return refreshMyTrustHubSession(request);
}

export const config = {
  matcher: ['/my/:path*', '/auth/:path*', '/:path'],
};
