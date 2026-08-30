import { NextResponse } from 'next/server';
import { AuthError, ManagementError } from '@/lib/customer/store';
import { currentContext, readSessionToken, withPlatform } from '@/lib/customer/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const sessionToken = await readSessionToken();
  if (!sessionToken) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  let version: number;
  try {
    const body = await request.json() as { version?: unknown };
    if (!Number.isInteger(body.version) || Number(body.version) < 0) throw new Error('invalid');
    version = Number(body.version);
  } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }); }
  try {
    const { profileId } = await params;
    const ctx = await currentContext();
    const result = await withPlatform((p) => p.reconfirmBusinessProfile({
      sessionToken, nativeProfileId: profileId, version, ctx,
    }));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ManagementError) {
      const status = error.code === 'stale_version' ? 409 : error.code === 'not_found' ? 404 : 403;
      return NextResponse.json({ error: error.code }, { status });
    }
    if (error instanceof AuthError) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    return NextResponse.json({ error: 'reconfirm_failed' }, { status: 500 });
  }
}
