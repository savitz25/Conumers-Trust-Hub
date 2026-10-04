import { deploymentEnabled } from './isolated-config.ts';
import { RuntimeError } from './runtime.ts';
import type { HttpBindings } from './http.ts';

/** Production is denied unless the explicit production handoff pins resolve.
 * No fallback to the P13 production pool, service-role key, old legacy
 * sessions, fixture storage or broad admin in either environment. */
export function deploymentBindings(env: Record<string, string | undefined> = process.env): HttpBindings {
  const enabled = deploymentEnabled(env);
  return {
    enabled,
    runtimeForRequest: async request => {
      if (!enabled) return null;
      const { deploymentConfig } = await import('./isolated-config.ts');
      if (!deploymentConfig(env)) return null;
      const { hostedRuntime } = await import('./hosted-runtime.ts');
      return (await hostedRuntime(env))?.serviceRuntime(request) ?? null;
    },
    acceptInsuranceManifest: async request => {
      if (!enabled) return null;
      const { deploymentConfig } = await import('./isolated-config.ts');
      if (!deploymentConfig(env)) return null;
      const { hostedRuntime } = await import('./hosted-runtime.ts');
      const runtime = await hostedRuntime(env);
      if (!runtime) throw new RuntimeError('unavailable');
      return runtime.acceptInsuranceManifest(request);
    },
  };
}
