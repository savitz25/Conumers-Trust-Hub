import test from 'node:test';import assert from 'node:assert/strict';import {buildAskResearchRoute} from './ask-research-route.ts';import {createGuidedSession} from '../guided-research/session.ts';import {safeConciergeUrl} from '../ai/safe-markdown.ts';

const ssrMatrix=[
 ['mover in tampa bay florida','MoveTrustHub','Tampa Bay, Florida',false],
 ['licensed roofer in Fort Lauderdale Florida','ContractorTrustHub','Broward County, Florida',true],
 ['registered investment advisers in West Palm Beach Florida','InvestorTrustHub','West Palm Beach, Florida',false],
 ['What should I look for on a Loan Estimate besides the rate?','LenderTrustHub',undefined,false],
 ['Is this financial advisor registered with the SEC?','InvestorTrustHub',undefined,false],
 ['nursing homes in Boca Raton Florida','SeniorTrustHub','Boca Raton, Florida',true],
] as const;
test('server-safe route model covers the mandatory SSR matrix',()=>{for(const [q,hub,scope,canExecute] of ssrMatrix){const r=buildAskResearchRoute(q);assert.equal(r.hubLabel,hub,q);assert.equal(r.question,q);if(scope)assert.ok([r.requestedScope,r.executionScope].includes(scope),q);assert.equal(r.canExecute,canExecute,q);assert.ok(r.status&&r.explanation&&r.limitation);assert.ok(r.timings.totalMs>=0)}});
test('Guided START is constructed on the server and clarification cannot execute',()=>{const tampa=createGuidedSession('mover in tampa bay florida')!;assert.equal(tampa.phase,'CLARIFY');assert.equal(tampa.executionScope.executionAllowed,false);assert.equal(tampa.lastExecution,undefined);const broward=createGuidedSession('licensed roofer in Fort Lauderdale Florida')!;assert.equal(broward.phase,'EXECUTE');assert.equal(broward.geography?.county,'Broward')});

const journeys=[
 ["I'm buying a home in Broward County and need to research my lender, insurance and contractor.",['lender','insurance','contractor'],[]],
 ["I'm buying a home in Broward County. What should I research?",['lender','insurance'],['contractor','move']],
 ["I'm moving from New Jersey to Florida and buying a house.",['move','lender','insurance'],[]],
 ["I'm moving to Florida and renting.",['move','insurance'],[]],
 ["My roof is damaged and I need to research my contractor and insurance.",['contractor','insurance'],[]],
 ["I'm helping my father find a nursing home and we may move him.",['senior'],['move']],
] as const;
test('multi-hub journeys are ordered tickets using verified destinations',()=>{for(const [q,required,optional] of journeys){const r=buildAskResearchRoute(q);assert.ok(r.journey,q);assert.deepEqual(r.journey.steps.map(s=>s.hub),required,q);assert.deepEqual(r.journey.optionalSteps.map(s=>s.hub),optional,q);for(const step of [...r.journey.steps,...r.journey.optionalSteps])for(const d of step.destinations)assert.match(d.href,/^https:\/\/(?:www\.)?(?:move|lender|insurance|contractor|senior|investor)trusthub\.com/)} });
test('single-hub situations remain single hub',()=>{assert.equal(buildAskResearchRoute('I need to refinance my house in Florida.').journey,undefined);assert.equal(buildAskResearchRoute('I want to research an investment adviser before I hire them.').journey,undefined)});
test('ambiguous housing asks one question and broad explicit journeys keep relevant hubs',()=>{const uncertain=buildAskResearchRoute("I'm not sure if I'm buying or renting when I move to Texas.").journey!;assert.deepEqual(uncertain.steps.map(s=>s.hub),['move']);assert.match(uncertain.clarificationNeeded??'',/buy or rent/);const broad=buildAskResearchRoute("I'm buying a house, moving, need insurance, and planning a roof replacement.").journey!;assert.deepEqual(broad.steps.map(s=>s.hub),['move','lender','insurance','contractor'])});
test('journeys never contain execution payloads or six-hub fanout',()=>{const j=buildAskResearchRoute("I'm buying a house, moving, need insurance, and planning a roof replacement.").journey!;assert.ok(j);assert.ok(j.orderedHubs.length<6);assert.equal('specialistResults' in j,false)});
test('Concierge URLs require an explicit per-response allowlist',()=>{const allowed='https://www.movetrusthub.com/verify-dot';assert.equal(safeConciergeUrl(allowed,[allowed]),allowed);assert.equal(safeConciergeUrl('https://evil.example/path',[allowed]),'');assert.equal(safeConciergeUrl('javascript:alert(1)',[allowed]),'');assert.equal(safeConciergeUrl('data:text/html,bad',[allowed]),'');assert.equal(safeConciergeUrl('/ask?q=mover',['/ask?q=mover']),'/ask?q=mover');assert.equal(safeConciergeUrl('/ask?q=attacker',[]),'')});
test('route metadata inputs remain bounded consumer text',()=>{const r=buildAskResearchRoute('<script>alert(1)</script> mortgage lenders in Texas');assert.ok(r.question.length>0);assert.equal(r.scope.executionGeographyMeaning,'PROPERTY_GEOGRAPHY')});
