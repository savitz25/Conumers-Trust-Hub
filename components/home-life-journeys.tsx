import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { JOURNEY_PAGES } from '@/lib/growth/journeys';

/**
 * Streamlined Life Journeys — links to real rankable journey URLs.
 */
export function HomeLifeJourneys() {
  return (
    <section
      id="life-journeys"
      data-hub="ask"
      aria-labelledby="home-journeys-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
    >
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: ASK_BRAND.indigo }}
            >
              Life journeys
            </p>
            <h2
              id="home-journeys-heading"
              className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{ color: ASK_BRAND.navy }}
            >
              Start with a situation
            </h2>
            <p className="mt-2 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Editorial long-form paths. For a live plan with destination context, use{' '}
              <Link href="/#whats-happening" className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                What&apos;s happening?
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link
              href="/#whats-happening"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
              style={{ color: ASK_BRAND.indigo }}
            >
              Build a research path
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/journeys"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
              style={{ color: ASK_BRAND.navy }}
            >
              All life journeys
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/guides"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
              style={{ color: ASK_BRAND.navy }}
            >
              Educational guides
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY_PAGES.map((j) => (
            <li key={j.slug}>
              <Link
                href={`/journeys/${j.slug}`}
                className="flex h-full flex-col rounded-2xl border bg-white p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 sm:p-6"
                style={{
                  borderColor: ASK_BRAND.border,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <h3
                  className="text-base font-semibold tracking-tight sm:text-lg"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {j.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {j.summary}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Read full path
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
