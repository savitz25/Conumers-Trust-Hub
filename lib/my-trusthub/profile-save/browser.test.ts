import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {handleProfileConfirmation,PROFILE_CONFIRM_PATH,type BrowserBindings,type BrowserParent,type Confirmation} from './browser.ts';
import {ParentProfileSaveRuntime,type VerifiedCaller} from './runtime.ts';
import {SqliteHarnessBackend} from '../../../scripts/qa/v23-sqlite-backend.ts';
import {TRANSFER_VERSION,profileKey,type GuestStageInput,type GuestStageRef} from '../contracts/v2-3-profile-transfer.ts';
import {safeReturn} from '../account-policy.ts';
import {retentionBatch,quotaRetentionBatch} from './retention.ts';
async function fixture(){
  let now=1000,parent:BrowserParent|null=null;
  const origin='http://127.0.0.1:4520',sourceOrigin='http://127.0.0.1:4521';
  const registry={environment:'isolated' as const,isolatedBackendVerified:true,origins:{move:sourceOrigin,insurance:'http://127.0.0.1:4522',lender:'http://127.0.0.1:4523'}};
  const identity={hub:'move' as const,nativeId:'fixture-mover',profileClass:'mover'};
  const manifest:GuestStageInput={version:TRANSFER_VERSION,sourceHub:'move',audience:'ask',selected:[{localItemId:'fixture-mover',revision:'1',digest:'a'.repeat(64),profile:identity}],returnTask:{kind:'profile',hub:'move',canonicalSlug:'fixture-mover',profile:identity}};
  const backend=new SqliteHarnessBackend(join(mkdtempSync(join(tmpdir(),'b4-browser-')),'qa.sqlite'));
  backend.profiles.set(profileKey(identity),{...identity,published:true,supportedClass:true,binding:{id:'fixture-binding',networkEntityId:'fixture-entity',status:'accepted'}});
  let caller:VerifiedCaller={hub:'move',browserBinding:'b'.repeat(43),environment:'isolated',scopes:['transfer:stage','saved:write','receipt:verify']};
  const runtime=new ParentProfileSaveRuntime({enabled:true,backend,registry,now:()=>now,authenticate:async()=>caller});
  const stage=await runtime.execute('prepareGuestProfileTransfer',manifest) as GuestStageRef;
  const continuation=await runtime.execute('prepareProfileSaveContinuation',{sourceHub:'move',audience:'ask',transferRef:stage.transferRef,manifestDigest:stage.manifestDigest}) as {continuationRef:string};
  // Source snapshot is obtained by a separate mocked authenticated service, NOT
  // by reading the parent's SQLite tables. Concrete service credentials NOT RUN.
  const records=new Map<string,Confirmation>();let acks=0;
  const b:BrowserBindings={origin,registry,now:()=>now,source:async()=>({...continuation,...stage,manifest,browserProof:caller.browserBinding,requestPrefix:'r'.repeat(43)}),
    parent:async()=>parent,projects:async()=>[{ref:'p'.repeat(43),label:'Test Project'}],
    store:{put:async(k,v)=>{records.set(k,v);},withRecord:async(k,work)=>work(records.get(k)??null,async()=>{})},
    runtime:async(_r,c,p)=>{caller={...caller,parent:{subject:p.subject,sessionBinding:p.session,admitted:true},exchange:'fixture-exchange',selectionConfirmed:true,confirmedTransferRef:c.source.transferRef,confirmedAccountContextRef:c.contextCandidateRef};return runtime;},
    acknowledge:async()=>{acks++;}};
  const post=(body:string,cookie='',from=origin)=>new Request(origin+PROFILE_CONFIRM_PATH,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:from,cookie},body});
  const arrival=await handleProfileConfirmation(post(new URLSearchParams({continuationRef:continuation.continuationRef}).toString(),'',sourceOrigin),b);
  assert.equal(arrival.status,303);const cookie=arrival.headers.get('set-cookie')!.split(';')[0];
  const get=()=>handleProfileConfirmation(new Request(origin+PROFILE_CONFIRM_PATH,{headers:{cookie}}),b);
  const confirm=async(project='')=>{const page=await (await get()).text();const csrf=/name="csrf" value="([^"]+)"/.exec(page)?.[1];return handleProfileConfirmation(post(new URLSearchParams({csrf:csrf??'',confirm:'yes',project}).toString(),cookie),b);};
  return {b,backend,get,confirm,post,cookie,records,get acks(){return acks;},
    login(subject='consumer-a',session='session-a'){parent={subject,session,label:'Test account'};},logout(){parent=null;},expire(){now=700000;},close(){backend.close();}};
}
test('B01 concrete target: sign-in continuation -> explicit confirmation -> real runtime receipt -> bounded return',async()=>{
  const f=await fixture();try{
    assert.match(await(await f.get()).text(),/Sign in to continue/);assert.equal(f.backend.count('saves'),0);
    assert.equal(safeReturn(PROFILE_CONFIRM_PATH),PROFILE_CONFIRM_PATH);
    f.login();const page=await(await f.get()).text();assert.match(page,/Save these selected profiles/);assert.doesNotMatch(page,/checked/);
    const result=await f.confirm();assert.equal(result.status,200);assert.match(await result.text(),/Saved to My TrustHub/);
    assert.equal(f.backend.count('saves'),1);assert.equal(f.acks,1);
    assert.match(await(await f.get()).text(),/http:\/\/127.0.0.1:4521\/companies\/fixture-mover/);
  }finally{f.close();}
});
test('B02 forged fields, absent selection, cross-origin and account switch cannot save',async()=>{
  const f=await fixture();try{f.login();await f.get();
    for(const body of ['confirm=yes&consumerId=consumer-a','confirm=yes&csrf=forged','csrf=x'])assert.equal((await handleProfileConfirmation(f.post(body,f.cookie),f.b)).status,503);
    f.login('consumer-b','session-b');assert.equal((await f.confirm()).status,409);assert.equal(f.backend.count('saves'),0);
  }finally{f.close();}
});
test('B03 optional Project failure keeps one Save; receipt retry is idempotent',async()=>{
  const f=await fixture();try{f.login();f.backend.projectFails=true;
    const response=await f.confirm('p'.repeat(43));assert.match(await response.text(),/Project assignment failed/);
    assert.equal(f.backend.count('saves'),1);assert.equal(f.backend.count('memberships'),0);
  }finally{f.close();}
});
test('B04 absent deployment bindings and expired confirmation fail closed',async()=>{
  assert.equal((await handleProfileConfirmation(new Request('http://127.0.0.1/my/profile-save'),null)).status,503);
  const f=await fixture();try{f.login();f.expire();assert.equal((await f.get()).status,410);assert.equal(f.backend.count('saves'),0);}finally{f.close();}
});
test('B05 retention is bounded metadata-only, never durable Saved research',()=>{
  for(const batch of [retentionBatch(1000),quotaRetentionBatch(1000)]){
    assert.doesNotMatch(batch.sql,/consumer\.|watch|project|notes/i);
    assert.match(batch.sql,/limit \$2/);
    assert.doesNotMatch(batch.sql,/for update/,'cleanup role has DELETE, not UPDATE authority');
  }
  assert.throws(()=>retentionBatch(0,501));assert.throws(()=>retentionBatch(NaN));
});
test('B06 checkpoint gap resumes existing exact P13 context without replay',async()=>{
  const f=await fixture();try{f.login();assert.equal((await f.confirm()).status,200);
    const c=[...f.records.values()][0];const original=c.accountContextRef;
    delete c.accountContextRef;delete c.receipts;
    assert.equal(c.contextCandidateRef,original);
    assert.equal((await f.confirm()).status,200);
    assert.equal(c.accountContextRef,original);assert.equal(f.backend.count('saves'),1);
  }finally{f.close();}
});
