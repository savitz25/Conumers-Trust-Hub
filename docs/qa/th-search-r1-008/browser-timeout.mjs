import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.R8_PLAYWRIGHT_MODULE??'playwright-core');
const phase=process.argv[2]??'green';
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${process.env.R8_CDP_PORT}`);
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
const report={at:new Date().toISOString(),phase,method:'Local browser-only delayed transport; no production disruption'};
let calls=0;
await page.route('**/api/guided-research',async route=>{calls++;if(calls===1){await new Promise(r=>setTimeout(r,14000));try{await route.abort();}catch{}}else await route.continue();});
try{
 const started=performance.now();
 await page.goto('http://localhost:3108/ask?q=nursing%20homes%20in%20Austin%20Texas');
 await page.locator('main').getByRole('alert').waitFor({timeout:16000});
 report.ms=Math.round(performance.now()-started);report.message=await page.locator('main').getByRole('alert').innerText();
 assert.match(report.message,/timed out.*try again/i);assert.doesNotMatch(report.message,/AbortError|signal is aborted/i);
 await page.getByRole('button',{name:'Retry request',exact:true}).press('Enter');
 await page.getByRole('link',{name:'Open SeniorTrustHub profile',exact:true}).first().waitFor({timeout:12000});
 assert.equal(calls,2);assert.equal(await page.locator('main').getByRole('alert').count(),0);report.retrySucceeded=true;
 await page.screenshot({path:`docs/qa/th-search-r1-008/timeout-${phase}.png`});report.passed=true;
}catch(error){report.failure=String(error);process.exitCode=1;}finally{writeFileSync(`docs/qa/th-search-r1-008/timeout-${phase}.json`,JSON.stringify(report,null,2));console.log(report);await context.close();await browser.close();}

