import { deploymentEnabled } from './isolated-config.ts';
import type { HttpBindings } from './http.ts';

/** Explicit production deny regardless of flags. No fallback to P13 production
 * pool, service-role key, old legacy sessions, fixture storage or broad admin. */
export function deploymentBindings(env: Record<string, string | undefined> = process.env): HttpBindings {
  const enabled = deploymentEnabled(env);
  return {
    enabled,
    runtimeForRequest: async request => {
      if (!enabled) return null;
      const { isolatedConfig } = await import('./isolated-config.ts');
      if (!isolatedConfig(env)) return null;
      const { hostedRuntime } = await import('./hosted-runtime.ts');
      return (await hostedRuntime(env))?.serviceRuntime(request) ?? null;
    },
  };
}
