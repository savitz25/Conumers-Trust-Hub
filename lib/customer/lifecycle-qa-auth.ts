import { normalizeEmail } from './crypto.ts';

export function isLifecycleQaOperator(input: {
  isStaff: boolean;
  sessionEmail: string;
  operatorEmail?: string;
  vercelEnv?: string;
  enabled?: string;
}): boolean {
  if (input.vercelEnv !== 'production' || input.enabled !== '1') return false;
  if (input.isStaff) return true;
  const operatorEmail = normalizeEmail(input.operatorEmail || '');
  return Boolean(operatorEmail) && normalizeEmail(input.sessionEmail) === operatorEmail;
}
