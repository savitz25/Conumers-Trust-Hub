import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { PUBLIC_LANGUAGE } from '@/lib/customer/copy';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { AccountSignIn } from '@/components/customer/AccountSignIn';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'Managed profile',
  description: 'AskTrustHub managed-profile home for authorized representatives.',
  path: '/manage',
  noIndex: true,
});

export default async function ManagePage() {
  const sessionToken = await readSessionToken();
  if (!sessionToken) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-xl font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">This area is for authorized business representatives.</p>
        <AccountSignIn />
      </div>
    );
  }
  const rows = await withPlatform((p) => p.managedHome(sessionToken));
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">{PUBLIC_LANGUAGE.managedProfile}</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy">Authorization confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are authorized to manage business-supplied information. This is not a TrustHub endorsement.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active management grants on this account.</p>
      ) : (
        rows.map((row) => (
          <article key={String(row.grant_id)} className="card-surface space-y-2 p-5">
            <h2 className="text-lg font-medium">{String(row.display_name || row.display_name_snapshot)}</h2>
            <p className="text-sm text-muted-foreground">{String(row.hub_id)} TrustHub · Role: {String(row.role)}</p>
            <p className="text-sm text-muted-foreground">Status: {String(row.grant_status)}</p>
            <p className="text-sm text-muted-foreground">
              Florida DBPR credential {String(row.native_credential_key)}
            </p>
            <Link className="inline-flex min-h-11 items-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white" href={`/manage/${row.native_profile_id}`}>
              Manage profile
            </Link>
            <Link className="ml-2 inline-flex min-h-11 items-center text-sm underline" href={`/manage/organization/${row.org_id}`}>Team &amp; organization</Link>
            {row.hub_id==='contractor'?<a
              className="link-inline ml-4 text-sm"
              href={`https://www.contractortrusthub.com/contractors/${row.native_slug}`}
            >
              Open ContractorTrustHub profile
            </a>:null}
            <p className="pt-3 text-sm text-muted-foreground">Monitoring is available inside this managed profile and is always optional.</p>
          </article>
        ))
      )}
      <form action="/api/customer/auth/logout" method="post">
        <button type="submit" className="text-sm text-muted-foreground underline">
          Sign out
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        <Link href="/">Back to AskTrustHub</Link>
      </p>
    </div>
  );
}
