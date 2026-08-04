import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { HubCard } from '@/components/hub-card';
import { LifeJourneysSection } from '@/components/life-journeys-section';
import { SituationRouter } from '@/components/situation-router';
import { TrustCenterStrip } from '@/components/trust-center-strip';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';
import { BRAND } from '@/lib/brand';
import { TRUST_HUBS } from '@/lib/hubs';

/**
 * Ask homepage IA:
 * 1. Situation router + system framing
 * 2. Life journeys (ordered multi-hub paths)
 * 3. Short trust promise
 * 4. Network cards + /network
 * 5. Trust Center entry points
 * 6. Footer (layout) with legal + hubs
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      {/* 1. Situation router — above the fold */}
      <SituationRouter />

      {/* 2. Life journeys as product — steps, not marketing tiles only */}
      <LifeJourneysSection />

      {/* 3. Short trust promise */}
      <section className="border-b border-border/80 bg-navy text-navy-foreground">
        <div className="container-page py-12 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
              Trust promise
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Zero paid placements. Independent specialists. Deep research stays on the hubs.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-[17px]">
              {BRAND.name} asks what you are preparing for, then routes you to Move Trust Hub,
              Insurance Trust Hub, or Lender Trust Hub. Ranking position is not for sale. We do not
              host directories or sell policies, loans, or moves on this site.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <Link
                href="/promise"
                className="inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline"
              >
                Independence policy <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/how-we-make-money"
                className="inline-flex items-center gap-1.5 font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
              >
                How we make money
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Network cards */}
      <section id="trust-hubs" className="scroll-mt-20 border-b border-border/80">
        <div className="container-page py-16 sm:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="section-label">The network</p>
              <h2 className="section-title mt-3">Specialist research destinations</h2>
              <p className="section-lead">
                Three live hubs under one independence standard. Explore the full network page for
                how journeys work and outbound links.
              </p>
            </div>
            <Link href="/network" className="btn-secondary shrink-0">
              Explore the network
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TRUST_HUBS.map((hub) => (
              <HubCard key={hub.id} hub={hub} />
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {TRUST_HUBS.filter((h) => h.status === 'live').map((hub) => (
              <li key={hub.id}>
                <a
                  href={hub.url}
                  className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground"
                >
                  {hub.domain}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Trust Center entry points */}
      <TrustCenterStrip />

      {/* Secondary governance (below fold) */}
      <section>
        <div className="container-page py-14 sm:py-16">
          <div className="flex flex-col gap-6 border border-border/80 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Who operates the network
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Named accountability, contact for corrections, and legal terms — available when you
                need them, not the only above-the-fold story.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/who-we-are" className="btn-primary">
                Who we are
              </Link>
              <Link href="/contact" className="btn-secondary">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
