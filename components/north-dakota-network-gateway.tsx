import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { ND_PUBLICATION_MANIFEST as manifest } from '@/lib/network/north-dakota-network';
import { ASK_PUBLISHED_STATE_CATALOG } from '@/lib/network/published-ask-states';

export function NorthDakotaNetworkGateway() {
  const networkCount = ASK_PUBLISHED_STATE_CATALOG.length;
  return (
    <main className="container-page overflow-x-clip py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link>
        <span> / North Dakota</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>
        North Dakota statewide research / six specialist sources
      </p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>
        North Dakota specialist research
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed">
        Choose a specialist for North Dakota source evidence. Each hub owns its records, identities, and
        source clocks. People, businesses, branches, facilities, permits, applications, complaints, and
        enforcement remain separate. Ask does not combine them into a provider total. North Dakota is one
        of {networkCount} states in the published Ask catalog.
      </p>
      <section className="mt-10" aria-labelledby="nd-hubs">
        <h2 id="nd-hubs" className="text-xl font-semibold">Choose a North Dakota specialist source</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {manifest.hubs.map((hub) => (
            <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
              <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
              <p className="mt-2 text-sm leading-relaxed">{hub.summary}</p><p className="mt-2 text-sm leading-relaxed">{hub.grain}</p>
              <details className="mt-3 text-xs leading-relaxed">
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clock, grain, and coverage limits</summary>
                <p><strong>Source clock:</strong> {hub.clock}</p>
                <p className="mt-2"><strong>Source grain:</strong> {hub.grain}</p>
                <p className="mt-2"><strong>Material gap:</strong> {hub.gap}</p>
                <p className="mt-2 font-semibold">Authoritative sources</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {hub.sources.map((source) => <li key={source.url}><a className="underline" href={source.url}>{source.label}</a></li>)}
                </ul>
              </details>
              <a href={hub.url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: ASK_BRAND.navy }}>
                Open {hub.hub_name} North Dakota
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10 max-w-3xl text-sm leading-relaxed" aria-labelledby="nd-limits">
        <h2 id="nd-limits" className="text-xl font-semibold">North Dakota evidence limits</h2>
        <p className="mt-3">NOT_ACQUIRED means a source-native population was not acquired; it does not mean the population is empty. Source-specific observations stay with their originating hub.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>State authority and federal FMCSA/USDOT records are separate; a permit application is not operating authority.</li>
          <li>Contractor businesses, specialized trade credentials, and qualifying people are separate classes.</li>
          <li>HMDA market activity is not mortgage licensing. Appointments are relationships, not licensees.</li>
          <li>Facilities, administrators, inspections, CMS certification, complaints, and enforcement have separate grains.</li>
          <li>State IA, federal notice, ERA, IAR persons, broker-dealers, and agents remain separate registration populations.</li>
          <li>Combined North Dakota provider totals, ratings, Trust Scores, rankings, and winners are not established.</li>
          <li>This gateway covers the state only; county and local routes are not provided.</li>
        </ul>
      </section>
    </main>
  );
}
