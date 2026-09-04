import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { WA_PUBLICATION_MANIFEST } from '@/lib/network/wa-network';

const STARTERS = [
  { q: 'Is this Washington contractor registered?', hub: 'Contractor' },
  { q: "Can I see this Washington contractor's bond and insurance records?", hub: 'Contractor' },
  { q: 'How do I find an Adult Family Home in Washington?', hub: 'Senior' },
  { q: 'Is a Washington assisted living facility the same as a nursing home?', hub: 'Senior' },
  { q: 'How do I verify a Washington mover?', hub: 'Move' },
  { q: 'Does a USDOT number mean they can move me interstate from Washington?', hub: 'Move' },
  { q: 'How much mortgage activity was reported in Washington?', hub: 'Lender' },
  { q: 'How do I verify a Washington mortgage broker?', hub: 'Lender' },
  { q: 'Is this Washington investment adviser registered?', hub: 'Investor' },
  { q: 'How many SEC adviser firms are based in Washington?', hub: 'Investor' },
  { q: 'How do I verify a Washington insurance company?', hub: 'Insurance' },
  { q: 'How many insurance companies are licensed in Washington?', hub: 'Insurance' },
] as const;

const CROSS_HUB = [
  'Buying a Washington house: mortgage activity on Lender Trust Hub, then contractor registration, bond, and insurance on Contractor Trust Hub. These are separate evidence universes — not a composite score.',
  'Helping an elderly parent: Adult Family Home and assisted-living research on SeniorTrustHub, and household-goods verification on Move Trust Hub. A mover permit is not a care placement.',
  'Checking a Washington insurance company: Insurance Trust Hub for OIC lookup and dated annual-report context. 2,924 is not a live licensed-company count.',
  'A contractor working in an Adult Family Home: Contractor Trust Hub for L&I registration and SeniorTrustHub for the facility class. A contractor registration is not an AFH license.',
] as const;

export function WashingtonNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof WA_PUBLICATION_MANIFEST;
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
        <span>Washington</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Research Washington Providers &amp; Regulatory Records
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, senior care, movers, mortgage lenders, investment
        advisers, and insurance. AskTrustHub is the discovery and routing layer. Specialist hubs own
        the Washington evidence. No paid placements. No Trust Score. No blanket “verified providers”
        statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. Washington research is state-level. This page does not publish
        Washington city or county gateways.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Washington pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable Washington gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">All six specialist Washington research pages are published.</p>
      )}

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What official Washington evidence the network covers
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one Washington-provider denominator.
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

      <section className="mt-12" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist Washington research
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
                      Open {hub.hub_name} Washington
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Washington page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in Washington
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="data-moat">
        <h2 id="data-moat" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Washington data depth
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Evidence volume is not a quality score. These four buckets are not one Washington-records
          total.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Organizations / facilities', manifest.data_moat.organizations_facilities],
              ['Licenses / registrations', manifest.data_moat.licenses_registrations],
              ['Regulatory / market evidence', manifest.data_moat.regulatory_market_evidence],
              ['Search-only / restricted sources', manifest.data_moat.search_only_restricted],
            ] as const
          ).map(([title, rows]) => (
            <li
              key={title}
              className="rounded-2xl border p-4"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <h3 className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                {title}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs" style={{ color: ASK_BRAND.ink }}>
                {rows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="mt-6 overflow-x-auto rounded-2xl border" style={{ borderColor: ASK_BRAND.border }}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Washington hub identity, evidence, source, freshness, and coverage</caption>
            <thead className="bg-slate-100">
              <tr>
                <th scope="col" className="p-3">Hub</th>
                <th scope="col" className="p-3">Identity</th>
                <th scope="col" className="p-3">Evidence</th>
                <th scope="col" className="p-3">Source</th>
                <th scope="col" className="p-3">Freshness</th>
                <th scope="col" className="p-3">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {manifest.hubs.map((hub) => (
                <tr key={hub.hub_id} className="border-t align-top" style={{ borderColor: ASK_BRAND.border }}>
                  <th scope="row" className="p-3 font-semibold">
                    {hub.hub_name}
                  </th>
                  <td className="p-3">{hub.primary_identifiers.join(', ')}</td>
                  <td className="p-3">{hub.verified_facts[0]}</td>
                  <td className="p-3">{hub.source_summary}</td>
                  <td className="p-3">{hub.source_clock}</td>
                  <td className="p-3 text-slate-600">{hub.coverage_summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="wa-different">
        <h2 id="wa-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Washington different
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_washington_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="ledger">
        <h2 id="ledger" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Entity growth versus intelligence growth
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask does not treat market aggregates as new companies. Unknown is not zero.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Net-new canonical organizations', ledger.NET_NEW_CANONICAL_ORGANIZATIONS],
              ['Net-new state identities', ledger.NET_NEW_STATE_IDENTITIES],
              ['Existing organizations enriched', ledger.EXISTING_ORGANIZATIONS_ENRICHED],
              ['New evidence rows', ledger.NEW_EVIDENCE_ROWS],
              ['New public research surfaces', ledger.NEW_PUBLIC_RESEARCH_SURFACES],
            ] as const
          ).map(([label, row]) => (
            <li
              key={label}
              className="rounded-2xl border p-4"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                {label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {row.value == null ? row.status : row.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {row.explanation}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <h2 id="starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Questions you can ask
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

      <section className="mt-12" aria-labelledby="can-research">
        <h2 id="can-research" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What TrustHub can research
        </h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.hubs.map((hub) => (
            <li key={hub.hub_id}>
              {hub.hub_name}: {hub.verified_facts[0]}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="cannot-establish">
        <h2 id="cannot-establish" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What the sources do not establish
        </h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>Registration is not quality. Bond is not endorsement. Insurance is not safety. 160,923 L&amp;I rows are not 160,923 net-new companies.</li>
          <li>AFH is not ALF. ALF is not a skilled nursing facility. DSHS is not CMS. Do not publish one Washington senior-providers number.</li>
          <li>UTC household-goods authority is not FMCSA interstate authority. A USDOT number is not interstate operating authority.</li>
          <li>HMDA is not a Washington mortgage-license roster. Denial rate is not quality. A complaint is not a violation.</li>
          <li>A Washington principal office is not Washington state-RIA registration. 306 is not 645. 645 is not a live roster.</li>
          <li>2,924 is not a live Washington insurer count. Producer is not an agency. Restricted is not zero.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="catalog">
        <h2 id="catalog" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Washington evidence catalog
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask consumes specialist snapshot facts. It does not invent Ask-owned Washington denominators.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: ASK_BRAND.border }}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Washington specialist evidence catalog</caption>
            <thead className="bg-slate-100">
              <tr>
                <th scope="col" className="p-3">Evidence</th>
                <th scope="col" className="p-3">Hub</th>
                <th scope="col" className="p-3">Grain</th>
                <th scope="col" className="p-3">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {manifest.evidence_catalog.map((row) => (
                <tr key={row.row} className="border-t align-top" style={{ borderColor: ASK_BRAND.border }}>
                  <th scope="row" className="p-3 font-semibold">
                    {row.row}
                  </th>
                  <td className="p-3">{row.hub}</td>
                  <td className="p-3">{row.grain}</td>
                  <td className="p-3 text-slate-600">{row.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="cross-hub">
        <h2 id="cross-hub" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Cross-hub Washington situations
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask can point to more than one specialist. It does not publish a composite score, Trust Score,
          or ranked “best providers” list.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {CROSS_HUB.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="coverage">
        <h2 id="coverage" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What the network still does not know
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Different hubs have different official source coverage. Missing evidence is unknown, not zero.
          Restricted is not zero. Search-only is not zero. Washington cities and counties are not an
          approved local phase.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.coverage_gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
