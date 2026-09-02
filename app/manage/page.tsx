import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { PUBLIC_LANGUAGE } from '@/lib/customer/copy';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { AccountSignIn } from '@/components/customer/AccountSignIn';
import { CUSTOMER_HUB_REGISTRY, customerEntityClassLabel } from '@/lib/customer/hub-registry';

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
  const [rows, claims] = await Promise.all([withPlatform((p) => p.managedHome(sessionToken)), withPlatform((p) => p.customerClaims(sessionToken))]);
  const openClaims = claims.filter((claim) => ['submitted','needs_info','in_review'].includes(String(claim.status)));
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo">{PUBLIC_LANGUAGE.managedProfile}</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy">Your customer dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are authorized to manage business-supplied information. This is not a TrustHub endorsement.
        </p>
      </header>
      <section aria-labelledby="overview-heading"><h2 id="overview-heading" className="text-xl font-semibold text-navy">Overview</h2><div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="card-surface p-4"><p className="text-sm text-muted-foreground">Managed profiles</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></div><div className="card-surface p-4"><p className="text-sm text-muted-foreground">Claims in progress</p><p className="mt-1 text-2xl font-semibold">{openClaims.length}</p></div><div className="card-surface p-4"><p className="text-sm text-muted-foreground">Needs attention</p><p className="mt-1 text-2xl font-semibold">{claims.filter((claim) => claim.status === 'needs_info').length}</p></div></div></section>
      {openClaims.length ? <section><h2 className="text-xl font-semibold text-navy">Claims in progress</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{openClaims.map((claim)=><article key={String(claim.id)} className="card-surface p-4"><p className="text-xs font-semibold uppercase tracking-wider text-indigo">{String(claim.status).replaceAll('_',' ')}</p><h3 className="mt-1 font-semibold">{String(claim.display_name_snapshot)}</h3><Link className="link-inline mt-3 inline-block" href={`/claim/status/${claim.id}`}>View claim status</Link></article>)}</div></section>:null}
      <section><h2 className="text-xl font-semibold text-navy">Managed profiles</h2><div className="mt-3 grid gap-4 md:grid-cols-2">
      {rows.length === 0 ? (
        <div className="card-surface p-5"><h3 className="font-semibold text-navy">You don&apos;t manage a profile yet.</h3><p className="mt-2 text-sm text-muted-foreground">Start from an exact published profile, or continue a claim already in progress.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="btn-primary" href="/ask">Find your business</Link><Link className="btn-secondary" href="/claim/help?category=find_profile">Contact support</Link></div></div>
      ) : (
        rows.map((row) => (
          <article key={String(row.grant_id)} className="card-surface space-y-2 p-5">
            <h2 className="text-lg font-medium">{String(row.display_name || row.display_name_snapshot)}</h2>
            <p className="text-sm text-muted-foreground">{CUSTOMER_HUB_REGISTRY[row.hub_id as keyof typeof CUSTOMER_HUB_REGISTRY].displayName} · Role: {String(row.role)}</p>
            <p className="text-sm text-muted-foreground">Profile class: {customerEntityClassLabel(row.entity_class)}</p>
            <p className="text-sm text-muted-foreground">Status: {String(row.grant_status)}</p>
            <p className="text-sm text-muted-foreground">
              {String(row.identifier_namespace||'Credential')} {String(row.native_credential_key)}
            </p>
            <Link className="inline-flex min-h-11 items-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white" href={`/manage/${row.native_profile_id}`}>
              Manage profile
            </Link>
            <Link className="ml-2 inline-flex min-h-11 items-center text-sm underline" href={`/manage/organization/${row.org_id}`}>Team &amp; organization</Link>
            {row.canonical_url?<a
              className="link-inline ml-4 text-sm"
              href={String(row.canonical_url)}
            >
              Open public specialist profile
            </a>:null}
            <p className="pt-3 text-sm text-muted-foreground">{CUSTOMER_HUB_REGISTRY[row.hub_id as keyof typeof CUSTOMER_HUB_REGISTRY].monitoring==='SUPPORTED'?'Monitoring is available inside this managed profile and is always optional.':'Monitoring is not yet available for this specialist source.'}</p>
          </article>
        ))
      )}
      </div></section>
      <section className="card-surface p-5"><h2 className="text-xl font-semibold text-navy">Account</h2><p className="mt-2 text-sm text-muted-foreground">Use one AskTrustHub account to manage separate exact profiles across supported Trust Hubs. Similar names are never merged.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="btn-secondary" href="/ask">Claim another profile</Link><Link className="btn-secondary" href="/claim/help?category=account_help">Contact support</Link></div></section>
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
