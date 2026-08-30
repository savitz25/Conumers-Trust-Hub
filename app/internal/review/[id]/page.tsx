import { createPageMetadata } from '@/lib/seo/metadata';
import { AuthError } from '@/lib/customer/store';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { ReviewActions } from './review-actions';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'Review claim',
  description: 'Staff-only AskTrustHub claim decision.',
  path: '/internal/review',
  noIndex: true,
});

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionToken = await readSessionToken();
  try {
    const detail = await withPlatform((p) => p.getReviewDetail(sessionToken || '', id));
    const claim = detail.claim;
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        <h1 className="text-2xl font-semibold text-navy">Review request</h1>
        <dl className="card-surface grid gap-3 p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">Claimant</dt>
            <dd>{String(claim.claimant_email)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email confirmed</dt>
            <dd>{claim.email_confirmed_at ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Profile</dt>
            <dd>{String(claim.display_name_snapshot)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">contractors.id</dt>
            <dd className="break-all">{String(claim.native_profile_id)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd>{String(claim.native_slug)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">DBPR external key</dt>
            <dd>{String(claim.native_credential_key)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Relationship attestation</dt>
            <dd>{String(claim.relationship_type)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Free email</dt>
            <dd>{claim.free_email ? 'Yes — manual review' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Claim status</dt>
            <dd>{String(claim.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Active grant</dt>
            <dd>{detail.grant ? String(detail.grant.id) : 'None'}</dd>
          </div>
        </dl>
        <section>
          <h2 className="text-sm font-semibold">Other claims on this profile</h2>
          <ul className="mt-2 text-sm text-muted-foreground">
            {detail.competing.map((c) => (
              <li key={String(c.id)}>
                {String(c.id)} · {String(c.status)}
              </li>
            ))}
            {detail.competing.length === 0 ? <li>None</li> : null}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-semibold">Audit</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {detail.audit.map((a, i) => (
              <li key={i}>
                {String(a.action)} · {String(a.actor_kind)}
              </li>
            ))}
          </ul>
        </section>
        <ReviewActions claimId={id} />
      </div>
    );
  } catch (e) {
    const code = e instanceof AuthError ? e.code : 'unavailable';
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <p>{code}</p>
      </div>
    );
  }
}
