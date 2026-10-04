import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';
import type { PublicationRegistry } from './identity.ts';

/** Separate from legal_insurer / NAIC. This deploy does not turn either on. */
export const INSURANCE_PARENT_SYNC = 'OFF' as const;
export const INSURANCE_CANARY = 'OFF' as const;
export const INSURANCE_STATE_LICENSE_NAMESPACE = 'insurance.state_license';
export const INSURANCE_PROFILE_CLASS = 'insurance_provider';
/** Credential grain. Slug and providers.id are not this id. */
export const INSURANCE_SPECIALIST_ENTITY_ID_FORMAT = 'state-license:<STATE>:<COMPACT_LICENSE>';

const STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
]);
const LICENSE = /^[A-Z0-9]{3,32}$/;
const ENTITY_ID = /^state-license:([A-Z]{2}):([A-Z0-9]{3,32})$/;
const PROVIDER_REF = /^\/providers\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type InsuranceBindingRow = {
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

export type InsuranceBindingDecision =
  | { outcome: 'eligible'; id: string; networkEntityId: string; canonicalPublicProfileRef: string }
  | { outcome: 'denied'; reason: 'missing' | 'ambiguous' | 'review_required' | 'identity_disagreement' | 'wrong_class' | 'inactive' };

export function insuranceParentSyncEnabled(): false { return false; }
export function insuranceCanaryEnabled(): false { return false; }

export function insuranceSpecialistEntityId(jurisdiction: string, license: string): string | null {
  if (!STATES.has(jurisdiction) || !LICENSE.test(license) || !/[0-9]/.test(license)) return null;
  return `state-license:${jurisdiction}:${license}`;
}

export function parseInsuranceSpecialistEntityId(nativeId: string): { jurisdiction: string; license: string } | null {
  const match = ENTITY_ID.exec(nativeId);
  if (!match || !STATES.has(match[1]!) || !/[0-9]/.test(match[2]!)) return null;
  return { jurisdiction: match[1]!, license: match[2]! };
}

/** One exact accepted row is eligible. Every other shape is denied. */
export function classifyInsuranceRows(nativeId: string, rows: readonly InsuranceBindingRow[]): InsuranceBindingDecision {
  const parsed = parseInsuranceSpecialistEntityId(nativeId);
  if (!parsed) return { outcome: 'denied', reason: 'identity_disagreement' };
  if (rows.length === 0) return { outcome: 'denied', reason: 'missing' };
  if (rows.length > 1) return { outcome: 'denied', reason: 'ambiguous' };
  const row = rows[0]!;
  if (row.specialist_entity_type !== INSURANCE_PROFILE_CLASS) return { outcome: 'denied', reason: 'wrong_class' };
  if (row.binding_status === 'review_required') return { outcome: 'denied', reason: 'review_required' };
  if (row.entity_status !== 'active') return { outcome: 'denied', reason: 'inactive' };
  if (
    row.binding_status !== 'accepted' ||
    row.identifier_namespace !== INSURANCE_STATE_LICENSE_NAMESPACE ||
    row.source_identifier !== parsed.license ||
    row.jurisdiction !== parsed.jurisdiction ||
    row.specialist_entity_id !== nativeId ||
    !PROVIDER_REF.test(row.canonical_public_profile_ref)
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

/** Security-definer read. Packet 13 creates this function. It is not applied by the deploy. */
export const INSURANCE_BINDING_SQL = `select id, network_entity_id, binding_status, specialist_entity_type,
  specialist_entity_id, identifier_namespace, source_identifier, jurisdiction, entity_status,
  canonical_public_profile_ref
 from v23_private.prod_insurance_state_license_binding_for($1)`;

export async function resolveInsuranceProviderProfile(
  identity: ProfileIdentity,
  publication: PublicationRegistry,
  sql: FoundationSql,
): Promise<TrustedProfile | null> {
  if (identity.hub !== 'insurance' || identity.profileClass !== INSURANCE_PROFILE_CLASS) return null;
  if (!parseInsuranceSpecialistEntityId(identity.nativeId)) return null;
  const current = await publication.resolve(identity);
  if (!current) return null;
  const profile: TrustedProfile = {
    ...current.identity,
    published: current.published,
    supportedClass: current.supportedClass,
    binding: null,
  };
  if (!profile.published || !profile.supportedClass) return profile;
  const found = await sql.query<InsuranceBindingRow>(INSURANCE_BINDING_SQL, [identity.nativeId]);
  const decision = classifyInsuranceRows(identity.nativeId, found.rows);
  if (decision.outcome === 'denied' && decision.reason === 'ambiguous') throw new RuntimeError('conflict');
  if (decision.outcome === 'eligible') {
    profile.binding = { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' };
  } else if (decision.outcome === 'denied' && decision.reason === 'review_required') {
    const row = found.rows[0]!;
    profile.binding = { id: row.id, networkEntityId: row.network_entity_id, status: 'review_required' };
  }
  return profile;
}
