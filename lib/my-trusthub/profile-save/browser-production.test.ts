import assert from 'node:assert/strict';
import test from 'node:test';
import {handleProfileConfirmation,PROFILE_CONFIRM_PATH,trustedBrowserRegistry} from './browser.ts';
import {fixture} from './browser.fixture.ts';

const ORIGINS={move:'https://www.movetrusthub.com',insurance:'',lender:'',contractor:'',senior:'',investor:''};

test('BP1 registry admission: isolated+verified and production+unverified only',async()=>{
  assert.equal(trustedBrowserRegistry({environment:'isolated',isolatedBackendVerified:true,origins:ORIGINS}),true);
  assert.equal(trustedBrowserRegistry({environment:'isolated',isolatedBackendVerified:false,origins:ORIGINS}),false);
  assert.equal(trustedBrowserRegistry({environment:'production',isolatedBackendVerified:false,origins:ORIGINS}),true);
  assert.equal(trustedBrowserRegistry({environment:'production',isolatedBackendVerified:true,origins:ORIGINS}),false);
  assert.equal(trustedBrowserRegistry({environment:'staging' as never,isolatedBackendVerified:false,origins:ORIGINS}),false);
  // The same rule gates the HTTP surface: a mismatched binding is unavailable before any state is touched.
  for(const [environment,isolatedBackendVerified] of [['isolated',false],['production',true]] as const){
    const f=await fixture();try{
      const b={...f.b,registry:{...f.b.registry,environment,isolatedBackendVerified}};
      assert.equal((await handleProfileConfirmation(new Request(f.origin+PROFILE_CONFIRM_PATH,{headers:{cookie:f.cookie}}),b)).status,503);
      f.login();assert.equal((await handleProfileConfirmation(f.post('csrf=x&confirm=yes',f.cookie),b)).status,503);
      assert.equal(f.backend.count('saves'),0);
    }finally{f.close();}
  }
});

test('BP2 production bindings: continuation arrival -> sign-in gate -> confirmation -> one Save -> canonical return',async()=>{
  const f=await fixture({environment:'production'});try{
    assert.equal(f.b.registry.environment,'production');assert.equal(f.b.registry.isolatedBackendVerified,false);
    assert.match(await(await f.get()).text(),/Sign in to continue/);assert.equal(f.backend.count('saves'),0);
    f.login();const page=await(await f.get()).text();assert.match(page,/Save these selected profiles/);
    const result=await f.confirm();assert.equal(result.status,200);assert.match(await result.text(),/Saved to My TrustHub/);
    assert.equal(f.backend.count('saves'),1);assert.equal(f.acks,1);
    assert.match(await(await f.get()).text(),/https:\/\/www\.movetrusthub\.com\/companies\/fixture-mover/);
    // Revisiting the confirmation after the receipt re-renders it and never duplicates the Save;
    // a re-POST without the live CSRF is still refused.
    assert.match(await(await f.get()).text(),/Saved to My TrustHub/);assert.equal(f.backend.count('saves'),1);
    assert.equal((await handleProfileConfirmation(f.post('csrf=stale&confirm=yes&project=',f.cookie),f.b)).status,503);assert.equal(f.backend.count('saves'),1);
  }finally{f.close();}
});

test('BP3 production bindings still reject wrong origin, invalid continuation, bad CSRF, account switch and expiry',async()=>{
  const f=await fixture({environment:'production'});try{
    // Continuation arrival from a non-Move origin or with an invalid reference.
    const arrival=(body:string,from:string)=>handleProfileConfirmation(f.post(body,'',from),f.b);
    assert.equal((await arrival(new URLSearchParams({continuationRef:f.continuation.continuationRef}).toString(),'https://movetrusthub.com')).status,503);
    assert.equal((await arrival(new URLSearchParams({continuationRef:f.continuation.continuationRef}).toString(),'https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app')).status,503);
    assert.equal((await arrival(new URLSearchParams({continuationRef:'x'.repeat(42)}).toString(),'https://www.movetrusthub.com')).status,503);
    assert.equal((await arrival(new URLSearchParams({continuationRef:f.continuation.continuationRef,extra:'1'}).toString(),'https://www.movetrusthub.com')).status,503);
    // Final form: wrong Origin, forged/missing CSRF.
    f.login();await f.get();
    const page=await(await f.get()).text();const csrf=/name="csrf" value="([^"]+)"/.exec(page)![1];
    assert.equal((await handleProfileConfirmation(f.post(new URLSearchParams({csrf,confirm:'yes',project:''}).toString(),f.cookie,'https://asktrusthub.com'),f.b)).status,503);
    assert.equal((await handleProfileConfirmation(f.post(new URLSearchParams({csrf,confirm:'yes',project:''}).toString(),f.cookie,'null'),f.b)).status,503);
    assert.equal((await handleProfileConfirmation(f.post('csrf=forged&confirm=yes&project=',f.cookie),f.b)).status,503);
    assert.equal((await handleProfileConfirmation(f.post('confirm=yes&project=',f.cookie),f.b)).status,503);
    assert.equal(f.backend.count('saves'),0);
    // Account switch after the confirmation was opened.
    f.login('consumer-b','session-b');assert.equal((await f.confirm()).status,409);assert.equal(f.backend.count('saves'),0);
    // Expiry.
    f.login();f.expire();assert.equal((await f.get()).status,410);assert.equal(f.backend.count('saves'),0);
  }finally{f.close();}
});
