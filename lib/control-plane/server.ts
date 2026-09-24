import 'server-only';
import {headers} from 'next/headers';
import {readSessionToken} from '@/lib/customer/server';
import {withAskTx} from '@/lib/customer/db';
import {clientIp} from '@/lib/customer/client-ip';
import type {SqlClient} from '@/lib/customer/sql';
import {AdminSecurityService,type AdminRequestContext} from './security';

export async function withAdminSecurity<T>(fn:(service:AdminSecurityService,token:string,ctx:AdminRequestContext,sql:SqlClient)=>Promise<T>):Promise<T>{
  const token=await readSessionToken()??'',h=await headers();
  const ctx={requestId:h.get('x-request-id')??crypto.randomUUID(),ip:clientIp(h),userAgent:h.get('user-agent')};
  return withAskTx(client=>{const sql=client as unknown as SqlClient;return fn(new AdminSecurityService(sql),token,ctx,sql)});
}
