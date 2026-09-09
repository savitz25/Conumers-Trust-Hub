import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { withAskTx } from '@/lib/customer/db';
import { customerLog } from '@/lib/customer/log';
import { PRODUCT_EVENT_PROHIBITED_FIELDS, validateProductEventV1, type ProductEventV1 } from './contracts/product-event-v1';
import { searchTerminalOutcome, type AskIntelObservation } from '@/lib/network/ask-intel-observability';
import { guidedSearchTerminalOutcome } from '@/lib/network/ask-intel-observability';
import type { GuidedApiResponse } from '@/lib/guided-research/contract';
import type { SqlClient } from '@/lib/customer/sql';

export const FIRST_PARTY_CLIENT_EVENTS = [
  'claim_cta_clicked','claim_handoff_received','claim_auth_required','claim_auth_returned',
  'claim_validation_started','claim_validation_failed','claim_started','claim_completed',
  'claim_recovery_viewed','claim_review_requested','manage_business_opened',
  'business_info_saved','business_info_reconfirmed','record_issue_submitted',
  'business_reply_submitted','monitoring_enabled','my_trust_hub_viewed',
] as const;
type ClientEventName = (typeof FIRST_PARTY_CLIENT_EVENTS)[number];

const allowedClientEvents = new Set<string>(FIRST_PARTY_CLIENT_EVENTS);
const safeToken = (value: unknown, max = 64) => typeof value === 'string' && /^[A-Za-z0-9_./:-]+$/.test(value) ? value.slice(0, max) : undefined;
const hub = (value: unknown): ProductEventV1['hub'] => ['ask','move','lender','insurance','contractor','senior','investor'].includes(String(value)) ? value as ProductEventV1['hub'] : 'ask';

export function buildClientProductEvent(input: { eventName: string; properties?: Record<string, unknown>; routeFamily: string; authenticated: boolean }): ProductEventV1 {
  if (!allowedClientEvents.has(input.eventName)) throw new Error('event_not_allowed');
  const p = input.properties ?? {};
  const keys=Object.keys(p).map(key=>key.toLowerCase());
  if(PRODUCT_EVENT_PROHIBITED_FIELDS.some(key=>keys.includes(key)))throw new Error('prohibited_event_field');
  const jurisdiction = safeToken(p.state, 2)?.toUpperCase();
  return {
    schema_version: 'product_event.v1', event_id: randomUUID(), event_name: input.eventName as ClientEventName,
    occurred_at: new Date().toISOString(), surface: 'BROWSER', hub: hub(p.hub), route_family: input.routeFamily.slice(0, 80),
    jurisdiction: jurisdiction?.length === 2 ? jurisdiction : undefined,
    profile_class: safeToken(p.profile_class ?? p.profileClass),
    failure_reason: safeToken(p.result_state ?? p.resultState ?? p.reason),
    auth_state: input.authenticated ? 'AUTHENTICATED' : 'ANONYMOUS',
    acquisition_source: ({organic:'ORGANIC',manual_outreach:'MANUAL_OUTREACH',email_campaign:'EMAIL_CAMPAIGN',internal_test:'INTERNAL_TEST'} as const)[String(p.source) as 'organic'] ?? 'UNKNOWN',
    campaign_id: safeToken(p.campaign_id, 80), build_id: safeToken(process.env.VERCEL_GIT_COMMIT_SHA, 80),
  };
}

export async function persistProductEventV1(event: ProductEventV1): Promise<'INSERTED'|'DUPLICATE'> {
  const valid = validateProductEventV1(event);
  if (!valid.ok) throw new Error(`invalid_product_event:${valid.errors.join(',')}`);
  return withAskTx(client => insertProductEventV1(client,event));
}

export async function insertProductEventV1(sql:SqlClient,event:ProductEventV1):Promise<'INSERTED'|'DUPLICATE'>{
  const valid=validateProductEventV1(event);if(!valid.ok)throw new Error(`invalid_product_event:${valid.errors.join(',')}`);
  const r = await sql.query(`INSERT INTO ath_product_events(schema_version,event_id,event_name,occurred_at,surface,hub,route_family,jurisdiction,profile_class,intent,terminal_outcome,failure_reason,next_action_type,auth_state,acquisition_source,campaign_id,duration_ms,result_count_bucket,build_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,
      [event.schema_version,event.event_id,event.event_name,event.occurred_at,event.surface,event.hub,event.route_family??null,event.jurisdiction??null,event.profile_class??null,event.intent??null,event.terminal_outcome??null,event.failure_reason??null,event.next_action_type??null,event.auth_state??null,event.acquisition_source??null,event.campaign_id??null,event.duration_ms??null,event.result_count_bucket??null,event.build_id??null]);
  return r.rows.length === 1 ? 'INSERTED' : 'DUPLICATE';
}

export async function recordProductEventV1(event: ProductEventV1): Promise<void> {
  try { await persistProductEventV1(event); }
  catch (error) { customerLog('product_event_persist_failed',{eventName:event.event_name,errorClass:error instanceof Error?error.name:'unknown'},'error'); }
}

export async function recordSearchObservation(observation: AskIntelObservation): Promise<void> {
  await recordProductEventV1({schema_version:'product_event.v1',event_id:randomUUID(),event_name:'search_terminal_outcome',occurred_at:new Date().toISOString(),surface:observation.surface,hub:hub(observation.hub),route_family:'/ask',profile_class:observation.entityClass==='none'?undefined:observation.entityClass,intent:safeToken(observation.intent),terminal_outcome:searchTerminalOutcome(observation),failure_reason:observation.success?'none':safeToken(observation.resultState),next_action_type:observation.destinationType==='none'?undefined:safeToken(observation.destinationType),auth_state:'UNKNOWN',duration_ms:latencyUpperBound(observation.latencyBucket),result_count_bucket:observation.resultCountBucket,build_id:safeToken(process.env.VERCEL_GIT_COMMIT_SHA,80)});
}

export async function recordGuidedSearch(response: GuidedApiResponse): Promise<void> {
  const result=response.result, hasNext=Boolean(result?.destinations.length || result?.nextActions?.length);
  await recordProductEventV1({schema_version:'product_event.v1',event_id:randomUUID(),event_name:'search_terminal_outcome',occurred_at:new Date().toISOString(),surface:'GUIDED',hub:hub(response.session.hub),route_family:'/ask',profile_class:safeToken(response.session.entityClass),intent:safeToken(response.session.researchPlan.intent),terminal_outcome:guidedSearchTerminalOutcome(result?.resultState ?? 'CLARIFICATION_REQUIRED',result?.total??0,hasNext),failure_reason:safeToken(result?.error?.code ?? (result?.total?'none':result?.resultState ?? 'CLARIFICATION_REQUIRED')),next_action_type:safeToken(result?.nextActions?.[0]?.type ?? result?.destinations[0]?.type),auth_state:'UNKNOWN',duration_ms:Math.max(0,Math.min(300000,response.diagnostics.latencyMs)),result_count_bucket:resultCountBucket(result?.total??0),build_id:safeToken(process.env.VERCEL_GIT_COMMIT_SHA,80)});
}

function resultCountBucket(value:number):ProductEventV1['result_count_bucket']{return value<=0?'0':value===1?'1':value<=10?'2-10':value<=25?'11-25':value<=100?'26-100':value<=500?'101-500':value<=1000?'501-1000':'1001+'}
function latencyUpperBound(value:string):number|undefined{return ({'<100ms':99,'100-250ms':249,'250-500ms':499,'500-1000ms':999,'1-2s':1999,'2-5s':4999,'5-10s':9999,'10-20s':19999,'20s+':20000} as Record<string,number>)[value]}

export async function acceptClientProductEvent(input: { eventName: string; properties?: Record<string, unknown>; routeFamily: string; authenticated: boolean; rateIdentity: string }): Promise<void> {
  const event = buildClientProductEvent(input);
  const rateKey = createHash('sha256').update(input.rateIdentity || 'unknown').digest('hex');
  await withAskTx(async client => {
    const count = await client.query<{n:number}>(`SELECT count(*)::int n FROM ath_rate_events WHERE bucket='product_event_client' AND rate_key=$1 AND created_at>now()-interval '1 minute'`,[rateKey]);
    if (Number(count.rows[0]?.n ?? 0) >= 60) throw new Error('rate_limited');
    await client.query(`INSERT INTO ath_rate_events(bucket,rate_key) VALUES('product_event_client',$1)`,[rateKey]);
  });
  await persistProductEventV1(event);
}
