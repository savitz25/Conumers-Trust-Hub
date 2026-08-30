import { NextResponse } from 'next/server';
import { clearSessionCookie, readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = await readSessionToken();
  await withPlatform((p) => p.logout(token));
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
