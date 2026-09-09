import { NextResponse } from 'next/server';
import { withPlatform } from '@/lib/customer/server';
import { fetchContractorMonitoringEvents } from '@/lib/customer/monitoring-feed';
import {randomUUID} from 'node:crypto';
import {recordHealthObservation,seedCapabilityRegistry} from '@/lib/control-plane/data-health';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const cronSecret=process.env.CRON_SECRET||'';
  if(cronSecret.length<16||request.headers.get('authorization')!==`Bearer ${cronSecret}`) return new Response('Unauthorized',{status:401});
  const cursor=await withPlatform(async(_p,sql)=>{
    const row=await sql.query<{last_sequence:string}>(`SELECT last_sequence::text FROM ath_monitoring_sync_cursors WHERE source_key='contractor_fl_dbpr'`);
    return Number(row.rows[0]?.last_sequence||0);
  });
  const checkedAt=new Date().toISOString();
  let events;
  try{events=await fetchContractorMonitoringEvents(cursor,100)}catch(error){
    await withPlatform(async(_p,sql)=>{await seedCapabilityRegistry(sql);await recordHealthObservation(sql,{schema_version:'capability_health.v1',observation_id:randomUUID(),capability_key:'ASK_CONTRACTOR_MONITORING',hub:'ask',status:error instanceof Error&&error.message==='monitoring_feed_contract'?'DEGRADED':'DEGRADED',reason_code:error instanceof Error&&error.message==='monitoring_feed_contract'?'FEED_CONTRACT_MISMATCH':'POLL_FAILURE',checked_at:checkedAt,last_failure_at:checkedAt,evidence_ref:'contractor_signed_feed',observed_by:'regulatory-monitoring-cron'});await upsertIncident(sql,'ASK_CONTRACTOR_MONITORING',error instanceof Error&&error.message==='monitoring_feed_contract'?'SCHEMA_DRIFT':'MONITORING_HEALTH',error instanceof Error&&error.message==='monitoring_feed_contract'?'FEED_CONTRACT_MISMATCH':'POLL_FAILURE',checkedAt)});
    return NextResponse.json({ok:false,code:'monitoring_health_degraded'},{status:502,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  }
  const result=await withPlatform(async(p,sql)=>{
    const ingested=await p.ingestMonitoringEvents(events);
    const last=events.reduce((n,e)=>Math.max(n,Number(e.sequence_id)||0),cursor);
    if(last>cursor) await sql.query(`INSERT INTO ath_monitoring_sync_cursors(source_key,last_sequence) VALUES('contractor_fl_dbpr',$1) ON CONFLICT(source_key) DO UPDATE SET last_sequence=GREATEST(ath_monitoring_sync_cursors.last_sequence,EXCLUDED.last_sequence),updated_at=now()`,[last]);
    const deliveries=await p.deliverMonitoringEmails(50);
    await seedCapabilityRegistry(sql);
    await recordHealthObservation(sql,{schema_version:'capability_health.v1',observation_id:randomUUID(),capability_key:'ASK_CONTRACTOR_MONITORING',hub:'ask',status:'CURRENT',reason_code:events.length?'POLL_SUCCEEDED_EVENTS':'POLL_SUCCEEDED_NO_CHANGE',checked_at:checkedAt,last_success_at:checkedAt,retrieved_at:checkedAt,records_observed:events.length,contract_version:'1',evidence_ref:`cursor:${last}`,observed_by:'regulatory-monitoring-cron'});
    await sql.query(`UPDATE ath_data_incidents SET status='RESOLVED',resolved_at=now(),resolution_reason='SYSTEM_HEALTH_RECOVERED',updated_at=now() WHERE capability_key='ASK_CONTRACTOR_MONITORING' AND status IN('OPEN','ACKNOWLEDGED')`);
    return {...ingested,...deliveries,lastSequence:last,health:'CURRENT',emptyPoll:events.length===0};
  });
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}

async function upsertIncident(sql:import('@/lib/customer/sql').SqlClient,capability:string,type:string,reason:string,at:string){const stable=`${capability}:${reason}`;await sql.query(`INSERT INTO ath_data_incidents(capability_key,incident_type,severity,status,reason_code,stable_key,first_seen,last_seen) VALUES($1,$2,'P1','OPEN',$3,$4,$5,$5) ON CONFLICT(stable_key) DO UPDATE SET last_seen=EXCLUDED.last_seen,occurrence_count=ath_data_incidents.occurrence_count+1,status=CASE WHEN ath_data_incidents.status='RESOLVED' THEN 'OPEN' ELSE ath_data_incidents.status END,resolved_at=NULL,resolved_by=NULL,resolution_reason=NULL`,[capability,type,reason,stable,at])}
