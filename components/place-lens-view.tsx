import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { COVERAGE_LEVEL_LABELS } from '@/lib/network/coverage-atlas';
import type { PlaceLens } from '@/lib/network/place-lens';
import { PLACE_LENS_INDEX } from '@/lib/network/place-lens';
import { listNetworkSourceRows } from '@/lib/network/source-registry';

export function PlaceLensView({ lens }: { lens: PlaceLens }) {
  const sources = listNetworkSourceRows();
  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {lens.summary}
      </p>
      <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
        This is research availability, not a Broward Trust Score, county safety score, or “best county.”
      </p>
      <ul className="mt-4 flex flex-wrap gap-3 text-sm">
        {PLACE_LENS_INDEX.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-8 grid gap-4 lg:grid-cols-2">
        {lens.hubs.map((hub) => {
          const fam = hub.metrics[0]?.sourceFamilyId
            ? sources.find((s) => s.hubId === hub.hubId && s.id === hub.metrics[0].sourceFamilyId)
            : undefined;
          return (
            <li
              key={hub.hubId}
              className="flex flex-col rounded-2xl border p-5"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {hub.name}
                </h2>
                <span className="text-[11px] font-semibold uppercase" style={{ color: ASK_BRAND.indigo }}>
                  {hub.capability in COVERAGE_LEVEL_LABELS
                    ? COVERAGE_LEVEL_LABELS[hub.capability]
                    : hub.capabilityLabel}
                </span>
              </div>
              <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
                {hub.capabilityLabel}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                <span className="font-semibold">Geography meaning. </span>
                {hub.geographyMeaning}
              </p>
              {hub.metrics.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {hub.metrics.map((m) => (
                    <li key={m.label}>
                      <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                        {m.label}: {m.value}
                      </p>
                      <p className="text-xs" style={{ color: ASK_BRAND.ink }}>
                        {m.grain} {m.officialAsOf ? `· as-of ${m.officialAsOf}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: ASK_BRAND.ink }}>
                        {m.limitation}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm" style={{ color: ASK_BRAND.ink }}>
                  No county-specific metric is published. State-level research available; county-specific
                  intelligence not currently published.
                </p>
              )}
              {fam ? (
                <p className="mt-2 text-xs" style={{ color: ASK_BRAND.ink }}>
                  Source: {fam.sourceOrganization}. {fam.limitation}
                </p>
              ) : null}
              <p className="mt-2 text-xs" style={{ color: ASK_BRAND.ink }}>
                {hub.limitation}
              </p>
              <a
                href={hub.destination}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: ASK_BRAND.navy }}
              >
                {hub.destinationLabel}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
