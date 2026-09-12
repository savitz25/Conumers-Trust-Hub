import {US_JURISDICTIONS} from './us-jurisdictions.ts';
import type {AskResearchPlan,AskRequestedGeography} from './research-planner.ts';

export type CareSetting='nursing_home'|'home_health'|'hospice'|'assisted_living'|'memory_care'|'independent_living';
export function careTask(question:string):{kind:'care'|'move_context'|'care_and_move';setting?:CareSetting}|null {
 if(/\b(?:this place|does no match mean)\b|^\s*(?:good|best|safest)\b/i.test(question))return null;
 if(/\b(?:this|that|my)\s+(?:home\s+health\s+agency|nursing\s+home|facility|company)\b/i.test(question)||/^\s*(?:how\s+(?:do|can|should)\s+i|what\s+(?:is|are)|explain|compare)\b/i.test(question))return null;
 const settings:Array<[RegExp,CareSetting]>=[[/\bnursing\s+(?:homes?|facilit(?:y|ies))|\bskilled\s+nursing\b/i,'nursing_home'],[/\bhome\s+health\b/i,'home_health'],[/\bhospice\b/i,'hospice'],[/\bassisted\s+living\b/i,'assisted_living'],[/\bmemory\s+care\b/i,'memory_care'],[/\bindependent[- ]living\b/i,'independent_living']];
 const setting=settings.find(([re])=>re.test(question))?.[1];
 const generic=/\bsenior\s+(?:homes?|care|facilit(?:y|ies))\b|\bcare\s+(?:home|facility|facilities|setting)\b|\b(?:grandma|grandmother|grandfather|aging\s+parent|elderly\s+parent)\b.*\b(?:care|home|place|help)\b/i.test(question);
 if(!setting&&!generic)return null;
 if(/["“][^"”]+["”]|\b(?:LLC|Inc\.?|Corporation)\b/i.test(question)&&!/^\s*(?:find|show|list)\s+(?:all\s+)?(?:nursing\s+homes|home\s+health\s+agencies)/i.test(question))return null;
 if(/\b(?:insurance|Medicare\s+(?:insurance|coverage|options))\b/i.test(question)&&!generic&&!/\bfind\b.*\b(?:nursing|hospice|home health)\b/i.test(question))return null;
 const moving=/\b(?:mover|movers|move|moving|relocat\w*)\b/i.test(question);
 const separate=moving&&(/\b(?:then|also|as well as)\b|\band\b.*\b(?:move|moving|relocation)\b/i.test(question));
 if(separate)return {kind:'care_and_move',setting};
 if(moving&&/\b(?:belongings|furniture|mover|movers|carrier|USDOT|MC)\b/i.test(question))return {kind:'move_context',setting};
 return {kind:'care',setting};
}
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function careLocation(question:string):AskRequestedGeography|undefined {
 const raw=question.match(/\b(?:in|near|around|within)\s+(.+?)(?=\s+(?:then|with|that|which|rated|having|for)\b|[?!;]|$)/i)?.[1]?.trim().replace(/[, .]+$/,'');
 if(!raw)return undefined;
 if(/^(?:broward|palm\s+beach)\s+county$/i.test(raw))return {raw,display:`${raw}, Florida`,kind:'county',resolution:'RESOLVED',stateCode:'FL',stateName:'Florida',county:raw.replace(/\s+county$/i,'')};
 const ambiguous=/\b(?:near me|miles?|radius|and|or)\b/i.test(raw)||/\b(?:near me|within\s+\d+)\b/i.test(question);
 const jurisdictions=US_JURISDICTIONS.filter(j=>new RegExp(`(?:^|[ ,])(?:${esc(j.name)}|${j.code})(?=$|[ ,])`,'i').test(raw));
 const unique=[...new Map(jurisdictions.map(j=>[j.code,j])).values()];
 // Match the terminal jurisdiction; city words such as New York/West Virginia are not separate states.
 const state=[...US_JURISDICTIONS].sort((a,b)=>b.name.length-a.name.length).find(j=>new RegExp(`(?:^|[ ,])(?:${esc(j.name)}|${j.code})$`,'i').test(raw));
 let place=state?raw.replace(new RegExp(`(?:^|[ ,])(?:${esc(state.name)}|${state.code})$`,'i'),'').trim().replace(/[, ]+$/,''):raw;
 const conflict=unique.length>1&&unique.some(j=>j.code!==state?.code&&!place.toLowerCase().startsWith(j.name.toLowerCase()));
 if(ambiguous||conflict||!/^[a-z .'-]+$/i.test(place||state?.name||''))return {raw,display:raw,kind:'place',resolution:'UNRESOLVED'};
 const county=/\bcounty$/i.test(place);if(county)place=place.replace(/\s+county$/i,'');
 const kind=!place?'state':county?'county':'city';
 return {raw,display:place?`${place}${county?' County':''}${state?`, ${state.name}`:''}`:state!.name,kind,resolution:state?'RESOLVED':'UNRESOLVED',stateCode:state?.code,stateName:state?.name,city:kind==='city'?place:undefined,county:kind==='county'?place:undefined};
}
export function planCareResearch(base:AskResearchPlan,setting:CareSetting|undefined,geography=base.requestedGeography):AskResearchPlan {
 const cms=setting&&['nursing_home','home_health','hospice'].includes(setting);
 const missing=!setting?['providerClass']:!geography||geography.resolution!=='RESOLVED'?['geography']:[];
 const conflict=Boolean(base.identifier&&!/ccn/i.test(base.identifier.type));
 const extraEvidence=base.requestedEvidence.some(e=>e!=='SOURCE_RATING')||/\b(?:ownership|CHOW|deficienc\w*|inspections?|safest|best|recommended|availability|available\s+beds|accepts?\s+Medicaid)\b/i.test(base.originalQuestion);
 const rawRating=base.originalQuestion.match(/\b(\d+(?:\.\d+)?)[- ]stars?\b/i)?.[1]; const invalidRating=Boolean(rawRating&&(/\b(?:at least|at most|more than|less than)\b/i.test(base.originalQuestion)||[...base.originalQuestion.matchAll(/\b\d+(?:\.\d+)?[- ]stars?\b/ig)].length>1||!/^[1-5]$/.test(rawRating)||setting==='hospice'));
 const executable=Boolean(cms&&!missing.length&&!conflict&&!extraEvidence&&!invalidRating);
 const clarificationReason=conflict?'The supplied identifier and care task belong to different research domains. Clarify which task to research.':!setting?'Which care setting would you like to research?':!cms?'This care setting uses state-specific sources; it is not a CMS nursing-home directory.':missing.length?'Choose the state for the requested recorded location before research runs.':extraEvidence||invalidRating?'The requested evidence or rating condition is not established by this parent directory request. Continue the same question with SeniorTrustHub, or explicitly edit the condition.':undefined;
 return {...base,careSetting:setting,primaryHub:'senior',candidateHubs:['senior'],intent:'COHORT_BROWSE',legacyQueryType:'COHORT',entityName:undefined,entityClass:setting?{id:setting,label:setting.replaceAll('_',' ')}:undefined,requestedGeography:geography,normalizedGeography:geography?{city:geography.city,countyName:geography.county,stateCode:geography.stateCode,stateName:geography.stateName,meaning:'Recorded provider/office location; not service area.'}:undefined,executionAllowed:executable,executionMode:executable?'COHORT':'CLARIFY',missingSlots:conflict?['task']:missing,clarificationReason,reasonCodes:[...base.reasonCodes.filter(c=>!['IDENTITY_EVIDENCE_INSUFFICIENT','SPECIFIC_REFERENCE_WITHOUT_IDENTITY','MULTIPLE_SPECIALIST_HUBS'].includes(c)),'CARE_TASK',...(executable?[]:['SPECIALIST_EXECUTION_BLOCKED'])]};
}

export function initialCareRatingFilters(question:string,setting:CareSetting|undefined):Record<string,string>{
 const stars=question.match(/\b([1-5])[- ]stars?\b/i)?.[1];
 if(!stars)return {};
 if(setting==='nursing_home')return {[/staffing/i.test(question)?'staffingStars':/inspection/i.test(question)?'inspectionStars':'overallStars']:stars};
 return setting==='home_health'?{qpcStars:stars}:{};
}
export function careDestinationQuestion(plan:AskResearchPlan):string{
 if(!plan.reasonCodes.includes('CARE_TASK')||!plan.careSetting||careTask(plan.originalQuestion)?.setting)return plan.originalQuestion;
 const names:Record<CareSetting,string>={nursing_home:'Nursing homes',home_health:'Home health agencies',hospice:'Hospice providers',assisted_living:'Assisted living',memory_care:'Memory care',independent_living:'Independent living'};
 if(!plan.executionAllowed&&['nursing_home','home_health','hospice'].includes(plan.careSetting))return plan.originalQuestion;
 const rating=plan.originalQuestion.match(/\b(?:overall |staffing |inspection )?[1-5][- ]stars?\b/i)?.[0];
 return `${names[plan.careSetting]}${plan.requestedGeography?` in ${plan.requestedGeography.display}`:''}${rating?` rated ${rating}`:''}`;
}
