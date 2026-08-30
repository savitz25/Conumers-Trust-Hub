import {
  HOME_STATE_FL,
  HUB_CONTRACTOR,
  SOURCE_FL_DBPR,
  type AdapterFailure,
  type CthProfileRecord,
  type HandoffPayload,
} from './types.ts';

export type AdapterOk = { ok: true; profile: CthProfileRecord };
export type AdapterErr = { ok: false; code: AdapterFailure };
export type AdapterResult = AdapterOk | AdapterErr;

export type CthDirectory = {
  getById(id: string): Promise<CthProfileRecord | null>;
};

export function floridaEligible(profile: CthProfileRecord): boolean {
  return profile.homeState === HOME_STATE_FL || profile.licenseState === HOME_STATE_FL;
}

export function validateContractorAdapter(
  handoff: Pick<
    HandoffPayload,
    'hub_id' | 'native_profile_id' | 'slug' | 'external_key' | 'source_system' | 'home_state'
  >,
  profile: CthProfileRecord | null
): AdapterResult {
  if (handoff.hub_id !== HUB_CONTRACTOR) return { ok: false, code: 'unsupported_hub' };
  if (handoff.home_state !== HOME_STATE_FL) return { ok: false, code: 'unsupported_state' };
  if (handoff.source_system !== SOURCE_FL_DBPR) return { ok: false, code: 'unsupported_source' };
  if (!profile) return { ok: false, code: 'missing_profile' };
  if (profile.id !== handoff.native_profile_id) return { ok: false, code: 'missing_profile' };
  if (profile.isThin) return { ok: false, code: 'thin_profile' };
  if (!floridaEligible(profile)) return { ok: false, code: 'unsupported_state' };
  if (profile.sourceSystem !== SOURCE_FL_DBPR) return { ok: false, code: 'unsupported_source' };
  if (profile.slug !== handoff.slug) return { ok: false, code: 'slug_mismatch' };
  if (profile.externalKey !== handoff.external_key) return { ok: false, code: 'credential_mismatch' };
  return { ok: true, profile };
}

export async function loadAndValidateProfile(
  directory: CthDirectory,
  handoff: HandoffPayload
): Promise<AdapterResult> {
  const profile = await directory.getById(handoff.native_profile_id);
  return validateContractorAdapter(handoff, profile);
}
