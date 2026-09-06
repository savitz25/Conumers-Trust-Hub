import { customerLifecycleEmail, type CustomerEmailType } from '../../customer/customer-emails.ts';

const types:CustomerEmailType[]=['CLAIM_STARTED','CLAIM_NEEDS_INFORMATION','CLAIM_APPROVED','FIRST_CLAIM_ONBOARDING','RECORD_ISSUE_RECEIVED','TEAM_INVITATION','ACCESS_REMOVED','MONITORING_NOTIFICATION'];

export const CUSTOMER_LIFECYCLE_PREVIEWS=types.map(type=>customerLifecycleEmail({
  type,profileName:'Harbor Test Builders & Advisory',organizationName:'Harbor Test Holdings',hub:'contractor',
  detail:type==='CLAIM_NEEDS_INFORMATION'?'Please return to the secure claim workflow and review the requested information.':'This is representative synthetic preview content.',
  actionPath:type==='TEAM_INVITATION'?'/manage/invitations/accept?token=preview-redacted':'/manage',
  actionLabel:type==='TEAM_INVITATION'?'Review invitation':'Open My Trust Hub',
}));
