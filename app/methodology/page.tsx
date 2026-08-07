import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { TrustMark } from '@/components/trust-mark';
import { createPageMetadata } from '@/lib/seo/metadata';
import {
  STANDARD_INHERITANCE,
  STANDARD_NEVER,
  STANDARD_PIPELINE,
  STANDARD_VOCABULARY,
} from '@/lib/standard';
import { BRAND } from '@/lib/brand';
import { ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';
import { TRUST_PAGE_REVIEWED } from '@/lib/trust-reviewed';
import { ASK_BRAND } from '@/lib/design/ask-design-system';

export const metadata = createPageMetadata({
  title: 'The Ask Trust Hub Standard — Network Methodology',
  description:
    'The Ask Trust Hub Standard: SOURCE → VERIFY → DISCLOSE → SCORE → UPDATE → YOU DECIDE. Shared research principles for Move, Insurance, and Lender Trust Hub. Vertical-specific scoring. Rankings not for sale.',
  path: '/methodology',
});

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        label="The Ask Trust Hub Standard"
        title="Shared research principles. Vertical-specific checks."
        description="This is the network methodology for Ask Trust Hub. The framework is shared. Data sources and verification checks are owned by each specialist hub. Scoring—when used—is never a single formula forced across industries."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TrustMark />
          <LastReviewed date={TRUST_PAGE_REVIEWED.standard} />
        </div>

        <div className="prose-trust max-w-3xl">
          <p>
            {BRAND.name} is the parent knowledge and standards layer for Move Trust Hub, Insurance
            Trust Hub, and Lender Trust Hub. {ASK_NETWORK_OWNERSHIP_SHORT}.
          </p>
          <p>
            This Standard defines how the network treats evidence — not a marketplace rulebook and
            not a universal score sold to providers. Moving, insurance, and lending are regulated
            differently. A useful methodology keeps independence rules shared while allowing each
            hub to document its own sources, checks, scoring (if any), update practices, and limits.
          </p>
        </div>

        <div
          className="mt-10 overflow-x-auto rounded-xl border p-4 sm:p-5"
          style={{
            borderColor: ASK_BRAND.border,
            backgroundColor: ASK_BRAND.periwinkle,
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Core pipeline
          </p>
          <p
            className="mt-3 font-mono text-sm font-semibold tracking-wide sm:text-base"
            style={{ color: ASK_BRAND.navy }}
          >
            SOURCE → VERIFY → DISCLOSE → SCORE → UPDATE → YOU DECIDE
          </p>
        </div>

        <section className="mt-14" aria-labelledby="pipeline-heading">
          <h2
            id="pipeline-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            The six steps
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Read these in order. Each step states what it means, what is included, and what is{' '}
            <em>not</em> claimed. Specialist hubs apply each step with industry-specific sources.
          </p>
          <ol className="mt-8 space-y-6">
            {STANDARD_PIPELINE.map((item) => (
              <li
                key={item.id}
                id={item.id}
                className="scroll-mt-24 rounded-2xl border bg-white p-6 sm:p-8"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: ASK_BRAND.indigo }}
                  >
                    {item.step}
                  </span>
                  <span
                    className="text-xs font-bold uppercase tracking-[0.14em]"
                    style={{ color: ASK_BRAND.navy }}
                  >
                    {item.verb}
                  </span>
                </div>
                <h3
                  className="mt-2 text-lg font-semibold tracking-tight sm:text-xl"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: ASK_BRAND.ink }}>
                  {item.body}
                </p>

                <div className="mt-6 grid gap-5 sm:grid-cols-3">
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-[0.12em]"
                      style={{ color: ASK_BRAND.indigo }}
                    >
                      What it means
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                      {item.means}
                    </p>
                  </div>
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-[0.12em]"
                      style={{ color: ASK_BRAND.indigo }}
                    >
                      What is included
                    </h4>
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                      {item.includes.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#4F46E5]" aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4
                      className="text-xs font-semibold uppercase tracking-[0.12em]"
                      style={{ color: ASK_BRAND.indigo }}
                    >
                      What is not claimed
                    </h4>
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                      {item.notClaimed.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#94A3B8]" aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16" aria-labelledby="score-note-heading">
          <h2
            id="score-note-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Scoring is vertical-specific
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            There is <strong>no single universal Trust Score</strong> forced across moving, lending,
            and insurance. When a specialist hub shows a composite score, factors are defined on
            that hub’s methodology because the industries differ. What is shared network-wide is the
            rule that ranking position is not for sale — not a formula that pretends every market is
            the same.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="never-heading">
          <h2
            id="never-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            What the network never does
          </h2>
          <ul className="mt-6 space-y-3">
            {STANDARD_NEVER.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed sm:text-[15px]" style={{ color: ASK_BRAND.ink }}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="inherit-heading">
          <h2
            id="inherit-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            How verticals inherit the Standard
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Ask owns the shared framework. Each hub publishes industry methodology that cites this
            Standard, then documents sources, checks, scores, cadence, and limits for its market.
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {STANDARD_INHERITANCE.map((hub) => (
              <li
                key={hub.hub}
                className="flex h-full flex-col rounded-2xl border bg-white p-6"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <h3 className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {hub.hub}
                </h3>
                <p className="mt-1 text-xs" style={{ color: ASK_BRAND.ink }}>
                  {hub.domain}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {hub.focus}
                </p>
                <a
                  href={hub.url}
                  className="btn-secondary mt-5 w-full sm:w-auto"
                  rel="noopener noreferrer"
                >
                  Vertical methodology
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="vocab-heading">
          <h2
            id="vocab-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Shared vocabulary
          </h2>
          <dl className="mt-8 space-y-5">
            {STANDARD_VOCABULARY.map((item) => (
              <div
                key={item.term}
                className="border-b pb-5 last:border-0"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <dt className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {item.term}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {item.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="prose-trust mt-16 max-w-3xl">
          <h2>Important limits</h2>
          <p>
            Public records lag reality. Licenses get suspended, companies rebrand, complaint data is
            incomplete, and modeled calculators are educational only. Always re-check FMCSA, state
            DOI / NAIC pathways, NMLS Consumer Access, and the provider’s own documentation before
            you sign.
          </p>
        </section>

        <nav
          className="mt-12 flex flex-col gap-3 border-t pt-8 text-sm font-semibold sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2"
          style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
          aria-label="Related Trust Center pages"
        >
          <Link href="/data-sources" className="underline-offset-4 hover:underline">
            Primary data sources library
          </Link>
          <Link href="/promise" className="underline-offset-4 hover:underline">
            Independence policy
          </Link>
          <Link href="/editorial-standards" className="underline-offset-4 hover:underline">
            Editorial standards
          </Link>
          <Link href="/how-we-make-money" className="underline-offset-4 hover:underline">
            How we make money
          </Link>
          <Link href="/corrections" className="underline-offset-4 hover:underline">
            Corrections policy
          </Link>
          <Link href="/who-we-are" className="underline-offset-4 hover:underline">
            Who we are
          </Link>
          <Link href="/trust" className="underline-offset-4 hover:underline">
            Trust Center
          </Link>
        </nav>
      </div>
    </>
  );
}
