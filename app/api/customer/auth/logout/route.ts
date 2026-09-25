import { NextResponse } from 'next/server';
import { isDbUnavailableError, serviceUnavailableResponse } from '@/lib/customer/db-unavailable';
import { clearSessionCookie, readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = await readSessionToken();
  try { await withPlatform((p) => p.logout(token)); }
  catch (e) { if (isDbUnavailableError(e)) return serviceUnavailableResponse(); throw e; }
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
