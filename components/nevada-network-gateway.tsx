import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { NV_PUBLICATION_MANIFEST } from '@/lib/network/nv-network';

type Clocks = Record<string, string | null>;

/** Readable source clocks. Build clocks (generated_at) are not source dates and are not shown. */
function clockLine(clocks: Clocks): string {
  return Object.entries(clocks)
    .filter(([key]) => key !== 'generated_at')
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\bhh\b/, 'home health').replace(/\bhfc\b/, 'HFC').replace(/\biapd\b/, 'IAPD');
      const shown = value === null ? 'not published' : /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
      return `${label}: ${shown}`;
    })
    .join(' · ');
}

export function NevadaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof NV_PUBLICATION_MANIFEST;
  releaseGatePassed: boolean;
}) {
  const ledger = manifest.expansion_ledger;

  return (
    <main className="container-page overflow-x-clip py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm" style={{ color: ASK_BRAND.ink }}>
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Nevada</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>
        Statewide research · six specialist sources
      </p>
      <h1 id="nv-title" className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>
        Nevada Trust Hub Network research
      </h1>
      <section aria-labelledby="nv-title" className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        <p>{manifest.conceptual_statement}</p>
        <p className="mt-3">
          {releaseGatePassed
            ? 'All six specialist Nevada research pages are published. Ask /nevada is independent public-record research and a routing entrance, not a seventh database.'
            : `Release gate: ${manifest.release_gate.blocker ?? 'pending specialist'}. This page does not claim a complete Nevada network.`}
        </p>
        <p className="mt-3">There is no Trust Score and no paid ranking. Ask does not rank, endorse, or choose a best, safest, or recommended provider.</p>
      </section>
      <section className="mt-10" aria-labelledby="nv-hubs">
        <h2 id="nv-hubs" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist research
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed">
          Each card uses its own hub&apos;s regulator and grain. The cards are not symmetric and are never added together.
        </p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {manifest.hubs.map((hub) => {
            const strip = manifest.intelligence_strip.find((row) => row.hub_id === hub.hub_id);
            return (
              <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
                <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
                <p className="mt-1 text-sm font-medium">{hub.plain_question}</p>
                {strip ? <p className="mt-2 break-words text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>{strip.display}</p> : null}
                <p className="mt-2 text-xs leading-relaxed">{strip?.grain}</p>
                <p className="mt-2 text-xs leading-relaxed">{hub.coverage_summary}</p>
                <p className="mt-2 text-xs leading-relaxed">{hub.coverage_limitation}</p>
                <p className="mt-2 break-words text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  Source clocks: {clockLine(hub.source_clocks as unknown as Clocks)}
                </p>
                <a href={hub.canonical_state_url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: ASK_BRAND.navy }}>
                  Open {hub.hub_name} Nevada
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="mt-12" aria-labelledby="nv-limits">
        <h2 id="nv-limits" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Research limitations
        </h2>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>Missing is not zero. Where a regulator publishes no roster or a list was not acquired, the count is unknown.</li>
          <li>Each hub uses a different regulator and data grain: CPCN identities, HMDA loan activity, enforcement index rows, license numbers, a dated regulator census, care-class licenses and endorsements, and adviser registrations are different things.</li>
          <li>No combined Nevada total is published. {ledger.CROSS_HUB_RECORD_TOTAL.explanation} Status: {ledger.CROSS_HUB_RECORD_TOTAL.status}.</li>
          <li>Source clocks differ by hub. A retrieval date is not a license, order or report date.</li>
          <li>Las Vegas, Reno, Henderson, Carson City and North Las Vegas are geography. No Nevada city or county Ask page is published.</li>
        </ul>
      </section>
      <section className="mt-12" aria-labelledby="nv-different">
        <h2 id="nv-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Nevada different
        </h2>
        <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {manifest.what_makes_nevada_different.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section className="mt-12" aria-labelledby="nv-routing">
        <h2 id="nv-routing" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Network routing
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          Ask sends each Nevada question to the specialist that owns the evidence and does not copy specialist records.
        </p>
        <ul className="mt-3 grid max-w-3xl gap-2 text-sm sm:grid-cols-2">
          {manifest.hubs.map((hub) => (
            <li key={hub.hub_id}>
              <a href={hub.canonical_state_url} className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                {hub.hub_name}: {hub.canonical_state_url.replace('https://www.', '')}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
