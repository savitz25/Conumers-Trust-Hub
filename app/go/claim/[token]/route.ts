import {NextResponse} from 'next/server';
import {withAskTx} from '@/lib/customer/db';
import {resolveCampaignClick} from '@/lib/control-plane/business-growth';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){const{token}=await params;const target=await withAskTx(sql=>resolveCampaignClick(sql,token));if(!target)return NextResponse.redirect(new URL('/claim/help?category=invalid_campaign_link',process.env.NEXT_PUBLIC_SITE_URL??'https://www.asktrusthub.com'));const response=NextResponse.redirect(new URL(target.claim_path,process.env.NEXT_PUBLIC_SITE_URL??'https://www.asktrusthub.com'));response.cookies.set('ath_campaign_attribution',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:30*86400});return response}
