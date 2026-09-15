import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planAskResearch} from './research-planner.ts';
import {resolveResearchScope} from './research-scope.ts';
import {RESEARCH_DESTINATIONS,resolveResearchDestinations,validateResearchDestinationRegistry,conciergeDestinationContext} from './research-destinations.ts';
import {resolveGuidedNextActions} from './guided-next-actions.ts';
import {orchestrateGuidedResearch} from '../guided-research/orchestrator.ts';
import {ASK_CONCIERGE_SYSTEM_PROMPT} from '../ai/system-prompt.ts';

const resolved=(q:string)=>{const plan=planAskResearch(q);const scope=resolveResearchScope(plan);return {plan,scope,destinations:resolveResearchDestinations({researchPlan:plan,executionScope:scope}),actions:resolveGuidedNextActions({plan,scope})}};
test('registry is deterministic, canonical, unique, public, and never owns entity profile patterns',()=>{assert.deepEqual(validateResearchDestinationRegistry(),[]);assert.equal(new Set(RESEARCH_DESTINATIONS.map(x=>x.id)).size,RESEARCH_DESTINATIONS.length);assert.ok(RESEARCH_DESTINATIONS.every(x=>!/[?&](?:url|href)=/i.test(x.href)));});
test('precise tools beat homepages for Move and Loan Estimate',()=>{const move=resolved('How do I check if a moving company is licensed?');assert.equal(move.plan.intent,'HOW_TO');assert.equal(move.destinations[0]?.id,'move.verify_dot');assert.ok(move.destinations.some(x=>x.id==='official.fmcsa'));assert.doesNotMatch(JSON.stringify(move.plan),/entityName.*moving company/i);const loan=resolved('What should I look for on a Loan Estimate besides the rate?');assert.equal(loan.destinations[0]?.id,'lender.loan_estimate_analyzer');});
test('missing identity states give collection plus official actions',()=>{for(const [q,label,official] of [["Is my lender's NMLS number valid?",/NMLS number or lender name/,'official.nmls'],['Is this home health agency Medicare certified?',/agency name or CMS CCN/,'official.cms'],['Is this financial advisor registered with the SEC?',/name or CRD/,'official.iapd']] as const){const x=resolved(q);assert.equal(x.plan.intent,'ENTITY_LOOKUP_MISSING_IDENTITY');assert.equal(x.plan.executionAllowed,false);assert.match(x.actions[0]?.label??'',label);assert.ok(x.actions.some(a=>a.id===official));}});
test('insurance producer restriction never emits a TrustHub person profile',()=>{const x=resolved('How do I verify an insurance agent is real?');assert.equal(x.plan.primaryHub,'insurance');assert.ok(x.destinations.some(d=>d.id==='official.insurance_departments'));assert.ok(x.destinations.filter(d=>d.owner==='TRUSTHUB').every(d=>!d.href.includes('/producer')));});
test('Broward execution gets exact county destination and 001B scope',()=>{const x=resolved('I need a licensed roofer in Fort Lauderdale Florida');assert.equal(x.scope.executionGeography?.county,'Broward');assert.equal(x.destinations[0]?.id,'contractor.broward');assert.equal(x.destinations[0]?.type,'COUNTY_RESEARCH');});
// TH-DISCOVERY-003: "insurance agencies in Fort Lauderdale Florida" was dropped from this list --
// Fort Lauderdale/Broward is a real Insurance local-directory launch county (TH-DISCOVERY-002B),
// and the shared FL city parser (ask-parse.ts) now correctly recognizes it (previously it silently
// got no `city` at all, so this case accidentally looked like a "scope failure" only because the
// city was never even parsed). It genuinely executes now; see ask-intel-001e.test.ts for its own
// coverage. The remaining cases stay genuinely unsupported at their requested local grain.
// TH-DISCOVERY-003: "movers in Boca Raton Florida" was dropped -- MoveTrustHub's specialist now
// has a real recorded-headquarters-CITY filter, so it genuinely executes at city grain.
// TH-DISCOVERY-RESET-001: "mover in Tampa Bay Florida" was dropped -- it now genuinely
// auto-broadens to Florida and executes (RESULTS FIRST); its own coverage lives in
// th-discovery-001-corpus.test.ts's dedicated Tampa Bay test.
// TH-DISCOVERY-RESET-001: "registered investment advisers in West Palm Beach Florida" was dropped
// -- InvestorTrustHub's specialist has no local-office filter, so this now genuinely
// auto-broadens to Florida and executes (RESULTS FIRST).
// TH-DISCOVERY-RESET-001: "roofer in Phoenix Arizona" now also auto-broadens city->state (Arizona)
// and genuinely calls the specialist, since Contractor's capability declaration marks 'state' as
// supported network-wide (it does not track which specific states have real data) -- but the
// specialist itself still correctly, honestly rejects Arizona (UNSUPPORTED_STATE_CAPABILITY, zero
// rows), never fabricating a result. This is a harmless extra call, not a false claim.
test('scope failures retain useful safe actions without pretending zero results',async()=>{for(const q of ['roofer in Phoenix Arizona']){const response=await orchestrateGuidedResearch({action:{type:'START',question:q}});assert.notEqual(response.result?.resultState,'ZERO_MATCHING_ROWS',q);assert.notEqual(response.result?.resultState,'SUPPORTED_RESULTS','Arizona must never be fabricated as a real result');}});
test('true zero policy differs from unsupported scope',()=>{const x=resolved('roofing contractors in Broward County Florida');const actions=resolveGuidedNextActions({plan:x.plan,scope:x.scope,resultState:'ZERO_MATCHING_ROWS'});assert.equal(actions[0]?.type,'CLEAR_FILTERS');assert.ok(actions.some(a=>a.id==='contractor.broward'));});
test('concierge context is an allowlisted concise route ticket',()=>{const x=resolved('What should I read on Form ADV?');const text=conciergeDestinationContext(x.plan,x.scope);assert.match(text,/investortrusthub\.com\/firms/);assert.match(text,/adviserinfo\.sec\.gov/);assert.doesNotMatch(text,/investortrusthub\.com\/florida/);});
test('static Concierge prompt contains policy, never drifting URL inventory',()=>{assert.doesNotMatch(ASK_CONCIERGE_SYSTEM_PROMPT,/https?:\/\//);assert.match(ASK_CONCIERGE_SYSTEM_PROMPT,/600 and 1,200 characters/);assert.match(ASK_CONCIERGE_SYSTEM_PROMPT,/exhaustive URL allowlist/i)});
test('status semantics remain non-endorsement',()=>{for(const d of RESEARCH_DESTINATIONS)assert.doesNotMatch(`${d.description} ${d.caveat??''}`,/current (?:means|=) good standing|registered (?:means|=) recommended/i)});
test('24-query destination and failure-mode corpus remains structured and fail closed',async()=>{
 const corpus:Array<[string,string,string?]>=[
  ['How do I check if a moving company is licensed?','move','move.verify_dot'],["What's the difference between a broker and a carrier?",'move'],['USDOT 125563','move','move.verify_dot'],
  ['How do I look up an NMLS ID?','lender','lender.research'],["Is my lender's NMLS number valid?",'lender'],['What should I look for on a Loan Estimate besides the rate?','lender','lender.loan_estimate_analyzer'],
  ['How do I verify an insurance agent is real?','insurance','official.insurance_departments'],['Which insurance agencies are licensed in Florida?','insurance','insurance.florida'],['Agency vs insurance company?','insurance'],
  ['How should I research a nursing home?','senior','senior.search'],['What do CMS star ratings actually mean?','senior','senior.search'],['Is this home health agency Medicare certified?','senior','senior.search'],
  ['Show active roofing contractors in Broward County Florida','contractor','contractor.broward'],['Does Current mean good standing?',''],['I need a licensed roofer in Fort Lauderdale Florida','contractor','contractor.broward'],
  ['Is this financial advisor registered with the SEC?','investor','investor.firms'],['What should I read on Form ADV?','investor','investor.firms'],['CRD 166089','investor','investor.firms'],
  ['movers in Boca Raton Florida','move','move.verify_dot'],['registered investment advisers in West Palm Beach Florida','investor','investor.firms'],
  ['roofer in Phoenix Arizona','contractor'],['roofing contractors in Broward County Florida','contractor','contractor.broward'],
 ];
 // TH-DISCOVERY-RESET-001: resolved(question).scope is a raw resolveResearchScope() call with no
 // consent, so !x.scope.executionAllowed no longer implies the real session flow won't execute --
 // session.ts's createGuidedSession auto-supplies that consent for a city/region mapping to a real
 // state. These specific queries are known to auto-broaden and genuinely execute; skip the
 // zero-calls assumption for them alone.
 const autoBroadens=new Set(['movers in Boca Raton Florida','registered investment advisers in West Palm Beach Florida','roofer in Phoenix Arizona']);
 for(const [question,hub,destination] of corpus){const x=resolved(question);assert.equal(x.plan.primaryHub??'',hub,question);if(destination)assert.ok(x.destinations.some(d=>d.id===destination),question);if(!x.scope.executionAllowed&&!autoBroadens.has(question)){const response=await orchestrateGuidedResearch({action:{type:'START',question}});assert.equal(response.diagnostics.specialistCalls,0,question);assert.notEqual(response.result?.resultState,'ZERO_MATCHING_ROWS',question);}}
});
