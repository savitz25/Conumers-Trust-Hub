import { HandoffError } from '@/lib/customer/handoff';
import { ClaimError } from '@/lib/customer/store';
import { RELATIONSHIP_LABELS, type RelationshipType } from '@/lib/customer/types';
import {
  currentContext,
  readIntentId,
  readSessionToken,
  setIntentCookie,
  withPlatform,
} from '@/lib/customer/server';
import { ClaimContinueForm } from './claim-continue-form';
import { customerLog } from '@/lib/customer/log';

export const dynamic = 'force-dynamic';

export default async function ClaimContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ handoff?: string; auth_error?: string }>;
}) {
  const sp = await searchParams;
  const sessionToken = await readSessionToken();
  const ctx = await currentContext();

  const intentError: string | null = sp.auth_error || null;
  let preview: {
    intentId: string;
    displayName: string;
    profileHref: string;
    slug: string;
    externalKey: string;
    nativeProfileId: string;
  } | null = null;

  try {
    const result = await withPlatform(async (p) => {
      if (sp.handoff) {
        const accepted = await p.acceptHandoff(sp.handoff, ctx);
        return { accepted, user: await p.sessionUser(sessionToken) };
      }
      const existing = await readIntentId();
      if (!existing) return { accepted: null, user: await p.sessionUser(sessionToken) };
      const intent = await p.intentPreview(existing);
      if (!intent) return { accepted: null, user: await p.sessionUser(sessionToken) };
      return {
        accepted: {
          intentId: existing,
          displayName: intent.displayName,
          profileHref: intent.profileHref,
          payload: intent.payload,
        },
        user: await p.sessionUser(sessionToken),
      };
    });
    if (result.accepted) {
      await setIntentCookie(result.accepted.intentId);
      preview = {
        intentId: result.accepted.intentId,
        displayName: result.accepted.displayName,
        profileHref: result.accepted.profileHref,
        slug: result.accepted.payload.slug,
        externalKey: result.accepted.payload.external_key,
        nativeProfileId: result.accepted.payload.native_profile_id,
      };
    }
    const user = result.user;

    if (!preview) {
      return (
        <section className="card-surface p-6">
          <h1 className="text-xl font-semibold text-navy">Claim context missing</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This page needs a valid signed handoff from ContractorTrustHub. Public claim buttons
            are not live yet (ATH-CUST-003). Internal operators can mint a test token.
          </p>
          {intentError ? <p className="mt-3 text-sm text-destructive">{intentError}</p> : null}
        </section>
      );
    }

    return (
      <section className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo">AskTrustHub</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy">
            Manage this ContractorTrustHub profile
          </h1>
        </header>
        <div className="card-surface p-5">
          <p className="text-lg font-medium text-foreground">{preview.displayName}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Florida DBPR credential: {preview.externalKey}
          </p>
          <p className="text-sm text-muted-foreground">Florida</p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            You are requesting permission to manage business-supplied information associated with
            this specific TrustHub profile. Confirming your email does not verify ownership.
            Authorization is not an endorsement.
          </p>
          <a className="link-inline mt-3 inline-block text-sm" href={preview.profileHref}>
            View public Trust Report
          </a>
        </div>
        <ClaimContinueForm
          authed={Boolean(user)}
          email={user?.email ?? ''}
          relationships={Object.entries(RELATIONSHIP_LABELS) as [RelationshipType, string][]}
          expectedCredential={preview.externalKey}
        />
      </section>
    );
  } catch (e) {
    const code =
      e instanceof HandoffError || e instanceof ClaimError
        ? e.code
        : e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string'
          ? (e as { code: string }).code
            : e instanceof Error
            ? e.name
            : 'unavailable';
    customerLog(
      'claim_continue_failed',
      { code, errName: e instanceof Error ? e.name : 'unknown' },
      'warn'
    );
    return (
      <section className="card-surface p-6">
        <h1 className="text-xl font-semibold text-navy">This handoff could not be used</h1>
        <p className="mt-3 text-sm text-muted-foreground">{code.replaceAll('_', ' ')}</p>
      </section>
    );
  }
}
