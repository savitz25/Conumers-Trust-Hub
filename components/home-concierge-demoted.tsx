import { ConciergeEntry } from '@/components/concierge-entry';
import { ASK_BRAND } from '@/lib/design/ask-design-system';

export function HomeConciergeDemoted() {
  return (
    <section
      id="ask"
      aria-labelledby="concierge-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
    >
      <div className="container-page max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          Concierge routing
        </p>
        <h2
          id="concierge-heading"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: ASK_BRAND.navy }}
        >
          Now that you have seen what the network researches, tell us what you are trying to figure out.
        </h2>
        <p className="mt-2 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Concierge routes. It is not the underlying evidence source. Specialist hubs own the records.
        </p>
        <div className="mt-6">
          <ConciergeEntry />
        </div>
      </div>
    </section>
  );
}
