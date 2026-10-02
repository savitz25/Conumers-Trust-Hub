import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { GA_PUBLICATION_MANIFEST } from '@/lib/network/ga-network';

export function GeorgiaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof GA_PUBLICATION_MANIFEST;
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
        <span>Georgia</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>
        Statewide research · six specialist hubs
      </p>
      <h1 id="ga-title" className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>
        Georgia Trust Hub Research
      </h1>
      <section aria-labelledby="ga-title" className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        <p>{manifest.conceptual_statement}</p>
        <p className="mt-3">
          {releaseGatePassed
            ? 'All six specialist Georgia research pages are published. Ask /georgia is a catalog and research entrance, not a seventh database.'
            : `Release gate: ${manifest.release_gate.blocker ?? 'pending specialist'}. This page does not claim a complete Georgia network.`}
        </p>
        <p className="mt-3">There is no Trust Score and no paid ranking.</p>
      </section>
      <section className="mt-10" aria-labelledby="ga-hubs">
        <h2 id="ga-hubs" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist research
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {manifest.hubs.map((hub) => {
            const strip = manifest.intelligence_strip.find((row) => row.hub_id === hub.hub_id);
            return (
              <li key={hub.hub_id} className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
                <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
                <p className="mt-1 text-sm font-medium">{hub.plain_question}</p>
                {strip ? <p className="mt-2 text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>{strip.display}</p> : null}
                <p className="mt-2 text-xs leading-relaxed">{strip?.grain}</p>
                <p className="mt-2 text-xs leading-relaxed">{hub.coverage_limitation}</p>
                <a href={hub.canonical_state_url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: ASK_BRAND.navy }}>
                  Open {hub.hub_name} Georgia
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="mt-12" aria-labelledby="ga-total">
        <h2 id="ga-total" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          No combined Georgia total
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          {ledger.CROSS_HUB_RECORD_TOTAL.explanation} Status: {ledger.CROSS_HUB_RECORD_TOTAL.status}.
        </p>
      </section>
    </main>
  );
}
