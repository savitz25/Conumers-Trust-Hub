import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { GUIDE_PAGES, getGuidesByVertical } from '@/lib/growth/guides';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';

export const metadata = createPageMetadata({
  title: 'Guides — How to Verify & What Credentials Mean',
  description:
    'Educational explainers from Ask Trust Hub: USDOT and operating authority, NMLS checks, DOI producer licenses, and more — before you need a directory.',
  path: '/guides',
});

const SECTIONS = [
  { id: 'moving' as const, title: 'Moving' },
  { id: 'lending' as const, title: 'Lending' },
  { id: 'insurance' as const, title: 'Insurance' },
];

export default function GuidesIndexPage() {
  return (
    <>
      <PageHeader
        label="Guides"
        title="How to verify — and what it means"
        description="Definitive educational pages for questions people have before they open a specialist directory. Primary sources first."
      />
      <div className="container-page py-12 sm:py-14">
        <Breadcrumbs
          items={[
            { name: 'Home', path: '/' },
            { name: 'Guides', path: '/guides' },
          ]}
        />
        <p className="max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These pages stay on Ask because they are cross-cutting education. Directories and tools
          live on Move, Lender, and Insurance Trust Hub. We cite. You decide.
        </p>

        {SECTIONS.map((section) => {
          const guides = getGuidesByVertical(section.id);
          return (
            <section key={section.id} className="mt-12" aria-labelledby={`guides-${section.id}`}>
              <h2
                id={`guides-${section.id}`}
                className="text-xl font-semibold tracking-tight"
                style={{ color: ASK_BRAND.navy }}
              >
                {section.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/guides/${g.slug}`}
                      className="flex items-start justify-between gap-4 rounded-xl border bg-white p-4 transition-colors hover:border-[#4F46E5]/35 sm:p-5"
                      style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
                    >
                      <span>
                        <span className="block font-semibold" style={{ color: ASK_BRAND.navy }}>
                          {g.title}
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                          {g.definitiveAnswer.slice(0, 140)}…
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-1 h-4 w-4 shrink-0"
                        style={{ color: ASK_BRAND.indigo }}
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="mt-10 text-sm" style={{ color: ASK_BRAND.ink }}>
          {GUIDE_PAGES.length} guides published. Prefer fewer excellent pages over thin content.
        </p>
        <div className="mt-4">
          <LastReviewed date="2026-08-07" />
        </div>
      </div>
    </>
  );
}
