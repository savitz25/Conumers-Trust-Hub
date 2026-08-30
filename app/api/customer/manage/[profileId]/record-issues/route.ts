import { NextResponse } from 'next/server';
import { AuthError, ManagementError } from '@/lib/customer/store';
import { RecordIssueError } from '@/lib/customer/record-issues';
import { currentContext,readSessionToken,withPlatform } from '@/lib/customer/server';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{profileId:string}>}){
 const token=await readSessionToken();if(!token)return NextResponse.json({error:'sign_in_required'},{status:401});
 const body=await request.json().catch(()=>null);const {profileId}=await params;
 try{const ctx=await currentContext();const result=await withPlatform(p=>p.createRecordIssue({sessionToken:token,nativeProfileId:profileId,body,ctx}));return NextResponse.json(result,{status:201,headers:{'Cache-Control':'no-store'}})}
 catch(error){if(error instanceof RecordIssueError)return NextResponse.json({error:error.code},{status:error.code==='duplicate'||error.code==='open_limit'?409:error.code==='rate_limited'?429:400});if(error instanceof AuthError)return NextResponse.json({error:error.code},{status:401});if(error instanceof ManagementError)return NextResponse.json({error:'forbidden'},{status:403});return NextResponse.json({error:'unavailable'},{status:500})}
}
