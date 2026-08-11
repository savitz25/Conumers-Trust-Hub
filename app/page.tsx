import { AskHero } from '@/components/ask-hero';
import { HomeLifeJourneys } from '@/components/home-life-journeys';
import { HomeResearchStandard } from '@/components/home-research-standard';
import { HomeSpecialistHubs } from '@/components/home-specialist-hubs';
import { HomeTrustSignals } from '@/components/home-trust-signals';
import { WhatsHappeningPlanner } from '@/components/whats-happening-planner';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';

/**
 * Homepage IA (Stage B.2):
 * 1. Hero + Concierge
 * 2. What's happening? multi-hub path generator
 * 3. Three specialist hubs
 * 4. Research standard (short)
 * 5. Life journeys (editorial long-form)
 * 6. Trust signals
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />

      <AskHero />

      <WhatsHappeningPlanner />

      <HomeSpecialistHubs />

      <HomeResearchStandard />

      <HomeLifeJourneys />

      <HomeTrustSignals />
    </>
  );
}
