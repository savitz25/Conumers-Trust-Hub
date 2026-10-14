import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { RI_PUBLICATION_MANIFEST as manifest } from '@/lib/network/rhode-island-network';

export function RhodeIslandNetworkGateway() {
  return (
    <main className="container-page overflow-x-clip py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link><span> / Rhode Island</span></nav>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>Statewide research / six specialist sources</p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>Rhode Island specialist research</h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed">Choose a specialist for Rhode Island source evidence. Each hub owns its records, source clocks, and population definitions. Companies, people, branches, facilities, applications, authority, complaints, and enforcement remain separate. Ask does not add these records into a combined provider total.</p>
      <section className="mt-10" aria-labelledby="ri-hubs"><h2 id="ri-hubs" className="text-xl font-semibold">Choose a Rhode Island specialist source</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">{manifest.hubs.map((hub) => <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
          <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3><p className="mt-2 text-sm leading-relaxed">{hub.summary}</p>
          <details className="mt-3 text-xs leading-relaxed"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clock and coverage limits</summary><p><strong>Source clock:</strong> {hub.clock}</p><p className="mt-2"><strong>Source grain:</strong> {hub.grain}</p><p className="mt-2"><strong>Material gap:</strong> {hub.gap}</p><p className="mt-2 font-semibold">Authoritative sources</p><ul className="mt-1 list-disc space-y-1 pl-4">{hub.sources.map((source) => <li key={source.url}><a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></details>
          <a href={hub.url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: ASK_BRAND.navy }}>Open {hub.hub_name} Rhode Island</a>
        </li>)}</ul>
      </section>
      <section className="mt-10 max-w-3xl text-sm leading-relaxed" aria-labelledby="ri-limits"><h2 id="ri-limits" className="text-xl font-semibold">Rhode Island evidence limits</h2><p className="mt-3">NOT_ACQUIRED means a population was not acquired; it does not mean the population is empty. Follow a specialist link for current source-level scope, records, and clocks.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5"><li>The partial quarterly CRLB file is not a full active-contractor census; the paid $100 roster was declined.</li><li>HMDA is market activity, not lender licensing. A producer appointment is a relationship record, not another licensee.</li><li>Business, person, branch, facility, application, and service-provider records remain at source grain. A complaint or survey is not an enforcement finding.</li><li>Rhode Island intrastate and federal interstate mover authority remain separate.</li><li>Ask publishes statewide research only. County and local routes are not provided.</li><li>Combined Rhode Island totals, provider rankings, ratings, and Trust Scores are not established.</li></ul>
      </section>
    </main>
  );
}
