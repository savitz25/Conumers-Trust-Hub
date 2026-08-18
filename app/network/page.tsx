import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { TrustMark } from '@/components/trust-mark';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TRUST_HUBS } from '@/lib/hubs';
import { BRAND } from '@/lib/brand';
import { JOURNEY_PAGES } from '@/lib/growth/journeys';
import {
  ASK_NETWORK_OWNERSHIP_LINE,
  ASK_NETWORK_OWNERSHIP_SHORT,
} from '@/lib/network/standard-version';
import { TRUST_PAGE_REVIEWED } from '@/lib/trust-reviewed';

export const metadata = createPageMetadata({
  title: 'Our Trust Hubs — The Ask Trust Hub Network',
  description:
    'The Ask Trust Hub network: specialist research domains under common ownership with separated research and listing order and no paid placements. How life journeys work across hubs.',
  path: '/network',
});

const HUB_FOCUS: Record<string, { focus: string; cta: string }> = {
  move: {
    focus: 'Moving research · FMCSA licensing and interstate mover directories',
    cta: 'Open Move Trust Hub',
  },
  insurance: {
    focus: 'Coverage research · state DOI / NAIC pathways and agent directories',
    cta: 'Open Insurance Trust Hub',
  },
  lender: {
    focus: 'Financing research · NMLS Consumer Access and county lender research',
    cta: 'Open Lender Trust Hub',
  },
  contractor: {
    focus: 'Contractor research · state licensing boards with state-specific evidence depth',
    cta: 'Open Contractor Trust Hub',
  },
  senior: {
    focus: 'Senior care research · CMS and supported state regulatory evidence',
    cta: 'Open SeniorTrustHub',
  },
  investor: {
    focus: 'Investment firm research · SEC/IARD filings — not investment advice',
    cta: 'Open InvestorTrustHub',
  },
};

const JOURNEY_MODEL = [
  {
    step: '1',
    title: 'Ask routes',
    body: 'You name a life event or question. Ask Trust Hub points you to the right specialist — no directories and no forms on this site.',
  },
  {
    step: '2',
    title: 'Hub executes',
    body: 'The specialist hub owns the deep tools: verify, compare, plan. Research stays on that domain.',
  },
  {
    step: '3',
    title: 'Standard applies',
    body: 'Every hub inherits The Ask Trust Hub Standard — independence, disclosed sources, rankings not for sale.',
  },
] as const;

export default function NetworkPage() {
  return (
    <>
      <PageHeader
        label="Network"
        title="The Ask Trust Hub network"
        description="Specialist research destinations under one independence standard. Ask routes you; the hubs do the deep work."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TrustMark />
          <LastReviewed date={TRUST_PAGE_REVIEWED.network} />
        </div>
        <p className="max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          {ASK_NETWORK_OWNERSHIP_LINE} {BRAND.name} is the parent trust layer and discovery surface.
          Each specialist hub is a separate product domain with its own tools and market depth. We
          do not host provider directories on this site.
        </p>
        <p className="mt-3 max-w-2xl text-sm font-medium text-foreground/80">
          {ASK_NETWORK_OWNERSHIP_SHORT}
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold not-prose">
          <Link href="/methodology" className="text-navy underline-offset-4 hover:underline">
            Ask Trust Hub Standard
          </Link>
          <Link href="/data-sources" className="text-navy underline-offset-4 hover:underline">
            Data sources library
          </Link>
          <Link href="/promise" className="text-navy underline-offset-4 hover:underline">
            Independence policy
          </Link>
          <Link href="/who-we-are" className="text-navy underline-offset-4 hover:underline">
            Who we are
          </Link>
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          “Independence” here means no paid placements and research ordering that is not for sale —
          one research network with specialist domains, not unrelated companies. Verify providers
          with primary regulators before you commit.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Specialist directories are expanding. If a ZIP or county has no listings yet, hub empty
          states point you to official sources (FMCSA, NMLS, state DOI / NAIC) rather than inventing
          results.
        </p>

        {/* How journeys work */}
        <section
          id="how-journeys-work"
          aria-labelledby="journey-model-heading"
          className="mt-12 scroll-mt-20"
        >
          <h2
            id="journey-model-heading"
            className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
          >
            How life journeys work
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            You are inside one research system for a life event — one research network with
            specialist domains, not a pile of unrelated websites.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {JOURNEY_MODEL.map((item) => (
              <li
                key={item.step}
                className="rounded-xl border border-border/80 bg-background p-5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">
            <Link
              href="/journeys"
              className="font-semibold text-navy underline-offset-4 hover:underline"
            >
              See full life journey pages
            </Link>
          </p>
        </section>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_HUBS.map((hub) => {
            const focus = HUB_FOCUS[hub.id];
            return (
              <li
                key={hub.id}
                className="flex h-full flex-col rounded-xl border border-border/80 bg-background p-6"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{hub.name}</h2>
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-trust">
                    Live
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {focus?.focus ?? hub.description}
                </p>
                <p className="mt-3 text-xs font-medium text-foreground/70">
                  {ASK_NETWORK_OWNERSHIP_SHORT}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{hub.domain}</p>
                <a href={hub.url} className="btn-primary mt-6 w-full sm:w-auto">
                  {focus?.cta ?? `Open ${hub.name}`}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </li>
            );
          })}
        </ul>

        {/* Compact journey index */}
        <section className="mt-14" aria-labelledby="journey-index-heading">
          <h2
            id="journey-index-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Example journeys
          </h2>
          <ul className="mt-4 space-y-3">
            {JOURNEY_PAGES.map((j) => (
              <li
                key={j.slug}
                className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm"
              >
                <Link
                  href={`/journeys/${j.slug}`}
                  className="font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  {j.title}
                </Link>
                <span className="mt-0.5 block text-muted-foreground">
                  {j.steps.map((s) => s.hubLabel.replace(' Trust Hub', '')).join(' → ')}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/#ask" className="btn-primary">
            Situation router
          </Link>
          <Link href="/journeys" className="btn-secondary">
            Life journeys
          </Link>
          <Link href="/guides" className="btn-secondary">
            Educational guides
          </Link>
          <Link href="/methodology" className="btn-secondary">
            The Ask Trust Hub Standard
          </Link>
          <Link href="/promise" className="btn-secondary">
            Independence policy
          </Link>
          <Link href="/how-we-make-money" className="btn-secondary">
            How we make money
          </Link>
        </div>
      </div>
    </>
  );
}
