// Fully intercepted browser regression. No request reaches a hosted service.
// Supply a local playwright-core module URL and Chromium executable path.
import assert from 'node:assert/strict';
import { fixture } from '../../lib/my-trusthub/profile-save/browser.fixture.ts';
import { handleProfileConfirmation, PROFILE_CONFIRM_PATH } from '../../lib/my-trusthub/profile-save/browser.ts';
import { ASK_PREVIEW, MOVE_PREVIEW } from '../../lib/my-trusthub/profile-save/isolated-config.ts';
if (!process.env.V23_BROWSER_DRIVER_MODULE || !process.env.V23_BROWSER_EXECUTABLE) throw new Error('Local browser driver and executable required');
const {chromium}=await import(process.env.V23_BROWSER_DRIVER_MODULE);
const browser=await chromium.launch({headless:true,executablePath:process.env.V23_BROWSER_EXECUTABLE});
async function run(oldPolicyControl=false){
const f=await fixture({origin:ASK_PREVIEW,sourceOrigin:MOVE_PREVIEW,zeroProjects:true,nativeId:'usdot-1002530'});
f.login();
const context=await browser.newContext({serviceWorkers:'block',offline:true});
await context.addCookies([{name:'mth_parent_profile_confirmation',value:f.cookie.split('=')[1],domain:new URL(ASK_PREVIEW).hostname,path:PROFILE_CONFIRM_PATH,secure:true,httpOnly:true,sameSite:'Lax'}]);
let finalOrigin, finalBodyValid=false, projectsCalls=0;
const projects=f.b.projects;
f.b.projects=async parent=>{projectsCalls++;const rows=await projects(parent);assert.deepEqual(rows,[]);return rows;};
await context.route('**/*',async route=>{
  const req=route.request();
  if(req.url()!==ASK_PREVIEW+PROFILE_CONFIRM_PATH)return route.abort();
  const headers=await req.allHeaders(),body=req.postData();
  if(req.method()==='POST'&&new URLSearchParams(body).has('confirm')){
    finalOrigin=headers.origin;
    const posted=new URLSearchParams(body);
    finalBodyValid=/^[A-Za-z0-9_-]{43}$/.test(posted.get('csrf')??'')&&posted.get('confirm')==='yes'&&posted.get('project')===''&&[...posted.keys()].join(',')==='csrf,confirm,project';
  }
  const response=await handleProfileConfirmation(new Request(req.url(),{method:req.method(),headers,...(body?{body}:{})}),f.b);
  if(oldPolicyControl&&req.method()==='GET')response.headers.set('Referrer-Policy','no-referrer');
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
});
try{
 const page=await context.newPage();
 page.setDefaultTimeout(10000);
 // fixture() executed POST continuationRef -> 303 and captured its cookie.
 await page.goto(ASK_PREVIEW+PROFILE_CONFIRM_PATH);
 assert.match(await page.locator('body').innerText(),/Move Trust Hub · USDOT 1002530/);
 assert.equal(await page.locator('select[name=project]').inputValue(),'');
 assert.equal(await page.locator('select[name=project] option').count(),1);
 assert.equal(f.backend.count('saves'),0);
 assert.ok([...f.records.values()].some(c=>c.parent&&!c.contextCandidateRef));
 await page.getByRole('checkbox').check();
 const responsePromise=page.waitForResponse(r=>r.url()===ASK_PREVIEW+PROFILE_CONFIRM_PATH&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Confirm Save',exact:true}).click();
 const response=await responsePromise;
 console.log(JSON.stringify({oldPolicyControl,finalOriginIsAsk:finalOrigin===ASK_PREVIEW,finalOriginIsNull:finalOrigin==='null',exactFormFields:finalBodyValid,projectsCalls,zeroProjects:true,status:response.status(),contextCandidateReached:f.checkpoints.some(c=>!!c.contextCandidateRef),saves:f.backend.count('saves')}));
 assert.equal(finalBodyValid,true);
 assert.equal(finalOrigin,oldPolicyControl?'null':ASK_PREVIEW);
 if(oldPolicyControl){
  assert.equal(response.status(),503);assert.equal(f.backend.count('saves'),0);
  assert.equal(f.checkpoints.some(c=>!!c.contextCandidateRef),false);return;
 }
 assert.equal(response.status(),200);
 assert.match(await page.locator('body').innerText(),/Saved to My TrustHub/);
 assert.ok(f.checkpoints.some(c=>!!c.contextCandidateRef&&c.projectRef===undefined));
 assert.equal(f.backend.count('saves'),1);
}finally{await context.close();f.close();}
}
try{await run(true);await run();}finally{await browser.close();}
