import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { MN_PUBLICATION_MANIFEST as manifest } from '@/lib/network/mn-network';

function clockLine(clocks: Record<string, unknown>): string {
  return Object.entries(clocks).filter(([key,value]) => !/generated|no_universal|retrieval_is_not|unavailable/i.test(key) && typeof value !== 'boolean')
    .map(([key,value]) => `${key.replaceAll('_',' ')}: ${value === null ? 'not published' : Array.isArray(value) ? value.join(' to ') : String(value)}`).join(' · ');
}

export function MinnesotaNetworkGateway() {
  return <main className="container-page overflow-x-clip py-10 sm:py-14">
    <nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link><span> / Minnesota</span></nav>
    <p className="text-xs font-semibold uppercase tracking-wider" style={{color:ASK_BRAND.indigo}}>Statewide research · six specialist sources</p>
    <h1 className="mt-2 text-3xl font-semibold" style={{color:ASK_BRAND.navy}}>Minnesota specialist research</h1>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed">Start with the type of evidence you need. Each specialist owns its records and explains its regulator, source dates and limitations. Ask is a gateway, not a seventh dataset.</p>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed">We do not rank, endorse or select providers. Licensing, activity, registration and care licenses describe different things; they are never added into a Minnesota provider total.</p>
    <section className="mt-10" aria-labelledby="mn-hubs">
      <h2 id="mn-hubs" className="text-xl font-semibold">Choose a specialist</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {manifest.hubs.map(hub => <li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{borderColor:ASK_BRAND.border,boxShadow:ASK_SHADOW.soft}}>
          <h3 className="text-lg font-semibold" style={{color:ASK_BRAND.navy}}>{hub.hub_name}</h3>
          <p className="mt-2 break-words text-sm font-semibold">{hub.capability_summary}</p>
          <p className="mt-2 text-sm leading-relaxed">{hub.grain}</p>
          <details className="mt-3 text-xs leading-relaxed">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clocks and limits</summary>
            <p className="break-words">{clockLine(hub.source_clocks)}</p>
            <ul className="mt-2 list-disc pl-4">{hub.gaps.map((gap,index) => <li key={index}>{gap.capability}: {gap.state}</li>)}</ul>
          </details>
          <a href={hub.canonical_state_url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{backgroundColor:ASK_BRAND.navy}}>Open {hub.hub_name} Minnesota</a>
        </li>)}
      </ul>
    </section>
    <section className="mt-10 max-w-3xl text-sm leading-relaxed" aria-labelledby="mn-limits">
      <h2 id="mn-limits" className="text-xl font-semibold">Keep the evidence in context</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>No combined total is published. Different source grains cannot be summed.</li>
        <li>Source clocks differ by hub. Retrieval, effective and publication dates are different; there is no Minnesota-wide as-of date.</li>
        <li>Missing evidence is unknown, not zero. No specialist records are copied into an Ask dataset.</li>
        <li>Minneapolis, Saint Paul, Duluth, Rochester and Bloomington are geography. This gateway publishes no city or county marketplaces.</li>
        <li>Use labeled identifiers for exact research. A bare number is ambiguous. An individual credential is not a business-company profile.</li>
      </ul>
    </section>
  </main>;
}
