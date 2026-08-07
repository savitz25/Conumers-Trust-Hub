import Link from 'next/link';
import { Check } from 'lucide-react';
import { ConciergeEntry } from '@/components/concierge-entry';
import { HeroIllustration } from '@/components/hero-illustration';
import {
  ASK_HERO_CHIPS,
  ASK_HERO_EYEBROW,
  ASK_HERO_HEADLINE,
  ASK_HERO_SECONDARY_CTA,
  ASK_HERO_SUPPORT,
} from '@/lib/design/ask-design-system';

/**
 * Homepage hero — Knowledge & Concierge layer (Phase 2).
 * Distinct from Move product hero: advisory tone, Concierge-first.
 */
export function AskHero() {
  return (
    <section
      aria-labelledby="ask-hero-heading"
      className="relative overflow-hidden border-b border-[#E2E8F0]"
      style={{
        background: 'linear-gradient(165deg, #F8FAFC 0%, #FFFFFF 42%, #E0E7FF 160%)',
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

      <div className="container-page relative py-12 sm:py-16 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
              {ASK_HERO_EYEBROW}
            </p>

            <h1
              id="ask-hero-heading"
              className="mt-3 text-balance text-3xl font-semibold tracking-tight text-[#0A2540] sm:text-4xl lg:text-5xl lg:leading-tight"
            >
              {ASK_HERO_HEADLINE}
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#1E293B] sm:text-lg lg:mx-0">
              {ASK_HERO_SUPPORT}
            </p>

            <div className="mx-auto mt-7 max-w-xl lg:mx-0">
              <ConciergeEntry />
              <p className="mt-2.5 text-left text-xs leading-relaxed text-[#1E293B]">
                No accounts. No personal data for routing. We match your situation to verified
                research on the specialist hubs.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              <Link
                href={ASK_HERO_SECONDARY_CTA.href}
                className="text-sm font-semibold text-[#4F46E5] underline-offset-4 transition-colors hover:text-[#6B21A8] hover:underline"
              >
                {ASK_HERO_SECONDARY_CTA.label}
              </Link>
              <Link
                href="/network"
                className="text-sm font-semibold text-[#0A2540] underline-offset-4 transition-colors hover:text-[#4F46E5] hover:underline"
              >
                Browse the network
              </Link>
            </div>

            <ul
              className="mt-8 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
              aria-label="Why Ask Trust Hub"
            >
              {ASK_HERO_CHIPS.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white/90 px-3 py-1.5 text-xs font-medium text-[#1E293B] shadow-sm sm:text-sm"
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#E0E7FF] text-[#4F46E5]"
                    aria-hidden
                  >
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto hidden max-w-md lg:block lg:max-w-none">
            <HeroIllustration className="mx-auto h-auto w-full max-w-[320px] opacity-95" />
            <div
              className="mx-auto mt-2 max-w-[280px] rounded-2xl border border-[#E2E8F0] bg-white/90 px-4 py-3 text-center"
              style={{ boxShadow: '0 8px 24px -12px rgb(10 37 64 / 0.12)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4F46E5]">
                Not a marketplace
              </p>
              <p className="mt-1 text-sm leading-snug text-[#1E293B]">
                Independent guidance that routes you to Move, Lender, or Insurance Trust Hub —
                research only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
