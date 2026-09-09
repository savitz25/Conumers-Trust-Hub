import {NextResponse} from 'next/server';
import {withAskTx} from '@/lib/customer/db';
import {suppressMarketing} from '@/lib/control-plane/business-growth';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){const{token}=await params;const ok=await withAskTx(sql=>suppressMarketing(sql,token)).catch(()=>false);return NextResponse.json({ok:true,marketingSuppressed:ok||undefined,message:'Marketing preference recorded. Transactional account and security messages are unchanged.'})}
