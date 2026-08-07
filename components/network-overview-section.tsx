import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { TRUST_HUBS } from '@/lib/hubs';

/**
 * Phase 3 - Network overview / quick links to specialist hubs.
 */
export function NetworkOverviewSection() {
  return (
    <section
      id="trust-hubs"
      data-hub="ask"
      aria-labelledby="network-overview-heading"
      className="scroll-mt-24 border-b"
      style={{
        borderColor: ASK_BRAND.border,
        backgroundColor: ASK_BRAND.white,
      }}
    >
      <div className="container-page py-16 sm:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: ASK_BRAND.indigo }}
            >
              Specialist hubs
            </p>
            <h2
              id="network-overview-heading"
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ color: ASK_BRAND.navy }}
            >
              Where deep research lives
            </h2>
            <p className="mt-4 text-lg leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Three live destinations under one parent standard. Ask routes; each hub owns its
              directory and tools.
            </p>
          </div>
          <Link href="/network" className="btn-secondary shrink-0">
            Explore the network
          </Link>
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {TRUST_HUBS.map((hub) => {
            const isLive = hub.status === 'live';
            const cardClass =
              'flex h-full flex-col rounded-2xl border bg-white p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
            const cardStyle = {
              borderColor: ASK_BRAND.border,
              boxShadow: ASK_SHADOW.soft,
            } as const;

            const body = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.12em]"
                      style={{ color: ASK_BRAND.indigo }}
                    >
                      {hub.shortName}
                    </p>
                    <h3
                      className="mt-1 text-lg font-semibold tracking-tight"
                      style={{ color: ASK_BRAND.navy }}
                    >
                      {hub.name}
                    </h3>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: ASK_BRAND.periwinkle,
                      color: ASK_BRAND.indigo,
                    }}
                  >
                    {isLive ? 'Live' : 'Planned'}
                  </span>
                </div>

                <p className="mt-4 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {hub.description}
                </p>

                <div
                  className="mt-5 border-t pt-4"
                  style={{ borderColor: ASK_BRAND.border }}
                >
                  <p className="text-xs font-medium" style={{ color: ASK_BRAND.navy }}>
                    {hub.verification}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: ASK_BRAND.ink }}>
                    {hub.dataSources.join(' · ')}
                  </p>
                </div>

                {isLive ? (
                  <span
                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold"
                    style={{ color: ASK_BRAND.indigo }}
                  >
                    {hub.domain}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : (
                  <span className="mt-5 text-xs" style={{ color: ASK_BRAND.ink }}>
                    {hub.domain}
                  </span>
                )}
              </>
            );

            return (
              <li key={hub.id}>
                {isLive ? (
                  <a href={hub.url} className={cardClass} style={cardStyle} rel="noopener noreferrer">
                    {body}
                  </a>
                ) : (
                  <div className={cardClass} style={cardStyle}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
