import { Shield, Ban, Database, Eye } from 'lucide-react';
import { createPageMetadata } from '@/lib/seo/metadata';
import { VERIFICATION_SOURCES } from '@/lib/stats';

export const metadata = createPageMetadata({
  title: 'Trust & Verification',
  description:
    'Our independence pledge, verification methodology, and data sources across FMCSA, NMLS, DOI, CFPB, BBB, and attributed reviews.',
  path: '/trust',
});

const PLEDGES = [
  {
    icon: Ban,
    title: 'Zero Paid Placements',
    description:
      'No company can buy ranking position on any Trust Hub directory. Listings are based on verification data and transparent scoring — never sponsorship fees.',
  },
  {
    icon: Database,
    title: 'Multi-Source Verification',
    description:
      'We aggregate licensing data from FMCSA, NMLS, state DOI records, CFPB complaints, BBB ratings, and attributed third-party reviews.',
  },
  {
    icon: Eye,
    title: 'Full Transparency',
    description:
      'Methodology, disclaimers, and data limitations are disclosed on every site. We tell you what we know, what we do not know, and how to verify independently.',
  },
  {
    icon: Shield,
    title: 'Independence Guarantee',
    description:
      'We are not a mover, lender, broker, or insurance agency. We do not originate loans, sell policies, or book moves. Pure research and comparison.',
  },
];

export default function TrustPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-trust/20 bg-trust/10 px-4 py-1.5 text-sm font-semibold text-trust">
          <Shield className="h-4 w-4" />
          INDEPENDENCE PLEDGE
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Trust & Verification</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          How we verify providers, why we never accept paid placements, and what you should
          always double-check yourself.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {PLEDGES.map((pledge) => (
          <div key={pledge.title} className="rounded-xl border p-6">
            <pledge.icon className="h-8 w-8 text-trust" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">{pledge.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{pledge.description}</p>
          </div>
        ))}
      </div>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-semibold">Verification Sources</h2>
        <ul className="mt-6 space-y-3">
          {VERIFICATION_SOURCES.map((source) => (
            <li key={source} className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-trust shrink-0" />
              {source}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 max-w-3xl rounded-xl border bg-muted/30 p-6">
        <h2 className="font-semibold">Important Disclaimer</h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Data on Consumers Trust Hub and its sister sites is compiled from public records and
          third-party sources for informational purposes. Licensing status, complaint counts, and
          review data may change without notice. Always verify directly with FMCSA.gov, NMLS
          Consumer Access, and your state Department of Insurance before making financial or
          contractual commitments. We are not responsible for decisions made based on directory
          information.
        </p>
      </section>
    </div>
  );
}