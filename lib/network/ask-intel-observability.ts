import type { AskResearchRouteCard } from './ask-research-route.ts';
import type { GuidedResultState } from '../guided-research/contract.ts';
import type { SearchTerminalOutcome } from '../control-plane/contracts/product-event-v1.ts';
export const ASK_INTEL_OBSERVABILITY_VERSION='ask-intel-observability-v1' as const;
export type AskIntelSurface='ASK_SSR'|'GUIDED'|'CONCIERGE'|'JOURNEY';
export type ResultCountBucket='0'|'1'|'2-10'|'11-25'|'26-100'|'101-500'|'501-1000'|'1001+';
export type LatencyBucket='<100ms'|'100-250ms'|'250-500ms'|'500-1000ms'|'1-2s'|'2-5s'|'5-10s'|'10-20s'|'20s+';
export type QueryLengthBucket='0-24'|'25-49'|'50-99'|'100-249'|'250-499'|'500+';
export type AskIntelObservation={schemaVersion:typeof ASK_INTEL_OBSERVABILITY_VERSION;surface:AskIntelSurface;intent:string;hub:string;hubCount:number;entityClass:string;identifierFamily:string;requestedScopeKind:string;executionScopeKind:string;scopeResolution:string;resultState:string;executionAllowed:boolean;journeyType:string;journeyStepCount:number;destinationType:string;officialSourceOffered:boolean;resultCountBucket:ResultCountBucket;latencyBucket:LatencyBucket;queryLengthBucket:QueryLengthBucket;success:boolean};
export function bucketResultCount(v:number):ResultCountBucket{return v<=0?'0':v===1?'1':v<=10?'2-10':v<=25?'11-25':v<=100?'26-100':v<=500?'101-500':v<=1000?'501-1000':'1001+'}
export function bucketLatency(v:number):LatencyBucket{return v<100?'<100ms':v<250?'100-250ms':v<500?'250-500ms':v<1000?'500-1000ms':v<2000?'1-2s':v<5000?'2-5s':v<10000?'5-10s':v<20000?'10-20s':'20s+'}
export function bucketQueryLength(v:number):QueryLengthBucket{return v<25?'0-24':v<50?'25-49':v<100?'50-99':v<250?'100-249':v<500?'250-499':'500+'}
export function observeAskRoute(route:AskResearchRouteCard,input:{surface?:AskIntelSurface;resultState?:GuidedResultState;resultCount?:number;totalMs?:number;success?:boolean}={}):AskIntelObservation{const hubs=route.journey?.orderedHubs??route.plan.candidateHubs,destination=route.destinations[0]??route.journey?.steps[0]?.destinations[0],total=input.totalMs??route.timings.totalMs;return {schemaVersion:ASK_INTEL_OBSERVABILITY_VERSION,surface:input.surface??(route.journey?'JOURNEY':'ASK_SSR'),intent:route.plan.intent,hub:route.plan.primaryHub??'none',hubCount:hubs.length,entityClass:route.plan.entityClass?.id??'none',identifierFamily:route.plan.identifier?.type??'none',requestedScopeKind:route.scope.requestedGeography?.kind??'none',executionScopeKind:route.scope.executionGeography?.kind??'none',scopeResolution:route.scope.resolutionState,resultState:input.resultState??(route.canExecute?'ROUTE_READY':'CLARIFICATION_REQUIRED'),executionAllowed:route.canExecute,journeyType:route.journey?.journeyType??'none',journeyStepCount:(route.journey?.steps.length??0)+(route.journey?.optionalSteps.length??0),destinationType:destination?.type??'none',officialSourceOffered:[...route.destinations,...(route.journey?.steps.flatMap(s=>s.destinations)??[])].some(d=>d.owner==='OFFICIAL'),resultCountBucket:bucketResultCount(input.resultCount??0),latencyBucket:bucketLatency(total),queryLengthBucket:bucketQueryLength(route.question.length),success:input.success??true}}
export const PROHIBITED_OBSERVABILITY_KEYS=['query','question','entityName','identifierValue','streetAddress','chatTranscript','messages','nmls','usdot','crd','npn'] as const;
export function validateAskIntelObservation(value:Record<string,unknown>):string[]{const keys=Object.keys(value).map(k=>k.toLowerCase());return PROHIBITED_OBSERVABILITY_KEYS.filter(k=>keys.includes(k.toLowerCase())).map(k=>`prohibited_property:${k}`)}
export function askIntelAnalyticsProps(o:AskIntelObservation):Record<string,string|number|boolean>{return {...o}}
export function searchTerminalOutcome(o:AskIntelObservation):SearchTerminalOutcome {
  if (!o.success || ['BACKEND_UNAVAILABLE', 'TIMEOUT'].includes(o.resultState)) return 'ERROR';
  if (o.resultState === 'CLARIFICATION_REQUIRED' || !o.executionAllowed) return 'CLARIFICATION';
  if (['UNSUPPORTED_CAPABILITY', 'UNSUPPORTED_STATE_CAPABILITY', 'UNSUPPORTED_TRADE_CAPABILITY', 'INVALID_QUERY'].includes(o.resultState)) {
    return o.destinationType !== 'none' || o.officialSourceOffered ? 'FAIL_CLOSED_WITH_ACTION' : 'FAIL_CLOSED_DEAD_END';
  }
  return 'RESULTS';
}
export function searchTerminalAnalyticsProps(o:AskIntelObservation):Record<string,string|number|boolean>{
  return {schema_version:'product_event.v1',hub:o.hub,intent:o.intent,terminal_outcome:searchTerminalOutcome(o),next_action_type:o.destinationType,failure_reason:o.success?'none':o.resultState,result_count_bucket:o.resultCountBucket,duration_bucket:o.latencyBucket,route_family:'/ask',surface:o.surface};
}
export function guidedSearchTerminalOutcome(state:GuidedResultState,total:number,hasNextAction:boolean):SearchTerminalOutcome{
  if(['BACKEND_UNAVAILABLE','TIMEOUT'].includes(state))return 'ERROR';
  if(['CLARIFICATION_REQUIRED','AMBIGUOUS_IDENTITIES','IDENTITY_COLLISION'].includes(state))return 'CLARIFICATION';
  if(total>0||['SUPPORTED_RESULTS','EXACT_IDENTITY'].includes(state))return 'RESULTS';
  if(['UNSUPPORTED_CAPABILITY','UNSUPPORTED_STATE_CAPABILITY','UNSUPPORTED_TRADE_CAPABILITY','INVALID_QUERY','PUBLICATION_RESTRICTED','NO_CONFIDENT_MATCH','ZERO_MATCHING_ROWS'].includes(state))return hasNextAction?'FAIL_CLOSED_WITH_ACTION':'FAIL_CLOSED_DEAD_END';
  return hasNextAction?'FAIL_CLOSED_WITH_ACTION':'FAIL_CLOSED_DEAD_END';
}
