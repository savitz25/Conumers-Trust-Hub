import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Check, ExternalLink } from 'lucide-react';
import { ConciergeEntry } from '@/components/concierge-entry';
import { BRAND_LOGO_VERSION } from '@/lib/brand';
import {
  ASK_BRAND,
  ASK_HERO_CHIPS,
  ASK_HERO_EYEBROW,
  ASK_HERO_HEADLINE,
  ASK_HERO_NETWORK_PILLS,
  ASK_HERO_PHILOSOPHY,
  ASK_HERO_SECONDARY_CTA,
  ASK_HERO_SUPPORT,
} from '@/lib/design/ask-design-system';

/** Official bracket + 4-point hub mark (transparent) for soft hero placement */
const HERO_MARK_SRC = `/brand/ask-bracket-hub-mark.png?v=${BRAND_LOGO_VERSION}`;

/**
 * Homepage hero - Knowledge and Concierge parent layer (Phase 2).
 * Connects to Move / Lender / Insurance; We cite. You decide.
 */
export function AskHero() {
  const leftStack: CSSProperties = {
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
        background: `linear-gradient(165deg, ${ASK_BRAND.canvas} 0%, ${ASK_BRAND.white} 42%, ${ASK_BRAND.periwinkle} 160%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgb(79 70 229 / 0.07)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full blur-3xl"
        style={{ backgroundColor: 'rgb(107 33 168 / 0.05)' }}
        aria-hidden
      />

      <div className="container-page relative py-14 sm:py-16 lg:py-20">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="relative z-[1] text-center lg:text-left">
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: ASK_BRAND.indigo }}
            >
              {ASK_HERO_EYEBROW}
            </p>

            <h1
              id="ask-hero-heading"
              className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl lg:leading-tight"
              style={{ color: ASK_BRAND.navy }}
            >
              {ASK_HERO_HEADLINE}
            </h1>

            <p
              className="mt-3 text-base font-semibold tracking-tight sm:text-lg"
              style={{ color: ASK_BRAND.indigo }}
            >
              {ASK_HERO_PHILOSOPHY}
            </p>

            <p
              className="mx-auto mt-3 max-w-xl text-base leading-relaxed sm:text-lg lg:mx-0"
              style={{ color: ASK_BRAND.ink }}
            >
              {ASK_HERO_SUPPORT}
            </p>

            <div className="mx-auto mt-5 max-w-xl lg:mx-0">
              <p
                className="text-left text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: ASK_BRAND.navy }}
              >
                Parent knowledge layer · connects to
              </p>
              <ul
                className="mt-2 ask-hero-hub-row"
                aria-label="Specialist Trust Hubs"
                style={leftStack}
              >
                {ASK_HERO_NETWORK_PILLS.map((hub) => (
                  <li key={hub.id}>
                    <a
                      href={hub.href}
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-sm font-semibold transition-colors"
                      style={{
                        borderColor: ASK_BRAND.border,
                        color: ASK_BRAND.navy,
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

            <div className="mx-auto mt-7 max-w-xl lg:mx-0">
              <ConciergeEntry />
              <p
                className="mt-2.5 text-left text-xs leading-relaxed"
                style={{ color: ASK_BRAND.ink }}
              >
                No accounts. No personal data for routing. We match your situation, cite the
                research path, and send you to the right specialist hub - you decide.
              </p>
            </div>

            <div
              className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center"
              style={{ justifyContent: 'center' }}
            >
              <Link
                href={ASK_HERO_SECONDARY_CTA.href}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-5 text-sm font-semibold transition-colors sm:min-h-10"
                style={{
                  borderColor: ASK_BRAND.border,
                  color: ASK_BRAND.indigo,
                }}
              >
                {ASK_HERO_SECONDARY_CTA.label}
              </Link>
              <Link
                href="/network"
                className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-semibold underline-offset-4 hover:underline sm:min-h-10"
                style={{ color: ASK_BRAND.navy }}
              >
                How the network works
              </Link>
            </div>

            <ul
              className="mt-8 ask-hero-chip-row"
              aria-label="Why Ask Trust Hub"
              style={leftStack}
            >
              {ASK_HERO_CHIPS.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium shadow-sm sm:text-sm"
                  style={{
                    borderColor: ASK_BRAND.border,
                    color: ASK_BRAND.ink,
                  }}
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: ASK_BRAND.periwinkle,
                      color: ASK_BRAND.indigo,
                    }}
                    aria-hidden
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Large soft watermark — free-floating, no box/border/card */}
          <div
            className="relative mx-auto flex w-full max-w-lg items-start justify-center pt-0 lg:max-w-none lg:-mt-6 lg:self-start lg:pt-2 xl:-mt-10"
            aria-hidden={false}
          >
            {/* Barely-there ambient wash — no hard edges */}
            <div
              className="pointer-events-none absolute left-1/2 top-[42%] h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgb(79 70 229 / 0.06) 0%, rgb(107 33 168 / 0.03) 40%, transparent 68%)',
              }}
              aria-hidden
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_MARK_SRC}
              alt=""
              width={560}
              height={373}
              className="relative z-[1] h-auto w-[min(88vw,340px)] select-none object-contain object-center sm:w-[380px] lg:w-[440px] xl:w-[480px]"
              style={{
                opacity: 0.55,
                mixBlendMode: 'multiply',
              }}
              decoding="async"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}
