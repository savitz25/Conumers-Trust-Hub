import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  ASK_BRAND,
  ASK_JOURNEY_ENTRIES,
  ASK_SHADOW,
} from '@/lib/design/ask-design-system';

/**
 * Streamlined Life Journeys — entry cards only (no multi-step essay on homepage).
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
              Calm entry points into specialist research. Prefer the Concierge above if you are not
              sure where to begin.
            </p>
          </div>
          <Link
            href="/network#how-journeys-work"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold"
            style={{ color: ASK_BRAND.indigo }}
          >
            How multi-hub paths work
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {ASK_JOURNEY_ENTRIES.map((entry) => (
            <li key={entry.id}>
              <a
                href={entry.href}
                rel="noopener noreferrer"
                className="flex h-full flex-col rounded-2xl border bg-white p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 sm:p-6"
                style={{
                  borderColor: ASK_BRAND.border,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <span
                  className="text-xs font-semibold uppercase tracking-[0.12em]"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  {entry.hubLabel}
                </span>
                <h3
                  className="mt-2 text-lg font-semibold tracking-tight"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {entry.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {entry.description}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Open hub
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
