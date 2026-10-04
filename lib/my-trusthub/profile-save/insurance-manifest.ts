import { createHash } from 'node:crypto';
import { TRANSFER_VERSION_V3, isGuestStageInput, type GuestStageInput } from '../contracts/v2-3-profile-transfer.ts';
import {
  INSURANCE_PROFILE_CLASS, INSURANCE_STATE_LICENSE_NAMESPACE, insuranceSpecialistEntityId, parseInsuranceSpecialistEntityId,
} from './insurance-binding.ts';
import type { ProfileIdentity } from '../contracts/v2-3-profile-save.ts';

/** Closed profile the Insurance specialist signs. providers.id is not a field. */
const PROFILE_KEYS = ['hub', 'profileClass', 'identifierNamespace', 'sourceIdentifier', 'jurisdiction', 'canonicalReturnPath'] as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InsuranceClosedProfile = {
  hub: 'insurance';
  profileClass: typeof INSURANCE_PROFILE_CLASS;
  identifierNamespace: typeof INSURANCE_STATE_LICENSE_NAMESPACE;
  sourceIdentifier: string;
  jurisdiction: string;
  canonicalReturnPath: `/providers/${string}`;
};

export type InsuranceClosedManifest = {
  version: typeof TRANSFER_VERSION_V3;
  sourceHub: 'insurance';
  audience: 'ask';
  selected: [{ localItemId: string; revision: '1'; digest: string; profile: InsuranceClosedProfile }];
  returnTask: {
    kind: 'profile';
    hub: 'insurance';
    canonicalSlug: string;
    profile: InsuranceClosedProfile;
    canonicalReturnPath: `/providers/${string}`;
  };
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function exact<const K extends string>(v: unknown, keys: readonly K[]): v is Record<K, unknown> {
  return record(v) && Object.keys(v).sort().join() === [...keys].sort().join();
}
function text(v: unknown): v is string {
  return typeof v === 'string';
}

export function insuranceProfileDigest(profile: InsuranceClosedProfile): string {
  return createHash('sha256').update(JSON.stringify(PROFILE_KEYS.map(key => profile[key]))).digest('hex');
}

function slugOf(path: string): string | null {
  if (!path.startsWith('/providers/')) return null;
  const slug = path.slice('/providers/'.length);
  return SLUG.test(slug) ? slug : null;
}

/** Browser-supplied provider UUIDs, names, and slug-shaped licenses are not a profile. */
export function isClosedInsuranceManifest(value: unknown): value is InsuranceClosedManifest {
  if (!exact(value, ['version', 'sourceHub', 'audience', 'selected', 'returnTask'])) return false;
  if (value.version !== TRANSFER_VERSION_V3 || value.sourceHub !== 'insurance' || value.audience !== 'ask') return false;
  const selected: unknown = value.selected;
  if (!Array.isArray(selected) || selected.length !== 1) return false;
  const item: unknown = selected[0];
  if (!exact(item, ['localItemId', 'revision', 'digest', 'profile']) || item.revision !== '1') return false;
  const profileUnknown: unknown = item.profile;
  const taskUnknown: unknown = value.returnTask;
  if (!exact(profileUnknown, PROFILE_KEYS) || !exact(taskUnknown, ['kind', 'hub', 'canonicalSlug', 'profile', 'canonicalReturnPath'])) return false;
  const taskProfileUnknown: unknown = taskUnknown.profile;
  if (!exact(taskProfileUnknown, PROFILE_KEYS)) return false;
  const profile = profileUnknown;
  const task = taskUnknown;
  if (profile.hub !== 'insurance' || profile.profileClass !== INSURANCE_PROFILE_CLASS) return false;
  if (profile.identifierNamespace !== INSURANCE_STATE_LICENSE_NAMESPACE) return false;
  if (!text(profile.sourceIdentifier) || !text(profile.jurisdiction) || !text(profile.canonicalReturnPath)) return false;
  if (UUID.test(profile.sourceIdentifier)) return false;
  const nativeId = insuranceSpecialistEntityId(profile.jurisdiction, profile.sourceIdentifier);
  const slug = slugOf(profile.canonicalReturnPath);
  if (!text(item.localItemId) || !text(item.digest)) return false;
  if (!nativeId || !slug || item.localItemId !== slug || item.digest !== insuranceProfileDigest(profile as InsuranceClosedProfile)) return false;
  if (task.kind !== 'profile' || task.hub !== 'insurance' || task.canonicalSlug !== slug) return false;
  if (task.canonicalReturnPath !== profile.canonicalReturnPath) return false;
  const taskProfile = taskProfileUnknown;
  if (PROFILE_KEYS.some(key => taskProfile[key] !== profile[key])) return false;
  return true;
}

export function insuranceIdentityFromManifest(manifest: InsuranceClosedManifest): ProfileIdentity {
  const profile = manifest.selected[0].profile;
  const nativeId = insuranceSpecialistEntityId(profile.jurisdiction, profile.sourceIdentifier);
  if (!nativeId) throw new Error('INVALID_MANIFEST');
  return { hub: 'insurance', nativeId, profileClass: INSURANCE_PROFILE_CLASS };
}

/** Internal parent stage. The native id is derived here, never taken from the browser. */
export function guestStageFromInsuranceManifest(manifest: InsuranceClosedManifest): GuestStageInput {
  const identity = insuranceIdentityFromManifest(manifest);
  const slug = manifest.returnTask.canonicalSlug;
  const digest = manifest.selected[0].digest;
  return {
    version: TRANSFER_VERSION_V3,
    sourceHub: 'insurance',
    audience: 'ask',
    selected: [{ localItemId: slug, revision: '1', digest, profile: identity }],
    returnTask: { kind: 'profile', hub: 'insurance', canonicalSlug: slug, profile: identity, returnPath: manifest.returnTask.canonicalReturnPath },
  };
}

export function isInsuranceProviderStage(input: unknown): input is GuestStageInput {
  if (!isGuestStageInput(input) || input.sourceHub !== 'insurance' || input.version !== TRANSFER_VERSION_V3) return false;
  const task = input.returnTask;
  if (!('returnPath' in task) || task.hub !== 'insurance') return false;
  const nativeId = task.profile.nativeId;
  const parsed = parseInsuranceSpecialistEntityId(nativeId);
  if (!parsed || task.profile.profileClass !== INSURANCE_PROFILE_CLASS) return false;
  if (task.returnPath !== `/providers/${task.canonicalSlug}` || !SLUG.test(task.canonicalSlug)) return false;
  if (nativeId === task.canonicalSlug || UUID.test(nativeId)) return false;
  return input.selected.length === 1 && input.selected[0]!.profile.nativeId === nativeId &&
    input.selected[0]!.profile.profileClass === INSURANCE_PROFILE_CLASS &&
    input.selected[0]!.localItemId === task.canonicalSlug;
}
