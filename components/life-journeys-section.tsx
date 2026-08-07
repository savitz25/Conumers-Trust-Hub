import { ArrowUpRight } from 'lucide-react';
import {
  ASK_BRAND,
  ASK_JOURNEY_ENTRIES,
  ASK_HERO_PHILOSOPHY,
  ASK_SHADOW,
} from '@/lib/design/ask-design-system';
import { LIFE_JOURNEYS } from '@/lib/life-journeys';

/**
 * Phase 3 - Life journeys / situations.
 * Entry cards + ordered multi-hub paths. Does not touch hero.
 */
export function LifeJourneysSection() {
  return (
    <section
      id="life-journeys"
      data-hub="ask"
      aria-labelledby="life-journeys-heading"
      className="scroll-mt-24 border-b"
      style={{
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.white,
      }}
    >
      <div className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Life journeys
          </p>
          <h2
            id="life-journeys-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            What are you deciding about?
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Start with a calm path matched to your situation. Ask is the knowledge layer; deep
            research happens on Move, Lender, or Insurance Trust Hub. {ASK_HERO_PHILOSOPHY}
          </p>
        </div>

        {/* Entry cards - major journeys */}
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASK_JOURNEY_ENTRIES.map((entry) => (
            <li key={entry.id}>
              <a
                href={entry.href}
                rel="noopener noreferrer"
                className="flex h-full flex-col rounded-2xl border bg-white p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  borderColor: ASK_BRAND.border,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <span
                  className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: ASK_BRAND.periwinkle,
                    color: ASK_BRAND.indigo,
                  }}
                >
                  {entry.hubLabel}
                </span>
                <h3
                  className="mt-3 text-lg font-semibold tracking-tight"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {entry.title}
                </h3>
                <p
                  className="mt-1 text-sm font-medium italic"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  {entry.prompt}
                </p>
                <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {entry.description}
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Open specialist hub
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* Ordered multi-hub journeys */}
        <div className="mt-14 max-w-2xl">
          <h3
            className="text-xl font-semibold tracking-tight sm:text-2xl"
            style={{ color: ASK_BRAND.navy }}
          >
            Multi-hub journeys
          </h3>
          <p className="mt-2 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Some decisions cross markets. These ordered paths keep financing, coverage, and the move
            on the hub that owns each step - never sold as a package placement.
          </p>
        </div>

        <ul className="mt-8 grid gap-5 lg:grid-cols-3">
          {LIFE_JOURNEYS.map((journey) => (
            <li
              key={journey.id}
              className="flex h-full flex-col rounded-2xl border bg-white p-6"
              style={{
                borderColor: ASK_BRAND.border,
                boxShadow: ASK_SHADOW.soft,
                background: `linear-gradient(180deg, ${ASK_BRAND.periwinkle}55 0%, ${ASK_BRAND.white} 48%)`,
              }}
            >
              <h3
                className="text-lg font-semibold tracking-tight"
                style={{ color: ASK_BRAND.navy }}
              >
                {journey.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {journey.summary}
              </p>

              <ol className="mt-5 flex-1 space-y-4 border-t pt-5" style={{ borderColor: ASK_BRAND.border }}>
                {journey.steps.map((step) => (
                  <li key={step.step} className="flex gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: ASK_BRAND.indigo }}
                      aria-hidden
                    >
                      {step.step}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                        {step.hubLabel}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                        {step.why}
                      </p>
                      <a
                        href={step.href}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                        style={{ color: ASK_BRAND.indigo }}
                        rel="noopener noreferrer"
                      >
                        {step.cta}
                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          No directories on this site. Each step opens the specialist hub that owns that research.
        </p>
      </div>
    </section>
  );
}
