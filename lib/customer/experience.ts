import type { ClaimStatus, CustomerHubId } from './types';

export const CLAIM_PROGRESS_STEPS = ['Your account', 'Business', 'Your role', 'Verification', 'Review', 'Access'] as const;

export type CustomerAction = { label: string; href: string; primary?: boolean };
export type ClaimExperience = {
  eyebrow: string;
  title: string;
  body: string;
  step: number;
  timing?: string;
  actions: CustomerAction[];
};

export const CLAIM_EXPERIENCE: Record<ClaimStatus, ClaimExperience> = {
  submitted: { eyebrow: 'Claim submitted', title: 'Your request is ready for review', body: 'We received your request to manage this profile.', step: 5, timing: 'Manual reviews are usually completed within 1–2 business days.', actions: [{ label: 'View account', href: '/manage', primary: true }, { label: 'Claim another profile', href: '/ask' }, { label: 'Contact support', href: '/claim/help?category=claim_status' }] },
  needs_info: { eyebrow: 'More information needed', title: 'We need one more item to continue', body: 'Review the request below and respond without starting over.', step: 4, actions: [{ label: 'Request review help', href: '/claim/help?category=needs_information', primary: true }, { label: 'View account', href: '/manage' }] },
  in_review: { eyebrow: 'Under review', title: 'We are reviewing your access request', body: 'Your public profile and official evidence remain unchanged while review is underway.', step: 5, timing: 'Manual reviews are usually completed within 1–2 business days.', actions: [{ label: 'View account', href: '/manage', primary: true }, { label: 'Contact support', href: '/claim/help?category=claim_status' }] },
  approved: { eyebrow: 'Access granted', title: 'You can manage this profile', body: 'Your authority to manage business-supplied information is confirmed. Control verified, not endorsement.', step: 6, actions: [{ label: 'Open your dashboard', href: '/manage', primary: true }, { label: 'View account', href: '/manage' }] },
  rejected: { eyebrow: 'Not approved', title: 'We could not confirm management authority', body: 'This decision does not change the public profile or official evidence.', step: 5, actions: [{ label: 'Request a review', href: '/claim/help?category=claim_rejected', primary: true }, { label: 'Find another profile', href: '/ask' }] },
  withdrawn: { eyebrow: 'Request withdrawn', title: 'This request is closed', body: 'No management access was created. You can begin again from the exact public profile.', step: 5, actions: [{ label: 'Find your business', href: '/ask', primary: true }, { label: 'Contact support', href: '/claim/help?category=withdrawn' }] },
  superseded: { eyebrow: 'Request replaced', title: 'A newer request is now active', body: 'Use your account to continue with the current request.', step: 5, actions: [{ label: 'View account', href: '/manage', primary: true }, { label: 'Contact support', href: '/claim/help?category=superseded' }] },
};

export function hubLabel(hub: CustomerHubId): string {
  return hub === 'contractor' ? 'ContractorTrustHub' : hub === 'move' ? 'MoveTrustHub' : hub === 'lender' ? 'LenderTrustHub' : hub === 'investor' ? 'InvestorTrustHub' : 'SeniorTrustHub';
}

export function identifierLabel(hub: CustomerHubId): string {
  return hub === 'move' ? 'USDOT' : hub === 'lender' ? 'Institution NMLS' : hub === 'senior' ? 'CMS CCN' : hub === 'investor' ? 'Firm CRD' : 'Credential';
}
