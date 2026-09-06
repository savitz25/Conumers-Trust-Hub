import type { Metadata } from 'next';
import { NetworkIntelligenceHome } from '@/components/network-intelligence-home';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildHomepageGraph } from '@/lib/seo/schemas';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'AskTrustHub — Public Regulatory Research Across the Trust Hub Network',
  description: 'Research public and regulatory evidence across moving, lending, insurance, senior care, contractors, and investment advisers.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
};
export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomepageGraph()} />
      <NetworkIntelligenceHome />
    </>
  );
}
