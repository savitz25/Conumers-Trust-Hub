import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { AR_PUBLICATION_MANIFEST as manifest } from '@/lib/network/ar-network';

export function ArkansasNetworkGateway() {
  return <main className="container-page overflow-x-clip py-10 sm:py-14">
    <nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link><span> / Arkansas</span></nav>
    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ASK_BRAND.indigo }}>Statewide research / six specialist sources</p>
    <h1 className="mt-2 text-3xl font-semibold" style={{ color: ASK_BRAND.navy }}>Arkansas specialist research</h1>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed">Choose a specialist for Arkansas source evidence. Each hub owns its records and source clock. Ask does not combine license, person, facility, firm or market rows into a provider total, and it does not rank providers.</p>
    <section className="mt-10" aria-labelledby="ar-hubs"><h2 id="ar-hubs" className="text-xl font-semibold">Choose a specialist</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">{manifest.hubs.map((hub) => <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
        <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
        <p className="mt-2 text-sm leading-relaxed">{hub.summary}</p>
        <details className="mt-3 text-xs leading-relaxed"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clock and limits</summary><p>{hub.clock}</p><p className="mt-2">{hub.gap}</p></details>
        <a href={hub.url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: ASK_BRAND.navy }}>Open {hub.hub_name} Arkansas</a>
      </li>)}</ul>
    </section>
    <section className="mt-10 max-w-3xl text-sm leading-relaxed"><h2 className="text-xl font-semibold">Keep the evidence in context</h2><ul className="mt-3 list-disc space-y-2 pl-5">
      <li>Cross-hub record total: undefined. Missing evidence is unknown, never zero.</li>
      <li>State and federal authority, company and person licenses, and facility and administrator licenses stay separate.</li>
      <li>Use labeled identifiers for exact research. A bare number or name alone is insufficient for an adverse finding.</li>
      <li>Arkansas city and county names are search context only. This gateway publishes no local route.</li>
    </ul></section>
  </main>;
}
