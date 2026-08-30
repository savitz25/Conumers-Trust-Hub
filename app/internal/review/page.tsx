import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { AuthError } from '@/lib/customer/store';
import { readSessionToken, withPlatform } from '@/lib/customer/server';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'Claim review',
  description: 'Staff-only AskTrustHub claim review.',
  path: '/internal/review',
  noIndex: true,
});

export default async function ReviewQueuePage() {
  const sessionToken = await readSessionToken();
  try {
    const rows = await withPlatform((p) => p.listOpenReviews(sessionToken || ''));
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        <h1 className="text-2xl font-semibold text-navy">Review queue</h1>
        <p className="text-sm text-muted-foreground">Staff only. Entitlements do not change review order.</p>
        {rows.length === 0 ? <p>No open items.</p> : null}
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={String(row.id)} className="card-surface p-4">
              <Link href={`/internal/review/${row.claim_id}`} className="font-medium text-navy">
                {String(row.display_name_snapshot || row.native_slug)} · {String(row.native_credential_key)}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {String(row.work_type)} · {String(row.risk_state)} · {String(row.claimant_email)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  } catch (e) {
    const code = e instanceof AuthError ? e.code : 'forbidden';
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-xl font-semibold">Staff sign-in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">{code}</p>
      </div>
    );
  }
}
