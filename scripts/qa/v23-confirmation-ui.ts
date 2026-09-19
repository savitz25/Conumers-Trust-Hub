/** LOCAL UI ONLY. Fake account/source ports; no Auth/backend/network client. */
import {createServer} from 'node:http';
import {handleProfileConfirmation,type BrowserBindings,type Confirmation} from '../../lib/my-trusthub/profile-save/browser.ts';
import {TRANSFER_VERSION,manifestDigest,type GuestStageInput} from '../../lib/my-trusthub/contracts/v2-3-profile-transfer.ts';
const identity={hub:'move' as const,nativeId:'fixture-mover',profileClass:'mover'};
const manifest:GuestStageInput={version:TRANSFER_VERSION,sourceHub:'move',audience:'ask',selected:[{localItemId:'fixture-mover',revision:'1',digest:'a'.repeat(64),profile:identity}],returnTask:{kind:'profile',hub:'move',canonicalSlug:'fixture-mover',profile:identity}};
const origin='http://127.0.0.1:4525';
const c:Confirmation={source:{continuationRef:'c'.repeat(43),transferRef:'t'.repeat(43),manifest,manifestDigest:manifestDigest(manifest),browserProof:'b'.repeat(43),expiresAt:Date.now()+600000,requestPrefix:'r'.repeat(43)},csrf:'x'.repeat(43),expiresAt:Date.now()+600000,requestPrefix:'r'.repeat(43)};
const b:BrowserBindings={origin,registry:{environment:'isolated',isolatedBackendVerified:true,origins:{move:'http://127.0.0.1:4526',insurance:'http://127.0.0.1:4527',lender:'http://127.0.0.1:4528'}},now:Date.now,
  source:async()=>null,parent:async()=>({subject:'fixture-a',session:'fixture-session',label:'Isolated UI fixture account'}),projects:async()=>[],
  store:{put:async()=>{throw Error('not used');},withRecord:async(_k,work)=>work(c,async()=>{})},
  runtime:async()=>{throw Error('No provider configured: verify honest failure only');},acknowledge:async()=>{throw Error('not used');}};
createServer(async(req,res)=>{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const headers=new Headers({'cookie':'mth_parent_profile_confirmation='+'k'.repeat(43)});
  if(req.headers.origin)headers.set('origin',req.headers.origin);
  if(req.headers['content-type'])headers.set('content-type',req.headers['content-type']);
  const result=await handleProfileConfirmation(new Request(origin+(req.url??''),{method:req.method,headers,
    ...(req.method==='POST'?{body:Buffer.concat(chunks).toString('utf8')}:{})}),b);
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
}).listen(4525,'127.0.0.1',()=>console.log('LOCAL UI ONLY: http://127.0.0.1:4525/my/profile-save; all identity ports mocked; commit unavailable'));
