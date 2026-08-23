import { CANONICAL_ORIGINS, isSpecialistHubId } from '../../network/registry';
import { parseNetworkEntityId } from '../discovery/identity';
import { validateDiscoveryEntity } from '../discovery/schema';
import type { NetworkDiscoveryEntity } from '../discovery/types';
import type { SearchHubId } from '../types';
import type { FeedValidationIssue } from './types';

const FORBIDDEN = [
  'complaints',
  'trust_score',
  'documents',
  'email',
  'phone',
  'ssn',
  'consumer_notes',
  'paid_rank',
  'premium',
  'popularity',
  'raum',
  'query',
];

function hostOk(url: string, hub: SearchHubId): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname === 'localhost' || u.hostname.endsWith('.vercel.app')) return false;
    if (u.username || u.password || u.port) return false;
    const expected = new URL(CANONICAL_ORIGINS[hub]).hostname;
    return u.hostname === expected;
  } catch {
    return false;
  }
}

export function validateRealFeedEntity(
  entity: NetworkDiscoveryEntity,
  expectedHub: SearchHubId,
  path = 'entity'
): FeedValidationIssue[] {
  const issues: FeedValidationIssue[] = [];
  if (entity.hub !== expectedHub) {
    issues.push({ path: `${path}.hub`, message: `expected ${expectedHub}` });
  }
  if (!isSpecialistHubId(entity.hub)) {
    issues.push({ path: `${path}.hub`, message: `invalid hub ${entity.hub}` });
  }
  try {
    const parsed = parseNetworkEntityId(entity.network_entity_id);
    if (parsed.hub !== entity.hub) {
      issues.push({ path: `${path}.network_entity_id`, message: `hub prefix mismatch` });
    }
    // Specialist identity may use UUID in the id and slug as source_entity_id (Contractor).
    if (!entity.source_entity_id) {
      issues.push({ path: `${path}.source_entity_id`, message: 'required' });
    }
  } catch (err) {
    issues.push({
      path: `${path}.network_entity_id`,
      message: err instanceof Error ? err.message : 'invalid id',
    });
  }
  if (!hostOk(entity.canonical_profile_url, expectedHub)) {
    issues.push({ path: `${path}.canonical_profile_url`, message: 'invalid specialist host' });
  }
  const status = entity.discovery_status ?? 'active';
  if (!['active', 'held', 'disabled'].includes(status)) {
    issues.push({ path: `${path}.discovery_status`, message: `invalid ${status}` });
  }
  for (const bad of FORBIDDEN) {
    if (Object.prototype.hasOwnProperty.call(entity, bad)) {
      issues.push({ path: `${path}.${bad}`, message: 'forbidden field' });
    }
  }
  issues.push(
    ...validateDiscoveryEntity(entity, path).filter(
      (i) => !i.message.includes('source_entity_id must match')
    )
  );
  return issues;
}

export function validateRealFeedEntities(
  entities: NetworkDiscoveryEntity[],
  expectedHub: SearchHubId
): { ok: boolean; issues: FeedValidationIssue[] } {
  const issues: FeedValidationIssue[] = [];
  const ids = new Set<string>();
  entities.forEach((e, i) => {
    const path = `entities[${i}]`;
    issues.push(...validateRealFeedEntity(e, expectedHub, path));
    if (ids.has(e.network_entity_id)) {
      issues.push({ path: `${path}.network_entity_id`, message: `duplicate ${e.network_entity_id}` });
    }
    ids.add(e.network_entity_id);
  });
  return { ok: issues.length === 0, issues };
}

export function envelopeFingerprint(raw: Record<string, unknown>): string | undefined {
  const fp = raw.fingerprint || raw.content_fingerprint;
  return typeof fp === 'string' ? fp : undefined;
}
