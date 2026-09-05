import type { AskResearchPlan, AskRequestedGeography } from './research-planner.ts';
import { geographyCapability, type AskGeographyMeaning, type ExecutableGeographyKind } from './geography-capabilities.ts';
import { resolveFloridaMunicipality } from './florida-municipality-crosswalk.ts';

export type NormalizedResearchGeography={kind:ExecutableGeographyKind|'region'|'route';display:string;stateCode?:string;stateName?:string;county?:string;city?:string;zip?:string;origin?:string;destination?:string};
export type AskScopeResolutionState='EXACT'|'DETERMINISTIC_EQUIVALENT'|'CLARIFICATION_REQUIRED'|'CAPABILITY_UNSUPPORTED'|'BROADENING_REQUIRES_CONSENT'|'INVALID_GEOGRAPHY';
export type AskScopeTransformation='NONE'|'CITY_TO_COUNTY'|'CITY_TO_STATE'|'REGION_TO_COMPONENT'|'ZIP_TO_COUNTY'|'COUNTY_TO_STATE';
export type AskExecutionScope={
  version:'ask-execution-scope-v1';requestedGeography?:AskRequestedGeography;normalizedRequestedGeography?:NormalizedResearchGeography;executionGeography?:NormalizedResearchGeography;
  requestedGeographyMeaning?:AskGeographyMeaning;executionGeographyMeaning?:AskGeographyMeaning;resolutionState:AskScopeResolutionState;transformation:AskScopeTransformation;
  executionAllowed:boolean;consentRequired:boolean;disclosureRequired:boolean;disclosure?:string;reasonCodes:string[];
  userConsent?:{approved:true;requestedDisplay:string;approvedExecutionDisplay:string};
};
type ScopeConsent={approvedBroaderGeography?:NormalizedResearchGeography};

function requestedMeaning(plan:AskResearchPlan,defaultMeaning?:AskGeographyMeaning):AskGeographyMeaning|undefined{
  const q=plan.originalQuestion;
  if(/\bfrom\s+.+\s+to\s+/i.test(q))return 'ORIGIN_DESTINATION';
  if(/\bserv(?:e|es|ing)|service\s+(?:territory|area)|who\s+can\s+move/i.test(q))return 'SERVICE_TERRITORY';
  if(/\bheadquarter|based\s+in|recorded\s+address/i.test(q))return 'RECORDED_HEADQUARTERS';
  return defaultMeaning;
}

export function normalizeRequestedGeography(requested:AskRequestedGeography|undefined):NormalizedResearchGeography|undefined{
  if(!requested)return undefined;
  if(requested.kind==='route')return {kind:'route',display:requested.display,origin:requested.origin,destination:requested.destination};
  if(requested.kind==='region')return {kind:'region',display:requested.display,stateCode:requested.stateCode,stateName:requested.stateName};
  if(requested.kind==='state')return {kind:'state',display:requested.display,stateCode:requested.stateCode,stateName:requested.stateName};
  if(requested.kind==='county')return {kind:'county',display:requested.display,stateCode:requested.stateCode,stateName:requested.stateName,county:requested.county};
  if(requested.kind==='zip')return {kind:'zip',display:requested.display,zip:requested.zip,stateCode:requested.stateCode,stateName:requested.stateName};
  if(requested.kind==='city'){
    const mapped=requested.stateCode==='FL'?resolveFloridaMunicipality(requested.city??requested.display.replace(/,.*$/,'')):undefined;
    return {kind:'city',display:requested.display,stateCode:requested.stateCode,stateName:requested.stateName,city:mapped?.city??requested.city,county:mapped?.county??requested.county};
  }
  return {kind:'region',display:requested.display};
}

export function resolveResearchScope(plan:AskResearchPlan,consent:ScopeConsent={}):AskExecutionScope{
  const requested=plan.requestedGeography;const normalized=normalizeRequestedGeography(requested);
  const capability=plan.primaryHub?geographyCapability(plan.primaryHub,plan.entityClass?.id):undefined;
  const meaning=requestedMeaning(plan,capability?.meaning);
  const base={version:'ask-execution-scope-v1' as const,requestedGeography:requested,normalizedRequestedGeography:normalized,requestedGeographyMeaning:meaning,executionGeographyMeaning:meaning,transformation:'NONE' as AskScopeTransformation,consentRequired:false,disclosureRequired:false,reasonCodes:[] as string[]};
  if(!requested)return {...base,resolutionState:'EXACT',executionAllowed:true};
  if(!capability||!normalized)return {...base,resolutionState:'CAPABILITY_UNSUPPORTED',executionAllowed:false,reasonCodes:['NO_SPECIALIST_GEOGRAPHY_CAPABILITY']};
  if(meaning==='SERVICE_TERRITORY'||meaning==='ORIGIN_DESTINATION')return {...base,resolutionState:'CAPABILITY_UNSUPPORTED',executionAllowed:false,disclosureRequired:true,disclosure:capability.disclosure,reasonCodes:['SERVICE_SCOPE_NOT_SOURCE_SUPPORTED']};
  if(/\bwithin\s+\d+\s*miles?\b|\bnearby\b|\bclose\s+to\b/i.test(plan.originalQuestion))return {...base,resolutionState:'CLARIFICATION_REQUIRED',executionAllowed:false,disclosureRequired:true,disclosure:`The accepted source can filter exact recorded geography, but it does not execute the requested radius. ${capability.disclosure}`,reasonCodes:['RADIUS_FILTER_NOT_SUPPORTED']};
  if(normalized.kind==='region')return {...base,resolutionState:'CLARIFICATION_REQUIRED',executionAllowed:false,disclosureRequired:true,disclosure:'Choose a city or county inside the requested region before research runs.',reasonCodes:['REGION_COMPONENT_SELECTION_REQUIRED']};
  if(normalized.kind==='route')return {...base,resolutionState:'CAPABILITY_UNSUPPORTED',executionAllowed:false,disclosureRequired:true,disclosure:capability.disclosure,reasonCodes:['ORIGIN_DESTINATION_NOT_SUPPORTED']};
  if(capability.supportedKinds.includes(normalized.kind))return {...base,executionGeography:normalized,resolutionState:'EXACT',executionAllowed:plan.executionAllowed,disclosureRequired:true,disclosure:capability.disclosure,reasonCodes:['REQUESTED_SCOPE_EXECUTABLE']};
  if(normalized.kind==='city'&&normalized.stateCode==='FL'&&normalized.county&&capability.supportedKinds.includes('county')){
    const supported=!capability.supportedFloridaCounties||capability.supportedFloridaCounties.includes(normalized.county);
    if(supported){const execution={kind:'county' as const,display:`${normalized.county} County, Florida`,county:normalized.county,stateCode:'FL',stateName:'Florida'};return {...base,executionGeography:execution,resolutionState:'DETERMINISTIC_EQUIVALENT',transformation:'CITY_TO_COUNTY',executionAllowed:true,disclosureRequired:true,disclosure:`You asked for ${normalized.display}. Research is executed using ${execution.display} because the accepted source operates at county grain. ${capability.disclosure}`,reasonCodes:['AUTHORITATIVE_CITY_COUNTY_MAPPING','SOURCE_COUNTY_GRAIN']};}
    return {...base,resolutionState:'CAPABILITY_UNSUPPORTED',executionAllowed:false,disclosureRequired:true,disclosure:`${normalized.display} maps to ${normalized.county} County, but this specialist contract does not publish that county cohort. ${capability.disclosure}`,reasonCodes:['KNOWN_CITY_COUNTY','COUNTY_CAPABILITY_NOT_PUBLISHED']};
  }
  if(['city','county','zip'].includes(normalized.kind)&&capability.supportedKinds.includes('state')&&normalized.stateCode){
    const state={kind:'state' as const,display:normalized.stateName??normalized.stateCode,stateCode:normalized.stateCode,stateName:normalized.stateName};
    if(consent.approvedBroaderGeography?.kind==='state'&&consent.approvedBroaderGeography.stateCode===normalized.stateCode)return {...base,executionGeography:state,resolutionState:'BROADENING_REQUIRES_CONSENT',transformation:normalized.kind==='county'?'COUNTY_TO_STATE':'CITY_TO_STATE',executionAllowed:true,consentRequired:true,disclosureRequired:true,disclosure:`You asked for ${normalized.display}. You approved broader ${state.display} research. ${capability.disclosure}`,reasonCodes:['EXPLICIT_BROADENING_CONSENT'],userConsent:{approved:true,requestedDisplay:normalized.display,approvedExecutionDisplay:state.display}};
    return {...base,resolutionState:'BROADENING_REQUIRES_CONSENT',transformation:normalized.kind==='county'?'COUNTY_TO_STATE':'CITY_TO_STATE',executionAllowed:false,consentRequired:true,disclosureRequired:true,disclosure:`Local filtering for ${normalized.display} is not supported by the current specialist contract. ${capability.disclosure}`,reasonCodes:['LOCAL_SCOPE_UNSUPPORTED','STATE_BROADENING_REQUIRES_CONSENT']};
  }
  return {...base,resolutionState:'CAPABILITY_UNSUPPORTED',executionAllowed:false,disclosureRequired:true,disclosure:capability.disclosure,reasonCodes:['REQUESTED_GEOGRAPHY_KIND_UNSUPPORTED']};
}
