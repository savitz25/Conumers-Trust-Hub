import { NextResponse } from 'next/server';
import { acceptClientProductEvent } from '@/lib/control-plane/product-events';
import { readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return NextResponse.json({ok:false},{status:413});
  try {
    const body = await request.json() as {eventName?:unknown;properties?:unknown};
    const routeFamily = new URL(request.url).searchParams.get('route') ?? '/';
    const token = await readSessionToken();
    const authenticated=token?Boolean(await withPlatform(platform=>platform.sessionUser(token))):false;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    await acceptClientProductEvent({eventName:String(body.eventName??''),properties:body.properties && typeof body.properties==='object' && !Array.isArray(body.properties)?body.properties as Record<string,unknown>:undefined,routeFamily,authenticated,rateIdentity:ip});
    return NextResponse.json({ok:true},{status:202,headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = error instanceof Error && error.message === 'rate_limited' ? 429 : 400;
    return NextResponse.json({ok:false},{status,headers:{'Cache-Control':'no-store'}});
  }
}
