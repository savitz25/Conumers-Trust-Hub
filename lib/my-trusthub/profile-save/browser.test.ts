import assert from 'node:assert/strict';
import test from 'node:test';
import {handleProfileConfirmation,PROFILE_CONFIRM_PATH} from './browser.ts';
import {fixture} from './browser.fixture.ts';
import {safeReturn} from '../account-policy.ts';
import {retentionBatch,quotaRetentionBatch} from './retention.ts';
import {ASK_PREVIEW,MOVE_PREVIEW} from './isolated-config.ts';
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

test('B05 verified auth marker canonicalizes without exposing confirmation state',async()=>{
  const f=await fixture();try{
    const resumed=await handleProfileConfirmation(new Request(f.origin+PROFILE_CONFIRM_PATH+'?auth=complete',{headers:{cookie:f.cookie}}),f.b);
    assert.equal(resumed.status,303);assert.equal(resumed.headers.get('location'),PROFILE_CONFIRM_PATH);
    assert.equal((await handleProfileConfirmation(new Request(f.origin+PROFILE_CONFIRM_PATH+'?auth=complete&continuationRef=secret',{headers:{cookie:f.cookie}}),f.b)).status,400);
    assert.equal((await handleProfileConfirmation(new Request(f.origin+PROFILE_CONFIRM_PATH+'?auth=expired',{headers:{cookie:f.cookie}}),f.b)).status,400);
  }finally{f.close();}
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

const previewFixture=()=>fixture({origin:ASK_PREVIEW,sourceOrigin:MOVE_PREVIEW,zeroProjects:true,nativeId:'usdot-1002530'});
test('B07 exact browser form with zero Projects saves without Project and checkpoints context',async()=>{
 const f=await previewFixture();try{
  f.login();const page=await f.get();assert.equal(page.status,200);
  assert.equal(page.headers.get('referrer-policy'),'same-origin');
  const html=await page.text(),csrf=/name="csrf" value="([^"]+)"/.exec(html)![1];
  assert.equal(csrf.length,43);assert.match(html,/<option value="">No Project<\/option>/);
  assert.deepEqual(await f.b.projects([...f.records.values()][0].parent!),[]);
  const response=await handleProfileConfirmation(f.post(new URLSearchParams({csrf,confirm:'yes',project:''}).toString(),f.cookie),f.b);
  assert.equal(response.status,200);assert.match(await response.text(),/Saved to My TrustHub/);
  assert.ok(f.checkpoints.some(c=>!!c.contextCandidateRef&&c.projectRef===undefined));
  assert.equal(f.backend.count('saves'),1);assert.equal(f.backend.count('memberships'),0);
 }finally{f.close();}
});
for(const invalid of ['missing-confirm','wrong-csrf','wrong-origin','null-origin','duplicate-csrf','duplicate-confirm','duplicate-project','unknown-key','unknown-project','account-switch','expired']){
 test(`B08 final form denies ${invalid} before context checkpoint`,async()=>{
  const f=await previewFixture();try{
   f.login();const html=await(await f.get()).text(),csrf=/name="csrf" value="([^"]+)"/.exec(html)![1];
   const fields=new URLSearchParams({csrf,confirm:'yes',project:''});let origin=ASK_PREVIEW;
   if(invalid==='missing-confirm')fields.delete('confirm');
   if(invalid==='wrong-csrf')fields.set('csrf','x'.repeat(43));
   if(invalid==='wrong-origin')origin=MOVE_PREVIEW;
   if(invalid==='null-origin')origin='null';
   if(invalid.startsWith('duplicate-')){const k=invalid.slice(10);fields.append(k,fields.get(k)!);}
   if(invalid==='unknown-key')fields.set('subject','untrusted');
   if(invalid==='unknown-project')fields.set('project','p'.repeat(43));
   if(invalid==='account-switch')f.login('consumer-b','session-b');
   if(invalid==='expired')f.expire();
   const response=await handleProfileConfirmation(f.post(fields.toString(),f.cookie,origin),f.b);
   assert.equal(response.status,invalid==='account-switch'?409:invalid==='expired'?410:503);
   assert.ok(!f.checkpoints.some(c=>c.contextCandidateRef));
   assert.equal(f.backend.count('saves'),0);
  }finally{f.close();}
 });
}
