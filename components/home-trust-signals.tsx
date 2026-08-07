import Link from 'next/link';
import { Check } from 'lucide-react';
import {
  ASK_BRAND,
  ASK_HOME_TRUST_SIGNALS,
  ASK_SHADOW,
} from '@/lib/design/ask-design-system';

/**
 * Tight trust signals — one short strip, not a repeated essay.
 */
export function HomeTrustSignals() {
  return (
    <section
      id="trust-signals"
      data-hub="ask"
      aria-labelledby="home-trust-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
    >
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Trust
          </p>
          <h2
            id="home-trust-heading"
            className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
            style={{ color: ASK_BRAND.navy }}
          >
            We cite. You decide.
          </h2>
          <ul
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
            aria-label="Trust signals"
          >
            {ASK_HOME_TRUST_SIGNALS.map((label) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-xs font-semibold sm:text-sm"
                style={{
                  borderColor: ASK_BRAND.border,
                  color: ASK_BRAND.ink,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <Check
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: ASK_BRAND.indigo }}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
            <Link
              href="/promise"
              className="underline-offset-4 hover:underline"
              style={{ color: ASK_BRAND.indigo }}
            >
              Independence Policy
            </Link>
            <Link
              href="/trust"
              className="underline-offset-4 hover:underline"
              style={{ color: ASK_BRAND.indigo }}
            >
              Trust Center
            </Link>
            <Link
              href="/methodology"
              className="underline-offset-4 hover:underline"
              style={{ color: ASK_BRAND.indigo }}
            >
              The Standard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
