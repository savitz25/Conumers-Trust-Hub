import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/customer/store';
import { currentContext, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ctx = await currentContext();
  const body = (await request.json().catch(() => ({}))) as { email?: string; next?: string };
  try {
    const result = await withPlatform((p) =>
      p.requestMagicLink({
        email: body.email || '',
        nextPath: body.next,
        ctx,
      })
    );
    return NextResponse.json({ ok: true, sent: result.sent, preview: result.preview });
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'rate_limited' ? 429 : 400;
      return NextResponse.json({ ok: false, error: e.code }, { status });
    }
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 500 });
  }
}
