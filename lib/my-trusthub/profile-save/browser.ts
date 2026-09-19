/** Real browser surface, with fail-closed deployment ports. No fixture store is
 * installed in Next. Auth/cookie propagation and source authentication belong to
 * reviewed isolated bindings, never to posted subject IDs or an Origin alone. */
import { randomBytes } from 'node:crypto';
import { PRIVATE_HEADERS } from './http.ts';
import { RuntimeError, type ParentProfileSaveRuntime } from './runtime.ts';
import { isGuestStageInput, manifestDigest, profileReturnDestination,
  type GuestStageInput, type ItemReceipt, type TrustedOriginRegistry } from '../contracts/v2-3-profile-transfer.ts';
export const PROFILE_CONFIRM_PATH = '/my/profile-save';
const COOKIE = 'mth_parent_profile_confirmation';
const opaque = () => randomBytes(32).toString('base64url');
const valid = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export type BrowserParent = {subject:string;session:string;label:string};
export type SourceSnapshot = {continuationRef:string;transferRef:string;manifest:GuestStageInput;
  manifestDigest:string;browserProof:string;expiresAt:number};
export type Confirmation = {source:SourceSnapshot;csrf:string;expiresAt:number;requestPrefix:string;
  parent?:BrowserParent;accountContextRef?:string;projectRef?:string;receipts?:ItemReceipt[]};
export interface BrowserBindings {
  origin:string;registry:TrustedOriginRegistry;
  /** Verified scoped specialist channel + P13 browser exchange. Resolve source
   * from opaque continuation, retrieve Move-owned manifest through authorized
   * S2S, validate response reference/digest/expiry. No shared source DB required. */
  source(request:Request,continuationRef:string):Promise<SourceSnapshot|null>;
  parent(request:Request):Promise<BrowserParent|null>;
  projects(parent:BrowserParent):Promise<Array<{ref:string;label:string}>>;
  store:{put(key:string,value:Confirmation):Promise<void>;
    withRecord<T>(key:string,work:(value:Confirmation|null)=>Promise<T>):Promise<T>};
  /** Must derive verified caller, current P13 exchange, selection and confirmed
   * transfer from server state. Posted account IDs are never accepted. */
  runtime(request:Request,confirmation:Confirmation,parent:BrowserParent):Promise<ParentProfileSaveRuntime>;
  /** Publish owner-bound receipt/request mapping through narrow source BFF.
   * Durable parent outcome stands even if delivery fails; allow safe retry. */
  acknowledge(source:SourceSnapshot,receipts:ItemReceipt[],parent:BrowserParent):Promise<void>;
  now():number;
}
function html(body:string,status=200){return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keep profiles in My TrustHub</title><style>body{font:1rem system-ui;margin:1rem;overflow-wrap:anywhere}main{max-width:42rem;margin:auto}button,select{font:inherit;padding:.7rem;max-width:100%}label{display:block;margin:1rem 0}:focus-visible{outline:3px solid #165cba}</style><main>${body}</main></html>`,{status,headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});}
const unavailable=()=>html('<h1>Save is unavailable</h1><p>Your device copy is unchanged. Return to the profile and try again.</p>',503);
const same=(a:BrowserParent|null,b:BrowserParent)=>a?.subject===b.subject&&a.session===b.session;
async function form(request:Request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')throw new RuntimeError('invalid');
  const reader=request.body?.getReader();if(!reader)throw new RuntimeError('invalid');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>4096){await reader.cancel();throw new RuntimeError('invalid');}chunks.push(v.value);}}
  finally{reader.releaseLock();}
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}
export async function handleProfileConfirmation(request:Request,b:BrowserBindings|null):Promise<Response>{
  if(!b || b.registry.environment!=='isolated'||!b.registry.isolatedBackendVerified)return unavailable();
  const url=new URL(request.url);
  if(url.origin!==b.origin||url.pathname!==PROFILE_CONFIRM_PATH||url.search)return html('<h1>Invalid request</h1>',400);
  try{
    const posted=request.method==='POST'?await form(request):null;
    if(request.method!=='GET'&&request.method!=='POST')return html('<h1>Method not allowed</h1>',405);
    if(posted?.has('continuationRef')){
      if([...posted.keys()].length!==1||!valid(posted.get('continuationRef')))throw new RuntimeError('invalid');
      // Source port verifies actual hub/channel/browser proof, not just this POST.
      const source=await b.source(request,posted.get('continuationRef')!);
      if(!source||source.continuationRef!==posted.get('continuationRef')||!valid(source.transferRef)||
        !valid(source.browserProof)||!isGuestStageInput(source.manifest)||source.manifestDigest!==manifestDigest(source.manifest)||
        source.expiresAt<=b.now()||source.expiresAt>b.now()+600000||
        request.headers.get('origin')!==b.registry.origins[source.manifest.sourceHub])throw new RuntimeError('unauthorized');
      const key=opaque();await b.store.put(key,{source,csrf:opaque(),expiresAt:source.expiresAt,requestPrefix:opaque()});
      const response=new Response(null,{status:303,headers:{...PRIVATE_HEADERS,Location:PROFILE_CONFIRM_PATH}});
      response.headers.set('Set-Cookie',`${COOKIE}=${key}; Path=${PROFILE_CONFIRM_PATH}; HttpOnly; SameSite=Lax; Max-Age=600${url.protocol==='https:'?'; Secure':''}`);
      return response;
    }
    const key=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if(!valid(key))return unavailable();
    return await b.store.withRecord(key,async c=>{
      if(!c||c.expiresAt<=b.now())return html('<h1>This confirmation expired</h1><p>Your local research is unchanged. Start again from the profile.</p>',410);
      const parent=await b.parent(request);
      if(!parent)return html('<h1>Keep profiles in My TrustHub</h1><a href="/my/sign-in?next=%2Fmy%2Fprofile-save">Sign in to continue</a><p>No profiles have been saved to your account by this step.</p>');
      if(c.parent&&!same(parent,c.parent))return html('<h1>Your account changed</h1><p>Start a fresh confirmation from the profile. Device research is retained.</p>',409);
      c.parent=parent;
      const projects=(await b.projects(parent)).slice(0,25).filter(p=>valid(p.ref));
      if(posted){
        if(request.headers.get('origin')!==b.origin||posted.get('csrf')!==c.csrf||posted.get('confirm')!=='yes'||
          [...posted.keys()].some(k=>!['csrf','confirm','project'].includes(k))||new Set(posted.keys()).size!==[...posted.keys()].length)throw new RuntimeError('unauthorized');
        const project=posted.get('project')||undefined;
        if(project&&!projects.some(p=>p.ref===project))throw new RuntimeError('unauthorized');
        if(c.accountContextRef&&c.projectRef!==project)throw new RuntimeError('conflict');
        const runtime=await b.runtime(request,c,parent);
        if(!c.accountContextRef){
          const result=await runtime.execute('consumeProfileSaveContinuation',{continuationRef:c.source.continuationRef,
            issuer:c.source.manifest.sourceHub,audience:'ask',browserProof:c.source.browserProof}) as {accountContextRef:string};
          c.accountContextRef=result.accountContextRef;c.projectRef=project;
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
        await b.acknowledge(c.source,receipts,parent);
        if(!same(await b.parent(request),parent))throw new RuntimeError('unauthorized');
      }
      if(c.receipts){
        const destination=profileReturnDestination(c.source.manifest.returnTask,b.registry);
        const all=c.receipts.every(r=>['saved','already_saved'].includes(r.parent.outcome));
        return html(`<h1>${all?'Saved to My TrustHub':'Some profiles could not be saved'}</h1><p role="status">${c.receipts.some(r=>r.project.outcome==='failed')?'Project assignment failed; successful profile Saves are retained. ':''}Your device copy is retained. Save does not start a Watch.</p><a href="/my/saved">View your saved profiles</a>${destination?` <a href="${escape(destination)}">Return to Move profile</a>`:''}`);
      }
      return html(`<h1>Keep profiles in My TrustHub</h1><p>Destination: ${escape(parent.label.slice(0,100))}</p><ul>${c.source.manifest.selected.map(i=>`<li>${escape(i.profile.hub)}: ${escape(i.profile.nativeId)}</li>`).join('')}</ul><p>Profile identities only. Notes and tools stay on this device. Save does not start a Watch.</p><form method="post" action="${PROFILE_CONFIRM_PATH}"><input type="hidden" name="csrf" value="${c.csrf}"><label><input type="checkbox" name="confirm" value="yes" required> Save these selected profiles to this account</label><label>Project (optional)<select name="project"><option value="">No Project</option>${projects.map(p=>`<option value="${p.ref}">${escape(p.label.slice(0,100))}</option>`).join('')}</select></label><button type="submit">Confirm Save</button></form>`);
    });
  }catch{return unavailable();}
}
