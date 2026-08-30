import { NextResponse } from 'next/server';
import { AuthError, ClaimError } from '@/lib/customer/store';
import { currentContext, readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionToken = await readSessionToken();
  const reqCtx = await currentContext();
  const body = (await request.json().catch(() => ({}))) as {
    decision?: 'approve' | 'reject' | 'needs_info';
    reason?: string;
  };
  try {
    const result = await withPlatform((p) =>
      p.staffDecide({
        sessionToken: sessionToken || '',
        claimId: id,
        decision: body.decision || 'needs_info',
        reason: body.reason || '',
        ctx: reqCtx,
      })
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.code }, { status: e.code === 'not_staff' ? 403 : 401 });
    }
    if (e instanceof ClaimError) {
      return NextResponse.json({ ok: false, error: e.code }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 500 });
  }
}
