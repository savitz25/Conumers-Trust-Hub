import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { PA_PUBLICATION_MANIFEST } from '@/lib/network/pa-network';

const STARTERS = [
  { q: 'licensed contractors Pennsylvania', hub: 'Contractor' },
  { q: 'asbestos contractor Pennsylvania', hub: 'Contractor' },
  { q: 'movers Pennsylvania', hub: 'Move' },
  { q: 'household goods movers Pennsylvania', hub: 'Move' },
  { q: 'nursing homes Pennsylvania', hub: 'Senior' },
  { q: 'personal care homes Pennsylvania', hub: 'Senior' },
  { q: 'licensed mortgage lender Pennsylvania', hub: 'Lender' },
  { q: 'HMDA applications Pennsylvania 2025', hub: 'Lender' },
  { q: 'insurance companies Pennsylvania', hub: 'Insurance' },
  { q: 'homeowners insurance agencies Pennsylvania', hub: 'Insurance' },
  { q: 'state registered investment adviser Pennsylvania', hub: 'Investor' },
  { q: 'ERA Pennsylvania', hub: 'Investor' },
] as const;

export function PennsylvaniaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof PA_PUBLICATION_MANIFEST;
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
        <span>Pennsylvania</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Pennsylvania Trust Hub Research
      </h1>
      <p className="mt-2 text-lg font-medium" style={{ color: ASK_BRAND.navy }}>
        The Trust Hub Network
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        One statewide entry point across contractors, movers, senior care, lending, insurance, and
        investment-adviser research. AskTrustHub is the discovery and routing layer. Specialist hubs
        own the Pennsylvania evidence. No paid placements. No Trust Score. No blanket “verified
        providers” statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. Pennsylvania research is statewide. Philadelphia, Pittsburgh, and other
        local names stay on this statewide entrance; local Pennsylvania datasets are not started.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Pennsylvania pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable Pennsylvania gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">
          All six specialist Pennsylvania research pages are published. Ask /pennsylvania is a catalog and
          research entrance, not a seventh copy of every specialist dataset.
        </p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist Pennsylvania research
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
                <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {hub.coverage_limitation}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {live ? (
                    <a
                      href={hub.canonical_state_url}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2"
                      style={{ backgroundColor: ASK_BRAND.navy }}
                    >
                      Open {hub.hub_name} Pennsylvania
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Pennsylvania page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in Pennsylvania
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="pa-different">
        <h2 id="pa-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Pennsylvania different
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_pennsylvania_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Pennsylvania evidence metrics
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one Pennsylvania-provider denominator. Do not add the cards.
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

      <section className="mt-12" aria-labelledby="identifiers">
        <h2 id="identifiers" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Research by exact identifier
        </h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>Contractor: PA HIC / HICPA registration, DLI asbestos CERT, DLI lead CERT.</li>
          <li>Move: PA PUC Utility Code, Carrier ID, USDOT, MC — keep state and federal identifiers distinct.</li>
          <li>Senior: Pennsylvania state facility ID, CMS CCN.</li>
          <li>Lender: NMLS, LEI.</li>
          <li>Insurance: NAIC company code, NPN. A Pennsylvania producer license is not NPN unless the source says so.</li>
          <li>Investor: firm CRD, person CRD where appropriate, SEC/IARD identifiers.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <h2 id="starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Pennsylvania research starter questions
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
          <li>Pennsylvania has no universal statewide general-contractor license. HICPA is search-only, not zero.</li>
          <li>267 PA PUC Utility Codes are not FMCSA interstate authority. Broker, complaint, and enforcement bulk remain search-only.</li>
          <li>Nursing homes, Home Health, Home Care, Hospice, PCH, ALR, and LIFE/PACE are not one senior-care total.</li>
          <li>444,887 HMDA 2025 applications are not lenders. Current NMLS rosters remain search-only.</li>
          <li>1,722 NAIC identities are not agencies or producers. Homeowners/auto are consumer products, not agency LOA cohorts.</li>
          <li>864 approved state-IA CRDs are not 99 ERA, 3,411 notice filings, or 623 principal-office firms. Do not add these populations.</li>
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
          <li>Unknown and search-only evidence is not zero.</li>
          <li>Ask does not create claimable profiles from this aggregation.</li>
          <li>Pennsylvania is statewide. Philadelphia and Pittsburgh Ask routes are not published.</li>
        </ul>
      </section>
    </main>
  );
}
