import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { CA_PUBLICATION_MANIFEST } from '@/lib/network/ca-network';

const STARTERS = [
  { q: 'How do I verify a California contractor?', hub: 'Contractor' },
  { q: 'What does CLEAR mean on CSLB?', hub: 'Contractor' },
  { q: 'What mortgage activity do you have for California?', hub: 'Lender' },
  { q: 'What CalHFA help might apply?', hub: 'Lender' },
  { q: 'What does California insurance enforcement show?', hub: 'Insurance' },
  { q: 'Does an IMR mean my insurer violated the law?', hub: 'Insurance' },
  { q: 'Find senior-care research in California.', hub: 'Senior' },
  { q: 'Is an RCFE the same thing as a nursing home?', hub: 'Senior' },
  { q: 'Find a California investment adviser.', hub: 'Investor' },
  { q: 'Does a California principal office mean DFPI registration?', hub: 'Investor' },
  { q: 'How do I verify a mover inside California?', hub: 'Move' },
  { q: 'Can the same mover take me from California to Nevada?', hub: 'Move' },
] as const;

const CROSS_HUB = [
  'Buying a California house: mortgage activity on Lender Trust Hub, then contractor license research on Contractor Trust Hub. These are separate evidence universes — not a composite score.',
  'Helping an elderly parent move: household-goods verification on Move Trust Hub and senior-care research on SeniorTrustHub. A mover license is not a care placement.',
  'Wildfire home insurance: Insurance Trust Hub for DMHC/CDI/FAIR Plan context. Residual-market access is not the entire market.',
  'A contractor renovating an RCFE: Contractor Trust Hub for CSLB status and SeniorTrustHub for the facility class. A contractor license is not an RCFE license.',
] as const;

export function CaliforniaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof CA_PUBLICATION_MANIFEST;
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
        <span>California</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Research California with the Trust Hub Network
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across movers, mortgage lenders, insurance, senior care, contractors,
        and investment advisers. AskTrustHub helps consumers discover and navigate the specialist
        research hubs. No paid placements. No Trust Score. No blanket “verified providers” statement.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Liberal inclusion, conservative attribution, transparent coverage: missing evidence blocks that
        metric, not the whole state. Unavailable evidence is unknown, not zero. California research is
        state-level. This page does not publish California county gateways.
      </p>
      {!releaseGatePassed ? (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          {liveCount} specialist California pages are published. The six-hub release gate has not passed
          ({manifest.release_gate.blocker ?? 'pending specialist'}), so this network gateway does not claim
          a complete six-hub rollout and is not the public indexable California gateway.
        </p>
      ) : (
        <p className="mt-4 text-sm">All six specialist California research pages are published.</p>
      )}

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist California research
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
                  {hub.verified_facts.slice(0, 3).map((t) => (
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
                      Open {hub.hub_name} California
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center text-sm font-medium">
                      California page not yet published
                    </span>
                  )}
                  <Link
                    href={`/ask?q=${encodeURIComponent(hub.routing_intents[0] ?? hub.topic)}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                  >
                    Ask about {hub.hub_name} in California
                  </Link>
                </div>
              </li>
            );
          })}
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
          <li>
            ContractorTrustHub has acquired 75,572 official CSLB public-data rows from the September 2,
            2026 portal stream; the stream ended before the complete renewable license file, so the full
            denominator remains unknown. CLEAR status and classifications are in that acquired stream.
          </li>
          <li>Senior: ELMS, RCFE, HCAI, HCO, and CMS overlay as separate universes.</li>
          <li>Insurance: DMHC enforcement and IMR determinations, a dated CDI health-insurer list, FAIR Plan context.</li>
          <li>Lender: HMDA 2025 California activity, CalHFA directory, CRMLA annual-report context.</li>
          <li>Investor: SEC/IARD California principal-office overlay and DFPI search context.</li>
          <li>Move: BHGS/DCA CAL-T household-mover authority, FMCSA California-HQ overlay, BHGS 19237 citations, and Maximum Rate Tariff 4.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="cannot-establish">
        <h2 id="cannot-establish" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What the sources do not establish
        </h2>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>Acquired CSLB rows are not the complete California contractor universe. CLEAR is not TrustHub verified.</li>
          <li>An RCFE is not a nursing home. Separate senior universes are not one provider count.</li>
          <li>
            An IMR does not mean an insurer violated the law. DMHC is not CDI. The dated 28-company CDI
            health-insurer list is not all California insurers.
          </li>
          <li>HMDA is not a license roster. CalHFA participation is not an endorsement.</li>
          <li>A California principal office is not DFPI registration. SEC RIA is not state RIA.</li>
          <li>CAL-T is not USDOT. A California mover license is not interstate authority. A citation is not a revocation. A tariff is not an actual price. A license is not confirmed current insurance.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="cross-hub">
        <h2 id="cross-hub" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Cross-hub California situations
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
          California is a multi-source research product
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Different hubs have different official source coverage. Some official data is unavailable or
          partial. The specialist pages show exactly what each source establishes. Missing evidence is
          not zero. California counties are deferred; this gateway has no county routes.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>Move: complete CAL-T roster SOURCE_NOT_ACQUIRED; licensed-mover denominator UNKNOWN; complaint bulk history not acquired</li>
          <li>Lender: current CRMLA bulk roster not acquired</li>
          <li>Insurance: complete CDI authorized-insurer bulk roster not claimed from the 28-company health list</li>
          <li>Senior: ARF researched not published; no combined senior-provider denominator</li>
          <li>Contractor: truncated CSLB stream; complete renewable-license denominator unknown</li>
          <li>Investor: state-RIA bulk roster not acquired; DFPI enforcement bulk not acquired</li>
        </ul>
      </section>
    </main>
  );
}
