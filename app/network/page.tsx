import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TRUST_HUBS } from '@/lib/hubs';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Our Trust Hubs — The Ask Trust Hub Network',
  description:
    'The Ask Trust Hub network: Move Trust Hub, Insurance Trust Hub, and Lender Trust Hub — independent research destinations with zero paid placements.',
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
};

export default function NetworkPage() {
  return (
    <>
      <PageHeader
        label="Network"
        title="The Ask Trust Hub network"
        description="Three specialist research destinations under one independence standard. Ask routes you; the hubs do the deep work."
      />

      <div className="container-page py-14 sm:py-16">
        <p className="max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          {BRAND.name} does not host provider directories. Each Trust Hub is a separate product domain
          with its own tools and market depth — and a shared commitment to zero paid placements.
        </p>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
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
                  Independently operated · No paid placements
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

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/#ask" className="btn-primary">
            Situation router
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
