import { redirect } from 'next/navigation';
import { RELATIONSHIP_LABELS, type RelationshipType } from '@/lib/customer/types';
import { readIntentId, readSessionToken, withPlatform } from '@/lib/customer/server';
import { ClaimContinueForm } from './claim-continue-form';

export const dynamic = 'force-dynamic';

export default async function ClaimContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ handoff?: string; auth_error?: string }>;
}) {
  const sp = await searchParams;
  if (sp.handoff) {
    redirect(`/api/customer/claim/accept?handoff=${encodeURIComponent(sp.handoff)}`);
  }

  const sessionToken = await readSessionToken();
  const intentError: string | null = sp.auth_error || null;
  const existing = await readIntentId();

  const result = await withPlatform(async (p) => {
    const user = await p.sessionUser(sessionToken);
    if (!existing) return { intent: null, user, organizations: [] };
    const intent = await p.intentPreview(existing);
    const organizations=user?await p.claimOrganizations(sessionToken||''):[];
    return { intent, user, organizations };
  });

  if (!result.intent) {
    return (
      <section className="card-surface p-6">
        <h1 className="text-xl font-semibold text-navy">Claim context missing</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page needs a valid signed handoff from ContractorTrustHub. Public claim buttons
          are not live yet (ATH-CUST-003). Internal operators can mint a test token.
        </p>
        {intentError ? <p className="mt-3 text-sm text-destructive">{intentError.replaceAll('_', ' ')}</p> : null}
      </section>
    );
  }

  const { intent, user } = result;
  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">AskTrustHub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">
          Manage this ContractorTrustHub profile
        </h1>
      </header>
      <div className="card-surface p-5">
        <p className="text-lg font-medium text-foreground">{intent.displayName}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Florida DBPR credential: {intent.payload.external_key}
        </p>
        <p className="text-sm text-muted-foreground">Florida</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          You are requesting permission to manage business-supplied information associated with
          this specific TrustHub profile. Confirming your email does not verify ownership.
          Authorization is not an endorsement.
        </p>
        <a className="link-inline mt-3 inline-block text-sm" href={intent.profileHref}>
          View public Trust Report
        </a>
      </div>
      <ClaimContinueForm
        authed={Boolean(user)}
        email={user?.email ?? ''}
        relationships={Object.entries(RELATIONSHIP_LABELS) as [RelationshipType, string][]}
        expectedCredential={intent.payload.external_key}
        organizations={result.organizations}
      />
    </section>
  );
}
