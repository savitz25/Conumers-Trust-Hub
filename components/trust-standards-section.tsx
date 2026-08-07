import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  ASK_BRAND,
  ASK_HERO_PHILOSOPHY,
  ASK_SHADOW,
  ASK_TRUST_PILLARS,
} from '@/lib/design/ask-design-system';

/**
 * Phase 3 - Trust and standards (concise, authoritative).
 */
export function TrustStandardsSection() {
  return (
    <section
      id="trust-standards"
      data-hub="ask"
      aria-labelledby="trust-standards-heading"
      className="section-block scroll-mt-24 border-b"
      style={{
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.navy,
        color: ASK_BRAND.white,
      }}
    >
      <div className="container-page">
        <div className="max-w-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.periwinkle }}
          >
            Trust and standards
          </p>
          <h2
            id="trust-standards-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Built for confidence - not conversion
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-200">
            {ASK_HERO_PHILOSOPHY} Independent research, verified public sources, and a clear line
            between parent guidance and specialist directories.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {ASK_TRUST_PILLARS.map((pillar) => (
            <li
              key={pillar.title}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6"
            >
              <ShieldCheck
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: ASK_BRAND.periwinkle }}
                aria-hidden
              />
              <div>
                <h3 className="text-base font-semibold text-white">{pillar.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{pillar.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/promise"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: ASK_BRAND.indigo }}
          >
            Independence Policy
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/trust"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-transparent px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Trust Center
          </Link>
          <Link
            href="/methodology"
            className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline"
          >
            The Standard
          </Link>
        </div>
      </div>
    </section>
  );
}
