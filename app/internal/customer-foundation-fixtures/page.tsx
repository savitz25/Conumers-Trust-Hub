import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClaimRecoveryCard } from '@/components/customer/ClaimRecoveryCard';
import { CUSTOMER_HUB_REGISTRY } from '@/lib/customer/hub-registry';
import type { CustomerClaimErrorCode } from '@/lib/customer/claim-recovery';

export const dynamic = 'force-dynamic';

const successStates = {
  contractor: { title: 'Contractor valid claim', body: 'Exact published Florida DBPR profile confirmed.', hub: 'contractor', id: 'CCC-SYNTHETIC' },
  move: { title: 'Move valid claim', body: 'Exact published USDOT profile confirmed.', hub: 'move', id: 'USDOT 0000000' },
  lender: { title: 'Lender institution claim', body: 'Exact public institution profile confirmed.', hub: 'lender', id: 'NMLS 3030' },
  layer_c: { title: 'Business-supplied information', body: 'Layer C is attached to one exact hub and profile. It never replaces official evidence.', hub: 'move', id: 'Public DTO v2' },
  response: { title: 'Approved business response', body: 'Only the current approved, non-withdrawn response is public. Drafts and moderation notes remain private.', hub: 'lender', id: 'Public DTO v2' },
} as const;

const rejectionStates: Record<string, CustomerClaimErrorCode> = {
  move_rejected: 'PROFILE_NOT_PUBLIC',
  lender_branch: 'LENDER_BRANCH_NOT_CLAIMABLE',
  lender_mlo: 'LENDER_MLO_NOT_CLAIMABLE',
  identity_mismatch: 'PROFILE_IDENTITY_MISMATCH',
  profile_not_public: 'PROFILE_NOT_PUBLIC',
  expired_handoff: 'HANDOFF_EXPIRED',
  unsupported_hub: 'UNSUPPORTED_CUSTOMER_HUB',
  validation_unavailable: 'SPECIALIST_VALIDATION_UNAVAILABLE',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound();
  const key = (await searchParams).state || 'multi';
  const row = successStates[key as keyof typeof successStates];
  const rejection = rejectionStates[key];
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
    <header><p className="text-xs font-semibold uppercase tracking-wider text-indigo">Synthetic acceptance fixture · no customer PII</p><h1 className="mt-2 text-2xl font-semibold text-navy">Multi-hub customer foundation</h1></header>
    {key === 'multi' ? <section className="grid gap-4 sm:grid-cols-3">{(['contractor', 'move', 'lender'] as const).map((hub) => <article className="card-surface p-5" key={hub}><h2 className="font-semibold">Synthetic {CUSTOMER_HUB_REGISTRY[hub].displayName} profile</h2><p className="mt-2 text-sm">{CUSTOMER_HUB_REGISTRY[hub].identifierLabel}: SYNTHETIC</p><p className="mt-2 text-sm">Separate exact management grant</p><p className="mt-2 text-sm text-muted-foreground">Monitoring: {CUSTOMER_HUB_REGISTRY[hub].monitoring}</p></article>)}</section>
      : rejection ? <ClaimRecoveryCard code={rejection} headingLevel="h2" />
        : row ? <section className="card-surface p-6"><p className="text-xs uppercase tracking-wider text-indigo">{CUSTOMER_HUB_REGISTRY[row.hub].displayName}</p><h2 className="mt-2 text-xl font-semibold">{row.title}</h2><p className="mt-3 text-sm text-muted-foreground">{row.body}</p><p className="mt-3 text-sm">{row.id}</p><p className="mt-4 text-sm font-medium">Control verification is not endorsement.</p></section>
          : notFound()}
    <nav aria-label="Synthetic fixture states" className="flex flex-wrap gap-3 text-sm">
      {[...Object.keys(successStates), ...Object.keys(rejectionStates)].map((state) => <Link className="underline" key={state} href={`?state=${state}`}>{state.replaceAll('_', ' ')}</Link>)}
      <Link className="underline" href="?state=multi">multi-profile</Link>
    </nav>
  </main>;
}
