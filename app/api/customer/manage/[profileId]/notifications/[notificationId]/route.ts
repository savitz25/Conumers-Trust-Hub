import { NextResponse } from 'next/server';
import { readSessionToken,withPlatform } from '@/lib/customer/server';
import { AuthError,ManagementError } from '@/lib/customer/store';
import { MonitoringError } from '@/lib/customer/monitoring';

export const dynamic='force-dynamic';
export async function POST(_request:Request,{params}:{params:Promise<{profileId:string;notificationId:string}>}){
  const token=await readSessionToken();if(!token)return NextResponse.json({error:'sign_in_required'},{status:401});
  try{const {profileId,notificationId}=await params;const result=await withPlatform(p=>p.markMonitoringNotificationRead({sessionToken:token,nativeProfileId:profileId,notificationId,ctx:undefined}));return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})}
  catch(error){if(error instanceof MonitoringError)return NextResponse.json({error:error.code},{status:error.code==='not_found'?404:400});if(error instanceof ManagementError)return NextResponse.json({error:'forbidden'},{status:403});if(error instanceof AuthError)return NextResponse.json({error:'sign_in_required'},{status:401});return NextResponse.json({error:'update_failed'},{status:500})}
}
