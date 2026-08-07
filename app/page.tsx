import { AskHero } from '@/components/ask-hero';
import { HomeLifeJourneys } from '@/components/home-life-journeys';
import { HomeResearchStandard } from '@/components/home-research-standard';
import { HomeSpecialistHubs } from '@/components/home-specialist-hubs';
import { HomeTrustSignals } from '@/components/home-trust-signals';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';

/**
 * Homepage IA (Phase 2 simplified):
 * 1. Hero + dominant Concierge product
 * 2. Three specialist hubs
 * 3. One research standard (short)
 * 4. Life journeys (streamlined)
 * 5. Trust signals (tight)
 * Header/footer from layout — unchanged.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      <AskHero />

      <HomeSpecialistHubs />

      <HomeResearchStandard />

      <HomeLifeJourneys />

      <HomeTrustSignals />
    </>
  );
}
