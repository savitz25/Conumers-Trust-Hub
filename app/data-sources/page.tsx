import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { DATA_SOURCE_VERTICALS } from '@/lib/data-sources-library';
import { formatReviewDate, TRUST_PAGE_REVIEWED } from '@/lib/trust-reviewed';
import { ASK_BRAND } from '@/lib/design/ask-design-system';

export const metadata = createPageMetadata({
  title: 'Data Sources Library',
  description:
    'Primary regulatory sources used across the Ask Trust Hub network: FMCSA/SAFER for moving, NMLS/CFPB/FDIC for lending, state DOI/NAIC for insurance — with limits and primary links.',
  path: '/data-sources',
});

export default function DataSourcesPage() {
  return (
    <>
      <PageHeader
        label="Data sources"
        title="Primary-source library"
        description="Licensing registries and public records first. Marketing claims last—if at all. Organized by vertical so you can re-check the same authorities we cite."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Each Trust Hub is only as good as its sources. Prefer primary regulatory systems over
            secondary summaries. Specialist hubs may cite additional market-specific sources
            on-page.
          </p>
          <LastReviewed date={TRUST_PAGE_REVIEWED.dataSources} />
        </div>

        <div className="space-y-16">
          {DATA_SOURCE_VERTICALS.map((vertical) => (
            <section
              key={vertical.id}
              id={vertical.id}
              aria-labelledby={`sources-${vertical.id}`}
              className="scroll-mt-24"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-[0.14em]"
                    style={{ color: ASK_BRAND.indigo }}
                  >
                    {vertical.hubLabel}
                  </p>
                  <h2
                    id={`sources-${vertical.id}`}
                    className="mt-1 text-2xl font-semibold tracking-tight"
                    style={{ color: ASK_BRAND.navy }}
                  >
                    {vertical.title}
                  </h2>
                </div>
                {vertical.hubUrl ? (
                  <a
                    href={vertical.hubUrl}
                    rel="noopener noreferrer"
                    className="text-sm font-semibold underline-offset-4 hover:underline"
                    style={{ color: ASK_BRAND.indigo }}
                  >
                    Open specialist hub
                  </a>
                ) : null}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: ASK_BRAND.ink }}>
                {vertical.intro}
              </p>

              <ul className="mt-8 space-y-5">
                {vertical.sources.map((source) => (
                  <li
                    key={source.id}
                    className="rounded-2xl border bg-white p-6 sm:p-7"
                    style={{ borderColor: ASK_BRAND.border }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <h3
                        className="text-lg font-semibold tracking-tight"
                        style={{ color: ASK_BRAND.navy }}
                      >
                        {source.name}
                      </h3>
                      <a
                        href={source.url}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-semibold shrink-0"
                        style={{ color: ASK_BRAND.indigo }}
                      >
                        Primary source
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </div>

                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt
                          className="text-xs font-semibold uppercase tracking-[0.12em]"
                          style={{ color: ASK_BRAND.indigo }}
                        >
                          What it is
                        </dt>
                        <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                          {source.whatItIs}
                        </dd>
                      </div>
                      <div>
                        <dt
                          className="text-xs font-semibold uppercase tracking-[0.12em]"
                          style={{ color: ASK_BRAND.indigo }}
                        >
                          What information it provides
                        </dt>
                        <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                          {source.provides}
                        </dd>
                      </div>
                      <div>
                        <dt
                          className="text-xs font-semibold uppercase tracking-[0.12em]"
                          style={{ color: ASK_BRAND.indigo }}
                        >
                          How Trust Hub uses it
                        </dt>
                        <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                          {source.howWeUse}
                        </dd>
                      </div>
                      <div>
                        <dt
                          className="text-xs font-semibold uppercase tracking-[0.12em]"
                          style={{ color: ASK_BRAND.indigo }}
                        >
                          What it cannot prove
                        </dt>
                        <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                          {source.cannotProve}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-4 text-xs font-medium" style={{ color: ASK_BRAND.ink }}>
                      Source entry last reviewed:{' '}
                      <time dateTime={source.lastReviewed}>
                        {formatReviewDate(source.lastReviewed)}
                      </time>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="prose-trust mt-16">
          <h2>Re-verify yourself</h2>
          <p>
            We compile and interpret public information. We do not replace official registries.
            Before hiring a mover, buying a policy, or signing a loan, confirm current licensing and
            terms directly with the relevant regulator and provider.
          </p>
          <p className="mt-8 flex flex-wrap gap-4 not-prose">
            <Link href="/methodology" className="btn-primary">
              Read the Ask Trust Hub Standard
            </Link>
            <Link href="/promise" className="btn-secondary">
              Independence policy
            </Link>
            <Link href="/corrections" className="btn-secondary">
              Report a correction
            </Link>
            <Link href="/editorial-standards" className="btn-secondary">
              Editorial standards
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
