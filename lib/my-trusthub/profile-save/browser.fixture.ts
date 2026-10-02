import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {handleProfileConfirmation,PROFILE_CONFIRM_PATH,type BrowserBindings,type BrowserParent,type Confirmation} from './browser.ts';
import {ParentProfileSaveRuntime,type VerifiedCaller} from './runtime.ts';
import {SqliteHarnessBackend} from '../../../scripts/qa/v23-sqlite-backend.ts';
import {TRANSFER_VERSION,profileKey,type GuestStageInput,type GuestStageRef} from '../contracts/v2-3-profile-transfer.ts';
export async function fixture(options:{origin?:string;sourceOrigin?:string;zeroProjects?:boolean;nativeId?:string}={}){
  let now=1000,parent:BrowserParent|null=null;
  const origin=options.origin??'http://127.0.0.1:4520',sourceOrigin=options.sourceOrigin??'http://127.0.0.1:4521';
  const registry={environment:'isolated' as const,isolatedBackendVerified:true,origins:{move:sourceOrigin,insurance:'http://127.0.0.1:4522',lender:'http://127.0.0.1:4523',contractor:'http://127.0.0.1:4524',senior:'http://127.0.0.1:4525',investor:'http://127.0.0.1:4529'}};
  const identity={hub:'move' as const,nativeId:options.nativeId??'fixture-mover',profileClass:'mover'};
  const manifest:GuestStageInput={version:TRANSFER_VERSION,sourceHub:'move',audience:'ask',selected:[{localItemId:'fixture-mover',revision:'1',digest:'a'.repeat(64),profile:identity}],returnTask:{kind:'profile',hub:'move',canonicalSlug:identity.nativeId,profile:identity}};
  const backend=new SqliteHarnessBackend(join(mkdtempSync(join(tmpdir(),'b4-browser-')),'qa.sqlite'));
  backend.profiles.set(profileKey(identity),{...identity,published:true,supportedClass:true,binding:{id:'fixture-binding',networkEntityId:'fixture-entity',status:'accepted'}});
  let caller:VerifiedCaller={hub:'move',browserBinding:'b'.repeat(43),environment:'isolated',scopes:['transfer:stage','saved:write','receipt:verify']};
  const runtime=new ParentProfileSaveRuntime({enabled:true,backend,registry,now:()=>now,authenticate:async()=>caller});
  const stage=await runtime.execute('prepareGuestProfileTransfer',manifest) as GuestStageRef;
  const continuation=await runtime.execute('prepareProfileSaveContinuation',{sourceHub:'move',audience:'ask',transferRef:stage.transferRef,manifestDigest:stage.manifestDigest}) as {continuationRef:string};
  // Source snapshot is obtained by a separate mocked authenticated service, NOT
  // by reading the parent's SQLite tables. Concrete service credentials NOT RUN.
  const records=new Map<string,Confirmation>();const checkpoints:Confirmation[]=[];let acks=0;
  const b:BrowserBindings={origin,registry,now:()=>now,source:async()=>({...continuation,...stage,manifest,browserProof:caller.browserBinding,requestPrefix:'r'.repeat(43)}),
    parent:async()=>parent,projects:async()=>options.zeroProjects?[]:[{ref:'p'.repeat(43),label:'Test Project'}],
    store:{put:async(k,v)=>{records.set(k,v);},withRecord:async(k,work)=>work(records.get(k)??null,async()=>{const c=records.get(k);if(c)checkpoints.push(structuredClone(c));})},
    runtime:async(_r,c,p)=>{caller={...caller,parent:{subject:p.subject,sessionBinding:p.session,admitted:true},exchange:'fixture-exchange',selectionConfirmed:true,confirmedTransferRef:c.source.transferRef,confirmedAccountContextRef:c.contextCandidateRef};return runtime;},
    acknowledge:async()=>{acks++;}};
  const post=(body:string,cookie='',from=origin)=>new Request(origin+PROFILE_CONFIRM_PATH,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:from,cookie},body});
  const arrival=await handleProfileConfirmation(post(new URLSearchParams({continuationRef:continuation.continuationRef}).toString(),'',sourceOrigin),b);
  assert.equal(arrival.status,303);const cookie=arrival.headers.get('set-cookie')!.split(';')[0];
  const get=()=>handleProfileConfirmation(new Request(origin+PROFILE_CONFIRM_PATH,{headers:{cookie}}),b);
  const confirm=async(project='')=>{const page=await (await get()).text();const csrf=/name="csrf" value="([^"]+)"/.exec(page)?.[1];return handleProfileConfirmation(post(new URLSearchParams({csrf:csrf??'',confirm:'yes',project}).toString(),cookie),b);};
  return {b,backend,get,confirm,post,cookie,records,origin,continuation,checkpoints,get acks(){return acks;},
    login(subject='consumer-a',session='session-a'){parent={subject,session,label:'Test account'};},logout(){parent=null;},expire(){now=700000;},close(){backend.close();}};
}
