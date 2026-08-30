import { NextResponse } from 'next/server';
import { readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function GET() {
  const token = await readSessionToken();
  const user = await withPlatform((p) => p.sessionUser(token));
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
