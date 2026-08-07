import Link from 'next/link';
import { AskHero } from '@/components/ask-hero';
import { HowNetworkWorks } from '@/components/how-network-works';
import { LifeJourneysSection } from '@/components/life-journeys-section';
import { NetworkOverviewSection } from '@/components/network-overview-section';
import { SituationRouter } from '@/components/situation-router';
import { TrustCenterStrip } from '@/components/trust-center-strip';
import { TrustStandardsSection } from '@/components/trust-standards-section';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';
import { ASK_BRAND } from '@/lib/design/ask-design-system';

/**
 * Ask homepage IA:
 * 1. Hero (Phase 2) - do not change in Phase 3
 * 2. Situation grid (#ask)
 * 3. Life journeys
 * 4. How the network works
 * 5. Trust and standards
 * 6. Network overview (hubs)
 * 7. Trust Center links
 * 8. Accountability
 * Header/footer from layout (Phase 1)
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      <AskHero />

      <SituationRouter />

      <LifeJourneysSection />

      <HowNetworkWorks />

      <TrustStandardsSection />

      <NetworkOverviewSection />

      <TrustCenterStrip />

      <section data-hub="ask" className="section-block border-0" style={{ backgroundColor: ASK_BRAND.white }}>
        <div className="container-page">
          <div
            className="ask-card flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
            style={{
              borderColor: ASK_BRAND.border,
              backgroundColor: ASK_BRAND.canvas,
            }}
          >
            <div className="max-w-xl">
              <h2
                className="text-xl font-semibold tracking-tight sm:text-2xl"
                style={{ color: ASK_BRAND.navy }}
              >
                Who operates the network
              </h2>
              <p
                className="mt-3 text-sm leading-relaxed sm:text-base"
                style={{ color: ASK_BRAND.ink }}
              >
                Named accountability, contact for corrections, and legal terms - available when you
                need them, not a sales funnel.
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
