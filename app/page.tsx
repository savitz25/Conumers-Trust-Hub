import { HomeConciergeDemoted } from '@/components/home-concierge-demoted';
import { HomeLifeJourneys } from '@/components/home-life-journeys';
import { HomeResearchStandard } from '@/components/home-research-standard';
import { HomeTrustSignals } from '@/components/home-trust-signals';
import { NetworkAskHero } from '@/components/network-ask-hero';
import { NetworkFindings } from '@/components/network-findings';
import { NetworkLiveMosaic } from '@/components/network-live-mosaic';
import { NetworkSourcePreview } from '@/components/network-source-preview';
import { HomePrompt2Previews } from '@/components/home-prompt-2-previews';
import { WhatsHappeningPlanner } from '@/components/whats-happening-planner';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';

export const revalidate = 3600;

/**
 * AskTrustHub 2.0 Prompt 1 IA:
 * 1 Ask the network  2 Mosaic  3 Findings  4 Source preview
 * 5 Concierge  6 Journeys  7 Standard  8 Trust
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />
      <NetworkAskHero />
      <NetworkLiveMosaic />
      <NetworkFindings />
      <NetworkSourcePreview />
      <HomePrompt2Previews />
      <HomeConciergeDemoted />
      <WhatsHappeningPlanner />
      <HomeLifeJourneys />
      <HomeResearchStandard />
      <HomeTrustSignals />
    </>
  );
}
