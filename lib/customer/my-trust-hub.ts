import { BUSINESS_FIELD_KEYS } from './business-profile.ts';
import { businessFreshness, type BusinessFreshnessState } from './freshness.ts';
import { CUSTOMER_HUB_REGISTRY, customerEntityClassLabel } from './hub-registry.ts';
import type { CustomerHubId } from './types.ts';

export type AttentionPriority = 'HIGH' | 'NORMAL' | 'INFORMATIONAL';
export type AttentionType = 'CLAIM_NEEDS_INFO' | 'CLAIM_IN_REVIEW' | 'PROFILE_INFORMATION_INCOMPLETE' | 'PROFILE_INFORMATION_STALE' | 'RECORD_ISSUE_OPEN' | 'BUSINESS_RESPONSE_DRAFT' | 'MONITORING_DISABLED' | 'MONITORING_NOTIFICATION_UNREAD' | 'TEAM_INVITATION_PENDING';
export type MonitoringStatus = 'ON' | 'OFF' | 'UNAVAILABLE';
export type ProfilePrimaryAction = 'REVIEW_ISSUE' | 'REVIEW_NOTIFICATION' | 'RECONFIRM_INFORMATION' | 'COMPLETE_INFORMATION' | 'CONTINUE_RESPONSE' | 'ENABLE_MONITORING' | 'REVIEW_EVIDENCE';

export type MyTrustHubRawProfile = Record<string, unknown> & { hub_id: CustomerHubId };
export type MyTrustHubRawClaim = Record<string, unknown> & { hub_id: CustomerHubId };
export type MyTrustHubRawOrganization = Record<string, unknown>;
export type MyTrustHubRawActivity = Record<string, unknown> & { hub_id?: CustomerHubId };

export type BusinessAttentionItem = {
  id: string;
  type: AttentionType;
  priority: AttentionPriority;
  label: string;
  reason: string;
  context: string;
  href: string;
};

export type ProfileHomeCard = {
  profileId: string;
  organizationId: string;
  organizationName: string;
  displayName: string;
  hubId: CustomerHubId;
  hubName: string;
  entityClass: string;
  identifierLabel: string;
  identifierValue: string;
  role: string;
  managementStatus: string;
  publicUrl: string | null;
  monitoringStatus: MonitoringStatus;
  completeness: { completed: number; total: number; percent: number; label: string };
  freshness: { state: BusinessFreshnessState | 'NOT_STARTED'; label: string };
  setup: { completed: number; total: number };
  attentionCount: number;
  primaryAction: { type: ProfilePrimaryAction; label: string; href: string };
};

export type MyTrustHubHome = {
  organizations: Array<{ id: string; name: string; role: string; profileCount: number; teamCount: number; pendingInvitationCount: number; hubNames: string[] }>;
  profiles: ProfileHomeCard[];
  summary: { managedProfiles: number; organizations: number; needsAttention: number; claimsInProgress: number; monitoringOn: number };
  attentionItems: BusinessAttentionItem[];
  claimsInProgress: Array<{ id: string; displayName: string; hubName: string; statusLabel: string; needed: string; href: string }>;
  recentActivity: Array<{ id: string; label: string; context: string; occurredAt: string; href: string | null }>;
  monitoringSummary: { on: number; off: number; unavailable: number };
};

const OWNER_HUB_NAMES: Record<CustomerHubId, string> = {
  move: 'Move Trust Hub', lender: 'Lender Trust Hub', insurance: 'Insurance Trust Hub',
  senior: 'SeniorTrustHub', contractor: 'Contractor Trust Hub', investor: 'InvestorTrustHub',
};
const PRIORITY_ORDER: Record<AttentionPriority, number> = { HIGH: 0, NORMAL: 1, INFORMATIONAL: 2 };
const OPEN_CLAIMS = new Set(['submitted', 'needs_info', 'in_review']);
const count = (value: unknown) => Number(value || 0);
const text = (value: unknown) => typeof value === 'string' ? value : '';

export function ownerHubName(hubId: CustomerHubId): string { return OWNER_HUB_NAMES[hubId]; }

export function businessInformationCompleteness(row: MyTrustHubRawProfile) {
  const total = BUSINESS_FIELD_KEYS.length + 4; // services, service areas, languages, hours
  const completed = Math.min(total, count(row.business_field_count) + count(row.business_item_category_count) + (row.business_hours_present ? 1 : 0));
  return { completed, total, percent: Math.round(completed / total * 100), label: completed === total ? 'Business information complete' : `${completed} of ${total} fields completed` };
}

function claimStatus(status: string) {
  if (status === 'needs_info') return { label: 'Information needed', needed: 'Review the request and provide the requested claim information.' };
  if (status === 'in_review') return { label: 'Under review', needed: 'No action is required unless the review team contacts you.' };
  return { label: 'Submitted for review', needed: 'Your claim is awaiting review.' };
}

function activityLabel(action: string): string {
  const labels: Record<string, string> = {
    business_profile_updated: 'Business information updated', business_profile_reconfirmed: 'Business information reconfirmed',
    claim_submitted: 'Claim submitted', claim_approved: 'Claim approved', record_issue_created: 'Record issue submitted',
    business_reply_submitted: 'Business response submitted', business_reply_published: 'Business response published',
    monitoring_enabled: 'Monitoring enabled', monitoring_disabled: 'Monitoring disabled', regulatory_notification_created: 'Monitoring notification received',
    organization_member_invited: 'Team member invited', organization_invite_accepted: 'Invitation accepted',
  };
  return labels[action] ?? 'Account activity';
}

export function buildMyTrustHubHome(input: { profiles: MyTrustHubRawProfile[]; claims: MyTrustHubRawClaim[]; organizations: MyTrustHubRawOrganization[]; activity: MyTrustHubRawActivity[]; now?: Date }): MyTrustHubHome {
  const now = input.now ?? new Date();
  const attention: BusinessAttentionItem[] = [];
  const cards: ProfileHomeCard[] = input.profiles.map((row) => {
    const profileId = text(row.native_profile_id), orgId = text(row.org_id), displayName = text(row.display_name_snapshot) || 'Business profile';
    const hubId = row.hub_id, hubName = ownerHubName(hubId), completeness = businessInformationCompleteness(row);
    const monitoringStatus: MonitoringStatus = CUSTOMER_HUB_REGISTRY[hubId].monitoring === 'UNAVAILABLE' ? 'UNAVAILABLE' : row.monitoring_enabled ? 'ON' : 'OFF';
    const confirmed = text(row.last_confirmed_at);
    const freshness = confirmed ? businessFreshness(confirmed, now) : null;
    const add = (type: AttentionType, priority: AttentionPriority, label: string, reason: string, href: string) => attention.push({ id: `${profileId}:${type}`, type, priority, label, reason, context: `${displayName} · ${hubName}`, href });
    if (count(row.issue_needs_info_count)) add('RECORD_ISSUE_OPEN','HIGH','Information needed on a correction request','A correction request needs information from your organization.',`/manage/${profileId}#record-issues`);
    else if (count(row.open_issue_count)) add('RECORD_ISSUE_OPEN','NORMAL','Review an open correction request','A request about the public record is still open.',`/manage/${profileId}#record-issues`);
    if (count(row.unread_notification_count)) add('MONITORING_NOTIFICATION_UNREAD','HIGH','Review a monitoring notification','Supported public-source evidence associated with this profile changed.',`/manage/${profileId}#monitoring-alerts`);
    if (freshness?.state === 'STALE' || freshness?.state === 'RECONFIRM_SOON') add('PROFILE_INFORMATION_STALE','NORMAL','Review business information',freshness.state === 'STALE' ? 'Business-supplied information needs reconfirmation.' : 'Business-supplied information is nearing its reconfirmation window.',`/manage/${profileId}#business-information`);
    if (completeness.completed < completeness.total) add('PROFILE_INFORMATION_INCOMPLETE','NORMAL','Complete business information','Only business-controlled profile fields are included in this checklist.',`/manage/${profileId}#business-information`);
    if (count(row.draft_reply_count)) add('BUSINESS_RESPONSE_DRAFT','NORMAL','Continue a draft response','A business response draft has not been submitted.',`/manage/${profileId}#business-responses`);
    if (monitoringStatus === 'OFF') add('MONITORING_DISABLED','NORMAL','Turn on optional monitoring','Get notified when supported public-source evidence associated with this profile changes.',`/manage/${profileId}#monitoring`);

    let primaryAction: ProfileHomeCard['primaryAction'];
    if (count(row.issue_needs_info_count) || count(row.open_issue_count)) primaryAction={type:'REVIEW_ISSUE',label:'Review correction request',href:`/manage/${profileId}#record-issues`};
    else if (count(row.unread_notification_count)) primaryAction={type:'REVIEW_NOTIFICATION',label:'Review notification',href:`/manage/${profileId}#monitoring-alerts`};
    else if (freshness && freshness.state !== 'CURRENT') primaryAction={type:'RECONFIRM_INFORMATION',label:'Review business information',href:`/manage/${profileId}#business-information`};
    else if (completeness.completed < completeness.total) primaryAction={type:'COMPLETE_INFORMATION',label:'Complete business information',href:`/manage/${profileId}#business-information`};
    else if (count(row.draft_reply_count)) primaryAction={type:'CONTINUE_RESPONSE',label:'Continue business response',href:`/manage/${profileId}#business-responses`};
    else if (monitoringStatus === 'OFF') primaryAction={type:'ENABLE_MONITORING',label:'Turn on monitoring',href:`/manage/${profileId}#monitoring`};
    else primaryAction={type:'REVIEW_EVIDENCE',label:'Review official evidence',href:`/manage/${profileId}#official-evidence`};
    const setupAvailable = 2 + (monitoringStatus === 'UNAVAILABLE' ? 0 : 1);
    const setupDone = (completeness.completed === completeness.total ? 1 : 0) + (!count(row.open_issue_count) ? 1 : 0) + (monitoringStatus === 'ON' ? 1 : 0);
    return { profileId, organizationId:orgId, organizationName:text(row.organization_name)||'Organization', displayName, hubId, hubName, entityClass:customerEntityClassLabel(row.entity_class), identifierLabel:CUSTOMER_HUB_REGISTRY[hubId].identifierLabel, identifierValue:text(row.native_credential_key), role:text(row.role), managementStatus:text(row.grant_status)==='active'?'Active':'Unavailable', publicUrl:text(row.canonical_url)||null, monitoringStatus, completeness, freshness:freshness?{state:freshness.state,label:freshness.label}:{state:'NOT_STARTED',label:'Business information not yet confirmed'}, setup:{completed:Math.min(setupAvailable,setupDone),total:setupAvailable}, attentionCount:0, primaryAction };
  });

  for (const claim of input.claims.filter((c) => OPEN_CLAIMS.has(text(c.status)))) {
    const status = text(claim.status), hubName=ownerHubName(claim.hub_id), displayName=text(claim.display_name_snapshot)||'Business profile';
    if(status==='needs_info') attention.push({id:`claim:${claim.id}`,type:'CLAIM_NEEDS_INFO',priority:'HIGH',label:'Claim needs information',reason:'Review the claim request to continue.',context:`${displayName} · ${hubName}`,href:`/claim/status/${claim.id}`});
    else attention.push({id:`claim:${claim.id}`,type:'CLAIM_IN_REVIEW',priority:'INFORMATIONAL',label:status==='in_review'?'Claim under review':'Claim submitted',reason:'Your claim is still in progress.',context:`${displayName} · ${hubName}`,href:`/claim/status/${claim.id}`});
  }
  for (const org of input.organizations.filter((o)=>count(o.pending_invitation_count)>0)) attention.push({id:`org:${org.id}:TEAM_INVITATION_PENDING`,type:'TEAM_INVITATION_PENDING',priority:'INFORMATIONAL',label:'Team invitation pending',reason:`${count(org.pending_invitation_count)} invitation${count(org.pending_invitation_count)===1?' is':'s are'} awaiting a response.`,context:text(org.display_name),href:`/manage/organization/${org.id}`});
  attention.sort((a,b)=>PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority]||a.label.localeCompare(b.label));
  for (const card of cards) card.attentionCount=attention.filter((item)=>item.id.startsWith(`${card.profileId}:`)).length;
  const claimsInProgress=input.claims.filter((c)=>OPEN_CLAIMS.has(text(c.status))).map((c)=>{const state=claimStatus(text(c.status));return{id:text(c.id),displayName:text(c.display_name_snapshot)||'Business profile',hubName:ownerHubName(c.hub_id),statusLabel:state.label,needed:state.needed,href:`/claim/status/${c.id}`}});
  const organizations=input.organizations.map((o)=>({id:text(o.id),name:text(o.display_name),role:text(o.role),profileCount:count(o.profile_count),teamCount:count(o.team_count),pendingInvitationCount:count(o.pending_invitation_count),hubNames:text(o.hub_ids).split(',').filter(Boolean).map((h)=>ownerHubName(h as CustomerHubId))}));
  const activity=input.activity.slice(0,20).map((a)=>({id:text(a.id),label:activityLabel(text(a.action)),context:[text(a.display_name_snapshot),a.hub_id?ownerHubName(a.hub_id):''].filter(Boolean).join(' · '),occurredAt:text(a.created_at),href:text(a.native_profile_id)?`/manage/${a.native_profile_id}`:text(a.org_id)?`/manage/organization/${a.org_id}`:null}));
  const monitoringSummary={on:cards.filter(c=>c.monitoringStatus==='ON').length,off:cards.filter(c=>c.monitoringStatus==='OFF').length,unavailable:cards.filter(c=>c.monitoringStatus==='UNAVAILABLE').length};
  return {organizations,profiles:cards,summary:{managedProfiles:cards.length,organizations:organizations.length,needsAttention:attention.filter(a=>a.priority!=='INFORMATIONAL').length,claimsInProgress:claimsInProgress.length,monitoringOn:monitoringSummary.on},attentionItems:attention,claimsInProgress,recentActivity:activity,monitoringSummary};
}

export function countBucket(value:number):string{return value===0?'0':value===1?'1':value<=3?'2-3':value<=10?'4-10':'11+'}
export const MY_TRUST_HUB_ANALYTICS_ALLOWED_FIELDS=['hub','profile_class','attention_type','action_type','managed_profile_count_bucket','organization_count_bucket'] as const;
