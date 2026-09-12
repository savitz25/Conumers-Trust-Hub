import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base='https://www.asktrusthub.com';
const report={at:new Date().toISOString(),base,cases:[],writeBoundary:'Public search may emit existing approved telemetry; no account, regulatory, schema or configuration writes.'};
async function start(question){const began=performance.now();const response=await fetch(`${base}/api/guided-research`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:{type:'START',question}}),signal:AbortSignal.timeout(15000)});const body=await response.json();assert.equal(response.status,200);return {body,ms:Math.round(performance.now()-began)};}
try{
 for(const question of ['senior homes in Austin Texas','home health agencies in Houston']){
  const {body,ms}=await start(question);assert.equal(body.diagnostics.specialistCalls,0);assert.equal(body.session.hub,'senior');assert(!body.result?.rows?.length);
  report.cases.push({question,ms,hub:body.session.hub,phase:body.session.phase,geography:body.session.geography,missingFields:body.session.missingFields,specialistCalls:body.diagnostics.specialistCalls});
 }
 for(const path of ['/?','/ask','/admin','/my','/robots.txt','/sitemap.xml']){
  const response=await fetch(base+path,{redirect:'follow',signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
  report.cases.push({path,status:response.status,finalPath:new URL(response.url).pathname});
 }
 const invalid=await fetch(`${base}/api/guided-research`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:{type:'START',question:'x'.repeat(501)}})});assert.equal(invalid.status,400);report.cases.push({id:'oversized-input-rejected',status:invalid.status});
 report.passed=true;
}catch(error){report.failure=String(error);process.exitCode=1;}finally{writeFileSync('docs/qa/th-search-r1-008/production-smoke.json',JSON.stringify(report,null,2));console.log(report);}
