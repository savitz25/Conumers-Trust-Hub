import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/customer/store';
import { OrganizationError } from '@/lib/customer/organization';
import { currentContext,readSessionToken,withPlatform } from '@/lib/customer/server';

export async function POST(request:Request,{params}:{params:Promise<{orgId:string}>}) {
  const token=await readSessionToken(),{orgId}=await params,body=await request.json().catch(()=>null),ctx=await currentContext();
  try { return NextResponse.json(await withPlatform(p=>p.createOrganizationInvitation({sessionToken:token||'',orgId,body,ctx})),{status:201,headers:{'Cache-Control':'no-store'}}); }
  catch(error){return organizationResponse(error);}
}

function organizationResponse(error:unknown){
  if(error instanceof AuthError)return NextResponse.json({error:error.code},{status:error.code==='rate_limited'?429:401});
  if(error instanceof OrganizationError){const conflict=['duplicate_invitation','already_member','stale_version'].includes(error.code);return NextResponse.json({error:error.code},{status:error.code==='forbidden'?403:error.code==='not_found'?404:conflict?409:400});}
  return NextResponse.json({error:'unavailable'},{status:500});
}
