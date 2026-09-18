import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { OH_PUBLICATION_MANIFEST } from '@/lib/network/oh-network';

const STARTERS = [
  { q: 'licensed contractors Ohio', hub: 'Contractor' },
  { q: 'electrical contractor Ohio', hub: 'Contractor' },
  { q: 'movers Ohio', hub: 'Move' },
  { q: 'PUCO mover Ohio', hub: 'Move' },
  { q: 'nursing homes Ohio', hub: 'Senior' },
  { q: 'assisted living Ohio', hub: 'Senior' },
  { q: 'HMDA applications Ohio 2025', hub: 'Lender' },
  { q: 'RMLA Ohio', hub: 'Lender' },
  { q: 'insurance companies Ohio', hub: 'Insurance' },
  { q: 'homeowners insurance agencies Ohio', hub: 'Insurance' },
  { q: 'investment advisers Ohio', hub: 'Investor' },
  { q: 'ERA Ohio', hub: 'Investor' },
] as const;

export function OhioNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof OH_PUBLICATION_MANIFEST;
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
        <span>Ohio</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Ohio Trust Hub Research
      </h1>
      <p className="mt-2 text-lg font-medium" style={{ color: ASK_BRAND.navy }}>
        The Trust Hub Network
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        One statewide research gateway across contractor, moving, senior care, mortgage lending, insurance, and
        investment-adviser evidence. AskTrustHub is the discovery and routing layer. Specialist hubs own the Ohio
        evidence. No paid placements. No Trust Score. No blanket “verified providers” statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, restricted, and search-only sources are unknown, not
        zero. Ohio research is statewide. Columbus, Cleveland, Cincinnati, Toledo, Akron, Dayton, and other local names
        stay on this statewide entrance; local Ohio datasets are not started.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist Ohio pages are published. The six-hub release gate has not passed (
          {manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim a complete
          six-hub rollout and is not the public indexable Ohio gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">
          All six specialist Ohio research pages are published. Ask /ohio is a catalog and research entrance, not a
          seventh copy of every specialist dataset.
        </p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist Ohio research
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {manifest.hubs.map((hub) => {
            const live = hub.publication_status === 'live';
            const strip = manifest.intelligence_strip.find((row) => row.hub_id === hub.hub_id);
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
                {strip ? (
                  <p className="mt-2 text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                    {strip.display}
                  </p>
                ) : null}
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
                      Open {hub.hub_name} Ohio
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      Ohio page not yet published
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="identifiers">
        <h2 id="identifiers" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Exact identifier research
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>OCILB EL. HV. HY. PL. RE. — contractor specialty credentials, not a company license.</li>
          <li>PUCO No. — household-goods certificate. Do not translate into USDOT or MC.</li>
          <li>ODH OH##### nursing home and OHL##### residential care facility. CMS CCN stays separate.</li>
          <li>NMLS Unique ID and Ohio DFI/RMLA identifier stay distinct. LEI is not NMLS.</li>
          <li>NAIC Company Code is not NPN.</li>
          <li>Firm CRD is not person CRD.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="different">
        <h2 id="different" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What makes Ohio different
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {manifest.what_makes_ohio_different.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="coverage">
        <h2 id="coverage" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Source coverage and limitations
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {ledger.CROSS_HUB_RECORD_TOTAL.explanation} {ledger.NEW_PUBLIC_RESEARCH_SURFACES.explanation} Search-only and
          missing sources are unknown, not zero. Source clocks differ by hub. Ask does not rank providers.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <h2 id="starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Example research questions
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {STARTERS.map((row) => (
            <li key={row.q}>
              <Link
                href={`/search?q=${encodeURIComponent(row.q)}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-2 hover:underline"
                style={{ color: ASK_BRAND.indigo }}
              >
                {row.q}
              </Link>
              <span className="ml-2 text-xs" style={{ color: ASK_BRAND.ink }}>
                {row.hub}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
