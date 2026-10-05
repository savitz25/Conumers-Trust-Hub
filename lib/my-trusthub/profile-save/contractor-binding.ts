import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';
import type { PublicationRegistry } from './identity.ts';

/** This deploy does not turn parent sync or the contractor canary on. */
export const CONTRACTOR_PARENT_SYNC = 'OFF' as const;
export const CONTRACTOR_CANARY = 'OFF' as const;
export const CONTRACTOR_DBPR_NAMESPACE = 'fl.dbpr.license';
export const CONTRACTOR_PROFILE_CLASS = 'contractor_profile';
export const CONTRACTOR_JURISDICTION = 'FL';
/** Credential grain. Slug and contractors.id are not this id. */
export const CONTRACTOR_SPECIALIST_ENTITY_ID_FORMAT = 'fl.dbpr.license:<DBPR external_key>';

const DBPR_KEY = /^[A-Z]{1,4}[0-9]{3,9}$/;
const ENTITY_ID = /^fl\.dbpr\.license:([A-Z]{1,4}[0-9]{3,9})$/;
const PROFILE_REF = /^\/contractors\/[a-z0-9][a-z0-9-]{0,159}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ContractorBindingRow = {
  id: string;
  network_entity_id: string;
  binding_status: string;
  specialist_entity_type: string;
  specialist_entity_id: string;
  identifier_namespace: string;
  source_identifier: string;
  /** Null is a real stored claim. It is not the Florida contract. */
  jurisdiction: string | null;
  entity_status: string;
  canonical_public_profile_ref: string;
};

export type ContractorBindingDecision =
  | { outcome: 'eligible'; id: string; networkEntityId: string; canonicalPublicProfileRef: string }
  | { outcome: 'denied'; reason: 'missing' | 'ambiguous' | 'review_required' | 'identity_disagreement' | 'wrong_class' | 'inactive' };

export function contractorParentSyncEnabled(): false { return false; }
export function contractorCanaryEnabled(): false { return false; }

export function contractorSpecialistEntityId(externalKey: string): string | null {
  if (!DBPR_KEY.test(externalKey)) return null;
  return `${CONTRACTOR_DBPR_NAMESPACE}:${externalKey}`;
}

export function parseContractorNativeId(nativeId: string): { externalKey: string } | null {
  const match = ENTITY_ID.exec(nativeId);
  if (!match || !DBPR_KEY.test(match[1]!)) return null;
  return { externalKey: match[1]! };
}

/** One exact accepted row on an active entity is eligible. Every other shape is denied. */
export function classifyContractorRows(nativeId: string, rows: readonly ContractorBindingRow[]): ContractorBindingDecision {
  const parsed = parseContractorNativeId(nativeId);
  if (!parsed || UUID.test(nativeId)) return { outcome: 'denied', reason: 'identity_disagreement' };
  if (rows.length === 0) return { outcome: 'denied', reason: 'missing' };
  if (rows.length > 1) return { outcome: 'denied', reason: 'ambiguous' };
  const row = rows[0]!;
  if (row.specialist_entity_type !== CONTRACTOR_PROFILE_CLASS) return { outcome: 'denied', reason: 'wrong_class' };
  if (row.binding_status === 'review_required') return { outcome: 'denied', reason: 'review_required' };
  if (row.entity_status !== 'active') return { outcome: 'denied', reason: 'inactive' };
  if (
    row.binding_status !== 'accepted' ||
    row.identifier_namespace !== CONTRACTOR_DBPR_NAMESPACE ||
    row.source_identifier !== parsed.externalKey ||
    row.jurisdiction !== CONTRACTOR_JURISDICTION ||
    row.specialist_entity_id !== nativeId ||
    !PROFILE_REF.test(row.canonical_public_profile_ref)
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
export function contractorReturnAgrees(decision: ContractorBindingDecision, returnPath: string): boolean {
  return decision.outcome === 'eligible' && decision.canonicalPublicProfileRef === returnPath;
}

/** Security-definer read. Packet 16 creates this function. It is not applied by the deploy. */
export const CONTRACTOR_BINDING_SQL = `select id, network_entity_id, binding_status, specialist_entity_type,
  specialist_entity_id, identifier_namespace, source_identifier, jurisdiction, entity_status,
  canonical_public_profile_ref
 from v23_private.prod_contractor_dbpr_binding_for($1)`;

export async function resolveContractorProfile(
  identity: ProfileIdentity,
  publication: PublicationRegistry,
  sql: FoundationSql,
): Promise<TrustedProfile | null> {
  if (identity.hub !== 'contractor') return null;
  if (identity.profileClass !== CONTRACTOR_PROFILE_CLASS) return null;
  if (!parseContractorNativeId(identity.nativeId) || UUID.test(identity.nativeId)) return null;
  const current = await publication.resolve(identity);
  if (!current) return null;
  const profile: TrustedProfile = {
    ...current.identity,
    published: current.published,
    supportedClass: current.supportedClass,
    binding: null,
  };
  if (!profile.published || !profile.supportedClass) return profile;
  const found = await sql.query<ContractorBindingRow>(CONTRACTOR_BINDING_SQL, [identity.nativeId]);
  const decision = classifyContractorRows(identity.nativeId, found.rows);
  if (decision.outcome === 'denied' && decision.reason === 'ambiguous') throw new RuntimeError('conflict');
  if (decision.outcome === 'eligible') {
    profile.binding = { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' };
  } else if (decision.outcome === 'denied' && decision.reason === 'review_required') {
    const row = found.rows[0]!;
    profile.binding = { id: row.id, networkEntityId: row.network_entity_id, status: 'review_required' };
  }
  return profile;
}
