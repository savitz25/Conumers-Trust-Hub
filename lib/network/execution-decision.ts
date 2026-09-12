import {planAskResearch,type AskResearchPlan} from './research-planner.ts';
import {resolveResearchScope} from './research-scope.ts';
import {validateAskQuestion} from './ask-request.ts';

/** Server-owned permission: labels, absent sessions and nonempty results never authorize retrieval. */
export function decideAskExecution(question:string,providedPlan?:AskResearchPlan) {
 validateAskQuestion(question);
 const plan=providedPlan??planAskResearch(question);
 const scope=resolveResearchScope(plan);
 const placeLens=/^(?:what does trusthub know about|show (?:the )?place lens(?: for)?)\b/i.test(question.trim());
 const allowed=Boolean(plan.executionAllowed&&scope.executionAllowed&&plan.primaryHub);
 return {plan,scope,mode:placeLens?'PLACE_LENS' as const:plan.intent==='MULTI_HUB_JOURNEY'?'JOURNEY' as const:allowed?'SINGLE_SPECIALIST' as const:'CLARIFICATION' as const,allowedHubs:allowed?[plan.primaryHub!]:[],executionAllowed:allowed};
}
