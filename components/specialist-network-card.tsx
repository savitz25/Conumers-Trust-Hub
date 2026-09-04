import { ArrowRight } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { MetricValue } from '@/components/metric-value';
import type { NetworkMetric, SpecialistHubPresentation } from '@/lib/network-metrics/types.ts';

function dateLabel(value: string | null): string {
  return value ? value.slice(0, 10) : 'Not supplied by specialist';
}

function Trace({ metric }: { metric: NetworkMetric }) {
  return (
    <details className="mt-2 rounded-xl border px-3" style={{ borderColor: ASK_BRAND.border }}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-2">
        Trace this number
      </summary>
      <div className="space-y-2 border-t py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
        <p>{metric.trace.summary}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Public label</dt>
            <dd>{metric.label}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Source label</dt>
            <dd>{metric.sourceLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Grain</dt>
            <dd>{metric.grain}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Official as-of</dt>
            <dd>{dateLabel(metric.sourceAsOf)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Generated</dt>
            <dd>{dateLabel(metric.generatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Publication</dt>
            <dd>{metric.publicationStatus}</dd>
          </div>
          {metric.denominator ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">Denominator</dt>
              <dd>{metric.denominator}</dd>
            </div>
          ) : null}
          {metric.trace.details.map((row) => (
            <div key={`${metric.key}-${row.label}`} className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        {metric.trace.limitations.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            {metric.trace.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

function MetricBlock({ metric, size }: { metric: NetworkMetric; size: 'lg' | 'md' }) {
  return (
    <div className="min-w-0">
      <MetricValue value={metric.value} size={size} />
      <p className="mt-1 text-sm leading-snug" style={{ color: ASK_BRAND.ink }}>
        {metric.label}
      </p>
      <Trace metric={metric} />
    </div>
  );
}

export function SpecialistNetworkCard({ card }: { card: SpecialistHubPresentation }) {
  const generatedDay = card.generatedAt.slice(0, 10);
  return (
    <article
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-5 sm:p-6"
      style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
      data-specialist-origin={card.origin}
      data-specialist-hub={card.hub}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        {card.eyebrow}
      </p>
      <h3 className="mt-1 text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
        {card.name}
      </h3>
      {card.origin === 'FALLBACK' ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Showing last-known-good specialist snapshot. Upstream publication temporarily unavailable.
        </p>
      ) : null}

      {card.universes.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {card.universes.map((metric) => (
            <div key={metric.key} className="min-w-0 rounded-xl bg-slate-50 px-3 py-3">
              <MetricValue value={metric.value} size="md" />
              <p className="mt-1 text-xs font-semibold leading-snug">{metric.label}</p>
              <Trace metric={metric} />
            </div>
          ))}
        </div>
      ) : null}

      <div className={`grid gap-5 sm:gap-6 ${card.universes.length ? 'mt-5' : 'mt-4'} sm:grid-cols-2`}>
        {card.primary.map((metric) => (
          <MetricBlock key={metric.key} metric={metric} size={card.universes.length ? 'md' : 'lg'} />
        ))}
      </div>

      {card.secondary.length > 0 ? (
        <ul className="mt-5 space-y-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {card.secondary.map((metric) => (
            <li key={metric.key} className="min-w-0">
              <MetricValue value={metric.value} size="inline" /> {metric.label}
              <Trace metric={metric} />
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-4 space-y-1 text-xs leading-relaxed text-slate-600">
        {card.caveats.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p>
          <span className="font-semibold">Network rollup generated</span> {generatedDay}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Newest documented specialist source date</span>{' '}
          {dateLabel(card.newestSourceAsOf)}
        </p>
        <p className="mt-2">{card.newestSourceAsOfNote}</p>
      </div>

      <a
        href={card.href}
        className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-semibold"
        style={{ color: ASK_BRAND.indigo }}
      >
        {card.action} <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </article>
  );
}
