import { redirect } from 'next/navigation';
import { RELATIONSHIP_LABELS, type RelationshipType } from '@/lib/customer/types';
import { readIntentId, readSessionToken, withPlatform } from '@/lib/customer/server';
import { ClaimContinueForm } from './claim-continue-form';
import { CUSTOMER_HUB_REGISTRY } from '@/lib/customer/hub-registry';

export const dynamic = 'force-dynamic';
const CLAIM_ERROR_COPY:Record<string,string>={UNSUPPORTED_CUSTOMER_HUB:'Claims are not yet available for this TrustHub.',PROFILE_NOT_PUBLIC:'This profile is not currently public and cannot be claimed.',PROFILE_NOT_FOUND:'We could not confirm this exact public profile.',PROFILE_IDENTITY_MISMATCH:'The profile identifier no longer matches. Return to the public profile and try again.',PROFILE_CLASS_NOT_CLAIMABLE:'This type of profile cannot be claimed.',PROFILE_PUBLICATION_RESTRICTED:'This research identity is not eligible for a public managed profile.',HANDOFF_EXPIRED:'This claim link expired. Return to the public profile for a new link.',HANDOFF_REPLAYED:'This claim link was already used. View your claims or start again from the public profile.',HANDOFF_INVALID:'This claim link is invalid. Return to the public profile and try again.',SPECIALIST_VALIDATION_UNAVAILABLE:'We could not validate the public profile right now. Please retry shortly.'};

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
          This page needs a valid signed handoff from a supported TrustHub profile. Return to the exact public profile and start the claim again.
        </p>
        {intentError ? <p className="mt-3 text-sm text-destructive">{CLAIM_ERROR_COPY[intentError]||'We could not continue this claim. Return to the public profile and try again.'}</p> : null}
      </section>
    );
  }

  const { intent, user } = result;
  const capability=CUSTOMER_HUB_REGISTRY[intent.payload.hub_id];
  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">AskTrustHub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">
          Manage this {capability.displayName} profile
        </h1>
      </header>
      <div className="card-surface p-5">
        <p className="text-lg font-medium text-foreground">{intent.displayName}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {capability.identifierLabel}: {intent.payload.external_key}
        </p>
        {intent.payload.home_state?<p className="text-sm text-muted-foreground">Recorded state: {intent.payload.home_state}</p>:null}
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
        identifierLabel={capability.identifierLabel}
        organizations={result.organizations}
      />
    </section>
  );
}
