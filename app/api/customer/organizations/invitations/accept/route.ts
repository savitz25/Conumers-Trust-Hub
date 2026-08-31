import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/customer/store';
import { OrganizationError } from '@/lib/customer/organization';
import { currentContext,readSessionToken,withPlatform } from '@/lib/customer/server';

export async function POST(request:Request){
  const sessionToken=await readSessionToken(),body=await request.json().catch(()=>({})) as {token?:string},ctx=await currentContext();
  try{return NextResponse.json(await withPlatform(p=>p.acceptOrganizationInvitation({sessionToken:sessionToken||'',token:String(body.token||''),ctx})),{headers:{'Cache-Control':'no-store'}});}
  catch(error){if(error instanceof AuthError)return NextResponse.json({error:error.code},{status:error.code==='rate_limited'?429:401});if(error instanceof OrganizationError)return NextResponse.json({error:error.code},{status:error.code==='not_found'?404:['consumed_invitation','already_member'].includes(error.code)?409:400});return NextResponse.json({error:'unavailable'},{status:500});}
}
