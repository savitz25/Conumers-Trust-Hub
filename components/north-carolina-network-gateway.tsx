import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { NC_PUBLICATION_MANIFEST } from '@/lib/network/nc-network';

const STARTERS = [
  { q: 'licensed contractors North Carolina', hub: 'Contractor' },
  { q: 'roofing contractor North Carolina', hub: 'Contractor' },
  { q: 'movers North Carolina', hub: 'Move' },
  { q: 'NCUC mover North Carolina', hub: 'Move' },
  { q: 'adult care homes North Carolina', hub: 'Senior' },
  { q: 'nursing homes North Carolina', hub: 'Senior' },
  { q: 'licensed mortgage lender North Carolina', hub: 'Lender' },
  { q: 'HMDA applications North Carolina 2025', hub: 'Lender' },
  { q: 'insurance companies North Carolina', hub: 'Insurance' },
  { q: 'homeowners insurance agencies North Carolina', hub: 'Insurance' },
  { q: 'NC registered investment adviser', hub: 'Investor' },
  { q: 'ERA North Carolina', hub: 'Investor' },
] as const;

export function NorthCarolinaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof NC_PUBLICATION_MANIFEST;
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
        <span>North Carolina</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        North Carolina Trust Hub Research
      </h1>
      <p className="mt-2 text-lg font-medium" style={{ color: ASK_BRAND.navy }}>
        The Trust Hub Network
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        One statewide research entry point across contractors, movers, senior care, lending, insurance, and
        investment-adviser research. AskTrustHub is the discovery and routing layer. Specialist hubs
        own the North Carolina evidence. No paid placements. No Trust Score. No blanket “verified
        providers” statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. North Carolina research is statewide. Charlotte, Raleigh, Durham, and other
        local names stay on this statewide entrance; local North Carolina datasets are not started.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist North Carolina pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable North Carolina gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">
          All six specialist North Carolina research pages are published. Ask /north-carolina is a catalog and
          research entrance, not a seventh copy of every specialist dataset.
        </p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist North Carolina research
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
                      Open {hub.hub_name} North Carolina
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      North Carolina page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in North Carolina
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="nc-different">
        <h2 id="nc-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes North Carolina different
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_north_carolina_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          North Carolina evidence metrics
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one North Carolina-provider denominator. Do not add the cards.
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
          <li>Contractor: NCLBGC license, NCBEEC license, PHFS license — keep boards distinct.</li>
          <li>Move: NCUC C-number, NCUC T-number, USDOT, MC — do not translate C/T into USDOT/MC.</li>
          <li>Senior: DHSR state license, DHSR FID, CMS CCN — do not translate state license into CCN without an exact bridge.</li>
          <li>Lender: NCCOB license number, NMLS Unique ID, LEI. NCCOB ID is not NMLS.</li>
          <li>Insurance: NAIC company code, NPN, NC license number where distinct. NAIC is not NPN.</li>
          <li>Investor: firm CRD, person CRD where appropriate, SEC/IARD identifiers. Firm CRD is not person CRD.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <h2 id="starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          North Carolina research starter questions
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
          <li>Current NCLBGC statewide roster is search-only, not zero. Do not headline 38,523 mixed records as active contractors.</li>
          <li>362 NCUC C-number identities are a monthly list snapshot, not currently active movers and not FMCSA authority.</li>
          <li>Adult Care Homes, Family Care Homes, Nursing Homes, Home Health, Hospice, PACE, and CCRC are not one senior-care total. DHSR Star Rating is not a TrustHub ranking.</li>
          <li>484,454 HMDA 2025 applications are not lenders. 640 NCCOB Mortgage Lender rows is a class grain. 1,380 mixed entities is not a lender count.</li>
          <li>2,874 Licensing Action rows are not providers. Homeowners/auto are consumer products, not agency LOA cohorts.</li>
          <li>687 SOS IA firm CRDs are not 701 IAPD APPROVED firms, 33 ERA, or 3,704 notice filings. Do not add these populations.</li>
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
          <li>North Carolina is statewide. Charlotte and Raleigh Ask routes are not published.</li>
        </ul>
      </section>
    </main>
  );
}
