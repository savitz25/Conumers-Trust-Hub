import { NextResponse } from 'next/server';
import { BusinessProfileValidationError } from '@/lib/customer/business-profile';
import { AuthError, ManagementError } from '@/lib/customer/store';
import { currentContext, readSessionToken, withPlatform } from '@/lib/customer/server';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const sessionToken = await readSessionToken();
  if (!sessionToken) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }); }
  try {
    const { profileId } = await params;
    const ctx = await currentContext();
    const result = await withPlatform((p) => p.saveBusinessProfile({
      sessionToken, nativeProfileId: profileId, body, ctx,
    }));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof BusinessProfileValidationError) {
      return NextResponse.json({ error: 'validation_failed', issues: error.issues }, { status: 400 });
    }
    if (error instanceof ManagementError) {
      const status = error.code === 'stale_version' ? 409 : 403;
      return NextResponse.json({ error: error.code }, { status });
    }
    if (error instanceof AuthError) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
