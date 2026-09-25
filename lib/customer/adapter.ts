import {
  HOME_STATE_FL,
  HUB_CONTRACTOR,
  contractorClaimState,
  contractorCredentialPairAllowed,
  type AdapterFailure,
  type CthProfileRecord,
  type CustomerProfileRecord,
  type HandoffPayload,
} from './types.ts';
import { customerHub, handoffCapability, publicProfileDestination } from './hub-registry.ts';

export type AdapterOk = { ok: true; profile: CthProfileRecord };
export type AdapterErr = { ok: false; code: AdapterFailure };
export type AdapterResult = AdapterOk | AdapterErr;

export type CthDirectory = {
  /**
   * ATH-CLAIM-V2-FLNJ-001: when the handoff names a credential, the directory re-reads THAT credential row for
   * the profile (exact source + key) so Ask verifies the signed identity against the specialist's own data
   * instead of trusting the payload. Without a hint the deterministic FL-then-NJ selection applies.
   */
  getById(id: string, credential?: { sourceSystem: string; externalKey: string }): Promise<CthProfileRecord | null>;
};

export type CustomerProfileDirectory = {
  getExact(payload: HandoffPayload): Promise<CustomerProfileRecord | null>;
};

export function floridaEligible(profile: CthProfileRecord): boolean {
  return profile.homeState === HOME_STATE_FL || profile.licenseState === HOME_STATE_FL;
}

/** The profile (home state or the selected credential's state) must sit in the claim state the credential establishes. */
export function claimStateEligible(profile: Pick<CthProfileRecord, 'homeState' | 'licenseState'>, state: string): boolean {
  return profile.homeState === state || profile.licenseState === state;
}

export function validateContractorAdapter(
  handoff: Pick<
    HandoffPayload,
    'hub_id' | 'native_profile_id' | 'slug' | 'external_key' | 'source_system' | 'home_state'
  >,
  profile: CthProfileRecord | null
): AdapterResult {
  if (handoff.hub_id !== HUB_CONTRACTOR) return { ok: false, code: 'unsupported_hub' };
  // ATH-CLAIM-V2-FLNJ-001: FL:fl_dbpr and NJ:nj_dca only; the state must be the one the source establishes.
  const claimState = contractorClaimState(handoff.source_system);
  if (!claimState) return { ok: false, code: 'unsupported_source' };
  if (handoff.home_state !== claimState) return { ok: false, code: 'unsupported_state' };
  if (!profile) return { ok: false, code: 'missing_profile' };
  if (profile.id !== handoff.native_profile_id) return { ok: false, code: 'missing_profile' };
  if (profile.isThin) return { ok: false, code: 'thin_profile' };
  if (!claimStateEligible(profile, claimState)) return { ok: false, code: 'unsupported_state' };
  if (profile.sourceSystem !== handoff.source_system) return { ok: false, code: 'unsupported_source' };
  if (profile.slug !== handoff.slug) return { ok: false, code: 'slug_mismatch' };
  if (profile.externalKey !== handoff.external_key) return { ok: false, code: 'credential_mismatch' };
  return { ok: true, profile };
}

export async function loadAndValidateProfile(
  directory: CthDirectory | CustomerProfileDirectory,
  handoff: HandoffPayload
): Promise<AdapterResult> {
  if ('getExact' in directory) {
    try{return validateCustomerProfile(handoff,await directory.getExact(handoff));}
    catch(error){const code=error instanceof Error?error.message:'';if(code==='historical_profile'||code==='profile_not_public'||code==='specialist_unavailable')return{ok:false,code};throw error;}
  }
  const profile = await directory.getById(handoff.native_profile_id, { sourceSystem: handoff.source_system, externalKey: handoff.external_key });
  return validateContractorAdapter(handoff, profile);
}

export function validateCustomerProfile(handoff:HandoffPayload,profile:CustomerProfileRecord|null):AdapterResult {
  const cap=handoffCapability(handoff);
  if(!cap) return {ok:false,code:'unsupported_hub'};
  if(!profile || profile.id!==handoff.native_profile_id) return {ok:false,code:'missing_profile'};
  if(profile.hubId!==handoff.hub_id) return {ok:false,code:'unsupported_hub'};
  if(handoff.hub_id==='contractor'){
    // ATH-CLAIM-V2-FLNJ-001: exact (source, state) pair from the allow-list, re-verified against the specialist row:
    // the row's credential source must be the signed one, and the row must sit in the state that source establishes.
    if(!contractorCredentialPairAllowed(handoff.source_system,handoff.home_state)) return {ok:false,code:'unsupported_source'};
    if(profile.sourceSystem!==handoff.source_system) return {ok:false,code:'unsupported_source'};
    if(!claimStateEligible(profile,String(handoff.home_state))) return {ok:false,code:'unsupported_state'};
  }
  if(!profile.publicationEligible || profile.isThin) return {ok:false,code:'thin_profile'};
  const expectedClass=handoff.hub_id==='senior'?handoff.provider_class:cap.identityClass;
  if(profile.entityClass!==expectedClass) return {ok:false,code:'unsupported_source'};
  if(profile.slug!==handoff.slug) return {ok:false,code:'slug_mismatch'};
  if(profile.externalKey!==handoff.external_key) return {ok:false,code:'credential_mismatch'};
  if(profile.sourceSystem!==handoff.source_system) return {ok:false,code:'unsupported_source'};
  if((handoff.hub_id==='contractor'&&handoff.v===2||handoff.hub_id==='senior'||handoff.hub_id==='investor'||handoff.hub_id==='insurance') && profile.canonicalUrl!==handoff.canonical_profile_url) return {ok:false,code:'slug_mismatch'};
  if(!customerHub(profile.hubId) || !publicProfileDestination(profile)) return {ok:false,code:'missing_profile'};
  return {ok:true,profile};
}
