export const CUSTOMER_CLAIM_ERROR_CODES = [
  'UNSUPPORTED_CUSTOMER_HUB',
  'PROFILE_NOT_PUBLIC',
  'PROFILE_NOT_FOUND',
  'PROFILE_IDENTITY_MISMATCH',
  'PROFILE_CLASS_NOT_CLAIMABLE',
  'PROFILE_PUBLICATION_RESTRICTED',
  'HANDOFF_EXPIRED',
  'HANDOFF_REPLAYED',
  'HANDOFF_INVALID',
  'SPECIALIST_VALIDATION_UNAVAILABLE',
  'LENDER_BRANCH_NOT_CLAIMABLE',
  'LENDER_MLO_NOT_CLAIMABLE',
] as const;

export type CustomerClaimErrorCode = (typeof CUSTOMER_CLAIM_ERROR_CODES)[number];

export type ClaimRecoveryAction = {
  label: string;
  href: string;
  kind: 'primary' | 'alternative' | 'support';
};

export type ClaimRecovery = {
  headline: string;
  whatHappened: string;
  why: string;
  actions: readonly [ClaimRecoveryAction, ClaimRecoveryAction, ClaimRecoveryAction];
};

const support = (category: CustomerClaimErrorCode): ClaimRecoveryAction => ({
  label: 'Request a review',
  href: `/claim/help?category=${encodeURIComponent(category)}`,
  kind: 'support',
});

const actions = (
  category: CustomerClaimErrorCode,
  primary: Omit<ClaimRecoveryAction, 'kind'>,
  alternative: Omit<ClaimRecoveryAction, 'kind'>,
): ClaimRecovery['actions'] => [
  { ...primary, kind: 'primary' },
  { ...alternative, kind: 'alternative' },
  support(category),
];

export const CUSTOMER_CLAIM_RECOVERY: Record<CustomerClaimErrorCode, ClaimRecovery> = {
  UNSUPPORTED_CUSTOMER_HUB: {
    headline: 'Claims are not available for this Trust Hub yet.',
    whatHappened: 'AskTrustHub could not start a business claim for this profile.',
    why: 'The owning Trust Hub is not currently connected to the customer claim program.',
    actions: actions('UNSUPPORTED_CUSTOMER_HUB', { label: 'Return to the Trust Hub', href: '/network' }, { label: 'Find another supported profile', href: '/ask' }),
  },
  PROFILE_NOT_PUBLIC: {
    headline: "This profile can't be claimed right now.",
    whatHappened: 'The profile is not currently eligible for a managed public profile.',
    why: 'Claims require an existing publication-safe specialist profile. Research-only or no-longer-public identities remain ineligible.',
    actions: actions('PROFILE_NOT_PUBLIC', { label: 'Find the current public profile', href: '/ask' }, { label: 'Verify the public identifier', href: '/ask' }),
  },
  PROFILE_NOT_FOUND: {
    headline: 'We could not confirm this exact profile.',
    whatHappened: 'The claim link did not resolve to a current exact public specialist profile.',
    why: 'AskTrustHub will not create a customer profile from a fuzzy, missing, or unconfirmed identity.',
    actions: actions('PROFILE_NOT_FOUND', { label: 'Return to profile search', href: '/ask' }, { label: 'Start a different claim', href: '/manage' }),
  },
  PROFILE_IDENTITY_MISMATCH: {
    headline: 'The profile details no longer match.',
    whatHappened: 'The identifier in this claim link does not match the current specialist profile.',
    why: 'Exact hub, profile, and source identifiers must agree before a claim can continue.',
    actions: actions('PROFILE_IDENTITY_MISMATCH', { label: 'Return to profile search', href: '/ask' }, { label: 'Start a different claim', href: '/manage' }),
  },
  PROFILE_CLASS_NOT_CLAIMABLE: {
    headline: "This type of profile isn't claimable.",
    whatHappened: 'The profile represents an identity class outside the business claim program.',
    why: 'Only accepted public business or institution profiles can receive management access; branches and individual-person records remain excluded.',
    actions: actions('PROFILE_CLASS_NOT_CLAIMABLE', { label: 'Find the parent business profile', href: '/ask' }, { label: 'Claim another business profile', href: '/manage' }),
  },
  PROFILE_PUBLICATION_RESTRICTED: {
    headline: "This research identity can't be claimed.",
    whatHappened: 'The identity is available for bounded research but is not eligible for a public managed profile.',
    why: 'Publication restrictions and private-person safeguards remain in force for customer claims.',
    actions: actions('PROFILE_PUBLICATION_RESTRICTED', { label: 'Find a public business profile', href: '/ask' }, { label: 'Claim another profile', href: '/manage' }),
  },
  HANDOFF_EXPIRED: {
    headline: 'This claim link has expired.',
    whatHappened: 'The time-limited link can no longer start or resume this claim.',
    why: 'Claim links expire to protect profile identity and customer access.',
    actions: actions('HANDOFF_EXPIRED', { label: 'Find the profile and start again', href: '/ask' }, { label: 'View your existing claims', href: '/manage' }),
  },
  HANDOFF_REPLAYED: {
    headline: 'This claim link has already been used.',
    whatHappened: 'AskTrustHub did not accept the same single-use claim link twice.',
    why: 'Single-use protection prevents replay of profile-management invitations.',
    actions: actions('HANDOFF_REPLAYED', { label: 'View your claim status', href: '/manage' }, { label: 'Find the profile and start again', href: '/ask' }),
  },
  HANDOFF_INVALID: {
    headline: 'This claim link is not valid.',
    whatHappened: 'AskTrustHub could not safely establish the profile claim context.',
    why: 'A claim must begin from a current, signed specialist-profile handoff.',
    actions: actions('HANDOFF_INVALID', { label: 'Find the profile', href: '/ask' }, { label: 'View your existing claims', href: '/manage' }),
  },
  SPECIALIST_VALIDATION_UNAVAILABLE: {
    headline: 'We could not verify this profile right now.',
    whatHappened: 'The owning Trust Hub validation service is temporarily unavailable.',
    why: 'AskTrustHub did not create or change a claim without current exact-profile validation.',
    actions: actions('SPECIALIST_VALIDATION_UNAVAILABLE', { label: 'Try profile search again', href: '/ask' }, { label: 'Return to your account', href: '/manage' }),
  },
  LENDER_BRANCH_NOT_CLAIMABLE: {
    headline: "Branches aren't claimable as separate business profiles.",
    whatHappened: 'The supplied NMLS identity represents a branch rather than the published parent institution.',
    why: 'The lender claim program is limited to accepted public institution profiles.',
    actions: actions('LENDER_BRANCH_NOT_CLAIMABLE', { label: 'Find the parent lender institution', href: '/ask' }, { label: 'Search by institution NMLS', href: '/ask' }),
  },
  LENDER_MLO_NOT_CLAIMABLE: {
    headline: "Individual mortgage loan originator profiles aren't part of the business claim program.",
    whatHappened: 'The supplied NMLS identity represents an individual rather than a claimable institution.',
    why: 'Private-person and MLO identities are excluded from business profile management.',
    actions: actions('LENDER_MLO_NOT_CLAIMABLE', { label: 'Find the lender institution', href: '/ask' }, { label: 'Claim another business profile', href: '/manage' }),
  },
};

export function customerClaimRecovery(code: string | null | undefined): ClaimRecovery {
  return CUSTOMER_CLAIM_RECOVERY[
    CUSTOMER_CLAIM_ERROR_CODES.includes(code as CustomerClaimErrorCode)
      ? (code as CustomerClaimErrorCode)
      : 'HANDOFF_INVALID'
  ];
}
