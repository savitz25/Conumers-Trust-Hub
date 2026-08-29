import { NetworkAskInput } from '@/components/network-ask-input';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { getTrustHubNetworkState } from '@/lib/network/aggregator';

export function NetworkAskHero() {
  const state = getTrustHubNetworkState();
  const asOf = state.latestOfficialAsOf
    ? new Date(`${state.latestOfficialAsOf}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <section
      id="ask-network"
      data-hub="ask"
      aria-labelledby="ask-network-heading"
      className="relative overflow-hidden border-b"
      style={{
        borderColor: ASK_BRAND.border,
        background: `linear-gradient(165deg, ${ASK_BRAND.white} 0%, ${ASK_BRAND.canvas} 48%, ${ASK_BRAND.periwinkle} 160%)`,
      }}
    >
      <div className="container-page relative py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: ASK_BRAND.indigo }}>
            The Trust Hub Network
          </p>
          <h1
            id="ask-network-heading"
            className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
            style={{ color: ASK_BRAND.navy }}
          >
            Ask the TrustHub Network.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: ASK_BRAND.ink }}>
            Six specialist research systems for high-stakes consumer decisions.
          </p>
        </div>
        <NetworkAskInput />
        <ul
          className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
          style={{ color: ASK_BRAND.navy }}
        >
          <li>6 specialist research systems</li>
          <li>{state.sourceFamilyCount} public-source families</li>
          <li>No paid rankings</li>
          <li>Every published metric traceable</li>
        </ul>
        <p className="mt-3 text-center text-xs" style={{ color: ASK_BRAND.ink }}>
          Latest network snapshot activity:{' '}
          <span className="font-medium">{asOf ?? 'See hub cards'}</span>
          {' · '}
          Official as-of and retrieval dates are listed on each hub card — they are not the same clock.
        </p>
      </div>
    </section>
  );
}
