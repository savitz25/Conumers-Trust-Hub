import type { SpecialistHubId } from './registry.ts';
import { RESEARCH_DESTINATIONS, type ResearchDestination } from './research-destinations.ts';
import type { AskResearchPlan, AskRequestedGeography } from './research-planner.ts';

export type AskJourneyStep={step:number;hub:SpecialistHubId;goal:string;why:string;required:boolean;scope?:string;limitation:string;destinations:ResearchDestination[]};
export type AskMultiHubJourney={version:'ask-multi-hub-journey-v1';originalQuestion:string;journeyType:'HOME_BUYING'|'MOVE_AND_BUY'|'MOVE_AND_RENT'|'ROOF_AND_INSURANCE'|'SENIOR_AND_MOVE'|'UNRESOLVED_HOUSING';requestedGeography?:AskRequestedGeography;steps:AskJourneyStep[];optionalSteps:AskJourneyStep[];clarificationNeeded?:string;orderedHubs:SpecialistHubId[]};

const label:Record<SpecialistHubId,string>={move:'MoveTrustHub',lender:'LenderTrustHub',insurance:'InsuranceTrustHub',senior:'SeniorTrustHub',contractor:'ContractorTrustHub',investor:'InvestorTrustHub'};
function destinations(hub:SpecialistHubId, geography?:AskRequestedGeography):ResearchDestination[]{
  const county=geography?.county;const stateCode=geography?.stateCode;
  const precise=RESEARCH_DESTINATIONS.filter(d=>d.hub===hub&&d.publication==='PUBLIC'&&d.owner==='TRUSTHUB').filter(d=>!d.geography||(d.geography.stateCode===stateCode&&(!d.geography.county||d.geography.county===county))).sort((a,b)=>a.priority-b.priority);
  return precise.slice(0,2);
}
function make(step:number,hub:SpecialistHubId,goal:string,why:string,required:boolean,geo?:AskRequestedGeography):AskJourneyStep{return {step,hub,goal,why,required,scope:geo?.display,limitation:hub==='move'?'Recorded location and federal authority do not prove route service.':hub==='lender'?'HMDA property geography is not headquarters, licensing, or service availability.':hub==='contractor'?'Credential status and geography do not prove service territory or good standing.':hub==='insurance'?'Published credential evidence is not a quote, endorsement, or promise of coverage.':hub==='senior'?'Provider office geography does not prove patient service availability.':'Registration does not mean recommended.',destinations:destinations(hub,geo)};}

export function planAskMultiHubJourney(plan:AskResearchPlan):AskMultiHubJourney|null{
  const q=plan.originalQuestion.toLowerCase();const geo=plan.requestedGeography;
  const moving=/\bmov(?:e|ing|er|relocat)/.test(q),buying=/\b(buy|buying|purchase)\b/.test(q),renting=/\b(rent|renting)\b/.test(q),roof=/\broof/.test(q),senior=/\b(mother|father|parent|senior|nursing home|care)\b/.test(q);
  const explicit=[['lender','lender|mortgage'],['insurance','insurance|coverage'],['contractor','contractor|roofer'],['move','move|moving|mover'],['senior','senior|nursing|home health|hospice']] as const;
  const hubs=explicit.filter(([,p])=>new RegExp(`\\b(?:${p})\\b`).test(q)).map(([h])=>h as SpecialistHubId);
  let type:AskMultiHubJourney['journeyType'];let core:SpecialistHubId[]=[];let optional:SpecialistHubId[]=[];let clarificationNeeded:string|undefined;
  if(moving&&buying&&renting&&/not sure|unsure/.test(q)){type='UNRESOLVED_HOUSING';core=['move'];clarificationNeeded='Are you planning to buy or rent at the destination?';}
  else if(moving&&buying){type='MOVE_AND_BUY';core=['move','lender','insurance'];if(hubs.includes('contractor')||roof)core.push('contractor');}
  else if(moving&&renting){type='MOVE_AND_RENT';core=['move','insurance'];}
  else if(roof&&hubs.includes('insurance')){type='ROOF_AND_INSURANCE';core=['contractor','insurance'];}
  else if(senior&&moving){type='SENIOR_AND_MOVE';core=['senior'];optional=['move'];}
  else if(buying){type='HOME_BUYING';core=hubs.length>1?hubs:['lender','insurance'];optional=hubs.length>1?[]:['contractor','move'];}
  else if(moving&&/\b(?:buying|renting|buy|rent)\b/.test(q)===false&&/not sure|unsure/.test(q)){type='UNRESOLVED_HOUSING';core=['move'];clarificationNeeded='Are you planning to buy or rent at the destination?';}
  else return null;
  const goals:Record<SpecialistHubId,string>={move:'Research mover identity and federal authority',lender:'Research the lender, mortgage market, and Loan Estimate',insurance:'Research insurer or agency credential evidence',contractor:'Research contractor credentials',senior:'Research senior-care provider evidence',investor:'Research investment adviser evidence'};
  const why:Record<SpecialistHubId,string>={move:'Check the moving company before booking.',lender:'Review financing evidence before committing.',insurance:'Understand the regulated entity and official evidence.',contractor:'Verify source credentials before hiring.',senior:'Compare source-native provider evidence.',investor:'Review registration and Form ADV evidence.'};
  const steps=core.map((h,i)=>make(i+1,h,goals[h],why[h],true,geo));
  const optionalSteps=optional.map((h,i)=>make(steps.length+i+1,h,goals[h],`Optional if ${h==='move'?'relocation':'work on the property'} becomes relevant.`,false,geo));
  return {version:'ask-multi-hub-journey-v1',originalQuestion:plan.originalQuestion,journeyType:type,requestedGeography:geo,steps,optionalSteps,clarificationNeeded,orderedHubs:[...core,...optional]};
}
