import { validateCustomerProfile, type CustomerProfileDirectory } from './adapter.ts';
import type { AdapterFailure, CustomerProfileRecord, HandoffPayload } from './types.ts';

export type HandoffMintResolution =
  | { ok: true; profile: CustomerProfileRecord }
  | { ok: false; error: AdapterFailure | 'internal_error'; status: 400 | 503 | 500 };

const EXPECTED_VALIDATION_FAILURES = new Set<AdapterFailure>([
  'historical_profile',
  'profile_not_public',
]);

/** Resolve and validate the exact specialist-owned identity before minting a handoff. */
export async function resolveProfileForHandoffMint(
  directory: CustomerProfileDirectory,
  payload: HandoffPayload
): Promise<HandoffMintResolution> {
  let profile: CustomerProfileRecord | null;
  try {
    profile = await directory.getExact(payload);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (EXPECTED_VALIDATION_FAILURES.has(code as AdapterFailure)) {
      return { ok: false, error: code as AdapterFailure, status: 400 };
    }
    if (code === 'specialist_unavailable') {
      return { ok: false, error: 'specialist_unavailable', status: 503 };
    }
    return { ok: false, error: 'internal_error', status: 500 };
  }

  const validation = validateCustomerProfile(payload, profile);
  if (!validation.ok) {
    return { ok: false, error: validation.code, status: 400 };
  }
  return { ok: true, profile: profile as CustomerProfileRecord };
}
