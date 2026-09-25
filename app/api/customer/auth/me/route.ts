import { NextResponse } from 'next/server';
import { isDbUnavailableError, serviceUnavailableResponse } from '@/lib/customer/db-unavailable';
import { readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function GET() {
  const token = await readSessionToken();
  let user;
  try { user = await withPlatform((p) => p.sessionUser(token)); }
  catch (e) { if (isDbUnavailableError(e)) return serviceUnavailableResponse(); throw e; }
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
