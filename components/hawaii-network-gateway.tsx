import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { HI_PUBLICATION_MANIFEST as manifest } from '@/lib/network/hawaii-network';

export function HawaiiNetworkGateway() {
  return (
    <main className="container-page overflow-x-clip py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link>
        <span> / Hawaii</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>
        Statewide research / six specialist sources
      </p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>
        Hawaii specialist research
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed">
        Choose a specialist for Hawaii source evidence. Each hub owns its records, identities,
        source clocks, and population definitions. Companies, people, branches, facilities,
        applications, authority, complaints, and enforcement remain separate. Ask does not copy
        specialist provider rows or add source records into a combined provider total.
      </p>
      <section className="mt-10" aria-labelledby="hi-hubs">
        <h2 id="hi-hubs" className="text-xl font-semibold">Choose a Hawaii specialist source</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {manifest.hubs.map((hub) => (
            <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
              <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
              <p className="mt-2 text-sm leading-relaxed">{hub.summary}</p>
              <details className="mt-3 text-xs leading-relaxed">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clock and coverage limits</summary>
                <p><strong>Source clock:</strong> {hub.clock}</p>
                <p className="mt-2"><strong>Source grain:</strong> {hub.grain}</p>
                <p className="mt-2"><strong>Material gap:</strong> {hub.gap}</p>
                <p className="mt-2 font-semibold">Authoritative sources</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {hub.sources.map((source) => (
                    <li key={source.url}><a className="underline" href={source.url}>{source.label}</a></li>
                  ))}
                </ul>
              </details>
              <a href={hub.url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: ASK_BRAND.navy }}>
                Open {hub.hub_name} Hawaii
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10 max-w-3xl text-sm leading-relaxed" aria-labelledby="hi-limits">
        <h2 id="hi-limits" className="text-xl font-semibold">Hawaii search and evidence limits</h2>
        <p className="mt-3">
          State-specific provider searches are not executed by Ask. Follow a specialist link for
          source-level research. NOT_ACQUIRED means the relevant population was not acquired; it
          does not mean the population is empty.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>HMDA is market activity, not lender licensing. An insurance appointment is a relationship record, not a license.</li>
          <li>Business, person, branch, facility, and service-provider records stay at their source grains. An inspection, survey, or complaint is not automatically an enforcement finding.</li>
          <li>Hawaii and federal carrier authority remain separate. Securities registration follows regulator jurisdiction, not principal-office geography.</li>
          <li>Ask publishes Hawaii statewide research only. County and local routes are not provided.</li>
          <li>Combined Hawaii totals are rejected. Ratings, Trust Scores, provider rankings, and winners are not established.</li>
        </ul>
      </section>
    </main>
  );
}
