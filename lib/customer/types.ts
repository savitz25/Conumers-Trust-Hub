export const HUB_CONTRACTOR = 'contractor' as const;
export const HUB_MOVE = 'move' as const;
export const HUB_LENDER = 'lender' as const;
export const CUSTOMER_HUBS = [HUB_CONTRACTOR, HUB_MOVE, HUB_LENDER] as const;
export type CustomerHubId = (typeof CUSTOMER_HUBS)[number];
export const SOURCE_FL_DBPR = 'fl_dbpr' as const;
export const HOME_STATE_FL = 'FL' as const;
export const HANDOFF_AUDIENCE = 'asktrusthub' as const;
export const HANDOFF_TTL_SECONDS = 15 * 60;

export type UserStatus = 'pending' | 'active' | 'suspended';
export type OrgStatus = 'active' | 'suspended';
export type MembershipRole = 'owner' | 'manager' | 'staff' | 'billing';
export type MembershipStatus = 'invited' | 'active' | 'revoked';

export type ClaimStatus =
  | 'submitted'
  | 'needs_info'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'superseded';

export type VerificationMethod =
  | 'official_license_match'
  | 'domain_email'
  | 'document_upload'
  | 'manual_review'
  | 'other';

export type RelationshipType =
  | 'owner'
  | 'officer'
  | 'qualifying_agent'
  | 'authorized_manager'
  | 'employee'
  | 'third_party_representative';

export type GrantStatus = 'active' | 'revoked' | 'contested';
export type ReviewWorkType = 'claim_review' | 'competing_claim' | 'record_issue';
export type ReviewQueueStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export type HandoffPayload = {
  v: 1 | 2;
  aud: typeof HANDOFF_AUDIENCE;
  hub_id: CustomerHubId;
  native_profile_id: string;
  slug: string;
  external_key: string;
  source_system: string;
  home_state: string | null;
  identifier_namespace?: 'credential' | 'USDOT' | 'NMLS';
  entity_class?: 'contractor' | 'mover' | 'institution';
  display_name?: string;
  iat: number;
  exp: number;
  nonce: string;
};

export type CthProfileRecord = {
  id: string;
  slug: string;
  displayName: string;
  isThin: boolean;
  homeState: string | null;
  licenseState: string | null;
  externalKey: string;
  sourceSystem: string;
};

export type CustomerProfileRecord = CthProfileRecord & {
  hubId: CustomerHubId;
  publicationEligible: boolean;
  entityClass: 'contractor' | 'mover' | 'institution';
  canonicalUrl: string;
};

export type AdapterFailure =
  | 'missing_profile'
  | 'thin_profile'
  | 'unsupported_hub'
  | 'unsupported_state'
  | 'unsupported_source'
  | 'slug_mismatch'
  | 'credential_mismatch';

export type RequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  owner: 'Owner',
  officer: 'Officer or principal',
  qualifying_agent: 'Qualifying agent',
  authorized_manager: 'Authorized manager',
  employee: 'Employee',
  third_party_representative: 'Authorized representative (third party)',
};

export const CLAIM_STATUS_COPY: Record<ClaimStatus, { title: string; body: string }> = {
  submitted: {
    title: 'Submitted',
    body: 'We received your request.',
  },
  needs_info: {
    title: 'Needs information',
    body: 'We need another item before we can confirm your authority.',
  },
  in_review: {
    title: 'In review',
    body: 'Your request is being reviewed.',
  },
  approved: {
    title: 'Approved',
    body: 'You can now manage this TrustHub profile.',
  },
  rejected: {
    title: 'Rejected',
    body: 'We could not confirm authority for this profile.',
  },
  withdrawn: {
    title: 'Withdrawn',
    body: 'This request was withdrawn.',
  },
  superseded: {
    title: 'Superseded',
    body: 'A later request replaced this one.',
  },
};
