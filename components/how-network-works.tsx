import Link from 'next/link';
import {
  ASK_BRAND,
  ASK_HERO_PHILOSOPHY,
  ASK_NETWORK_STEPS,
  ASK_SHADOW,
} from '@/lib/design/ask-design-system';

/**
 * Phase 3 - How the network works.
 * Parent guidance -> specialist hubs -> deep research -> you decide.
 */
export function HowNetworkWorks() {
  return (
    <section
      id="how-it-works"
      data-hub="ask"
      aria-labelledby="how-network-heading"
      className="section-block scroll-mt-24 border-b"
      style={{
        borderColor: ASK_BRAND.border,
        background: `linear-gradient(180deg, ${ASK_BRAND.canvas} 0%, ${ASK_BRAND.white} 100%)`,
      }}
    >
      <div className="container-page">
        <div className="max-w-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            The network
          </p>
          <h2
            id="how-network-heading"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            How Ask connects to the specialist hubs
          </h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Ask Trust Hub is the parent knowledge and concierge layer. Our specialist hubs
            do market-depth research under shared standards — common ownership, separated
            research and listing order, no paid placements.
          </p>
        </div>

        <div
          className="mt-10 flex flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-8 sm:px-10"
          style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
          aria-hidden
        >
          <div
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: ASK_BRAND.indigo }}
          >
            Ask Trust Hub
          </div>
          <div className="h-6 w-px" style={{ backgroundColor: ASK_BRAND.periwinkle }} />
          <div className="flex w-full max-w-xl flex-wrap items-center justify-center gap-3">
            {['Move', 'Lender', 'Insurance'].map((label) => (
              <span
                key={label}
                className="rounded-full border px-4 py-2 text-sm font-semibold"
                style={{
                  borderColor: ASK_BRAND.border,
                  backgroundColor: ASK_BRAND.periwinkle,
                  color: ASK_BRAND.navy,
                }}
              >
                {label} Trust Hub
              </span>
            ))}
          </div>
          <p className="mt-2 text-center text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>
            {ASK_HERO_PHILOSOPHY}
          </p>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ASK_NETWORK_STEPS.map((item) => (
            <li
              key={item.step}
              className="flex h-full flex-col rounded-2xl border bg-white p-5 sm:p-6"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: ASK_BRAND.indigo }}
              >
                {item.step}
              </span>
              <h3
                className="mt-4 text-base font-semibold tracking-tight"
                style={{ color: ASK_BRAND.navy }}
              >
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {item.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Shared standards live on Ask.{' '}
          <Link
            href="/methodology"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: ASK_BRAND.indigo }}
          >
            The Ask Trust Hub Standard
          </Link>{' '}
          and{' '}
          <Link
            href="/promise"
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: ASK_BRAND.indigo }}
          >
            Independence Policy
          </Link>{' '}
          apply network-wide.
        </p>
      </div>
    </section>
  );
}
