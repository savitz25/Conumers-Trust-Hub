import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const cards = [
  ['AHARA exact public firm', 'CRD 312385 · exact public-current firm identity'],
  ['Providence exact public ERA firm', 'CRD 333507 · ERA status remains evidence on one firm identity'],
  ['CRD 166089 research-only rejection', 'Publication restriction blocks customer-profile creation'],
  ['Representative rejection', 'Individual representatives are outside the business claim program'],
  ['UUID mismatch', 'The canonical firms.id and organization CRD must agree'],
  ['CRD mismatch', 'No fuzzy or name-based fallback is allowed'],
  ['Canonical destination mismatch', 'The exact current InvestorTrustHub profile URL must agree'],
  ['Investor business information', 'Business-supplied contact fields remain separate from Form ADV evidence'],
  ['Investor approved response', 'Only an approved response for the exact firm profile is public'],
  ['Investor correction', 'A correction request never overwrites regulatory evidence'],
  ['Investor monitoring unavailable', 'Useful profile, evidence, correction, and support actions remain available'],
  ['Multi-hub managed account', 'Investor access remains an independent exact-profile grant'],
  ['Same-name and representative firewall', 'Names, affiliates, and representatives create no profile merge or grant'],
  ['Support and review recovery', 'Every rejection explains the outcome and offers safe next actions'],
  ['Contract drift failure state', 'Version or fingerprint drift stops validation without minting a handoff'],
] as const;

export default function Page() {
  if (process.env.VERCEL_ENV === 'production') notFound();
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <p className="text-xs font-semibold uppercase tracking-wider text-indigo">Synthetic Investor customer acceptance environment · No real customer PII</p>
    <h1 className="mt-2 text-3xl font-semibold text-navy">Investor customer foundation fixtures</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([title, body]) => <article key={title} className="card-surface p-5" tabIndex={0}>
        <h2 className="font-semibold text-navy">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <p className="mt-3 text-sm">Control verified, not endorsement.</p>
      </article>)}
    </div>
  </main>;
}
