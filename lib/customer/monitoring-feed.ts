import 'server-only';
import { monitoringRequestSignature, type ContractorMonitoringEvent } from './monitoring';

const PATH='/api/internal/monitoring/events';

export async function fetchContractorMonitoringEvents(after:number,limit=100):Promise<ContractorMonitoringEvent[]> {
  const secret=process.env.ATH_HANDOFF_SECRET||'';
  if(secret.length<32) throw new Error('monitoring_feed_unconfigured');
  const origin=(process.env.ATH_CONTRACTOR_ORIGIN||'https://www.contractortrusthub.com').replace(/\/$/,'');
  const timestamp=String(Date.now());
  const response=await fetch(`${origin}${PATH}?after=${after}&limit=${Math.min(250,Math.max(1,limit))}`,{
    headers:{'x-ath-timestamp':timestamp,'x-ath-signature':monitoringRequestSignature(secret,timestamp,'GET',PATH)},cache:'no-store',signal:AbortSignal.timeout(15_000),
  });
  if(!response.ok) throw new Error(`monitoring_feed_${response.status}`);
  const data=await response.json() as {contractVersion?:number;events?:ContractorMonitoringEvent[]};
  if(data.contractVersion!==1||!Array.isArray(data.events)) throw new Error('monitoring_feed_contract');
  return data.events;
}
