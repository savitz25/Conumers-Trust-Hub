import { createPageMetadata } from '@/lib/seo/metadata';
import { CLAIM_STATUS_COPY, type ClaimStatus } from '@/lib/customer/types';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import Link from 'next/link';

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
        <p>Sign in to view this request.</p>
      </div>
    );
  }
  try {
    const row = await withPlatform((p) => p.getClaimForUser(sessionToken, id));
    const status = row.status as ClaimStatus;
    const copy = CLAIM_STATUS_COPY[status];
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">{copy.title}</p>
        <h1 className="text-2xl font-semibold text-navy">{copy.body}</h1>
        <div className="card-surface p-5 text-sm leading-relaxed text-muted-foreground">
          <p>{String(row.display_name_snapshot || row.org_name)}</p>
          <p className="mt-2">Florida DBPR credential: {String(row.native_credential_key)}</p>
          {row.decision_reason ? <p className="mt-3">{String(row.decision_reason)}</p> : null}
          <p className="mt-4">This status is about authorization to manage business-supplied information. It is not a quality rating.</p>
        </div>
        {status === 'approved' ? (
          <Link href="/manage" className="inline-block rounded-lg bg-indigo px-4 py-3 text-sm font-semibold text-white">
            Open managed profile
          </Link>
        ) : null}
      </div>
    );
  } catch {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <p>This request is not available on this account.</p>
      </div>
    );
  }
}
