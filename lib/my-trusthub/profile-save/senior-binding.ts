import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';
import type { PublicationRegistry } from './identity.ts';

/** This deploy does not turn Senior parent sync or the Senior canary on. */
export const SENIOR_PARENT_SYNC = 'OFF' as const;
export const SENIOR_CANARY = 'OFF' as const;
export const SENIOR_CCN_NAMESPACE = 'cms.ccn';
export const SENIOR_PROFILE_CLASS = 'cms_facility';
/** CMS certification is federal. The binding carries no state. */
export const SENIOR_JURISDICTION = 'US';
/** CMS nursing-home grain. Slug, name, address, and the provider UUID are not this id. */
export const SENIOR_SPECIALIST_ENTITY_ID_FORMAT = '<CMS CCN: six letters or digits>';

/** Six letters or digits, either case. Comparison uses the canonical lowercase form. */
const CCN = /^[A-Za-z0-9]{6}$/;
const PROFILE_REF = /^\/facility\/cms\/([A-Za-z0-9]{6})\/[a-z0-9][a-z0-9-]{0,79}$/;

/** Same canonical form as `source_identifier_normalized`: lower(btrim(source_identifier)). */
function canonicalSeniorCcn(value: string): string | null {
  return typeof value === 'string' && CCN.test(value) ? value.toLowerCase() : null;
}

export type SeniorBindingRow = {
  id: string;
  network_entity_id: string;
  binding_status: string;
  specialist_entity_type: string;
  specialist_entity_id: string;
  identifier_namespace: string;
  source_identifier: string;
  jurisdiction: string;
  entity_status: string;
  canonical_public_profile_ref: string;
};

export type SeniorBindingDecision =
  | { outcome: 'eligible'; id: string; networkEntityId: string; canonicalPublicProfileRef: string }
  | { outcome: 'denied'; reason: 'missing' | 'ambiguous' | 'review_required' | 'identity_disagreement' | 'wrong_class' | 'inactive' };

export function seniorParentSyncEnabled(): false { return false; }
export function seniorCanaryEnabled(): false { return false; }

/** The native id is the bare CCN. No prefix, no state id, no UUID.
 * The returned ccn is the canonical form, matching source_identifier_normalized. */
export function parseSeniorNativeId(nativeId: string): { ccn: string } | null {
  const ccn = canonicalSeniorCcn(nativeId);
  return ccn ? { ccn } : null;
}

/** The CCN inside a canonical nursing-home profile ref, or null. Home health
 * and hospice routes are not this grain. The result is the canonical form. */
export function seniorProfileRefCcn(ref: string): string | null {
  const match = PROFILE_REF.exec(ref);
  return match ? canonicalSeniorCcn(match[1]!) : null;
}

/** One exact accepted row on an active entity is eligible. Every other shape is denied. */
export function classifySeniorRows(nativeId: string, rows: readonly SeniorBindingRow[]): SeniorBindingDecision {
  const parsed = parseSeniorNativeId(nativeId);
  if (!parsed) return { outcome: 'denied', reason: 'identity_disagreement' };
  if (rows.length === 0) return { outcome: 'denied', reason: 'missing' };
  if (rows.length > 1) return { outcome: 'denied', reason: 'ambiguous' };
  const row = rows[0]!;
  if (row.specialist_entity_type !== SENIOR_PROFILE_CLASS) return { outcome: 'denied', reason: 'wrong_class' };
  if (row.binding_status === 'review_required') return { outcome: 'denied', reason: 'review_required' };
  if (row.entity_status !== 'active') return { outcome: 'denied', reason: 'inactive' };
  if (
    row.binding_status !== 'accepted' ||
    row.identifier_namespace !== SENIOR_CCN_NAMESPACE ||
    canonicalSeniorCcn(row.source_identifier) !== parsed.ccn ||
    canonicalSeniorCcn(row.specialist_entity_id) !== parsed.ccn ||
    row.jurisdiction !== SENIOR_JURISDICTION ||
    seniorProfileRefCcn(row.canonical_public_profile_ref) !== parsed.ccn
  ) {
    return { outcome: 'denied', reason: 'identity_disagreement' };
  }
  return {
    outcome: 'eligible',
    id: row.id,
    networkEntityId: row.network_entity_id,
    canonicalPublicProfileRef: row.canonical_public_profile_ref,
  };
}

/** The signed return path must be the binding's canonical profile ref. Slug is navigation only. */
export function seniorReturnAgrees(decision: SeniorBindingDecision, returnPath: string): boolean {
  return decision.outcome === 'eligible' && decision.canonicalPublicProfileRef === returnPath;
}

/** Security-definer read. Packet 17 creates this function. It is not applied by the deploy. */
export const SENIOR_BINDING_SQL = `select id, network_entity_id, binding_status, specialist_entity_type,
  specialist_entity_id, identifier_namespace, source_identifier, jurisdiction, entity_status,
  canonical_public_profile_ref
 from v23_private.prod_senior_ccn_binding_for($1)`;

export async function resolveSeniorProfile(
  identity: ProfileIdentity,
  publication: PublicationRegistry,
  sql: FoundationSql,
): Promise<TrustedProfile | null> {
  if (identity.hub !== 'senior') return null;
  if (identity.profileClass !== SENIOR_PROFILE_CLASS) return null;
  if (!parseSeniorNativeId(identity.nativeId)) return null;
  const current = await publication.resolve(identity);
  if (!current) return null;
  const profile: TrustedProfile = {
    ...current.identity,
    published: current.published,
    supportedClass: current.supportedClass,
    binding: null,
  };
  if (!profile.published || !profile.supportedClass) return profile;
  const found = await sql.query<SeniorBindingRow>(SENIOR_BINDING_SQL, [identity.nativeId]);
  const decision = classifySeniorRows(identity.nativeId, found.rows);
  if (decision.outcome === 'denied' && decision.reason === 'ambiguous') throw new RuntimeError('conflict');
  if (decision.outcome === 'eligible') {
    profile.binding = { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' };
  } else if (decision.outcome === 'denied' && decision.reason === 'review_required') {
    const row = found.rows[0]!;
    profile.binding = { id: row.id, networkEntityId: row.network_entity_id, status: 'review_required' };
  }
  return profile;
}
