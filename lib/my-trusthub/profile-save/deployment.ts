import { accountRuntime } from '../account-policy.ts';
import type { HttpBindings } from './http.ts';

/** Explicit production deny regardless of flags. No fallback to P13 production
 * pool, service-role key, old legacy sessions, fixture storage or broad admin. */
export function deploymentBindings(env: Record<string, string | undefined> = process.env): HttpBindings {
  const enabled = env.VERCEL_ENV !== 'production' && env.MY_TRUSTHUB_V23_PROFILE_SAVE_ENABLED === 'true' &&
    env.MY_TRUSTHUB_ENABLED === 'true' && env.MY_TRUSTHUB_SAVED_ENABLED === 'true' &&
    env.MY_TRUSTHUB_SPECIALIST_HANDOFF_ENABLED === 'true' && Boolean(accountRuntime(env));
  return {
    enabled,
    // Wiring requires approved isolated auth/BFF/P12/P13/storage bindings. Until
    // supplied and independently verified, an enabled route is unavailable.
    runtimeForRequest: async () => null,
  };
}
