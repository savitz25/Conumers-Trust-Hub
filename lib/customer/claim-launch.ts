import type { CustomerHubId, CustomerProfileRecord } from './types.ts';

export type ClaimLaunchProfileClass = CustomerProfileRecord['entityClass'] | 'branch' | 'mlo' | 'producer' | 'representative' | 'research_only';
export type ClaimAcquisitionSource = 'organic' | 'manual_outreach' | 'email_campaign' | 'internal_test';

export type ClaimCapability = {
  hub: CustomerHubId;
  profileClass: ClaimLaunchProfileClass;
  canonicalIdentifier: string;
  claimable: boolean;
  specialistCta: boolean;
  signedHandoff: boolean;
  askValidation: boolean;
  organizationAttachment: boolean;
  launchBoundary: 'FLORIDA_FIRST' | 'NATIONAL_PUBLIC_PROFILE';
  exclusion?: string;
  successDestination: '/manage';
};

export const CLAIM_CAPABILITY_MATRIX: readonly ClaimCapability[] = [
  { hub:'move',profileClass:'mover',canonicalIdentifier:'USDOT',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'lender',profileClass:'institution',canonicalIdentifier:'NMLS',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'lender',profileClass:'branch',canonicalIdentifier:'NMLS',claimable:false,specialistCta:false,signedHandoff:false,askValidation:true,organizationAttachment:false,launchBoundary:'NATIONAL_PUBLIC_PROFILE',exclusion:'Branches are not separate managed business profiles.',successDestination:'/manage' },
  { hub:'lender',profileClass:'mlo',canonicalIdentifier:'NMLS',claimable:false,specialistCta:false,signedHandoff:false,askValidation:true,organizationAttachment:false,launchBoundary:'NATIONAL_PUBLIC_PROFILE',exclusion:'Individual MLO records are publication-restricted.',successDestination:'/manage' },
  { hub:'insurance',profileClass:'legal_insurer',canonicalIdentifier:'NAIC',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'insurance',profileClass:'producer',canonicalIdentifier:'NPN',claimable:false,specialistCta:false,signedHandoff:false,askValidation:true,organizationAttachment:false,launchBoundary:'NATIONAL_PUBLIC_PROFILE',exclusion:'Individual producer profiles are publication-restricted.',successDestination:'/manage' },
  { hub:'senior',profileClass:'nursing_home',canonicalIdentifier:'CMS CCN',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'senior',profileClass:'home_health',canonicalIdentifier:'CMS CCN',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'senior',profileClass:'hospice',canonicalIdentifier:'CMS CCN',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'contractor',profileClass:'contractor',canonicalIdentifier:'Credential',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'FLORIDA_FIRST',successDestination:'/manage' },
  { hub:'investor',profileClass:'firm',canonicalIdentifier:'CRD',claimable:true,specialistCta:true,signedHandoff:true,askValidation:true,organizationAttachment:true,launchBoundary:'NATIONAL_PUBLIC_PROFILE',successDestination:'/manage' },
  { hub:'investor',profileClass:'representative',canonicalIdentifier:'CRD',claimable:false,specialistCta:false,signedHandoff:false,askValidation:true,organizationAttachment:false,launchBoundary:'NATIONAL_PUBLIC_PROFILE',exclusion:'Individual representative and research-only identities are not claimable.',successDestination:'/manage' },
] as const;

export const CLAIM_ACQUISITION_SOURCES = ['organic','manual_outreach','email_campaign','internal_test'] as const;
export function claimAcquisitionSource(value: unknown): ClaimAcquisitionSource {
  return typeof value === 'string' && (CLAIM_ACQUISITION_SOURCES as readonly string[]).includes(value)
    ? value as ClaimAcquisitionSource : 'organic';
}

export type ClaimFunnelEvent =
  | 'business_profile_viewed' | 'claim_cta_clicked' | 'claim_handoff_received'
  | 'claim_auth_required' | 'claim_auth_returned' | 'claim_validation_started'
  | 'claim_validation_failed' | 'claim_started' | 'claim_completed'
  | 'claim_recovery_viewed' | 'claim_review_requested' | 'manage_business_opened';

export type ClaimFunnelProperties = {
  hub?: CustomerHubId;
  profileClass?: ClaimLaunchProfileClass;
  state?: string;
  resultState?: string;
  source?: ClaimAcquisitionSource;
  authenticated?: boolean;
};

const PROHIBITED_ANALYTICS_KEYS = /(?:name|email|identifier|credential|profile_?id|token|handoff|payload)/i;
export function safeClaimFunnelProperties(input: ClaimFunnelProperties): Record<string,string|boolean> {
  const output: Record<string,string|boolean> = {};
  for (const [key,value] of Object.entries(input)) {
    if (value === undefined || PROHIBITED_ANALYTICS_KEYS.test(key)) continue;
    output[key] = typeof value === 'string' ? value.slice(0,64) : value;
  }
  return output;
}

export type ClaimLaunchScenario = {
  id: string;
  category: 'SUCCESS'|'INELIGIBLE'|'HANDOFF_SECURITY'|'AUTH'|'CONFLICT'|'BACKEND'|'MANAGEMENT'|'RECOVERY'|'ANALYTICS';
  expected: string;
};

const scenarios = (category: ClaimLaunchScenario['category'], entries: readonly [string,string][]) =>
  entries.map(([id,expected]) => ({ id,category,expected }));

export const CLAIM_LAUNCH_GOLDEN_CORPUS: readonly ClaimLaunchScenario[] = [
  ...scenarios('SUCCESS', [
    ['move-published','Published mover revalidates by USDOT and can enter review'],['lender-institution','Published institution revalidates by NMLS'],
    ['insurance-insurer','Published legal insurer revalidates by NAIC'],['senior-nursing','Published nursing home revalidates by CCN'],
    ['senior-home-health','Published home-health agency revalidates by CCN'],['senior-hospice','Published hospice revalidates by CCN'],
    ['contractor-fl','Published Florida contractor revalidates by credential'],['investor-firm','Published firm revalidates by CRD'],
    ['new-user','Email confirmation returns to the same claim intent'],['existing-user','Existing account returns to the same claim intent'],
    ['authenticated-user','Authenticated claimant avoids an auth loop'],['repeat-claim','Same user and profile returns the existing claim'],
    ['cross-hub-org','Owner may attach a second exact Hub profile to the same organization'],
  ]),
  ...scenarios('INELIGIBLE', [
    ['unpublished','Unpublished profile fails closed'],['research-only','Research-only identity cannot create a public identity'],
    ['private-person','Private-person profile cannot be claimed'],['unsupported-class','Unsupported profile class is rejected'],
    ['lender-branch','Lender branch is not claimable'],['lender-mlo','Individual MLO is not claimable'],
    ['insurance-producer','Individual producer is not claimable'],['investor-representative','Individual representative is not claimable'],
  ]),
  ...scenarios('HANDOFF_SECURITY', [
    ['expired','Expired handoff is rejected'],['replayed','Consumed nonce is rejected'],['invalid-signature','Invalid signature is rejected'],
    ['hub-substitution','Changed Hub invalidates signature'],['profile-substitution','Changed profile ID invalidates signature'],
    ['identifier-substitution','Changed identifier invalidates signature'],['class-substitution','Changed profile class invalidates signature'],
    ['expiry-substitution','Changed expiry invalidates signature'],['open-redirect','Handoff has no client-controlled redirect destination'],
  ]),
  ...scenarios('AUTH', [
    ['login-required','Claim submit requires a confirmed session'],['auth-return','Magic-link next path preserves claim context'],
    ['expired-auth','Expired session returns to sign-in safely'],['wrong-account','Another account cannot read the claim'],
    ['refresh','Intent cookie reconstructs the claim page'],['back-forward','Consumed intent cannot submit twice'],
  ]),
  ...scenarios('CONFLICT', [
    ['already-self','Same claimant gets existing claim state'],['already-org','Existing organization can receive another exact profile'],
    ['other-org','Existing active grant becomes private competing review'],['two-tabs','One intent is serialized and consumed once'],
    ['forged-org','Non-owner organization ID is rejected'],['review','Conflict offers privacy-safe review'],
  ]),
  ...scenarios('BACKEND', [
    ['specialist-unavailable','Specialist outage creates no claim'],['specialist-timeout','Timeout creates no claim'],
    ['malformed-validation','Malformed validation creates no claim'],
  ]),
  ...scenarios('MANAGEMENT', [
    ['edit-description','Authorized owner can edit business-supplied description'],['public-record-readonly','Public-source evidence is read-only'],
    ['server-write-block','Unknown regulatory fields fail server validation'],['correction-workflow','Record issue uses review without overwriting evidence'],
    ['revocation','Revoked grant loses management access'],['team-scope','Membership is organization-scoped'],
  ]),
  ...scenarios('RECOVERY', [
    ['recovery-all','Every known recovery code has primary, alternative, and review actions'],['help','Claim help requests review without promising access'],
  ]),
  ...scenarios('ANALYTICS', [
    ['low-cardinality','Funnel events contain only bounded categorical properties'],['no-identifiers','Analytics exclude identifiers, tokens, email, and business names'],
  ]),
] as const;
