import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HUBS, PROJECTS, SCOPE, parseArgs, plan, fingerprint, cliWriter, run } from './mth-v2-specialist-keys.mjs';

// Throwaway in-memory unit-test keys only. No production keys, files, token,
// connector, Vercel project, network request, or real CLI apply is used.
const pairs = Array.from({ length: 12 }, () => generateKeyPairSync('ed25519'));
const publicPem = pair => pair.publicKey.export({ type:'spki', format:'pem' }).toString();
const record = (hub, n, date='20261007') => ({ kid:`${hub}-v23-prod-${date}`, publicKeyPem:publicPem(pairs[n]) });
const stamp = '2026-10-07T20:00:00.000Z';
const now = Date.parse(stamp);
const name = (hub,suffix) => `MY_TRUSTHUB_V23_${hub.toUpperCase()}_${suffix}`;
function fixture(hubs=HUBS) {
  const metadata = { source:'approved-vercel-connector', scope:SCOPE, decrypted:false, capturedAt:stamp,
    projects:Object.fromEntries(Object.entries(PROJECTS).map(([h,n],i) => [h,{name:n,id:`prj_TEST${i}`,environment:'production',env:[]}])) };
  const inventory = { source:'approved-public-key-inventory', scope:SCOPE, capturedAt:stamp, complete:true, additionalKeys:[],
    askCopies:Object.fromEntries(HUBS.map(h=>[h,{kid:null,publicKeyPem:null}])),
    keys:{ ask:record('ask',0), move:record('move',1), ...Object.fromEntries(HUBS.map(h => [h,null])) } };
  const args=['--apply','--placement','specialist',...hubs.flatMap(h=>['--hub',h]),'--date','20261008',
    '--metadata','metadata','--public-inventory','inventory','--ask-spki-sha256',fingerprint(inventory.keys.ask.publicKeyPem),
    '--public-bundle','public-bundle','--vercel-cli','MOCK-CLI.mjs','--closed-gates-confirmed'];
  const options=parseArgs(args), logs=[], calls=[];
  let generated=0, receipt;
  const deps={ now, output:line=>logs.push(line),
    readJson:path=>structuredClone(path==='metadata'?metadata:path==='inventory'?inventory:receipt),
    generate:()=>pairs[2+generated++],
    reserveBundle:(_path,value)=>{receipt=structuredClone(value); return {save:v=>{receipt=structuredClone(v);},close:()=>{}};},
    writeEnv:cliWriter('MOCK-CLI.mjs',(_exe,argv,opts)=>{
      calls.push({argv,input:Buffer.from(opts.input),options:opts}); return {status:0,stdout:'',stderr:''};
    }) };
  return {options,metadata,inventory,deps,logs,calls,get generated(){return generated;},get receipt(){return receipt;}};
}
const rejects = async (f, code) => {
  await assert.rejects(run(f.options,f.deps), error=>error.message===code);
  assert.equal(f.calls.length,0,'guard must abort before any Vercel write');
};

test('dry-run defaults offline: names only, no key generation, reads or CLI', async()=>{
  const f=fixture();
  await run(parseArgs([]),{output:s=>f.logs.push(s),generate:()=>assert.fail('generation'),readJson:()=>assert.fail('read'),writeEnv:()=>assert.fail('write')});
  assert.equal(f.logs.length,31);
  assert.ok(f.logs.some(s=>s.includes('investor-trust-hub-web')));
  assert.ok(f.logs.some(s=>s.includes('care-trust-hub')));
  assert.ok(f.logs.some(s=>s.includes('MY_TRUSTHUB_V23_PARENT_ORIGIN')));
  assert.equal(f.logs.some(s=>/PRIVATE KEY/.test(s)),false);
});

test('explicit hubs and placement required; unknown, all, force and conflicting flags rejected',()=>{
  for(const args of [['--apply'],['--apply','--hub','all'],['--hub','move'],['--force'],['--apply','--dry-run'],['--hub','lender','--hub','lender']]) {
    assert.throws(()=>parseArgs(args));
  }
});

test('five distinct specialists: exact target names, private stdin sensitive, no Ask/Move rotation',async()=>{
  const f=fixture(); await run(f.options,f.deps);
  assert.equal(f.generated,5); assert.equal(f.calls.length,21);
  assert.equal(f.receipt.state,'specialists-written');
  assert.equal(new Set(Object.values(f.receipt.keys).map(k=>fingerprint(k.publicKeyPem))).size,5);
  for(const c of f.calls) {
    const key=c.argv[3];
    assert.equal(c.argv.includes('--value'),false);
    assert.equal(c.argv.includes('--force'),false);
    assert.equal(c.argv.includes('prj_TEST0'),false);
    assert.equal(c.argv.includes('prj_TEST1'),false);
    assert.equal(c.argv.includes('--sensitive'),key.endsWith('_SIGNING_PRIVATE_KEY_PEM'));
    assert.equal(c.argv.some(a=>/PRIVATE KEY/.test(a)),false);
    assert.deepEqual(c.options.stdio,['pipe','pipe','pipe']);
    assert.equal(c.options.windowsHide,true);
  }
  assert.equal(/PRIVATE KEY/.test(JSON.stringify(f.receipt)),false);
  assert.ok(f.calls.find(c=>c.argv[3]==='MY_TRUSTHUB_V23_PARENT_ORIGIN').input.equals(Buffer.from('https://www.asktrusthub.com')));
});

test('dup-SPKI guard includes Ask, Move, generated peers and installed specialists',async()=>{
  for(const n of [0,1]) { const f=fixture(['lender']); f.deps.generate=()=>pairs[n]; await rejects(f,'DUPLICATE_SPKI'); }
  const peers=fixture(['lender','investor']); peers.deps.generate=()=>pairs[2]; await rejects(peers,'DUPLICATE_SPKI');
  const installed=fixture(['lender']); installed.inventory.keys.senior=record('senior',2);
  installed.metadata.projects.ask.env=[{key:name('senior','KEY_ID'),type:'config'},{key:name('senior','VERIFY_PUBLIC_KEY_PEM'),type:'config'}];
  await rejects(installed,'DUPLICATE_SPKI');
});

test('dup-KID guard rejects reused hub/date before writes',async()=>{
  const f=fixture(['lender']); f.inventory.keys.lender=record('lender',8,'20261008');
  f.metadata.projects.ask.env=[{key:name('lender','KEY_ID'),type:'config'},{key:name('lender','VERIFY_PUBLIC_KEY_PEM'),type:'config'}];
  await rejects(f,'DUPLICATE_KID');
});

test('KID-format and calendar guard',async()=>{
  const f=fixture(['lender']); f.inventory.keys.move.kid='bad'; await rejects(f,'KID_FORMAT');
  const g=fixture(['lender']); g.options.date='20260231'; await rejects(g,'KID_DATE_INVALID');
});

test('existing-name refusal precedes generation; replace is exact and never permits Ask/Move replacement',async()=>{
  const f=fixture(['insurance']); f.metadata.projects.insurance.env=[{key:'MY_TRUSTHUB_V23_PARENT_ORIGIN',type:'config'}];
  await rejects(f,'TARGET_NAME_EXISTS'); assert.equal(f.generated,0);
  f.options.replace=['MY_TRUSTHUB_V23_PARENT_ORIGIN']; await run(f.options,f.deps);
  assert.equal(f.calls.filter(c=>c.argv.includes('--force')).length,1);
  const g=fixture(['lender']); g.options.replace=[name('ask','KEY_ID')]; await rejects(g,'REPLACE_NOT_SELECTED_OR_PROTECTED');
  const h=fixture(['lender']); h.options.replace=[name('investor','KEY_ID')]; await rejects(h,'REPLACE_NOT_SELECTED_OR_PROTECTED');
});

test('Ask-fingerprint guard; public input never accepts a private PEM',async()=>{
  const f=fixture(['lender']); f.options.askFingerprint='0'.repeat(64); await rejects(f,'ASK_FINGERPRINT_MISMATCH'); assert.equal(f.generated,0);
  const g=fixture(['lender']); g.inventory.keys.ask.publicKeyPem=pairs[0].privateKey.export({type:'pkcs8',format:'pem'}).toString();
  await rejects(g,'PRIVATE_MATERIAL_IN_PUBLIC_INPUT');
});

test('complete fresh metadata required; no decrypted values and no missing existing public key',async()=>{
  const f=fixture(); f.metadata.capturedAt='2026-10-06T00:00:00Z'; await rejects(f,'STALE_OR_INVALID_CONNECTOR_SNAPSHOT');
  const g=fixture(); g.metadata.decrypted=true; await rejects(g,'APPROVED_METADATA_REQUIRED');
  const h=fixture(); h.metadata.projects.ask.env=[{key:'EXAMPLE',type:'config',value:'forbidden'}]; await rejects(h,'NAME_ONLY_METADATA_REQUIRED');
  const j=fixture(); j.metadata.projects.senior.env=[{key:name('senior','KEY_ID'),type:'config'},{key:name('senior','SIGNING_PRIVATE_KEY_PEM'),type:'secret'}]; await rejects(j,'INVENTORY_METADATA_DISAGREE');
});

test('lowercase and mixed-case inventory names pass; written targets stay uppercase',async()=>{
  const f=fixture(['lender']);
  f.metadata.projects.ask.env=[{key:'neon_tech_database',type:'sensitive'}];
  f.metadata.projects.insurance.env=[{key:'ImprovMX_API',type:'encrypted'}];
  f.metadata.projects.move.env=[
    {key:'_leading_underscore',type:'plain'},
    {key:'a'.repeat(256),type:'config'},
    {key:'MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED',type:'plain'}];
  await run(f.options,f.deps);
  assert.ok(f.calls.length>0);
  assert.ok(f.calls.every(c=>/^[A-Z0-9_]+$/.test(c.argv[3])));
  assert.equal(f.calls.some(c=>c.argv[3]==='neon_tech_database'||c.argv[3]==='ImprovMX_API'),false);
  const existing=fixture(['lender']);
  existing.metadata.projects.lender.env=[
    {key:name('lender','KEY_ID'),type:'config'},
    {key:name('lender','SIGNING_PRIVATE_KEY_PEM'),type:'secret'}];
  existing.inventory.keys.lender=record('lender',8,'20261001');
  await rejects(existing,'TARGET_NAME_EXISTS');
});

test('case-only controlled names, malformed names, and exact duplicates fail closed',async()=>{
  for(const key of ['my_trusthub_v23_lender_key_id','MY_TRUSTHUB_V23_ask_KEY_ID','my_trusthub_v23_move_verify_public_key_pem','MY_TRUSTHUB_V23_parent_ORIGIN','my_trusthub_v23_profile_save_enabled']) {
    const f=fixture(['lender']); f.metadata.projects.ask.env=[{key,type:'config'}];
    await rejects(f,'NAME_ONLY_METADATA_REQUIRED');
  }
  for(const key of ['','1PASSWORD','HAS SPACE','HAS=VALUE','has-hyphen','dot.name','a/b','-----BEGIN PUBLIC KEY-----','x'.repeat(257),'quote"name',"quote'name",'line\nbreak','{json:1}','https://example.com',123]) {
    const f=fixture(['lender']); f.metadata.projects.ask.env=[{key,type:'config'}];
    await rejects(f,'NAME_ONLY_METADATA_REQUIRED');
  }
  const valued=fixture(['lender']);
  valued.metadata.projects.ask.env=[{key:'neon_tech_database',type:'sensitive',value:'secret'}];
  await rejects(valued,'NAME_ONLY_METADATA_REQUIRED');
  const typed=fixture(['lender']);
  typed.metadata.projects.insurance.env=[{key:'ImprovMX_API',type:'public'}];
  await rejects(typed,'NAME_ONLY_METADATA_REQUIRED');
  const dup=fixture(['lender']);
  dup.metadata.projects.ask.env=[{key:'neon_tech_database',type:'sensitive'},{key:'neon_tech_database',type:'config'}];
  await rejects(dup,'DUPLICATE_ENV_METADATA');
});

test('Ask phase uses successful public bundles, no generation, only ten Ask verify names',async()=>{
  const f=fixture(); await run(f.options,f.deps);
  for(const row of plan(HUBS,'specialist')) f.metadata.projects[row.project].env.push({key:row.name,type:row.name.endsWith('_SIGNING_PRIVATE_KEY_PEM')?'secret':'config'});
  for(const hub of HUBS) f.inventory.keys[hub]=f.receipt.keys[hub];
  for(const hub of HUBS) f.inventory.askCopies[hub]=f.inventory.keys.ask;
  f.options.placement='ask'; f.calls.length=0; f.deps.generate=()=>assert.fail('Ask phase generated');
  await run(f.options,f.deps);
  assert.equal(f.calls.length,10);
  assert.ok(f.calls.every(c=>c.argv.includes('prj_TEST0')&&!c.argv.includes('--sensitive')));
  assert.ok(f.calls.every(c=>!/^MY_TRUSTHUB_V23_(ASK|MOVE)_/.test(c.argv[3])));
});

test('existing pinned Ask public copies are read-only; a missing half can be added, mismatch aborts',async()=>{
  const f=fixture(['lender']);
  f.metadata.projects.lender.env=[{key:name('ask','KEY_ID'),type:'config'}];
  f.inventory.askCopies.lender.kid=f.inventory.keys.ask.kid;
  await run(f.options,f.deps);
  assert.equal(f.calls.length,3);
  assert.equal(f.calls.some(c=>c.argv[3]===name('ask','KEY_ID')),false);
  const g=fixture(['lender']); g.metadata.projects.lender.env=[{key:name('ask','KEY_ID'),type:'config'}];
  g.inventory.askCopies.lender.kid='ask-v23-prod-20000101';
  await rejects(g,'EXISTING_ASK_TRUST_MISMATCH');
});

test('staged public inventory participates in guards; stale or incomplete receipts cannot reach Ask',async()=>{
  const extra=fixture(['lender']); extra.inventory.additionalKeys=[{hub:'senior',...record('senior',2)}];
  await rejects(extra,'DUPLICATE_SPKI');
  const f=fixture(['lender']); await run(f.options,f.deps);
  for(const row of plan(['lender'],'specialist')) f.metadata.projects[row.project].env.push({key:row.name,type:row.name.endsWith('_SIGNING_PRIVATE_KEY_PEM')?'secret':'config'});
  f.inventory.keys.lender=record('lender',8,'20261009');
  f.inventory.askCopies.lender=f.inventory.keys.ask;
  f.options.placement='ask'; f.calls.length=0;
  await rejects(f,'BUNDLE_DIFFERS_FROM_INSTALLED_SPECIALIST');
  f.inventory.keys.lender=f.receipt.keys.lender;
  const read=f.deps.readJson;
  f.deps.readJson=p=>p==='public-bundle'?{...f.receipt,state:'pending'}:read(p);
  await rejects(f,'UNVERIFIED_PUBLIC_BUNDLE');
});

test('name-only post-check consumes approved Vercel metadata with no decrypt or CLI call',async()=>{
  const f=fixture(['lender']);
  for(const row of plan(['lender'])) f.metadata.projects[row.project].env.push({key:row.name,type:row.name.endsWith('_SIGNING_PRIVATE_KEY_PEM')?'secret':'config'});
  await run(parseArgs(['--verify-names','--hub','lender','--metadata','metadata']),f.deps);
  assert.equal(f.calls.length,0); assert.equal(f.generated,0); assert.ok(f.logs.every(s=>s.endsWith('PRESENT')));
});

test('NO_PRIVATE_MATERIAL_IN_LOGS: grep dry-run and mocked apply success/failure output',async()=>{
  const dry=spawnSync(process.execPath,[fileURLToPath(new URL('./mth-v2-specialist-keys.mjs',import.meta.url))],{encoding:'utf8'});
  assert.equal(dry.status,0); assert.equal(/PRIVATE KEY/.test(dry.stdout+dry.stderr),false);
  const f=fixture(['lender']); await run(f.options,f.deps);
  assert.equal(/PRIVATE KEY/.test(f.logs.join('\n')),false);
  const g=fixture(['lender']); const leaked=pairs[2].privateKey.export({type:'pkcs8',format:'pem'}).toString();
  g.deps.writeEnv=cliWriter('MOCK-CLI.mjs',()=>({status:1,stdout:leaked,stderr:leaked,error:new Error(leaked)}));
  let message; try { await run(g.options,g.deps); } catch(e) { message=e.message; }
  assert.equal(message,'VERCEL_WRITE_FAILED');
  assert.equal(/PRIVATE KEY/.test(g.logs.join('\n')+message),false);
  assert.equal(g.receipt.state,'pending');
  for(const p of pairs) {
    const body=p.privateKey.export({type:'pkcs8',format:'pem'}).toString().split('\n')[1];
    assert.equal((dry.stdout+dry.stderr+f.logs.join('\n')+g.logs.join('\n')+message).includes(body),false);
  }
});
