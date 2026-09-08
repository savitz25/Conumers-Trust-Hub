import type { CustomerHubId, RelationshipType } from './types.ts';

export const AUTHORITY_EVIDENCE = {
  CORPORATE_OFFICER_MATCH: { label: 'Current corporate officer or authorized-person match', strength: 'STRONG', authority: true, control: false, independent: true },
  REGULATOR_QUALIFIER_MATCH: { label: 'Current regulator qualifier or officer match', strength: 'STRONG', authority: true, control: false, independent: true },
  VERIFIED_PUBLIC_CALLBACK: { label: 'Callback through a pre-existing public business number', strength: 'STRONG', authority: true, control: true, independent: true },
  VERIFIED_OFFICER_AUTHORIZATION: { label: 'Authorization from an independently verified officer', strength: 'STRONG', authority: true, control: true, independent: true },
  EXISTING_VERIFIED_ORG_AUTHORITY: { label: 'Existing independently verified organization authority', strength: 'STRONG', authority: true, control: false, independent: true },
  COMPANY_DOMAIN_CONTROL: { label: 'Authenticated company-domain email control', strength: 'SUPPORTING', authority: false, control: true, independent: false },
  PREEXISTING_COMPANY_CONTACT: { label: 'Control of a pre-existing independently sourced company contact', strength: 'SUPPORTING', authority: false, control: true, independent: true },
  CORROBORATING_BUSINESS_RECORD: { label: 'Corroborating business record', strength: 'SUPPORTING', authority: false, control: false, independent: true },
  CREDENTIAL_KNOWLEDGE: { label: 'Knowledge of public credential or license', strength: 'WEAK', authority: false, control: false, independent: false },
  FREE_EMAIL_ACCOUNT: { label: 'Free or personal email account', strength: 'WEAK', authority: false, control: false, independent: false },
  CLAIMANT_SUPPLIED_CONTACT: { label: 'Claimant-supplied phone or email only', strength: 'WEAK', authority: false, control: false, independent: false },
  LINKEDIN_OR_BUSINESS_CARD: { label: 'LinkedIn, business card, or website screenshot', strength: 'WEAK', authority: false, control: false, independent: false },
  THIRD_PARTY_AGENCY: { label: 'Third-party agency or consultant relationship', strength: 'CONFLICT', authority: false, control: false, independent: false },
  FORMER_EMPLOYEE_OR_OFFICER: { label: 'Former employee or stale officer relationship', strength: 'CONFLICT', authority: false, control: false, independent: true },
  IDENTITY_MISMATCH: { label: 'Claimant identity conflicts with current authority sources', strength: 'CONFLICT', authority: false, control: false, independent: true },
  CONTRADICTORY_CALLBACK: { label: 'Independent callback contradicts claimed authority', strength: 'CONFLICT', authority: false, control: false, independent: true },
  BYPASS_REQUEST: { label: 'Request to bypass normal verification', strength: 'CONFLICT', authority: false, control: false, independent: false },
} as const;

export type AuthorityEvidenceCode = keyof typeof AUTHORITY_EVIDENCE;
export type GovernanceResult = 'APPROVE' | 'NEEDS_INFO' | 'HOLD' | 'REJECT' | 'CONFLICT';
export const CLAIM_DECISION_CATEGORIES=['AUTHORITY_VERIFIED','AUTHORITY_EVIDENCE_MISSING','AUTHORITY_NOT_ESTABLISHED','IDENTITY_CONFLICT','UNRESOLVED_COMPETING_CLAIM','INELIGIBLE_RELATIONSHIP','PROFILE_NO_LONGER_ELIGIBLE','DUPLICATE_EXISTING_AUTHORITY','OTHER_POLICY_REASON'] as const;
export type ClaimDecisionCategory = typeof CLAIM_DECISION_CATEGORIES[number];

const FREE_EMAIL_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com']);
export function isFreeEmail(email: string): boolean {
  return FREE_EMAIL_DOMAINS.has(email.trim().toLowerCase().split('@')[1] || '');
}

export function evaluateAuthority(input: {
  hub: CustomerHubId;
  relationship: RelationshipType;
  evidence: AuthorityEvidenceCode[];
  competingClaims?: number;
  activeGrant?: boolean;
}): { result: GovernanceResult; eligibleForHumanApproval: boolean; reasons: string[] } {
  const selected = [...new Set(input.evidence)].map((code) => AUTHORITY_EVIDENCE[code]);
  const reasons: string[] = [];
  if (input.activeGrant) reasons.push('An active management grant already exists.');
  if ((input.competingClaims || 0) > 0) reasons.push('An unresolved competing claim exists.');
  if (selected.some((item) => item.strength === 'CONFLICT')) reasons.push('Authority evidence contains an unresolved conflict signal.');
  if (reasons.length) return { result: 'CONFLICT', eligibleForHumanApproval: false, reasons };

  const authority = selected.some((item) => item.authority && item.independent);
  const control = selected.some((item) => item.control && item.independent);
  const supportingControl = selected.some((item) => item.control);
  const agency = input.relationship === 'third_party_representative';
  if (selected.length < 2) reasons.push('At least two corroborating evidence signals are required.');
  if (!authority) reasons.push('No independently sourced authority signal was selected.');
  if (!control && !supportingControl) reasons.push('No independently validated control or contact signal was selected.');
  if (agency && !selected.some((item) => item.authority && item.control && item.independent)) {
    reasons.push('Third-party access requires authorization through an independently verified company authority.');
  }
  const eligible = selected.length >= 2 && authority && (control || supportingControl) && (!agency || selected.some((item) => item.authority && item.control && item.independent));
  return { result: eligible ? 'APPROVE' : 'NEEDS_INFO', eligibleForHumanApproval: eligible, reasons };
}

export function validateGovernanceText(value: string, min: number, max: number): string {
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /<\/?[a-z][\s\S]*>/i.test(normalized)) throw new Error('invalid_governance_text');
  return normalized;
}

export const PUBLIC_AUTHORITY_SUMMARY =
  'Claiming requires authority verification. Knowing an identifier or controlling a company email alone is insufficient. Ask Trust Hub may request additional verification or decline a claim when authority cannot be established. Claiming never changes public evidence, ranking, or research ordering.';

export const RESPONSE_MODERATION_FLAGS = {
  HTML_OR_SCRIPT: /<\/?[a-z][\s\S]*>/i,
  EMAIL_ADDRESS: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  PHONE_NUMBER: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/,
  GOVERNMENT_IDENTIFIER: /\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/,
  AUTH_SECRET: /\b(?:password|session token|magic link|api key|secret key)\b/i,
  THREAT_OR_HARASSMENT: /\b(?:kill|hurt you|doxx|home address)\b/i,
  UNSUPPORTED_EXTERNAL_LINK: /https?:\/\/(?!www\.asktrusthub\.com\b)\S+/i,
} as const;
export type ResponseModerationFlag = keyof typeof RESPONSE_MODERATION_FLAGS;
export function responseModerationWarnings(body:string):ResponseModerationFlag[]{return Object.entries(RESPONSE_MODERATION_FLAGS).filter(([,pattern])=>pattern.test(body)).map(([code])=>code as ResponseModerationFlag)}
