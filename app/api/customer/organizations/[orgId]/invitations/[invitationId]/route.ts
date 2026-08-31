import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/customer/store';
import { OrganizationError } from '@/lib/customer/organization';
import { currentContext,readSessionToken,withPlatform } from '@/lib/customer/server';

export async function POST(request:Request,{params}:{params:Promise<{orgId:string;invitationId:string}>}){
  const token=await readSessionToken(),{orgId,invitationId}=await params,body=await request.json().catch(()=>({})) as {action?:'resend'|'revoke';version?:number},ctx=await currentContext();
  try{
    if(!['resend','revoke'].includes(String(body.action))||!Number.isInteger(body.version))throw new OrganizationError('validation_failed');
    const result=body.action==='resend'
      ?await withPlatform(p=>p.resendOrganizationInvitation({sessionToken:token||'',orgId,invitationId,version:body.version!,ctx}))
      :await withPlatform(p=>p.revokeOrganizationInvitation({sessionToken:token||'',orgId,invitationId,version:body.version!,ctx}));
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){if(error instanceof AuthError)return NextResponse.json({error:error.code},{status:error.code==='rate_limited'?429:401});if(error instanceof OrganizationError)return NextResponse.json({error:error.code},{status:error.code==='forbidden'?403:error.code==='not_found'?404:['stale_version','duplicate_invitation'].includes(error.code)?409:400});return NextResponse.json({error:'unavailable'},{status:500});}
}
