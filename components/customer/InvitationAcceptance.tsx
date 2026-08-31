'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InvitationAcceptance({token,authed,email}:{token:string;authed:boolean;email:string}){
  const router=useRouter(),[status,setStatus]=useState(''),[pending,setPending]=useState(false),[sent,setSent]=useState(false);
  async function signIn(formData:FormData){setPending(true);const response=await fetch('/api/customer/auth/request-link',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:formData.get('email'),next:`/manage/invitations/accept?token=${encodeURIComponent(token)}`})});const result=await response.json();setPending(false);if(response.ok)setSent(true);else setStatus(result.error||'Could not send sign-in link.');}
  async function accept(){setPending(true);const response=await fetch('/api/customer/organizations/invitations/accept',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});const result=await response.json();setPending(false);if(response.ok)router.push(`/manage/organization/${result.orgId}`);else setStatus(result.error||'Could not accept invitation.');}
  if(!authed)return <form action={signIn} className="mt-5 space-y-3"><label className="block text-sm font-medium">Invited email<input required type="email" name="email" className="mt-1 min-h-11 w-full rounded-lg border border-border px-3"/></label><button disabled={pending} className="min-h-11 w-full rounded-lg bg-navy px-4 text-sm font-semibold text-white">Email me a sign-in link</button>{sent?<p className="text-sm">Check your email, then return through the secure link.</p>:null}<p aria-live="polite" className="text-sm text-destructive">{status}</p></form>;
  return <div className="mt-5 space-y-3"><p className="text-sm text-muted-foreground">Signed in as {email}. Acceptance is allowed only if this matches the invited email.</p><button type="button" onClick={accept} disabled={pending} className="min-h-11 w-full rounded-lg bg-navy px-4 text-sm font-semibold text-white">Accept organization invitation</button><p aria-live="polite" className="text-sm text-destructive">{status}</p></div>;
}
