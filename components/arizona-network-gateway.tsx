import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { AZ_PUBLICATION_MANIFEST } from '@/lib/network/az-network';

const STARTERS = [
  { q: 'Is this Arizona contractor licensed?', hub: 'Contractor' },
  { q: 'Can I see disciplinary or unlicensed-contractor records in Arizona?', hub: 'Contractor' },
  { q: 'How do I find an assisted living home in Arizona?', hub: 'Senior' },
  { q: 'Is an Arizona assisted living home the same as a nursing home?', hub: 'Senior' },
  { q: 'How much mortgage activity was reported in Arizona?', hub: 'Lender' },
  { q: 'How do I verify an Arizona mortgage broker?', hub: 'Lender' },
  { q: 'Is this Arizona investment adviser registered?', hub: 'Investor' },
  { q: 'How many SEC adviser firms are based in Arizona?', hub: 'Investor' },
  { q: 'How do I verify an Arizona insurance agency?', hub: 'Insurance' },
  { q: 'How many insurance agencies are licensed in Arizona?', hub: 'Insurance' },
  { q: 'Does Arizona license moving companies?', hub: 'Move' },
  { q: 'How do I verify a mover taking me from Arizona to another state?', hub: 'Move' },
] as const;

export function ArizonaNetworkGateway({
  manifest,
  releaseGatePassed,
}: {
  manifest: typeof AZ_PUBLICATION_MANIFEST;
  releaseGatePassed: boolean;
}) {
  const ledger = manifest.expansion_ledger;
  const liveSpecialists = manifest.hubs.filter((h) => h.publication_status === 'live').length;

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
        <span>Arizona</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        Research Arizona Providers &amp; Regulatory Records
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Explore official evidence across contractors, senior care, mortgage lending, investment advisers,
        insurance verification, and moving. AskTrustHub is the discovery and routing layer. Specialist hubs
        own the Arizona evidence they publish. No paid placements. No Trust Score.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Organizations and evidence records stay separate. Missing, search-only, request-gated, and paid
        sources are unknown, not zero. Arizona research is state-level. This page does not publish Arizona
        city or county gateways.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {manifest.conceptual_statement}
      </p>
      {releaseGatePassed ? (
        <p className="mt-4 text-sm">
          {liveSpecialists} specialist Arizona research pages are published. Insurance and Move are honest
          research paths without dedicated Arizona specialist pages.
        </p>
      ) : (
        <p className="mt-4 max-w-2xl rounded-xl border px-4 py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          The Arizona release gate has not passed ({manifest.release_gate.blocker ?? 'pending specialist'}).
        </p>
      )}

      <section className="mt-10" aria-labelledby="intel-strip">
        <h2 id="intel-strip" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Arizona evidence depth — not one records number
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          These figures are specialist-owned and not comparable. They are not a ranking, a Trust Score, or
          one Arizona-provider denominator.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {manifest.intelligence_strip.map((row) => (
            <li
              key={row.hub_id}
              className="rounded-2xl border p-4"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <p className="text-sm font-semibold whitespace-normal break-words" style={{ color: ASK_BRAND.navy }}>
                {row.display}
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {row.grain}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="hub-cards">
        <h2 id="hub-cards" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Specialist Arizona research
        </h2>
        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {manifest.hubs.map((hub) => (
            <li
              key={hub.hub_id}
              className="rounded-2xl border p-5"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
                {hub.coverage_type.replace(/_/g, ' ')}
              </p>
              <h3 className="mt-2 text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                {hub.hub_name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {hub.what_research}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                <strong>Regulator / identity.</strong> {hub.primary_regulator}. {hub.primary_identity}.
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                <strong>Strongest datasets.</strong> {hub.strongest_datasets}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                <strong>Missing / limited.</strong> {hub.coverage_limitation}
              </p>
              <p className="mt-2 text-xs" style={{ color: ASK_BRAND.ink }}>
                Source clock: {hub.source_clock}
              </p>
              <a
                href={hub.canonical_state_url}
                className="mt-4 inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
                style={{ color: ASK_BRAND.indigo }}
              >
                Open {hub.hub_name} Arizona research
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="az-findings">
        <h2 id="az-findings" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Arizona network findings
        </h2>
        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {manifest.findings.map((f) => (
            <li key={f.id} className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border }}>
              <h3 className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {f.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="az-ledger">
        <h2 id="az-ledger" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Entity growth versus intelligence growth
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Network ledger status: {ledger.status}. Compatible grains are summed. HMDA applications, CFPB
          complaints, and ACC index rows are not organizations.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="rounded-xl border p-4" style={{ borderColor: ASK_BRAND.border }}>
            <p className="text-sm font-semibold">Net-new canonical organizations</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: ASK_BRAND.navy }}>
              {ledger.NET_NEW_CANONICAL_ORGANIZATIONS.value}
            </p>
          </li>
          <li className="rounded-xl border p-4" style={{ borderColor: ASK_BRAND.border }}>
            <p className="text-sm font-semibold">Net-new state identities</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: ASK_BRAND.navy }}>
              {ledger.NET_NEW_STATE_IDENTITIES.value.toLocaleString('en-US')}
            </p>
            <p className="mt-1 text-xs">Senior AZ-SEN-001 only.</p>
          </li>
          <li className="rounded-xl border p-4" style={{ borderColor: ASK_BRAND.border }}>
            <p className="text-sm font-semibold">Existing organizations enriched</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: ASK_BRAND.navy }}>
              {ledger.EXISTING_ORGANIZATIONS_ENRICHED.value.toLocaleString('en-US')}
            </p>
          </li>
          <li className="rounded-xl border p-4" style={{ borderColor: ASK_BRAND.border }}>
            <p className="text-sm font-semibold">New public research surfaces</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: ASK_BRAND.navy }}>
              {ledger.NEW_PUBLIC_RESEARCH_SURFACES.value}
            </p>
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          New evidence rows are {ledger.NEW_EVIDENCE_ROWS.status} and are not summed across incompatible
          grains: {ledger.NEW_EVIDENCE_ROWS.families.join(' · ')}.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="az-starters">
        <h2 id="az-starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Try an Arizona research question
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {STARTERS.map((row) => (
            <li key={row.q}>
              <Link
                href={`/?q=${encodeURIComponent(row.q)}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 whitespace-normal break-words"
                style={{ color: ASK_BRAND.indigo }}
              >
                {row.q}
              </Link>
              <span className="sr-only"> {row.hub}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="az-does-not">
        <h2 id="az-does-not" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          What the sources do not establish
        </h2>
        <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          <li>A license is not quality. No discipline found is not a clean record.</li>
          <li>HMDA is not a lender license. A complaint is not a violation. Denial rate is not quality.</li>
          <li>An Arizona principal office is not Arizona state adviser registration.</li>
          <li>ACC business registration is not a mover license. A USDOT number is not interstate authority by itself.</li>
          <li>A state assisted living home is not a CMS nursing home.</li>
          <li>Search-only is not zero. Requestable is not acquired. Paid is not unavailable.</li>
        </ul>
      </section>
    </main>
  );
}
