import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { IL_PUBLICATION_MANIFEST } from '@/lib/network/il-network';

const STARTERS = [
  { q: 'roofing contractors in Illinois', hub: 'Contractor' },
  { q: 'How many active roofing businesses are indexed in Illinois?', hub: 'Contractor' },
  { q: 'licensed movers in Illinois', hub: 'Move' },
  { q: 'interstate mover in Illinois', hub: 'Move' },
  { q: 'nursing homes in Illinois', hub: 'Senior' },
  { q: 'assisted living in Illinois', hub: 'Senior' },
  { q: 'mortgage activity in Illinois', hub: 'Lender' },
  { q: 'licensed mortgage companies in Illinois', hub: 'Lender' },
  { q: 'insurance companies in Illinois', hub: 'Insurance' },
  { q: 'Director’s Orders in Illinois', hub: 'Insurance' },
  { q: 'state registered investment advisers in Illinois', hub: 'Investor' },
  { q: 'federal advisers filing notice in Illinois', hub: 'Investor' },
] as const;

export function IllinoisNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof IL_PUBLICATION_MANIFEST;
  releaseGatePassed: boolean;
}) {
  const liveCount = manifest.hubs.filter((h) => h.publication_status === 'live').length;
  const ledger = manifest.expansion_ledger;

  return (
    <main className="container-page overflow-x-clip py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm" style={{ color: ASK_BRAND.ink }}>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
          style={{ color: ASK_BRAND.indigo }}
        >
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Illinois</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Illinois Trust Hub Research
      </h1>
      <p className="mt-2 text-lg font-medium" style={{ color: ASK_BRAND.navy }}>
        The Trust Hub Network
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance,
        and investment advisers. AskTrustHub is the discovery and routing layer. Specialist hubs own
        the Illinois evidence. No paid placements. No Trust Score. No blanket “verified providers”
        statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. Illinois research is statewide. Chicago, Cook County, and other local
        names stay on this statewide entrance; local Illinois datasets are not started.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Illinois pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable Illinois gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">
          All six specialist Illinois research pages are published. Ask /illinois is a catalog and
          research entrance, not a seventh copy of every specialist dataset.
        </p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist Illinois research
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {manifest.hubs.map((hub) => {
            const live = hub.publication_status === 'live';
            return (
              <li
                key={hub.hub_id}
                className="flex min-w-0 flex-col rounded-2xl border p-5"
                style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
              >
                <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {hub.hub_name}
                </h3>
                <p className="mt-1 text-sm font-medium">{hub.plain_question}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
                  {hub.research_topics.slice(0, 4).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {hub.coverage_summary}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {live ? (
                    <a
                      href={hub.canonical_state_url}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2"
                      style={{ backgroundColor: ASK_BRAND.navy }}
                    >
                      Open {hub.hub_name} Illinois
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Illinois page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in Illinois
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="il-different">
        <h2 id="il-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What Illinois coverage does and does not establish
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_illinois_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Illinois evidence metrics
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one Illinois-provider denominator. Do not add the cards.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {manifest.intelligence_strip.map((row) => (
            <li
              key={row.hub_id}
              className="rounded-2xl border p-4"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                {row.display}
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {row.grain}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <h2 id="starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What can I research?
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {STARTERS.map((row) => (
            <li key={row.q}>
              <Link
                href={`/ask?q=${encodeURIComponent(row.q)}`}
                className="inline-flex min-h-11 w-full items-center whitespace-normal break-words rounded-xl border px-4 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              >
                {row.q}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="cannot-establish">
        <h2 id="cannot-establish" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Source coverage and gaps
        </h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>4,675 active roofing business credential IDs are not unique companies and not a universal Illinois contractor census. 33,290 roofing credential IDs are the source slice.</li>
          <li>Current ILCC household-goods roster is search only. Licensed-mover count is unknown, not zero. Do not display 0.</li>
          <li>666 CMS nursing homes are not 595 IDPH home-health licenses and not 169 HFS supportive-living sites. Assisted living remains search-only.</li>
          <li>394,488 HMDA applications are not lenders. 66,742 / 394,488 = 16.92% is denials as a percent of total applications, not a decision-based denial rate.</li>
          <li>2,896 IDOI Director’s Order observations are not currently authorized insurers. Company, agency, and producer current universes remain search-only.</li>
          <li>855 approved state-IA CRDs are not 55 ERA, 3,560 notice filings, or 793 principal-office firms. Do not add these populations.</li>
        </ul>
        <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
          {ledger.CROSS_HUB_RECORD_TOTAL.explanation} New public research surfaces:{' '}
          {ledger.NEW_PUBLIC_RESEARCH_SURFACES.value} ({ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation})
        </p>
      </section>

      <section className="mt-12" aria-labelledby="principles">
        <h2 id="principles" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Network principles
        </h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>No Trust Score. No paid ranking. No best, safest, or vetted conclusions.</li>
          <li>Unknown and search-only evidence is not zero. Zero canonical/profile/graph writes is not “no research data added.”</li>
          <li>Ask does not create claimable profiles from this aggregation.</li>
          <li>Illinois is statewide. Chicago and Cook County Ask routes are not published.</li>
        </ul>
      </section>
    </main>
  );
}
