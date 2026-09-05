import { NextResponse } from 'next/server';
import { orchestrateGuidedResearch } from '@/lib/guided-research/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const started=performance.now();
  const length=Number(request.headers.get('content-length')??'0');
  if (length>32_768) return NextResponse.json({error:'payload_too_large'},{status:413});
  try {
    const body=await request.json();
    const response=await orchestrateGuidedResearch(body);
    return NextResponse.json(response,{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Server-Timing':`guided;dur=${(performance.now()-started).toFixed(1)}, specialist;dur=${response.result?.latencyMs??0}`}});
  } catch (error) {
    const code=error instanceof Error?error.message:'invalid_request';
    const status=code==='not_guided_query'?422:400;
    return NextResponse.json({error:code,message:code==='not_guided_query'?'This query remains in Federated Ask. Guided Research supports Senior, Contractor, Move, Investor, Insurance, and Lender research when the plan is safe to execute.':'The Guided Research action or session was invalid.'},{status,headers:{'Cache-Control':'no-store'}});
  }
}
