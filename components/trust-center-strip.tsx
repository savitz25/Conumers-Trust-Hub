import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { TRUST_CENTER_LINKS } from '@/lib/situations';

/**
 * Trust Center link grid - standards owned on Ask.
 * Visual language aligned with Phase 1-3 tokens.
 */
export function TrustCenterStrip() {
  return (
    <section
      id="trust-center"
      data-hub="ask"
      aria-labelledby="trust-center-heading"
      className="section-block scroll-mt-24 border-b"
      style={{
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.canvas,
      }}
    >
      <div className="container-page">
        <div className="max-w-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Trust Center
          </p>
          <h2
            id="trust-center-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            Policies and sources in one place
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Independence, methodology, data sources, and corrections live on Ask Trust Hub.
            Specialist hubs apply these rules in their markets.
          </p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_CENTER_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-2xl border bg-white p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  borderColor: ASK_BRAND.border,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {item.label}
                </span>
                <span className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {item.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
