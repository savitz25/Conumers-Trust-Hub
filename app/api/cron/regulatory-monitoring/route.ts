import { NextResponse } from 'next/server';
import { withPlatform } from '@/lib/customer/server';
import { fetchContractorMonitoringEvents } from '@/lib/customer/monitoring-feed';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const cronSecret=process.env.CRON_SECRET||'';
  if(cronSecret.length<16||request.headers.get('authorization')!==`Bearer ${cronSecret}`) return new Response('Unauthorized',{status:401});
  const cursor=await withPlatform(async(_p,sql)=>{
    const row=await sql.query<{last_sequence:string}>(`SELECT last_sequence::text FROM ath_monitoring_sync_cursors WHERE source_key='contractor_fl_dbpr'`);
    return Number(row.rows[0]?.last_sequence||0);
  });
  const events=await fetchContractorMonitoringEvents(cursor,100);
  const result=await withPlatform(async(p,sql)=>{
    const ingested=await p.ingestMonitoringEvents(events);
    const last=events.reduce((n,e)=>Math.max(n,Number(e.sequence_id)||0),cursor);
    if(last>cursor) await sql.query(`INSERT INTO ath_monitoring_sync_cursors(source_key,last_sequence) VALUES('contractor_fl_dbpr',$1) ON CONFLICT(source_key) DO UPDATE SET last_sequence=GREATEST(ath_monitoring_sync_cursors.last_sequence,EXCLUDED.last_sequence),updated_at=now()`,[last]);
    const deliveries=await p.deliverMonitoringEmails(50);
    return {...ingested,...deliveries,lastSequence:last};
  });
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
