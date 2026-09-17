import { timingSafeEqualText } from '../customer/crypto.ts';

export const SENTRY_PROBE_ERROR_NAME = 'AthRel001AProbeError';
export const SENTRY_PROBE_ERROR_MESSAGE = 'ATH-REL-001A controlled Sentry probe';

type ProbeEnv = Record<string, string | undefined>;

export function sentryProbeEnabled(env: ProbeEnv = process.env): boolean {
  return env.SENTRY_PROBE_ENABLED === 'true';
}

export function sentryProbeAuthorized(
  header: string | null | undefined,
  env: ProbeEnv = process.env,
): boolean {
  const expected = (env.SENTRY_PROBE_SECRET || env.ATH_OPERATOR_SECRET || '').trim();
  if (!expected || expected.length < 16) return false;
  const got = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!got || got.length !== expected.length) return false;
  return timingSafeEqualText(got, expected);
}

export function createSentryProbeError(): Error {
  const error = new Error(SENTRY_PROBE_ERROR_MESSAGE);
  error.name = SENTRY_PROBE_ERROR_NAME;
  return error;
}
