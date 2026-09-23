import { redirect } from 'next/navigation';
import { RELATIONSHIP_LABELS, type RelationshipType } from '@/lib/customer/types';
import { readClaimReceipt, readIntentId, readSessionToken, withPlatform } from '@/lib/customer/server';
import { ClaimContinueForm } from './claim-continue-form';
import { ClaimContinueConfirm } from './claim-continue-confirm';
import { CUSTOMER_HUB_REGISTRY } from '@/lib/customer/hub-registry';
import { ClaimRecoveryCard } from '@/components/customer/ClaimRecoveryCard';
import { ClaimProgress } from '@/components/customer/ClaimProgress';
import { ClaimFunnelAnalytics } from '@/components/customer/ClaimFunnelAnalytics';
import { PUBLIC_CLAIM_CONTRACT } from '@/lib/customer/public-claim-contract';
import { claimSignInErrorMessage, readClaimAuthErrorParam } from '@/lib/customer/auth-error-code';
import { HandoffError } from '@/lib/customer/handoff';
import { ClaimError } from '@/lib/customer/store';
import { claimAcceptErrorCode } from '@/lib/customer/auth-error-code';

export const dynamic = 'force-dynamic';

type Identity = { hubId: keyof typeof CUSTOMER_HUB_REGISTRY; displayName: string; externalKey: string; homeState: string | null; entityClass?: string; profileHref: string };

function IdentityCard({ identity, capability }: { identity: Identity; capability: (typeof CUSTOMER_HUB_REGISTRY)[keyof typeof CUSTOMER_HUB_REGISTRY] }) {
  return (
    <div className="card-surface p-5">
      <p className="text-lg font-medium text-foreground">{identity.displayName}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {capability.identifierLabel}: {identity.externalKey}
      </p>
      {identity.homeState ? <p className="text-sm text-muted-foreground">Recorded state: {identity.homeState}</p> : null}
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        You are requesting permission to manage business-supplied information associated with
        this specific TrustHub profile. Confirming your email does not verify ownership.
        Authorization is not an endorsement. {PUBLIC_CLAIM_CONTRACT.claimedMeaning}
      </p>
      <div className="mt-4 rounded-lg border border-border bg-slate-50 p-4 text-sm">
        <p><strong>Claiming lets you:</strong> manage information supplied by the business, submit corrections and use eligible account tools.</p>
        <p className="mt-2"><strong>Claiming does not:</strong> change official evidence, search ordering, publication, or TrustHub findings.</p>
        <p className="mt-2"><strong>Claiming is free.</strong> Corrections remain available without claiming.</p>
      </div>
      <a className="link-inline mt-3 inline-block text-sm" href={identity.profileHref}>
        View public Trust Report
      </a>
      <p className="mt-3 text-sm"><a className="link-inline" href="/claim/what-claiming-means">Read what claiming means</a></p>
    </div>
  );
}

export default async function ClaimContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ handoff?: string; auth_error?: string; confirmed?: string; source?: string }>;
}) {
  const sp = await searchParams;
  if (sp.handoff) {
    // Legitimate deep link. The accept route authenticates it and stores a passive receipt; nothing durable yet.
    const source = sp.source ? `&source=${encodeURIComponent(sp.source)}` : '';
    redirect(`/api/customer/claim/accept?handoff=${encodeURIComponent(sp.handoff)}${source}`);
  }

  const sessionToken = await readSessionToken();
  // ATH-OBS-002E: the query value is user-controllable. Only an allow-listed code is displayed or measured.
  const intentError = readClaimAuthErrorParam(sp.auth_error);
  const signInMessage = claimSignInErrorMessage(intentError);
  const justConfirmed = sp.confirmed === '1';
  const existing = await readIntentId();
  const receipt = await readClaimReceipt();

  const result = await withPlatform(async (p) => {
    const user = await p.sessionUser(sessionToken);
    if (existing) {
      const intent = await p.intentPreview(existing);
      // A live, unconsumed intent wins. A missing/expired/consumed intent never hides a newer receipt.
      if (intent && !intent.consumed || (intent && !receipt)) {
        const organizations = user ? await p.claimOrganizations(sessionToken || '') : [];
        return { intent, receiptIdentity: null as Identity | null, receiptError: null as string | null, user, organizations };
      }
    }
    if (receipt) {
      // Passive re-validation on refresh: authenticate + revalidate only. No intent, no audit row.
      try {
        const received = await p.receiveHandoff(receipt.token);
        return { intent: null, receiptIdentity: { hubId: received.payload.hub_id, displayName: received.displayName, externalKey: received.payload.external_key, homeState: received.payload.home_state, entityClass: received.payload.entity_class || received.payload.provider_class, profileHref: received.profileHref } as Identity, receiptError: null as string | null, user, organizations: [] };
      } catch (e) {
        const code = e instanceof HandoffError || e instanceof ClaimError ? e.code : 'unavailable';
        return { intent: null, receiptIdentity: null as Identity | null, receiptError: claimAcceptErrorCode(code) as string, user, organizations: [] };
      }
    }
    return { intent: null, receiptIdentity: null as Identity | null, receiptError: null as string | null, user, organizations: [] };
  });

  if (!result.intent && result.receiptIdentity) {
    // STATE B — passive receipt. Identity + what claiming means + EXPLICIT CONTINUE. Not yet a claim intent.
    const identity = result.receiptIdentity;
    const capability = CUSTOMER_HUB_REGISTRY[identity.hubId];
    return (
      <section className="space-y-6">
        <ClaimFunnelAnalytics event="claim_handoff_received" hub={identity.hubId} profileClass={identity.entityClass} state={identity.homeState || undefined} authenticated={Boolean(result.user)} />
        <ClaimProgress current={1} />
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo">AskTrustHub</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">
            Manage this {capability.displayName} profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Confirm this is the profile you represent before continuing. Nothing is recorded until you continue.</p>
        </header>
        <IdentityCard identity={identity} capability={capability} />
        <ClaimContinueConfirm profileHref={identity.profileHref} />
      </section>
    );
  }

  if (!result.intent) {
    const code = intentError || (result.receiptError as ReturnType<typeof readClaimAuthErrorParam>) || 'HANDOFF_INVALID';
    return (
      <>
        {signInMessage ? <p className="mb-4 rounded-lg border border-border bg-slate-50 p-4 text-sm" role="alert">{signInMessage}</p> : null}
        <ClaimRecoveryCard code={code} />
      </>
    );
  }

  // STATE A — durable intent exists (explicit Continue happened). Account confirmation / submission.
  const { intent, user } = result;
  const capability = CUSTOMER_HUB_REGISTRY[intent.payload.hub_id];
  const identity: Identity = { hubId: intent.payload.hub_id, displayName: intent.displayName, externalKey: intent.payload.external_key, homeState: intent.payload.home_state, entityClass: intent.payload.entity_class || intent.payload.provider_class, profileHref: intent.profileHref };
  return (
    <section className="space-y-6">
      {justConfirmed ? <ClaimFunnelAnalytics event="claim_continue_confirmed" hub={intent.payload.hub_id} profileClass={identity.entityClass} state={intent.payload.home_state || undefined} source={intent.acquisitionSource} authenticated={Boolean(user)} /> : null}
      <ClaimFunnelAnalytics event={user ? 'claim_auth_returned' : 'claim_auth_required'} hub={intent.payload.hub_id} source={intent.acquisitionSource} authenticated={Boolean(user)} />
      <ClaimProgress current={user ? 2 : 1} />
      {signInMessage ? <p className="rounded-lg border border-border bg-slate-50 p-4 text-sm" role="alert">{signInMessage}</p> : null}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">AskTrustHub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">
          Manage this {capability.displayName} profile
        </h1>
      </header>
      <IdentityCard identity={identity} capability={capability} />
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
