import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { ConciergeEntry } from '@/components/concierge-entry';
import {
  ASK_BRAND,
  ASK_HERO_DESCRIPTOR,
  ASK_HERO_EYEBROW,
  ASK_HERO_HEADLINE,
  ASK_HERO_NETWORK_PILLS,
  ASK_HERO_PHILOSOPHY,
  ASK_HERO_SECONDARY_CTA,
  ASK_HERO_SUPPORT,
  ASK_SHADOW,
} from '@/lib/design/ask-design-system';

/**
 * Homepage hero — Concierge is the primary product (Phase 2 simplified).
 * Header/footer unchanged.
 */
export function AskHero() {
  const pillRow: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  };

  return (
    <section
      data-hub="ask"
      aria-labelledby="ask-hero-heading"
      className="relative overflow-hidden border-b"
      style={{
        borderColor: ASK_BRAND.border,
        background: `linear-gradient(165deg, ${ASK_BRAND.white} 0%, ${ASK_BRAND.canvas} 40%, ${ASK_BRAND.periwinkle} 180%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgb(79 70 229 / 0.1)' }}
        aria-hidden
      />

      <div className="container-page relative py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            {ASK_HERO_EYEBROW}
          </p>

          <h1
            id="ask-hero-heading"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl lg:leading-[1.12]"
            style={{ color: ASK_BRAND.navy }}
          >
            {ASK_HERO_HEADLINE}
          </h1>

          <p
            className="mx-auto mt-3 max-w-2xl text-base font-semibold sm:text-lg"
            style={{ color: ASK_BRAND.indigo }}
          >
            {ASK_HERO_DESCRIPTOR}
          </p>

          <p
            className="mx-auto mt-3 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ color: ASK_BRAND.ink }}
          >
            {ASK_HERO_SUPPORT}
          </p>

          <p
            className="mt-2 text-sm font-semibold tracking-wide"
            style={{ color: ASK_BRAND.navy }}
          >
            {ASK_HERO_PHILOSOPHY}
          </p>

          <ul
            className="mt-5"
            aria-label="Specialist Trust Hubs"
            style={pillRow}
          >
            {ASK_HERO_NETWORK_PILLS.map((hub) => (
              <li key={hub.id}>
                <a
                  href={hub.href}
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-[#4F46E5]/35"
                  style={{
                    borderColor: ASK_BRAND.border,
                    color: ASK_BRAND.navy,
                    boxShadow: ASK_SHADOW.soft,
                  }}
                >
                  {hub.label}
                  <span className="font-medium opacity-70">Trust Hub</span>
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: ASK_BRAND.indigo }}
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Dominant Ask product */}
        <div className="mx-auto mt-10 max-w-2xl scroll-mt-24 sm:mt-12">
          <p
            className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Ask product
          </p>
          <ConciergeEntry dominant />
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ASK_HERO_SECONDARY_CTA.href}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold transition-colors"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.indigo }}
            >
              {ASK_HERO_SECONDARY_CTA.label}
            </Link>
            <Link
              href="/journeys"
              className="inline-flex min-h-10 items-center justify-center px-2 text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: ASK_BRAND.navy }}
            >
              Life journeys
            </Link>
            <Link
              href="/#trust-hubs"
              className="inline-flex min-h-10 items-center justify-center px-2 text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: ASK_BRAND.navy }}
            >
              Specialist hubs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
