import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { getTrustHubNetworkState } from '@/lib/network/aggregator';
import { metricById } from '@/lib/network/manifest';

function formatValue(value: number | string): string {
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return value;
}

export function NetworkLiveMosaic() {
  const state = getTrustHubNetworkState();

  return (
    <section
      id="network-live"
      aria-labelledby="network-live-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
    >
      <div className="container-page">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          The Network, Live
        </p>
        <h2
          id="network-live-heading"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: ASK_BRAND.navy }}
        >
          Six live research worlds. One standard.
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Different markets, different evidence, same research discipline. Numbers are not added
          across hubs.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {state.hubs.map((hub) => {
            const primary = metricById(hub, hub.card.primaryMetricId);
            const supporting = hub.card.supportingMetricIds.map((id) => metricById(hub, id));
            const stale = hub.status !== 'ok';
            return (
              <li
                key={hub.hub.id}
                className="flex flex-col rounded-2xl border bg-white p-5"
                style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.card }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                    {hub.hub.name}
                  </h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: hub.hub.accent, color: '#fff' }}
                  >
                    {hub.card.scopeChip}
                  </span>
                </div>
                {stale ? (
                  <p className="mt-3 text-sm" style={{ color: ASK_BRAND.ink }}>
                    Current network metric temporarily unavailable.
                  </p>
                ) : (
                  <>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide" style={{ color: ASK_BRAND.indigo }}>
                      {primary?.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: ASK_BRAND.navy }}>
                      {primary ? formatValue(primary.value) : 'Temporarily unavailable'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                      {primary?.grain}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm" style={{ color: ASK_BRAND.ink }}>
                      {supporting.map((row) =>
                        row ? (
                          <li key={row.id}>
                            <span className="font-medium">{row.label}:</span> {formatValue(row.value)}
                          </li>
                        ) : null
                      )}
                    </ul>
                    <p className="mt-3 text-xs" style={{ color: ASK_BRAND.ink }}>
                      Official as-of {hub.snapshot.officialAsOf ?? 'see trace'} · retrieved{' '}
                      {hub.snapshot.retrievedAt ?? 'n/a'}
                    </p>
                  </>
                )}
                <details className="mt-3 rounded-lg border px-3 py-1" style={{ borderColor: ASK_BRAND.border }}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                    Trace this number
                  </summary>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div>
                      <dt className="text-xs uppercase text-muted-foreground">Hub</dt>
                      <dd>{hub.hub.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-muted-foreground">Grain</dt>
                      <dd>{primary?.grain}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-muted-foreground">Source family</dt>
                      <dd>{primary?.sourceFamily}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-muted-foreground">Official as-of</dt>
                      <dd>{primary?.officialAsOf ?? hub.snapshot.officialAsOf}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-muted-foreground">Snapshot</dt>
                      <dd>{hub.snapshot.snapshotId}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-muted-foreground">Limitation</dt>
                      <dd>{primary?.limitation ?? hub.limitations[0]}</dd>
                    </div>
                  </dl>
                  {hub.hub.methodologyHref ? (
                    <a
                      href={hub.hub.methodologyHref}
                      className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold"
                      style={{ color: ASK_BRAND.indigo }}
                    >
                      Open specialist methodology
                    </a>
                  ) : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium">Technical provenance</summary>
                    <p className="mt-1 break-all text-xs">
                      fingerprint {hub.snapshot.fingerprint ?? 'n/a'} · adapter {hub.snapshot.adapter}
                    </p>
                  </details>
                </details>
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href={hub.hub.exploreHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
                    style={{ backgroundColor: ASK_BRAND.navy }}
                  >
                    {hub.card.ctaLabel}
                  </a>
                  {hub.hub.askHref && hub.askCapabilities?.some((a) => a.status === 'live') ? (
                    <a
                      href={hub.hub.askHref}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
                      style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                    >
                      Ask this market
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
