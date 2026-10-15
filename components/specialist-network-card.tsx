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
      <summary data-analytics-event="network_metric_trace" className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline-none focus-visible:ring-2">
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
      <p className="mt-1 text-xs leading-snug text-slate-600">{metric.description}</p>
      <p className="mt-1 text-xs leading-snug text-slate-600">Grain: {metric.grain}</p>
      <p className="mt-1 text-xs leading-snug text-slate-600">Official source date: {dateLabel(metric.sourceAsOf)}</p>
      <Trace metric={metric} />
    </div>
  );
}

function signatureMetrics(card: SpecialistHubPresentation): NetworkMetric[] {
  const lead = card.universes.length > 0 ? card.universes : card.primary;
  return lead.slice(0, 3);
}

function remainingMetrics(card: SpecialistHubPresentation): NetworkMetric[] {
  const shown = new Set(signatureMetrics(card).map((metric) => metric.key));
  return [...card.universes, ...card.primary, ...card.secondary].filter((metric) => !shown.has(metric.key));
}

export function SpecialistNetworkCard({
  card,
  stateResearch,
}: {
  card: SpecialistHubPresentation;
  /** Ask-derived network state coverage for this hub (canonical catalog + accepted contract paths). */
  stateResearch?: { published: number; national: number; total: number; href: string };
}) {
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

      {stateResearch ? (
        <a
          href={stateResearch.href}
          data-network-state-research={card.hub}
          className="mt-3 inline-flex min-h-11 items-center self-start rounded-full bg-indigo-50 px-3 text-xs font-semibold"
          style={{ color: ASK_BRAND.indigo }}
        >
          State research in {stateResearch.published} of {stateResearch.total} network states
          {stateResearch.national > 0 ? ` · national research in ${stateResearch.national}` : ''}
        </a>
      ) : null}

      <div className={`grid gap-5 sm:gap-6 ${card.universes.length ? 'mt-5' : 'mt-4'} sm:grid-cols-2`}>
        {signatureMetrics(card).map((metric) => (
          <MetricBlock key={metric.key} metric={metric} size={card.universes.length ? 'md' : 'lg'} />
        ))}
      </div>

      {remainingMetrics(card).length > 0 ? (
        <details className="mt-5 rounded-xl border px-3" style={{ borderColor: ASK_BRAND.border }}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">More published measures</summary>
          <ul className="space-y-3 border-t py-3 text-sm leading-relaxed" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.ink }}>
            {remainingMetrics(card).map((metric) => (
              <li key={metric.key} className="min-w-0">
                <MetricValue value={metric.value} size="inline" /> {metric.label}
                <p className="text-xs leading-snug text-slate-600">{metric.description}</p>
                <p className="text-xs leading-snug text-slate-600">Grain: {metric.grain}</p>
                <p className="text-xs leading-snug text-slate-600">Official source date: {dateLabel(metric.sourceAsOf)}</p>
                <Trace metric={metric} />
              </li>
            ))}
          </ul>
        </details>
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
        <p className="mt-1">
          <span className="font-semibold">Specialist contract revision</span>{' '}
          {card.contractRevision ?? 'Not supplied'}
        </p>
        <p className="mt-2">{card.newestSourceAsOfNote}</p>
      </div>

      <a
        href={card.href}
        data-analytics-event="network_specialist_click"
        className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-semibold"
        style={{ color: ASK_BRAND.indigo }}
      >
        {card.action} <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </article>
  );
}
