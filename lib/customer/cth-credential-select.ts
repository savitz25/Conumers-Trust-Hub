import { contractorClaimState } from './types.ts';

/**
 * ATH-CLAIM-V2-FLNJ-001 — pure selection over the claimable-source credential rows Ask reads from Contractor
 * (ordered FL source first, active first, most recently seen, then key — identical to Contractor's own query).
 * The credential named in the signed handoff wins when it exists on that profile; otherwise FL-then-NJ by the
 * state rule. If no row satisfies a state rule the first row is surfaced so the adapter reports the exact
 * mismatch (source / state / credential) instead of a generic "missing profile".
 */
export type CthCredentialRow = { id: string; slug: string; display_name: string; is_thin_profile: boolean; home_state: string | null; license_state: string | null; external_key: string; source_system: string };

export function selectCthCredential(rows: readonly CthCredentialRow[], credential?: { sourceSystem: string; externalKey: string }): CthCredentialRow | null {
  if (!rows.length) return null;
  if (credential) {
    const exact = rows.find((r) => r.source_system === credential.sourceSystem && r.external_key === credential.externalKey);
    if (exact) return exact;
  }
  for (const state of ['FL', 'NJ'] as const) {
    const best = rows.find((r) => contractorClaimState(r.source_system) === state);
    if (best && (best.home_state === state || best.license_state === state)) return best;
  }
  return rows[0];
}
