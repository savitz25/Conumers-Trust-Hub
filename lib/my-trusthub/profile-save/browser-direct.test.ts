import assert from 'node:assert/strict';
import test from 'node:test';
import {handleProfileConfirmation} from './browser.ts';
import {fixture} from './browser.fixture.ts';

const RETURN='https://www.movetrusthub.com/companies/fixture-mover';
const back=(r:Response)=>{assert.equal(r.status,303);assert.equal(r.headers.get('location'),RETURN);};

test('OC-A one-click Save with a verified parent session: one Saved row, no confirmation form, straight back to the profile',async()=>{
  const f=await fixture({environment:'production',intent:'save'});try{
    f.login();back(await f.get());
    assert.equal(f.backend.count('saves'),1);assert.equal(f.acks,1);
    // No Project is ever attached by a one-click Save.
    assert.equal(f.backend.count('memberships'),0);
  }finally{f.close();}
});

test('OC-B repeated Save is idempotent: reload and a second click never duplicate the Saved row',async()=>{
  const f=await fixture({environment:'production',intent:'save'});try{
    f.login();back(await f.get());back(await f.get());assert.equal(f.backend.count('saves'),1);
    const second=await f.again('save');back(await second.get());
    // Both arrivals really committed (first, its reload, second click) against one row.
    assert.equal(f.acks,3);
    assert.equal(f.backend.count('saves'),1);
  }finally{f.close();}
});

test('OC-C one-click Unsave with a verified parent session removes only that owner\'s Saved row',async()=>{
  const f=await fixture({environment:'production',intent:'save'});try{
    f.login();back(await f.get());assert.equal(f.backend.count('saves'),1);
    // Another account's Unsave cannot touch it.
    f.login('consumer-b','session-b');back(await (await f.again('unsave')).get());
    assert.equal(f.unsaves,1);assert.equal(f.backend.count('saves'),1);
    f.login();const unsave=await f.again('unsave');back(await unsave.get());
    assert.equal(f.unsaves,2);assert.equal(f.backend.count('saves'),0);
    // The Unsave arrival never accepts a posted confirmation and never saves.
    assert.equal((await handleProfileConfirmation(f.post('csrf=x&confirm=yes',unsave.cookie),f.b)).status,503);
    assert.equal(f.backend.count('saves'),0);
    // Save is available again afterwards.
    back(await (await f.again('save')).get());assert.equal(f.backend.count('saves'),1);
  }finally{f.close();}
});

test('OC-D parent Save failure returns to the profile with no acknowledgement (no false account success)',async()=>{
  const f=await fixture({environment:'production',intent:'save'});try{
    f.login();f.backend.failReceipt=true;back(await f.get());
    assert.equal(f.acks,0);
  }finally{f.close();}
});

test('OC-E signed out: Save and Unsave return without asking; the staged continuation finishes after sign-in',async()=>{
  const f=await fixture({environment:'production',intent:'save'});try{
    back(await f.get());assert.equal(f.backend.count('saves'),0);assert.equal(f.acks,0);
    back(await (await f.again('unsave')).get());assert.equal(f.unsaves,0);
    // Same staged continuation, now authenticated: completes with no further step.
    f.login();back(await f.get());assert.equal(f.backend.count('saves'),1);assert.equal(f.acks,1);
  }finally{f.close();}
  const g=await fixture({environment:'production',intent:'save_signin'});try{
    const gate=await g.get();assert.equal(gate.status,200);assert.match(await gate.text(),/Sign in to continue/);
    assert.equal(g.backend.count('saves'),0);
    g.login();back(await g.get());assert.equal(g.backend.count('saves'),1);
  }finally{g.close();}
});

test('OC-F/G Save and Unsave write Saved rows only: no Watch store exists on this path',async()=>{
  const f=await fixture({environment:'production',intent:'save'});try{
    f.login();back(await f.get());back(await (await f.again('unsave')).get());
    const tables=f.backend.db.prepare("SELECT group_concat(name) AS names FROM (SELECT name FROM sqlite_master WHERE type='table' ORDER BY name)").get() as {names:string};
    assert.equal(tables.names,'consumed,memberships,objects,quota,saves');
    assert.equal(Object.keys(f.b).some(k=>/watch/i.test(k)),false);
  }finally{f.close();}
});

test('OC-H arrival accepts only the three intents from the Move origin; the explicit form is unchanged without one',async()=>{
  const f=await fixture({environment:'production'});try{
    const arrive=(body:string,from=f.sourceOrigin)=>handleProfileConfirmation(f.post(body,'',from),f.b);
    const ref=f.continuation.continuationRef;
    assert.equal((await arrive(f.arrivalBody(ref,'watch'))).status,503);
    assert.equal((await arrive(`continuationRef=${ref}&intent=save&intent=unsave`)).status,503);
    assert.equal((await arrive(f.arrivalBody(ref,'save'),'https://movetrusthub.com')).status,503);
    assert.equal((await arrive(f.arrivalBody(ref,'save'),f.origin)).status,503);
    // No intent: sign-in gate then the existing confirmation form; nothing is saved by a GET.
    f.login();assert.match(await(await f.get()).text(),/Save these selected profiles/);
    assert.equal(f.backend.count('saves'),0);
  }finally{f.close();}
});
