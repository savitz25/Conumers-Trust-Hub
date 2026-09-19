import { NextResponse, type NextRequest } from 'next/server';
import { accountRuntime, enabled } from '@/lib/my-trusthub/account-policy';
import { exchangeAccountCode } from '@/lib/my-trusthub/account-callback';
import { createMyTrustHubSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const runtime = accountRuntime(process.env);
  const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  if (!enabled(process.env.MY_TRUSTHUB_ENABLED)) return new NextResponse(null, { status: 404, headers: privateHeaders });
  if (!runtime || request.nextUrl.origin !== runtime.origin) return new NextResponse('Account callback unavailable.', { status: 503, headers: privateHeaders });
  const client = await createMyTrustHubSupabaseClient();
  if (!client) return new NextResponse('Account callback unavailable.', { status: 503, headers: privateHeaders });
  const destination = await exchangeAccountCode(client.auth, request.nextUrl.searchParams.get('code'), request.nextUrl.searchParams.get('next'), process.env, request.nextUrl.searchParams.get('flow') === 'password');
  console.info(JSON.stringify({ event: 'my_trusthub_auth_callback', outcome: destination.includes('error=') ? 'exchange_failed' : 'authenticated' }));
  return NextResponse.redirect(new URL(destination, runtime.origin), { headers: privateHeaders });
}
