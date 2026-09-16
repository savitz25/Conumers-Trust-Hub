import { NextResponse } from 'next/server';
import { isOpaqueTrustHubId } from '@/lib/analytics/privacy';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { isMyTrustHubFeatureEnabled } from '@/lib/my-trusthub/feature-flags';
import { ProductionMyTrustHubAdapter } from '@/lib/my-trusthub/production-adapter';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (isMyTrustHubFeatureEnabled('MY_TRUSTHUB_ENABLED')) {
      const adapter = await ProductionMyTrustHubAdapter.create();
      const myUser = adapter ? await adapter.getUser() : null;
      if (myUser?.id && isOpaqueTrustHubId(myUser.id)) {
        return NextResponse.json({ distinctId: myUser.id });
      }
    }
    const token = await readSessionToken();
    if (token) {
      const customer = await withPlatform((p) => p.sessionUser(token)).catch(() => null);
      if (customer?.id && isOpaqueTrustHubId(customer.id)) {
        return NextResponse.json({ distinctId: customer.id });
      }
    }
    return NextResponse.json({ distinctId: null });
  } catch {
    return NextResponse.json({ distinctId: null });
  }
}
