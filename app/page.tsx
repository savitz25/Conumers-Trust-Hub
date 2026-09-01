import type { Metadata } from 'next';
import { NetworkIntelligenceHome } from '@/components/network-intelligence-home';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'AskTrustHub — Public Regulatory Research Across the Trust Hub Network',
  description: 'Research public and regulatory evidence across moving, lending, insurance, senior care, contractors, and investment advisers.',
  alternates: { canonical: '/' },
};

/**
 * AskTrustHub 2.0 Prompt 1 IA:
 * 1 Ask the network  2 Mosaic  3 Findings  4 Source preview
 * 5 Concierge  6 Journeys  7 Standard  8 Trust
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />
      <NetworkIntelligenceHome />
    </>
  );
}
