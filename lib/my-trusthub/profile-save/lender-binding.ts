import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';
import type { PublicationRegistry } from './identity.ts';

/** Established for this marketplace class. Ask had no earlier NMLS namespace. */
export const LENDER_NMLS_NAMESPACE = 'nmls';
export const LENDER_PROFILE_CLASS = 'marketplace_company';

export type LenderBindingRow = {
  id: string;
  network_entity_id: string;
  binding_status: string;
  specialist_entity_type: string;
  specialist_entity_id: string;
  identifier_namespace: string;
  source_identifier: string;
  jurisdiction: string;
  entity_status: string;
};

export type LenderBindingDecision =
  | { outcome: 'eligible'; id: string; networkEntityId: string }
  | { outcome: 'denied'; reason: 'missing' | 'ambiguous' | 'review_required' | 'identity_disagreement' | 'wrong_class' | 'inactive' };

export function lenderNativeId(nmls: string): string | null {
  return /^[1-9][0-9]{2,11}$/.test(nmls) ? `nmls:${nmls}` : null;
}

export function parseLenderNativeId(nativeId: string): string | null {
  const match = /^nmls:([1-9][0-9]{2,11})$/.exec(nativeId);
  return match?.[1] ?? null;
}

/** One exact accepted row is eligible. Every other shape is denied. */
export function classifyLenderRows(nativeId: string, rows: readonly LenderBindingRow[]): LenderBindingDecision {
  const nmls = parseLenderNativeId(nativeId);
  if (!nmls) return { outcome: 'denied', reason: 'identity_disagreement' };
  if (rows.length === 0) return { outcome: 'denied', reason: 'missing' };
  if (rows.length > 1) return { outcome: 'denied', reason: 'ambiguous' };
  const row = rows[0]!;
  if (row.specialist_entity_type !== LENDER_PROFILE_CLASS) return { outcome: 'denied', reason: 'wrong_class' };
  if (row.binding_status === 'review_required') return { outcome: 'denied', reason: 'review_required' };
  if (row.entity_status !== 'active') return { outcome: 'denied', reason: 'inactive' };
  if (
    row.binding_status !== 'accepted' ||
    row.identifier_namespace !== LENDER_NMLS_NAMESPACE ||
    row.source_identifier !== nmls ||
    row.jurisdiction !== 'US' ||
    row.specialist_entity_id !== nativeId
  ) {
    return { outcome: 'denied', reason: 'identity_disagreement' };
  }
  return { outcome: 'eligible', id: row.id, networkEntityId: row.network_entity_id };
}

/** Security-definer read. The runtime role cannot select network tables.
 * Packet 12 creates this function. It is not applied by the deploy. */
export const LENDER_BINDING_SQL = `select id, network_entity_id, binding_status, specialist_entity_type,
  specialist_entity_id, identifier_namespace, source_identifier, jurisdiction, entity_status
 from v23_private.prod_lender_nmls_binding_for($1)`;

export async function resolveLenderMarketplaceProfile(
  identity: ProfileIdentity,
  publication: PublicationRegistry,
  sql: FoundationSql,
): Promise<TrustedProfile | null> {
  if (identity.hub !== 'lender' || identity.profileClass !== LENDER_PROFILE_CLASS) return null;
  const nmls = parseLenderNativeId(identity.nativeId);
  if (!nmls) return null;
  const current = await publication.resolve(identity);
  if (!current) return null;
  const profile: TrustedProfile = {
    ...current.identity,
    published: current.published,
    supportedClass: current.supportedClass,
    binding: null,
  };
  if (!profile.published || !profile.supportedClass) return profile;
  const found = await sql.query<LenderBindingRow>(LENDER_BINDING_SQL, [identity.nativeId]);
  const decision = classifyLenderRows(identity.nativeId, found.rows);
  if (decision.outcome === 'denied' && decision.reason === 'ambiguous') throw new RuntimeError('conflict');
  if (decision.outcome === 'eligible') {
    profile.binding = { id: decision.id, networkEntityId: decision.networkEntityId, status: 'accepted' };
  } else if (decision.outcome === 'denied' && decision.reason === 'review_required') {
    const row = found.rows[0]!;
    profile.binding = { id: row.id, networkEntityId: row.network_entity_id, status: 'review_required' };
  }
  return profile;
}
