import { NextResponse } from 'next/server';
import { shouldEnablePosthog } from '@/lib/analytics/environment';
import { INACTIVE_ANALYTICS_IDENTITY, analyticsIdentityForSession } from '@/lib/analytics/identity-gate';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { isMyTrustHubFeatureEnabled } from '@/lib/my-trusthub/feature-flags';
import { ProductionMyTrustHubAdapter } from '@/lib/my-trusthub/production-adapter';

export const runtime = 'nodejs';

export async function GET() {
  if (!shouldEnablePosthog()) {
    return NextResponse.json(INACTIVE_ANALYTICS_IDENTITY);
  }
  try {
    let id: string | null = null;
    if (isMyTrustHubFeatureEnabled('MY_TRUSTHUB_ENABLED')) {
      const adapter = await ProductionMyTrustHubAdapter.create();
      const myUser = adapter ? await adapter.getUser() : null;
      id = myUser?.id ?? null;
    }
    if (!id) {
      const token = await readSessionToken();
      if (token) {
        const customer = await withPlatform((p) => p.sessionUser(token)).catch(() => null);
        id = customer?.id ?? null;
      }
    }
    return NextResponse.json(analyticsIdentityForSession(true, { id }));
  } catch {
    return NextResponse.json({ distinctId: null });
  }
}
