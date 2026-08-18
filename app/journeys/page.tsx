import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { JOURNEY_PAGES } from '@/lib/growth/journeys';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';

export const metadata = createPageMetadata({
  title: 'Life Journeys — Cross-Hub Decision Paths',
  description:
    'Cross-vertical consumer journeys on Ask Trust Hub: buying a home, interstate moves, work relocation, and protection research. Routes to the specialist hub that owns each decision.',
  path: '/journeys',
});

export default function JourneysIndexPage() {
  return (
    <>
      <PageHeader
        label="Life journeys"
        title="Cross-hub decision paths"
        description="Ordered research sequences that span moving, lending, and insurance — without hosting directories on Ask."
      />
      <div className="container-page py-12 sm:py-14">
        <Breadcrumbs
          items={[
            { name: 'Home', path: '/' },
            { name: 'Life journeys', path: '/journeys' },
          ]}
        />
        <p className="max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {ASK_NETWORK_OWNERSHIP_SHORT}. Each journey explains why order matters, then routes you to
          specialist hubs for deep research. We cite. You decide.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {JOURNEY_PAGES.map((j) => (
            <li key={j.slug}>
              <Link
                href={`/journeys/${j.slug}`}
                className="flex h-full flex-col rounded-2xl border bg-white p-6 transition-colors hover:border-[#4F46E5]/35"
                style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
              >
                <h2 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {j.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {j.summary}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Open journey
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <LastReviewed date="2026-08-07" />
        </div>
      </div>
    </>
  );
}
