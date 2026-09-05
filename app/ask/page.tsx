import { NetworkAskResult } from '@/components/network-ask-result';
import { PageHeader } from '@/components/page-header';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import type { Metadata } from 'next';
import { GuidedResearch } from '@/components/guided-research';
import { createGuidedSession } from '@/lib/guided-research/session';
import { buildAskResearchRoute } from '@/lib/network/ask-research-route';
import { ResearchRouteCard } from '@/components/ask-research-route-card';

export const revalidate = 3600;

export async function generateMetadata({searchParams}:{searchParams:Promise<{q?:string}>}):Promise<Metadata>{const {q}=await searchParams;const clean=(q??'').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,90);return {title:{absolute:clean?`Research: ${clean} | Ask Trust Hub`:'Ask the TrustHub Network'},description:clean?`Source-backed specialist research route for: ${clean}`:'Research the TrustHub specialist network.',robots:{index:false,follow:true}}}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const route=query?buildAskResearchRoute(query):null;
  const guided=query&&!route?.journey?createGuidedSession(query):null;
  return (
    <>
      <PageHeader
        label="Ask"
        title="Ask the TrustHub Network"
        description="One question, routed to the specialist systems that own the evidence. Ask does not invent regulatory facts."
      />
      <div className="container-page py-10 sm:py-14">
        <form action="/ask" method="get" className="mb-10 max-w-2xl" role="search" aria-label="Ask the TrustHub Network">
          <label htmlFor="ask-q" className="sr-only">
            What do you want to know?
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="ask-q"
              name="q"
              defaultValue={query}
              placeholder="What do you want to know?"
              className="min-h-12 flex-1 rounded-xl border px-4"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: ASK_BRAND.indigo }}
            >
              Ask
            </button>
          </div>
        </form>
        {route?<ResearchRouteCard route={route}/>:null}
        {query ? (route?.journey ? null : guided ? <GuidedResearch query={query} initialSession={guided} routeDestinationHrefs={route?.destinations.map(row=>row.href)??[]} /> : <NetworkAskResult query={query} hideInterpretation />) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {[
              'Show active roofing contractors in Broward County.',
              'Show nursing homes in Palm Beach County.',
              'Show Florida RIAs reporting between $1 billion and $10 billion RAUM.',
              'Find CRD 166089.',
              'Show insurance agencies credentialed in Florida.',
              'Find NPN 10391484.',
              "I'm buying a home in Broward County. What should I research?",
              'What does TrustHub know about Broward?',
            ].map((ex) => (
              <li key={ex}>
                <a
                  href={`/ask?q=${encodeURIComponent(ex)}`}
                  className="inline-flex min-h-11 items-center rounded-full border px-3"
                  style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
                >
                  {ex}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
