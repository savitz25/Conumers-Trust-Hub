import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { STANDARD_PIPELINE } from '@/lib/standard';

/**
 * One Research Standard — short pipeline, link to full methodology.
 */
export function HomeResearchStandard() {
  return (
    <section
      id="standard"
      data-hub="ask"
      aria-labelledby="home-standard-heading"
      className="section-block scroll-mt-24 border-b"
      style={{
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.canvas,
      }}
    >
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: ASK_BRAND.indigo }}
            >
              One research standard
            </p>
            <h2
              id="home-standard-heading"
              className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{ color: ASK_BRAND.navy }}
            >
              SOURCE → VERIFY → EXPLAIN → DISCLOSE → UPDATE → YOU DECIDE
            </h2>
            <p className="mt-2 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Shared network pipeline. Full detail lives on the Standard page — not a homepage
              essay.
            </p>
          </div>
          <Link
            href="/methodology"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
            style={{ backgroundColor: ASK_BRAND.indigo, boxShadow: ASK_SHADOW.indigo }}
          >
            Full Standard
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ol
          className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          aria-label="Research pipeline"
        >
          {STANDARD_PIPELINE.map((step, i) => (
            <li key={step.id} className="flex items-center gap-2 sm:gap-3">
              <span
                className="inline-flex min-h-11 items-center rounded-full border bg-white px-3.5 py-2 text-xs font-bold tracking-wide sm:text-sm"
                style={{
                  borderColor: ASK_BRAND.border,
                  color: ASK_BRAND.navy,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                {step.verb}
              </span>
              {i < STANDARD_PIPELINE.length - 1 ? (
                <span
                  className="hidden text-sm font-semibold sm:inline"
                  style={{ color: ASK_BRAND.indigo }}
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
