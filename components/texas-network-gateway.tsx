import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { TX_PUBLICATION_MANIFEST } from '@/lib/network/tx-network';

const STARTERS = [
  { q: 'Is this Texas electrician licensed?', hub: 'Contractor' },
  { q: 'How do I check a general contractor in Texas?', hub: 'Contractor' },
  { q: 'How many mortgage applications were filed in Texas?', hub: 'Lender' },
  { q: 'Does this Texas lender have an SML order?', hub: 'Lender' },
  { q: 'Which insurers is this Texas agency appointed with?', hub: 'Insurance' },
  { q: 'What does a TDI complaint index mean?', hub: 'Insurance' },
  { q: 'How do I find a Texas assisted living facility?', hub: 'Senior' },
  { q: 'Is Texas HHSC the same as CMS?', hub: 'Senior' },
  { q: 'Is this Texas investment adviser registered?', hub: 'Investor' },
  { q: 'How many SEC advisers are based in Texas?', hub: 'Investor' },
  { q: 'How do I check a Texas mover?', hub: 'Move' },
  { q: 'Does a USDOT number mean this Texas mover can move me between states?', hub: 'Move' },
] as const;

const CROSS_HUB = [
  'Buying a Texas house: mortgage activity on Lender Trust Hub, then contractor and trade credentials on Contractor Trust Hub. These are separate evidence universes — not a composite score.',
  'Helping an elderly parent move: household-goods verification on Move Trust Hub and senior-care research on SeniorTrustHub. A mover authority is not a care placement.',
  'Checking a Texas insurance agency: Insurance Trust Hub for TDI appointments and complaints. Appointment count is not quality, and a complaint is not a violation.',
  'A contractor working in an assisted-living building: Contractor Trust Hub for TDLR/TSBPE credentials and SeniorTrustHub for the facility class. A trade license is not an ALF license.',
] as const;

export function TexasNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof TX_PUBLICATION_MANIFEST;
  releaseGatePassed: boolean;
}) {
  const liveCount = manifest.hubs.filter((h) => h.publication_status === 'live').length;

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
        <span>Texas</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Research Texas Providers &amp; Regulatory Records
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, insurance, mortgage lenders, movers, investment
        advisers, and senior care. AskTrustHub is the discovery and routing layer. Specialist hubs own
        the Texas evidence. No paid placements. No Trust Score. No blanket “verified providers”
        statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Liberal inclusion, conservative attribution, transparent coverage: missing evidence blocks that
        metric, not the whole state. Unavailable evidence is unknown, not zero. Texas research is
        state-level. This page does not publish Texas city or county gateways.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Texas pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable Texas gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">All six specialist Texas research pages are published.</p>
      )}

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What official Texas evidence the network covers
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score,
          or one Texas-provider denominator.
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
          Specialist Texas research
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
                      Open {hub.hub_name} Texas
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Texas page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in Texas
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="tx-different">
        <h2 id="tx-different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Texas different
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_texas_different.map((row) => (
            <li key={row}>{row}</li>
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
          <li>Texas has no statewide general-contractor license. TDLR, TSBPE, and CMBL are different universes. Vendor is not a license.</li>
          <li>Appointment count is not quality. A TDI complaint is not a violation. The TDI complaint index is not a TrustHub score.</li>
          <li>HMDA is not a Texas mortgage-license roster. An NMLS ID is not current Texas authority by itself. Denial rate is not quality.</li>
          <li>TxDMV household-goods authority is not FMCSA interstate authority. A USDOT number is not interstate operating authority. A tow company is not a household-goods mover.</li>
          <li>A Texas principal office is not Texas state-RIA registration. ERA is not an RIA. Broker-dealer is not an investment adviser.</li>
          <li>HHSC is not CMS. Assisted living is not a nursing home. Do not sum overlapping HCSSA labels.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="catalog">
        <h2 id="catalog" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Texas evidence catalog
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask consumes specialist snapshot facts. It does not invent Ask-owned Texas denominators.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: ASK_BRAND.border }}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Texas specialist evidence catalog</caption>
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
                  <td className="p-3 text-slate-600">{row.important_limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="cross-hub">
        <h2 id="cross-hub" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Cross-hub Texas situations
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
          Texas cities and counties are deferred; this gateway has no county routes.
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
