import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import {
  STANDARD_INHERITANCE,
  STANDARD_NEVER,
  STANDARD_PIPELINE,
  STANDARD_VOCABULARY,
} from '@/lib/standard';
import { BRAND } from '@/lib/brand';
import { TrustMark } from '@/components/trust-mark';

export const metadata = createPageMetadata({
  title: 'The Ask Trust Hub Standard — Network Methodology',
  description:
    'The Ask Trust Hub Standard: shared research principles for Move Trust Hub, Insurance Trust Hub, and Lender Trust Hub. SOURCE → VERIFY → DISCLOSE → SCORE → UPDATE → YOU DECIDE. Rankings not for sale.',
  path: '/methodology',
});

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        label="The Ask Trust Hub Standard"
        title="Shared research principles. Vertical-specific checks."
        description="This is the network methodology for Ask Trust Hub. The framework is shared. The data sources and verification checks are owned by each specialist hub."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-6">
          <TrustMark />
        </div>
        <div className="prose-trust max-w-3xl">
          <p>
            {BRAND.name} is the discovery and trust parent for three specialist research
            destinations: Move Trust Hub, Insurance Trust Hub, and Lender Trust Hub. This Standard
            defines how the network thinks about evidence — not a single score formula forced onto
            every industry.
          </p>
          <p>
            Moving, insurance, and lending are regulated differently. A useful methodology must
            inherit the same independence rules while allowing each hub to document its own sources,
            checks, scoring (if any), update practices, and limitations.
          </p>
        </div>

        {/* Pipeline overview strip */}
        <div className="mt-10 overflow-x-auto rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Core pipeline
          </p>
          <p className="mt-3 font-mono text-sm font-semibold tracking-wide text-foreground sm:text-base">
            SOURCE → VERIFY → DISCLOSE → SCORE → UPDATE → YOU DECIDE
          </p>
        </div>

        {/* Six steps */}
        <section className="mt-14" aria-labelledby="pipeline-heading">
          <h2 id="pipeline-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            The six steps
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Read these in order. Specialist hubs apply each step with industry-specific sources and
            tooling — linked below.
          </p>
          <ol className="mt-8 space-y-4">
            {STANDARD_PIPELINE.map((item) => (
              <li key={item.id} className="card-surface flex gap-5 p-6">
                <div className="shrink-0 text-center">
                  <span className="block text-xs font-semibold tabular-nums text-trust">
                    {item.step}
                  </span>
                  <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-navy">
                    {item.verb}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* What we never do */}
        <section className="mt-16" aria-labelledby="never-heading">
          <h2 id="never-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            What the network never does
          </h2>
          <ul className="mt-6 space-y-3">
            {STANDARD_NEVER.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <Link
              href="/promise"
              className="font-semibold text-navy underline-offset-4 hover:underline"
            >
              Independence policy
            </Link>
            <Link
              href="/how-we-make-money"
              className="font-semibold text-navy underline-offset-4 hover:underline"
            >
              How we make money
            </Link>
          </div>
        </section>

        {/* Inheritance */}
        <section className="mt-16" aria-labelledby="inherit-heading">
          <h2 id="inherit-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            How verticals inherit the Standard
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Ask owns the shared framework. Each hub publishes industry methodology that cites this
            Standard, then documents sources, checks, scores, cadence, and limits for its market.
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {STANDARD_INHERITANCE.map((hub) => (
              <li key={hub.hub} className="card-surface flex h-full flex-col p-6">
                <h3 className="text-base font-semibold text-foreground">{hub.hub}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{hub.domain}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
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

        {/* Trust Profiles (shell lives on specialist hubs — Ask does not host directories) */}
        <section className="mt-16" aria-labelledby="profiles-heading">
          <h2 id="profiles-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            Trust Profiles on specialist hubs
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Entity profiles on Move Trust Hub, Insurance Trust Hub, and Lender Trust Hub share one
            shell: verification sources, optional research scores, contact when available, and links
            to vertical methodology plus this Standard. Engines stay vertical (FMCSA, DOI, NMLS).{' '}
            {BRAND.name} does not host provider directories or render full listings.
          </p>
        </section>

        {/* Vocabulary */}
        <section className="mt-16" aria-labelledby="vocab-heading">
          <h2 id="vocab-heading" className="text-2xl font-semibold tracking-tight text-foreground">
            Shared vocabulary
          </h2>
          <dl className="mt-8 space-y-5">
            {STANDARD_VOCABULARY.map((item) => (
              <div key={item.term} className="border-b border-border/70 pb-5 last:border-0">
                <dt className="font-semibold text-foreground">{item.term}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Limits + CTAs */}
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
          className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/70 pt-8 text-sm font-semibold text-navy"
          aria-label="Related Trust Center pages"
        >
          <Link href="/promise" className="underline-offset-4 hover:underline">
            Promise
          </Link>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link href="/data-sources" className="underline-offset-4 hover:underline">
            Data sources
          </Link>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link href="/corrections" className="underline-offset-4 hover:underline">
            Corrections
          </Link>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link href="/how-we-make-money" className="underline-offset-4 hover:underline">
            How we make money
          </Link>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link href="/network" className="underline-offset-4 hover:underline">
            Network
          </Link>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link href="/trust" className="underline-offset-4 hover:underline">
            Trust Center
          </Link>
        </nav>
      </div>
    </>
  );
}
