import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { NE_PUBLICATION_MANIFEST as manifest, neCaveat } from '@/lib/network/ne-network';

export function NebraskaNetworkGateway() {
  return <main className="container-page overflow-x-clip py-10 sm:py-14">
    <nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link><span> / Nebraska</span></nav>
    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>Statewide research / six specialist sources</p>
    <h1 className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>Nebraska specialist research</h1>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed">Choose a specialist for Nebraska source evidence. Each hub owns its records, identity rules, and source clock. Licenses, people, facilities, firms, and market observations stay separate. This page does not combine them into a provider total.</p>
    <section className="mt-10" aria-labelledby="ne-hubs"><h2 id="ne-hubs" className="text-xl font-semibold">Choose a Nebraska specialist source</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">{manifest.hubs.map((hub) => <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
        <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
        <p className="mt-2 text-sm leading-relaxed">{hub.summary}</p>
        <details className="mt-3 text-xs leading-relaxed"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clock and coverage limits</summary><p>{hub.clock}</p><p className="mt-2">{hub.gap}</p></details>
        <a href={hub.url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: ASK_BRAND.navy }}>Open {hub.hub_name} Nebraska</a>
      </li>)}</ul>
    </section>
    <section className="mt-10 max-w-3xl text-sm leading-relaxed"><h2 className="text-xl font-semibold">Search and evidence limits</h2><p className="mt-3">{neCaveat()} Nebraska-specific provider searches are not executed by Ask. Follow the specialist link for source-level research. A missing roster is not proof that a record does not exist.</p><ul className="mt-3 list-disc space-y-2 pl-5">
      <li>State authority, federal authority, license, registration, person, company, branch, facility, and HMDA activity remain separate.</li>
      <li>Omaha and Lincoln are geography only. This gateway publishes no local routes.</li>
      <li>Ask does not show a combined Nebraska census, ratings, Trust Scores, or provider rankings.</li>
    </ul></section>
  </main>;
}
