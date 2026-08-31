import { NextResponse } from 'next/server';
import { readSessionToken,withPlatform } from '@/lib/customer/server';
import { AuthError,ManagementError } from '@/lib/customer/store';
import { MonitoringError } from '@/lib/customer/monitoring';

export const dynamic='force-dynamic';
export async function PUT(request:Request,{params}:{params:Promise<{profileId:string}>}){
  const token=await readSessionToken(); if(!token)return NextResponse.json({error:'sign_in_required'},{status:401});
  try{const {profileId}=await params;const body=await request.json();const result=await withPlatform(p=>p.saveMonitoring({sessionToken:token,nativeProfileId:profileId,body,ctx:undefined}));return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})}
  catch(error){if(error instanceof SyntaxError||error instanceof MonitoringError)return NextResponse.json({error:error instanceof MonitoringError?error.code:'validation_failed'},{status:error instanceof MonitoringError&&error.code==='stale_version'?409:400});if(error instanceof ManagementError)return NextResponse.json({error:'forbidden'},{status:403});if(error instanceof AuthError)return NextResponse.json({error:'sign_in_required'},{status:401});return NextResponse.json({error:'save_failed'},{status:500})}
}
