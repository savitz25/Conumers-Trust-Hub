import type { ProfileIdentity, TrustedProfile } from '../contracts/v2-3-profile-save.ts';
import { profileKey } from '../contracts/v2-3-profile-transfer.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';

/** Must be supplied by the reviewed per-hub public profile mapper. No slug->ID,
 * publication or class guess is made here. Read inside the commit transaction
 * from an approved current publication snapshot, not untrusted browser JSON. */
export interface PublicationRegistry {
  resolve(identity: ProfileIdentity): Promise<{ identity: ProfileIdentity; published: boolean; supportedClass: boolean } | null>;
}
export async function resolveExactProfile(identity: ProfileIdentity, publication: PublicationRegistry, sql: FoundationSql): Promise<TrustedProfile | null> {
  const current = await publication.resolve(identity);
  if (!current) return null;
  if (profileKey(current.identity) !== profileKey(identity)) throw new RuntimeError('invalid');
  const profile: TrustedProfile = { ...current.identity, published: current.published, supportedClass: current.supportedClass, binding: null };
  if (!profile.published || !profile.supportedClass) return profile;
  const r = await sql.query<{ id: string; network_entity_id: string; binding_status: 'accepted' | 'review_required' }>(
    `select b.id, network.resolve_canonical_entity(b.network_entity_id) as network_entity_id, b.binding_status
     from network.network_entity_bindings b
     join network.network_entities e on e.id=network.resolve_canonical_entity(b.network_entity_id)
     where b.hub=$1 and b.specialist_entity_id=$2 and b.specialist_entity_type=$3
       and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
       and b.binding_status in ('accepted','review_required') and e.status='active'
     limit 2 for share of b,e`, [identity.hub, identity.nativeId, identity.profileClass]);
  // Multiple candidate records are not permission to invent a canonical merge.
  if (r.rows.length > 1) throw new RuntimeError('conflict');
  if (r.rows[0]) profile.binding = { id: r.rows[0].id, networkEntityId: r.rows[0].network_entity_id, status: r.rows[0].binding_status };
  return profile;
}
