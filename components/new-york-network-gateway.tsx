import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { NY_PUBLICATION_MANIFEST } from '@/lib/network/ny-network';

const STARTERS = [
  { q: 'How many public-work contractors are registered in New York?', hub: 'Contractor' },
  { q: 'Is this contractor registered for public work in New York?', hub: 'Contractor' },
  { q: 'Show intrastate movers in New York', hub: 'Move' },
  { q: 'Show current interstate carriers headquartered in NY', hub: 'Move' },
  { q: 'Nursing homes in New York', hub: 'Senior' },
  { q: 'licensed home-care agencies in NY', hub: 'Senior' },
  { q: 'How much mortgage lending happened in New York in 2025?', hub: 'Lender' },
  { q: 'Which mortgage lenders are currently licensed in New York?', hub: 'Lender' },
  { q: 'Which insurance companies are in the New York DFS directory?', hub: 'Insurance' },
  { q: 'Does this insurer have a New York DFS enforcement observation?', hub: 'Insurance' },
  { q: 'How many investment advisers are registered in New York?', hub: 'Investor' },
  { q: 'Does a New York principal office mean the adviser is state-registered?', hub: 'Investor' },
] as const;

export function NewYorkNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof NY_PUBLICATION_MANIFEST;
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
        <span>New York</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        New York Consumer Research
      </h1>
      <p className="mt-2 text-lg font-medium" style={{ color: ASK_BRAND.navy }}>
        The Trust Hub Network
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, movers, senior care, mortgage lenders, insurance,
        and investment advisers. AskTrustHub is the discovery and routing layer. Specialist hubs own
        the New York evidence. No paid placements. No Trust Score. No blanket “verified providers”
        statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. New York research is statewide. NYC, borough, and county names stay on
        this statewide entrance; local NYC datasets are not started.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist New York pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable New York gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">
          All six specialist New York research pages are published. Ask /new-york is a catalog and
          research entrance, not a seventh copy of every specialist dataset.
        </p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist New York research
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
                      Open {hub.hub_name} New York
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      New York page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in New York
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="ny-different">
        <h2 id="ny-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What New York coverage does and does not establish
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_new_york_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          New York evidence metrics
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one New York-provider denominator. Do not add the cards.
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
          <li>14,665 public-work certificate rows are not unique companies and not a statewide residential HIC license.</li>
          <li>Current NYSDOT household-goods roster is search only. 108 bulletin observations are not 108 authorized movers. 103 Case Numbers are not current authorities.</li>
          <li>597 nursing-home identities are not 527 ACF identities and not licensed home-care agencies. 527 is not proven currently active.</li>
          <li>388,207 HMDA applications are not lenders. 151 bankers / 439 brokers are end-of-2024 aggregates, not current licenses.</li>
          <li>1,054 DFS company-directory rows are not currently authorized insurers. 128 2024 auto ranking observations are not TrustHub recommendations.</li>
          <li>1,297 approved state-IA firms are not 327 ERA, 5,856 notice filings, or 3,152 principal-office firms. Do not add these populations.</li>
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
          <li>New York is statewide. NYC local acquisition is approved after statewide closeout and is not started.</li>
        </ul>
      </section>
    </main>
  );
}
