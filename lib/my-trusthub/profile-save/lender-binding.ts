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

const LENDER_BINDING_SQL = `select b.id, b.network_entity_id, b.binding_status, b.specialist_entity_type,
  b.specialist_entity_id, b.identifier_namespace, b.source_identifier, b.jurisdiction, e.status as entity_status
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where b.hub='lender' and b.specialist_entity_type=$1 and b.specialist_entity_id=$2
   and b.identifier_namespace=$3 and b.source_identifier=$4 and b.jurisdiction='US'
   and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
   and b.binding_status in ('accepted','review_required')
 limit 3`;

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
  const found = await sql.query<LenderBindingRow>(LENDER_BINDING_SQL, [
    LENDER_PROFILE_CLASS,
    identity.nativeId,
    LENDER_NMLS_NAMESPACE,
    nmls,
  ]);
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
