import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const cards = [
  ['Citizens exact public legal insurer', 'NAIC 10064 · exact public-profile legal-insurer identity'],
  ['Florida Peninsula exact public legal insurer', 'NAIC 10132 · exact public-profile legal-insurer identity'],
  ['A Central restricted', 'NAIC 11105 remains a research row and cannot be claimed'],
  ['Agency blocked', 'Research agency identities are not public canonical claim profiles'],
  ['Producer blocked', 'Individual producer profiles are outside the business claim program'],
  ['UUID mismatch', 'The national_entities.id and NAIC Company Code must agree'],
  ['NAIC mismatch', 'No fuzzy, name, NPN, brand, or group fallback is allowed'],
  ['Canonical destination mismatch', 'The exact current InsuranceTrustHub insurer URL must agree'],
  ['Insurance business information', 'Business-supplied contact fields remain separate from official evidence'],
  ['Insurance approved response', 'Only an approved response for the exact legal-insurer profile is public'],
  ['Insurance correction', 'A correction request never overwrites insurer evidence'],
  ['Insurance monitoring unavailable', 'Profile, evidence, correction, and support actions remain available'],
  ['Multi-hub isolation', 'Insurance access remains an independent exact-profile grant'],
  ['Support and review recovery', 'Every rejection explains the outcome and offers safe next actions'],
] as const;

export default function Page() {
  if (process.env.VERCEL_ENV === 'production') notFound();
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <p className="text-xs font-semibold uppercase tracking-wider text-indigo">Synthetic Insurance customer acceptance environment · No real customer PII</p>
    <h1 className="mt-2 text-3xl font-semibold text-navy">Insurance legal-insurer customer foundation fixtures</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([title, body]) => <article key={title} className="card-surface p-5" tabIndex={0}>
        <h2 className="font-semibold text-navy">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <p className="mt-3 text-sm">Control verified, not endorsement.</p>
      </article>)}
    </div>
  </main>;
}
