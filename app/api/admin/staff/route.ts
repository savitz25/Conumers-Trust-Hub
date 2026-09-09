import{NextResponse}from'next/server';import{withAdminSecurity}from'@/lib/control-plane/server';import{adminErrorResponse}from'@/lib/control-plane/http';
export const runtime='nodejs';export async function GET(){try{return NextResponse.json({ok:true,staff:await withAdminSecurity((s,t)=>s.listStaff(t))},{headers:{'Cache-Control':'no-store'}})}catch(e){return adminErrorResponse(e)}}
