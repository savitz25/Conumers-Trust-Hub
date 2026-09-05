import type { GuidedResultState } from '../guided-research/contract.ts';
import type { AskResearchPlan } from './research-planner.ts';
import type { AskExecutionScope } from './research-scope.ts';
import { resolveResearchDestinations } from './research-destinations.ts';

export type GuidedNextActionType='ENTER_IDENTIFIER'|'ENTER_ENTITY_NAME'|'ENTER_GEOGRAPHY'|'SELECT_GEOGRAPHY'|'SELECT_ENTITY'|'CONSENT_BROADENING'|'OPEN_TRUSTHUB_DESTINATION'|'OPEN_OFFICIAL_SOURCE'|'RETRY'|'CLEAR_FILTERS'|'RESTART';
export type GuidedNextAction={id:string;type:GuidedNextActionType;label:string;href?:string;value?:string;description?:string;priority:number};
export function resolveGuidedNextActions(input:{plan:AskResearchPlan;scope:AskExecutionScope;resultState?:GuidedResultState}):GuidedNextAction[]{
 const {plan,scope,resultState}=input;const actions:GuidedNextAction[]=[];
 if(plan.intent==='ENTITY_LOOKUP_MISSING_IDENTITY'||plan.missingSlots.includes('identifier_or_entity_name')||plan.missingSlots.includes('entityName'))actions.push({id:'enter-identity',type:'ENTER_ENTITY_NAME',label:plan.primaryHub==='lender'?'Enter NMLS number or lender name':plan.primaryHub==='investor'?'Enter adviser / firm name or CRD':plan.primaryHub==='senior'?'Enter agency name or CMS CCN':'Enter entity name or identifier',priority:10});
 if(scope.resolutionState==='CLARIFICATION_REQUIRED')actions.push({id:'select-geography',type:'SELECT_GEOGRAPHY',label:'Choose a supported geography',priority:10});
 if(scope.consentRequired&&scope.normalizedRequestedGeography?.stateCode)actions.push({id:'consent-state',type:'CONSENT_BROADENING',label:`Research ${scope.normalizedRequestedGeography.stateName??scope.normalizedRequestedGeography.stateCode} instead`,value:`scope_state:${scope.normalizedRequestedGeography.stateCode}`,priority:10});
 if(resultState==='BACKEND_UNAVAILABLE'||resultState==='TIMEOUT')actions.push({id:'retry',type:'RETRY',label:'Try again',priority:10});
 if(resultState==='ZERO_MATCHING_ROWS')actions.push({id:'clear-filters',type:'CLEAR_FILTERS',label:'Change or clear filters',priority:10});
 for(const row of resolveResearchDestinations({researchPlan:plan,executionScope:scope,limit:3}))actions.push({id:row.id,type:row.owner==='OFFICIAL'?'OPEN_OFFICIAL_SOURCE':'OPEN_TRUSTHUB_DESTINATION',label:row.label,href:row.href,description:row.description,priority:row.priority});
 return [...new Map(actions.sort((a,b)=>a.priority-b.priority).map(a=>[a.id,a])).values()].slice(0,3);
}
