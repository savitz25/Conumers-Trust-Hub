import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { MyTrustJourneyOverview } from '@/components/my-trust-journey-overview';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { createPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'My Trust Journey — Research Overview',
  description:
    'Optional overview of your Ask Trust Hub research path: situation, destination, and ordered steps into the specialist hubs that apply. No account required. Specialist My… workspaces stay separate.',
  path: '/my-trust-journey',
  noIndex: true,
});

/**
 * Stage B.3 — optional metadata-only journey overview on Ask.
 * No forced login; no merge of specialist workspaces.
 */
export default function MyTrustJourneyPage() {
  return (
    <div data-hub="ask" data-stage="b3-my-trust-journey">
      <header
        className="border-b"
        style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
      >
        <div className="container-page py-10 sm:py-12">
          <Breadcrumbs
            items={[
              { name: 'Home', path: '/' },
              { name: 'My Trust Journey', path: '/my-trust-journey' },
            ]}
          />
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Optional · metadata only
          </p>
          <h1
            className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            My Trust Journey
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            A calm overview of your research path across the network. Ask coordinates high-level
            steps; deep saved research stays in My Move, My Lending, and My Insurance on their own
            hubs.
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>
            No account required · No quote funnel · We cite. You decide.
          </p>
          <p className="mt-4 text-sm">
            <Link
              href="/#whats-happening"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: ASK_BRAND.indigo }}
            >
              Build or update a path
            </Link>
          </p>
        </div>
      </header>

      <MyTrustJourneyOverview />
    </div>
  );
}
