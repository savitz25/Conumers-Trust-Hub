import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { BRAND } from '@/lib/brand';
import { customerClaimRecovery } from '@/lib/customer/claim-recovery';

export const dynamic = 'force-dynamic';

export default async function ClaimHelpPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const category = (await searchParams).category;
  const recovery = customerClaimRecovery(category);
  return <>
    <PageHeader label="Profile claim help" title="Request help with a profile claim" description="AskTrustHub can review a profile classification or association without bypassing identity, publication, or security safeguards." />
    <main className="container-page py-12">
      <section className="card-surface max-w-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground">What we can review</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{recovery.headline} {recovery.why}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Tell support which public Trust Hub profile and public identifier you were researching. Do not send passwords, claim links, verification documents, or other private evidence by email.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a className="btn-primary" href={`mailto:${BRAND.email}?subject=${encodeURIComponent('Profile claim review request')}`}>Contact support</a>
          <Link className="btn-secondary" href="/ask">Find the profile again</Link>
        </div>
      </section>
    </main>
  </>;
}
