import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { TrustMark } from '@/components/trust-mark';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TRUST_CENTER_LINKS } from '@/lib/situations';
import { STANDARD_INHERITANCE } from '@/lib/standard';

export const metadata = createPageMetadata({
  title: 'Trust Center',
  description:
    'Ask Trust Hub Trust Center: The Ask Trust Hub Standard, independence, data sources, revenue disclosure, corrections, and vertical methodology on Move, Insurance, and Lender.',
  path: '/trust',
});

/**
 * Trust Center index — network standards + vertical methodology entry points.
 */
export default function TrustCenterPage() {
  return (
    <>
      <PageHeader
        label="Trust Center"
        title="Standards for the whole network"
        description="Independence, methodology, funding, and corrections — owned once on Ask Trust Hub. Specialist hubs publish industry-specific methodology under the same Standard."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-8">
          <TrustMark />
        </div>
        <section aria-labelledby="network-standards-heading">
          <h2
            id="network-standards-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Network standards (Ask)
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_CENTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-xl border border-border/80 bg-background p-5 transition-colors hover:border-navy/20 hover:bg-muted/20"
                >
                  <span className="font-semibold text-foreground">{item.label}</span>
                  <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.detail}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="profiles-heading">
          <h2
            id="profiles-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Trust Profiles (specialist hubs only)
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Trust Profiles on Move, Insurance, and Lender share one shell: verification sources,
            contact, optional research scores, methodology links, and The Ask Trust Hub Standard.
            Ask does not host directories or entity search — open a specialist hub to research a
            provider.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="vertical-methodology-heading">
          <h2
            id="vertical-methodology-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Vertical methodology (specialist hubs)
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Each hub inherits The Ask Trust Hub Standard, then documents sources, checks, scores,
            cadence, and limits for its industry.
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {STANDARD_INHERITANCE.map((hub) => (
              <li key={hub.hub}>
                <a
                  href={hub.url}
                  className="flex h-full flex-col rounded-xl border border-border/80 bg-background p-5 transition-colors hover:border-navy/20 hover:bg-muted/20"
                  rel="noopener noreferrer"
                >
                  <span className="font-semibold text-foreground">{hub.hub}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{hub.domain}</span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {hub.focus}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy">
                    Open methodology
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
