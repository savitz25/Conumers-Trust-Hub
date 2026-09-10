import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { VA_PUBLICATION_MANIFEST } from '@/lib/network/va-network';

const STARTERS = [
  { q: 'Is this contractor licensed in Virginia?', hub: 'Contractor' },
  { q: 'How many contractors are in Virginia?', hub: 'Contractor' },
  { q: 'Find assisted living in Virginia.', hub: 'Senior' },
  { q: 'Find nursing homes in Virginia.', hub: 'Senior' },
  { q: 'Can I check a mover in Virginia?', hub: 'Move' },
  { q: 'Does a Virginia Property Carrier permit mean they can move my household goods?', hub: 'Move' },
  { q: 'Which mortgage lenders are licensed in Virginia?', hub: 'Lender' },
  { q: 'How much mortgage lending happened in Virginia last year?', hub: 'Lender' },
  { q: 'How many investment advisers are registered in Virginia?', hub: 'Investor' },
  { q: 'Does a Virginia principal office mean the adviser is state-registered?', hub: 'Investor' },
  { q: 'Which insurance companies are authorized in Virginia?', hub: 'Insurance' },
  { q: 'Does this insurer have a Virginia regulatory action?', hub: 'Insurance' },
] as const;

export function VirginiaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof VA_PUBLICATION_MANIFEST;
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
        <span>Virginia</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Virginia Consumer Research
      </h1>
      <p className="mt-2 text-lg font-medium" style={{ color: ASK_BRAND.navy }}>
        The Trust Hub Network
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, senior care, movers, mortgage lenders, investment
        advisers, and insurance. AskTrustHub is the discovery and routing layer. Specialist hubs own
        the Virginia evidence. No paid placements. No Trust Score. No blanket “verified providers”
        statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. Virginia research is state-level. This page does not publish Virginia
        city or county gateways.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Virginia pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable Virginia gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">All six specialist Virginia research pages are published.</p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist Virginia research
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
                      Open {hub.hub_name} Virginia
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Virginia page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in Virginia
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="va-different">
        <h2 id="va-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Virginia different
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_virginia_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Virginia intelligence strip
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one Virginia-provider denominator.
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
          <li>53,840 Class A/B/C license numbers are not unique companies. Tradesmen are a separate person grain.</li>
          <li>192 HHG certificates are not Property Carrier permits and not a mover census. Do not add 192 + 4,916. DMV is not FMCSA.</li>
          <li>573 assisted-living facilities are not nursing homes. Do not add DSS and CMS classes. Capacity is not occupancy. Complaint-related is not a substantiated complaint.</li>
          <li>1,257 dated SCC mortgage-company rows are not current 2026 lenders. An MLO is not a company. An HMDA application is not a lender. A complaint is not a violation.</li>
          <li>1,546 2025 statistical-report NAIC observations are not currently authorized insurers. A regulatory action is not a conviction. A market conduct exam is not a violation. 1,727 exact-match observations are not unique insurers.</li>
          <li>697 APPROVED state IA firms are not 339 principal-office firms, not 107 ERA, and not 3,289 notice filings. 4,481 SCC annual activity is not 4,481 firms.</li>
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
          <li>Virginia is statewide only. No Richmond, Fairfax, Arlington, or Virginia Beach Ask routes.</li>
        </ul>
      </section>
    </main>
  );
}
