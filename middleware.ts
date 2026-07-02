import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — legacy redirect prep (308 rules NOT active yet).
 * When redirects go live on Cloudflare, this supplements path rewrites
 * for common legacy paths during transition.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Append ?from= for welcome banner testing via header simulation
  const from = searchParams.get('from');
  if (from) {
    const response = NextResponse.next();
    response.cookies.set('cth_legacy_source', from, { maxAge: 3600, path: '/' });
    return response;
  }

  // Internal legacy path aliases (pre-308 local QA)
  const LEGACY_PATH_MAP: Record<string, string> = {
    '/moving-calculator': '/moving/calculator',
    '/companies': '/moving/companies',
    '/compare': '/moving/compare',
    '/local-lenders': '/lending/lenders',
    '/directory': '/insurance/directory',
  };

  if (LEGACY_PATH_MAP[pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_PATH_MAP[pathname];
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};