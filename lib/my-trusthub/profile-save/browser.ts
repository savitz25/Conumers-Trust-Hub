/** Real browser surface, with fail-closed deployment ports. No fixture store is
 * installed in Next. Auth/cookie propagation and source authentication belong to
 * reviewed isolated bindings, never to posted subject IDs or an Origin alone. */
import { randomBytes } from 'node:crypto';
import { PRIVATE_HEADERS } from './http.ts';
import { RuntimeError, trustedRegistry, type ParentProfileSaveRuntime } from './runtime.ts';
import { isGuestStageInput, manifestDigest, profileReturnDestination,
  type GuestStageInput, type ItemReceipt, type TrustedOriginRegistry } from '../contracts/v2-3-profile-transfer.ts';
export const PROFILE_CONFIRM_PATH = '/my/profile-save';
const COOKIE = 'mth_parent_profile_confirmation';
const opaque = () => randomBytes(32).toString('base64url');
const valid = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
function diagnosticCode(error:unknown){
  if(error instanceof RuntimeError)return error.code;
  if(typeof error==='object'&&error!==null&&'code'in error){
    const code=(error as {code:unknown}).code;
    if(typeof code==='string'&&/^[A-Za-z0-9_]{1,32}$/.test(code))return code;
  }
  return 'unknown';
}
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export type BrowserParent = {subject:string;session:string;label:string};
export type SourceSnapshot = {continuationRef:string;transferRef:string;manifest:GuestStageInput;
  manifestDigest:string;browserProof:string;expiresAt:number;requestPrefix:string};
/** One-click Save / Unsave from the source profile. `save` commits as soon as a
 * verified parent session is present and otherwise returns to the profile
 * without interrupting; `save_signin` shows the sign-in step first; `unsave`
 * removes the owner's Saved row for the exact bound profile. A continuation
 * that carries no intent keeps the explicit confirmation form. */
export const DIRECT_INTENTS = ['save','save_signin','unsave'] as const;
export type DirectIntent = typeof DIRECT_INTENTS[number];
export type Confirmation = {source:SourceSnapshot;csrf:string;expiresAt:number;requestPrefix:string;intent?:DirectIntent;
  parent?:BrowserParent;contextCandidateRef?:string;accountContextRef?:string;projectRef?:string;receipts?:ItemReceipt[]};
export interface BrowserBindings {
  origin:string;registry:TrustedOriginRegistry;
  /** Verified scoped specialist channel + P13 browser exchange. Resolve source
   * from opaque continuation, retrieve Move-owned manifest through authorized
   * S2S, validate response reference/digest/expiry. No shared source DB required. */
  source(request:Request,continuationRef:string):Promise<SourceSnapshot|null>;
  parent(request:Request):Promise<BrowserParent|null>;
  projects(parent:BrowserParent):Promise<Array<{ref:string;label:string}>>;
  store:{put(key:string,value:Confirmation):Promise<void>;
    withRecord<T>(key:string,work:(value:Confirmation|null,checkpoint:()=>Promise<void>)=>Promise<T>):Promise<T>};
  /** Must derive verified caller, current P13 exchange, selection and confirmed
   * transfer from server state. Posted account IDs are never accepted. */
  runtime(request:Request,confirmation:Confirmation,parent:BrowserParent):Promise<ParentProfileSaveRuntime>;
  /** Publish owner-bound receipt/request mapping through narrow source BFF.
   * Durable parent outcome stands even if delivery fails; allow safe retry. */
  acknowledge(source:SourceSnapshot,receipts:ItemReceipt[],parent:BrowserParent):Promise<void>;
  confirmed?(confirmation:Confirmation,parent:BrowserParent):Promise<void>;
  /** Owner-scoped removal of the Saved row for the exact bound profile, through
   * the verified parent's own session. Resolves only when the account verifiably
   * holds no active Saved row for it afterwards (`not_saved`: it held none);
   * anything else throws. Absent means Unsave changes nothing. */
  unsave?(request:Request,confirmation:Confirmation,parent:BrowserParent):Promise<'removed'|'not_saved'>;
  now():number;
}
// Native form navigations under no-referrer send Origin:null. Preserve the exact
// same-origin POST check while still suppressing referrers to other origins.
// Consumer-facing confirmation shell. Inline styles only: the document CSP keeps
// default-src 'none', so this mirrors the Ask design tokens (navy/accent/border)
// and the My TrustHub workspace chrome without loading any external asset.
const STYLE=`*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;min-height:100vh;background:#f8fafc;color:#1e293b;font:16px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}
.hd{background:#0a2540;color:#fff}.hd-in{display:flex;align-items:center;justify-content:space-between;gap:16px;width:min(1200px,calc(100% - 32px));min-height:64px;margin:auto}.brand{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:17px;color:#fff;text-decoration:none}.brand b{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#4f46e5;font-size:13px}.hd-in a.hub{color:#cbd8df;font-size:13px;font-weight:600;text-decoration:none}
main{width:min(640px,calc(100% - 32px));margin:32px auto 56px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 24px;box-shadow:0 1px 2px rgb(10 37 64 / .04),0 4px 16px rgb(10 37 64 / .05)}@media(min-width:640px){.card{padding:36px}}
.eyebrow{margin:0 0 10px;color:#4f46e5;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0 0 10px;font-size:clamp(26px,5vw,34px);line-height:1.15;letter-spacing:-.02em;color:#0a2540}p{margin:0 0 14px;color:#475569}p.lead{color:#1e293b}
.dest{display:flex;gap:10px;align-items:center;margin:18px 0;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;font-size:14px;color:#334155}.dest strong{color:#0a2540;overflow-wrap:anywhere}
ul.items{list-style:none;margin:0 0 18px;padding:0}ul.items li{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-top:1px solid #edf1f2}ul.items li:first-child{border-top:0}.pin{flex:none;display:inline-grid;place-items:center;width:38px;height:38px;border-radius:10px;background:#eef2ff;color:#4f46e5;font-weight:800;font-size:14px}ul.items strong{display:block;color:#0a2540;font-size:16px}ul.items small{display:block;margin-top:3px;color:#64748b;font-size:13px}
label{display:block;margin:14px 0}label.check{display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#0a2540;font-weight:600;cursor:pointer}label.check input{flex:none;width:20px;height:20px;margin:2px 0 0;accent-color:#4f46e5}label.field span{display:block;margin-bottom:6px;font-size:13px;font-weight:700;color:#0a2540}select{width:100%;min-height:46px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;font:inherit;color:#1e293b}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 18px;border-radius:12px;border:1px solid #0a2540;background:#0a2540;color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}.btn.accent{border-color:#4f46e5;background:#4f46e5}.btn.secondary{border-color:#cbd5e1;background:#fff;color:#0a2540}.btn:hover{filter:brightness(1.06)}
.note{margin-top:20px;padding-top:16px;border-top:1px solid #edf1f2;color:#64748b;font-size:13px}.status{display:flex;gap:10px;align-items:flex-start;margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:14px}.status.warn{background:#fffbeb;border-color:#fde68a;color:#78350f}
:focus-visible{outline:2px solid #4f46e5;outline-offset:2px}`;
const SHELL_HEADER='<header class="hd"><div class="hd-in"><a class="brand" href="/my"><b>✓</b>My TrustHub</a><a class="hub" href="/">Ask Trust Hub</a></div></header>';
function html(body:string,status=200,title='Keep profiles in My TrustHub'){return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)} · My TrustHub</title><style>${STYLE}</style><body>${SHELL_HEADER}<main><section class="card">${body}</section></main></body></html>`,{status,headers:{...PRIVATE_HEADERS,'Referrer-Policy':'same-origin','Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});}
const HUB_LABEL:Record<string,string>={move:'Move Trust Hub',insurance:'Insurance Trust Hub',lender:'Lender Trust Hub',contractor:'Contractor Trust Hub',senior:'Senior Trust Hub',investor:'Investor Trust Hub'};
const hubLabel=(hub:string)=>HUB_LABEL[hub]??'TrustHub';
const SLUG_WORDS:Record<string,string>={inc:'Inc',llc:'LLC',ltd:'Ltd',co:'Co',corp:'Corp',usa:'USA'};
function humanizeSlug(slug:string){return slug.split('-').filter(Boolean).map(w=>SLUG_WORDS[w]??w.charAt(0).toUpperCase()+w.slice(1)).join(' ');}
function identityLabel(nativeId:string){const m=/^([a-z]+)-(.+)$/i.exec(nativeId);return m?`${m[1].toUpperCase()} ${m[2]}`:nativeId;}
const unavailable=()=>html('<p class="eyebrow">My TrustHub</p><h1>Save is unavailable right now</h1><p class="lead">Nothing changed. Your device copy of this research is unchanged.</p><p>Return to the profile and try again in a moment.</p><div class="actions"><a class="btn secondary" href="/my">Open My TrustHub</a></div>',503,'Save is unavailable');
const same=(a:BrowserParent|null,b:BrowserParent)=>a?.subject===b.subject&&a.session===b.session;
async function form(request:Request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')throw new RuntimeError('invalid');
  const reader=request.body?.getReader();if(!reader)throw new RuntimeError('invalid');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>4096){await reader.cancel();throw new RuntimeError('invalid');}chunks.push(v.value);}}
  finally{reader.releaseLock();}
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}
/** Browser bindings are admitted only in their own registry shape: isolated
 * must carry the isolated-backend attestation; production must not. Every
 * later check (exact origins, continuation, browser proof, CSRF, session and
 * account revalidation, acknowledgement) is unchanged for both. */
export const trustedBrowserRegistry = (registry: TrustedOriginRegistry): boolean => trustedRegistry(registry);
export async function handleProfileConfirmation(request:Request,b:BrowserBindings|null):Promise<Response>{
  if(!b || !trustedBrowserRegistry(b.registry))return unavailable();
  const url=new URL(request.url);
  if(url.origin!==b.origin||url.pathname!==PROFILE_CONFIRM_PATH)return html('<p class="eyebrow">My TrustHub</p><h1>Invalid request</h1><p>Start again from the profile you want to keep.</p>',400,'Invalid request');
  // A verified email/PKCE callback may add this bounded outcome marker. Strip it
  // before rendering; the server-bound confirmation cookie remains authority.
  if(url.search){
    if(request.method==='GET'&&url.searchParams.size===1&&url.searchParams.get('auth')==='complete'){
      return new Response(null,{status:303,headers:{...PRIVATE_HEADERS,Location:PROFILE_CONFIRM_PATH}});
    }
    return html('<p class="eyebrow">My TrustHub</p><h1>Invalid request</h1><p>Start again from the profile you want to keep.</p>',400,'Invalid request');
  }
  try{
    const posted=request.method==='POST'?await form(request):null;
    if(request.method!=='GET'&&request.method!=='POST')return html('<p class="eyebrow">My TrustHub</p><h1>Method not allowed</h1>',405,'Method not allowed');
    if(posted?.has('continuationRef')){
      const keys=[...posted.keys()],intent=posted.get('intent');
      if(keys.length>2||new Set(keys).size!==keys.length||keys.some(k=>k!=='continuationRef'&&k!=='intent')||
        !valid(posted.get('continuationRef'))||(intent!==null&&!(DIRECT_INTENTS as readonly string[]).includes(intent)))throw new RuntimeError('invalid');
      // Source port verifies actual hub/channel/browser proof, not just this POST.
      const source=await b.source(request,posted.get('continuationRef')!);
      if(!source||source.continuationRef!==posted.get('continuationRef')||!valid(source.transferRef)||
        !valid(source.browserProof)||!valid(source.requestPrefix)||!isGuestStageInput(source.manifest)||source.manifestDigest!==manifestDigest(source.manifest)||
        source.expiresAt<=b.now()||source.expiresAt>b.now()+600000||
        request.headers.get('origin')!==b.registry.origins[source.manifest.sourceHub])throw new RuntimeError('unauthorized');
      // A direct intent always returns to the one reviewed source profile.
      if(intent&&(source.manifest.selected.length!==1||!profileReturnDestination(source.manifest.returnTask,b.registry)))throw new RuntimeError('invalid');
      const key=opaque();await b.store.put(key,{source,csrf:opaque(),expiresAt:source.expiresAt,requestPrefix:source.requestPrefix,
        ...(intent?{intent:intent as DirectIntent}:{})});
      const response=new Response(null,{status:303,headers:{...PRIVATE_HEADERS,Location:PROFILE_CONFIRM_PATH}});
      response.headers.set('Set-Cookie',`${COOKIE}=${key}; Path=${PROFILE_CONFIRM_PATH}; HttpOnly; SameSite=Lax; Max-Age=600${url.protocol==='https:'?'; Secure':''}`);
      return response;
    }
    const key=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if(!valid(key))return unavailable();
    return await b.store.withRecord(key,async(c,checkpoint)=>{
      if(!c||c.expiresAt<=b.now())return html('<p class="eyebrow">My TrustHub</p><h1>This confirmation expired</h1><p class="lead">Your local research is unchanged.</p><p>Confirmations stay open for ten minutes. Start again from the profile to keep it in My TrustHub.</p>',410,'Confirmation expired');
      const parent=await b.parent(request);
      const direct=c.intent?profileReturnDestination(c.source.manifest.returnTask,b.registry):null;
      const back=()=>new Response(null,{status:303,headers:{...PRIVATE_HEADERS,Location:direct!}});
      // Signed out on a one-click Save or Unsave: nothing is asked here. The
      // device copy already changed on the source profile; return to it.
      if(!parent&&direct&&c.intent!=='save_signin')return back();
      if(!parent)return html(`<p class="eyebrow">My TrustHub</p><h1>Keep profiles in My TrustHub</h1><p class="lead">Sign in to your My TrustHub account to finish keeping this research.</p><p>No profiles have been saved to your account by this step. Your device copy stays on this device either way.</p><div class="actions"><a class="btn accent" href="/my/sign-in?next=%2Fmy%2Fprofile-save">Sign in to continue</a></div><p class="note">One account across every TrustHub site. Save never starts a Watch.</p>`,200,'Sign in to continue');
      if(c.parent&&!same(parent,c.parent))return html('<p class="eyebrow">My TrustHub</p><h1>Your account changed</h1><p class="lead">This confirmation was started under a different account.</p><p>Start a fresh confirmation from the profile. Device research is retained.</p>',409,'Account changed');
      c.parent=parent;
      if(direct&&c.intent==='unsave'){
        if(posted)throw new RuntimeError('invalid');
        try{
          if(!b.unsave)throw new RuntimeError('unavailable');
          await b.unsave(request,c,parent);
          if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
          // Tell the source the account no longer holds this profile. Without
          // this signed acknowledgement the source keeps treating it as saved
          // here, so an interrupted or refused Unsave is never reported as done.
          if(!c.contextCandidateRef){c.contextCandidateRef=opaque();await checkpoint();}
          await b.acknowledge(c.source,c.source.manifest.selected.map((item,index)=>({receiptRef:opaque(),requestKey:c.requestPrefix+':'+index,
            accountContextRef:c.contextCandidateRef!,manifestDigest:c.source.manifestDigest,item,parent:{outcome:'local_only'},
            project:{outcome:'not_requested'},localCopy:'keep'} satisfies ItemReceipt)),parent);
        }catch(error){console.warn(JSON.stringify({event:'my_trusthub_v23_direct_failure',stage:'unsave',code:diagnosticCode(error)}));}
        return back();
      }
      const projects=direct?[]:(await b.projects(parent)).slice(0,25).filter(p=>valid(p.ref));
      // One-click Save: the verified session is the confirmation. No form, no
      // Project, same continuation consume and idempotent owner-scoped commit.
      const auto=!!direct&&!posted&&!c.receipts;
      if(posted||auto)try{
        if(posted&&(request.headers.get('origin')!==b.origin||posted.get('csrf')!==c.csrf||posted.get('confirm')!=='yes'||
          [...posted.keys()].some(k=>!['csrf','confirm','project'].includes(k))||new Set(posted.keys()).size!==[...posted.keys()].length))throw new RuntimeError('unauthorized');
        const project=posted?.get('project')||undefined;
        if(project&&!projects.some(p=>p.ref===project))throw new RuntimeError('unauthorized');
        if(c.accountContextRef&&c.projectRef!==project)throw new RuntimeError('conflict');
        if(!c.contextCandidateRef){c.contextCandidateRef=opaque();c.projectRef=project;await checkpoint();}
        if(c.projectRef!==project)throw new RuntimeError('conflict');
        const runtime=await b.runtime(request,c,parent);
        if(!c.accountContextRef){
          if(await runtime.resumeConfirmedContext(c.contextCandidateRef))c.accountContextRef=c.contextCandidateRef;
          else{
            let result:{accountContextRef:string};
            try{
              result=await runtime.execute('consumeProfileSaveContinuation',{continuationRef:c.source.continuationRef,
                issuer:c.source.manifest.sourceHub,audience:'ask',browserProof:c.source.browserProof}) as {accountContextRef:string};
            }catch(error){
              console.warn(JSON.stringify({event:'my_trusthub_v23_confirmation_failure',stage:'consume_continuation',code:diagnosticCode(error)}));
              throw error;
            }
            c.accountContextRef=result.accountContextRef;
          }
          await checkpoint();
        }
        const receipts:ItemReceipt[]=[];
        for(const [index,item] of c.source.manifest.selected.entries()){
          if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
          receipts.push(await runtime.execute('commitProfileSave',{requestKey:c.requestPrefix+':'+index,
            accountContextRef:c.accountContextRef,transferRef:c.source.transferRef,manifestDigest:c.source.manifestDigest,item,
            ...(project?{projectRef:project}:{})}) as ItemReceipt);
        }
        if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
        c.receipts=receipts;
        await checkpoint();
        if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
      }catch(error){
        if(!auto)throw error;
        // Parent Save did not complete. The source profile reports device-only.
        console.warn(JSON.stringify({event:'my_trusthub_v23_direct_failure',stage:'save',code:diagnosticCode(error)}));
        return back();
      }
      if(c.receipts&&direct){
        if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
        // The source learns of a one-click Save only when every profile is in
        // the account; anything else stays a device-only Save there.
        if(c.receipts.every(r=>['saved','already_saved'].includes(r.parent.outcome)))try{
          await b.confirmed?.(c,parent);
          await b.acknowledge(c.source,c.receipts,parent);
        }catch(error){console.warn(JSON.stringify({event:'my_trusthub_v23_direct_failure',stage:'acknowledge',code:diagnosticCode(error)}));}
        return back();
      }
      if(c.receipts){
        if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
        await b.confirmed?.(c,parent);
        await b.acknowledge(c.source,c.receipts,parent);
        if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
        const destination=profileReturnDestination(c.source.manifest.returnTask,b.registry);
        const all=c.receipts.every(r=>['saved','already_saved'].includes(r.parent.outcome));
        const already=all&&c.receipts.every(r=>r.parent.outcome==='already_saved');
        const sourceLabel=hubLabel(c.source.manifest.sourceHub);
        const projectFailed=c.receipts.some(r=>r.project.outcome==='failed');
        return html(`<p class="eyebrow">My TrustHub</p><h1>${all?(already?'Already in My TrustHub':'Saved to My TrustHub'):'Some profiles could not be saved'}</h1>
<div class="status${all?'':' warn'}" role="status">${all?`<span aria-hidden="true">✓</span><span>${already?'This profile was already in your account, so nothing was duplicated.':'This profile is now in your account and stays here when you return.'}${projectFailed?' Project assignment failed; your Save is retained.':''}</span>`:`<span aria-hidden="true">!</span><span>One or more profiles could not be saved. Successful Saves are retained.${projectFailed?' Project assignment failed.':''}</span>`}</div>
<p>Your device copy on ${escape(sourceLabel)} is retained. Save does not start a Watch.</p>
<div class="actions"><a class="btn accent" href="/my/saved">View your saved profiles</a>${destination?` <a class="btn secondary" href="${escape(destination)}">Return to Move profile</a>`:''}</div>`,200,all?'Saved to My TrustHub':'Save incomplete');
      }
      const sourceLabel=hubLabel(c.source.manifest.sourceHub);
      const task=c.source.manifest.returnTask;
      const items=c.source.manifest.selected.map((i,index)=>{
        const named=task.kind==='profile'&&task.profile.hub===i.profile.hub&&task.profile.nativeId===i.profile.nativeId;
        const name=named?humanizeSlug(task.canonicalSlug):`${hubLabel(i.profile.hub)} profile`;
        return `<li><span class="pin" aria-hidden="true">${index+1}</span><span><strong>${escape(name)}</strong><small>${escape(hubLabel(i.profile.hub))} · ${escape(identityLabel(i.profile.nativeId))}</small></span></li>`;
      }).join('');
      return html(`<p class="eyebrow">My TrustHub</p><h1>Keep ${c.source.manifest.selected.length===1?'this profile':'these profiles'} in My TrustHub</h1><p class="lead">Confirm the research you want to keep in your account. It will be waiting on any device you sign in from.</p>
<div class="dest"><span aria-hidden="true">👤</span><span>Saving to <strong>${escape(parent.label.slice(0,100))}</strong></span></div>
<ul class="items">${items}</ul>
<form method="post" action="${PROFILE_CONFIRM_PATH}"><input type="hidden" name="csrf" value="${c.csrf}"><label class="check"><input type="checkbox" name="confirm" value="yes" required> <span>Save these selected profiles to this account</span></label><label class="field"><span>Project (optional)</span><select name="project"><option value="">No Project</option>${projects.map(p=>`<option value="${p.ref}">${escape(p.label.slice(0,100))}</option>`).join('')}</select></label><div class="actions"><button class="btn accent" type="submit">Confirm Save</button>${task.kind==='profile'?`<a class="btn secondary" href="${escape(profileReturnDestination(task,b.registry)??'/my')}">Not now</a>`:''}</div></form>
<p class="note">Profile identities only. Notes and tools stay on this device on ${escape(sourceLabel)}. Save does not start a Watch.</p>`);
    });
  }catch{return unavailable();}
}
