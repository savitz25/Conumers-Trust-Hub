import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { IN_PUBLICATION_MANIFEST as manifest } from '@/lib/network/in-network';

function clockLine(clocks:Record<string,string|null|undefined>):string{
  return Object.entries(clocks).map(([key,value])=>`${key.replaceAll('_',' ')}: ${value??'not published'}`).join(' / ');
}
export function IndianaNetworkGateway(){
  return <main className="container-page overflow-x-clip py-10 sm:py-14">
    <nav aria-label="Breadcrumb" className="mb-5 text-sm"><Link href="/" className="inline-flex min-h-11 items-center underline">Home</Link><span> / Indiana</span></nav>
    <p className="text-xs font-semibold uppercase tracking-wider" style={{color:ASK_BRAND.indigo}}>Statewide research / six specialist sources</p>
    <h1 className="mt-2 text-3xl font-semibold" style={{color:ASK_BRAND.navy}}>Indiana specialist research</h1>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed">Choose the evidence you need. Each specialist owns its records, source clocks and limitations. Ask is a gateway to six Indiana research pages.</p>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed">DOR authority verification, plumbing credentials, DFI Mortgage Lender listings, DOI enforcement rows, senior facility classes and securities registrations have different grains. They cannot be added into one Indiana record or provider total. We do not rank or endorse providers.</p>
    <section className="mt-10" aria-labelledby="in-hubs"><h2 id="in-hubs" className="text-xl font-semibold">Choose a specialist</h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">{manifest.hubs.map(hub=><li key={hub.hub_id} className="min-w-0 rounded-2xl border p-5" style={{borderColor:ASK_BRAND.border,boxShadow:ASK_SHADOW.soft}}>
        <h3 className="text-lg font-semibold" style={{color:ASK_BRAND.navy}}>{hub.hub_name}</h3>
        <p className="mt-2 break-words text-sm font-semibold">{hub.capability_summary}</p>
        <p className="mt-2 text-sm leading-relaxed">{hub.grain}</p>
        <details className="mt-3 text-xs leading-relaxed"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Source clocks and limits</summary><p className="break-words">{clockLine(hub.source_clocks)}</p><ul className="mt-2 list-disc pl-4">{hub.gaps.map((gap,index)=><li key={index}>{gap.capability}: {gap.state}</li>)}</ul></details>
        <a href={hub.canonical_state_url} className="mt-4 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{backgroundColor:ASK_BRAND.navy}}>Open {hub.hub_name} Indiana</a>
      </li>)}</ul>
    </section>
    <section className="mt-10 max-w-3xl text-sm leading-relaxed" aria-labelledby="in-limits"><h2 id="in-limits" className="text-xl font-semibold">Keep the evidence in context</h2><ul className="mt-3 list-disc space-y-2 pl-5">
      <li>Cross-hub record total: rejected; value is null. Ask does not copy specialist rows.</li>
      <li>Source clocks differ by hub; there is no universal Indiana as-of date. Missing evidence is unknown, not zero.</li>
      <li>Indianapolis, Fort Wayne, Evansville and South Bend are search context. This gateway publishes no city or county pages.</li>
      <li>Use labeled identifiers for exact research. Bare digits are ambiguous; an individual credential is not a company profile.</li>
    </ul></section>
  </main>;
}
