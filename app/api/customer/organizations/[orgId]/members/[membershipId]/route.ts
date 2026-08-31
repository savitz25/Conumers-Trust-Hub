import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/customer/store';
import { OrganizationError } from '@/lib/customer/organization';
import { currentContext,readSessionToken,withPlatform } from '@/lib/customer/server';

export async function POST(request:Request,{params}:{params:Promise<{orgId:string;membershipId:string}>}){
  const token=await readSessionToken(),{orgId,membershipId}=await params,body=await request.json().catch(()=>({})) as {action?:'change_role'|'remove';role?:unknown},ctx=await currentContext();
  try{
    if(!['change_role','remove'].includes(String(body.action)))throw new OrganizationError('validation_failed');
    const result=body.action==='change_role'
      ?await withPlatform(p=>p.changeOrganizationMemberRole({sessionToken:token||'',orgId,membershipId,role:body.role,ctx}))
      :await withPlatform(p=>p.removeOrganizationMember({sessionToken:token||'',orgId,membershipId,ctx}));
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){if(error instanceof AuthError)return NextResponse.json({error:error.code},{status:401});if(error instanceof OrganizationError)return NextResponse.json({error:error.code},{status:error.code==='forbidden'?403:error.code==='not_found'?404:error.code==='last_owner'?409:400});return NextResponse.json({error:'unavailable'},{status:500});}
}
