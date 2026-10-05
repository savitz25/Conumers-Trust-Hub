import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';
import type { PublicationRegistry } from './identity.ts';

/** Locked Investor identity: one official SEC/IARD firm, by exact firm CRD.
 * Never the firm row UUID, the name, the slug, an individual adviser CRD, a
 * branch, a notice filing or a state-registration observation. */
export const INVESTOR_CRD_NAMESPACE = 'sec.crd';
export const INVESTOR_PROFILE_CLASS = 'official_firm';
export const INVESTOR_JURISDICTION = 'US';

export type InvestorBindingRow = {
  id: string;
  network_entity_id: string;
  binding_status: string;
  specialist_entity_type: string;
  specialist_entity_id: string;
  identifier_namespace: string;
  source_identifier: string;
  jurisdiction: string;
  entity_status: string;
  canonical_public_profile_ref: string | null;
};

export type InvestorBindingDecision =
  | { outcome: 'eligible'; id: string; networkEntityId: string }
  | { outcome: 'denied'; reason: 'missing' | 'ambiguous' | 'review_required' | 'identity_disagreement' | 'wrong_class' | 'inactive' };

export function investorNativeId(crd: string): string | null {
  return /^[1-9][0-9]{0,9}$/.test(crd) ? `crd-${crd}` : null;
}

export function parseInvestorNativeId(nativeId: string): string | null {
  return /^crd-([1-9][0-9]{0,9})$/.exec(nativeId)?.[1] ?? null;
}

/** The one canonical public profile of a firm CRD. */
export function investorCanonicalSlug(crd: string): string {
  return `sec-crd-${crd}`;
}
export function investorReturnPath(crd: string): string {
  return `/firm/${investorCanonicalSlug(crd)}`;
}

/** One exact accepted row is eligible. Every other shape is denied. */
export function classifyInvestorRows(nativeId: string, rows: readonly InvestorBindingRow[]): InvestorBindingDecision {
  const crd = parseInvestorNativeId(nativeId);
  if (!crd) return { outcome: 'denied', reason: 'identity_disagreement' };
  if (rows.length === 0) return { outcome: 'denied', reason: 'missing' };
  if (rows.length > 1) return { outcome: 'denied', reason: 'ambiguous' };
  const row = rows[0]!;
  if (row.specialist_entity_type !== INVESTOR_PROFILE_CLASS) return { outcome: 'denied', reason: 'wrong_class' };
  if (row.binding_status === 'review_required') return { outcome: 'denied', reason: 'review_required' };
  if (row.entity_status !== 'active') return { outcome: 'denied', reason: 'inactive' };
  if (
    row.binding_status !== 'accepted' ||
    row.identifier_namespace !== INVESTOR_CRD_NAMESPACE ||
    row.source_identifier !== crd ||
    row.jurisdiction !== INVESTOR_JURISDICTION ||
    row.specialist_entity_id !== nativeId ||
    row.canonical_public_profile_ref !== investorReturnPath(crd)
  ) {
    return { outcome: 'denied', reason: 'identity_disagreement' };
  }
  return { outcome: 'eligible', id: row.id, networkEntityId: row.network_entity_id };
}

/** Security-definer read. The runtime role cannot select network tables.
 * Packet 14 creates this function. It is not applied by the deploy. */
export const INVESTOR_BINDING_SQL = `select id, network_entity_id, binding_status, specialist_entity_type,
  specialist_entity_id, identifier_namespace, source_identifier, jurisdiction, entity_status, canonical_public_profile_ref
 from v23_private.prod_investor_crd_binding_for($1)`;

export async function resolveInvestorOfficialFirmProfile(
  identity: ProfileIdentity,
  publication: PublicationRegistry,
  sql: FoundationSql,
): Promise<TrustedProfile | null> {
  if (identity.hub !== 'investor' || identity.profileClass !== INVESTOR_PROFILE_CLASS) return null;
  if (!parseInvestorNativeId(identity.nativeId)) return null;
  const current = await publication.resolve(identity);
  if (!current) return null;
  const profile: TrustedProfile = {
    ...current.identity,
    published: current.published,
    supportedClass: current.supportedClass,
    binding: null,
  };
  if (!profile.published || !profile.supportedClass) return profile;
  const found = await sql.query<InvestorBindingRow>(INVESTOR_BINDING_SQL, [identity.nativeId]);
  const decision = classifyInvestorRows(identity.nativeId, found.rows);
  if (decision.outcome === 'denied' && decision.reason === 'ambiguous') throw new RuntimeError('conflict');
  if (decision.outcome === 'eligible') {
    profile.binding = { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' };
  } else if (decision.outcome === 'denied' && decision.reason === 'review_required') {
    const row = found.rows[0]!;
    profile.binding = { id: row.id, networkEntityId: row.network_entity_id, status: 'review_required' };
  }
  return profile;
}
