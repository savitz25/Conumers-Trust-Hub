import { createPageMetadata } from '@/lib/seo/metadata';
import type { ClaimStatus, CustomerHubId } from '@/lib/customer/types';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import Link from 'next/link';
import { AccountSignIn } from '@/components/customer/AccountSignIn';
import { ClaimProgress } from '@/components/customer/ClaimProgress';
import { CustomerActions } from '@/components/customer/CustomerActions';
import { CLAIM_EXPERIENCE, hubLabel, identifierLabel } from '@/lib/customer/experience';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'Request status',
  description: 'Status of an AskTrustHub profile-management request.',
  path: '/claim/status',
  noIndex: true,
});

export default async function ClaimStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionToken = await readSessionToken();
  if (!sessionToken) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold text-navy">Sign in to view your claim</h1>
        <p className="mt-2 text-sm text-muted-foreground">We will return you to this exact claim after the secure email link.</p>
        <AccountSignIn nextPath={`/claim/status/${id}`} />
      </div>
    );
  }
  try {
    const row = await withPlatform((p) => p.getClaimForUser(sessionToken, id));
    const status = row.status as ClaimStatus;
    const copy = CLAIM_EXPERIENCE[status];
    const hub = row.hub_id as CustomerHubId;
    const actions = copy.actions.map((action) => action.href === '/manage' && status === 'approved' ? { ...action, href: `/manage/${row.native_profile_id}` } : action);
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-12">
        <ClaimProgress current={copy.step} />
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">{copy.eyebrow}</p>
        <h1 className="text-2xl font-semibold text-navy">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <div className="card-surface p-5 text-sm leading-relaxed text-muted-foreground">
          <p>{String(row.display_name_snapshot || row.org_name)}</p>
          <p className="mt-1">{hubLabel(hub)}</p>
          <p className="mt-2">{identifierLabel(hub)}: {String(row.native_credential_key)}</p>
          {row.submitted_at || row.created_at ? <p className="mt-2">Submitted {new Date(String(row.submitted_at || row.created_at)).toLocaleDateString('en-US')}</p> : null}
          {row.decision_reason ? <p className="mt-3">{String(row.decision_reason)}</p> : null}
          {copy.timing ? <p className="mt-3 font-medium text-foreground">{copy.timing}</p> : null}
          <p className="mt-4">This status is about authorization to manage business-supplied information. Control verified, not endorsement.</p>
        </div>
        <CustomerActions actions={actions} />
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold text-navy">This claim is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may belong to another account or the link may no longer be current.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link className="btn-primary" href="/manage">View account</Link><Link className="btn-secondary" href="/claim/help?category=claim_unavailable">Request help</Link></div>
      </div>
    );
  }
}
