import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {handleProfileConfirmation,PROFILE_CONFIRM_PATH,type BrowserBindings,type BrowserParent,type Confirmation,type DirectIntent,type SourceSnapshot} from './browser.ts';
import {ParentProfileSaveRuntime,type VerifiedCaller} from './runtime.ts';
import {SqliteHarnessBackend} from '../../../scripts/qa/v23-sqlite-backend.ts';
import {TRANSFER_VERSION,profileKey,type GuestStageInput,type GuestStageRef} from '../contracts/v2-3-profile-transfer.ts';
export async function fixture(options:{origin?:string;sourceOrigin?:string;zeroProjects?:boolean;nativeId?:string;environment?:'isolated'|'production';isolatedBackendVerified?:boolean;intent?:DirectIntent}={}){
  let now=1000,parent:BrowserParent|null=null;
  const environment=options.environment??'isolated';
  // Production registries name the canonical origins and carry no isolated attestation.
  const origin=options.origin??(environment==='production'?'https://www.asktrusthub.com':'http://127.0.0.1:4520');
  const sourceOrigin=options.sourceOrigin??(environment==='production'?'https://www.movetrusthub.com':'http://127.0.0.1:4521');
  const registry={environment,isolatedBackendVerified:options.isolatedBackendVerified??(environment==='isolated'),origins:{move:sourceOrigin,insurance:'http://127.0.0.1:4522',lender:'http://127.0.0.1:4523',contractor:'http://127.0.0.1:4524',senior:'http://127.0.0.1:4525',investor:'http://127.0.0.1:4529'}};
  const identity={hub:'move' as const,nativeId:options.nativeId??'fixture-mover',profileClass:'mover'};
  const manifest:GuestStageInput={version:TRANSFER_VERSION,sourceHub:'move',audience:'ask',selected:[{localItemId:'fixture-mover',revision:'1',digest:'a'.repeat(64),profile:identity}],returnTask:{kind:'profile',hub:'move',canonicalSlug:identity.nativeId,profile:identity}};
  const backend=new SqliteHarnessBackend(join(mkdtempSync(join(tmpdir(),'b4-browser-')),'qa.sqlite'));
  backend.profiles.set(profileKey(identity),{...identity,published:true,supportedClass:true,binding:{id:'fixture-binding',networkEntityId:'fixture-entity',status:'accepted'}});
  let caller:VerifiedCaller={hub:'move',browserBinding:'b'.repeat(43),environment,scopes:['transfer:stage','saved:write','receipt:verify']};
  const runtime=new ParentProfileSaveRuntime({enabled:true,backend,registry,now:()=>now,authenticate:async()=>caller});
  const stage=await runtime.execute('prepareGuestProfileTransfer',manifest) as GuestStageRef;
  const continuation=await runtime.execute('prepareProfileSaveContinuation',{sourceHub:'move',audience:'ask',transferRef:stage.transferRef,manifestDigest:stage.manifestDigest}) as {continuationRef:string};
  // Source snapshot is obtained by a separate mocked authenticated service, NOT
  // by reading the parent's SQLite tables. Concrete service credentials NOT RUN.
  const records=new Map<string,Confirmation>();const checkpoints:Confirmation[]=[];let acks=0,unsaves=0,refuseUnsave=false;
  const released:string[]=[];
  const first:SourceSnapshot={...continuation,...stage,manifest,browserProof:caller.browserBinding,requestPrefix:'r'.repeat(43)} as SourceSnapshot;
  const sources=new Map<string,SourceSnapshot>([[continuation.continuationRef,first]]);
  const b:BrowserBindings={origin,registry,now:()=>now,source:async(_r,ref)=>sources.get(ref)??first,
    parent:async()=>parent,projects:async()=>options.zeroProjects?[]:[{ref:'p'.repeat(43),label:'Test Project'}],
    store:{put:async(k,v)=>{records.set(k,v);},withRecord:async(k,work)=>work(records.get(k)??null,async()=>{const c=records.get(k);if(c)checkpoints.push(structuredClone(c));})},
    runtime:async(_r,c,p)=>{caller={...caller,parent:{subject:p.subject,sessionBinding:p.session,admitted:true},exchange:c.contextCandidateRef??'fixture-exchange',selectionConfirmed:true,confirmedTransferRef:c.source.transferRef,confirmedAccountContextRef:c.contextCandidateRef};return runtime;},
    acknowledge:async(_s,receipts)=>{acks++;if(receipts.every(r=>r.parent.outcome==='local_only'))released.push(receipts[0]!.requestKey);},
    // Owner-scoped removal stand-in: only the verified parent's own row.
    unsave:async(_r,_c,p)=>{unsaves++;if(refuseUnsave)throw new Error('Saved entity still belongs to one or more Projects');
      return Number(backend.db.prepare('DELETE FROM saves WHERE subject=?').run(p.subject).changes)>0?'removed':'not_saved';}};
  const post=(body:string,cookie='',from=origin)=>new Request(origin+PROFILE_CONFIRM_PATH,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:from,cookie},body});
  const arrivalBody=(ref:string,intent?:string)=>new URLSearchParams({continuationRef:ref,...(intent?{intent}:{})}).toString();
  const arrival=await handleProfileConfirmation(post(arrivalBody(continuation.continuationRef,options.intent),'',sourceOrigin),b);
  assert.equal(arrival.status,303);const cookie=arrival.headers.get('set-cookie')!.split(';')[0];
  const get=()=>handleProfileConfirmation(new Request(origin+PROFILE_CONFIRM_PATH,{headers:{cookie}}),b);
  const confirm=async(project='')=>{const page=await (await get()).text();const csrf=/name="csrf" value="([^"]+)"/.exec(page)?.[1];return handleProfileConfirmation(post(new URLSearchParams({csrf:csrf??'',confirm:'yes',project}).toString(),cookie),b);};
  // A later click from the same source profile: fresh stage, continuation and request prefix.
  let clicks=0;
  const stage2=async()=>{
    const s=await runtime.execute('prepareGuestProfileTransfer',manifest) as GuestStageRef;
    const k=await runtime.execute('prepareProfileSaveContinuation',{sourceHub:'move',audience:'ask',transferRef:s.transferRef,manifestDigest:s.manifestDigest}) as {continuationRef:string};
    sources.set(k.continuationRef,{...k,...s,manifest,browserProof:caller.browserBinding,requestPrefix:String(++clicks).repeat(43).slice(0,43)} as SourceSnapshot);
    return k;
  };
  const again=async(intent?:DirectIntent)=>{
    const k=await stage2();
    const r=await handleProfileConfirmation(post(arrivalBody(k.continuationRef,intent),'',sourceOrigin),b);
    assert.equal(r.status,303);const next=r.headers.get('set-cookie')!.split(';')[0];
    return {cookie:next,get:()=>handleProfileConfirmation(new Request(origin+PROFILE_CONFIRM_PATH,{headers:{cookie:next}}),b)};
  };
  return {b,backend,get,confirm,post,cookie,records,origin,sourceOrigin,continuation,checkpoints,again,arrivalBody,stage:stage2,get acks(){return acks;},get unsaves(){return unsaves;},
    /** Request keys the parent acknowledged as no longer saved in the account. */
    released,refuseUnsave(value=true){refuseUnsave=value;},
    login(subject='consumer-a',session='session-a'){parent={subject,session,label:'Test account'};},logout(){parent=null;},expire(){now=700000;},close(){backend.close();}};
}
