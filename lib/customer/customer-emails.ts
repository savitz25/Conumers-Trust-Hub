import { buildTransactionalEmail, EMAIL_BRAND } from '../emails/brand.ts';
import { customerHub } from './hub-registry.ts';
import type { CustomerHubId } from './types.ts';

export const CUSTOMER_EMAIL_TYPES = [
  'CLAIM_STARTED','CLAIM_NEEDS_INFORMATION','CLAIM_APPROVED','CLAIM_NOT_APPROVED',
  'FIRST_CLAIM_ONBOARDING','RECORD_ISSUE_RECEIVED','RECORD_ISSUE_NEEDS_INFORMATION',
  'RECORD_ISSUE_RESOLVED','BUSINESS_RESPONSE_SUBMITTED','BUSINESS_RESPONSE_PUBLISHED',
  'BUSINESS_RESPONSE_NEEDS_CHANGES','TEAM_INVITATION','TEAM_INVITATION_ACCEPTED',
  'ACCESS_ROLE_CHANGED','ACCESS_REMOVED','MONITORING_NOTIFICATION',
] as const;
export type CustomerEmailType = typeof CUSTOMER_EMAIL_TYPES[number];
export type CustomerEmailCategory = 'CLAIM'|'ONBOARDING'|'CORRECTION'|'BUSINESS_RESPONSE'|'TEAM'|'MONITORING';

export type CustomerLifecycleEmail = {
  type: CustomerEmailType;
  category: CustomerEmailCategory;
  subject: string;
  html: string;
  text: string;
  primaryAction?: { label:string; href:string };
  audience: 'claimant'|'profile_manager'|'invitee'|'organization_admin';
  transactional: true;
  privacy: 'ACCOUNT_CONTEXT'|'ORGANIZATION_CONTEXT';
  duplicateSuppression: 'STATE_TRANSITION'|'EXPLICIT_RESEND';
};

export function escapeCustomerEmailHtml(value:string):string {
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function safeCustomerActionUrl(path:string, siteUrl:string=EMAIL_BRAND.siteUrl):string {
  const base=new URL(siteUrl);
  if(base.protocol!=='https:' || base.hostname!=='www.asktrusthub.com') throw new Error('unsafe_email_origin');
  if(!path.startsWith('/') || path.startsWith('//')) throw new Error('unsafe_email_path');
  const url=new URL(path,base);
  if(url.origin!==base.origin) throw new Error('unsafe_email_url');
  return url.toString();
}

type EmailInput = {
  type:CustomerEmailType; profileName?:string; organizationName?:string; hub?:CustomerHubId;
  detail?:string; role?:string; actionPath?:string; actionLabel?:string; expiresAt?:string;
};

const META:Record<CustomerEmailType,{category:CustomerEmailCategory;audience:CustomerLifecycleEmail['audience'];subject:string;title:string;reason:string}>={
  CLAIM_STARTED:{category:'CLAIM',audience:'claimant',subject:'Your Trust Hub claim was received',title:'We received your claim',reason:'You received this because you submitted a profile claim on Ask Trust Hub.'},
  CLAIM_NEEDS_INFORMATION:{category:'CLAIM',audience:'claimant',subject:'Information needed for your Trust Hub claim',title:'More information is needed',reason:'You received this because your profile claim needs additional information.'},
  CLAIM_APPROVED:{category:'CLAIM',audience:'claimant',subject:'Your profile is now connected to My Trust Hub',title:'Your profile is connected',reason:'You received this because your profile claim was approved.'},
  CLAIM_NOT_APPROVED:{category:'CLAIM',audience:'claimant',subject:'Update on your Trust Hub claim',title:'We could not approve this claim',reason:'You received this because review of your profile claim is complete.'},
  FIRST_CLAIM_ONBOARDING:{category:'ONBOARDING',audience:'profile_manager',subject:'Welcome to My Trust Hub',title:'Welcome to My Trust Hub',reason:'You received this because your first managed profile was connected.'},
  RECORD_ISSUE_RECEIVED:{category:'CORRECTION',audience:'profile_manager',subject:'We received your record issue',title:'We received your record issue',reason:'You received this because you submitted a record issue.'},
  RECORD_ISSUE_NEEDS_INFORMATION:{category:'CORRECTION',audience:'profile_manager',subject:'Information needed for your record issue',title:'More information is needed',reason:'You received this because your record issue needs additional information.'},
  RECORD_ISSUE_RESOLVED:{category:'CORRECTION',audience:'profile_manager',subject:'Your record issue was reviewed',title:'Your record issue was reviewed',reason:'You received this because review of your record issue is complete.'},
  BUSINESS_RESPONSE_SUBMITTED:{category:'BUSINESS_RESPONSE',audience:'profile_manager',subject:'We received your business response',title:'We received your business response',reason:'You received this because you submitted a business response.'},
  BUSINESS_RESPONSE_PUBLISHED:{category:'BUSINESS_RESPONSE',audience:'profile_manager',subject:'Your business response was published',title:'Your business response was published',reason:'You received this because a submitted business response was published.'},
  BUSINESS_RESPONSE_NEEDS_CHANGES:{category:'BUSINESS_RESPONSE',audience:'profile_manager',subject:'Changes needed for your business response',title:'Changes are needed',reason:'You received this because your submitted business response needs changes.'},
  TEAM_INVITATION:{category:'TEAM',audience:'invitee',subject:"You've been invited to manage a Trust Hub organization",title:'Organization invitation',reason:'You received this because someone invited you to a Trust Hub organization.'},
  TEAM_INVITATION_ACCEPTED:{category:'TEAM',audience:'organization_admin',subject:'Your organization invitation was accepted',title:'Invitation accepted',reason:'You received this because you manage the organization that sent this invitation.'},
  ACCESS_ROLE_CHANGED:{category:'TEAM',audience:'profile_manager',subject:'Your My Trust Hub access changed',title:'Your access changed',reason:'You received this because your organization access role changed.'},
  ACCESS_REMOVED:{category:'TEAM',audience:'profile_manager',subject:'Your My Trust Hub access was removed',title:'Your access was removed',reason:'You received this because your organization access changed.'},
  MONITORING_NOTIFICATION:{category:'MONITORING',audience:'profile_manager',subject:'A supported public-source record changed',title:'A supported source record changed',reason:'You received this because email monitoring is enabled for this managed profile.'},
};

export function customerLifecycleEmail(input:EmailInput,siteUrl:string=EMAIL_BRAND.siteUrl):CustomerLifecycleEmail {
  const meta=META[input.type], profile=input.profileName?.trim(), org=input.organizationName?.trim();
  const hub=input.hub?customerHub(input.hub)?.displayName:undefined;
  const action=input.actionPath?{label:input.actionLabel||'Open My Trust Hub',href:safeCustomerActionUrl(input.actionPath,siteUrl)}:undefined;
  const context=[profile&&`Profile: ${profile}.`,hub&&`Owning Trust Hub: ${hub}.`,org&&`Organization: ${org}.`].filter(Boolean).join(' ');
  const detail=String(input.detail||'').trim();
  const trust=input.type.startsWith('RECORD_ISSUE')?'Submitting a correction request does not change the underlying source record until it is reviewed and resolved.':input.type.startsWith('BUSINESS_RESPONSE')?'A business response is labeled as business-supplied and does not replace the underlying public evidence.':input.type==='MONITORING_NOTIFICATION'?'This alert reflects a supported source change; it is not a TrustHub rating or recommendation.':'Claiming lets an authorized representative manage business-supplied information. Public-source evidence, source status, rankings, and TrustHub research ordering stay independent.';
  const body=[context,detail,trust].filter(Boolean);
  const html=buildTransactionalEmail({title:meta.title,bodyHtml:body.map(p=>`<p style="margin:0 0 14px;">${escapeCustomerEmailHtml(p)}</p>`).join(''),ctaLabel:action?.label,ctaHref:action?.href,unsubscribeHtml:escapeCustomerEmailHtml(meta.reason)});
  const text=[meta.title,'',...body,'',action?.label,action?.href,'',meta.reason].filter(Boolean).join('\n');
  return {...meta,type:input.type,subject:meta.subject,html,text,primaryAction:action,transactional:true,privacy:meta.category==='TEAM'?'ORGANIZATION_CONTEXT':'ACCOUNT_CONTEXT',duplicateSuppression:input.type==='TEAM_INVITATION'?'EXPLICIT_RESEND':'STATE_TRANSITION'};
}

export const CUSTOMER_EMAIL_TRIGGER_MATRIX = [
  ['Claim submitted','CLAIM_STARTED','IMPLEMENTED'],['Claim needs information','CLAIM_NEEDS_INFORMATION','IMPLEMENTED'],
  ['Claim enters review','CLAIM_IN_REVIEW','NOT_CURRENTLY_APPLICABLE'],['Claim approved','CLAIM_APPROVED','IMPLEMENTED'],
  ['First managed profile','FIRST_CLAIM_ONBOARDING','IMPLEMENTED'],['Record issue submitted','RECORD_ISSUE_RECEIVED','IMPLEMENTED'],
  ['Record issue needs information','RECORD_ISSUE_NEEDS_INFORMATION','IMPLEMENTED'],['Record issue resolved','RECORD_ISSUE_RESOLVED','IMPLEMENTED'],
  ['Business response submitted','BUSINESS_RESPONSE_SUBMITTED','IMPLEMENTED'],['Business response published','BUSINESS_RESPONSE_PUBLISHED','IMPLEMENTED'],
  ['Team invitation created','TEAM_INVITATION','IMPLEMENTED'],['Access revoked','ACCESS_REMOVED','IMPLEMENTED'],
  ['Supported source change','MONITORING_NOTIFICATION','IMPLEMENTED'],['Business information reconfirmation due','BUSINESS_INFORMATION_RECONFIRMATION_DUE','FUTURE'],
] as const;
