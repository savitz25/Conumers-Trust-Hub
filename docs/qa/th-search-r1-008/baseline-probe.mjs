import {execFileSync} from 'node:child_process';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!=='e7be3e540fd905a3e3e8b0fe0e347adb2dfbd6e0')throw Error('Run baseline reproduction only on the isolated exact starting commit.');
import {buildAskResearchRoute} from '../../../lib/network/ask-research-route.ts';
import {createGuidedSession} from '../../../lib/guided-research/session.ts';
import {assembleNetworkAnswerWithSpecialist} from '../../../lib/network/ask-plan.ts';
import fs from 'node:fs';
const observations=[];let calls=[];
globalThis.fetch=async(url)=>{calls.push(String(url));return new Response('{}',{status:503,headers:{'content-type':'application/json'}})};
for(const q of ['senior homes in Austin Texas','nursing homes in Austin Texas','home health agencies in Houston Texas','Home health agencies in Houston','I need a mover to move my mother\'s belongings into assisted living in Austin','Find senior homes in Austin, then help me plan the move','What does TrustHub know about Broward?']){
 calls=[];const route=buildAskResearchRoute(q),guided=createGuidedSession(q);let answer;
 if(!route.journey&&!guided)answer=await assembleNetworkAnswerWithSpecialist(q);
 observations.push({q,plan:route.plan,scope:route.scope,canExecute:route.canExecute,journey:!!route.journey,guided:guided?{hub:guided.hub,phase:guided.phase,geography:guided.geography,providerClass:guided.providerClass,choices:guided.availableChoices,missing:guided.missingFields}:null,calls,legacyHubs:answer?.plan.hubs.map(h=>({hub:h.hubId,capability:h.capabilityStatus})),resultClass:answer?.resultClass});
}
fs.writeFileSync('docs/qa/th-search-r1-008/baseline.json',JSON.stringify({at:new Date().toISOString(),baseline:'e7be3e540fd905a3e3e8b0fe0e347adb2dfbd6e0',method:'Actual baseline page selection plus actual legacy dispatcher; instrumented fetch returns503, no real outbound data writes',observations},null,2));
console.log(observations.map(o=>({q:o.q,hub:o.plan.primaryHub,execute:o.canExecute,guided:o.guided,calls:o.calls})));
