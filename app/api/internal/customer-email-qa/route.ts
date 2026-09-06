import { NextResponse } from 'next/server';
import { readSessionToken, withPlatform } from '@/lib/customer/server';

export const dynamic='force-dynamic';

export async function POST(request:Request){
  if(process.env.VERCEL_ENV!=='production'||process.env.ATH_LIFECYCLE_QA_ENABLED!=='1')return new NextResponse(null,{status:404});
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin)return NextResponse.json({error:'forbidden'},{status:403});
  const token=await readSessionToken();
  if(!token)return NextResponse.json({error:'staff_authorization_required'},{status:403});
  try{return NextResponse.json(await withPlatform(p=>p.sendLifecycleQa(token)))}catch{return NextResponse.json({error:'qa_not_available'},{status:403})}
}
