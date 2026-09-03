import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { NJ_PUBLICATION_MANIFEST } from '@/lib/network/nj-network';

const STARTERS = [
  { q: 'Research a mover in New Jersey', hub: 'Move' },
  { q: 'Show mortgage activity in Bergen County', hub: 'Lender' },
  { q: 'Find senior-care facilities in Essex County', hub: 'Senior' },
  { q: 'Explain New Jersey insurance complaint data', hub: 'Insurance' },
  { q: 'Check New Jersey contractor regulatory evidence', hub: 'Contractor' },
  { q: 'Research an investment adviser in New Jersey', hub: 'Investor' },
] as const;

export function NewJerseyNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof NJ_PUBLICATION_MANIFEST;
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
        <span>New Jersey</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Research New Jersey with the Trust Hub Network
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across movers, mortgage lenders, insurance, senior care, contractors,
        and investment advisers. AskTrustHub helps consumers discover and navigate the specialist
        research hubs. No paid placements. No Trust Score. No blanket “verified providers” statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Liberal inclusion, conservative attribution, transparent coverage: missing evidence blocks that
        metric, not the whole state. Unavailable evidence is unknown, not zero.
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist New Jersey pages are published. The six-hub release gate has not passed,
          so this network gateway does not claim a complete six-hub rollout.
        </p>
      ) : (
        <p className="mt-4 text-sm">All six specialist New Jersey research pages are published.</p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist New Jersey research
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
                <p className="mt-1 text-sm font-medium">{hub.topic}</p>
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
                      Open {hub.hub_name} New Jersey
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      New Jersey page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in New Jersey
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="county-research">
        <h2 id="county-research" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Deep county research
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Four counties currently have deeper local research coverage. This is not a claim that all 21 New
          Jersey counties have Ask county gateways.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/new-jersey/monmouth-county"
              className="inline-flex min-h-11 w-full items-center rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
            >
              Monmouth County
            </Link>
          </li>
          <li>
            <Link
              href="/new-jersey/middlesex-county"
              className="inline-flex min-h-11 w-full items-center rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
            >
              Middlesex County
            </Link>
          </li>
          <li>
            <Link
              href="/new-jersey/somerset-county"
              className="inline-flex min-h-11 w-full items-center rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
            >
              Somerset County
            </Link>
          </li>
          <li>
            <Link
              href="/new-jersey/union-county"
              className="inline-flex min-h-11 w-full items-center rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
            >
              Union County
            </Link>
          </li>
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

      <section className="mt-12" aria-labelledby="coverage">
        <h2 id="coverage" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          New Jersey is a multi-source research product
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Different hubs have different official source coverage. Some official data is unavailable or
          partial. The specialist pages show exactly what each source establishes. Missing evidence is
          not zero.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>Move: complete NJ PM/PW/PC roster request</li>
          <li>Lender: RMLA/servicer roster</li>
          <li>Insurance: SERFF/CRIB restrictions</li>
          <li>Senior: CCRC/service-area crosswalk</li>
          <li>Contractor: PWCR and contractor attribution on statewide construction rows</li>
          <li>Investor: complete state-RIA roster</li>
        </ul>
      </section>
    </main>
  );
}
