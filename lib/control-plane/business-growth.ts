import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import type {SqlClient} from '@/lib/customer/sql';
import {one} from '@/lib/customer/sql';

export const BUSINESS_ACTIVITY_EPOCH='MANAGED_PROFILE_OPEN_V1' as const;
export const CAMPAIGN_DELIVERY_STATUS={sent:'NOT_CONNECTED',delivered:'NOT_CONNECTED',opened:'NOT_CONNECTED',bounce:'NOT_CONNECTED',complaint:'NOT_CONNECTED',unsubscribe:'LIVE'} as const;
export type ActivationState='NOT_CLAIMED'|'CLAIM_APPROVED_NOT_OPENED'|'OPENED_NO_ACTION'|'ACTIVATED'|'GRANT_REVOKED'|'MANAGER_OPEN_HISTORY_UNAVAILABLE'|'UNKNOWN';
export type BusinessListFilter='ALL'|'CLAIMED'|'ACTIVATED'|'NOT_ACTIVATED'|'ACTIVE_30D'|'INACTIVE_30D'|'NO_MANAGER_OPEN'|'NO_POST_CLAIM_ACTION';

export type BusinessRow={orgId:string;organization:string;organizationStatus:string;profileCount:number;activeGrantCount:number;hubs:string[];earliestApprovedClaim:string|null;acquisitionSource:string;campaign:string|null;activationState:ActivationState;activationAt:string|null;lastActivityAt:string|null;active30d:boolean|null;teamSize:number;completeness:number|null};

const QUALIFYING_ACTIONS=['business_profile_updated','business_info_reconfirmed','organization_member_invited','record_issue_created','business_reply_submitted','monitoring_enabled'];

export async function readBusinessOperations(sql:SqlClient,filter:BusinessListFilter='ALL'):Promise<{epoch:string|null;rows:BusinessRow[]}> {
  const epoch=(await one<{started_at:string}>(sql,`SELECT started_at::text FROM ath_business_activity_epochs WHERE epoch_key=$1`,[BUSINESS_ACTIVITY_EPOCH]))?.started_at??null;
  const result=await sql.query<Record<string,unknown>>(`
    WITH grants AS (
      SELECT g.org_id,min(g.granted_at) FILTER(WHERE g.status='active') approved_at,
        count(*) FILTER(WHERE g.status='active')::int active_grants,count(*)::int grants_all,
        string_agg(DISTINCT p.hub_id,',' ORDER BY p.hub_id) hubs,count(DISTINCT p.id)::int profile_count
      FROM ath_management_grants g JOIN ath_hub_profiles p ON p.id=g.hub_profile_id GROUP BY g.org_id
    ), opens AS (
      SELECT org_id,min(occurred_at) first_open,max(occurred_at) last_open FROM ath_business_activity_events WHERE event_type='MANAGED_PROFILE_OPENED' GROUP BY org_id
    ), actions AS (
      SELECT a.org_id,min(a.created_at) first_action,max(a.created_at) last_action FROM ath_audit_events a JOIN grants g ON g.org_id=a.org_id
       WHERE a.action=ANY($1::text[]) AND a.created_at>=g.approved_at GROUP BY a.org_id
    ), completion AS (
      SELECT g.org_id,round(100.0*avg((CASE WHEN EXISTS(SELECT 1 FROM ath_business_profile_fields f WHERE f.org_id=g.org_id AND f.hub_profile_id=p.id AND f.field_key IN('description','website','public_phone') AND btrim(f.value_text)<>'') THEN 1 ELSE 0 END
        +CASE WHEN EXISTS(SELECT 1 FROM ath_business_profile_items i WHERE i.org_id=g.org_id AND i.hub_profile_id=p.id AND i.category='service') THEN 1 ELSE 0 END
        +CASE WHEN EXISTS(SELECT 1 FROM ath_business_profile_hours h WHERE h.org_id=g.org_id AND h.hub_profile_id=p.id) THEN 1 ELSE 0 END)/3.0))::int score
      FROM ath_management_grants g JOIN ath_hub_profiles p ON p.id=g.hub_profile_id WHERE g.status='active' GROUP BY g.org_id
    ), attribution AS (
      SELECT c.org_id,min(COALESCE(c.attestation->>'acquisition_source','unknown')) source,min(gc.name) campaign
      FROM ath_claims c LEFT JOIN ath_claim_attribution ca ON ca.claim_id=c.id LEFT JOIN ath_growth_campaigns gc ON gc.campaign_id=ca.campaign_id GROUP BY c.org_id
    )
    SELECT o.id::text org_id,o.display_name,o.status,COALESCE(g.profile_count,0) profile_count,COALESCE(g.active_grants,0) active_grants,
      COALESCE(g.hubs,'') hubs,g.approved_at::text,at.source,at.campaign,op.first_open::text,op.last_open::text,ac.first_action::text,ac.last_action::text,
      greatest(op.last_open,ac.last_action)::text last_activity,c.score,
      CASE WHEN COALESCE(g.grants_all,0)=0 THEN 'NOT_CLAIMED'
           WHEN COALESCE(g.active_grants,0)=0 THEN 'GRANT_REVOKED'
           WHEN op.first_open IS NULL AND g.approved_at<$2::timestamptz THEN 'MANAGER_OPEN_HISTORY_UNAVAILABLE'
           WHEN op.first_open IS NULL THEN 'CLAIM_APPROVED_NOT_OPENED'
           WHEN ac.first_action IS NULL THEN 'OPENED_NO_ACTION' ELSE 'ACTIVATED' END activation_state,
      CASE WHEN op.first_open IS NOT NULL AND ac.first_action IS NOT NULL THEN greatest(g.approved_at,op.first_open,ac.first_action)::text END activation_at,
      (SELECT count(*)::int FROM ath_memberships m WHERE m.org_id=o.id AND m.status='active') team_size
    FROM ath_organizations o LEFT JOIN grants g ON g.org_id=o.id LEFT JOIN opens op ON op.org_id=o.id LEFT JOIN actions ac ON ac.org_id=o.id
      LEFT JOIN completion c ON c.org_id=o.id LEFT JOIN attribution at ON at.org_id=o.id ORDER BY o.created_at DESC`,[QUALIFYING_ACTIONS,epoch??new Date().toISOString()]);
  let rows=result.rows.map(row=>{const activationAt=row.activation_at?String(row.activation_at):null,last=row.last_activity?String(row.last_activity):null;const active30d=activationAt?Boolean(last&&new Date(last)>=new Date(new Date(activationAt).getTime()+30*864e5)):null;return{orgId:String(row.org_id),organization:String(row.display_name),organizationStatus:String(row.status),profileCount:Number(row.profile_count),activeGrantCount:Number(row.active_grants),hubs:String(row.hubs||'').split(',').filter(Boolean),earliestApprovedClaim:row.approved_at?String(row.approved_at):null,acquisitionSource:String(row.source||'UNKNOWN').toUpperCase(),campaign:row.campaign?String(row.campaign):null,activationState:String(row.activation_state) as ActivationState,activationAt,lastActivityAt:last,active30d,teamSize:Number(row.team_size),completeness:row.score==null?null:Number(row.score)} satisfies BusinessRow});
  if(filter!=='ALL')rows=rows.filter(r=>filter==='CLAIMED'?r.profileCount>0:filter==='ACTIVATED'?r.activationState==='ACTIVATED':filter==='NOT_ACTIVATED'?r.profileCount>0&&r.activationState!=='ACTIVATED':filter==='ACTIVE_30D'?r.active30d===true:filter==='INACTIVE_30D'?r.active30d===false:filter==='NO_MANAGER_OPEN'?r.activationState==='CLAIM_APPROVED_NOT_OPENED':r.activationState==='OPENED_NO_ACTION');
  return {epoch,rows};
}

export async function readBusinessDetail(sql:SqlClient,orgId:string){
  const list=await readBusinessOperations(sql); const organization=list.rows.find(r=>r.orgId===orgId); if(!organization)return null;
  const [profiles,claims,team,timeline]=await Promise.all([
    sql.query<Record<string,unknown>>(`SELECT p.id::text,p.hub_id,p.entity_class,p.identifier_namespace,p.native_credential_key,p.display_name_snapshot,g.status grant_status,g.granted_at::text FROM ath_management_grants g JOIN ath_hub_profiles p ON p.id=g.hub_profile_id WHERE g.org_id=$1 ORDER BY g.granted_at DESC`,[orgId]),
    sql.query<Record<string,unknown>>(`SELECT c.id::text,c.status,c.created_at::text,c.reviewed_at::text,p.hub_id,p.display_name_snapshot FROM ath_claims c JOIN ath_hub_profiles p ON p.id=c.hub_profile_id WHERE c.org_id=$1 ORDER BY c.created_at DESC`,[orgId]),
    sql.query<Record<string,unknown>>(`SELECT m.role,m.status,m.created_at::text FROM ath_memberships m WHERE m.org_id=$1 ORDER BY m.created_at`,[orgId]),
    sql.query<Record<string,unknown>>(`SELECT action,created_at::text,object_type FROM ath_audit_events WHERE org_id=$1 UNION ALL SELECT event_type,occurred_at::text,'ath_business_activity_events' FROM ath_business_activity_events WHERE org_id=$1 ORDER BY created_at DESC LIMIT 100`,[orgId])]);
  return {organization,profiles:profiles.rows,claims:claims.rows,team:team.rows,timeline:timeline.rows};
}

export async function readCampaigns(sql:SqlClient){return(await sql.query<Record<string,unknown>>(`SELECT c.campaign_id::text,c.name,c.channel,c.status,c.acquisition_source,c.starts_at::text,c.ends_at::text,
  count(DISTINCT t.target_id)::int targets,count(DISTINCT e.event_id) FILTER(WHERE e.event_type='LINK_CLICKED')::int clicks,
  count(DISTINCT ca.claim_id)::int claims_started,count(DISTINCT ca.claim_id) FILTER(WHERE cl.status IN('approved','rejected'))::int claims_completed,
  count(DISTINCT ca.claim_id) FILTER(WHERE cl.status='approved')::int approved
  FROM ath_growth_campaigns c LEFT JOIN ath_growth_campaign_targets t ON t.campaign_id=c.campaign_id LEFT JOIN ath_growth_campaign_events e ON e.campaign_id=c.campaign_id LEFT JOIN ath_claim_attribution ca ON ca.campaign_id=c.campaign_id LEFT JOIN ath_claims cl ON cl.id=ca.claim_id GROUP BY c.campaign_id ORDER BY c.created_at DESC`)).rows}

export async function readCampaignDetail(sql:SqlClient,id:string){const campaign=await one<Record<string,unknown>>(sql,`SELECT campaign_id::text,name,channel,status,acquisition_source,description,starts_at::text,ends_at::text,created_at::text FROM ath_growth_campaigns WHERE campaign_id=$1`,[id]);if(!campaign)return null;const targets=await sql.query<Record<string,unknown>>(`SELECT t.target_id::text,t.status,p.hub_id,p.entity_class,p.native_credential_key,p.display_name_snapshot,t.created_at::text FROM ath_growth_campaign_targets t LEFT JOIN ath_hub_profiles p ON p.id=t.hub_profile_id WHERE t.campaign_id=$1 ORDER BY t.created_at DESC`,[id]);return{campaign,targets:targets.rows,delivery:CAMPAIGN_DELIVERY_STATUS}}

export async function createCampaign(sql:SqlClient,staffId:string,input:{name:string;channel:string;acquisitionSource:string;description?:string}){if(!input.name.trim()||!['EMAIL','MANUAL_OUTREACH','PARTNER','OTHER'].includes(input.channel)||!['ORGANIC','MANUAL_OUTREACH','EMAIL_CAMPAIGN','INTERNAL_TEST','UNKNOWN'].includes(input.acquisitionSource))throw new Error('VALIDATION_FAILED');return one<{campaign_id:string}>(sql,`INSERT INTO ath_growth_campaigns(name,channel,acquisition_source,description,created_by_staff) VALUES($1,$2,$3,$4,$5) RETURNING campaign_id::text`,[input.name.trim(),input.channel,input.acquisitionSource,input.description?.trim()??'',staffId])}
export async function updateCampaignStatus(sql:SqlClient,id:string,status:'ACTIVE'|'PAUSED'|'COMPLETED'|'ARCHIVED'){return one<Record<string,unknown>>(sql,`UPDATE ath_growth_campaigns SET status=$2 WHERE campaign_id=$1 AND status<>'ARCHIVED' RETURNING campaign_id::text,status`,[id,status])}

export async function createCampaignTarget(sql:SqlClient,campaignId:string,hubProfileId:string,claimPath:string){if(!/^\/claim(?:\/|\?|$)/.test(claimPath)||/[\r\n]/.test(claimPath))throw new Error('INVALID_DESTINATION');const campaign=await one<{status:string}>(sql,`SELECT status FROM ath_growth_campaigns WHERE campaign_id=$1 FOR UPDATE`,[campaignId]);if(!campaign||campaign.status==='PAUSED'||campaign.status==='ARCHIVED')throw new Error('CAMPAIGN_NOT_ELIGIBLE');const profile=await one(sql,`SELECT 1 FROM ath_hub_profiles WHERE id=$1 AND publication_state='public'`,[hubProfileId]);if(!profile)throw new Error('PROFILE_NOT_ELIGIBLE');const token=randomBytes(32).toString('base64url'),tokenHash=hashOpaque(token);const row=await one<{target_id:string}>(sql,`INSERT INTO ath_growth_campaign_targets(campaign_id,hub_profile_id,token_hash,claim_path) VALUES($1,$2,$3,$4) RETURNING target_id::text`,[campaignId,hubProfileId,tokenHash,claimPath]);await sql.query(`INSERT INTO ath_growth_campaign_events(campaign_id,target_id,event_type,idempotency_key,evidence_source) VALUES($1,$2,'TARGET_ADDED',$3,'ADMIN')`,[campaignId,row!.target_id,`target-added:${row!.target_id}`]);return{targetId:row!.target_id,token}}

export const hashOpaque=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function resolveCampaignClick(sql:SqlClient,token:string){if(!/^[A-Za-z0-9_-]{30,100}$/.test(token))return null;const target=await one<{target_id:string;campaign_id:string;claim_path:string;status:string;campaign_status:string;contact_hash:string|null}>(sql,`SELECT t.target_id::text,t.campaign_id::text,t.claim_path,t.status,c.status campaign_status,t.contact_hash FROM ath_growth_campaign_targets t JOIN ath_growth_campaigns c ON c.campaign_id=t.campaign_id WHERE t.token_hash=$1`,[hashOpaque(token)]);if(!target||target.status!=='READY'||target.campaign_status==='ARCHIVED'||target.contact_hash&&await one(sql,`SELECT 1 FROM ath_marketing_suppressions WHERE contact_hash=$1`,[target.contact_hash]))return null;await sql.query(`INSERT INTO ath_growth_campaign_events(campaign_id,target_id,event_type,idempotency_key,evidence_source) VALUES($1,$2,'LINK_CLICKED',$3,'REDIRECT') ON CONFLICT(idempotency_key) DO NOTHING`,[target.campaign_id,target.target_id,`first-click:${target.target_id}`]);return target}
export async function attributeClaim(sql:SqlClient,claimId:string,token:string){const target=await one<{target_id:string;campaign_id:string}>(sql,`SELECT target_id::text,campaign_id::text FROM ath_growth_campaign_targets WHERE token_hash=$1 AND status='READY'`,[hashOpaque(token)]);if(!target)return false;await sql.query(`INSERT INTO ath_claim_attribution(claim_id,acquisition_source,campaign_id,campaign_target_id) VALUES($1,'EMAIL_CAMPAIGN',$2,$3) ON CONFLICT(claim_id) DO NOTHING`,[claimId,target.campaign_id,target.target_id]);return true}
export async function suppressMarketing(sql:SqlClient,token:string){const target=await one<{target_id:string;campaign_id:string;contact_hash:string|null}>(sql,`SELECT target_id::text,campaign_id::text,contact_hash FROM ath_growth_campaign_targets WHERE token_hash=$1`,[hashOpaque(token)]);if(!target?.contact_hash)return false;await sql.query(`INSERT INTO ath_marketing_suppressions(contact_hash,reason,source) VALUES($1,'UNSUBSCRIBED','CAMPAIGN_LINK') ON CONFLICT(contact_hash) DO NOTHING`,[target.contact_hash]);await sql.query(`INSERT INTO ath_growth_campaign_events(campaign_id,target_id,event_type,idempotency_key,evidence_source) VALUES($1,$2,'UNSUBSCRIBED',$3,'UNSUBSCRIBE_ENDPOINT') ON CONFLICT(idempotency_key) DO NOTHING`,[target.campaign_id,target.target_id,`unsubscribe:${target.contact_hash}`]);return true}
