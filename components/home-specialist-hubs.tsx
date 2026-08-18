import { ArrowUpRight } from 'lucide-react';
import { ASK_BRAND, ASK_HOME_HUBS, ASK_SHADOW } from '@/lib/design/ask-design-system';

/**
 * Specialist hubs — one clean visual section.
 */
export function HomeSpecialistHubs() {
  return (
    <section
      id="trust-hubs"
      data-hub="ask"
      aria-labelledby="home-hubs-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
    >
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Specialist hubs
          </p>
          <h2
            id="home-hubs-heading"
            className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            Different specialists. One trust standard.
          </h2>
          <p className="mt-3 text-base leading-relaxed sm:text-lg" style={{ color: ASK_BRAND.ink }}>
            Deep directories and tools live on the specialist sites. Ask routes you — it is not a
            marketplace.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASK_HOME_HUBS.map((hub) => (
            <li key={hub.id}>
              <a
                href={hub.href}
                rel="noopener noreferrer"
                className="flex h-full flex-col rounded-2xl border bg-white p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
                style={{
                  borderColor: ASK_BRAND.border,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <span
                  className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: hub.soft, color: hub.accent }}
                >
                  Live
                </span>
                <h3
                  className="mt-3 text-lg font-semibold tracking-tight"
                  style={{ color: ASK_BRAND.navy }}
                >
                  {hub.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {hub.blurb}
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold"
                  style={{ color: hub.accent }}
                >
                  {hub.cta}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
