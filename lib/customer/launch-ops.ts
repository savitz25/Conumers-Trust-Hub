import { CUSTOMER_HUBS, type CustomerHubId } from './types.ts';

export const LAUNCH_WINDOWS = ['24h', '7d', '30d', 'all'] as const;
export type LaunchWindow = (typeof LAUNCH_WINDOWS)[number];
export const ACQUISITION_SOURCES = ['organic', 'manual_outreach', 'email_campaign', 'internal_test', 'unknown'] as const;

export const LAUNCH_FUNNEL = [
  { stage: 'PUBLIC_PROFILE', source: 'client', authoritative: false, event: 'BUSINESS_PROFILE_VIEWED' },
  { stage: 'CLAIM_CTA', source: 'client', authoritative: false, event: 'CLAIM_CTA_CLICKED' },
  { stage: 'HANDOFF_RECEIVED', source: 'client', authoritative: false, event: 'CLAIM_HANDOFF_RECEIVED' },
  { stage: 'AUTH', source: 'client', authoritative: false, event: 'CLAIM_AUTH_RETURNED' },
  { stage: 'VALIDATION', source: 'client', authoritative: false, event: 'CLAIM_VALIDATION_STARTED' },
  { stage: 'CLAIM_STARTED', source: 'customer_database', authoritative: true, event: 'ath_claims.created_at' },
  { stage: 'REVIEW', source: 'customer_database', authoritative: true, event: 'ath_claims.status' },
  { stage: 'APPROVED', source: 'customer_database', authoritative: true, event: 'ath_claims.status=approved' },
  { stage: 'MY_TRUST_HUB_OPENED', source: 'client', authoritative: false, event: 'MY_TRUST_HUB_VIEWED' },
  { stage: 'OWNER_ACTIVATED', source: 'audit_log', authoritative: true, event: 'meaningful owner action after approval' },
] as const;

export const OWNER_ACTIVATION_ACTIONS = [
  'business_profile_updated', 'business_profile_reconfirmed', 'record_issue_created',
  'business_reply_submitted', 'monitoring_enabled', 'organization_member_invited',
] as const;

export type LaunchOpsClaim = {
  claimId: string; displayName: string; hub: CustomerHubId; entityClass: string;
  identifier: string; homeState: string | null; status: string; source: string;
  ageHours: number; ageBucket: string; lastActivityAt: string; nextAction: string;
};

export type LaunchOpsSnapshot = {
  generatedAt: string;
  summary: Record<string, number | null>;
  claims: LaunchOpsClaim[];
  byHub: Array<{ hub: CustomerHubId; started: number; approved: number; awaiting: number }>;
  bySource: Array<{ source: string; count: number }>;
  recoveries: Array<{ reason: string; count: number }>;
  mail: Array<{ status: string; count: number }>;
  health: Array<{ label: string; status: 'OK' | 'Needs attention' | 'Unavailable'; reason: string }>;
};

export function ageBucket(hours: number): string {
  if (hours < 24) return '<24h';
  if (hours < 96) return '1–3d';
  if (hours < 192) return '4–7d';
  if (hours < 360) return '8–14d';
  return '15d+';
}

export function safeRate(numerator: number, denominator: number): { numerator: number; denominator: number; percent: number | null } {
  return { numerator, denominator, percent: denominator ? Math.round((numerator / denominator) * 1000) / 10 : null };
}

export function completeHubRows(rows: Array<{ hub: string; started: number; approved: number; awaiting: number }>) {
  return CUSTOMER_HUBS.map((hub) => {
    const row = rows.find((item) => item.hub === hub);
    return { hub, started: row?.started ?? 0, approved: row?.approved ?? 0, awaiting: row?.awaiting ?? 0 };
  });
}

export function buildHealth(summary: Record<string, number | null>): LaunchOpsSnapshot['health'] {
  return [
    { label: 'Claim doorway', status: 'OK', reason: 'Signed claim intake remains enabled and covered by the 001A gate.' },
    { label: 'Review queue', status: Number(summary.awaitingReview) > 0 ? 'Needs attention' : 'OK', reason: `${summary.awaitingReview ?? 0} claims await staff action.` },
    { label: 'Transactional mail', status: Number(summary.mailFailures24h) > 0 ? 'Needs attention' : 'OK', reason: `${summary.mailFailures24h ?? 0} failed deliveries in 24 hours.` },
    { label: 'Monitoring', status: Number(summary.monitoringEligible) > 0 ? 'OK' : 'Unavailable', reason: 'Availability follows each Hub source contract.' },
  ];
}

export const ANALYTICS_SOURCE_MAP = [
  { event: 'CLAIM_CTA_CLICKED', meaning: 'Eligible profile claim action selected', source: 'Vercel client analytics', dimensions: 'hub, profile_class, state, acquisition_source', authoritative: false },
  { event: 'CLAIM_STARTED', meaning: 'Claim submission behavior', source: 'Vercel client analytics + ath_claims', dimensions: 'hub, profile_class, state, acquisition_source', authoritative: false },
  { event: 'CLAIM_COMPLETED', meaning: 'Claim completion behavior', source: 'Vercel client analytics; ath_claims is truth', dimensions: 'hub, profile_class, result', authoritative: false },
  { event: 'MY_TRUST_HUB_VIEWED', meaning: 'Authenticated owner home viewed', source: 'Vercel client analytics', dimensions: 'profile_count_bucket, organization_count_bucket', authoritative: false },
  { event: 'OWNER_ACTIVATED', meaning: 'First meaningful owner-controlled action after approval', source: 'ath_audit_events', dimensions: 'action_type, hub', authoritative: true },
] as const;
