import {AskQueryForm} from '@/components/ask-query-form';
import { NetworkAskResult } from '@/components/network-ask-result';
import { PageHeader } from '@/components/page-header';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import type { Metadata } from 'next';
import { GuidedResearch } from '@/components/guided-research';
import { createGuidedSession } from '@/lib/guided-research/session';
import { buildSeniorClassPreviewResult } from '@/lib/guided-research/specialists';
import { buildAskResearchRoute } from '@/lib/network/ask-research-route';
import { ResearchRouteCard } from '@/components/ask-research-route-card';
import {AskRouteAnalytics} from '@/components/ask-route-analytics';
import {observeAskRoute} from '@/lib/network/ask-intel-observability';
import {recordSearchObservation} from '@/lib/control-plane/product-events';
import {after} from 'next/server';
import {decideAskExecution} from '@/lib/network/execution-decision';
import {validateAskQuestion} from '@/lib/network/ask-request';
import {resolveAskNameState} from '@/lib/network/name-candidates/page-state';
import {createFixtureAdaptersForScenario,fixtureModeEnabled} from '@/lib/network/name-candidates/fixtures';
import {NameCandidateResults} from '@/components/name-candidate-results';
import {recordNameCandidateSearch} from '@/lib/control-plane/product-events';

export const revalidate = 3600;

export async function generateMetadata({searchParams}:{searchParams:Promise<{q?:string|string[]}>}):Promise<Metadata>{const {q}=await searchParams;const clean=(typeof q==='string'?q:'').replace(/[<>\u0000-\u001f]/g,' ').trim().slice(0,90);return {title:{absolute:clean?`Research: ${clean} | Ask Trust Hub`:'Ask the TrustHub Network'},description:clean?`Source-backed specialist research route for: ${clean}`:'Research the TrustHub specialist network.',robots:{index:false,follow:true}}}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string|string[]; hub?: string|string[]; interpret?: string|string[] }>;
}) {
  const { q, hub, interpret } = await searchParams;
  let query='',inputError='';
  if(q!==undefined){try{query=validateAskQuestion(q);}catch{inputError='Enter one question of up to 500 characters, then try again.';}}
  const route=query?buildAskResearchRoute(query):null;
  const decision=query?decideAskExecution(query,route!.plan):null;
  // TH-SEARCH-R1-019A: ONE authoritative name-candidate decision. A supplied business/provider name
  // is searched across the network first -- no hub selection, identifier or repeated name required.
  // `hub` is only ever a real user-selected filter chip; an inferred industry is a display hint.
  const nameState=query&&route?await resolveAskNameState({query,plan:route.plan,selectedHub:typeof hub==='string'?hub:null,interpretAs:typeof interpret==='string'?interpret:null},fixtureModeEnabled()?{adapters:createFixtureAdaptersForScenario()}:{}):null;
  const nameResults=nameState?.mode==='NAME_RESULTS'?nameState:null;
  if(nameResults)after(()=>recordNameCandidateSearch(nameResults.response));
  // Once a name search is the effective operation it is ALWAYS what renders -- candidates, a miss, a
  // timeout, an unsupported source or an incomplete page. It never falls back into the guided/legacy
  // questionnaire and never triggers a second cohort retrieval; the category reading is reachable only
  // through the explicit labeled action (interpret=category).
  const showNameCandidates=Boolean(nameResults);
  const refuseSecuritiesAdvice=Boolean(route?.plan.reasonCodes.includes('UNSUPPORTED_SECURITIES_ADVICE'));
  const guided=query&&!showNameCandidates&&!route?.journey&&!refuseSecuritiesAdvice&&decision?.mode!=='PLACE_LENS'?createGuidedSession(query):null;
  // TH-DISCOVERY-RESET-001C: real per-class provider previews for a genuinely ambiguous senior
  // care request (e.g. "senior care Florida") must be present on this first server-rendered
  // paint -- the client only re-runs the specialist on specific follow-up actions, never on the
  // very first load of an ambiguous class with no chosen setting yet.
  const seniorPreview=guided?await buildSeniorClassPreviewResult(guided):null;
  const observation=route?observeAskRoute(route):null;
  if(observation && !showNameCandidates && (route?.journey || (!guided&&!route?.canExecute))) after(()=>recordSearchObservation(observation));
  return (
    <>
      <PageHeader
        label="Ask"
        title="Ask the TrustHub Network"
        description="One question, routed to the specialist systems that own the evidence. Ask does not invent regulatory facts."
      />
      <div className="container-page py-10 sm:py-14">
        <AskQueryForm query={query}/>
        {inputError?<p role="alert" className="mb-6 rounded-xl border p-4">{inputError}</p>:null}
        {nameResults?<NameCandidateResults query={query} initial={nameResults.response} alternate={nameResults.alternate}/>:null}
        {!showNameCandidates&&route&&observation?<><AskRouteAnalytics observation={observation} terminal={Boolean(route.journey||(!guided&&!route.canExecute))}/>{!guided?<ResearchRouteCard route={route}/>:null}</>:null}
        {showNameCandidates ? null : query ? (route?.journey ? null : guided ? <GuidedResearch key={query} query={query} initialSession={guided} initialResult={seniorPreview} routeDestinationHrefs={[]} /> : decision?.executionAllowed||decision?.mode==='PLACE_LENS' ? <NetworkAskResult query={query} hideInterpretation /> : null) : (
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
