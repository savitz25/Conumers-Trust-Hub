import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.R8_PLAYWRIGHT_MODULE??'playwright-core');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${process.env.R8_CDP_PORT}`),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
const questions=['nursing homes in Austin Texas','home health agencies in Houston Texas'];
const report={at:new Date().toISOString(),base:'https://www.asktrusthub.com',method:'Real production responses; one response delayed only inside the ticket browser to exercise stale-response handling',cases:[],dispatches:[]};
let signal,delayed=false;const started=new Promise(r=>signal=r);
await page.route('**/api/guided-research',async route=>{const response=await route.fetch();const body=await response.json();report.dispatches.push({dispatch:body.result?.dispatch,resultState:body.result?.resultState});if(!delayed&&route.request().postDataJSON().session?.originalQuestion===questions[0]){delayed=true;signal();await new Promise(r=>setTimeout(r,1200));}try{await route.fulfill({response});}catch{/* Navigation cancelled delivery of the old real response. */}});
async function scope(q,cls){await page.waitForFunction(({q,cls})=>document.querySelector('#ask-q')?.value===q&&document.querySelector('main')?.textContent?.includes(cls),{q,cls},{timeout:12000});await page.getByRole('link',{name:'Open SeniorTrustHub profile',exact:true}).first().waitFor();}
try{
 await page.goto(report.base+'/ask?'+new URLSearchParams({q:questions[0]}));await started;
 await page.locator('#ask-q').fill(questions[1]);await page.locator('#ask-q').press('Enter');await scope(questions[1],'home_health');await page.waitForTimeout(1500);
 assert.doesNotMatch(await page.locator('main').innerText(),/AUSTIN WELLNESS|nursing_home/);report.cases.push({id:'real-delayed-response-excluded',pass:true});
 await page.goBack({waitUntil:'commit'});await scope(questions[0],'nursing_home');assert.match(await page.locator('main').innerText(),/Austin, Texas/);report.cases.push({id:'production-back-coherent',pass:true});
 await page.goForward({waitUntil:'commit'});await scope(questions[1],'home_health');assert.match(await page.locator('main').innerText(),/Houston, Texas/);report.cases.push({id:'production-forward-coherent',pass:true});
 await page.screenshot({path:'docs/qa/th-search-r1-008/production-history.png'});report.passed=true;
}catch(error){report.failure=String(error);process.exitCode=1;}finally{writeFileSync('docs/qa/th-search-r1-008/production-state-browser.json',JSON.stringify(report,null,2));console.log(report);await context.close();await browser.close();}
