import type { CustomerProfileRecord, HandoffPayload } from './types.ts';

export const INSURANCE_CUSTOMER_VALIDATION_LOCK = {
  contract: 'insurance-customer-claim-validation-v1',
  version: '1.0.0',
  schemaFingerprint: 'cc8d6cc82c4e118e266607196cad17ecf99033f4ee1bb6c46ffceceddf62741b',
  contractFingerprint: 'b6396688c36251e59e906db2b98cde40fd88d46c271e31598d7bd0a22c06c9eb',
} as const;

export type InsuranceValidationResolution =
  | { kind: 'profile'; profile: CustomerProfileRecord }
  | { kind: 'not_found' }
  | { kind: 'not_public' }
  | { kind: 'unavailable' };

export function resolveInsuranceValidation(
  payload: HandoffPayload,
  data: Record<string, unknown>,
): InsuranceValidationResolution {
  const lock = INSURANCE_CUSTOMER_VALIDATION_LOCK;
  if (data.contract !== lock.contract || data.contractVersion !== lock.version ||
      data.schemaFingerprint !== lock.schemaFingerprint || data.contractFingerprint !== lock.contractFingerprint) {
    return { kind: 'unavailable' };
  }
  if (data.resultState === 'BACKEND_UNAVAILABLE') return { kind: 'unavailable' };
  if (data.resultState === 'PUBLICATION_RESTRICTED' || data.resultState === 'PUBLICATION_HOLD' || data.resultState === 'ENTITY_CLASS_RESTRICTED') {
    return { kind: 'not_public' };
  }
  if (data.resultState !== 'EXACT_IDENTITY') return { kind: 'not_found' };
  const sourceIdentifier = data.sourceIdentifier as Record<string, unknown> | null;
  if (data.hub !== 'insurance' || data.entityClass !== 'legal_insurer' || data.nativeProfileId !== payload.native_profile_id ||
      sourceIdentifier?.type !== 'NAIC' || String(sourceIdentifier?.value) !== payload.external_key ||
      data.publicationState !== 'PUBLIC_PROFILE' || data.current !== true ||
      data.canonicalProfileUrl !== payload.canonical_profile_url) return { kind: 'not_found' };
  return { kind:'profile', profile:{ id:payload.native_profile_id, hubId:'insurance', slug:payload.slug,
    displayName:String(data.displayName||payload.display_name||''), isThin:false, publicationEligible:true,
    homeState:null, licenseState:null, externalKey:payload.external_key, sourceSystem:payload.source_system,
    entityClass:'legal_insurer', canonicalUrl:String(payload.canonical_profile_url) } };
}
