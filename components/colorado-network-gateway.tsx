import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { CO_PUBLICATION_MANIFEST } from '@/lib/network/co-network';

const STARTERS = [
  { q: 'Is this contractor licensed in Colorado?', hub: 'Contractor' },
  { q: 'Can I look up an electrical contractor in Colorado?', hub: 'Contractor' },
  { q: 'Find nursing homes in Colorado.', hub: 'Senior' },
  { q: 'Are home health agencies in Colorado the same as nursing homes?', hub: 'Senior' },
  { q: 'Can I check a mover in Colorado?', hub: 'Move' },
  { q: 'Does a Colorado moving permit mean they can haul my stuff to another state?', hub: 'Move' },
  { q: 'How much mortgage lending happened in Colorado last year?', hub: 'Lender' },
  { q: 'Which mortgage lenders are licensed in Colorado?', hub: 'Lender' },
  { q: 'How many investment advisers are registered in Colorado?', hub: 'Investor' },
  { q: 'Does a Colorado principal office mean the adviser is state-registered?', hub: 'Investor' },
  { q: 'Which insurance companies are authorized in Colorado?', hub: 'Insurance' },
  { q: "Does Colorado's complaint index mean an insurer is a bad company?", hub: 'Insurance' },
] as const;

const CROSS_HUB = [
  'Buying a Colorado house: HMDA market activity on LenderTrustHub, then electrical/plumbing credentials on Contractor Trust Hub. These are separate evidence universes — not a composite score. There is no statewide general-contractor roster.',
  'Helping an elderly parent: CMS nursing-home, home-health, and hospice classes stay separate on SeniorTrustHub, and household-goods verification on Move Trust Hub. A mover permit is not a care placement.',
  'Checking a Colorado insurance company: Insurance Trust Hub for DOI lookup, dated market-directory context, surplus-lines eligibility, and complaint ratio/index. 1,839 is not a live authorized-company count. Complaint Index is not a TrustHub score.',
  'A contractor working in a nursing home: Contractor Trust Hub for DORA EC/PC credentials and SeniorTrustHub for the CMS facility class. An electrical contractor credential is not a nursing-home license.',
] as const;

export function ColoradoNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof CO_PUBLICATION_MANIFEST;
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
        <span>Colorado</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Research Colorado Providers &amp; Regulatory Records
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, senior care, movers, mortgage lenders, investment
        advisers, and insurance. AskTrustHub is the discovery and routing layer. Specialist hubs own
        the Colorado evidence. No paid placements. No Trust Score. No blanket “verified providers”
        statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources
        are unknown, not zero. Colorado research is state-level. This page does not publish
        Colorado city or county gateways.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Colorado pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable Colorado gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">All six specialist Colorado research pages are published.</p>
      )}

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What official Colorado evidence the network covers
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one Colorado-provider denominator.
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
          Specialist Colorado research
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
                      Open {hub.hub_name} Colorado
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Colorado page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in Colorado
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="data-moat">
        <h2 id="data-moat" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Colorado data depth
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Evidence volume is not a quality score. These four buckets are not one Colorado-records
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
            <caption className="sr-only">Colorado hub identity, evidence, source, freshness, and coverage</caption>
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

      <section className="mt-12" aria-labelledby="co-different">
        <h2 id="co-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Colorado different
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_colorado_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="ledger">
        <h2 id="ledger" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Entity growth versus intelligence growth
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask does not treat market aggregates as new companies. Unknown is not zero. These ledgers
          stay per hub. They are not one Colorado-records total.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {manifest.hubs.map((hub) => {
            const row = manifest.hub_expansion_ledgers[hub.hub_id as keyof typeof manifest.hub_expansion_ledgers];
            return (
              <li
                key={hub.hub_id}
                className="rounded-2xl border p-4"
                style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
              >
                <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {hub.hub_name}
                </p>
                <p className="mt-1 text-xs tabular-nums">
                  Net-new canonical organizations: {row.NET_NEW_CANONICAL_ORGANIZATIONS ?? 'not reported'}
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {row.note}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
          {ledger.CROSS_HUB_RECORD_TOTAL.explanation} New public research surfaces:{' '}
          {ledger.NEW_PUBLIC_RESEARCH_SURFACES.value} ({ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation})
        </p>
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
          <li>7,936 active EC/PC credentials are not unique contractors and not general contractors. Colorado has no statewide general-contractor license.</li>
          <li>210 nursing homes, 222 home health agencies, and 88 hospice providers are separate CMS classes. Do not publish one Colorado senior-providers number. A CMS CCN is not a state license.</li>
          <li>A Colorado PUC household-goods permit is not FMCSA interstate authority. A USDOT number is not interstate operating authority.</li>
          <li>HMDA is not a Colorado mortgage-license roster. An MLO is not a lender company. A complaint is not a violation. Search-only is not zero.</li>
          <li>A Colorado principal office is not Colorado state-RIA registration. 740 APPROVED state IA firms are not 589 principal-office firms and not 3,673 notice filings.</li>
          <li>1,839 NAIC directory rows are not currently authorized insurers. 259 surplus identities are not admitted. DOI Complaint Ratio/Index is not a TrustHub score.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="catalog">
        <h2 id="catalog" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Colorado evidence catalog
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask consumes specialist snapshot facts. It does not invent Ask-owned Colorado denominators.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: ASK_BRAND.border }}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Colorado specialist evidence catalog</caption>
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
          Cross-hub Colorado situations
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
          Restricted is not zero. Search-only is not zero. Colorado cities and counties are not an
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
