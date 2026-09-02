import type { CustomerProfileRecord, HandoffPayload } from './types.ts';

export const INVESTOR_CUSTOMER_VALIDATION_LOCK = {
  contract: 'investor-customer-claim-validation-v1',
  version: '1.0.0',
  schemaFingerprint: '51d41f55eb6ff85f1ecf85e8feb0742647e6d50c730ad37859cd9918625018f3',
  contractFingerprint: '80cc14c9d9756972d87aaf3a51ac2336888a9dc77048d3d3c298343b25086032',
} as const;

export type InvestorValidationResolution =
  | { kind: 'profile'; profile: CustomerProfileRecord }
  | { kind: 'not_found' }
  | { kind: 'not_public' }
  | { kind: 'unavailable' };

export function resolveInvestorValidation(
  payload: HandoffPayload,
  data: Record<string, unknown>,
): InvestorValidationResolution {
  const lock = INVESTOR_CUSTOMER_VALIDATION_LOCK;
  if (data.contract !== lock.contract || data.contractVersion !== lock.version ||
      data.schemaFingerprint !== lock.schemaFingerprint || data.contractFingerprint !== lock.contractFingerprint) {
    return { kind: 'unavailable' };
  }
  if (data.resultState === 'BACKEND_UNAVAILABLE') return { kind: 'unavailable' };
  if (data.resultState === 'PUBLICATION_RESTRICTED') return { kind: 'not_public' };
  if (data.resultState !== 'EXACT_IDENTITY') return { kind: 'not_found' };
  if (data.hub !== 'investor' || data.entityType !== 'firm' || data.nativeProfileId !== payload.native_profile_id ||
      String(data.firmCrd) !== payload.external_key || data.publicationState !== 'PUBLIC_CURRENT' ||
      data.current !== true || data.canonicalProfileUrl !== payload.canonical_profile_url) return { kind: 'not_found' };
  return { kind:'profile', profile:{ id:payload.native_profile_id, hubId:'investor', slug:payload.slug,
    displayName:String(data.displayName||payload.display_name||''), isThin:false, publicationEligible:true,
    homeState:null, licenseState:null, externalKey:payload.external_key, sourceSystem:payload.source_system,
    entityClass:'firm', canonicalUrl:String(payload.canonical_profile_url) } };
}
