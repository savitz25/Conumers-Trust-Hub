import { createPageMetadata } from '@/lib/seo/metadata';
import { AuthError } from '@/lib/customer/store';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { HandoffMintForm } from './handoff-mint-form';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'Mint test handoff',
  description: 'Internal AskTrustHub Florida claim handoff minting.',
  path: '/internal/handoff',
  noIndex: true,
});

export default async function InternalHandoffPage() {
  const sessionToken = await readSessionToken();
  try {
    const user = await withPlatform((p) => p.sessionUser(sessionToken || ''));
    if (!user?.isStaff) throw new AuthError('not_staff');
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-12">
        <h1 className="text-2xl font-semibold text-navy">Mint test handoff</h1>
        <p className="text-sm text-muted-foreground">
          ATH-CUST-002 internal path only. Does not add a public ContractorTrustHub CTA.
        </p>
        <HandoffMintForm />
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <p>Staff sign-in required.</p>
      </div>
    );
  }
}
