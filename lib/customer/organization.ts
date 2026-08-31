import { isEmailShape, normalizeEmail } from './crypto.ts';
import type { MembershipRole } from './types.ts';

export const INVITABLE_ROLES = ['manager', 'staff', 'billing'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class OrganizationError extends Error {
  readonly code:
    | 'forbidden'
    | 'not_found'
    | 'validation_failed'
    | 'duplicate_invitation'
    | 'already_member'
    | 'expired_invitation'
    | 'revoked_invitation'
    | 'consumed_invitation'
    | 'email_mismatch'
    | 'stale_version'
    | 'last_owner';

  constructor(code: OrganizationError['code']) {
    super(code);
    this.name = 'OrganizationError';
    this.code = code;
  }
}

export function validateInvitationInput(value: unknown): { email: string; role: InvitableRole } {
  if (!value || typeof value !== 'object') throw new OrganizationError('validation_failed');
  const body = value as Record<string, unknown>;
  const email = normalizeEmail(String(body.email || ''));
  const role = String(body.role || '') as InvitableRole;
  if (!isEmailShape(email) || !INVITABLE_ROLES.includes(role)) throw new OrganizationError('validation_failed');
  return { email, role };
}

export function validateMemberRole(value: unknown): Exclude<MembershipRole, 'owner'> {
  const role = String(value || '') as Exclude<MembershipRole, 'owner'>;
  if (!INVITABLE_ROLES.includes(role)) throw new OrganizationError('validation_failed');
  return role;
}
