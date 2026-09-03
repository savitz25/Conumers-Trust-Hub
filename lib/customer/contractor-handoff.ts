import { CUSTOMER_HUB_REGISTRY } from './hub-registry.ts';

const CANONICAL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ContractorMintIdentityInput = {
  nativeProfileId?: string;
  slug?: string;
  externalKey?: string;
  canonicalProfileUrl?: string;
};

export type ContractorMintIdentityResult =
  | { ok: true; canonicalProfileUrl: string }
  | { ok: false; error: 'missing_required_identity' | 'canonical_destination_mismatch' };

/**
 * Build the only accepted Contractor destination from the network registry and
 * exact public slug. A caller may confirm that value, but cannot replace it.
 */
export function contractorMintIdentity(input: ContractorMintIdentityInput): ContractorMintIdentityResult {
  if (!input.nativeProfileId?.trim() || !input.externalKey?.trim() || !input.slug || !CANONICAL_SLUG.test(input.slug)) {
    return { ok: false, error: 'missing_required_identity' };
  }
  const canonicalProfileUrl = new URL(
    `/contractors/${input.slug}`,
    CUSTOMER_HUB_REGISTRY.contractor.destinationOrigin,
  ).toString();
  if (input.canonicalProfileUrl !== undefined && input.canonicalProfileUrl !== canonicalProfileUrl) {
    return { ok: false, error: 'canonical_destination_mismatch' };
  }
  return { ok: true, canonicalProfileUrl };
}
