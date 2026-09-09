import type { NextRequest } from 'next/server';
import { refreshMyTrustHubSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return refreshMyTrustHubSession(request);
}

export const config = {
  matcher: ['/my/:path*', '/auth/:path*'],
};
