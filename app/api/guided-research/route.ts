import { NextResponse } from 'next/server';
import { orchestrateGuidedResearch } from '@/lib/guided-research/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const length=Number(request.headers.get('content-length')??'0');
  if (length>32_768) return NextResponse.json({error:'payload_too_large'},{status:413});
  try {
    const body=await request.json();
    const response=await orchestrateGuidedResearch(body);
    return NextResponse.json(response,{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  } catch (error) {
    const code=error instanceof Error?error.message:'invalid_request';
    const status=code==='not_guided_query'?422:400;
    return NextResponse.json({error:code,message:code==='not_guided_query'?'This query remains in Federated Ask. Guided Research currently pilots Senior, Contractor, and Move only.':'The Guided Research action or session was invalid.'},{status,headers:{'Cache-Control':'no-store'}});
  }
}
